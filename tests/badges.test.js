/**
 * The README's tests, coverage, version and licence badges are shields.io endpoint badges
 * (https://shields.io/badges/endpoint-badge), one JSON file per badge. The Test Suite workflow's Unit Tests job writes
 * the files from its own run with scripts/badges/write-badge-json.js. On a push to master, its Update Badges job
 * replaces the badges branch with them through scripts/badges/publish-badges-branch.sh: one commit with no parent,
 * pushed with a lease on the head it read, unless the branch already holds a later master commit's badges. The README
 * reads the files through jsDelivr, since shields.io refuses any address whose host ends in github.com (blockedDomains
 * in its services/endpoint/endpoint.service.js). No job commits to master.
 *
 * The Update Badges job used to run only when github.ref was refs/heads/main, a branch this repository does not have,
 * so it was skipped on every master run and the README kept SVG files committed to master in December 2025.
 *
 * These tests run the writer on known inputs, run the publisher against a bare scratch repository standing in for
 * GitHub, and read the workflow and the README the two serve.
 *
 * Run: npx vitest run tests/badges.test.js
 */

import { describe, it, expect, afterAll } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const WRITER = path.join(root, 'scripts', 'badges', 'write-badge-json.js');
const PUBLISHER = path.join(root, 'scripts', 'badges', 'publish-badges-branch.sh');
// Loaded by the tests that need it, so a missing writer fails those and leaves the others to report.
const writer = () => require(WRITER);

const BADGES = ['tests', 'coverage', 'version', 'licence'];
const jsdelivr = (name) => `https://cdn.jsdelivr.net/gh/framerslab/codex@badges/${name}.json`;

const scratch = [];
const tempDir = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of scratch) fs.rmSync(dir, { recursive: true, force: true });
});

// Writes each file under dir; an object is written as JSON.
const put = (dir, files) => {
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof body === 'string' ? body : `${JSON.stringify(body, null, 2)}\n`);
  }
};

// The fields shields.io's endpoint schema requires (services/endpoint-common.js): schemaVersion 1, a label, which may
// be empty, a message, which may not, and a colour given by name or as hex.
const expectEndpoint = (badge, name) => {
  expect(badge.schemaVersion, name).toBe(1);
  expect(typeof badge.label, name).toBe('string');
  expect(typeof badge.message, name).toBe('string');
  expect(badge.message.length, name).toBeGreaterThan(0);
  expect(badge.color, name).toMatch(/^([a-z]+|[0-9a-f]{6})$/);
};

const result = (title, status) => ({ ancestorTitles: [], fullName: title, title, status, failureMessages: [] });
const file = (name, status, assertionResults, message = '') => ({
  name: `/repo/tests/${name}`,
  status,
  message,
  startTime: 0,
  endTime: 1,
  assertionResults,
});

// A report as Vitest 1.6's JSON reporter writes it for a run with three passing tests, one failing, one skipped and
// one todo. That reporter counts numPassedTests as every test that did not fail (5 here), so the writer counts the
// results themselves.
const REPORT = {
  numTotalTestSuites: 2,
  numPassedTestSuites: 2,
  numFailedTestSuites: 0,
  numPendingTestSuites: 0,
  numTotalTests: 6,
  numPassedTests: 5,
  numFailedTests: 1,
  numPendingTests: 0,
  numTodoTests: 1,
  startTime: 0,
  success: false,
  testResults: [
    file('a.test.js', 'failed', [result('one', 'passed'), result('two', 'passed'), result('three', 'failed')]),
    file('b.test.js', 'passed', [result('four', 'passed'), result('five', 'skipped'), result('six', 'todo')]),
  ],
};
const PASSING = {
  ...REPORT,
  numTotalTestSuites: 1,
  numPassedTestSuites: 1,
  numTotalTests: 4,
  numPassedTests: 4,
  numFailedTests: 0,
  numTodoTests: 0,
  success: true,
  testResults: [file('a.test.js', 'passed', ['one', 'two', 'three', 'four'].map((title) => result(title, 'passed')))],
};

// coverage/coverage-summary.json, from the json-summary reporter vitest.config.js names.
const metric = (total, covered) => ({ total, covered, skipped: 0, pct: Math.round((covered / total) * 10000) / 100 });
const SUMMARY = {
  total: {
    lines: metric(5000, 1327),
    statements: metric(5000, 1327),
    functions: metric(200, 124),
    branches: metric(400, 289),
  },
};

