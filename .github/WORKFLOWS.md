# Codex GitHub Actions Workflows

## Overview

The Codex repository uses several GitHub Actions workflows for automated content validation, AI enhancement, indexing, and deployment. All workflows are designed with async processing, caching, and graceful error handling.

## Workflow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PR Created    │───▶│  Quick Validate │───▶│    AI Enhance   │
│   or Updated    │    │    (< 30s)      │    │    (async)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Schema Validate │    │  Post Feedback  │
                       └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Incremental     │
                       │ Index + Cache   │
                       └─────────────────┘
                              │
                              ▼ (on merge)
                       ┌─────────────────┐
                       │ Publish Index   │
                       │ + Notify        │
                       └─────────────────┘
```

## Workflows

### 1. `async-processing.yml` (Primary)

**Triggers:**
- Pull requests (opened, synchronized, ready_for_review)
- Push to main branch
- Manual dispatch with optional full reindex

**Features:**
- ⚡ Quick validation stage (< 30s)
- 🔄 Async AI enhancement (non-blocking)
- 📦 Incremental indexing with SQLite cache
- 🔔 Real-time status updates via commit statuses
- 🚀 Triggers frame.dev deployment on publish

**Optimizations:**
- Concurrency groups prevent duplicate runs
- Cache restoration for faster builds
- Parallel job execution where possible

### 2. `auto-index.yml`

**Triggers:**
- Push to `weaves/`, `scripts/`, `schema/`
- Manual dispatch
- Repository dispatch (frame-deploy-complete)

**Purpose:**
Builds and publishes the search index JSON files.

### 3. `ai-enhance-pr.yml`

**Triggers:**
- Pull requests (opened, synchronized)

**Purpose:**
AI-powered content analysis and suggestions:
- Quality scoring
- Auto-tag detection
- Readability analysis
- Safe auto-fixes (with `auto-enhance` label)

**Skipping:**
- Add `skip-ai` label to skip AI analysis
- Dependabot PRs are automatically skipped

### 4. `auto-merge-weavers.yml` (Trusted Weavers)

**Triggers:**
- Pull requests into `main` (opened, synchronized, reopened)

**Purpose:**
Approval and the `landing` label for trusted contributors:
- Checks the author against `.github/WEAVERS.txt` as it reads on the base branch, so a pull request cannot add its own author
- Runs schema validation, the indexer's quality checks and the duplicate check
- When the checks pass, and the pull request still has the head they ran on and still targets `main`, approves that commit, adds the `landing` label and keeps one comment naming the guards that passed; it reads the pull request again once the label is on and takes the label back off if the head or the base moved meanwhile
- A push that moves the head, or a reopen, takes the label off until the checks pass on the head; a head whose checks fail keeps it off, and the guards comment says so; a change of base takes it off through `landing-follows-the-base.yml`
- Runs one at a time per pull request: a newer push cancels the older run
- Only the jobs that write labels and comments get a token that can write; the job that installs and runs the pull request's code gets a read-only token and keeps none in its checkout
- Never merges: a maintainer lands the pull request after its review comments are read, answered and resolved

### 5. `test.yml`

**Triggers:**
- Every pull request into `main` or `master`
- Push to `main` or `master` that changes `scripts/`, `schema/`, `tests/`, `lib/`, `vocab/`, `package.json`, `vitest.config.js`, `LICENSE` or this workflow
- Manual dispatch

**Purpose:**
- Unit tests with coverage
- Vocabulary and NLP tests
- SQL cache functionality tests
- Integration tests (full workflow)
- The README's tests, coverage, version and licence badges

**Badges:**
- The Unit Tests job writes one [shields.io endpoint](https://shields.io/badges/endpoint-badge) file per badge from its own run with `scripts/badges/write-badge-json.js`: the tests the coverage run passed, failed and skipped, counted from Vitest's JSON report; line coverage, rounded down, from `coverage/coverage-summary.json`; the version in `package.json`; the licence the `LICENSE` file names. It writes them on every run and archives them as the `badges` artifact
- On a push to `master`, or a manual dispatch there, after the four test jobs passed, the Update Badges job replaces the `badges` branch with those files: one commit with no parent, pushed with `--force-with-lease` on the head it read (`scripts/badges/publish-badges-branch.sh`). It is the only job with `contents: write`, it runs one at a time, and it never pushes to `master`. One at a time is in no set order, so a run of an earlier commit can come after a later commit's run; the job checks out `master`'s whole history, and the publisher leaves the branch alone when the commit its files were counted from descends from the run's own and `master` still holds it. Otherwise it pushes the run's files even when they equal the branch's, so that the head names the latest commit counted. A run whose commit `master` no longer holds, after a force-push replaced its history, pushes nothing
- The README reads each file through jsDelivr, `https://cdn.jsdelivr.net/gh/framerslab/codex@badges/<name>.json`, because shields.io refuses any address whose host ends in `github.com`. jsDelivr keeps a branch's files for up to 12 hours ([jsDelivr's caching notes](https://github.com/jsdelivr/jsdelivr#caching)), so the job purges each file after it writes; a purge that fails or is throttled leaves a warning, and the badge catches up when jsDelivr's copy expires
- Limit: the badges describe the last `master` commit whose Test Suite run published them. A force-push to `master` that changes nothing under the Test Suite's path filter starts no run, so after it the badges can describe a commit `master` no longer holds, until a manual dispatch of the Test Suite on `master` publishes the new head's figures. The publisher reads `master` once, before it pushes; a force-push between that read and the push is the same case

