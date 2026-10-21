/**
 * CodeRabbit leaves the search index's pull request alone.
 *
 * auto-index.yml opens a pull request from ci/codex-index after each push to master that changes the index's inputs,
 * carrying only the index files its build job archives. CodeRabbit counts a review event each time it evaluates a pull
 * request, against an allowance for each developer, and the index pull request is opened with FRAMERS_BUMP_TOKEN, a
 * person's token, so each one spent a review of that person's allowance, which was one an hour on 21 October 2026. A pull
 * request the automatic review controls exclude draws nothing from it ("Review rate limits", What counts as a review
 * event, https://docs.coderabbit.ai/management/rate-limits).
 *
 * .coderabbit.yaml, which CodeRabbit reads from the repository's root, skips the index pull request by its title with
 * reviews.auto_review.ignore_title_keywords ("Skip reviews when the PR title contains any of these keywords
 * (case-insensitive)") and leaves the index files out of every review with reviews.path_filters (a pattern that starts
 * with ! excludes), both from CodeRabbit's configuration reference (https://docs.coderabbit.ai/reference/configuration)
 * and its schema (https://coderabbit.ai/integrations/schema.v2.json). These tests read the configuration beside the
 * workflows, so a change to the index pull request's title or files that the configuration does not follow fails here.
 *
 * Run: npx vitest run tests/coderabbit-config.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const INDEX = 'auto-index.yml';
const config = () => yaml.load(fs.readFileSync(path.join(ROOT, '.coderabbit.yaml'), 'utf8'));
// Every pull request a workflow opens, by the workflow's file.
const pullRequests = () =>
  fs
    .readdirSync(WORKFLOWS)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((name) =>
      Object.values(yaml.load(fs.readFileSync(path.join(WORKFLOWS, name), 'utf8')).jobs ?? {}).flatMap(({ steps = [] }) =>
        steps.filter((step) => String(step.uses).startsWith('peter-evans/create-pull-request@')).map((step) => ({ name, inputs: step.with }))
      )
    );
const index = () => pullRequests().find(({ name }) => name === INDEX).inputs;
// An action input that lists paths, one a line (create-pull-request also splits on commas).
const listed = (value) =>
  String(value ?? '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

describe('CodeRabbit skips the index pull request, and reviews none of the files the index publish commits', () => {
  it('sets only the two documented keys it needs, and leaves every other setting at its default', () => {
    const { reviews, ...rest } = config();
    expect(rest).toEqual({});
    expect(Object.keys(reviews).sort()).toEqual(['auto_review', 'path_filters']);
    expect(Object.keys(reviews.auto_review)).toEqual(['ignore_title_keywords']);
  });

  it("skips the pull request by a keyword of the title auto-index.yml gives it, which no other workflow's pull request title holds", () => {
    const keywords = config().reviews.auto_review.ignore_title_keywords;
    expect(keywords.length).toBeGreaterThan(0);
    const skipped = (title) => keywords.some((keyword) => String(title).toLowerCase().includes(String(keyword).toLowerCase()));
    expect(skipped(index().title)).toBe(true);
    const others = pullRequests().filter(({ name }) => name !== INDEX);
    expect(others.length).toBeGreaterThan(0);
    for (const { name, inputs } of others) expect(skipped(inputs.title), name).toBe(false);
  });

  it('leaves every file the index publish commits out of a review, and excludes nothing else', () => {
    const filters = config().reviews.path_filters;
    const files = listed(index()['add-paths']);
    expect(files.length).toBeGreaterThan(0);
    expect([...filters].sort()).toEqual(files.map((file) => `!${file}`).sort());
  });
});
