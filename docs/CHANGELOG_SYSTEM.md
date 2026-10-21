---
id: changelog-system-guide
slug: changelog-system
title: Frame Codex Changelog System
summary: Automated changelog and activity tracking using git commits and GitHub API
version: 1.0.0
contentType: markdown
difficulty: beginner
taxonomy:
  subjects:
    - technology
  topics:
    - automation
    - ci-cd
tags: [changelog, automation, github-actions, git, graphql]
relationships:
  references:
    - development-guide
publishing:
  status: published
---

# Frame Codex Changelog System

Frame Codex automatically tracks and records all changes, issues, and pull requests in a structured, machine-readable format.

## Overview

The changelog system runs weekly via GitHub Actions and records:

1. **Git Changelog**: Parsed conventional commits with metadata, one line for each day on which commits reached `master`
2. **Issue Activity**: Created and closed issues and merged PRs, one line for each run, over the days it records
3. **Monthly JSONL Files**: `codex-history/YYYY-MM.jsonl`, one JSON object per line

All history is stored in `codex-history/` and reaches `master` through a pull request from `ci/changelog`. [codex-history/README.md](../codex-history/README.md) describes the files and how to query them.

## Why This Matters

### For Humans

- **Transparency**: See exactly what changed and when
- **Accountability**: Track who contributed what
- **Discovery**: Find related changes quickly

### For AI

- **Structured Data**: Consistent JSON schema for LLM consumption
- **Contextual**: Links to commits, issues, PRs for deep dives
- **Queryable**: Filter by date, type, author, or label

## How It Works

### Weekly Automation

Every Monday at 00:00 UTC, `.github/workflows/changelog.yml` records the complete days, in UTC, before the day it runs on that are not yet recorded. A scheduled workflow here runs once a week at most. Each script starts after the last day it recorded, so a missed or failed run leaves no gap, and no run records a day half; with nothing recorded, it starts seven days before the run, and a manual run can name the first day.

1. **Keeps an Open Pull Request's Lines**
   - Takes the monthly files of a changelog pull request that has not landed, so they count as recorded

2. **Fetches Git History**
   - Reads `master`'s first-parent history: a merge commit brings its pull request's commits, any other commit brings itself, and each commit is recorded on the day, in UTC, the commit that brought it was made, so a pull request's commits are recorded on the day it merged
   - Extracts conventional commit metadata, reading each commit's whole message
   - Appends one line for each day to `codex-history/YYYY-MM.jsonl`, skipping the days already recorded

3. **Fetches GitHub Activity** (if `GH_PAT` is set)
   - Queries GitHub's GraphQL API, every page of each list, for the span from where the last recorded span ended
   - Collects the issues created and closed and the PRs merged in the span, leaving out what an earlier line holds
   - Appends one line, dated the span's first day and naming the day it ends at (`until`), to that month's file

4. **Opens a Pull Request**
   - Opens or updates one pull request into `master` from `ci/changelog` with `FRAMERS_BUMP_TOKEN`, so its Test Suite and rename-guard run
   - `master` is protected, so a commit the workflow makes cannot be pushed to it; the pull request lands once its checks pass and its review comments are answered

### Manual Generation

You can also generate history manually:

```bash
# From the repository's root: git changelog for a date range; --until is the first day not recorded
# (today, in UTC, when left out), and --since the first day (after the last day recorded, when left out)
node scripts/generate-changelog.js --since 2025-01-01 --until 2025-02-01

# Issue activity (requires GH_PAT)
GH_PAT=ghp_xxx node scripts/fetch-issue-activity.js --since 2025-01-01 --until 2025-02-01
```

## Data Formats

### Git Changelog

One line of `codex-history/YYYY-MM.jsonl` for each day, in UTC, on which commits reached `master`; each commit's own `date` is the day it was written:

```json
{
  "date": "2025-01-15",
  "totalCommits": 5,
  "byType": {
    "feat": [
      {
        "sha": "abc1234",
        "author": "John Doe",
        "date": "2025-01-15T10:30:00Z",
        "url": "https://github.com/framerslab/codex/commit/abc1234",
        "type": "feat",
        "scope": "indexer",
        "description": "add SQL caching"
      }
    ],
    "fix": [...],
    "chore": [...]
  },
  "commits": [...]
}
```

### Issue Activity

One line of `codex-history/YYYY-MM.jsonl` for each run, dated its first day, with `until` the first day it does not cover:

```json
{
  "type": "github_activity",
  "date": "2025-01-15",
  "until": "2025-01-22",
  "repository": "framerslab/codex",
  "summary": {
    "issuesCreated": 2,
    "issuesClosed": 1,
    "prsMerged": 3,
    "total": 6
  },
  "created": [
    {
      "number": 42,
      "title": "Add new feature",
      "url": "https://github.com/framerslab/codex/issues/42",
      "createdAt": "2025-01-15T14:20:00Z",
      "author": "johndoe",
      "labels": ["enhancement"]
    }
  ],
  "closed": [...],
  "merged": [...]
}
```

