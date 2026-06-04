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

The changelog system runs daily via GitHub Actions and generates:

1. **Git Changelog**: Parsed conventional commits with metadata
2. **Issue Activity**: Created, closed, and merged issues/PRs
3. **JSON Snapshots**: One file per day for easy querying

All history is stored in `codex-history/` and committed to the repository.

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

### Daily Automation

Every day at 00:00 UTC, a GitHub Actions workflow:

1. **Fetches Git History**
   - Parses last 7 days of commits
   - Extracts conventional commit metadata
   - Writes `codex-history/git/YYYY-MM-DD.json`

2. **Fetches GitHub Activity** (if `GH_PAT` is set)
   - Queries GraphQL API for yesterday's activity
   - Collects created/closed issues and merged PRs
   - Writes `codex-history/issues/YYYY-MM-DD.json`

3. **Commits Changes**
   - Adds new JSON files
   - Pushes to `master` branch

### Manual Generation

You can also generate history manually:

```bash
cd apps/codex

# Git changelog for a date range
node scripts/generate-changelog.js --since 2025-01-01

# Issue activity (requires GH_PAT)
GH_PAT=ghp_xxx node scripts/fetch-issue-activity.js --since 2025-01-01
```

## Data Formats

### Git Changelog

`codex-history/git/YYYY-MM-DD.json`:

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

`codex-history/issues/YYYY-MM-DD.json`:

```json
{
  "date": "2025-01-15",
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
jq '.commits[] | select(.type == "feat")' codex-history/git/2025-01-*.json

# Count PRs merged per day
jq '.summary.prsMerged' codex-history/issues/*.json

# Get commits by author
jq '.commits[] | select(.author == "John Doe")' codex-history/git/*.json

# Find issues with specific label
jq '.created[] | select(.labels | contains(["bug"]))' codex-history/issues/*.json
```

### JavaScript/TypeScript

```typescript
import fs from 'fs'
import path from 'path'

// Load all git changelogs for a month
function loadMonth(year: number, month: number) {
  const dir = 'codex-history/git'
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith(`${year}-${month.toString().padStart(2, '0')}`))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))
  
  return files
}

// Get all features
const january = loadMonth(2025, 1)
const features = january.flatMap(day => 
  day.commits.filter(c => c.type === 'feat')
)

console.log(`${features.length} features added in January`)
```

### AI Prompts

> "Summarize the changes in Frame Codex for the week of January 15-21, 2025. Focus on new features and bug fixes."

The AI can read the relevant JSON files and generate a comprehensive summary.

## Configuration

### GitHub Secrets

Add to `framerslab/codex` repository settings:

**Required:**
- `GH_PAT`: GitHub Personal Access Token with `repo` scope
  - Used for issue/PR activity tracking
  - Generate at: https://github.com/settings/tokens/new?scopes=repo

**Optional:**
- None (git changelog works without any secrets)

### Workflow Customization

Edit `.github/workflows/changelog.yml`:

```yaml
on:
  schedule:
    # Change frequency (default: daily at 00:00 UTC)
    - cron: '0 0 * * *'
```

## Storage & Performance

- **Size**: ~10-50 KB per day (depends on activity)
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
3. Scheduled workflows are not disabled

**Fix:**
- Trigger manually: `gh workflow run changelog.yml --repo framerslab/codex`

### No Issue Activity

**Cause:** `GH_PAT` secret not set

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

