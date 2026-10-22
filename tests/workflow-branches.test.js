/**
 * master is this repository's only long-lived branch: the default branch, protected, and the base of every pull request.
 * So wherever a workflow names the branch it runs for, compares with, checks out, pushes or opens a pull request into, it
 * names master, or one of the pull request branches the workflows here open themselves (the branch input of each
 * create-pull-request step: the weekly bump's, the index publish's, the changelog's and the AI block enhancement's), which
 * landing-follows-the-bump-checks.yml follows. It names no other branch.
 *
 * A workflow that names a branch the repository does not have fails without a sign. GitHub matches a pull_request
 * workflow's branches filter against the branch the pull request targets and a push workflow's against the branch pushed
 * ("Events that trigger workflows",
 * https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), so no event starts
 * it, and no failed run shows. Trusted Weavers, AI-Powered PR Enhancement and Async Content Processing ran only for pull
 * requests into or pushes to a branch named main, and Build Codex Search Index only on a push to it; this repository has
 * no main branch, so no event started them.
 *
 * These tests read every workflow: each event's branch filters, actions/checkout's ref and create-pull-request's base
 * when they are written out, the names after refs/heads/ and origin/, the branch a git command fetches, pulls, pushes,
 * lists or checks out, gh's --base, a ref compared with a quoted name, and a base given as a quoted name in a script.
 * Comment lines are prose, so they are not read.
 *
 * Run: npx vitest run tests/workflow-branches.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const WORKFLOWS = path.join(__dirname, '..', '.github', 'workflows');
const files = fs.readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name)).sort();
const read = (name) => fs.readFileSync(path.join(WORKFLOWS, name), 'utf8');

const MASTER = 'master';

const stepsOf = (workflow) => Object.values(workflow?.jobs ?? {}).flatMap((job) => job?.steps ?? []);
const usesAction = (step, action) => String(step?.uses ?? '').startsWith(`${action}@`);

// The pull request branches the workflows here open: the branch input of each create-pull-request step.
const PULL_REQUEST_BRANCHES = [
  ...new Set(
    files.flatMap((name) =>
      stepsOf(yaml.load(read(name)))
        .filter((step) => usesAction(step, 'peter-evans/create-pull-request') && step.with?.branch)
        .map((step) => String(step.with.branch))
    )
  ),
].sort();
const BRANCHES = new Set([MASTER, ...PULL_REQUEST_BRANCHES]);

// Where the parsed workflow names a branch: each event's branches and branches-ignore filters, and actions/checkout's ref
// and create-pull-request's base. A ${{ }} expression there names the branches quoted inside it ('master' in
// `github.event.pull_request.head.sha || 'master'`), and none when it quotes none.
const quotedIn = (expression) => [...expression.matchAll(/'([^']*)'/g)].map((match) => match[1]);
const written = (value) => (/^\s*\$\{\{/.test(String(value)) ? quotedIn(String(value)) : [String(value)]);

const branchesInYaml = (workflow) => {
  const named = [];
  const on = workflow?.on && typeof workflow.on === 'object' && !Array.isArray(workflow.on) ? workflow.on : {};
  for (const [event, config] of Object.entries(on)) {
    for (const key of ['branches', 'branches-ignore']) {
      for (const branch of config?.[key] ?? []) named.push({ where: `on.${event}.${key}`, branch: String(branch) });
    }
  }
  for (const step of stepsOf(workflow)) {
    if (usesAction(step, 'actions/checkout') && step.with?.ref !== undefined) {
      for (const branch of written(step.with.ref)) named.push({ where: 'actions/checkout ref', branch });
    }
    if (usesAction(step, 'peter-evans/create-pull-request') && step.with?.base !== undefined) {
      for (const branch of written(step.with.base)) named.push({ where: 'create-pull-request base', branch });
    }
  }
  return named;
};

// A branch name as git spells it. It starts with neither a dash, a quote nor a $, so an option, a quoted shell value and
// a shell variable are not read as one; git refuses ".." in a name and a name that ends in "." or "/", so the name ends
// before them (origin/master...HEAD names master).
const NAME = '[A-Za-z0-9_][A-Za-z0-9._/-]*';
const TEXT = [
  ['refs/heads/', new RegExp(`refs/heads/(${NAME})`, 'g')],
  ['origin/', new RegExp(`\\borigin/(${NAME})`, 'g')],
  ['git on origin', new RegExp(`\\bgit\\s+(?:fetch|pull|push|ls-remote)\\b[^\\n]*?\\sorigin\\s+(${NAME})`, 'g')],
  ['git checkout', new RegExp(`\\bgit\\s+(?:checkout|switch)\\s+(?:-[bBc]\\s+)?(${NAME})`, 'g')],
  ['--base', new RegExp(`--base[=\\s]+(${NAME})`, 'g')],
  [
    'a compared ref',
    new RegExp(`\\b(?:ref|ref_name|base_ref|head_ref|head_branch)\\s*[!=]==?\\s*['"\`](?!refs/)(${NAME})['"\`]`, 'g'),
  ],
  ['a base in a script', new RegExp(`\\bbase\\s*[:=]\\s*['"\`](${NAME})['"\`]`, 'gi')],
];
const trimmed = (name) => name.split('..')[0].replace(/[./]+$/, '');

// Comment lines are prose: a line whose first character is # (YAML and shell) or // (a github-script body).
const code = (text) =>
  text
    .split('\n')
    .filter((line) => !/^\s*(#|\/\/)/.test(line))
    .join('\n');

const branchesInText = (text) =>
  TEXT.flatMap(([where, pattern]) =>
    [...code(text).matchAll(pattern)].map((match) => ({ where, branch: trimmed(match[1]) }))
  );

const branchesNamed = (text) => [...branchesInYaml(yaml.load(text)), ...branchesInText(text)];
const strays = (text) => branchesNamed(text).filter(({ branch }) => !BRANCHES.has(branch));

describe('every workflow names master, or a pull request branch a workflow here opens, and no other branch', () => {
  it('reads the pull request branches the workflows open from their create-pull-request steps', () => {
    expect(PULL_REQUEST_BRANCHES).toEqual(['chore/bump-framers-deps', 'ci/ai-enhance-blocks', 'ci/changelog', 'ci/codex-index']);
  });

  it.each(files)('%s names no other branch', (name) => {
    expect(strays(read(name))).toEqual([]);
  });

  it('starts a pull_request or pull_request_target workflow only for pull requests into master', () => {
    for (const name of files) {
      const on = yaml.load(read(name)).on;
      for (const event of ['pull_request', 'pull_request_target']) {
        const filter = on?.[event]?.branches;
        if (filter !== undefined) expect(filter, `${name}: on.${event}.branches`).toEqual([MASTER]);
        expect(on?.[event]?.['branches-ignore'], `${name}: on.${event}.branches-ignore`).toBeUndefined();
      }
    }
  });

  it('follows the checks of exactly the pull request branches the workflows open', () => {
    const named = branchesNamed(read('landing-follows-the-bump-checks.yml'));
    const followed = named.filter(({ where }) => where === 'on.workflow_run.branches').map(({ branch }) => branch);
    expect([...followed].sort()).toEqual(PULL_REQUEST_BRANCHES);
    const compared = named.filter(({ where }) => where === 'a compared ref').map(({ branch }) => branch);
    expect([...compared].sort()).toEqual(PULL_REQUEST_BRANCHES);
  });

  it('reads master where the workflows write it', () => {
    expect(branchesNamed(read('test.yml'))).toEqual(
      expect.arrayContaining([
        { where: 'on.push.branches', branch: MASTER },
        { where: 'on.pull_request.branches', branch: MASTER },
        { where: 'refs/heads/', branch: MASTER },
      ])
    );
    expect(branchesNamed(read('auto-categorize-inbox.yml'))).toEqual(
      expect.arrayContaining([
        { where: 'on.push.branches', branch: MASTER },
        { where: 'git on origin', branch: MASTER },
        { where: 'git checkout', branch: MASTER },
        { where: '--base', branch: MASTER },
      ])
    );
    expect(branchesNamed(read('changelog.yml'))).toEqual(
      expect.arrayContaining([
        { where: 'actions/checkout ref', branch: MASTER },
        { where: 'create-pull-request base', branch: MASTER },
        { where: 'git on origin', branch: 'ci/changelog' },
      ])
    );
    expect(branchesNamed(read('ai-enhance-blocks.yml'))).toContainEqual({ where: 'actions/checkout ref', branch: MASTER });
    expect(branchesNamed(read('landing-follows-the-bump-checks.yml'))).toContainEqual({
      where: 'a base in a script',
      branch: MASTER,
    });
  });

  // The places the workflows that ran only for main named it, and the index branch Build Codex Search Index pushed.
  it('finds a branch the repository does not have wherever a workflow names one', () => {
    const missing = [
      'on:',
      '  pull_request:',
      '    types: [opened, synchronize]',
      '    branches: [main]',
      '  push:',
      '    branches: [main, master]',
      'jobs:',
      '  validate:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v5',
      '        with:',
      "          ref: ${{ github.event.pull_request.head.sha || 'main' }}",
      '      - run: |',
      '          # git fetch origin trunk, a comment, names nothing',
      '          git fetch origin main',
      '          CHANGED_FILES=$(git diff --name-only origin/main...HEAD)',
      '  publish:',
      "    if: github.ref == 'refs/heads/main' && github.event_name == 'push'",
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - run: |',
      '          git checkout -B index',
      '          git push origin index --force',
      '          gh pr create --base main --fill',
      '      - uses: actions/github-script@v9',
      '        with:',
      '          script: |',
      "            if (context.payload.pull_request.base.ref !== 'main') return;",
      "            await github.rest.pulls.create({ owner: 'o', repo: 'r', head: 'x', base: 'main' });",
    ].join('\n');
    expect(strays(missing)).toEqual([
      { where: 'on.pull_request.branches', branch: 'main' },
      { where: 'on.push.branches', branch: 'main' },
      { where: 'actions/checkout ref', branch: 'main' },
      { where: 'refs/heads/', branch: 'main' },
      { where: 'origin/', branch: 'main' },
      { where: 'git on origin', branch: 'main' },
      { where: 'git on origin', branch: 'index' },
      { where: 'git checkout', branch: 'index' },
      { where: '--base', branch: 'main' },
      { where: 'a compared ref', branch: 'main' },
      { where: 'a base in a script', branch: 'main' },
    ]);
  });
});