## Conventional Commits

For best results, use conventional commit format:

```
type(scope): description

Optional body with more details
```

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `chore`: Maintenance (deps, config, etc.)
- `refactor`: Code refactoring
- `test`: Tests
- `ci`: CI/CD changes
- `perf`: Performance improvements

### Examples

```bash
# Good
git commit -m "feat(indexer): add SQL caching for 10x speedup"
git commit -m "fix(validator): handle missing required fields"
git commit -m "docs: update submission guide with ECA fields"

# Also fine (fallback to "other" type)
git commit -m "Update README"
```

## Querying History

### Command Line (jq)

```bash
# Find all features added in January
jq 'select(.commits) | .commits[] | select(.type == "feat")' codex-history/2025-01.jsonl

# Count the PRs merged in each run's week
jq 'select(.type == "github_activity") | {date, prsMerged: .summary.prsMerged}' codex-history/*.jsonl

# Get commits by author
jq 'select(.commits) | .commits[] | select(.author == "John Doe")' codex-history/*.jsonl

# Find issues with specific label
jq 'select(.type == "github_activity") | .created[] | select(.labels | contains(["bug"]))' codex-history/*.jsonl
```

### JavaScript/TypeScript

```typescript
import fs from 'fs'

// Load every line of a month's history
function loadMonth(year: number, month: number) {
  const file = `codex-history/${year}-${month.toString().padStart(2, '0')}.jsonl`
  return fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

// Get all features
const january = loadMonth(2025, 1)
const features = january
  .filter(entry => entry.commits)
  .flatMap(day => day.commits.filter(c => c.type === 'feat'))

console.log(`${features.length} features added in January`)
```

### AI Prompts

> "Summarize the changes in Frame Codex for the week of January 15-21, 2025. Focus on new features and bug fixes."

The AI can read the month's JSONL file and generate a comprehensive summary.

## Configuration

### GitHub Secrets

Add to `framerslab/codex` repository settings:

**Required:**
- `FRAMERS_BUMP_TOKEN`: a framerslab organization secret. The workflow pushes `ci/changelog` and opens its pull request with it, so the pull request's checks run; without it the run stops at its first step

**For the issue and PR activity:**
- `GH_PAT`: GitHub Personal Access Token with `repo` scope
  - Without it the run records the commits alone, with a warning
  - Generate at: https://github.com/settings/tokens/new?scopes=repo

### Workflow Customization

Edit `.github/workflows/changelog.yml`:

```yaml
on:
  schedule:
    # Monday 00:00 UTC; a scheduled workflow here runs once a week at most
    - cron: '0 0 * * 1'
```

## Storage & Performance

- **Size**: one file per month, with one line for each day of commits and one for each run's activity
- **Retention**: Indefinite (files are small and valuable)
- **Performance**: Negligible impact on repo size
- **Cleanup**: Not needed; history is the point

## Future Enhancements

Planned features:

1. **Weekly Summaries**
   - Auto-generate markdown roll-ups
   - Group by type, scope, author
   - Highlight notable changes

2. **Changelog Viewer**
   - Web UI at frame.dev/codex/changelog
   - Filter by date, type, author, label
   - Search across all history

3. **Release Notes**
   - Auto-generate from git tags
   - Group changes by version
   - Include breaking changes section

4. **Metrics Dashboard**
   - Commits per day/week/month
   - Top contributors
   - Issue resolution time
   - PR merge time

## Troubleshooting

### Workflow Not Running

**Check:**
1. Workflow file exists at `.github/workflows/changelog.yml`
2. GitHub Actions is enabled for the repository
3. Scheduled workflows are not disabled: in a public repository, GitHub disables them when the repository has had no activity for 60 days ([Disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)), and `gh workflow view changelog.yml --repo framerslab/codex` shows the state

**Fix:**
- Enable it: `gh workflow enable changelog.yml --repo framerslab/codex`
- Trigger manually: `gh workflow run changelog.yml --repo framerslab/codex`

### No Issue Activity

**Cause:** `GH_PAT` secret not set; the run's log carries a warning that says so

**Fix:**
1. Generate token: https://github.com/settings/tokens/new?scopes=repo
2. Add to repository secrets as `GH_PAT`
3. Re-run workflow

### Commits Not Parsed

**Cause:** Non-conventional commit format

**Effect:** Commits are categorized as `type: "other"`

**Fix:** Use conventional commit format going forward (existing commits are still recorded)

## Learn More

- [Conventional Commits Spec](https://www.conventionalcommits.org/)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Frame Codex Development Guide](./DEVELOPMENT.md)

---

*Automated changelog system implemented 2025-01-16*

