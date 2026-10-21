/**
 * The weekly changelog reaches master through a pull request, and records each day once.
 *
 * changelog.yml appends history to codex-history/YYYY-MM.jsonl: one line for each day of the commits that reached master
 * (scripts/generate-changelog.js) and one line of the GitHub activity over a span of days (scripts/fetch-issue-activity.js).
 * Its runs from 5 to 10 September 2026 failed at the step "Fetch GitHub issue activity": the merged pull requests query
 * declared $since and never used it, and GitHub's GraphQL API refuses an operation that declares a variable it does not use
 * ("Variable $since is declared by anonymous query but not used", code variableNotUsed, run 34420881812). GitHub then
 * disabled the workflow for inactivity. Its last step pushed to master, which master's protection now refuses, as it
 * refused the index publish (tests/index-pull-request.test.js).
 *
 * The workflow now opens or updates one pull request into master from ci/changelog with FRAMERS_BUMP_TOKEN, as the index
 * publish and the weekly bump do, once a week. Each run records complete days, in UTC, up to the day it runs on, from the
 * first day not yet recorded, so a missed or failed run leaves no gap and a manual run leaves no day half recorded. The git
 * changelog files each commit under the day the first-parent commit that brought it to master was made, so a pull
 * request's commits are recorded on the day it merged, whenever they were written; the activity reads every page of each
 * list and leaves out an item an earlier line holds.
 *
 * These tests run the activity script against a stand-in for GitHub's GraphQL API that applies GitHub's two variable rules
 * and serves each list a page at a time, run the git changelog in scratch repositories whose commits carry the dates the
 * test gives, read the workflow, and run its steps, since GitHub starts the workflow only on its schedule or by hand.
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
  const all = merged ? answers.merged : query.includes('states: CLOSED') ? answers.closed : answers.created;
  // One page of the connection, as GitHub serves it: the first nodes after the cursor, here the offset it continues from.
  const first = Number((query.match(/first:\\s*(\\d+)/) ?? [])[1] ?? 100);
  const offset = variables.after ? Number(variables.after) : 0;
  const nodes = all.slice(offset, offset + first);
  const pageInfo = { hasNextPage: offset + first < all.length, endCursor: String(offset + first) };
  const body = errors.length > 0 ? { errors } : { data: { repository: { [merged ? 'pullRequests' : 'issues']: { nodes, pageInfo } } } };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
`;

// The variables an operation declares, in the parentheses before its selection set, and the ones its selection set uses.
const declaredIn = (query) => [...new Set([...query.slice(0, query.indexOf('{')).matchAll(/\$(\w+)/g)].map((m) => m[1]))];
const usedIn = (query) => [...new Set([...query.slice(query.indexOf('{')).matchAll(/\$(\w+)/g)].map((m) => m[1]))];

// The lines of each monthly file in a history folder, by file name.
const historyLines = (out) => {
  const files = fs.existsSync(out) ? fs.readdirSync(out).filter((name) => name.endsWith('.jsonl')).sort() : [];
  return Object.fromEntries(
    files.map((name) => [
      name,
      fs
        .readFileSync(path.join(out, name), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    ])
  );
};
// Writes lines to the monthly files of a history folder, by file name, as earlier runs left them.
const writeHistory = (out, history) => {
  fs.mkdirSync(out, { recursive: true });
  for (const [name, lines] of Object.entries(history)) {
    fs.writeFileSync(path.join(out, name), lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  }
};

// Runs the activity script with the stand-in in place of fetch, with the arguments given and a history folder holding the
// lines given, and returns its exit status, output, the requests it sent and the history folder's lines afterwards.
const runActivity = (args, answers, history = {}) => {
  const dir = scratch('activity-');
  try {
    const stub = path.join(dir, 'graphql-stub.mjs');
    const log = path.join(dir, 'requests.jsonl');
    const out = path.join(dir, 'history');
    fs.writeFileSync(stub, STUB);
    fs.writeFileSync(path.join(dir, 'answers.json'), JSON.stringify(answers));
    fs.writeFileSync(log, '');
    if (Object.keys(history).length > 0) writeHistory(out, history);
    const res = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(stub).href, path.join(ROOT, ACTIVITY), ...args, '--output-dir', out],
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
    return { status: res.status, stdout: res.stdout, stderr: res.stderr, requests, lines: historyLines(out) };
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
    const { status, stdout, stderr, requests } = runActivity(['--since', '2026-10-14', '--until', '2026-10-22'], {
      created: [],
      closed: [],
      merged: [],
    });
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
  it('records the issues created, the issues closed and the pull requests merged from the first day, in one line dated that day', () => {
    const answers = {
      created: [
        issue(41, { createdAt: '2026-10-15T09:30:00Z' }),
        // Opened in September and commented on this week: GitHub's since filter returns it, but it was not created since.
        issue(12, { createdAt: '2026-09-01T08:00:00Z' }),
      ],
      closed: [issue(33, { closedAt: '2026-10-16T11:00:00Z' }), issue(7, { closedAt: '2026-10-01T10:00:00Z' })],
      merged: [issue(13, { mergedAt: '2026-10-21T08:22:00Z' }), issue(5, { mergedAt: '2025-12-20T18:15:00Z' })],
    };
    const { status, stdout, stderr, lines } = runActivity(['--since', '2026-10-14', '--until', '2026-10-22'], answers);
    expect(status, stdout + stderr).toBe(0);
    expect(Object.keys(lines)).toEqual(['2026-10.jsonl']);
    expect(lines['2026-10.jsonl']).toEqual([
      {
        type: 'github_activity',
        date: '2026-10-14',
        until: '2026-10-22',
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

// A time on a day, in UTC, as GitHub writes it.
const utc = (day, time = '00:00:00') => `${day}T${time}Z`;
// count numbered items of one list, from the number given, in the order GitHub lists them; fields(i) gives each its dates.
const many = (count, from, fields) => Array.from({ length: count }, (_, i) => issue(from + i, fields(i)));
// A line of activity an earlier run recorded, over the days from date up to until.
const activityLine = (date, until, { created = [], closed = [], merged = [] } = {}) => ({
  type: 'github_activity',
  date,
  until,
  repository: 'framerslab/codex',
  summary: {
    issuesCreated: created.length,
    issuesClosed: closed.length,
    prsMerged: merged.length,
    total: created.length + closed.length + merged.length,
  },
  created,
  closed,
  merged,
});
// A day of commits an earlier run recorded.
const commitDay = (date, commits = []) => ({ date, totalCommits: commits.length, byType: {}, commits });

describe('the activity script records each span of complete days once, and reads every page', () => {
  it('records what happened from the first day up to the day before --until, in UTC, and names that day', () => {
    const answers = {
      created: [issue(42, { createdAt: utc('2026-10-22') }), issue(41, { createdAt: utc('2026-10-15', '09:30:00') })],
      closed: [issue(34, { closedAt: utc('2026-10-21', '23:59:59') }), issue(33, { closedAt: utc('2026-10-16', '11:00:00') })],
      merged: [issue(16, { mergedAt: utc('2026-10-22', '09:00:00') }), issue(13, { mergedAt: utc('2026-10-21', '08:22:00') })],
    };
    const { status, stdout, stderr, lines } = runActivity(['--since', '2026-10-14', '--until', '2026-10-22'], answers);
    expect(status, stdout + stderr).toBe(0);
    expect(lines['2026-10.jsonl']).toHaveLength(1);
    const [line] = lines['2026-10.jsonl'];
    expect([line.date, line.until]).toEqual(['2026-10-14', '2026-10-22']);
    expect(line.created.map((each) => each.number)).toEqual([41]);
    expect(line.closed.map((each) => each.number)).toEqual([34, 33]);
    expect(line.merged.map((each) => each.number)).toEqual([13]);
  });

  // GitHub serves at most 100 nodes a page. The merged pull requests come last updated first, and a pull request is
  // updated when it merges, so a page that ends with one last updated before the first day ends the ones that count.
  it('reads every page of each list, and stops the merged pull requests at a page that ends before the first day', () => {
    const answers = {
      created: many(120, 1000, () => ({ createdAt: utc('2026-10-21', '12:00:00') })),
      closed: many(150, 2000, () => ({ closedAt: utc('2026-10-20', '12:00:00') })),
      merged: [
        ...many(120, 3000, () => ({ mergedAt: utc('2026-10-19', '12:00:00'), updatedAt: utc('2026-10-19', '12:00:00') })),
        ...many(130, 4000, () => ({ mergedAt: utc('2026-09-01', '12:00:00'), updatedAt: utc('2026-09-02', '12:00:00') })),
      ],
    };
    const { status, stdout, stderr, requests, lines } = runActivity(['--since', '2026-10-14', '--until', '2026-10-22'], answers);
    expect(status, stdout + stderr).toBe(0);
    const [line] = lines['2026-10.jsonl'];
    expect(line.summary).toEqual({ issuesCreated: 120, issuesClosed: 150, prsMerged: 120, total: 390 });
    const cursors = (kind) => requests.filter(({ query }) => kind(query)).map(({ variables }) => variables.after);
    expect(cursors((query) => query.includes('pullRequests('))).toEqual([null, '100']);
    expect(cursors((query) => query.includes('states: CLOSED'))).toEqual([null, '100']);
  });

  it('starts where the last recorded span ended when no first day is given', () => {
    const history = {
      '2026-10.jsonl': [activityLine('2026-10-05', '2026-10-12', { merged: [recorded(11, { mergedAt: utc('2026-10-08', '10:00:00') })] })],
    };
    const answers = {
      created: [],
      closed: [],
      merged: [
        issue(12, { mergedAt: utc('2026-10-13', '10:00:00'), updatedAt: utc('2026-10-13', '10:00:00') }),
        issue(11, { mergedAt: utc('2026-10-08', '10:00:00'), updatedAt: utc('2026-10-13', '09:00:00') }),
      ],
    };
    const { status, stdout, stderr, requests, lines } = runActivity(['--until', '2026-10-19'], answers, history);
    expect(status, stdout + stderr).toBe(0);
    expect(lines['2026-10.jsonl']).toHaveLength(2);
    const added = lines['2026-10.jsonl'][1];
    expect([added.date, added.until]).toEqual(['2026-10-12', '2026-10-19']);
    expect(added.merged.map((each) => each.number)).toEqual([12]);
    expect(requests.find(({ query }) => query.includes('issues(')).variables.since).toBe(utc('2026-10-12'));
  });

  it('starts seven days before --until when no span is recorded', () => {
    const answers = { created: [], closed: [], merged: [issue(12, { mergedAt: utc('2026-10-13', '10:00:00') })] };
    const { status, stdout, stderr, lines } = runActivity(['--until', '2026-10-19'], answers);
    expect(status, stdout + stderr).toBe(0);
    const [line] = lines['2026-10.jsonl'];
    expect([line.date, line.until]).toEqual(['2026-10-12', '2026-10-19']);
    expect(line.merged.map((each) => each.number)).toEqual([12]);
  });

  it('leaves out what an earlier line holds, so a span that reaches back counts each item once', () => {
    const history = {
      '2026-10.jsonl': [
        activityLine('2026-10-12', '2026-10-19', {
          created: [recorded(41, { createdAt: utc('2026-10-14', '10:00:00') })],
          closed: [recorded(33, { closedAt: utc('2026-10-15', '10:00:00') })],
          merged: [recorded(12, { mergedAt: utc('2026-10-13', '10:00:00') })],
        }),
      ],
    };
    const answers = {
      created: [issue(42, { createdAt: utc('2026-10-20', '10:00:00') }), issue(41, { createdAt: utc('2026-10-14', '10:00:00') })],
      // 33 was reopened and closed again on 20 October: that close is new.
      closed: [issue(33, { closedAt: utc('2026-10-20', '11:00:00') }), issue(35, { closedAt: utc('2026-10-20', '10:00:00') })],
      merged: [issue(14, { mergedAt: utc('2026-10-20', '10:00:00') }), issue(12, { mergedAt: utc('2026-10-13', '10:00:00') })],
    };
    const { status, stdout, stderr, lines } = runActivity(['--since', '2026-10-10', '--until', '2026-10-21'], answers, history);
    expect(status, stdout + stderr).toBe(0);
    expect(lines['2026-10.jsonl']).toHaveLength(2);
    const added = lines['2026-10.jsonl'][1];
    expect([added.date, added.until]).toEqual(['2026-10-10', '2026-10-21']);
    expect(added.created.map((each) => each.number)).toEqual([42]);
    expect(added.closed.map((each) => [each.number, each.closedAt])).toEqual([
      [33, utc('2026-10-20', '11:00:00')],
      [35, utc('2026-10-20', '10:00:00')],
    ]);
    expect(added.merged.map((each) => each.number)).toEqual([14]);
    expect(added.summary.total).toBe(4);
  });

  it('sends nothing and records nothing when every day before --until is recorded', () => {
    const history = { '2026-10.jsonl': [activityLine('2026-10-12', '2026-10-19', { merged: [recorded(12, { mergedAt: utc('2026-10-13') })] })] };
    const { status, stdout, stderr, requests, lines } = runActivity(['--until', '2026-10-19'], { created: [], closed: [], merged: [] }, history);
    expect(status, stdout + stderr).toBe(0);
    expect(requests).toEqual([]);
    expect(lines['2026-10.jsonl']).toHaveLength(1);
  });

  it.each([
    ['--since', '2026-02-30'],
    ['--since', '2026-10-14T00:00:00Z'],
    ['--until', 'tomorrow'],
  ])('stops, sending nothing, at a day not written YYYY-MM-DD (%s %s)', (option, value) => {
    const args = option === '--since' ? ['--since', value, '--until', '2026-10-22'] : ['--since', '2026-10-14', '--until', value];
    const { status, requests, lines } = runActivity(args, { created: [], closed: [], merged: [] });
    expect(status).not.toBe(0);
    expect(requests).toEqual([]);
    expect(lines).toEqual({});
  });
});

describe('the git changelog records each commit once, on the day it reached master, and only complete days', () => {
  // A repository whose commits carry the times the test gives, in git's own date format, seconds since 1970 and the zone,
  // so no zone of the machine running the test plays a part. The changelog runs in it, as the workflow runs it in master's
  // checkout, and writes to a history folder the test can fill first.
  const withRepository = (body) => {
    const root = scratch('changelog-git-');
    const repo = path.join(root, 'repo');
    const out = path.join(root, 'history');
    const env = { PATH: process.env.PATH, HOME: root, TZ: 'UTC', GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: path.dirname(root) };
    const gitTime = (iso) => `${Math.floor(Date.parse(iso) / 1000)} +0000`;
    const git = (args, dates = {}) => {
      const res = spawnSync(
        'git',
        ['-c', 'user.name=Weaver', '-c', 'user.email=weaver@example.invalid', '-c', 'commit.gpgsign=false', ...args],
        { cwd: repo, env: { ...env, ...dates }, encoding: 'utf8' }
      );
      if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
      return res.stdout.trim();
    };
    let files = 0;
    // One commit that adds a file, made at the time given.
    const commit = (message, at, { body: text = null } = {}) => {
      files += 1;
      fs.writeFileSync(path.join(repo, `file-${files}.md`), `${files}\n`);
      git(['add', '--all']);
      git(['commit', '--quiet', '-m', message, ...(text ? ['-m', text] : [])], {
        GIT_AUTHOR_DATE: gitTime(at),
        GIT_COMMITTER_DATE: gitTime(at),
      });
      return git(['rev-parse', 'HEAD']);
    };
    // A merge commit made at the time given, as GitHub makes one when a pull request merges.
    const merge = (branch, message, at) => {
      git(['merge', '--quiet', '--no-ff', '-m', message, branch], { GIT_AUTHOR_DATE: gitTime(at), GIT_COMMITTER_DATE: gitTime(at) });
      return git(['rev-parse', 'HEAD']);
    };
    const history = (name, lines) => writeHistory(out, { [name]: lines });
    const run = (args, { cwd = repo } = {}) => {
      const res = spawnSync(process.execPath, [path.join(ROOT, GIT_LOG), ...args, '--output-dir', out], { cwd, env, encoding: 'utf8' });
      return { status: res.status, stdout: res.stdout, stderr: res.stderr, lines: historyLines(out) };
    };
    try {
      fs.mkdirSync(repo);
      git(['init', '--quiet']);
      git(['symbolic-ref', 'HEAD', 'refs/heads/master']);
      return body({ root, git, commit, merge, history, run });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
  const days = (lines) => lines.map((day) => [day.date, day.commits.map((each) => each.fullSha)]);

  // git log's own lines end at each newline of a commit's body, so a body of several lines cannot be read line by line.
  it('records a commit whose message has a body of several lines, whole, as one commit', () => {
    withRepository(({ commit, run }) => {
      const sha = commit('fix(index): read each document whole', utc('2026-10-13', '10:00:00'), {
        body: 'The postings read each file.\nA second line.\n\nA second paragraph.',
      });
      const { status, stdout, stderr, lines } = run(['--since', '2026-10-13', '--until', '2026-10-14']);
      expect(status, stdout + stderr).toBe(0);
      expect(lines['2026-10.jsonl']).toHaveLength(1);
      const [day] = lines['2026-10.jsonl'];
      expect([day.date, day.totalCommits]).toEqual(['2026-10-13', 1]);
      const [one] = day.commits;
      expect(one).toMatchObject({
        sha: sha.slice(0, 7),
        fullSha: sha,
        author: 'Weaver',
        email: 'weaver@example.invalid',
        url: `https://github.com/framerslab/codex/commit/${sha}`,
        type: 'fix',
        scope: 'index',
        description: 'read each document whole',
        body: 'The postings read each file.\nA second line.\n\nA second paragraph.',
      });
      expect(Date.parse(one.date)).toBe(Date.parse(utc('2026-10-13', '10:00:00')));
      expect(day.byType).toEqual({ fix: [one] });
    });
  });

  // A merged pull request's commits keep the dates they were made on, which can be before the first day of the run that
  // first finds them on master.
  it("records a pull request's commits on the day its merge reached master, though they were made before the first day", () => {
    withRepository(({ git, commit, merge, run }) => {
      commit('docs: a start', utc('2026-10-05', '10:00:00'));
      git(['switch', '--quiet', '-c', 'feature']);
      const feat = commit('feat(search): find a term past the excerpt', utc('2026-10-09', '15:00:00'));
      const test = commit('test: a term past the excerpt', utc('2026-10-10', '09:00:00'));
      git(['switch', '--quiet', 'master']);
      const note = commit('docs: a note', utc('2026-10-12', '08:00:00'));
      merge('feature', 'Merge pull request #15 from framerslab/feature', utc('2026-10-14', '11:00:00'));
      const { status, stdout, stderr, lines } = run(['--since', '2026-10-12', '--until', '2026-10-16']);
      expect(status, stdout + stderr).toBe(0);
      expect(days(lines['2026-10.jsonl'])).toEqual([
        ['2026-10-12', [note]],
        ['2026-10-14', [test, feat]],
      ]);
    });
  });

  it('records complete days only: what reached master on the day --until names waits for a later run', () => {
    withRepository(({ commit, run }) => {
      const before = commit('docs: before midnight', utc('2026-10-15', '23:59:00'));
      commit('docs: after midnight', utc('2026-10-16', '00:30:00'));
      const { status, stdout, stderr, lines } = run(['--since', '2026-10-15', '--until', '2026-10-16']);
      expect(status, stdout + stderr).toBe(0);
      expect(days(lines['2026-10.jsonl'])).toEqual([['2026-10-15', [before]]]);
    });
  });

  it('starts after the last day recorded when no first day is given', () => {
    withRepository(({ commit, history, run }) => {
      commit('docs: older', utc('2026-10-10', '10:00:00'));
      const newer = commit('docs: newer', utc('2026-10-13', '10:00:00'));
      history('2026-10.jsonl', [commitDay('2026-10-12')]);
      const { status, stdout, stderr, lines } = run(['--until', '2026-10-16']);
      expect(status, stdout + stderr).toBe(0);
      expect(days(lines['2026-10.jsonl'])).toEqual([
        ['2026-10-12', []],
        ['2026-10-13', [newer]],
      ]);
    });
  });

  it('starts seven days before --until when no day is recorded', () => {
    withRepository(({ commit, run }) => {
      commit('docs: eight days before', utc('2026-10-08', '23:00:00'));
      const seventh = commit('docs: seven days before', utc('2026-10-09', '01:00:00'));
      const last = commit('docs: the day before', utc('2026-10-15', '12:00:00'));
      const { status, stdout, stderr, lines } = run(['--until', '2026-10-16']);
      expect(status, stdout + stderr).toBe(0);
      expect(days(lines['2026-10.jsonl'])).toEqual([
        ['2026-10-09', [seventh]],
        ['2026-10-15', [last]],
      ]);
    });
  });

  it('skips a day already recorded, and counts no activity line as a day of commits', () => {
    withRepository(({ commit, history, run }) => {
      commit('docs: recorded', utc('2026-10-13', '10:00:00'));
      const fourteenth = commit('docs: on the fourteenth', utc('2026-10-14', '10:00:00'));
      const fifteenth = commit('docs: on the fifteenth', utc('2026-10-15', '10:00:00'));
      history('2026-10.jsonl', [commitDay('2026-10-13'), activityLine('2026-10-14', '2026-10-15')]);
      const { status, stdout, stderr, lines } = run(['--since', '2026-10-13', '--until', '2026-10-16']);
      expect(status, stdout + stderr).toBe(0);
      const month = lines['2026-10.jsonl'];
      expect(month.map((line) => [line.type ?? 'commits', line.date])).toEqual([
        ['commits', '2026-10-13'],
        ['github_activity', '2026-10-14'],
        ['commits', '2026-10-14'],
        ['commits', '2026-10-15'],
      ]);
      expect(days(month.slice(2))).toEqual([
        ['2026-10-14', [fourteenth]],
        ['2026-10-15', [fifteenth]],
      ]);
    });
  });

  // A conventional commit's type is any word, so it can be the name of a property every object has.
  it('groups a day of commits by any type, even one named like a property every object has', () => {
    withRepository(({ commit, run }) => {
      const types = ['constructor', 'toString', '__proto__', 'fix'];
      const shas = types.map((type) => commit(`${type}: a commit of type ${type}`, utc('2026-10-13', '10:00:00')));
      const { status, stdout, stderr, lines } = run(['--since', '2026-10-13', '--until', '2026-10-14']);
      expect(status, stdout + stderr).toBe(0);
      const [day] = lines['2026-10.jsonl'];
      expect(day.totalCommits).toBe(4);
      expect(Object.keys(day.byType).sort()).toEqual([...types].sort());
      types.forEach((type, at) => expect(day.byType[type].map((each) => each.fullSha), type).toEqual([shas[at]]));
    });
  });

  it('fails, recording nothing, when git cannot read the history', () => {
    withRepository(({ root, run }) => {
      const { status, lines } = run(['--since', '2026-10-13', '--until', '2026-10-16'], { cwd: root });
      expect(status).not.toBe(0);
      expect(lines).toEqual({});
    });
  });

  it.each([
    ['--since', 'yesterday'],
    ['--until', '2026-13-45'],
  ])('stops, recording nothing, at a day not written YYYY-MM-DD (%s %s)', (option, value) => {
    withRepository(({ commit, run }) => {
      commit('docs: a commit', utc('2026-10-13', '10:00:00'));
      const args = option === '--since' ? ['--since', value, '--until', '2026-10-16'] : ['--since', '2026-10-13', '--until', value];
      const { status, lines } = run(args);
      expect(status).not.toBe(0);
      expect(lines).toEqual({});
    });
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

  // The git log and the activity cover the same days: the run's days reach both scripts from one step, as environment
  // variables, never pasted into the script.
  it('hands both scripts the days one step picks, and runs them before the pull request', () => {
    const window = byId('window');
    expect(window, 'a step with id window').toBeDefined();
    const gitLog = running(GIT_LOG);
    const activity = running(ACTIVITY);
    for (const step of [gitLog, activity]) {
      expect(step?.env?.SINCE).toBe('${{ steps.window.outputs.since }}');
      expect(step?.env?.UNTIL).toBe('${{ steps.window.outputs.until }}');
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

describe('the days a run records, and the entries an open changelog pull request carries', () => {
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

  // Each script starts after the last day it recorded, so the schedule names no first day; the run records the days
  // before the one it runs on, so a later run never finds a day half recorded.
  it("leaves the first day to the scripts on the schedule, and ends the run's days at the day it runs on, in UTC", () => {
    const before = new Date().toISOString().slice(0, 10);
    const { status, output, stdout, stderr } = runStep(byId('window'), { env: { SINCE_INPUT: '' } });
    const after = new Date().toISOString().slice(0, 10);
    expect(status, stdout + stderr).toBe(0);
    expect([before, after].map((day) => `since=\nuntil=${day}\n`)).toContain(output);
  });

  it('starts on the day a manual run names', () => {
    const { status, output } = runStep(byId('window'), { env: { SINCE_INPUT: '2026-09-01' } });
    expect(status).toBe(0);
    expect(output).toMatch(/^since=2026-09-01\nuntil=\d{4}-\d{2}-\d{2}\n$/);
  });

  // A stand-in node that writes each argument it was given on a line of its own, so a step's script runs as the runner
  // runs it, without either history script.
  const withStandInNode = (body) => {
    const dir = scratch('changelog-node-');
    try {
      const bin = path.join(dir, 'bin');
      const args = path.join(dir, 'args');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'node'), `#!/bin/sh\nfor arg in "$@"; do printf '%s\\n' "$arg"; done > '${args}'\n`, {
        mode: 0o755,
      });
      const given = () => (fs.existsSync(args) ? fs.readFileSync(args, 'utf8').split('\n').filter(Boolean) : null);
      return body({ PATH: `${bin}${path.delimiter}${process.env.PATH}`, given });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it.each([
    ['the schedule', '', ['--until', '2026-10-26']],
    ['a manual run that names one', '2026-09-01', ['--until', '2026-10-26', '--since', '2026-09-01']],
  ])('hands each script the day the run ends at, and the first day only when a manual run names one (%s)', (_what, since, expected) => {
    withStandInNode(({ PATH, given }) => {
      for (const [script, extra] of [
        [GIT_LOG, {}],
        [ACTIVITY, { GH_PAT: 'a-token' }],
      ]) {
        const { status, stdout, stderr } = runStep(running(script), { env: { PATH, SINCE: since, UNTIL: '2026-10-26', ...extra } });
        expect(status, stdout + stderr).toBe(0);
        expect(given()).toEqual([script, ...expected]);
      }
    });
  });

  it('records no activity without GH_PAT, and says so', () => {
    withStandInNode(({ PATH, given }) => {
      const { status, stdout } = runStep(running(ACTIVITY), { env: { PATH, SINCE: '', UNTIL: '2026-10-26', GH_PAT: '' } });
      expect(status).toBe(0);
      expect(given()).toBeNull();
      expect(stdout).toMatch(/^::warning::GH_PAT /m);
    });
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
