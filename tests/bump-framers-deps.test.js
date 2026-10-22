/**
 * The weekly bump opens its pull request with FRAMERS_BUMP_TOKEN, a personal token held as a framerslab organization
 * secret, so the pull request's own events start Test Suite and rename-guard. GitHub starts no ordinary workflow run
 * for an event made with the repository's GITHUB_TOKEN: a pull request a workflow opens with it gets its pull_request
 * runs in an approval-required state, with no job until someone with write access approves them, while one opened with
 * a personal token runs its workflows as any pull request does ("Triggering a workflow from a workflow",
 * https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).
 *
 * The bump starts only on its Monday schedule or by hand, so GitHub reports a broken file only then. These tests parse
 * it, run its first step's shell with the secret empty and set, run its npm lockfile refresh with a stand-in npm, read
 * the token, the permissions, the checkout, the lockfile refreshes and the action pins, and make its commit in a scratch
 * repository the way the action makes it.
 *
 * The bump labels nothing. Its pull request gets the landing label from landing-follows-the-bump-checks.yml, once its
 * own Test Suite and rename-guard runs pass on its head. That workflow starts on workflow_run, which runs the file as it
 * reads on master, so GitHub runs it only after it merges; these tests run its script against a stand-in for the GitHub
 * API that holds the pull request's head, base, labels, comments and runs. The same workflow labels the index pull request
 * auto-index.yml opens from ci/codex-index (tests/index-pull-request.test.js reads that workflow), the changelog pull
 * request changelog.yml opens from ci/changelog (tests/changelog-pull-request.test.js) and the AI-enhanced blocks pull
 * request ai-enhance-blocks.yml opens from ci/ai-enhance-blocks (tests/ai-enhance-blocks.test.js); the cases at the end
 * run its script for those branches.
 *
 * Run: npx vitest run tests/bump-framers-deps.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const os = require('os');
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

  it('pushes the branch and opens the pull request into master with the token, and labels nothing itself', () => {
    const create = stepUsing('peter-evans/create-pull-request');
    expect(create.with.token).toBe('${{ secrets.FRAMERS_BUMP_TOKEN }}');
    // branch-token defaults to token, so the branch is pushed with the same token.
    expect(create.with).not.toHaveProperty('branch-token');
    expect(create.with.base).toBe('master');
    // The label waits for the pull request's own checks: landing-follows-the-bump-checks.yml adds it once they pass.
    expect(create.with).not.toHaveProperty('labels');
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

  it('refreshes the lockfiles with no install script', () => {
    // \bnpm does not match inside pnpm, so this reads every pnpm and npm install the job runs.
    const installs = steps
      .flatMap((step) => String(step.run ?? '').split('\n'))
      .filter((line) => /\b(pnpm|npm)\s+(install|i|ci|add)\b/.test(line));
    expect(installs.length).toBeGreaterThan(0);
    for (const line of installs) expect(line).toMatch(/\s--ignore-scripts\b/);
  });

  // This repository tracks package-lock.json beside pnpm-lock.yaml, and npm ci stops when package-lock.json disagrees
  // with package.json. Run 39470395461 (20 October 2026) opened pull request 9
  // with @framers/sql-storage-adapter at ^0.8.1 in package.json and package-lock.json still at ^0.6.8. The refresh step
  // runs here with a stand-in npm that records its arguments, once beside a package-lock.json and once without one.
  it('refreshes package-lock.json when the file is there, writing the lockfile only and running no install script', () => {
    const refresh = steps.find((step) => /\bnpm\s+install\b/.test(String(step.run ?? '')));
    expect(refresh, 'a step that runs npm install').toBeDefined();

    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-npm-'));
    try {
      const bin = path.join(scratch, 'bin');
      const calls = path.join(scratch, 'calls');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\necho "$*" >> '${calls}'\n`, { mode: 0o755 });
      const dir = (name, files) => {
        const where = path.join(scratch, name);
        fs.mkdirSync(where);
        for (const file of files) fs.writeFileSync(path.join(where, file), '{}\n');
        return where;
      };
      // The runner runs a step's script with bash -e.
      const run = (cwd) =>
        spawnSync('bash', ['-e', '-c', refresh.run], {
          cwd,
          env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` },
          encoding: 'utf8',
        });

      const without = run(dir('without', ['package.json']));
      expect(without.status, without.stderr).toBe(0);
      expect(fs.existsSync(calls)).toBe(false);

      const beside = run(dir('beside', ['package.json', 'package-lock.json']));
      expect(beside.status, beside.stderr).toBe(0);
      const invocations = fs.readFileSync(calls, 'utf8').trim().split('\n');
      expect(invocations).toHaveLength(1);
      const args = invocations[0].split(' ');
      expect(args[0]).toBe('install');
      // --package-lock-only writes package-lock.json from package.json and the registry and ignores node_modules, so the
      // tree the pnpm refresh installed plays no part.
      expect(args).toEqual(expect.arrayContaining(['--package-lock-only', '--ignore-scripts']));
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
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

  // The action commits the bump with `git add -- <add-paths>` and then `git commit` (src/create-or-update-branch.ts at
  // v7.0.11, unchanged at v8.1.1), and git refuses the whole add when any one pathspec matches no file: builtin/add.c
  // dies with "did not match any files" before it stages anything. git matches a plain pathspec with fnmatch(3), so the
  // slash in **/package.json has to be there, and the root manifest does not match it. Run 39396254503 (20 October 2026)
  // logged "fatal: pathspec '**/package.json' did not match any files" and stopped at "Unexpected error" with nothing
  // committed. This makes that commit in a scratch repository holding this repository's tracked files, after changing
  // every manifest the bump can change.
  it('commits every manifest it changes, so each add-paths entry matches a file here', () => {
    const create = stepUsing('peter-evans/create-pull-request');
    // The action reads the input as a list split on newlines and commas.
    const addPaths = String(create.with['add-paths'] ?? '')
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    expect(addPaths.length).toBeGreaterThan(0);

    const root = path.join(__dirname, '..');
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter((file) => file && fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile());
    // The bump's script rewrites any package.json outside node_modules, and the lockfile refreshes rewrite pnpm-lock.yaml
    // and package-lock.json.
    const manifests = tracked.filter(
      (file) => path.basename(file) === 'package.json' || file === 'pnpm-lock.yaml' || file === 'package-lock.json'
    );
    expect(manifests).toEqual(expect.arrayContaining(['package.json', 'pnpm-lock.yaml', 'package-lock.json']));

    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-commit-'));
    const git = (...args) =>
      spawnSync(
        'git',
        ['-c', 'user.name=bump', '-c', 'user.email=bump@example.invalid', '-c', 'commit.gpgsign=false', ...args],
        { cwd: scratch, encoding: 'utf8' }
      );
    try {
      for (const file of tracked) {
        fs.mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true });
        fs.copyFileSync(path.join(root, file), path.join(scratch, file));
      }
      expect(git('init', '--quiet').status).toBe(0);
      expect(git('add', '--all', '--force').status).toBe(0);
      expect(git('commit', '--quiet', '--no-verify', '-m', 'master').status).toBe(0);

      for (const file of manifests) fs.appendFileSync(path.join(scratch, file), '\n');

      // The action commits only when git status lists a change under add-paths.
      expect(git('status', '--porcelain', '-unormal', '--', ...addPaths).stdout).not.toBe('');
      const add = git('add', '--', ...addPaths);
      expect(add.status, add.stderr).toBe(0);
      const commit = git('commit', '--quiet', '--no-verify', '-m', 'chore(deps): bump @framers/* deps');
      expect(commit.status, commit.stdout + commit.stderr).toBe(0);
      const committed = git('show', '--name-only', '--format=', 'HEAD').stdout.split('\n').filter(Boolean);
      expect(committed.sort()).toEqual([...manifests].sort());
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });
});

