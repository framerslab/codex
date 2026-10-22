# Codex GitHub Actions Workflows

## Overview

The Codex repository's workflows test every pull request, build the search index and bring it to `master` through a pull request, file the notes added to the inbox, record the weekly history, move the `@framers/*` dependencies to their newest versions, refine block tags with a model when someone asks, and keep the `landing` label true to each pull request's checks.

`master` is the only long-lived branch: the default branch, protected, and the base of every pull request. Every workflow names `master`, or one of the pull request branches the workflows open (`ci/codex-index`, `ci/changelog`, `chore/bump-framers-deps`, `ci/ai-enhance-blocks`), and no other branch; `tests/workflow-branches.test.js` reads every workflow file and checks it. A branch filter that names a branch the repository does not have matches no event, so its workflow never starts and no failed run shows.

## Workflow Architecture

```
Pull request into master
  ├─ Test Suite: Unit Tests, Vocabulary & NLP Tests, Cache Tests, Integration Tests  (required)
  ├─ rename-guard: guard                                                            (required)
  └─ review comments read, answered and resolved ──▶ landing label ──▶ merge

Push to master that changes weaves/, scripts/ or schema/
  └─ Build and Publish Codex Index ──▶ pull request from ci/codex-index
       └─ its Test Suite and rename-guard pass ──▶ landing label ──▶ merge after the comment pass

Weekly changelog, weekly @framers/* bump, AI block tags by hand
  └─ one pull request each, from ci/changelog, chore/bump-framers-deps or ci/ai-enhance-blocks, landed the same way
```

## Workflows

### 1. `auto-index.yml` (Build and Publish Codex Index)

**Triggers:**
- Push to any branch that changes `weaves/`, `scripts/`, `schema/` or this workflow
- Manual dispatch
- Repository dispatch (frame-deploy-complete)

**Purpose:**
Builds the search index files, `codex-index.json`, `codex-search.json` and `codex-report.json`, and on `master` publishes them through one pull request:
- The build-index job builds the three files and archives them with the tracked `codex-blocks.json`, which none of its steps rebuilds: `npm run build:index` does, and it also rewrites `codex-index.json` in its older shape, so the block index stays as last committed. On any other branch the run stops there
- Neither a push nor a manual dispatch stops on validation errors, since the indexer runs without `--validate`; `npm run index -- --validate` exits 1 on them, and the re-catalog script runs it that way
- On `master`, the publish-artifacts job checks out `master`'s head and opens or updates one pull request into `master` from `ci/codex-index` carrying them, so the pull request carries the index alone and merges without a conflict even after `master` took an earlier index pull request. It never pushes to `master`, which is protected (below): a commit made in a job has none of the required checks
- Pushes the branch and opens the pull request with `FRAMERS_BUMP_TOKEN`, as the weekly bump does, so the pull request gets Test Suite and rename-guard. Its commit message carries no skip marker: GitHub starts none of the `pull_request` workflows of a head commit whose message says `[skip ci]`, and the required checks would never report
- Stops at its first step, with an error, when `FRAMERS_BUMP_TOKEN` is not available; both jobs' own `GITHUB_TOKEN` only reads, and the publish job installs and runs none of the repository's code
- Publishes one run at a time, and keeps every waiting run (`queue: max`): GitHub's default keeps one, and a run that begins waiting replaces it whichever commit is newer. Each run waits for its own build, so a run of an earlier commit can reach the publish job after a later commit's run; when `master`'s head differs from the run's commit under `weaves/`, `scripts/`, `schema/` or this workflow, a later push changed them and its run publishes, so the earlier run leaves the pull request alone. A comparison that cannot be made fails the step, and nothing is published
- A later run replaces the branch with its own build, and closes the pull request when the index no longer differs from `master`'s
- Labels nothing: `landing-follows-the-bump-checks.yml` adds `landing` once the pull request's Test Suite and rename-guard pass on its head, and the pull request lands after its review comments are read, answered and resolved
- CodeRabbit skips the pull request by its title and reviews none of the four files in any pull request (`.coderabbit.yaml`, `reviews.auto_review.ignore_title_keywords` and `reviews.path_filters`), so an index pull request spends none of the review allowance CodeRabbit gives the token's owner; `tests/coderabbit-config.test.js` reads the configuration beside this workflow
- `tests/index-pull-request.test.js` reads the workflow, runs its first step, and runs its ordering step in scratch repositories, since GitHub runs the publish job only on `master`

