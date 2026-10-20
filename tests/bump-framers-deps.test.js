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
 * The bump labels nothing. Its pull request gets the landing label from landing-follows-the-bump-checks.yml, once its
 * own Test Suite and rename-guard runs pass on its head. That workflow starts on workflow_run, which runs the file as it
 * reads on master, so GitHub runs it only after it merges; these tests run its script against a stand-in for the GitHub
 * API that holds the pull request's head, base, labels, comments and runs.
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

// landing-follows-the-bump-checks.yml, run here the way actions/github-script runs a script: as the body of an async
// function, against a stand-in for the GitHub API that holds the bump pull request's head, base, labels, comments and the
// pull request runs GitHub lists for a commit.
const LABEL_FLOW = '.github/workflows/landing-follows-the-bump-checks.yml';
const JOB = 'follow-the-guards';
const TEST_SUITE = '.github/workflows/test.yml';
const RENAME_GUARD = '.github/workflows/rename-guard.yml';
const BRANCH = 'chore/bump-framers-deps';
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

// A pull request run of a workflow on a commit, as GitHub lists it. GitHub's REST description gives a run's path as
// path@ref (".github/workflows/build.yml@main"), so a run can carry either form.
const prRun = (
  workflowPath,
  { id, sha = NEW, status = 'completed', conclusion = 'success', from = `${OWNER}/${REPO}`, ref = null }
) => ({
  id,
  run_number: id,
  path: ref ? `${workflowPath}@${ref}` : workflowPath,
  head_sha: sha,
  head_branch: BRANCH,
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
          open && params.state === 'open' && params.head === `${OWNER}:${BRANCH}` && params.base === state.base
            ? [{ number: PR, head: { sha: state.head, ref: BRANCH }, base: { ref: state.base } }]
            : []
        ),
        get: api('pulls.get', () => ({ number: PR, head: { sha: state.head }, base: { ref: state.base } })),
      },
      actions: {
        listWorkflowRunsForRepo: api('actions.listWorkflowRunsForRepo', (params) =>
          runs.filter((r) => r.head_sha === params.head_sha && (!params.event || r.event === params.event))
        ),
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
const guardEvent = (action, sha = NEW) => ({
  repo: { owner: OWNER, repo: REPO },
  payload: {
    action,
    workflow_run: { head_sha: sha, head_branch: BRANCH, event: 'pull_request', head_repository: { full_name: `${OWNER}/${REPO}` } },
  },
});
const follow = (github, context) =>
  new AsyncFunction('github', 'context', 'core', labelScript())(github, context, { info() {}, warning() {} });

describe('the bump pull request carries the landing label only on a head whose Test Suite and rename-guard passed', () => {
  it('starts when Test Suite or rename-guard is requested, starts or completes on the branch the bump pushes', () => {
    const { on } = labelFlow();
    expect(Object.keys(on)).toEqual(['workflow_run']);
    // A re-run sends no requested event, only in_progress and completed.
    expect(on.workflow_run.types).toEqual(['requested', 'in_progress', 'completed']);
    expect(on.workflow_run.branches).toEqual([stepUsing('peter-evans/create-pull-request').with.branch]);
    // workflow_run names the workflows it follows by their names, so they stay the names the two files carry.
    expect(on.workflow_run.workflows).toEqual([yaml.load(read(TEST_SUITE)).name, yaml.load(read(RENAME_GUARD)).name]);
  });

  it("runs only for a pull request from this repository's own bump branch, checks out no code and pastes nothing into its script", () => {
    const { permissions, concurrency, jobs } = labelFlow();
    expect(permissions).toEqual({ contents: 'read' });
    expect(Object.keys(jobs)).toEqual([JOB]);
    const job = jobs[JOB];
    expect(job.if).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(job.if).toContain(`github.event.workflow_run.head_branch == '${BRANCH}'`);
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
