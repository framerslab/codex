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
- When the checks pass and the commit they ran on is still the head, approves that commit, adds the `landing` label and keeps one comment naming the guards that passed
- A push that moves the head, or a reopen, takes the label off until the checks pass on the head; a head whose checks fail keeps it off, and the guards comment says so
- Runs one at a time per pull request: a newer push cancels the older run
- Only the jobs that write labels and comments get a token that can write; the job that installs and runs the pull request's code gets a read-only token and keeps none in its checkout
- Never merges: a maintainer lands the pull request after its review comments are read, answered and resolved

### 5. `test.yml`

**Triggers:**
- Push and PR to main

**Purpose:**
- Unit tests with coverage
- SQL cache functionality tests
- Integration tests (full workflow)

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

### The `landing` label

No workflow here merges a pull request or turns on GitHub's auto-merge. A pull request is merged only after every review and comment on it has been read, fixed or answered and its threads resolved. Where a workflow's checks and guards pass, it adds the `landing` label (created on first use) and posts one comment saying which guards passed; when that comment cannot be posted, the label comes off again. A maintainer lands the pull request after that pass.

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















