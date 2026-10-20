#!/usr/bin/env node
/**
 * write-badge-json.js: the README's tests, coverage, version and licence badges as shields.io endpoint files
 * (https://shields.io/badges/endpoint-badge), one JSON file per badge, and a README for the branch that holds them.
 *
 *   node scripts/badges/write-badge-json.js --out <dir> --tests <vitest-report.json> [--coverage <coverage-summary.json>] [--root <dir>]
 *
 *   tests.json     the tests the run passed, failed and skipped, counted from its Vitest JSON report
 *   coverage.json  line coverage from Vitest's coverage-summary.json, rounded down; written only with --coverage
 *   version.json   the version package.json names
 *   licence.json   the licence the LICENSE file names, or package.json's license field when there is no LICENSE file
 *
 * Every figure comes from the run or from the tree at --root (default: this repository); none is typed here. An input
 * that is missing, unreadable or not JSON stops the script before it writes anything, and it writes only into --out,
 * which must be new or empty.
 *
 * The Test Suite workflow's Unit Tests job runs it after its coverage run. On a push to master, its Update Badges job
 * replaces the badges branch with the files (scripts/badges/publish-badges-branch.sh), and the README's badge images
 * read them through jsDelivr: shields.io refuses any address whose host ends in github.com.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const USAGE =
  'usage: node scripts/badges/write-badge-json.js --out <dir> --tests <vitest-report.json> ' +
  '[--coverage <coverage-summary.json>] [--root <dir>]';

const OPTIONS = { '--out': 'out', '--tests': 'tests', '--coverage': 'coverage', '--root': 'root' };

/** The address a badge's file has on the badges branch, through jsDelivr. */
const badgeUrl = (repo, name) => `https://cdn.jsdelivr.net/gh/${repo}@badges/${name}.json`;

/** A shields.io endpoint: schemaVersion, label, message and colour are the fields its schema reads. */
const endpoint = (label, message, color) => ({ schemaVersion: 1, label, message, color });

/**
 * Counts the tests in a Vitest JSON report from their results. The report's own numPassedTests counts every test that
 * did not fail, skipped and todo tests included (Vitest 1.6), so it is not read. A test file that failed without a
 * failing test (one that could not load, say) counts as broken.
 */
function countTests(report) {
  if (!report || !Array.isArray(report.testResults)) {
    throw new Error('the test report has no testResults list; it is not a Vitest JSON report');
  }
  const counts = { passed: 0, failed: 0, skipped: 0, broken: 0 };
  for (const file of report.testResults) {
    const results = Array.isArray(file.assertionResults) ? file.assertionResults : [];
    for (const result of results) {
      if (result.status === 'passed') counts.passed += 1;
      else if (result.status === 'failed') counts.failed += 1;
      else counts.skipped += 1;
    }
    if (file.status === 'failed' && !results.some((result) => result.status === 'failed')) counts.broken += 1;
  }
  return counts;
}

function testsBadge(counts) {
  const parts = [`${counts.passed} passed`];
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.broken) parts.push(`${counts.broken} ${counts.broken === 1 ? 'file' : 'files'} failed to run`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  return endpoint('tests', parts.join(', '), counts.failed || counts.broken ? 'red' : 'brightgreen');
}

// The lowest whole percentage of each colour band.
const COVERAGE_BANDS = [
  [90, 'brightgreen'],
  [75, 'green'],
  [60, 'yellowgreen'],
  [40, 'yellow'],
  [20, 'orange'],
  [0, 'red'],
];

/** Line coverage from Vitest's coverage-summary.json, rounded down so the badge never overstates it. */
function coverageBadge(summary) {
  const pct = summary?.total?.lines?.pct;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error(`the coverage summary has no line percentage (total.lines.pct is ${JSON.stringify(pct)})`);
  }
  const figure = Math.floor(pct);
  const [, color] = COVERAGE_BANDS.find(([lowest]) => figure >= lowest);
  return endpoint('coverage', `${figure}%`, color);
}

function versionBadge(pkg) {
  const version = typeof pkg?.version === 'string' ? pkg.version.trim() : '';
  return version ? endpoint('version', `v${version}`, 'blue') : endpoint('version', 'not declared', 'lightgrey');
}

const LICENCE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt', 'COPYING'];