// landing-follows-the-bump-checks.yml, run here the way actions/github-script runs a script: as the body of an async
// function, against a stand-in for the GitHub API that holds a followed pull request's head, base, labels, comments and the
// pull request runs GitHub lists for a commit. It follows the pull requests the bump, the index publish, the changelog and
// the AI block enhancement open.
const LABEL_FLOW = '.github/workflows/landing-follows-the-bump-checks.yml';
const JOB = 'follow-the-guards';
const TEST_SUITE = '.github/workflows/test.yml';
const RENAME_GUARD = '.github/workflows/rename-guard.yml';
const BRANCH = 'chore/bump-framers-deps';
const INDEX = '.github/workflows/auto-index.yml';
const INDEX_BRANCH = 'ci/codex-index';
const CHANGELOG = '.github/workflows/changelog.yml';
const CHANGELOG_BRANCH = 'ci/changelog';
const AI_BLOCKS = '.github/workflows/ai-enhance-blocks.yml';
const AI_BLOCKS_BRANCH = 'ci/ai-enhance-blocks';
const OWNER = 'framerslab';
const REPO = 'codex';
const PR = 12;
const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const MARKER = '<!-- landing-guards -->';
const ACTIONS_BOT = { type: 'Bot', login: 'github-actions[bot]' };
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const labelFlow = () => yaml.load(read(LABEL_FLOW));
const labelScript = () => {
  const step = (labelFlow().jobs[JOB]?.steps ?? []).find((s) => String(s.uses).startsWith('actions/github-script@'));
  if (!step) throw new Error(`${LABEL_FLOW}: job ${JOB} has no github-script step`);
  return step.with.script;
};
// The branch a workflow opens its pull request from, in whichever job its create-pull-request step runs.
const pullRequestBranch = (rel) => {
  const steps = Object.values(yaml.load(read(rel)).jobs ?? {}).flatMap((job) => job.steps ?? []);
  const step = steps.find((s) => String(s.uses).startsWith('peter-evans/create-pull-request@'));
  if (!step) throw new Error(`${rel} opens no pull request`);
  return step.with.branch;
};

