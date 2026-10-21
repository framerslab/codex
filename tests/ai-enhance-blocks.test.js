/**
 * The AI-enhanced block tags reach master through a pull request, and reach a labelled pull request with its checks.
 *
 * ai-enhance-blocks.yml runs scripts/ai-enhance-blocks.js, which calls a paid model, by hand on master or when a pull
 * request from this repository's own branch is labelled ai-enhance. A manual run used to commit to master and push, which
 * master's protection refuses, and a labelled run pushed a [skip ci] commit to the pull request with GITHUB_TOKEN. GitHub
 * starts no workflow for a push made with GITHUB_TOKEN, and none of the pull_request workflows of a head commit whose
 * message says [skip ci], so that head's required checks never reported and the pull request could not merge until
 * another push ("Triggering a workflow from a workflow",
 * https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow;
 * "Skipping workflow runs", https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).
 *
 * Now the enhance job runs the enhancement with a read-only token and archives the strands it changed as a patch. A
 * manual run's second job opens or updates one pull request into master from ci/ai-enhance-blocks with
 * FRAMERS_BUMP_TOKEN, as the index publish does (tests/index-pull-request.test.js); a labelled run's second job commits
 * the patch onto the pull request's branch and pushes it with FRAMERS_BUMP_TOKEN, with no skip marker, so Test Suite and
 * rename-guard run on the new head. The two jobs that hold the token run none of the repository's code.
 *
 * The workflow calls a paid model, so it is not run here: these tests read it, and run its argument handling with a
 * stand-in node, and its archive and push steps in scratch repositories.
 *
 * Run: npx vitest run tests/ai-enhance-blocks.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync, spawnSync } = require('child_process');

const FLOW = '.github/workflows/ai-enhance-blocks.yml';
const BUMP = '.github/workflows/bump-framers-deps.yml';
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const text = read(FLOW);
const workflow = yaml.load(text);
const jobs = workflow.jobs ?? {};
const ENHANCE = 'enhance';
const OPEN = 'open-pull-request';
const PUSH = 'push-to-the-pull-request';
const stepsOf = (id) => jobs[id]?.steps ?? [];
const allSteps = () => Object.values(jobs).flatMap((job) => job.steps ?? []);
const stepUsing = (list, action) => list.find((step) => String(step.uses).startsWith(`${action}@`));
const byId = (id, stepId) => stepsOf(id).find((step) => step.id === stepId);
const create = () => stepUsing(stepsOf(OPEN), 'peter-evans/create-pull-request');
const listed = (value) =>
  String(value ?? '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
const SKIP_MARKERS = [/\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i, /skip-checks:\s*true/i];
// A job holds the personal token when its file text names the secret.
const holdsToken = (id) => yaml.dump(jobs[id] ?? {}).includes('secrets.FRAMERS_BUMP_TOKEN');

describe('a manual run opens a pull request into master, and a labelled run pushes to its pull request with checks', () => {
  it('is valid YAML whose every run block passes bash -n', () => {
    const blocks = allSteps()
      .filter((step) => step.run)
      .map((step) => step.run.replace(/\$\{\{[^}]*\}\}/g, 'X'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(() => execFileSync('bash', ['-n'], { input: block, stdio: ['pipe', 'pipe', 'pipe'] })).not.toThrow();
    }
  });

  it("keeps every job's GITHUB_TOKEN read-only, so nothing pushes or opens a pull request with it", () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    for (const [id, job] of Object.entries(jobs)) expect(job.permissions, id).toBeUndefined();
  });

  it('runs the enhancement only by hand or for the ai-enhance label on a pull request from this repository', () => {
    expect(Object.keys(jobs).sort()).toEqual([ENHANCE, OPEN, PUSH].sort());
    const condition = String(jobs[ENHANCE].if);
    expect(condition).toContain("github.event_name == 'workflow_dispatch'");
    expect(condition).toContain("github.event.label.name == 'ai-enhance'");
    // A fork's pull request gets no secrets, and its branch is not this repository's to push to.
    expect(condition).toContain('github.event.pull_request.head.repo.full_name == github.repository');
  });

  it('enhances master on a manual run and the pull request head on a label, and keeps no token in that checkout', () => {
    const checkout = stepUsing(stepsOf(ENHANCE), 'actions/checkout');
    expect(checkout.with.ref).toBe("${{ github.event.pull_request.head.sha || 'master' }}");
    expect(checkout.with['persist-credentials']).toBe(false);
    expect(jobs[ENHANCE].outputs.commit).toBe('${{ steps.commit.outputs.sha }}');
    expect(jobs[ENHANCE].outputs.changed).toBe('${{ steps.changes.outputs.changed }}');
  });

  // FRAMERS_BUMP_TOKEN reaches past this repository, and a step can change what a later step of its job runs.
  it('runs the repository code in a job without the personal token, and runs none in the jobs that hold it', () => {
    expect(holdsToken(ENHANCE)).toBe(false);
    for (const id of [OPEN, PUSH]) {
      expect(holdsToken(id), id).toBe(true);
      const steps = stepsOf(id);
      for (const action of ['actions/setup-node', 'pnpm/action-setup', 'actions/setup-python', 'actions/cache']) {
        expect(stepUsing(steps, action), `${id} uses ${action}`).toBeUndefined();
      }
      const lines = steps.flatMap((step) => String(step.run ?? '').split('\n'));
      for (const line of lines) expect(line, id).not.toMatch(/\b(node|npm|npx|pnpm|yarn|python3?)\b|\bscripts\/|\.\//);
    }
  });

  it.each([OPEN, PUSH])('%s stops at its first step, with an error annotation, when the secret is empty', (id) => {
    const [first] = stepsOf(id);
    expect(first.env).toEqual({ FRAMERS_BUMP_TOKEN: '${{ secrets.FRAMERS_BUMP_TOKEN }}' });
    // The runner runs a step's script with bash -e.
    const check = (value) =>
      spawnSync('bash', ['-e', '-c', first.run], { env: { PATH: process.env.PATH, FRAMERS_BUMP_TOKEN: value }, encoding: 'utf8' });
    const missing = check('');
    expect(missing.status).toBe(1);
    expect(missing.stdout).toMatch(/^::error::FRAMERS_BUMP_TOKEN /m);
    expect(check('a-token').status).toBe(0);
  });

  it('hands the token jobs the commit it enhanced and the patch it archived', () => {
    const upload = stepUsing(stepsOf(ENHANCE), 'actions/upload-artifact');
    expect(upload.if).toBe("steps.changes.outputs.changed == 'true'");
    for (const id of [OPEN, PUSH]) {
      expect(jobs[id].needs).toBe(ENHANCE);
      expect(String(jobs[id].if)).toContain("needs.enhance.outputs.changed == 'true'");
      expect(stepUsing(stepsOf(id), 'actions/checkout').with.ref).toBe('${{ needs.enhance.outputs.commit }}');
      expect(stepUsing(stepsOf(id), 'actions/download-artifact').with.name).toBe(upload.with.name);
    }
  });

  it('opens or updates one pull request into master from ci/ai-enhance-blocks with FRAMERS_BUMP_TOKEN on a manual run', () => {
    expect(String(jobs[OPEN].if)).toContain("github.event_name == 'workflow_dispatch'");
    const step = create();
    expect(step, 'a create-pull-request step in the manual run job').toBeDefined();
    expect(step.with.token).toBe('${{ secrets.FRAMERS_BUMP_TOKEN }}');
    // branch-token defaults to token, so the branch is pushed with the same token.
    expect(step.with).not.toHaveProperty('branch-token');
    expect(step.with.base).toBe('master');
    expect(step.with.branch).toBe('ci/ai-enhance-blocks');
    expect(step.with['delete-branch']).toBe(true);
    // The label waits for the pull request's own checks: landing-follows-the-bump-checks.yml adds it once they pass.
    expect(step.with).not.toHaveProperty('labels');
    // The strands alone: auto-index.yml builds the index from master once they land and brings it in its own pull request.
    expect(listed(step.with['add-paths'])).toEqual(['weaves']);
  });

  it('pins create-pull-request to the commit the weekly bump pins, with the release it carries beside it', () => {
    const bump = yaml.load(read(BUMP));
    const uses = create()?.uses;
    expect(uses).toBe(stepUsing(bump.jobs.bump.steps, 'peter-evans/create-pull-request').uses);
    expect(uses).toMatch(/^peter-evans\/create-pull-request@[0-9a-f]{40}$/);
    const line = text.split('\n').find((each) => each.includes(`uses: ${uses}`));
    expect(line).toMatch(/\s# v\d+\.\d+\.\d+$/);
  });

  it('opens the pull request one run at a time, and never cancels one that started', () => {
    expect(jobs[OPEN].concurrency?.group).toBeTruthy();
    expect(jobs[OPEN].concurrency?.['cancel-in-progress']).toBe(false);
  });

  it("pushes only to a labelled pull request's own branch, with the personal token in that job's checkout", () => {
    const pushing = Object.entries(jobs).filter(([, job]) =>
      (job.steps ?? []).some((step) => /\bgit\s+push\b/.test(String(step.run ?? '')))
    );
    expect(pushing.map(([id]) => id)).toEqual([PUSH]);
    expect(String(jobs[PUSH].if)).toContain("github.event_name == 'pull_request'");
    const step = byId(PUSH, 'push');
    expect(step.env.HEAD_REF).toBe('${{ github.event.pull_request.head.ref }}');
    expect(step.run).toMatch(/git push origin "HEAD:refs\/heads\/\$HEAD_REF"/);
    expect(step.run).not.toMatch(/--force|\s-f\s|\+HEAD/);
    expect(step.run).not.toContain('${{');
    expect(stepUsing(stepsOf(PUSH), 'actions/checkout').with.token).toBe('${{ secrets.FRAMERS_BUMP_TOKEN }}');
  });

  // GitHub skips the push and pull_request workflows of a commit whose message carries one of these.
  it('commits with messages that skip no workflow, so the new head gets its required checks', () => {
    const inputs = create()?.with ?? {};
    const messages = [inputs['commit-message'], inputs.title, byId(PUSH, 'push')?.run];
    for (const message of messages) {
      expect(message).toBeTruthy();
      for (const marker of SKIP_MARKERS) expect(message).not.toMatch(marker);
    }
    const commits = allSteps().filter((step) => /\bgit\b.*\bcommit\b/.test(String(step.run ?? '')));
    expect(commits.map((step) => step.id)).toEqual(['push']);
  });
});

// The runner runs a step's script with bash -e, in the job's checkout.
const runStep = (step, { cwd, env }) => {
  const res = spawnSync('bash', ['-e', '-c', step.run], {
    cwd,
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', ...env },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
};

describe("the enhance job's inputs, and the patch it hands to the job that pushes", () => {
  it("passes the run's inputs to the script as arguments, never as shell text", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-enhance-args-'));
    try {
      const bin = path.join(dir, 'bin');
      const args = path.join(dir, 'args');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'node'), `#!/bin/sh\nfor arg in "$@"; do printf '%s\\n' "$arg"; done > '${args}'\n`, {
        mode: 0o755,
      });
      const step = stepsOf(ENHANCE).find((each) => String(each.run ?? '').includes('scripts/ai-enhance-blocks.js'));
      expect(step.run).not.toContain('${{');
      const { status, stdout, stderr } = runStep(step, {
        cwd: dir,
        env: {
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          PROVIDER: 'anthropic',
          MAX_COST: '1.50',
          MODEL: 'a model; touch pwned',
          DRY_RUN: 'true',
        },
      });
      expect(status, stdout + stderr).toBe(0);
      expect(fs.readFileSync(args, 'utf8').split('\n').filter(Boolean)).toEqual([
        'scripts/ai-enhance-blocks.js',
        '--all',
        '--provider',
        'anthropic',
        '--max-cost',
        '1.50',
        '--model',
        'a model; touch pwned',
        '--dry-run',
      ]);
      expect(fs.existsSync(path.join(dir, 'pwned'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // origin holds the pull request's branch at the commit the enhance job checked out. The enhance job's checkout changes
  // a strand, adds one, and rebuilds the index; the push job's checkout holds the same commit, detached, as
  // actions/checkout leaves it for a commit.
  const withPullRequest = (body) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-enhance-push-'));
    const git = (cwd, ...args) => {
      const res = spawnSync(
        'git',
        ['-c', 'user.name=weaver', '-c', 'user.email=weaver@example.invalid', '-c', 'commit.gpgsign=false', ...args],
        { cwd, encoding: 'utf8' }
      );
      if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
      return res.stdout.trim();
    };
    const put = (dir, file, content) => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    };
    try {
      const origin = path.join(root, 'origin.git');
      const work = path.join(root, 'work');
      git(root, 'init', '--quiet', '--bare', origin);
      fs.mkdirSync(work);
      git(work, 'init', '--quiet');
      git(work, 'symbolic-ref', 'HEAD', 'refs/heads/feature/strands');
      git(work, 'remote', 'add', 'origin', `file://${origin}`);
      put(work, 'weaves/frame/strand.md', '---\ntags: [one]\n---\nA strand.\n');
      put(work, 'codex-index.json', '[]\n');
      git(work, 'add', '--all');
      git(work, 'commit', '--quiet', '-m', 'a strand');
      git(work, 'push', '--quiet', 'origin', 'feature/strands');
      const head = git(work, 'rev-parse', 'HEAD');
      const clone = (name) => {
        git(root, 'clone', '--quiet', '--branch', 'feature/strands', `file://${origin}`, name);
        git(path.join(root, name), 'checkout', '--quiet', '--detach', head);
        return path.join(root, name);
      };
      const temp = path.join(root, 'runner-temp');
      fs.mkdirSync(temp);
      return body({ root, git, put, work, head, clone, temp, origin });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  const archive = ({ dir, temp, root }) => {
    const output = path.join(root, 'output');
    fs.writeFileSync(output, '');
    const res = runStep(byId(ENHANCE, 'changes'), { cwd: dir, env: { HOME: root, RUNNER_TEMP: temp, GITHUB_OUTPUT: output } });
    return { ...res, output: fs.readFileSync(output, 'utf8') };
  };
  // The step's own literal environment (the commit's author and committer) as the runner sets it, and the values its
  // expressions take on a labelled run.
  const push = ({ dir, temp, root }) => {
    const step = byId(PUSH, 'push');
    const literal = Object.entries(step.env ?? {}).filter(([, value]) => !String(value).includes('${{'));
    return runStep(step, {
      cwd: dir,
      env: {
        ...Object.fromEntries(literal),
        HOME: root,
        RUNNER_TEMP: temp,
        HEAD_REF: 'feature/strands',
        PROVIDER: 'openai',
        MAX_COST: '5.00',
      },
    });
  };

  it('archives the strands it changed, and leaves the index to its own pull request', () => {
    withPullRequest(({ root, put, clone, temp }) => {
      const enhanced = clone('enhance');
      put(enhanced, 'weaves/frame/strand.md', '---\ntags: [one, two]\n---\nA strand.\n');
      put(enhanced, 'weaves/frame/new-strand.md', 'Another strand.\n');
      put(enhanced, 'codex-index.json', '[1]\n');
      const { status, stdout, stderr, output } = archive({ dir: enhanced, temp, root });
      expect(status, stdout + stderr).toBe(0);
      expect(output).toBe('changed=true\n');
      const patch = path.join(temp, 'ai-enhance', 'blocks.patch');
      const files = execFileSync('git', ['apply', '--numstat', patch], { cwd: enhanced, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')[2])
        .sort();
      expect(files).toEqual(['weaves/frame/new-strand.md', 'weaves/frame/strand.md']);
    });
  });

  it('archives nothing when no strand changed', () => {
    withPullRequest(({ root, put, clone, temp }) => {
      const enhanced = clone('enhance');
      put(enhanced, 'codex-index.json', '[1]\n');
      const { status, stdout, stderr, output } = archive({ dir: enhanced, temp, root });
      expect(status, stdout + stderr).toBe(0);
      expect(output).toBe('changed=false\n');
      expect(fs.existsSync(path.join(temp, 'ai-enhance', 'blocks.patch'))).toBe(false);
    });
  });

  it("commits the patch onto the pull request's branch as one new head, with a message that skips no workflow", () => {
    withPullRequest(({ root, git, put, clone, temp, head, origin }) => {
      const enhanced = clone('enhance');
      put(enhanced, 'weaves/frame/strand.md', '---\ntags: [one, two]\n---\nA strand.\n');
      expect(archive({ dir: enhanced, temp, root }).output).toBe('changed=true\n');
      const pushed = push({ dir: clone('publish'), temp, root });
      expect(pushed.status, pushed.stdout + pushed.stderr).toBe(0);
      const tip = git(origin, 'rev-parse', 'refs/heads/feature/strands');
      expect(tip).not.toBe(head);
      expect(git(origin, 'rev-parse', `${tip}^`)).toBe(head);
      const message = git(origin, 'log', '-1', '--format=%B', tip);
      expect(message.split('\n')[0]).toBe('feat(blocks): AI-enhanced block tags');
      for (const marker of SKIP_MARKERS) expect(message).not.toMatch(marker);
      expect(git(origin, 'log', '-1', '--format=%an <%ae>', tip)).toBe('github-actions[bot] <github-actions[bot]@users.noreply.github.com>');
      expect(git(origin, 'show', '--name-only', '--format=', tip).split('\n').filter(Boolean)).toEqual(['weaves/frame/strand.md']);
      expect(git(origin, 'show', `${tip}:weaves/frame/strand.md`)).toContain('tags: [one, two]');
    });
  });

  it('refuses to push when the branch moved after the enhancement ran, and leaves the branch where it is', () => {
    withPullRequest(({ root, git, put, work, clone, temp, origin }) => {
      const enhanced = clone('enhance');
      put(enhanced, 'weaves/frame/strand.md', '---\ntags: [one, two]\n---\nA strand.\n');
      expect(archive({ dir: enhanced, temp, root }).output).toBe('changed=true\n');
      put(work, 'weaves/frame/other.md', 'Pushed meanwhile.\n');
      git(work, 'add', '--all');
      git(work, 'commit', '--quiet', '-m', 'pushed meanwhile');
      git(work, 'push', '--quiet', 'origin', 'feature/strands');
      const moved = git(work, 'rev-parse', 'HEAD');
      const pushed = push({ dir: clone('publish'), temp, root });
      expect(pushed.status).not.toBe(0);
      expect(git(origin, 'rev-parse', 'refs/heads/feature/strands')).toBe(moved);
    });
  });
});