const CC_BY_4 = [
  'Attribution 4.0 International',
  '',
  '=======================================================================',
  '',
  'Creative Commons Corporation ("Creative Commons") is not a law firm and',
  'does not provide legal services or legal advice.',
  '',
].join('\n');
const MIT = 'MIT License\n\nCopyright (c) 2026 Example\n\nPermission is hereby granted, free of charge, to any person\n';
const APACHE = [
  '',
  '                                 Apache License',
  '                           Version 2.0, January 2004',
  '                        http://www.apache.org/licenses/',
  '',
].join('\n');

describe('write-badge-json.js counts what the run measured', () => {
  it('counts the tests from their results, not from numPassedTests', () => {
    expect(writer().countTests(REPORT)).toEqual({ passed: 3, failed: 1, skipped: 2, broken: 0 });
  });

  it('counts a test file that failed to run, which has no failing test', () => {
    const { countTests, testsBadge } = writer();
    const report = {
      ...PASSING,
      testResults: [...PASSING.testResults, file('c.test.js', 'failed', [], 'SyntaxError: Unexpected token')],
    };
    const counts = countTests(report);
    expect(counts).toEqual({ passed: 4, failed: 0, skipped: 0, broken: 1 });
    expect(testsBadge(counts)).toMatchObject({ message: '4 passed, 1 file failed to run', color: 'red' });
  });

  it('writes the tests badge', () => {
    const { countTests, testsBadge } = writer();
    expect(testsBadge(countTests(PASSING))).toEqual({
      schemaVersion: 1,
      label: 'tests',
      message: '4 passed',
      color: 'brightgreen',
    });
    expect(testsBadge(countTests(REPORT))).toEqual({
      schemaVersion: 1,
      label: 'tests',
      message: '3 passed, 1 failed, 2 skipped',
      color: 'red',
    });
    expect(testsBadge({ passed: 1, failed: 0, skipped: 0, broken: 2 }).message).toBe('1 passed, 2 files failed to run');
  });

  it('refuses a report with no list of results', () => {
    expect(() => writer().countTests({ numPassedTests: 5 })).toThrow(/testResults/);
    expect(() => writer().countTests(null)).toThrow(/testResults/);
  });

  it('writes line coverage, rounded down, coloured by its band', () => {
    const { coverageBadge } = writer();
    expect(coverageBadge(SUMMARY)).toEqual({ schemaVersion: 1, label: 'coverage', message: '26%', color: 'orange' });
    const at = (pct) => coverageBadge({ total: { lines: { pct } } });
    expect(at(100)).toMatchObject({ message: '100%', color: 'brightgreen' });
    expect(at(89.99)).toMatchObject({ message: '89%', color: 'green' });
    expect(at(60)).toMatchObject({ message: '60%', color: 'yellowgreen' });
    expect(at(45.5)).toMatchObject({ message: '45%', color: 'yellow' });
    expect(at(0)).toMatchObject({ message: '0%', color: 'red' });
  });

  it('refuses a summary with no line percentage', () => {
    const { coverageBadge } = writer();
    expect(() => coverageBadge({ total: { lines: { pct: 'Unknown' } } })).toThrow(/line/);
    expect(() => coverageBadge({ total: { lines: { pct: 101 } } })).toThrow(/line/);
    expect(() => coverageBadge({})).toThrow(/line/);
  });

  it('writes the version package.json names', () => {
    const { versionBadge } = writer();
    expect(versionBadge({ version: '0.1.0' })).toEqual({
      schemaVersion: 1,
      label: 'version',
      message: 'v0.1.0',
      color: 'blue',
    });
    expect(versionBadge({ name: 'scratch' })).toMatchObject({ message: 'not declared', color: 'lightgrey' });
  });

  it('names a licence by its SPDX line or by the opening lines of its text', () => {
    const { identifyLicence } = writer();
    expect(identifyLicence(CC_BY_4)).toBe('CC-BY-4.0');
    expect(identifyLicence('Attribution-ShareAlike 4.0 International\n')).toBe('CC-BY-SA-4.0');
    expect(identifyLicence(MIT)).toBe('MIT');
    expect(identifyLicence(APACHE)).toBe('Apache-2.0');
    expect(identifyLicence('// SPDX-License-Identifier: MPL-2.0\n')).toBe('MPL-2.0');
    expect(identifyLicence('All rights reserved.\n')).toBeNull();
    // A notice far down the file, such as a bundled dependency's MIT text, does not name the file's licence.
    expect(identifyLicence(`${APACHE}\n${'Terms and conditions.\n'.repeat(100)}MIT License\n`)).toBe('Apache-2.0');
  });

  it('reads the licence from the LICENSE file, and from package.json when there is none', () => {
    const { licenceBadge } = writer();
    const licensed = tempDir('badges-licence-');
    put(licensed, { LICENSE: CC_BY_4 });
    expect(licenceBadge(licensed, { license: 'MIT' })).toEqual({
      schemaVersion: 1,
      label: 'licence',
      message: 'CC-BY-4.0',
      color: 'blue',
    });
    const unknown = tempDir('badges-licence-');
    put(unknown, { 'LICENSE.md': 'All rights reserved.\n' });
    expect(licenceBadge(unknown, {})).toMatchObject({ message: 'see LICENSE.md', color: 'lightgrey' });
    const none = tempDir('badges-licence-');
    expect(licenceBadge(none, { license: 'MIT' })).toMatchObject({ message: 'MIT', color: 'blue' });
    expect(licenceBadge(none, { license: { type: 'ISC' } })).toMatchObject({ message: 'ISC', color: 'blue' });
    expect(licenceBadge(none, { private: true })).toMatchObject({ message: 'not declared', color: 'lightgrey' });
  });

  it('names the licence the README states from this repository\'s LICENSE file', () => {
    const named = /licensed under \[([^\]]+)\]\(LICENSE\)/.exec(read('README.md'));
    expect(named, 'the README names its licence and links LICENSE').not.toBeNull();
    expect(writer().identifyLicence(read('LICENSE'))).toBe(named[1]);
  });
});