// A pull request run of a workflow on a commit, as GitHub lists it. GitHub's REST description gives a run's path as
// path@ref (".github/workflows/build.yml@main"), so a run can carry either form.
const prRun = (
  workflowPath,
  { id, sha = NEW, status = 'completed', conclusion = 'success', from = `${OWNER}/${REPO}`, ref = null, branch = BRANCH }
) => ({
  id,
  run_number: id,
  path: ref ? `${workflowPath}@${ref}` : workflowPath,
  head_sha: sha,
  head_branch: branch,
  head_repository: { full_name: from },
  event: 'pull_request',
  status,
  conclusion: status === 'completed' ? conclusion : null,
});
const bothPassed = () => [prRun(TEST_SUITE, { id: 101 }), prRun(RENAME_GUARD, { id: 102 })];
const guardsComment = (sha) => ({ body: `${MARKER}\nGuards passed on ${sha.slice(0, 7)}:` });

// A review bot can quote the marker inside a comment of its own, which the workflow token cannot edit.
const quoting = {
  user: { type: 'Bot', login: 'qodo-free-for-open-source-projects[bot]' },
  body: `Find the bot comment that contains \`${MARKER}\` and update it.`,
};

// onAddLabels runs as the label goes on and onRemoveLabel as it comes off; each stands in for a change made meanwhile,
// such as a push, an edit of the base or a guard finishing.
const fakeGitHub = ({
  head = NEW,
  branch = BRANCH,
  base = 'master',
  open = true,
  labels = [],
  comments = [],
  runs = [],
  failCreateComment = false,
  onAddLabels = () => {},
  onRemoveLabel = () => {},
} = {}) => {
  const state = {
    head,
    base,
    labels: new Set(labels),
    comments: comments.map((comment, index) => ({ id: index + 1, user: ACTIONS_BOT, ...comment })),
  };
  const calls = [];
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const api = (name, answer) => async (params = {}) => {
    calls.push(name);
    return { data: await answer(params) };
  };
  const github = {
    paginate: async (method, params) => (await method(params)).data,
    rest: {
      pulls: {
        list: api('pulls.list', (params) =>
          open && params.state === 'open' && params.head === `${OWNER}:${branch}` && params.base === state.base
            ? [{ number: PR, head: { sha: state.head, ref: branch }, base: { ref: state.base } }]
            : []
        ),
        get: api('pulls.get', () => ({ number: PR, head: { sha: state.head }, base: { ref: state.base } })),
      },
      actions: {
        // The runs of one workflow, named by its file as the API allows.
        listWorkflowRuns: api('actions.listWorkflowRuns', (params) =>
          runs.filter(
            (r) =>
              r.path.split('@')[0] === `.github/workflows/${params.workflow_id}` &&
              r.head_sha === params.head_sha &&
              (!params.event || r.event === params.event)
          )
        ),
      },
      issues: {
        getLabel: api('issues.getLabel', ({ name }) => ({ name })),
        createLabel: api('issues.createLabel', ({ name }) => ({ name })),
        addLabels: api('issues.addLabels', ({ labels: names }) => {
          for (const name of names) state.labels.add(name);
          onAddLabels(state);
          return [...state.labels].map((name) => ({ name }));
        }),
        removeLabel: api('issues.removeLabel', ({ name }) => {
          onRemoveLabel(state);
          if (!state.labels.delete(name)) throw fail(404, 'Label does not exist');
          return [];
        }),
        listComments: api('issues.listComments', () => state.comments),
        createComment: api('issues.createComment', ({ body }) => {
          if (failCreateComment) throw fail(500, 'Server Error');
          const comment = { id: state.comments.length + 1, user: ACTIONS_BOT, body };
          state.comments.push(comment);
          return comment;
        }),
        updateComment: api('issues.updateComment', ({ comment_id, body }) => {
          const comment = state.comments.find(({ id }) => id === comment_id);
          if (comment.user.login !== ACTIONS_BOT.login) throw fail(403, 'Resource not accessible by integration');
          comment.body = body;
          return comment;
        }),
      },
    },
  };
  return { github, state, calls };
};

