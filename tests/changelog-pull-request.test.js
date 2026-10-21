/**
 * The weekly changelog reaches master through a pull request.
 *
 * changelog.yml appends the history of the days since a first day to codex-history/YYYY-MM.jsonl: one line for each day
 * of commits (scripts/generate-changelog.js) and one line of the GitHub activity since that day
 * (scripts/fetch-issue-activity.js). Its runs from 5 to 10 September 2026 failed at the step "Fetch GitHub issue
 * activity": the merged pull requests query declared $since and never used it, and GitHub's GraphQL API refuses an
 * operation that declares a variable it does not use ("Variable $since is declared by anonymous query but not used",
 * code variableNotUsed, run 34420881812). GitHub then disabled the workflow for inactivity. Its last step pushed to
 * master, which master's protection now refuses, as it refused the index publish (tests/index-pull-request.test.js).
 *
 * The workflow now opens or updates one pull request into master from ci/changelog with FRAMERS_BUMP_TOKEN, as the
 * index publish and the weekly bump do, once a week. These tests run the activity script against a stand-in for
 * GitHub's GraphQL API that applies GitHub's two variable rules, read the workflow, and run its first step, the step that
 * picks the first day and the step that carries an open pull request's entries, since GitHub starts the workflow only on
 * its schedule or by hand.
 *
 * Run: npx vitest run tests/changelog-pull-request.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { builtinModules } = require('module');
const { pathToFileURL } = require('url');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHANGELOG = '.github/workflows/changelog.yml';
const BUMP = '.github/workflows/bump-framers-deps.yml';
const ACTIVITY = 'scripts/fetch-issue-activity.js';
const GIT_LOG = 'scripts/generate-changelog.js';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const text = read(CHANGELOG);
const workflow = yaml.load(text);
const [jobId] = Object.keys(workflow.jobs ?? {});
const job = workflow.jobs?.[jobId] ?? { steps: [] };
const steps = job.steps ?? [];
const stepUsing = (list, action) => list.find((step) => String(step.uses).startsWith(`${action}@`));
const create = () => stepUsing(steps, 'peter-evans/create-pull-request');
const byId = (id) => steps.find((step) => step.id === id);
const running = (script) => steps.find((step) => String(step.run ?? '').includes(script));
// An action input that lists paths, one a line (create-pull-request also splits on commas).
const listed = (value) =>
  String(value ?? '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
const scratch = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// GitHub's GraphQL API, for the three queries the activity script sends: it refuses an operation that declares a variable
// it does not use (variableNotUsed) or uses one it does not declare (variableNotDefined), with the messages GitHub gives,
// and otherwise answers with the nodes the test hands it. Each request is logged as one JSON line.
const STUB = `
import fs from 'node:fs';
const answers = JSON.parse(fs.readFileSync(process.env.STUB_ANSWERS, 'utf8'));
const variablesOf = (text) => [...new Set([...text.matchAll(/\\$(\\w+)/g)].map((m) => m[1]))];
globalThis.fetch = async (url, init) => {
  const { query, variables = {} } = JSON.parse(init.body);
  fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ url: String(url), query, variables }) + '\\n');
  const open = query.indexOf('{');
  const declared = variablesOf(query.slice(0, open));
  const used = variablesOf(query.slice(open));
  const errors = [
    ...declared
      .filter((name) => !used.includes(name))
      .map((name) => ({ extensions: { code: 'variableNotUsed', variableName: name }, message: 'Variable $' + name + ' is declared by anonymous query but not used' })),
    ...used
      .filter((name) => !declared.includes(name))
      .map((name) => ({ extensions: { code: 'variableNotDefined', variableName: name }, message: 'Variable $' + name + ' is used by anonymous query but not declared' })),
  ];
  const merged = query.includes('pullRequests(');
  const nodes = merged ? answers.merged : query.includes('states: CLOSED') ? answers.closed : answers.created;
  const body = errors.length > 0 ? { errors } : { data: { repository: { [merged ? 'pullRequests' : 'issues']: { nodes } } } };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
`;

// The variables an operation declares, in the parentheses before its selection set, and the ones its selection set uses.
const declaredIn = (query) => [...new Set([...query.slice(0, query.indexOf('{')).matchAll(/\$(\w+)/g)].map((m) => m[1]))];
const usedIn = (query) => [...new Set([...query.slice(query.indexOf('{')).matchAll(/\$(\w+)/g)].map((m) => m[1]))];

// Runs the activity script with the stand-in in place of fetch, for the first day given, and returns its exit status,
// output, the requests it sent and the lines it appended.
const runActivity = (since, answers) => {
  const dir = scratch('activity-');
  try {
    const stub = path.join(dir, 'graphql-stub.mjs');
    const log = path.join(dir, 'requests.jsonl');
    const out = path.join(dir, 'history');
    fs.writeFileSync(stub, STUB);
    fs.writeFileSync(path.join(dir, 'answers.json'), JSON.stringify(answers));
    fs.writeFileSync(log, '');
    const res = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(stub).href, path.join(ROOT, ACTIVITY), '--since', since, '--output-dir', out],
      {
        cwd: dir,
        env: { PATH: process.env.PATH, HOME: dir, GH_PAT: 'a-token', STUB_LOG: log, STUB_ANSWERS: path.join(dir, 'answers.json') },
        encoding: 'utf8',
      }
    );
    const requests = fs
      .readFileSync(log, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const files = fs.existsSync(out) ? fs.readdirSync(out).filter((name) => name.endsWith('.jsonl')) : [];
    const lines = Object.fromEntries(
      files.map((name) => [
        name,
        fs
          .readFileSync(path.join(out, name), 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      ])
    );
    return { status: res.status, stdout: res.stdout, stderr: res.stderr, requests, lines };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const issue = (number, fields) => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/framerslab/codex/issues/${number}`,
  author: { login: 'someone' },
  labels: { nodes: [{ name: 'docs' }] },
  ...fields,
});
const recorded = (number, fields) => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/framerslab/codex/issues/${number}`,
  ...fields,
  author: 'someone',
  labels: ['docs'],
});

describe('the activity script sends only queries GitHub accepts, and records the activity since the day it is given', () => {
  // The step failed at the merged pull requests query: it declared $since, which no argument of the pullRequests
  // connection takes, and GitHub refused it before reading anything.
  it('declares only the variables each query uses and sends no other, so GitHub answers all three', () => {
    const { status, stdout, stderr, requests } = runActivity('2026-10-14', { created: [], closed: [], merged: [] });
    expect(status, stdout + stderr).toBe(0);
    expect(stderr).not.toMatch(/Variable \$\w+ is (declared|used) by/);
    expect(requests).toHaveLength(3);
    for (const { url, query, variables } of requests) {
      expect(url).toBe('https://api.github.com/graphql');
      expect(usedIn(query).sort(), query).toEqual(declaredIn(query).sort());
      expect(Object.keys(variables).sort(), query).toEqual(declaredIn(query).sort());
    }
  });

  // GitHub's issues filter `since` lists the issues updated at or after the date (IssueFilters.since), and the merged
  // pull requests come newest update first with no date argument, so the script keeps what happened on or after the day.
  it('records the issues created, the issues closed and the pull requests merged on or after the day, in one line dated that day', () => {
    const answers = {
      created: [
        issue(41, { createdAt: '2026-10-15T09:30:00Z' }),
        // Opened in September and commented on this week: GitHub's since filter returns it, but it was not created since.
        issue(12, { createdAt: '2026-09-01T08:00:00Z' }),
      ],
      closed: [issue(33, { closedAt: '2026-10-16T11:00:00Z' }), issue(7, { closedAt: '2026-10-01T10:00:00Z' })],
      merged: [issue(13, { mergedAt: '2026-10-21T08:22:00Z' }), issue(5, { mergedAt: '2025-12-20T18:15:00Z' })],
    };
    const { status, stdout, stderr, lines } = runActivity('2026-10-14', answers);
    expect(status, stdout + stderr).toBe(0);
    expect(Object.keys(lines)).toEqual(['2026-10.jsonl']);
    expect(lines['2026-10.jsonl']).toEqual([
      {
        type: 'github_activity',
        date: '2026-10-14',
        repository: 'framerslab/codex',
        summary: { issuesCreated: 1, issuesClosed: 1, prsMerged: 1, total: 3 },
        created: [recorded(41, { createdAt: '2026-10-15T09:30:00Z' })],
        closed: [recorded(33, { closedAt: '2026-10-16T11:00:00Z' })],
        merged: [recorded(13, { mergedAt: '2026-10-21T08:22:00Z' })],
      },
    ]);
  });

  it('imports only modules Node carries, as the history script does, so the workflow installs nothing', () => {
    for (const rel of [ACTIVITY, GIT_LOG]) {
      const specifiers = [...read(rel).matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      expect(specifiers.length, rel).toBeGreaterThan(0);
      for (const specifier of specifiers) expect(builtinModules, `${rel} imports ${specifier}`).toContain(specifier.replace(/^node:/, ''));
    }
  });
});

describe('changelog.yml opens a pull request into master from ci/changelog, and pushes nothing to master', () => {
  it('is valid YAML with one job, whose every run block passes bash -n', () => {
    expect(Object.keys(workflow.jobs)).toHaveLength(1);
    const blocks = steps.filter((step) => step.run).map((step) => step.run.replace(/\$\{\{[^}]*\}\}/g, 'X'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(() => execFileSync('bash', ['-n'], { input: block, stdio: ['pipe', 'pipe', 'pipe'] })).not.toThrow();
    }
  });

  it('runs no git push or git commit of its own', () => {
    for (const step of steps.filter((each) => each.run)) expect(step.run, step.name).not.toMatch(/\bgit\s+(push|commit)\b/);
  });

  it('opens or updates one pull request into master from ci/changelog with FRAMERS_BUMP_TOKEN, and labels nothing itself', () => {
    const step = create();
    expect(step, 'a create-pull-request step').toBeDefined();
    expect(step.with.token).toBe('${{ secrets.FRAMERS_BUMP_TOKEN }}');
    // branch-token defaults to token, so the branch is pushed with the same token.
    expect(step.with).not.toHaveProperty('branch-token');
    expect(step.with.base).toBe('master');
    expect(step.with.branch).toBe('ci/changelog');
    expect(step.with['delete-branch']).toBe(true);
    // The label waits for the pull request's own checks: landing-follows-the-bump-checks.yml adds it once they pass.
    expect(step.with).not.toHaveProperty('labels');
  });

  it('pins create-pull-request to the commit the weekly bump pins, with the release it carries beside it', () => {
    const bump = yaml.load(read(BUMP));
    const uses = create()?.uses;
    expect(uses).toBe(stepUsing(bump.jobs.bump.steps, 'peter-evans/create-pull-request').uses);
    expect(uses).toMatch(/^peter-evans\/create-pull-request@[0-9a-f]{40}$/);
    const line = text.split('\n').find((each) => each.includes(`uses: ${uses}`));
    expect(line).toMatch(/\s# v\d+\.\d+\.\d+$/);
  });

  it("keeps the job's GITHUB_TOKEN read-only, so nothing can push to master or open a pull request with it", () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(job.permissions).toBeUndefined();
  });

  it('stops at its first step, with an error annotation, when the secret is empty', () => {
    const [first] = steps;
    expect(first.env).toEqual({ FRAMERS_BUMP_TOKEN: '${{ secrets.FRAMERS_BUMP_TOKEN }}' });
    // The runner runs a step's script with bash -e.
    const check = (value) =>
      spawnSync('bash', ['-e', '-c', first.run], { env: { PATH: process.env.PATH, FRAMERS_BUMP_TOKEN: value }, encoding: 'utf8' });
    const missing = check('');
    expect(missing.status).toBe(1);
    expect(missing.stdout).toMatch(/^::error::FRAMERS_BUMP_TOKEN /m);
    expect(check('a-token').status).toBe(0);
  });

  it("checks out master's whole history, whichever branch a manual run names, since git log reads it", () => {
    const checkout = stepUsing(steps, 'actions/checkout');
    expect(checkout.with?.ref).toBe('master');
    expect(checkout.with?.['fetch-depth']).toBe(0);
  });

  // GitHub skips the push and pull_request workflows of a commit whose message carries one of these, so a pull request
  // whose head commit carried one would get no Test Suite or rename-guard, and its required checks would never report.
  it('commits with a message that skips no workflow, so the pull request gets its required checks', () => {
    const inputs = create()?.with ?? {};
    expect(inputs['commit-message']).toBeTruthy();
    for (const value of [inputs['commit-message'], inputs.title]) {
      expect(value).not.toMatch(/\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i);
      expect(value).not.toMatch(/skip-checks:\s*true/i);
    }
  });

  // create-pull-request stages add-paths with one git add, which stages nothing when one path matches no file; the
  // history folder is tracked here, so it is in the checkout before the first monthly file exists.
  it('commits the history folder the scripts write to, which is tracked here', () => {
    expect(listed(create()?.with['add-paths'])).toEqual(['codex-history']);
    const tracked = execFileSync('git', ['ls-files', '--', 'codex-history'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    expect(tracked.length).toBeGreaterThan(0);
  });

  it('opens the pull request one run at a time, and never cancels one that started', () => {
    expect(job.concurrency?.group).toBeTruthy();
    expect(job.concurrency?.['cancel-in-progress']).toBe(false);
  });

  // The owner's rule of 21 October 2026: a scheduled workflow runs once a week at most.
  it('runs on its schedule once a week at most, at one time of one day', () => {
    const schedules = workflow.on.schedule ?? [];
    expect(schedules).toHaveLength(1);
    const [minute, hour, dayOfMonth, month, dayOfWeek] = schedules[0].cron.trim().split(/\s+/);
    expect(minute).toMatch(/^\d+$/);
    expect(hour).toMatch(/^\d+$/);
    expect(month).toBe('*');
    const weekly = dayOfMonth === '*' && /^[0-7]$/.test(dayOfWeek);
    const monthly = /^\d+$/.test(dayOfMonth) && dayOfWeek === '*';
    expect(weekly || monthly, schedules[0].cron).toBe(true);
  });

  it('installs nothing, so no install script runs in the job that holds the token', () => {
    const installs = steps
      .flatMap((step) => String(step.run ?? '').split('\n'))
      .filter((line) => /\b(npm|pnpm|yarn|npx)\b/.test(line));
    expect(installs).toEqual([]);
    expect(steps.some((step) => String(step.uses).startsWith('pnpm/action-setup@'))).toBe(false);
  });

  // The git log and the activity cover the same days: the run's first day reaches both scripts from one step, as an
  // environment variable, never pasted into the script.
  it('hands both scripts the first day one step picks, and runs them before the pull request', () => {
    const window = byId('window');
    expect(window, 'a step with id window').toBeDefined();
    const gitLog = running(GIT_LOG);
    const activity = running(ACTIVITY);
    for (const step of [gitLog, activity]) {
      expect(step?.env?.SINCE).toBe('${{ steps.window.outputs.since }}');
      expect(step.run).toMatch(/--since "\$SINCE"/);
      expect(step.run).not.toContain('${{');
    }
    expect(activity.env.GH_PAT).toBe('${{ secrets.GH_PAT }}');
    const at = (step) => steps.indexOf(step);
    expect(at(stepUsing(steps, 'actions/checkout'))).toBeLessThan(at(window));
    expect(at(window)).toBeLessThan(at(byId('carry')));
    expect(at(byId('carry'))).toBeLessThan(at(gitLog));
    expect(at(gitLog)).toBeLessThan(at(activity));
    expect(at(activity)).toBeLessThan(at(create()));
  });
});

describe('the first day, and the entries an open changelog pull request carries', () => {
  // The runner runs a step's script with bash -e.
  const runStep = (step, { cwd, env }) => {
    const dir = scratch('changelog-step-');
    try {
      const output = path.join(dir, 'output');
      fs.writeFileSync(output, '');
      const res = spawnSync('bash', ['-e', '-c', step.run], {
        cwd: cwd ?? dir,
        env: { PATH: process.env.PATH, HOME: dir, GIT_CONFIG_NOSYSTEM: '1', RUNNER_TEMP: dir, GITHUB_OUTPUT: output, ...env },
        encoding: 'utf8',
      });
      return { status: res.status, stdout: res.stdout, stderr: res.stderr, output: fs.readFileSync(output, 'utf8') };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it('starts seven days ago on the schedule, the week since the last scheduled run', () => {
    const { status, output, stdout, stderr } = runStep(byId('window'), { env: { SINCE_INPUT: '' } });
    expect(status, stdout + stderr).toBe(0);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    expect(output).toBe(`since=${weekAgo}\n`);
  });

  it('starts on the day a manual run names', () => {
    const { status, output } = runStep(byId('window'), { env: { SINCE_INPUT: '2026-09-01' } });
    expect(status).toBe(0);
    expect(output).toBe('since=2026-09-01\n');
  });

  it.each(['yesterday', '2026-09-01; touch pwned', '2026-9-1'])('refuses a first day that is not a date written YYYY-MM-DD (%s)', (input) => {
    const { status, output, stdout } = runStep(byId('window'), { env: { SINCE_INPUT: input } });
    expect(status).not.toBe(0);
    expect(stdout).toMatch(/^::error::/m);
    expect(output).toBe('');
  });

  // origin holds master and, when withBranch, an open pull request's branch ci/changelog that appended lines to one
  // monthly file and added another; master changed the folder's README after that branch was made. The checkout is
  // master's, as actions/checkout leaves it.
  const withOrigin = (withBranch, body) => {
    const root = scratch('changelog-carry-');
    const git = (cwd, ...args) => {
      const res = spawnSync(
        'git',
        ['-c', 'user.name=changelog', '-c', 'user.email=changelog@example.invalid', '-c', 'commit.gpgsign=false', ...args],
        { cwd, encoding: 'utf8' }
      );
      if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
      return res.stdout.trim();
    };
    const work = path.join(root, 'work');
    const put = (file, content) => {
      fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
      fs.writeFileSync(path.join(work, file), content);
    };
    try {
      const origin = path.join(root, 'origin.git');
      git(root, 'init', '--quiet', '--bare', origin);
      fs.mkdirSync(work);
      git(work, 'init', '--quiet');
      git(work, 'symbolic-ref', 'HEAD', 'refs/heads/master');
      git(work, 'remote', 'add', 'origin', `file://${origin}`);
      put('codex-history/README.md', 'the history\n');
      put('codex-history/2026-10.jsonl', '{"date":"2026-10-01"}\n');
      git(work, 'add', '--all');
      git(work, 'commit', '--quiet', '-m', 'master');
      git(work, 'push', '--quiet', 'origin', 'master');
      if (withBranch) {
        git(work, 'switch', '--quiet', '-c', 'ci/changelog');
        put('codex-history/2026-10.jsonl', '{"date":"2026-10-01"}\n{"date":"2026-10-08"}\n');
        put('codex-history/2026-11.jsonl', '{"date":"2026-11-02"}\n');
        git(work, 'add', '--all');
        git(work, 'commit', '--quiet', '-m', 'the open pull request');
        git(work, 'push', '--quiet', 'origin', 'ci/changelog');
        git(work, 'switch', '--quiet', 'master');
      }
      put('codex-history/README.md', 'the history, edited on master\n');
      git(work, 'commit', '--quiet', '-am', 'master edits the README');
      git(work, 'push', '--quiet', 'origin', 'master');
      git(root, 'clone', '--quiet', '--branch', 'master', `file://${origin}`, 'checkout');
      const checkout = path.join(root, 'checkout');
      return body({ checkout, git, file: (rel) => fs.readFileSync(path.join(checkout, rel), 'utf8') });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  it("takes the monthly files of the open changelog pull request, and leaves master's other files", () => {
    withOrigin(true, ({ checkout, file }) => {
      const { status, stdout, stderr } = runStep(byId('carry'), { cwd: checkout });
      expect(status, stdout + stderr).toBe(0);
      expect(file('codex-history/2026-10.jsonl')).toBe('{"date":"2026-10-01"}\n{"date":"2026-10-08"}\n');
      expect(file('codex-history/2026-11.jsonl')).toBe('{"date":"2026-11-02"}\n');
      expect(file('codex-history/README.md')).toBe('the history, edited on master\n');
    });
  });

  it("starts from master's history when no changelog pull request is open", () => {
    withOrigin(false, ({ checkout, git }) => {
      const { status, stdout, stderr } = runStep(byId('carry'), { cwd: checkout });
      expect(status, stdout + stderr).toBe(0);
      expect(git(checkout, 'status', '--porcelain')).toBe('');
    });
  });

  it('fails, carrying nothing, when it cannot read origin', () => {
    withOrigin(true, ({ checkout, git }) => {
      git(checkout, 'remote', 'set-url', 'origin', `file://${path.join(checkout, 'no-such-origin.git')}`);
      const { status, stdout } = runStep(byId('carry'), { cwd: checkout });
      expect(status).not.toBe(0);
      expect(stdout).toMatch(/^::error::/m);
      expect(git(checkout, 'status', '--porcelain')).toBe('');
    });
  });
});