// Licences named by the opening lines of their published texts.
const KNOWN_LICENCES = [
  ['CC-BY-4.0', /^\s*Attribution 4\.0 International\s*$/m],
  ['CC-BY-SA-4.0', /^\s*Attribution-ShareAlike 4\.0 International\s*$/m],
  ['CC0-1.0', /^\s*CC0 1\.0 Universal\s*$/m],
  ['MIT', /^\s*(?:The )?MIT License\b/m],
  ['Apache-2.0', /^\s*Apache License\s*\r?\n\s*Version 2\.0, January 2004/m],
];

// Only the head of a licence file names its licence; notices further down can quote other licences.
const LICENCE_HEAD = 1000;

/** The SPDX identifier a licence text names: its SPDX-License-Identifier line, else its opening lines; or null. */
function identifyLicence(text) {
  const head = String(text).slice(0, LICENCE_HEAD);
  const spdx = /SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9.+-]+)*)/.exec(head);
  if (spdx) return spdx[1];
  const known = KNOWN_LICENCES.find(([, pattern]) => pattern.test(head));
  return known ? known[0] : null;
}

const isFile = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

/** The licence the LICENSE file at root names; package.json's license field only when there is no such file. */
function licenceBadge(root, pkg) {
  const name = LICENCE_FILES.find((candidate) => isFile(path.join(root, candidate)));
  if (name) {
    const id = identifyLicence(fs.readFileSync(path.join(root, name), 'utf8'));
    return id ? endpoint('licence', id, 'blue') : endpoint('licence', `see ${name}`, 'lightgrey');
  }
  const declared = typeof pkg?.license === 'string' ? pkg.license : pkg?.license?.type;
  return declared ? endpoint('licence', declared, 'blue') : endpoint('licence', 'not declared', 'lightgrey');
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${what} at ${file}: ${err.code || err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${what} at ${file} is not JSON: ${err.message}`);
  }
}

/** Every badge, from the inputs; reads them all before anything is written. */
function buildBadges({ tests, coverage, root }) {
  const pkg = readJson(path.join(root, 'package.json'), 'package.json');
  const badges = { tests: testsBadge(countTests(readJson(tests, 'the test report'))) };
  if (coverage) badges.coverage = coverageBadge(readJson(coverage, 'the coverage summary'));
  badges.version = versionBadge(pkg);
  badges.licence = licenceBadge(root, pkg);
  return badges;
}

function branchReadme(repo) {
  return [
    '# badges',
    '',
    'CI writes these files; nothing here is edited by hand. On each push to master that runs the Test Suite workflow',
    '(.github/workflows/test.yml on master), its Unit Tests job writes them from its own test and coverage run',
    '(scripts/badges/write-badge-json.js), and its Update Badges job replaces this branch with them',
    '(scripts/badges/publish-badges-branch.sh). Each JSON file is a shields.io endpoint',
    '(https://shields.io/badges/endpoint-badge). The README on master reads them through jsDelivr:',
    `https://img.shields.io/endpoint?url=${badgeUrl(repo, '<name>')}, with the url parameter URL-encoded.`,
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const options = { root: path.resolve(__dirname, '..', '..') };
  for (let i = 0; i < argv.length; i += 2) {
    const key = OPTIONS[argv[i]];
    if (!key || i + 1 >= argv.length) throw new Error(`unknown or incomplete argument ${argv[i]}; ${USAGE}`);
    options[key] = argv[i + 1];
  }
  if (!options.out || !options.tests) throw new Error(USAGE);
  return options;
}

function writeBadges(out, badges, repo) {
  if (fs.existsSync(out) && fs.readdirSync(out).length > 0) {
    throw new Error(`the --out directory ${out} is not empty; give a new or empty directory`);
  }
  fs.mkdirSync(out, { recursive: true });
  for (const [name, badge] of Object.entries(badges)) {
    fs.writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(badge)}\n`);
  }
  fs.writeFileSync(path.join(out, 'README.md'), branchReadme(repo));
}

function main(argv, { log = console.log } = {}) {
  const options = parseArgs(argv);
  const badges = buildBadges(options);
  writeBadges(options.out, badges, process.env.GITHUB_REPOSITORY || 'framerslab/codex');
  for (const [name, badge] of Object.entries(badges)) log(`${name.padEnd(9)} ${badge.message}`);
  return badges;
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`write-badge-json: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  countTests,
  testsBadge,
  coverageBadge,
  versionBadge,
  identifyLicence,
  licenceBadge,
  buildBadges,
  badgeUrl,
  main,
};