describe('write-badge-json.js writes one endpoint file per badge', () => {
  const inputs = () => {
    const dir = tempDir('badges-in-');
    put(dir, {
      'repo/package.json': { name: 'scratch', version: '1.2.3', private: true },
      'repo/LICENSE': CC_BY_4,
      'repo/README.md': '# scratch\n',
      'vitest-report.json': PASSING,
      'coverage-summary.json': SUMMARY,
      'not-json.json': 'tests: 4\n',
    });
    return {
      dir,
      repo: path.join(dir, 'repo'),
      tests: path.join(dir, 'vitest-report.json'),
      coverage: path.join(dir, 'coverage-summary.json'),
    };
  };
  const outDir = () => path.join(tempDir('badges-out-'), 'badges');
  const badgeIn = (out, name) => JSON.parse(fs.readFileSync(path.join(out, `${name}.json`), 'utf8'));
  const quiet = { log: () => {} };

  it('writes tests, coverage, version and licence, and a README for the branch', () => {
    const { repo, tests, coverage } = inputs();
    const out = outDir();
    const lines = [];
    writer().main(['--out', out, '--tests', tests, '--coverage', coverage, '--root', repo], {
      log: (line) => lines.push(line),
    });

    expect(fs.readdirSync(out).sort()).toEqual([
      'README.md',
      'coverage.json',
      'licence.json',
      'tests.json',
      'version.json',
    ]);
    for (const name of BADGES) expectEndpoint(badgeIn(out, name), name);
    expect(BADGES.map((name) => [badgeIn(out, name).label, badgeIn(out, name).message])).toEqual([
      ['tests', '4 passed'],
      ['coverage', '26%'],
      ['version', 'v1.2.3'],
      ['licence', 'CC-BY-4.0'],
    ]);
    const readme = fs.readFileSync(path.join(out, 'README.md'), 'utf8');
    expect(readme).toContain('https://img.shields.io/endpoint?url=');
    expect(readme).toContain('https://cdn.jsdelivr.net/gh/');
    expect(lines).toHaveLength(BADGES.length);
    expect(lines.join('\n')).toContain('26%');
    // It reads the tree and writes only into --out.
    expect(fs.readdirSync(repo).sort()).toEqual(['LICENSE', 'README.md', 'package.json']);
  });

  it('writes no coverage badge when the run measured none, rather than a typed figure', () => {
    const { repo, tests } = inputs();
    const out = outDir();
    writer().main(['--out', out, '--tests', tests, '--root', repo], quiet);
    expect(fs.readdirSync(out).sort()).toEqual(['README.md', 'licence.json', 'tests.json', 'version.json']);
  });

  it('stops before writing anything when an input is missing, unreadable or not JSON', () => {
    const { dir, repo, tests, coverage } = inputs();
    const cases = [
      [['--tests', path.join(dir, 'missing.json'), '--coverage', coverage, '--root', repo], /test report/],
      [['--tests', tests, '--coverage', path.join(dir, 'missing.json'), '--root', repo], /coverage summary/],
      [['--tests', path.join(dir, 'not-json.json'), '--coverage', coverage, '--root', repo], /not JSON/],
      [['--tests', tests, '--root', path.join(dir, 'no-repo')], /package\.json/],
    ];
    for (const [args, message] of cases) {
      const out = outDir();
      expect(() => writer().main(['--out', out, ...args], quiet), args.join(' ')).toThrow(message);
      expect(fs.existsSync(out), args.join(' ')).toBe(false);
    }
  });

  it('refuses unknown or incomplete arguments, and an --out directory that holds files', () => {
    const { repo, tests } = inputs();
    const { main } = writer();
    expect(() => main(['--tests', tests, '--root', repo], quiet)).toThrow(/usage/);
    expect(() => main(['--out', outDir(), '--root', repo], quiet)).toThrow(/usage/);
    expect(() => main(['--out', outDir(), '--tests', tests, '--bogus', 'x'], quiet)).toThrow(/--bogus/);
    expect(() => main(['--out', outDir(), '--tests'], quiet)).toThrow(/--tests/);
    const used = outDir();
    put(used, { 'old.json': '{}\n' });
    expect(() => main(['--out', used, '--tests', tests, '--root', repo], quiet)).toThrow(/not empty/);
    expect(fs.readdirSync(used)).toEqual(['old.json']);
  });

  it('runs from the command line: exit 0 with the files, exit 1 and a reason without them', () => {
    const { dir, repo, tests, coverage } = inputs();
    const out = outDir();
    const ok = spawnSync(process.execPath, [WRITER, '--out', out, '--tests', tests, '--coverage', coverage, '--root', repo], {
      encoding: 'utf8',
    });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('4 passed');
    expect(fs.readdirSync(out)).toContain('tests.json');

    const missing = outDir();
    const bad = spawnSync(process.execPath, [WRITER, '--out', missing, '--tests', path.join(dir, 'missing.json'), '--root', repo], {
      encoding: 'utf8',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('test report');
    expect(fs.existsSync(missing)).toBe(false);
  });
});

// A git command with an identity, so commits made here never depend on the machine's configuration.
const git = (cwd, ...args) => {
  const res = spawnSync(
    'git',
    ['-c', 'user.email=ci@example.com', '-c', 'user.name=ci', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' }
  );
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
};
// A git command against the bare repository standing in for GitHub.
const remoteGit = (remote, ...args) => git(remote, `--git-dir=${remote}`, ...args);

describe('publish-badges-branch.sh replaces the badges branch and nothing else', () => {
  // A bare repository standing in for GitHub, with master pushed, and a clone of it, the way the Update Badges job
  // runs the script in its checkout.
  const setup = () => {
    const dir = tempDir('publish-badges-');
    const remote = path.join(dir, 'remote.git');
    const clone = path.join(dir, 'clone');
    const badges = path.join(dir, 'out');
    fs.mkdirSync(remote);
    git(remote, 'init', '-q', '--bare');
    fs.mkdirSync(clone);
    git(clone, 'init', '-q');
    put(clone, { 'package.json': { name: 'scratch', version: '1.0.0' } });
    git(clone, 'add', '-A');
    git(clone, 'commit', '-q', '-m', 'master');
    const master = git(clone, 'rev-parse', 'HEAD');
    git(clone, 'remote', 'add', 'origin', remote);
    git(clone, 'push', '-q', 'origin', 'HEAD:refs/heads/master');

    const writeDir = (files) => {
      fs.rmSync(badges, { recursive: true, force: true });
      fs.mkdirSync(badges, { recursive: true });
      put(badges, files);
    };
    // Runs the publisher in the clone, or in another checkout (cwd), as the run of master's first commit unless env
    // names another.
    const publish = (env = {}, cwd = clone) =>
      spawnSync('bash', [PUBLISHER, badges], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, BADGES_SOURCE_SHA: master, ...env },
      });
    // The badges branch on the remote: its head, parents, files and message.
    const branch = () => {
      const head = remoteGit(remote, 'rev-parse', 'refs/heads/badges');
      return {
        head,
        parents: remoteGit(remote, 'rev-list', '--parents', '-n', '1', head).split(' ').slice(1),
        files: remoteGit(remote, 'ls-tree', '--name-only', head).split('\n').sort(),
        message: remoteGit(remote, 'log', '-1', '--format=%s', head),
        read: (name) => remoteGit(remote, 'show', `${head}:${name}`),
      };
    };
    const refs = () => remoteGit(remote, 'for-each-ref', '--format=%(refname)').split('\n').sort();
    const masterHead = () => remoteGit(remote, 'rev-parse', 'refs/heads/master');
    // A later commit on master, pushed the way the next merge lands; returns its sha.
    const advance = (message) => {
      put(clone, { 'CHANGELOG.md': `${message}\n` });
      git(clone, 'add', '-A');
      git(clone, 'commit', '-q', '-m', message);
      git(clone, 'push', '-q', 'origin', 'HEAD:refs/heads/master');
      return git(clone, 'rev-parse', 'HEAD');
    };
    // A force-push that moves master to the given commit.
    const moveMaster = (sha) => git(clone, 'push', '-q', '--force', 'origin', `${sha}:refs/heads/master`);
    // A force-push that replaces master with a commit unrelated to its history; returns that commit's sha.
    const rewrite = (message) => {
      const commit = git(clone, 'commit-tree', git(clone, 'write-tree'), '-m', message);
      moveMaster(commit);
      return commit;
    };
    // A depth-1 clone of master as it stands now, the checkout actions/checkout makes by default.
    const shallowClone = () => {
      const into = path.join(dir, 'shallow');
      git(dir, 'clone', '-q', '--depth', '1', '--branch', 'master', `file://${remote}`, into);
      return into;
    };
    const helpers = { writeDir, publish, branch, refs, masterHead, advance, moveMaster, rewrite, shallowClone };
    return { dir, remote, master, ...helpers };
  };

  it('starts the branch with one parentless commit that holds exactly the files', () => {
    const repo = setup();
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n', 'README.md': 'CI writes this branch.\n' });
    const res = repo.publish();
    expect(res.status, res.stderr).toBe(0);

    const b = repo.branch();
    expect(b.parents).toEqual([]);
    expect(b.files).toEqual(['README.md', 'tests.json']);
    expect(b.read('tests.json')).toBe('{"message":"4 passed"}');
    expect(b.message).toBe(`badges for ${repo.master}`);
    expect(repo.masterHead()).toBe(repo.master);
    expect(repo.refs()).toEqual(['refs/heads/badges', 'refs/heads/master']);
  });

  it('pushes nothing when the branch already holds the same files from the same commit', () => {
    const repo = setup();
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    expect(repo.publish().status).toBe(0);
    const before = repo.branch().head;

    const res = repo.publish();
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('nothing to push');
    expect(repo.branch().head).toBe(before);
  });

  it('replaces the branch with new files, dropping the files the directory no longer holds', () => {
    const repo = setup();
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n', 'old.json': '{"message":"old"}\n' });
    expect(repo.publish().status).toBe(0);
    const before = repo.branch().head;

    repo.writeDir({ 'tests.json': '{"message":"5 passed"}\n', 'coverage.json': '{"message":"26%"}\n' });
    const res = repo.publish();
    expect(res.status, res.stderr).toBe(0);
    const b = repo.branch();
    expect(b.head).not.toBe(before);
    expect(b.parents).toEqual([]);
    expect(b.files).toEqual(['coverage.json', 'tests.json']);
    expect(b.read('tests.json')).toBe('{"message":"5 passed"}');
    expect(repo.masterHead()).toBe(repo.master);
    expect(repo.refs()).toEqual(['refs/heads/badges', 'refs/heads/master']);
  });

  it('fails and keeps the newer head when the branch moves after the run read it', () => {
    const repo = setup();
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    expect(repo.publish().status).toBe(0);

    // Another writer's commit, already on the remote under another name.
    const other = path.join(repo.dir, 'other');
    fs.mkdirSync(other);
    git(other, 'init', '-q');
    put(other, { 'tests.json': '{"message":"from another run"}\n' });
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', 'another run');
    const foreign = git(other, 'rev-parse', 'HEAD');
    git(other, 'push', '-q', repo.remote, 'HEAD:refs/heads/foreign');

    // A git ahead of the real one on PATH moves the branch, the way a second writer would, as the script starts its
    // push: after the script read the branch, before the push reads the remote's refs. The lease on the head the
    // script read refuses the push, where a plain --force would replace the newer head.
    const bin = path.join(repo.dir, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(
      path.join(bin, 'git'),
      [
        '#!/usr/bin/env bash',
        '# The real git is the next one on PATH.',
        'export PATH="${PATH#*:}"',
        'if [ "$1" = "push" ] && [ ! -e "$LEASE_MARK" ]; then',
        '  touch "$LEASE_MARK"',
        '  git --git-dir="$LEASE_REMOTE" update-ref refs/heads/badges "$LEASE_FOREIGN"',
        'fi',
        'exec git "$@"',
        '',
      ].join('\n')
    );
    fs.chmodSync(path.join(bin, 'git'), 0o755);
    const mark = path.join(repo.dir, 'branch-moved');

    repo.writeDir({ 'tests.json': '{"message":"5 passed"}\n' });
    const res = repo.publish({
      PATH: `${bin}:${process.env.PATH}`,
      LEASE_REMOTE: repo.remote,
      LEASE_FOREIGN: foreign,
      LEASE_MARK: mark,
    });
    expect(fs.existsSync(mark), 'the branch moved before the push').toBe(true);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('badges');
    expect(remoteGit(repo.remote, 'rev-parse', 'refs/heads/badges')).toBe(foreign);
    expect(repo.masterHead()).toBe(repo.master);
  });

  // Update Badges runs one job at a time, in no set order. Pushes A then B land on master, B's job publishes first,
  // and A's job reads B's head, so its lease on that head holds. Each head's message names the commit its files were
  // counted from, which tells the publisher B's badges are the later ones.
  it.each([
    ["a clone that holds master's history", false],
    ['a depth-1 clone made before the later commit landed', true],
  ])("keeps a later commit's badges when an earlier commit's run comes after it, from %s", (_, shallow) => {
    const repo = setup();
    const earlier = repo.master;
    const checkout = shallow ? repo.shallowClone() : undefined;
    const later = repo.advance('a later merge');
    repo.writeDir({ 'tests.json': '{"message":"5 passed"}\n' });
    expect(repo.publish({ BADGES_SOURCE_SHA: later }).status).toBe(0);
    const head = repo.branch().head;

    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    const res = repo.publish({ BADGES_SOURCE_SHA: earlier }, checkout);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('nothing to push');
    const b = repo.branch();
    expect(b.head).toBe(head);
    expect(b.message).toBe(`badges for ${later}`);
    expect(b.read('tests.json')).toBe('{"message":"5 passed"}');
    expect(repo.masterHead()).toBe(later);
  });

  it('names a later commit that counted the same files, so a run of a commit between them cannot replace them', () => {
    // Master holds first, middle and last, in that order. The first and last runs count the same figures, the middle
    // run's differ, and the jobs reach the branch first, last, middle. The last run must name its commit on the head;
    // a head still naming the first commit would let the middle run, later than that, replace the last run's figures.
    const repo = setup();
    const first = repo.master;
    const middle = repo.advance('a later merge');
    const last = repo.advance('the latest merge');
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    expect(repo.publish({ BADGES_SOURCE_SHA: first }).status).toBe(0);

    const same = repo.publish({ BADGES_SOURCE_SHA: last });
    expect(same.status, same.stderr).toBe(0);
    expect(repo.branch().message).toBe(`badges for ${last}`);
    expect(repo.branch().read('tests.json')).toBe('{"message":"4 passed"}');

    repo.writeDir({ 'tests.json': '{"message":"3 passed"}\n' });
    const late = repo.publish({ BADGES_SOURCE_SHA: middle });
    expect(late.status, late.stderr).toBe(0);
    expect(late.stdout).toContain('nothing to push');
    const b = repo.branch();
    expect(b.message).toBe(`badges for ${last}`);
    expect(b.read('tests.json')).toBe('{"message":"4 passed"}');
    expect(b.parents).toEqual([]);
  });

  it('pushes nothing for a commit master no longer holds, after a force-push replaced its history', () => {
    // A force-push moves master from first to an unrelated commit, whose run publishes first. The delayed run of first,
    // a commit master has dropped, must leave those figures in place.
    const repo = setup();
    const first = repo.master;
    const replacement = repo.rewrite('master replaced by a force-push');
    repo.writeDir({ 'tests.json': '{"message":"5 passed"}\n' });
    expect(repo.publish({ BADGES_SOURCE_SHA: replacement }).status).toBe(0);
    const head = repo.branch().head;

    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    const res = repo.publish({ BADGES_SOURCE_SHA: first });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('nothing to push');
    const b = repo.branch();
    expect(b.head).toBe(head);
    expect(b.message).toBe(`badges for ${replacement}`);
    expect(b.read('tests.json')).toBe('{"message":"5 passed"}');
    expect(repo.masterHead()).toBe(replacement);
  });

  it('replaces the badges of a commit master no longer holds, after a force-push moved master back', () => {
    // master goes from first to later, whose run publishes, and a force-push then moves master back to first. The run
    // of first must replace the badges of later, a commit master has dropped, though first is an ancestor of it.
    const repo = setup();
    const first = repo.master;
    const later = repo.advance('a later merge');
    repo.writeDir({ 'tests.json': '{"message":"5 passed"}\n' });
    expect(repo.publish({ BADGES_SOURCE_SHA: later }).status).toBe(0);

    repo.moveMaster(first);
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    const res = repo.publish({ BADGES_SOURCE_SHA: first });
    expect(res.status, res.stderr).toBe(0);
    const b = repo.branch();
    expect(b.message).toBe(`badges for ${first}`);
    expect(b.read('tests.json')).toBe('{"message":"4 passed"}');
    expect(repo.masterHead()).toBe(first);
  });

  it("replaces an earlier commit's badges with a later commit's", () => {
    const repo = setup();
    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    expect(repo.publish().status).toBe(0);

    const later = repo.advance('a later merge');
    repo.writeDir({ 'tests.json': '{"message":"5 passed"}\n' });
    const res = repo.publish({ BADGES_SOURCE_SHA: later });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stderr).not.toContain('::warning::');
    const b = repo.branch();
    expect(b.parents).toEqual([]);
    expect(b.message).toBe(`badges for ${later}`);
    expect(b.read('tests.json')).toBe('{"message":"5 passed"}');
    expect(repo.masterHead()).toBe(later);
  });

  it('replaces badges counted from a commit it cannot find, with a warning that names it', () => {
    // A head naming a commit this repository does not hold (master rewritten since, or a commit made by hand) gives no
    // order to keep, so the run's files replace it.
    const repo = setup();
    const lost = 'd'.repeat(40);
    const other = path.join(repo.dir, 'other');
    fs.mkdirSync(other);
    git(other, 'init', '-q');
    put(other, { 'tests.json': '{"message":"from a lost commit"}\n' });
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '-m', `badges for ${lost}`);
    git(other, 'push', '-q', repo.remote, 'HEAD:refs/heads/badges');

    repo.writeDir({ 'tests.json': '{"message":"4 passed"}\n' });
    const res = repo.publish();
    expect(res.status, res.stderr).toBe(0);
    expect(res.stderr).toContain('::warning::');
    expect(res.stderr).toContain(lost);
    const b = repo.branch();
    expect(b.message).toBe(`badges for ${repo.master}`);
    expect(b.read('tests.json')).toBe('{"message":"4 passed"}');
  });

  it('refuses an empty directory', () => {
    const repo = setup();
    repo.writeDir({});
    const res = repo.publish();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('no files');
    expect(repo.refs()).toEqual(['refs/heads/master']);
  });
});