### 2. `test.yml`

**Triggers:**
- Every pull request into `master`
- Push to `master` that changes `scripts/`, `schema/`, `tests/`, `lib/`, `vocab/`, `package.json`, `vitest.config.js`, `LICENSE` or this workflow
- Manual dispatch

**Purpose:**
- Unit tests with coverage
- Vocabulary and NLP tests
- SQL cache functionality tests
- Integration tests (full workflow)
- The README's tests, coverage, version and licence badges

**Badges:**
- The Unit Tests job writes one [shields.io endpoint](https://shields.io/badges/endpoint-badge) file per badge from its own run with `scripts/badges/write-badge-json.js`: the tests the coverage run passed, failed and skipped, counted from Vitest's JSON report; line coverage, rounded down, from `coverage/coverage-summary.json`; the version in `package.json`; the licence the `LICENSE` file names. It writes them on every run and archives them as the `badges` artifact
- On a push to `master`, or a manual dispatch there, after the four test jobs passed, the Update Badges job replaces the `badges` branch with those files: one commit with no parent, pushed with `--force-with-lease` on the head it read (`scripts/badges/publish-badges-branch.sh`). It is the only job with `contents: write`, it runs one at a time, and it never pushes to `master`. One at a time is in no set order, so a run of an earlier commit can come after a later commit's run; the job checks out `master`'s whole history, and the publisher leaves the branch alone when the commit its files were counted from descends from the run's own and `master` still holds it. Two commits on `master` neither of which descends from the other (a force-push, then a merge of both histories) are ordered by their runs' numbers, `github.run_number`, when both are known: the run's own, which the job passes to the publisher, and the one the head's message names; when either is missing, the run's files replace the branch's. Whenever the publisher does not leave the branch alone, it pushes the run's files, even files equal to the branch's, so that the head names the latest commit counted. A run whose commit `master` no longer holds, after a force-push replaced its history, pushes nothing
- The README reads each file through jsDelivr, `https://cdn.jsdelivr.net/gh/framerslab/codex@badges/<name>.json`, because shields.io refuses any address whose host ends in `github.com`. jsDelivr keeps a branch's files for up to 12 hours ([jsDelivr's caching notes](https://github.com/jsdelivr/jsdelivr#caching)), so the job purges each file after it writes; a purge that fails or is throttled leaves a warning, and the badge catches up when jsDelivr's copy expires
- Limit: the badges describe the last `master` commit whose Test Suite run published them. A force-push to `master` that changes nothing under the Test Suite's path filter starts no run, so after it the badges can describe a commit `master` no longer holds, until a manual dispatch of the Test Suite on `master` publishes the new head's figures. The publisher reads `master` once, before it pushes; a force-push between that read and the push is the same case

### 3. `auto-categorize-inbox.yml`

**Triggers:**
- Push to `master` that adds Markdown under `weaves/inbox/`
- Manual dispatch (one file, or the LLM path forced)

**Purpose:**
Files each inbox note where it belongs:
- An `auto-move` result opens a pull request that moves the file to the suggested path
- At 70 percent confidence or more, that pull request gets the `landing` label and one comment naming the guards that passed; below 70 percent it waits for a manual review
- A `suggest` result or an error opens an issue instead
- Never merges: a maintainer lands a labelled pull request after its review comments are read, answered and resolved

### 4. `landing-follows-the-base.yml` (Landing follows the base)

**Triggers:**
- Pull request edits (`edited`) on any base, with no branch filter, so a retarget away from `master` counts; the job runs only when the edit changed the base

**Purpose:**
Keeps the `landing` label true to the branch its guards ran against:
- When the base of a pull request that carried `landing` changes, takes the label off and says in the guards comment (github-actions[bot]'s comment that starts with `<!-- landing-guards -->`, written when the pull request has none) which base the guards ran against
- A pull request without the label, or whose label is already off, gets no write
- Checks out no code; its one job gets a token that writes labels and comments
- A maintainer adds the label again after checking the pull request against the new base
- On a pull request from a fork the token can only read, so a label put there by hand stays and the job fails, which shows on the pull request

### 5. `bump-framers-deps.yml` (Bump @framers/* deps)

**Triggers:**
- Monday 06:00 UTC
- Manual dispatch (`gh workflow run bump-framers-deps.yml`); a run from any branch bumps `master`

**Purpose:**
Moves every `@framers/*` pin in a `package.json` to the newest version on npm, refreshes `pnpm-lock.yaml` and `package-lock.json` and opens one pull request into `master` from `chore/bump-framers-deps`:
- Pushes the branch and opens the pull request with `FRAMERS_BUMP_TOKEN`, a personal token held as a framerslab organization secret. GitHub starts no ordinary workflow run for an event made with `GITHUB_TOKEN`: a pull request a workflow opens with it gets its `pull_request` runs in an approval-required state, with no job ([Triggering a workflow from a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)). Opened with the personal token, the pull request gets Test Suite and rename-guard like any other
- Stops at its first step, with an error, when `FRAMERS_BUMP_TOKEN` is not available; the job's own `GITHUB_TOKEN` only reads
- Refreshes both lockfiles with `--ignore-scripts` and pins its third-party actions to a commit, since the job holds a token that reaches past this repository
- Refreshes `package-lock.json` with `npm install --package-lock-only`, which writes the lockfile and installs nothing, because `npm ci` stops when it disagrees with `package.json`
- Commits `package.json`, `pnpm-lock.yaml` and `package-lock.json`, the manifests it changes here: create-pull-request stages its `add-paths` with one `git add`, which stages nothing when one of them matches no file, so a manifest tracked later goes on that list
- Labels nothing: `landing-follows-the-bump-checks.yml` adds `landing` once the pull request's Test Suite and rename-guard pass on its head, and the pull request lands after its review comments are read, answered and resolved
- `tests/bump-framers-deps.test.js` reads the workflow, runs its first step and its npm lockfile refresh, and makes its commit in a scratch repository holding this repository's files, since GitHub reports a broken file only when the schedule or a dispatch starts it

### 6. `landing-follows-the-bump-checks.yml` (Landing follows the checks of workflow pull requests)

**Triggers:**
- A Test Suite or rename-guard run requested, started (`in_progress`) or completed on `chore/bump-framers-deps`, `ci/codex-index`, `ci/changelog` or `ci/ai-enhance-blocks`; a re-run sends no requested event, only the other two

**Purpose:**
Keeps the `landing` label on the pull requests the weekly bump, the index publish, the changelog and the AI block enhancement open only on a head whose guards passed; a pull request's guards are its own Test Suite and rename-guard runs. It takes the branch from the run, and a run from any other branch changes nothing. Whichever event starts it, it reads each guard's newest pull request run on that branch's pull request's head (listed by the guard's workflow file):
- Both passed: adds `landing` (created on first use) and keeps the guards comment (github-actions[bot]'s comment that starts with `<!-- landing-guards -->`) naming the two runs; when that comment cannot be written, the label comes off again
- Either ended without passing: takes the label off and says which in the guards comment
- Either has no run yet or has not finished, as after a push, a reopen or a re-run: keeps the label off and says so in a guards comment already there
- Then reads the pull request and the runs again and writes again while the head or the verdict changed, so an event handled late, a guard finishing meanwhile or a push keeps the last word with the latest state; a pull request that left `master` while it was labelled loses the label
- A run for an older head changes nothing; a change of base is otherwise left to `landing-follows-the-base.yml`
- No concurrency group: GitHub cancels a group's waiting run when a newer one queues, and a cancelled run would show on `master`'s last commit
- `workflow_run` runs the file as it reads on `master` with a token that can write, so the job checks out no code, runs only for a pull request from this repository's own branch (a fork's branch of the same name is skipped) and reads the run and the pull request inside its script; it never merges
- `tests/bump-framers-deps.test.js` runs its script against a stand-in for the GitHub API, for each of the four branches, since GitHub runs the file only once it is on `master`

### 7. `changelog.yml` (Generate Weekly Changelog)

**Triggers:**
- Monday 00:00 UTC; a scheduled workflow here runs once a week at most
- Manual dispatch (`gh workflow run changelog.yml -f since=YYYY-MM-DD`; `since` is optional); a run from any branch records `master`

**Purpose:**
Records in `codex-history/YYYY-MM.jsonl` the complete days, in UTC, before the day it runs on that are not yet recorded, and brings them to `master` through one pull request:
- Both scripts end at the day the run starts on (`--until`), so no run records a day half, and each starts after the last day it recorded, so a missed or failed run leaves no gap; with nothing recorded, seven days before the run. A manual run can name the first day; a day already recorded is skipped, and an activity item an earlier line holds is left out
- `scripts/generate-changelog.js` appends one line for each day on which commits reached `master`. It reads `master`'s first-parent history: a merge commit brings its pull request's commits and any other commit brings itself, so a pull request's commits are recorded on the day it merged, though they keep the dates they were written on; it reads each commit's whole message, and a git that fails stops the run. `scripts/fetch-issue-activity.js` appends one line, dated its first day and naming the day it ends at, of the issues created and closed and the pull requests merged, read with `GH_PAT` through GitHub's GraphQL API, every page of each list
- The activity queries declare only the variables they use, since GitHub refuses an operation that declares one it does not use (the runs of 5 to 10 September 2026 stopped at "Variable $since is declared by anonymous query but not used", and GitHub then disabled the workflow); GitHub's issues `since` filter is the update time, so an issue created before the first day is not counted as created
- Opens or updates one pull request into `master` from `ci/changelog` with `FRAMERS_BUMP_TOKEN`, so the pull request gets Test Suite and rename-guard; its commit message carries no skip marker. It never pushes to `master`
- A run starts from `master`, so it first takes the monthly files of an open changelog pull request that has not landed, and appends to them; the pull request keeps every week's lines until it lands. A look-up of that branch that fails stops the run
- Stops at its first step, with an error, when `FRAMERS_BUMP_TOKEN` is not available; the job's own `GITHUB_TOKEN` only reads, it installs nothing (both scripts import Node's own modules alone), and it runs one at a time
- Labels nothing: `landing-follows-the-bump-checks.yml` adds `landing` once the pull request's Test Suite and rename-guard pass on its head, and the pull request lands after its review comments are read, answered and resolved
- `tests/changelog-pull-request.test.js` runs the activity script against a stand-in for GitHub's GraphQL API that applies GitHub's variable rules and serves each list a page at a time, runs the git changelog in scratch repositories, reads the workflow, and runs its first step, the step that picks the days, the two script steps with a stand-in `node`, and the step that carries an open pull request's lines

### 8. `ai-enhance-blocks.yml` (AI Enhance Block Tags)

**Triggers:**
- Manual dispatch (provider, maximum cost, model, dry run); a run from any branch enhances `master`
- The `ai-enhance` label added to a pull request into `master` from this repository's own branch; a fork's pull request is skipped, since it gets no secrets and its branch is not this repository's to push to

**Purpose:**
Refines the block tags and summaries in `weaves/` with `scripts/ai-enhance-blocks.js`, which calls a paid model:
- The enhance job installs and runs the repository's code with the model keys and a read-only `GITHUB_TOKEN`, keeps no token in its checkout, and archives the threads it changed as a patch; the run's inputs reach the script as arguments, never as shell text
- A manual run's second job applies the patch and opens or updates one pull request into `master` from `ci/ai-enhance-blocks` with `FRAMERS_BUMP_TOKEN`, carrying `weaves/` alone; the search index follows through the index pull request once the threads land
- A labelled pull request's second job commits the patch onto the pull request's own branch, as a fast-forward from the commit the enhancement ran on, and pushes it with `FRAMERS_BUMP_TOKEN`, so Test Suite and rename-guard run on the new head. When the branch moved meanwhile, the push is refused and the patch stays in the run's artifact for 30 days
- No commit message carries a skip marker; GitHub starts no workflow for a push made with `GITHUB_TOKEN`, and none of the `pull_request` workflows of a head commit whose message says `[skip ci]`
- The two jobs that hold `FRAMERS_BUMP_TOKEN` install and run none of the repository's code, and each stops at its first step, with an error, when the token is not available
- `landing-follows-the-bump-checks.yml` labels the manual run's pull request `landing` once its Test Suite and rename-guard pass on its head
- `tests/ai-enhance-blocks.test.js` reads the workflow and runs its argument handling with a stand-in `node` and its archive and push steps in scratch repositories; the workflow itself calls a paid model, so no test runs it

### The `landing` label

No workflow here merges a pull request or turns on GitHub's auto-merge. A pull request is merged only after every review and comment on it has been read, fixed or answered and its threads resolved. Where a workflow's checks and guards pass, it adds the `landing` label (created on first use) and posts one comment saying which guards passed; when that comment cannot be posted, the label comes off again. A change of base takes the label off too, since the guards ran against the old base. On the pull requests the weekly bump, the index publish, the changelog and the AI block enhancement open, the guards are a pull request's own Test Suite and rename-guard runs: the label goes on once both pass on its head, and comes off when a push, a reopen or a re-run starts either again there or when either fails. A maintainer lands the pull request after that pass.

### `master`'s protection

`master` is protected. A change reaches it only once Unit Tests, Vocabulary & NLP Tests, Cache Tests and Integration Tests (Test Suite) and guard (rename-guard) have passed on it, each accepted from GitHub Actions only; a pull request need not be up to date with `master` first. The rule binds administrators too, and force-pushes and deletion are blocked. Those five run on every pull request into `master`. A commit made in a job has none of them, so `master` refuses a job's push: Update Badges writes the `badges` branch, and the index, the weekly bump, the changelog and the AI-enhanced block tags arrive as pull requests. Update Badges runs on `master` only and is not required.

## Caching Strategy

### SQLite Cache
```
.cache/codex.db
```
- Stores file hashes and metadata
- Only re-processes changed files
- ~80% faster incremental builds
- No workflow keeps it from one run to the next, so every index build in CI starts from an empty cache; Cache Tests runs the indexer twice in one job to check the second, cached run

### pnpm Store
The Unit Tests job caches the pnpm store under `<os>-pnpm-store-<hash of pnpm-lock.yaml>`; after a lockfile change it starts from the newest earlier store and saves the new key.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | AI only | OpenAI API key: the AI block enhancement's default provider and the inbox categorizer's model path |
| `ANTHROPIC_API_KEY` | AI only | Claude API key: the AI block enhancement's other provider and the inbox categorizer's model path |
| `GH_PAT` | Changelog and inbox | Personal access token for the changelog's GraphQL reads of issues and pull requests, and for the pull requests and issues the inbox categorizer opens |
| `FRAMERS_BUMP_TOKEN` | Bump, index, changelog and AI block tags | framerslab organization secret shared with this repository: the personal token the weekly bump, the index publish, the changelog and the AI block enhancement push their branches and open their pull requests with, so the pull requests' checks run |

## Manual Triggers

### Rebuild the Index
```bash
gh workflow run auto-index.yml
```
A run on `master` builds the index from `master`'s head and opens or updates the pull request from `ci/codex-index`.

### Run Specific Workflow
```bash
gh workflow run test.yml
gh workflow run changelog.yml
gh workflow run ai-enhance-blocks.yml -f max_cost=5.00
```
The AI block enhancement calls a paid model and stops when its spend reaches `max_cost` (5.00 US dollars when the input is left out).

## Integration Points

### frame.dev
frame.dev reads this repository's content from `master`. Nothing here starts a frame.dev deploy: frame.dev deploys once per frame.dev release, and a change merged here reaches the site with its next release.

## Best Practices

1. **For Contributors:**
   - Ensure validation passes locally: `npm run validate`
   - Test indexing: `npm run index -- --validate`
   - Let the checks finish before requesting review, and answer every review comment
   - Avoid large changes in single PRs (> 50 files)

2. **For Maintainers:**
   - Monitor workflow run times
   - Clear cache if builds are stale
   - Review AI suggestions before landing a pull request
   - Pin a third-party action, and `actions/github-script`, to the commit of a release whose `action.yml` runs on Node.js 24, with the release named beside it (`uses: owner/action@<commit> # vX.Y.Z`): read the commit from the release's tag (`gh api repos/<owner>/<action>/git/ref/tags/<release>`, then the tag object to its commit when the tag is annotated) and `runs.using` from the `action.yml` at that commit, and read the release notes for breaking changes. `tests/actions-on-node24.test.js` checks `actions/github-script` (v9.0.0) and `peter-evans/create-pull-request` (v8.1.1)

## Troubleshooting

### Cache Issues
```bash
# List the caches, then delete one by its key
gh cache list -R framerslab/codex
gh cache delete <key> -R framerslab/codex
```

### Stuck Workflows
```bash
# Cancel the index build that is running
gh run cancel "$(gh run list -R framerslab/codex --workflow=auto-index.yml --status=in_progress --json databaseId -q '.[0].databaseId')" -R framerslab/codex
```

### View Logs
```bash
gh run view --log
```
