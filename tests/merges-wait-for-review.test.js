/**
 * Pull requests land only after their reviews and comments are read, answered and resolved, so nothing in this
 * repository merges a pull request by itself or arms GitHub's auto-merge. The flows that would otherwise merge (inbox
 * categorization at 70 percent confidence or more, the re-catalog script when landing is requested) keep their guards,
 * label the pull request `landing` and post one comment; a maintainer lands it after the comment pass. A change of base
 * takes the label off, since the guards ran against the old base.
 *
 * Besides scanning the workflow and script text, these tests run the code the flows run: the github-script step of the
 * Landing follows the base workflow against a stand-in for the GitHub API, and the inbox workflow's shell step and the
 * re-catalog script in a scratch git repository, with stand-ins for gh, curl and npm first on the PATH.
 *
 * Run: npx vitest run tests/merges-wait-for-review.test.js
 */

import { describe, it, expect, afterAll } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const yaml = require('js-yaml');
const { execFileSync, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// Every file under dir, at any depth, whose name ends with one of the extensions.
const listFiles = (dir, extensions) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(rel, extensions);
    return extensions.some((ext) => entry.name.endsWith(ext)) ? [rel] : [];
  });
};

// Comment lines (YAML, shell, Python, JavaScript) may describe the rule; only code lines are checked.
const codeLines = (text) =>
  text
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => !/^\s*(#|\/\/)/.test(line));
const code = (rel) => codeLines(read(rel)).map(({ line }) => line).join('\n');

const CODE = ['.yml', '.yaml', '.py', '.sh', '.js', '.mjs', '.cjs', '.ts'];
const files = [...listFiles('.github', CODE), ...listFiles('scripts', CODE), ...listFiles('lib', CODE)];

const MERGE_CALLS = [
  ['gh pr merge', /\bgh\s+pr\s+merge\b/],
  ['the REST merge endpoint', /\/pulls\/[^\s'"]+\/merge\b/],
  ['Octokit pulls.merge', /\bpulls\.merge\s*\(/],
  ['the GraphQL auto-merge mutation', /enablePullRequestAutoMerge/],
  ['a merge action', /automerge-action|enable-pull-request-automerge|merge-pull-request-action/i],
];

describe('nothing merges a pull request by itself', () => {
  it('scans every workflow and script, in nested folders too', () => {
    expect(files).toContain('.github/workflows/auto-categorize-inbox.yml');
    expect(files).toContain('.github/workflows/landing-follows-the-base.yml');
    expect(files).toContain('.github/scripts/bump-framers-deps.py');
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
    ['scripts/retrigger-full-catalog.sh', [/"\$AUTO_LAND" = "true"/, /npm run index -- --validate/]],
  ])('%s', (rel, guards) => {
    const text = code(rel);
    for (const guard of guards) expect(text).toMatch(guard);
    expect(text).toMatch(LANDING_LABEL);
    expect(text).toMatch(COMMENT);
  });
});

// The github-script step of the Landing follows the base workflow runs here as the body of an async function, the way
// actions/github-script runs it, against a stand-in for the GitHub API that holds one pull request's labels and comments.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const MARKER = '<!-- landing-guards -->';
const PR = 9;
const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

const githubScript = (rel, job, call) => {
  const step = (yaml.load(read(rel)).jobs[job]?.steps ?? []).find(
    (s) => String(s.uses).startsWith('actions/github-script@') && String(s.with?.script).includes(call)
  );
  if (!step) throw new Error(`${rel}: job ${job} has no github-script step that calls ${call}`);
  return step.with.script;
};
const run = (script, { github, context }) =>
  new AsyncFunction('github', 'context', 'core', script)(github, context, { info() {}, warning() {} });
const guardsComment = (sha) => ({ body: `${MARKER}\nGuards passed on ${sha.slice(0, 7)}:` });

// A review bot can quote the marker inside a comment of its own, as one did on the pull request that added these flows.
const quoting = {
  user: { type: 'Bot', login: 'qodo-free-for-open-source-projects[bot]' },
  body: `Find the bot comment that contains \`${MARKER}\` and update it.`,
};

// A comment written with the workflow token is github-actions[bot]'s, and that token edits no other author's comment.
const ACTIONS_BOT = { type: 'Bot', login: 'github-actions[bot]' };
const fakeGitHub = ({ labels = [], comments = [] } = {}) => {
  const state = {
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
      issues: {
        removeLabel: api('issues.removeLabel', ({ name }) => {
          if (!state.labels.delete(name)) throw fail(404, 'Label does not exist');
          return [];
        }),
        listComments: api('issues.listComments', () => state.comments),
        createComment: api('issues.createComment', ({ body }) => {
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

// A change of base starts the Landing follows the base workflow on a pull request into any branch: with no branch
// filter, a retarget away from master starts it too. Its job runs only when the edit changed the base.
describe('a change of base takes the landing label off, whichever flow added it', () => {
  const BASE_FLOW = '.github/workflows/landing-follows-the-base.yml';
  const JOB = 'clear-landing-on-base-change';
  const edited = ({ from = 'master', to = 'index', labels = ['landing'] } = {}) => ({
    repo: { owner: 'framerslab', repo: 'codex' },
    payload: {
      action: 'edited',
      changes: { base: { ref: { from }, sha: { from: OLD } } },
      pull_request: { number: PR, head: { sha: NEW }, base: { ref: to }, labels: labels.map((name) => ({ name })) },
    },
  });
  const clear = (github, context) => run(githubScript(BASE_FLOW, JOB, 'removeLabel'), { github, context });

  it('starts on every edit of a pull request into any branch, and runs its job only when the base changed', () => {
    const workflow = yaml.load(read(BASE_FLOW));
    expect(workflow.on).toEqual({ pull_request: { types: ['edited'] } });
    expect(workflow.jobs[JOB].if).toBe('github.event.changes.base');
  });

  it('gives its one job a token that writes labels and comments, and checks out no code', () => {
    const { permissions, jobs } = yaml.load(read(BASE_FLOW));
    expect(permissions).toEqual({ contents: 'read' });
    expect(Object.keys(jobs)).toEqual([JOB]);
    expect(jobs[JOB].permissions).toEqual({ issues: 'write', 'pull-requests': 'write' });
    expect(jobs[JOB].steps.some((step) => String(step.uses).startsWith('actions/checkout@'))).toBe(false);
  });

  it('takes the label off and says in the guards comment which base its guards ran against', async () => {
    const { github, state } = fakeGitHub({ labels: ['landing'], comments: [quoting, guardsComment(NEW)] });
    await clear(github, edited());
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments).toHaveLength(2);
    expect(state.comments[0].body).toBe(quoting.body);
    expect(state.comments[1].body.startsWith(MARKER)).toBe(true);
    expect(state.comments[1].body).toContain('from `master` to `index`');
  });

  it('writes a guards comment on a pull request whose flow left none with the marker, such as an inbox move', async () => {
    const { github, state } = fakeGitHub({ labels: ['landing'] });
    await clear(github, edited({ from: 'index', to: 'master' }));
    expect(state.labels.has('landing')).toBe(false);
    expect(state.comments).toHaveLength(1);
    expect(state.comments[0].body.startsWith(MARKER)).toBe(true);
    expect(state.comments[0].body).toContain('from `index` to `master`');
  });

  it('leaves a pull request that carried no landing label alone', async () => {
    const { github, calls } = fakeGitHub();
    await clear(github, edited({ labels: [] }));
    expect(calls).toEqual([]);
  });

  it('writes nothing more when the label was already taken off', async () => {
    const { github, state, calls } = fakeGitHub({ comments: [guardsComment(NEW)] });
    await clear(github, edited());
    expect(calls).toEqual(['issues.removeLabel']);
    expect(state.comments[0].body).toContain('Guards passed on bbbbbbb');
  });
});

// The inbox workflow and the re-catalog script run in a scratch git repository with a bare origin. A bin folder first
// on the PATH holds stand-ins for gh, curl and npm that log every call to calls.jsonl, so the tests read which GitHub
// calls each flow made.
const scratchDirs = [];
afterAll(() => {
  for (const dir of scratchDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const scratch = (branch) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-'));
  scratchDirs.push(dir);
  const repo = path.join(dir, 'repo');
  const origin = path.join(dir, 'origin.git');
  const bin = path.join(dir, 'bin');
  const log = path.join(dir, 'calls.jsonl');
  fs.mkdirSync(repo);
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, 'gitconfig'), '');
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    CALL_LOG: log,
    GIT_CONFIG_GLOBAL: path.join(dir, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  const git = (...args) => execFileSync('git', args, { cwd: repo, env, stdio: 'pipe', encoding: 'utf8' });
  execFileSync('git', ['init', '--quiet', '--bare', '-b', branch, origin], { env, stdio: 'pipe' });
  git('init', '--quiet', '-b', branch);
  git('remote', 'add', 'origin', origin);
  return {
    dir,
    repo,
    origin,
    env,
    git,
    stub: (name, source) => fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${source}`, { mode: 0o755 }),
    write: (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
      fs.writeFileSync(path.join(repo, rel), text);
    },
    calls: () =>
      fs.existsSync(log)
        ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
        : [],
  };
};

const GH_STUB = `
// Stands in for gh: logs the call, fails the calls GH_FAIL names, and answers what the inbox step reads.
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify(['gh', ...args]) + '\\n');
const failing = (process.env.GH_FAIL || '').split(',').filter(Boolean);
if (failing.some((part) => args.join(' ').includes(part))) process.exit(1);
if (args[0] === 'pr' && args[1] === 'create') console.log('https://github.com/framerslab/codex/pull/12');
if (args[0] === 'pr' && args[1] === 'list') console.log('12');
`;

const CURL_STUB = `
// Stands in for curl: logs the call and answers the GitHub API calls the re-catalog script makes.
const fs = require('fs');
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const method = flag('-X') || 'GET';
const url = args.find((arg) => arg.startsWith('https://'));
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({ method, url, data: flag('-d') }) + '\\n');
const api = 'https://api.github.com/repos/framerslab/codex';
let reply = {};
if (method === 'POST' && url === api + '/pulls') reply = { number: 7, html_url: 'https://github.com/framerslab/codex/pull/7' };
if (method === 'POST' && url === api + '/issues/7/labels') reply = [{ name: 'landing' }];
if (method === 'POST' && url === api + '/issues/7/comments') reply = process.env.COMMENT_FAILS ? { message: 'Validation Failed' } : { id: 5 };
const out = flag('-o');
if (out) fs.writeFileSync(out, JSON.stringify(reply));
else process.stdout.write(JSON.stringify(reply));
`;

const NPM_STUB = `
// Stands in for npm run index: writes the index and the report the re-catalog script reads.
const fs = require('fs');
const args = process.argv.slice(2);
if (args[0] !== 'run' || args[1] !== 'index') {
  console.error('unexpected npm call: ' + args.join(' '));
  process.exit(1);
}
fs.writeFileSync('codex-index.json', JSON.stringify([{ path: 'weaves/a.md' }]) + '\\n');
fs.writeFileSync('codex-report.json', JSON.stringify({ summary: JSON.parse(process.env.FAKE_SUMMARY) }) + '\\n');
`;

describe('the inbox workflow labels a confident move landing with one comment, and merges nothing', () => {
  const ISSUE = 'repos/framerslab/codex/issues/12';
  const LABEL = ['gh', 'api', '-X', 'POST', `${ISSUE}/labels`, '--silent', '-f', 'labels[]=landing'];
  const UNLABEL = ['gh', 'api', '-X', 'DELETE', `${ISSUE}/labels/landing`, '--silent'];
  const processStep = () =>
    yaml
      .load(read('.github/workflows/auto-categorize-inbox.yml'))
      .jobs.categorize.steps.find((step) => String(step.run).includes('gh pr create')).run;

  const categorize = ({ confidence, ghFail = '' }) => {
    const box = scratch('master');
    box.stub('gh', GH_STUB);
    box.write('weaves/inbox/note.md', '# Note\n');
    box.git('add', '-A');
    box.git('commit', '--quiet', '-m', 'start');
    box.git('push', '--quiet', 'origin', 'master');
    box.write(
      '.categorization-results/note.json',
      JSON.stringify({
        action: 'auto-move',
        method: 'static',
        suggestion: { path: 'weaves/tech/note.md', confidence, reasoning: 'a note about tech' },
      })
    );
    const step = path.join(box.dir, 'process-results.sh');
    fs.writeFileSync(step, processStep());
    // A run step that names no shell runs under bash -e.
    const result = spawnSync('bash', ['-e', step], {
      cwd: box.repo,
      encoding: 'utf8',
      env: {
        ...box.env,
        GH_TOKEN: 'test-token',
        GITHUB_REPOSITORY: 'framerslab/codex',
        FILES_TO_PROCESS: 'weaves/inbox/note.md',
        GH_FAIL: ghFail,
      },
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    return { box, calls: box.calls() };
  };

  it('moves the file in a pull request, labels it at 70 percent or more and names the guards in one comment', () => {
    const { box, calls } = categorize({ confidence: 0.85 });
    expect(calls.find((call) => call[1] === 'pr' && call[2] === 'create')).toEqual(
      expect.arrayContaining(['--base', 'master'])
    );
    expect(calls).toContainEqual(LABEL);
    const comments = calls.filter((call) => call.includes(`${ISSUE}/comments`));
    expect(comments).toHaveLength(1);
    expect(comments[0].at(-1)).toMatch(
      /^body=Guards passed: the categorizer chose auto-move to `weaves\/tech\/note\.md` at 85% confidence/
    );
    expect(calls).not.toContainEqual(UNLABEL);
    expect(calls.some((call) => call.includes('merge'))).toBe(false);

    const branch = execFileSync(
      'git',
      ['--git-dir', box.origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/auto-categorize/'],
      { env: box.env, encoding: 'utf8' }
    ).trim();
    const moved = execFileSync('git', ['--git-dir', box.origin, 'ls-tree', '-r', '--name-only', branch], {
      env: box.env,
      encoding: 'utf8',
    });
    expect(moved.split('\n')).toContain('weaves/tech/note.md');
  });

  it('takes the label off again when the comment cannot be posted', () => {
    const { calls } = categorize({ confidence: 0.85, ghFail: `${ISSUE}/comments` });
    const comment = calls.findIndex((call) => call.includes(`${ISSUE}/comments`));
    expect(comment).toBeGreaterThan(calls.findIndex((call) => call.includes(`${ISSUE}/labels`)));
    expect(calls.slice(comment + 1)).toContainEqual(UNLABEL);
  });

  it('leaves a move under 70 percent unlabelled, for a manual review', () => {
    const { calls } = categorize({ confidence: 0.5 });
    expect(calls.some((call) => call[1] === 'pr' && call[2] === 'create')).toBe(true);
    expect(calls).not.toContainEqual(LABEL);
    expect(calls.some((call) => call.includes(`${ISSUE}/comments`))).toBe(false);
  });
});

describe('the re-catalog script labels its pull request landing only when the indexer skipped no file', () => {
  const API = 'https://api.github.com/repos/framerslab/codex';
  const LANDED = [`POST ${API}/pulls`, `POST ${API}/labels`, `POST ${API}/issues/7/labels`, `POST ${API}/issues/7/comments`];

  const recatalog = ({ skipped = 0, land = 'true', commentFails = false } = {}) => {
    const box = scratch('master');
    box.stub('curl', CURL_STUB);
    box.stub('npm', NPM_STUB);
    box.write('package.json', '{ "private": true }\n');
    box.write('weaves/a.md', '# A\n');
    box.write('codex-index.json', '[]\n');
    box.write('codex-report.json', '{}\n');
    box.write('.gitignore', 'node_modules/\n');
    fs.mkdirSync(path.join(box.repo, 'node_modules'));
    box.git('add', '-A');
    box.git('commit', '--quiet', '-m', 'start');
    box.git('push', '--quiet', 'origin', 'master');
    const summary = { totalFiles: 3, indexedFiles: 3 - skipped, skippedFiles: skipped, validFiles: 3 - skipped, filesWithErrors: 0 };
    const result = spawnSync('bash', [path.join(root, 'scripts/retrigger-full-catalog.sh')], {
      cwd: box.repo,
      encoding: 'utf8',
      env: {
        ...box.env,
        GH_PAT: 'test-token',
        AUTO_CATALOG_LAND: land,
        AUTO_CATALOG_MERGE: '',
        FAKE_SUMMARY: JSON.stringify(summary),
        COMMENT_FAILS: commentFails ? '1' : '',
      },
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const calls = box.calls();
    return {
      output: result.stdout,
      calls,
      requests: calls.map(({ method, url }) => `${method} ${url}`),
      // The branch the script leaves checked out.
      branch: box.git('rev-parse', '--abbrev-ref', 'HEAD').trim(),
    };
  };

  // master is the only branch: the pull request goes into it, and the script checks it out again at the end.
  it('opens its pull request into master and checks master out again', () => {
    const { calls, branch } = recatalog({ land: 'false' });
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].data).base).toBe('master');
    expect(branch).toBe('master');
  });

  it('labels the pull request and names the guards in one comment', () => {
    const { calls, requests } = recatalog();
    expect(requests).toEqual(LANDED);
    expect(JSON.parse(calls[2].data)).toEqual({ labels: ['landing'] });
    expect(JSON.parse(calls[3].data).body).toMatch(/^Guards passed: .* skipped no file/);
  });

  it('leaves the label off when the indexer skipped a file', () => {
    const { output, requests } = recatalog({ skipped: 1 });
    expect(requests).toEqual([`POST ${API}/pulls`]);
    expect(output).toContain('skipped 1 file');
  });

  it('takes the label off again when the comment cannot be posted', () => {
    const { requests } = recatalog({ commentFails: true });
    expect(requests).toEqual([...LANDED, `DELETE ${API}/issues/7/labels/landing`]);
  });

  it('adds no label unless landing is requested', () => {
    const { requests } = recatalog({ land: 'false' });
    expect(requests).toEqual([`POST ${API}/pulls`]);
  });
});

// GitHub reports a broken workflow file only when an event would start it, and the base workflow starts only on a
// change of base, so the changed files are parsed here: the YAML, every shell `run:` block and the re-catalog script
// (bash -n), and every actions/github-script body (compiled the way the action wraps it, as an async function).
describe('the changed workflows and script parse', () => {
  const INBOX = '.github/workflows/auto-categorize-inbox.yml';
  const BASE_FLOW = '.github/workflows/landing-follows-the-base.yml';
  const CHANGED_WORKFLOWS = [INBOX, BASE_FLOW];
  const withoutExpressions = (source) => source.replace(/\$\{\{[^}]*\}\}/g, 'X');
  const steps = (rel) => Object.values(yaml.load(read(rel)).jobs).flatMap((job) => job.steps ?? []);
  const bashSyntax = (source) => execFileSync('bash', ['-n'], { input: source, stdio: ['pipe', 'pipe', 'pipe'] });

  it.each(CHANGED_WORKFLOWS)('%s is valid YAML with jobs and steps', (rel) => {
    const workflow = yaml.load(read(rel));
    expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
    for (const job of Object.values(workflow.jobs)) expect(job.steps.length).toBeGreaterThan(0);
  });

  it.each([INBOX])('every run block of %s passes bash -n', (rel) => {
    const blocks = steps(rel).filter((step) => step.run).map((step) => withoutExpressions(step.run));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(() => bashSyntax(block)).not.toThrow();
  });

  it.each([BASE_FLOW])('every github-script body of %s compiles', (rel) => {
    const scripts = steps(rel)
      .filter((step) => String(step.uses).startsWith('actions/github-script@'))
      .map((step) => withoutExpressions(step.with.script));
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(() => new vm.Script(`(async () => {\n${script}\n})`)).not.toThrow();
  });

  it('the re-catalog script passes bash -n', () => {
    expect(() => bashSyntax(read('scripts/retrigger-full-catalog.sh'))).not.toThrow();
  });
});