describe('the Test Suite workflow publishes the badges from master, and never to it', () => {
  const workflow = yaml.load(read('.github/workflows/test.yml'));
  const job = workflow.jobs['update-badges'];
  const unitTests = workflow.jobs['unit-tests'];
  const stepRunning = (steps, text) => steps.find((step) => String(step.run).includes(text));
  const stepUsing = (steps, action) => steps.find((step) => String(step.uses).startsWith(`${action}@`));

  it('runs Update Badges on pushes to master, the branch this repository has', () => {
    expect(job.name).toBe('Update Badges');
    expect(job.if).toContain("github.ref == 'refs/heads/master'");
    expect(job.if).toContain("github.event_name == 'push'");
    expect(job.if).not.toContain('refs/heads/main');
    expect(workflow.on.push.branches).toContain('master');
  });

  it('runs it after the whole suite passed, one run at a time, never cancelling one that started', () => {
    expect([...job.needs].sort()).toEqual(['cache-tests', 'integration', 'unit-tests', 'vocab-tests']);
    expect(String(job.concurrency?.group)).toMatch(/badges/);
    expect(job.concurrency?.['cancel-in-progress']).toBe(false);
    expect(
      stepUsing(job.steps, 'actions/checkout').with?.['fetch-depth'],
      "the publisher reads master's history to keep a later commit's badges"
    ).toBe(0);
  });

  it('gives contents: write to that job alone', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(job.permissions).toEqual({ contents: 'write' });
    for (const [id, other] of Object.entries(workflow.jobs)) {
      if (id !== 'update-badges') expect(other.permissions, id).toBeUndefined();
    }
  });

  it('writes the files in the Unit Tests job and publishes them with the publisher, pushing nothing itself', () => {
    const coverageRun = stepRunning(unitTests.steps, '--coverage');
    expect(coverageRun.run).toMatch(/--reporter=json/);
    expect(coverageRun.run).toMatch(/--outputFile\.json=/);
    const write = stepRunning(unitTests.steps, 'scripts/badges/write-badge-json.js');
    expect(write.run).toMatch(/--tests\s/);
    expect(write.run).toMatch(/--coverage coverage\/coverage-summary\.json/);
    const upload = unitTests.steps.find(
      (step) => String(step.uses).startsWith('actions/upload-artifact@') && step.with?.name === 'badges'
    );
    expect(upload, 'the Unit Tests job uploads the badge files').toBeTruthy();
    expect(stepUsing(job.steps, 'actions/download-artifact').with.name).toBe('badges');
    expect(stepRunning(job.steps, 'scripts/badges/publish-badges-branch.sh')).toBeTruthy();

    const pushes = Object.values(workflow.jobs)
      .flatMap((each) => each.steps)
      .filter((step) => /\bgit\s+push\b/.test(String(step.run)))
      .map((step) => step.name);
    expect(pushes).toEqual([]);
  });

  it('runs on master when an input of the badges changes', () => {
    expect(workflow.on.push.paths).toEqual(
      expect.arrayContaining(['scripts/**', 'tests/**', 'package.json', 'LICENSE', '.github/workflows/test.yml'])
    );
  });

  it('has run blocks, and a publisher, that bash can parse', () => {
    const blocks = [...unitTests.steps, ...job.steps]
      .filter((step) => step.run)
      .map((step) => step.run.replace(/\$\{\{[^}]*\}\}/g, 'X'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of [...blocks, fs.readFileSync(PUBLISHER, 'utf8')]) {
      const res = spawnSync('bash', ['-n'], { input: block, encoding: 'utf8' });
      expect(res.status, `${block}\n${res.stderr}`).toBe(0);
    }
  });
});

describe('the README reads the badges from the badges branch through jsDelivr', () => {
  const readme = read('README.md');
  const images = [...readme.matchAll(/!\[[^\]]*\]\((https:\/\/img\.shields\.io\/[^)\s]+)\)/g)].map((match) => match[1]);

  it.each(BADGES)('shows the %s badge from the badges branch', (name) => {
    expect(images).toContain(`https://img.shields.io/endpoint?url=${encodeURIComponent(jsdelivr(name))}`);
  });

  it('reads no badge from master or from a github.com address, and types no number into one', () => {
    expect(readme).not.toMatch(/docs\/badges\//);
    const endpoints = images
      .filter((url) => url.startsWith('https://img.shields.io/endpoint?'))
      .map((url) => new URL(url).searchParams.get('url'));
    expect(endpoints.length).toBeGreaterThanOrEqual(BADGES.length);
    for (const url of endpoints) expect(new URL(url).hostname.endsWith('github.com'), url).toBe(false);
    const typed = images
      .filter((url) => url.startsWith('https://img.shields.io/badge/'))
      .filter((url) => /\d/.test(decodeURIComponent(new URL(url).pathname.slice('/badge/'.length))));
    expect(typed).toEqual([]);
  });
});