// The workflow_run event of a guard's pull request run.
const guardEvent = (action, sha = NEW, branch = BRANCH) => ({
  repo: { owner: OWNER, repo: REPO },
  payload: {
    action,
    workflow_run: { head_sha: sha, head_branch: branch, event: 'pull_request', head_repository: { full_name: `${OWNER}/${REPO}` } },
  },
});
const follow = (github, context) =>
  new AsyncFunction('github', 'context', 'core', labelScript())(github, context, { info() {}, warning() {} });

describe('the bump pull request carries the landing label only on a head whose Test Suite and rename-guard passed', () => {
  it('starts when Test Suite or rename-guard is requested, starts or completes on a branch the bump, the index, the changelog or the AI block enhancement pushes', () => {
    const { on } = labelFlow();
    expect(Object.keys(on)).toEqual(['workflow_run']);
    // A re-run sends no requested event, only in_progress and completed.
    expect(on.workflow_run.types).toEqual(['requested', 'in_progress', 'completed']);
    expect([INDEX, CHANGELOG, AI_BLOCKS].map(pullRequestBranch)).toEqual([INDEX_BRANCH, CHANGELOG_BRANCH, AI_BLOCKS_BRANCH]);
    expect(on.workflow_run.branches).toEqual([
      stepUsing('peter-evans/create-pull-request').with.branch,
      ...[INDEX, CHANGELOG, AI_BLOCKS].map(pullRequestBranch),
    ]);
    // workflow_run names the workflows it follows by their names, so they stay the names the two files carry.
    expect(on.workflow_run.workflows).toEqual([yaml.load(read(TEST_SUITE)).name, yaml.load(read(RENAME_GUARD)).name]);
  });

  it("runs only for a pull request from one of this repository's own four branches, checks out no code and pastes nothing into its script", () => {
    const { permissions, concurrency, jobs } = labelFlow();
    expect(permissions).toEqual({ contents: 'read' });
    expect(Object.keys(jobs)).toEqual([JOB]);
    const job = jobs[JOB];
    expect(job.if).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(job.if).toContain(`github.event.workflow_run.head_branch == '${BRANCH}'`);
    expect(job.if).toContain(`github.event.workflow_run.head_branch == '${INDEX_BRANCH}'`);
    expect(job.if).toContain(`github.event.workflow_run.head_branch == '${CHANGELOG_BRANCH}'`);
    expect(job.if).toContain(`github.event.workflow_run.head_branch == '${AI_BLOCKS_BRANCH}'`);
    expect(job.if).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
    expect(job.permissions).toEqual({ actions: 'read', issues: 'write', 'pull-requests': 'write' });
    expect(job.steps.some((step) => String(step.uses).startsWith('actions/checkout@'))).toBe(false);
    expect(labelScript()).not.toContain('${{');
    // No concurrency group: GitHub cancels a group's waiting run when a newer one queues, and a cancelled run would show
    // on master's last commit. Each run reads the state again after it writes instead.
    expect(concurrency).toBeUndefined();
  });

  it('labels the head once both guards passed there, and keeps one guards comment naming both runs', async () => {
    const { github, state } = fakeGitHub({ runs: bothPassed() });
    // Each guard's completion starts the workflow; the second finds the label and the comment already there.
    await follow(github, guardEvent('completed'));
    await follow(github, guardEvent('completed'));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body.startsWith(MARKER)).toBe(true);
    expect(state.comments[0].body).toContain('Guards passed on bbbbbbb');
    expect(state.comments[0].body).toContain('Test Suite, run 101');
    expect(state.comments[0].body).toContain('rename-guard, run 102');
  });

  it.each([
    ['still runs', [prRun(TEST_SUITE, { id: 101, status: 'in_progress' }), prRun(RENAME_GUARD, { id: 102 })]],
    ['has no run yet', [prRun(RENAME_GUARD, { id: 102 })]],
  ])('keeps the label off while a guard %s on the head', async (_what, runs) => {
    const { github, state, calls } = fakeGitHub({ labels: ['landing'], comments: [guardsComment(OLD)], runs });
    await follow(github, guardEvent('completed'));
    expect(calls).not.toContain('issues.addLabels');
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body).toContain('off until Test Suite and rename-guard pass on bbbbbbb');
  });

  it.each(['failure', 'cancelled', 'timed_out', 'action_required'])(
    'takes the label off a head where a guard ended %s, and says which in the guards comment',
    async (conclusion) => {
      const runs = [prRun(TEST_SUITE, { id: 101, conclusion }), prRun(RENAME_GUARD, { id: 102 })];
      const { github, state } = fakeGitHub({ labels: ['landing'], comments: [quoting, guardsComment(OLD)], runs });
      await follow(github, guardEvent('completed'));
      expect(state.labels.has('landing')).toBe(false);
      expect(state.comments).toHaveLength(2);
      expect(state.comments[0].body).toBe(quoting.body);
      expect(state.comments[1].body.startsWith(MARKER)).toBe(true);
      expect(state.comments[1].body).toContain(`Test Suite (${conclusion}, run 101) did not pass on bbbbbbb`);
    }
  );

  it("decides on each guard's newest run on the head, so a passing run after a failed one labels it", async () => {
    const runs = [prRun(TEST_SUITE, { id: 101, conclusion: 'failure' }), prRun(TEST_SUITE, { id: 103 }), prRun(RENAME_GUARD, { id: 102 })];
    const { github, state } = fakeGitHub({ runs });
    await follow(github, guardEvent('completed'));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments[0].body).toContain('Test Suite, run 103');
  });

  it("reads no other workflow's runs and no fork's runs on the same commit as the guards", async () => {
    const runs = [
      ...bothPassed(),
      prRun('.github/workflows/landing-follows-the-base.yml', { id: 104, conclusion: 'skipped' }),
      prRun(TEST_SUITE, { id: 105, conclusion: 'failure', from: 'someone/codex' }),
    ];
    const { github, state } = fakeGitHub({ runs });
    await follow(github, guardEvent('completed'));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments[0].body).toContain('Test Suite, run 101');
  });

  it('takes the label off when a guard starts on the head, and writes its own guards comment only where it had one', async () => {
    const { github, state } = fakeGitHub({ labels: ['landing'], comments: [quoting, guardsComment(OLD)] });
    await follow(github, guardEvent('requested'));
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments).toHaveLength(2);
    expect(state.comments[0].body).toBe(quoting.body);
    expect(state.comments[1].body).toContain('off until Test Suite and rename-guard pass on bbbbbbb');

    const fresh = fakeGitHub({ comments: [quoting] });
    await follow(fresh.github, guardEvent('requested'));
    expect(fresh.calls).not.toContain('issues.createComment');
    expect(fresh.state.comments).toEqual([expect.objectContaining({ body: quoting.body })]);
  });

  it('changes nothing for a run on an older head', async () => {
    const runs = [prRun(TEST_SUITE, { id: 101, sha: OLD, conclusion: 'failure' }), prRun(RENAME_GUARD, { id: 102, sha: OLD })];
    const { github, state, calls } = fakeGitHub({ labels: ['landing'], comments: [guardsComment(NEW)], runs });
    await follow(github, guardEvent('completed', OLD));
    await follow(github, guardEvent('requested', OLD));
    expect(calls).toEqual(['pulls.list', 'pulls.list']);
    expect(state.labels.has('landing')).toBe(true);
    expect(state.comments[0].body).toContain('Guards passed on bbbbbbb');
  });

  it('does nothing without an open bump pull request into master', async () => {
    const { github, calls } = fakeGitHub({ open: false, runs: bothPassed() });
    await follow(github, guardEvent('completed'));
    expect(calls).toEqual(['pulls.list']);
  });

  it.each([
    ['the head', (state) => Object.assign(state, { head: 'c'.repeat(40) }), 'off until Test Suite and rename-guard pass on ccccccc'],
    ['the base', (state) => Object.assign(state, { base: 'main' }), 'no longer targets `master`'],
  ])('takes the label back off when %s changes while the label goes on', async (_what, change, says) => {
    const { github, state } = fakeGitHub({ runs: bothPassed(), onAddLabels: change });
    await follow(github, guardEvent('completed'));
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body.startsWith(MARKER)).toBe(true);
    expect(state.comments[0].body).toContain(says);
    expect(state.comments[0].body).not.toContain('Guards passed');
  });

  it("finds the guards' runs when GitHub gives their path with a ref", async () => {
    const runs = [prRun(TEST_SUITE, { id: 101, ref: 'master' }), prRun(RENAME_GUARD, { id: 102, ref: 'refs/heads/master' })];
    const { github, state } = fakeGitHub({ runs });
    await follow(github, guardEvent('completed'));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments[0].body).toContain('Test Suite, run 101');
    expect(state.comments[0].body).toContain('rename-guard, run 102');
  });

  it('takes the label off while a re-run of a guard is in progress on the head', async () => {
    const runs = [prRun(TEST_SUITE, { id: 101, status: 'in_progress' }), prRun(RENAME_GUARD, { id: 102 })];
    const { github, state } = fakeGitHub({ labels: ['landing'], comments: [guardsComment(NEW)], runs });
    await follow(github, guardEvent('in_progress'));
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments[0].body).toContain('off until Test Suite and rename-guard pass on bbbbbbb');
  });

  // Each run decides from the runs as they stand, so an event handled after the guards finished leaves the right label.
  it.each(['requested', 'in_progress'])('keeps the label when a %s event is handled after both guards passed', async (action) => {
    const { github, state } = fakeGitHub({ labels: ['landing'], comments: [guardsComment(NEW)], runs: bothPassed() });
    await follow(github, guardEvent(action));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body).toContain('Guards passed on bbbbbbb');
  });

  it('reads the runs again after it writes, so a guard that finishes meanwhile still gets the label on', async () => {
    const runs = [prRun(TEST_SUITE, { id: 101, status: 'in_progress' }), prRun(RENAME_GUARD, { id: 102 })];
    const finish = () => Object.assign(runs[0], { status: 'completed', conclusion: 'success' });
    const { github, state } = fakeGitHub({ runs, onRemoveLabel: finish });
    await follow(github, guardEvent('completed'));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body).toContain('Guards passed on bbbbbbb');
  });

  it('keeps every guards comment of its own true when two runs wrote one each', async () => {
    const { github, state } = fakeGitHub({ comments: [guardsComment(OLD), guardsComment(OLD)], runs: bothPassed() });
    await follow(github, guardEvent('completed'));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments).toHaveLength(2);
    for (const comment of state.comments) expect(comment.body).toContain('Guards passed on bbbbbbb');
  });

  it('takes the label off again when the guards comment cannot be written', async () => {
    const { github, state } = fakeGitHub({ runs: bothPassed(), failCreateComment: true });
    await expect(follow(github, guardEvent('completed'))).rejects.toThrow();
    expect(state.labels.has('landing')).toBe(false);
  });
});