### 6. `build-index.yml`

**Triggers:**
- Push to main
- Manual dispatch

**Purpose:**
Builds search index with SQL caching and pushes to `index` branch.

### 7. `auto-categorize-inbox.yml`

**Triggers:**
- Push to `master` that adds Markdown under `weaves/inbox/`
- Manual dispatch (one file, or the LLM path forced)

**Purpose:**
Files each inbox note where it belongs:
- An `auto-move` result opens a pull request that moves the file to the suggested path
- At 70 percent confidence or more, that pull request gets the `landing` label and one comment naming the guards that passed; below 70 percent it waits for a manual review
- A `suggest` result or an error opens an issue instead
- Never merges: a maintainer lands a labelled pull request after its review comments are read, answered and resolved

### 8. `landing-follows-the-base.yml` (Landing follows the base)

**Triggers:**
- Pull request edits (`edited`) on any base, with no branch filter, so a retarget away from `main` counts; the job runs only when the edit changed the base

**Purpose:**
Keeps the `landing` label true to the branch its guards ran against:
- When the base of a pull request that carried `landing` changes, takes the label off and says in the guards comment (github-actions[bot]'s comment that starts with `<!-- landing-guards -->`, written when the pull request has none) which base the guards ran against
- A pull request without the label, or whose label is already off, gets no write
- Checks out no code; its one job gets a token that writes labels and comments
- A maintainer adds the label again after checking the pull request against the new base; on a trusted Weaver's pull request into `main`, the Trusted Weavers workflow does on the next push or reopen
- On a pull request from a fork the token can only read, so a label put there by hand stays and the job fails, which shows on the pull request

### 9. `bump-framers-deps.yml` (Bump @framers/* deps)

**Triggers:**
- Monday 06:00 UTC
- Manual dispatch (`gh workflow run bump-framers-deps.yml`); a run from any branch bumps `master`

**Purpose:**
Moves every `@framers/*` pin in a `package.json` to the newest version on npm, refreshes `pnpm-lock.yaml` and `package-lock.json` and opens one pull request into `master` from `chore/bump-framers-deps`:
- Pushes the branch and opens the pull request with `FRAMERS_BUMP_TOKEN`, a personal token held as a framerslab organization secret. GitHub starts no ordinary workflow run for an event made with `GITHUB_TOKEN`: a pull request a workflow opens with it gets its `pull_request` runs in an approval-required state, with no job ([Triggering a workflow from a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)). Opened with the personal token, the pull request gets Test Suite and rename-guard like any other
- Stops at its first step, with an error, when `FRAMERS_BUMP_TOKEN` is not available; the job's own `GITHUB_TOKEN` only reads
- Refreshes both lockfiles with `--ignore-scripts` and pins its third-party actions to a commit, since the job holds a token that reaches past this repository
- Refreshes `package-lock.json` with `npm install --package-lock-only`, which writes the lockfile and installs nothing, because `npm ci` (in `changelog.yml` and `async-processing.yml`) stops when it disagrees with `package.json`
- Commits `package.json`, `pnpm-lock.yaml` and `package-lock.json`, the manifests it changes here: create-pull-request stages its `add-paths` with one `git add`, which stages nothing when one of them matches no file, so a manifest tracked later goes on that list
- Labels nothing: `landing-follows-the-bump-checks.yml` adds `landing` once the pull request's Test Suite and rename-guard pass on its head, and the pull request lands after its review comments are read, answered and resolved
- `tests/bump-framers-deps.test.js` reads the workflow, runs its first step and its npm lockfile refresh, and makes its commit in a scratch repository holding this repository's files, since GitHub reports a broken file only when the schedule or a dispatch starts it

### 10. `landing-follows-the-bump-checks.yml` (Landing follows the bump checks)

**Triggers:**
- A Test Suite or rename-guard run requested, started (`in_progress`) or completed on `chore/bump-framers-deps`; a re-run sends no requested event, only the other two

**Purpose:**
Keeps the `landing` label on the weekly bump's pull request only on a head whose guards passed; its guards are that pull request's own Test Suite and rename-guard runs. Whichever event starts it, it reads each guard's newest pull request run on the pull request's head (listed by the guard's workflow file):
- Both passed: adds `landing` (created on first use) and keeps the guards comment (github-actions[bot]'s comment that starts with `<!-- landing-guards -->`) naming the two runs; when that comment cannot be written, the label comes off again
- Either ended without passing: takes the label off and says which in the guards comment
- Either has no run yet or has not finished, as after a push, a reopen or a re-run: keeps the label off and says so in a guards comment already there
- Then reads the pull request and the runs again and writes again while the head or the verdict changed, so an event handled late, a guard finishing meanwhile or a push keeps the last word with the latest state; a pull request that left `master` while it was labelled loses the label
- A run for an older head changes nothing; a change of base is otherwise left to `landing-follows-the-base.yml`
- No concurrency group: GitHub cancels a group's waiting run when a newer one queues, and a cancelled run would show on `master`'s last commit
- `workflow_run` runs the file as it reads on `master` with a token that can write, so the job checks out no code, runs only for a pull request from this repository's own branch (a fork's branch of the same name is skipped) and reads the run and the pull request inside its script; it never merges
- `tests/bump-framers-deps.test.js` runs its script against a stand-in for the GitHub API, since GitHub runs the file only once it is on `master`

### The `landing` label

No workflow here merges a pull request or turns on GitHub's auto-merge. A pull request is merged only after every review and comment on it has been read, fixed or answered and its threads resolved. Where a workflow's checks and guards pass, it adds the `landing` label (created on first use) and posts one comment saying which guards passed; when that comment cannot be posted, the label comes off again. A change of base takes the label off too, since the guards ran against the old base. On the weekly bump's pull request the guards are its own Test Suite and rename-guard runs: the label goes on once both pass on its head, and comes off when a push, a reopen or a re-run starts either again there or when either fails. A maintainer lands the pull request after that pass.

## Caching Strategy

### SQLite Cache
```
.cache/codex.db
```
- Stores file hashes and metadata
- Only re-processes changed files
- ~80% faster incremental builds

### Embedding Cache
```
.cache/embeddings/
```
- Pre-computed document embeddings
- Persists across runs
- ~60% faster search index builds

### Cache Keys
```yaml
key: codex-index-v2-${{ hashFiles('weaves/**/*.md') }}
restore-keys:
  - codex-index-v2-
  - codex-index-
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | AI only | Claude API key for AI enhancement |
| `OPENAI_API_KEY` | AI only | OpenAI API key (fallback) |
| `GH_PAT` | Yes | Personal access token for cross-repo triggers |
| `FRAMERS_BUMP_TOKEN` | Bump only | framerslab organization secret shared with this repository: the personal token the weekly bump pushes its branch and opens its pull request with, so the pull request's checks run |

## Manual Triggers

### Force Full Reindex
```bash
gh workflow run async-processing.yml -f full_reindex=true
```

### Run Specific Workflow
```bash
gh workflow run auto-index.yml
gh workflow run ai-enhance-pr.yml
```

## Error Handling

1. **Validation Failures:**
   - Posts detailed error comments on PR
   - Updates commit status to failed
   - Does not block other jobs

2. **AI Enhancement Failures:**
   - Logs error but continues
   - Never blocks merging
   - Falls back gracefully

3. **Index Failures:**
   - Attempts to use cached index
   - Posts warning but allows manual merge

## Integration Points

### frame.dev Deployment
When index is published, triggers `repository_dispatch` to frame.dev:
```yaml
event-type: codex-index-updated
client-payload: '{"sha": "..."}'
```

### Webhook Notifications
The `finalize` job updates commit status with:
- Processing progress
- Final result (success/failure)
- Link to workflow run

## Best Practices

1. **For Contributors:**
   - Let workflows run before requesting review
   - Address AI suggestions when possible
   - Use `skip-ai` label sparingly

2. **For Maintainers:**
   - Monitor workflow run times
   - Clear cache if builds are stale
   - Review AI suggestions before landing a pull request

3. **For Weavers:**
   - Ensure validation passes locally: `npm run validate`
   - Test indexing: `npm run index -- --validate`
   - Avoid large changes in single PRs (> 50 files)

## Troubleshooting

### Cache Issues
```bash
# Clear cache via workflow
gh workflow run async-processing.yml -f full_reindex=true

# Or manually delete cache
gh cache delete $(gh cache list | grep codex | awk '{print $1}')
```

### Stuck Workflows
```bash
# Cancel running workflows
gh run cancel $(gh run list --workflow=async-processing.yml --status=in_progress -q '.[0].databaseId')
```

### View Logs
```bash
gh run view --log
```















