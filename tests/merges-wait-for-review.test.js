/**
 * Pull requests land only after their reviews and comments are read, answered and resolved, so nothing in this
 * repository merges a pull request by itself or arms GitHub's auto-merge. The flows that would otherwise merge (inbox
 * categorization at 70 percent confidence or more, a trusted Weaver's validated pull request, the re-catalog script
 * when landing is requested) keep their guards, label the pull request `landing` and post one comment; a maintainer
 * lands it after the comment pass.
 *
 * Run: npx vitest run tests/merges-wait-for-review.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const listFiles = (dir, extensions) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((name) => extensions.some((ext) => name.endsWith(ext)))
    .map((name) => `${dir}/${name}`);
};

// Comment lines (YAML, shell, Python, JavaScript) may describe the rule; only code lines are checked.
const codeLines = (text) =>
  text
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => !/^\s*(#|\/\/)/.test(line));
const code = (rel) => codeLines(read(rel)).map(({ line }) => line).join('\n');

const files = [
  ...listFiles('.github/workflows', ['.yml', '.yaml']),
  ...listFiles('.github/scripts', ['.py', '.sh', '.js', '.mjs']),
  ...listFiles('scripts', ['.sh', '.js', '.mjs']),
];

const MERGE_CALLS = [
  ['gh pr merge', /\bgh\s+pr\s+merge\b/],
  ['the REST merge endpoint', /\/pulls\/[^\s'"]+\/merge\b/],
  ['Octokit pulls.merge', /\bpulls\.merge\s*\(/],
  ['the GraphQL auto-merge mutation', /enablePullRequestAutoMerge/],
  ['a merge action', /automerge-action|enable-pull-request-automerge|merge-pull-request-action/i],
];

describe('nothing merges a pull request by itself', () => {
  it('scans every workflow and script', () => {
    expect(files).toContain('.github/workflows/auto-categorize-inbox.yml');
    expect(files).toContain('.github/workflows/auto-merge-weavers.yml');
    expect(files).toContain('scripts/retrigger-full-catalog.sh');
  });

  it.each(MERGE_CALLS)('no workflow or script calls %s', (_name, pattern) => {
    const hits = files.flatMap((rel) =>
      codeLines(read(rel))
        .filter(({ line }) => pattern.test(line))
        .map(({ line, number }) => `${rel}:${number}: ${line.trim()}`)
    );
    expect(hits).toEqual([]);
  });
});

describe('the flows that would merge keep their guards, label the pull request landing and comment', () => {
  const LANDING_LABEL = /labels(\[\]=|['"]?\s*:\s*\[\s*['"])landing/;
  const COMMENT = /\/comments\b|createComment\(/;

  it.each([
    ['.github/workflows/auto-categorize-inbox.yml', [/"\$confidence_pct" -ge 70/, /"\$action" == "auto-move"/]],
    [
      '.github/workflows/auto-merge-weavers.yml',
      [/\.github\/WEAVERS\.txt/, /needs\.check-weaver-status\.outputs\.is_weaver == 'true'/, /needs\.validate-content\.result == 'success'/],
    ],
    ['scripts/retrigger-full-catalog.sh', [/"\$AUTO_LAND" = "true"/, /npm run index -- --validate/]],
  ])('%s', (rel, guards) => {
    const text = code(rel);
    for (const guard of guards) expect(text).toMatch(guard);
    expect(text).toMatch(LANDING_LABEL);
    expect(text).toMatch(COMMENT);
  });
});
