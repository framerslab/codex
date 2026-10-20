/**
 * The weekly bump opens its pull request with FRAMERS_BUMP_TOKEN, a personal token held as a framerslab organization
 * secret, so the pull request's own events start Test Suite and rename-guard. GitHub starts no ordinary workflow run
 * for an event made with the repository's GITHUB_TOKEN: a pull request a workflow opens with it gets its pull_request
 * runs in an approval-required state, with no job until someone with write access approves them, while one opened with
 * a personal token runs its workflows as any pull request does ("Triggering a workflow from a workflow",
 * https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).
 *
 * The bump starts only on its Monday schedule or by hand, so GitHub reports a broken file only then. These tests parse
 * it, run its first step's shell with the secret empty and set, and read the token, the permissions, the checkout, the
 * lockfile refresh and the action pins.
 *
 * Run: npx vitest run tests/bump-framers-deps.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync, spawnSync } = require('child_process');

const BUMP = '.github/workflows/bump-framers-deps.yml';
const text = fs.readFileSync(path.join(__dirname, '..', BUMP), 'utf8');
const workflow = yaml.load(text);
const steps = workflow.jobs.bump.steps;
const stepUsing = (action) => steps.find((step) => String(step.uses).startsWith(`${action}@`));

describe('the bump opens its pull request with FRAMERS_BUMP_TOKEN, so the pull request gets its checks', () => {
  it('is valid YAML whose every run block passes bash -n', () => {
    const blocks = steps.filter((step) => step.run).map((step) => step.run.replace(/\$\{\{[^}]*\}\}/g, 'X'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(() => execFileSync('bash', ['-n'], { input: block, stdio: ['pipe', 'pipe', 'pipe'] })).not.toThrow();
    }
  });

  it('pushes the branch and opens the pull request into master with the token, labelled landing', () => {
    const create = stepUsing('peter-evans/create-pull-request');
    expect(create.with.token).toBe('${{ secrets.FRAMERS_BUMP_TOKEN }}');
    // branch-token defaults to token, so the branch is pushed with the same token.
    expect(create.with).not.toHaveProperty('branch-token');
    expect(create.with.base).toBe('master');
    expect(String(create.with.labels).split(/[\s,]+/)).toContain('landing');
  });

  it("keeps the job's own GITHUB_TOKEN read-only, so nothing can open a pull request with it", () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs.bump).not.toHaveProperty('permissions');
  });

  it('stops at its first step, with an error annotation, when the secret is empty', () => {
    const [first] = steps;
    expect(first.env).toEqual({ FRAMERS_BUMP_TOKEN: '${{ secrets.FRAMERS_BUMP_TOKEN }}' });
    // The runner runs a step's script with bash -e.
    const check = (value) =>
      spawnSync('bash', ['-e', '-c', first.run], {
        env: { PATH: process.env.PATH, FRAMERS_BUMP_TOKEN: value },
        encoding: 'utf8',
      });
    const missing = check('');
    expect(missing.status).toBe(1);
    expect(missing.stdout).toMatch(/^::error::FRAMERS_BUMP_TOKEN /m);
    expect(check('a-token').status).toBe(0);
  });

  it('checks out master, whichever branch a manual run names', () => {
    expect(stepUsing('actions/checkout').with.ref).toBe('master');
  });

  it('refreshes the lockfile with no install script', () => {
    const installs = steps
      .flatMap((step) => String(step.run ?? '').split('\n'))
      .filter((line) => /\bpnpm\s+(install|i|add)\b/.test(line));
    expect(installs.length).toBeGreaterThan(0);
    for (const line of installs) expect(line).toMatch(/\s--ignore-scripts\b/);
  });

  it('pins every third-party action to a full commit, with the release it carries beside it', () => {
    const uses = text
      .split('\n')
      .map((line) => line.match(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/))
      .filter(Boolean)
      .map(([, ref, rest]) => ({ ref, rest }));
    expect(uses.length).toBe(steps.filter((step) => step.uses).length);
    const thirdParty = uses.filter(({ ref }) => !ref.startsWith('actions/'));
    expect(thirdParty.map(({ ref }) => ref.split('@')[0])).toContain('peter-evans/create-pull-request');
    for (const { ref, rest } of thirdParty) {
      expect(ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(rest).toMatch(/^\s+# v\d+\.\d+\.\d+$/);
    }
  });
});