// auto-index.yml, changelog.yml and ai-enhance-blocks.yml open their pull requests with FRAMERS_BUMP_TOKEN, as the bump
// opens its own, and label nothing; the same workflow keeps each one's landing label true to its guards.
describe.each([
  ['index', INDEX_BRANCH],
  ['changelog', CHANGELOG_BRANCH],
  ['AI-enhanced blocks', AI_BLOCKS_BRANCH],
])('the %s pull request carries the landing label only on a head whose Test Suite and rename-guard passed', (_name, branch) => {
  const branchRuns = (overrides = {}) => [
    prRun(TEST_SUITE, { id: 201, branch, ...overrides }),
    prRun(RENAME_GUARD, { id: 202, branch }),
  ];

  it('labels the pull request once both guards passed on its head, and names both runs', async () => {
    const { github, state } = fakeGitHub({ branch, runs: branchRuns() });
    await follow(github, guardEvent('completed', NEW, branch));
    expect([...state.labels]).toEqual(['landing']);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body.startsWith(MARKER)).toBe(true);
    expect(state.comments[0].body).toContain('Guards passed on bbbbbbb');
    expect(state.comments[0].body).toContain('Test Suite, run 201');
    expect(state.comments[0].body).toContain('rename-guard, run 202');
  });

  it('takes the label off the pull request where a guard ended without passing, and says which', async () => {
    const runs = branchRuns({ conclusion: 'failure' });
    const { github, state } = fakeGitHub({ branch, labels: ['landing'], comments: [guardsComment(OLD)], runs });
    await follow(github, guardEvent('completed', NEW, branch));
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body).toContain('Test Suite (failure, run 201) did not pass on bbbbbbb');
  });

  it("reads only its own branch's runs for the pull request", async () => {
    // The bump branch's runs on the same commit say nothing about this pull request.
    const runs = [prRun(TEST_SUITE, { id: 101 }), prRun(RENAME_GUARD, { id: 102 })];
    const { github, state, calls } = fakeGitHub({ branch, runs });
    await follow(github, guardEvent('completed', NEW, branch));
    expect(calls).not.toContain('issues.addLabels');
    expect(state.labels.has('landing')).toBe(false);
  });
});

describe('the landing label workflow follows no other branch', () => {
  it('changes nothing for a run from a branch none of the four workflows opens its pull request from', async () => {
    const elsewhere = 'feature/elsewhere';
    const runs = [prRun(TEST_SUITE, { id: 301, branch: elsewhere }), prRun(RENAME_GUARD, { id: 302, branch: elsewhere })];
    const { github, state, calls } = fakeGitHub({ branch: elsewhere, labels: ['landing'], runs });
    await follow(github, guardEvent('completed', NEW, elsewhere));
    expect(calls).toEqual([]);
    expect([...state.labels]).toEqual(['landing']);
  });
});
