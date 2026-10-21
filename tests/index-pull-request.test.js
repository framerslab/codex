/**
 * The search index reaches master through a pull request.
 *
 * master is protected: its required checks must pass before a change lands there, administrators included, and a commit
 * can be pushed to it only once they have passed ("About protected branches", Require status checks before merging:
 * https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging).
 * A commit a job makes has no checks, so auto-index.yml's publish job no longer pushes the index to master: it opens or
 * updates one pull request into master from ci/codex-index carrying the four files its build job archived. It pushes and
 * opens that pull request with FRAMERS_BUMP_TOKEN, as the weekly bump does, so the pull request's own events start Test
 * Suite and rename-guard (tests/bump-framers-deps.test.js quotes GitHub's rule), and landing-follows-the-bump-checks.yml
 * labels it landing once both pass on its head.
 *
 * The publish job runs only on master, so GitHub reports a broken publish job only after a merge. These tests parse the
 * workflow, run its first step's shell with the secret empty and set, run its ordering step in scratch repositories, and
 * read the token, the permissions, the commit message and the paths it commits.
 *
 * Run: npx vitest run tests/index-pull-request.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync, spawnSync } = require('child_process');

const INDEX = '.github/workflows/auto-index.yml';
const BUMP = '.github/workflows/bump-framers-deps.yml';
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const text = read(INDEX);
const workflow = yaml.load(text);
const build = workflow.jobs['build-index'];
const publish = workflow.jobs['publish-artifacts'];
const stepUsing = (steps, action) => steps.find((step) => String(step.uses).startsWith(`${action}@`));
const create = () => stepUsing(publish.steps, 'peter-evans/create-pull-request');
const order = () => publish.steps.find((step) => step.id === 'order');
// An action input that lists paths, one a line (create-pull-request also splits on commas).
const listed = (value) =>
  String(value ?? '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

describe('the index publish job opens a pull request into master, and pushes nothing to master', () => {
  it('is valid YAML whose every run block passes bash -n', () => {
    const blocks = [...build.steps, ...publish.steps]
      .filter((step) => step.run)
      .map((step) => step.run.replace(/\$\{\{[^}]*\}\}/g, 'X'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(() => execFileSync('bash', ['-n'], { input: block, stdio: ['pipe', 'pipe', 'pipe'] })).not.toThrow();
    }
  });

  it('runs no git push or git commit of its own', () => {
    const runs = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .filter((step) => step.run);
    for (const step of runs) expect(step.run, step.name).not.toMatch(/\bgit\s+(push|commit)\b/);
  });

  it('opens or updates one pull request into master from ci/codex-index with FRAMERS_BUMP_TOKEN, and labels nothing itself', () => {
    const step = create();
    expect(step, 'a create-pull-request step in the publish job').toBeDefined();
    expect(step.with.token).toBe('${{ secrets.FRAMERS_BUMP_TOKEN }}');
    // branch-token defaults to token, so the branch is pushed with the same token.
    expect(step.with).not.toHaveProperty('branch-token');
    expect(step.with.base).toBe('master');
    expect(step.with.branch).toBe('ci/codex-index');
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

  it("keeps both jobs' GITHUB_TOKEN read-only, so nothing can push to master or open a pull request with it", () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    for (const [id, job] of Object.entries(workflow.jobs)) expect(job.permissions, id).toBeUndefined();
  });

  it('stops at its first step, with an error annotation, when the secret is empty', () => {
    const [first] = publish.steps;
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

  it('publishes from master only, the branch its pull request goes into', () => {
    expect(publish.if).toBe("github.ref == 'refs/heads/master'");
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

  // create-pull-request stages add-paths with one git add, which stages nothing when one path matches no file; each of
  // the four is tracked, so it is in the checkout even when the build archived no new copy of it.
  it('commits exactly the files the build job archives, each tracked here', () => {
    const upload = stepUsing(build.steps, 'actions/upload-artifact');
    const download = stepUsing(publish.steps, 'actions/download-artifact');
    expect(download.with.name).toBe(upload.with.name);
    const archived = listed(upload.with.path).sort();
    expect(archived).toEqual(['codex-blocks.json', 'codex-index.json', 'codex-report.json', 'codex-search.json']);
    expect(listed(create()?.with['add-paths']).sort()).toEqual(archived);
    const tracked = execFileSync('git', ['ls-files', '--', ...archived], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .sort();
    expect(tracked).toEqual(archived);
  });

  it('publishes one run at a time and never cancels one that started, so two runs never push the branch at once', () => {
    expect(publish.concurrency?.group).toBeTruthy();
    expect(publish.concurrency?.['cancel-in-progress']).toBe(false);
  });
});

describe("a run leaves the index pull request to the run of a later change to the index's inputs", () => {
  it('compares the paths whose change starts this workflow, and gates the download and the pull request on that', () => {
    const step = order();
    expect(step, 'a step with id order').toBeDefined();
    for (const entry of workflow.on.push.paths) expect(step.run).toContain(entry.replace(/\/\*\*$/, ''));
    const download = stepUsing(publish.steps, 'actions/download-artifact');
    expect(download.if).toBe("steps.order.outputs.later == 'false'");
    expect(create().if).toBe("steps.order.outputs.later == 'false'");
    // It reads the checkout, and runs before the download and the pull request it gates.
    const at = (each) => publish.steps.indexOf(each);
    expect(at(stepUsing(publish.steps, 'actions/checkout'))).toBeLessThan(at(step));
    expect(at(step)).toBeLessThan(at(download));
    expect(at(download)).toBeLessThan(at(create()));
  });

  // origin holds master. The run's checkout holds the run's commit at depth 1, as actions/checkout leaves it; then master
  // takes the change (or none), and the step runs in the checkout with the run's commit as GITHUB_SHA.
  const runOrder = (change) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'index-order-'));
    const git = (cwd, ...args) => {
      const res = spawnSync(
        'git',
        ['-c', 'user.name=index', '-c', 'user.email=index@example.invalid', '-c', 'commit.gpgsign=false', ...args],
        { cwd, encoding: 'utf8' }
      );
      if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
      return res.stdout.trim();
    };
    const write = (file, content) => {
      fs.mkdirSync(path.dirname(path.join(root, 'work', file)), { recursive: true });
      fs.writeFileSync(path.join(root, 'work', file), content);
    };
    const land = (message, files) => {
      for (const [file, content] of Object.entries(files)) write(file, content);
      git(path.join(root, 'work'), 'add', '--all');
      git(path.join(root, 'work'), 'commit', '--quiet', '-m', message);
      git(path.join(root, 'work'), 'push', '--quiet', 'origin', 'master');
    };
    try {
      const origin = path.join(root, 'origin.git');
      git(root, 'init', '--quiet', '--bare', origin);
      fs.mkdirSync(path.join(root, 'work'));
      git(path.join(root, 'work'), 'init', '--quiet');
      git(path.join(root, 'work'), 'symbolic-ref', 'HEAD', 'refs/heads/master');
      git(path.join(root, 'work'), 'remote', 'add', 'origin', `file://${origin}`);
      land('the run commit', {
        'weaves/frame/strand.md': 'a strand\n',
        'scripts/auto-index.js': 'an indexer\n',
        'schema/strand.schema.yaml': 'a schema\n',
        '.github/workflows/auto-index.yml': 'this workflow\n',
        'README.md': 'a readme\n',
        'codex-index.json': '[]\n',
      });
      const sha = git(path.join(root, 'work'), 'rev-parse', 'HEAD');
      git(root, 'clone', '--quiet', '--depth=1', '--branch', 'master', `file://${origin}`, 'checkout');
      change(land);
      const output = path.join(root, 'output');
      fs.writeFileSync(output, '');
      const res = spawnSync('bash', ['-e', '-c', order().run], {
        cwd: path.join(root, 'checkout'),
        env: { PATH: process.env.PATH, HOME: root, GITHUB_SHA: sha, GITHUB_OUTPUT: output },
        encoding: 'utf8',
      });
      expect(res.status, res.stdout + res.stderr).toBe(0);
      return { output: fs.readFileSync(output, 'utf8'), stdout: res.stdout };
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  it.each([
    ['a strand under weaves/', 'weaves/frame/strand.md'],
    ['a script under scripts/', 'scripts/auto-index.js'],
    ['a schema under schema/', 'schema/strand.schema.yaml'],
    ['this workflow', '.github/workflows/auto-index.yml'],
  ])("leaves the pull request when master changed %s after the run's commit", (_what, file) => {
    const { output, stdout } = runOrder((land) => land('a later change', { [file]: 'changed\n' }));
    expect(output).toContain('later=true');
    expect(output).not.toContain('later=false');
    expect(stdout).toMatch(/^::notice::/m);
  });

  it.each([
    ["master is still at the run's commit", () => {}],
    ['master changed only the README', (land) => land('docs', { 'README.md': 'changed\n' })],
    ['master took an index pull request', (land) => land('the index', { 'codex-index.json': '[1]\n' })],
    [
      'master changed a strand and changed it back',
      (land) => {
        land('a change', { 'weaves/frame/strand.md': 'changed\n' });
        land('the change undone', { 'weaves/frame/strand.md': 'a strand\n' });
      },
    ],
  ])('publishes when %s', (_what, change) => {
    const { output } = runOrder(change);
    expect(output).toContain('later=false');
    expect(output).not.toContain('later=true');
  });
});
