/**
 * The JavaScript actions the workflows use run on Node.js 24.
 *
 * GitHub's runners run an action written for Node.js 20 on Node.js 24, with a warning on every run: "Node.js 20 is
 * deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24"
 * (https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/). Three actions here
 * targeted Node.js 20: actions/github-script v7 (the two landing workflows, Trusted Weavers, async processing and the pull
 * request enhancement), peter-evans/create-pull-request v7.0.11 (the weekly bump and the index publish) and
 * peter-evans/repository-dispatch v3 (async processing). Each now runs the release whose action.yml says runs.using:
 * node24, pinned to that release's commit with the release named beside it, as the bump pins its actions: a tag can
 * move, a commit cannot. Each commit below was read from GitHub, from git/ref/tags/<release> and, where the tag is
 * annotated, from the tag object to its commit, together with the action.yml at that commit.
 *
 * github-script v9 runs a script as the body of an async function whose parameters are require, __original_require__,
 * github, octokit, getOctokit, context, core, exec, glob and io (src/main.ts at the pinned commit), so a script that
 * declares one of them with const or let no longer compiles, and require('@actions/github') fails, since that package is
 * ESM only from v9 (https://github.com/actions/github-script/releases/tag/v9.0.0). create-pull-request v8 and
 * repository-dispatch v4 change only the runner they need, v2.327.1 or later, which GitHub's hosted runners are
 * (https://github.com/peter-evans/create-pull-request/releases/tag/v8.0.0,
 * https://github.com/peter-evans/repository-dispatch/releases/tag/v4.0.0).
 *
 * Run: npx vitest run tests/actions-on-node24.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const WORKFLOWS = path.join(__dirname, '..', '.github', 'workflows');
const files = fs.readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name)).sort();
const read = (name) => fs.readFileSync(path.join(WORKFLOWS, name), 'utf8');

// Each action's release whose action.yml runs on Node.js 24, and that release's commit.
const RELEASES = {
  'actions/github-script': { release: 'v9.0.0', commit: '3a2844b7e9c422d3c10d287c895573f7108da1b3' },
  'peter-evans/create-pull-request': { release: 'v8.1.1', commit: '5f6978faf089d4d20b00c7766989d076bb2fc7f1' },
  'peter-evans/repository-dispatch': { release: 'v4.0.1', commit: '28959ce8df70de7be546dd1250a005dd32156697' },
};

// Every uses line of every workflow, with its file and line number.
const usesLines = () =>
  files.flatMap((name) =>
    read(name)
      .split('\n')
      .map((line, index) => ({ where: `${name}:${index + 1}`, line: line.trim().replace(/^-\s+/, '') }))
      .filter(({ line }) => line.startsWith('uses:'))
  );

// github-script v9's parameters, in its order (src/main.ts at the pinned commit).
const PARAMETERS = ['require', '__original_require__', 'github', 'octokit', 'getOctokit', 'context', 'core', 'exec', 'glob', 'io'];
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
// Every github-script body of every workflow, with each ${{ }} expression as the runner leaves it, a value in its place.
const scripts = () =>
  files.flatMap((name) =>
    Object.entries(yaml.load(read(name)).jobs ?? {}).flatMap(([job, { steps = [] }]) =>
      steps
        .filter((step) => String(step.uses).startsWith('actions/github-script@'))
        .map((step) => ({ where: `${name}, ${job}: ${step.name ?? step.id ?? 'a step'}`, script: step.with.script.replace(/\$\{\{[^}]*\}\}/g, 'X') }))
    )
  );

describe('the JavaScript actions the workflows use run on Node.js 24', () => {
  it.each(Object.keys(RELEASES))('pins every use of %s to the commit of the release that runs on Node.js 24, named beside it', (action) => {
    const { release, commit } = RELEASES[action];
    const uses = usesLines().filter(({ line }) => line.startsWith(`uses: ${action}@`));
    expect(uses.length, `a workflow uses ${action}`).toBeGreaterThan(0);
    for (const { where, line } of uses) expect(line, where).toBe(`uses: ${action}@${commit} # ${release}`);
  });

  it('compiles every github-script body the way v9 wraps it, so none declares a name v9 passes in', () => {
    const all = scripts();
    expect(all.length).toBeGreaterThan(0);
    for (const { where, script } of all) expect(() => new AsyncFunction(...PARAMETERS, script), where).not.toThrow();
  });

  it('requires @actions/github in no github-script body, since v9 serves it to no script', () => {
    for (const { where, script } of scripts()) expect(script, where).not.toMatch(/require\(\s*['"`]@actions\/github['"`]\s*\)/);
  });
});
