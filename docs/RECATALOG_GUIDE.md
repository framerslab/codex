---
id: recatalog-guide
slug: recatalog-guide
title: "Frame Codex Re-Catalog Guide"
summary: "Complete guide to triggering full re-indexing and metadata updates for all Frame Codex content"
version: "1.0.0"
contentType: markdown
difficulty: intermediate
taxonomy:
  subjects: [technology, knowledge]
  topics: [deployment, best-practices]
tags: [catalog, indexing, automation, ci-cd, metadata]
---

# Frame Codex Re-Catalog Guide

This guide explains how to trigger a complete re-indexing and metadata update for all Frame Codex content.

---

## When to Re-Catalog

Run a full re-catalog when:

✅ **Initial setup** - First time setting up the repository  
✅ **Schema changes** - After updating validation rules or metadata schema  
✅ **Vocabulary updates** - After adding new subjects/topics to controlled vocabulary  
✅ **Bulk imports** - After importing large amounts of content  
✅ **Quality audit** - Periodic review of all content (monthly/quarterly)  

❌ **NOT needed for:**
- Individual PR merges (automatic via GitHub Actions)
- Small metadata fixes (handled by normal PR flow)
- Content updates without schema changes

---

## Method 1: GitHub Actions (Recommended)

### Via GitHub Web UI

1. Go to https://github.com/framerslab/codex/actions/workflows/auto-index.yml
2. Click **"Run workflow"** dropdown (top right)
3. Select branch: `master`
4. Click **"Run workflow"** button
5. Wait for the index pull request to open or update

### Via GitHub CLI

```bash
gh workflow run auto-index.yml --repo framerslab/codex
```

**What It Does:**
- Processes the blocks and runs `pnpm run index` and `pnpm run build:search` on ALL files of master's head, without `--validate`, so it does not stop on validation errors; run `npm run index -- --validate` first to see them, or use Method 2, which does
- Opens or updates one pull request into `master` from `ci/codex-index` with the files that changed among `codex-index.json`, `codex-search.json`, `codex-report.json` and `codex-blocks.json`
- The index reaches master, where frame.dev reads it, when that pull request lands after its checks and review pass

**Cost:** $0 (static NLP only, no AI calls)

---

## Method 2: Local Script with PR Creation

### Using the Re-Catalog Script

```bash
cd apps/codex
chmod +x scripts/retrigger-full-catalog.sh
./scripts/retrigger-full-catalog.sh
```

**What It Does:**
1. Runs full static NLP analysis on ALL files
2. Updates `codex-index.json` and `codex-report.json`
3. Creates a new branch: `catalog/full-reindex-{timestamp}`
4. Commits changes
5. Pushes to GitHub
6. **Creates a PR** for review
7. Optionally labels the PR `landing` if `AUTO_CATALOG_LAND=true` (a maintainer lands it after its review comments are read)

**Options:**

```bash
# Dry run (see what would change, no PR)
./scripts/retrigger-full-catalog.sh --dry-run

# Label the PR for landing (overrides AUTO_CATALOG_LAND)
./scripts/retrigger-full-catalog.sh --land
```

**Requirements:**
- `GH_PAT` environment variable (for PR creation)
- Git configured with user name/email

**Cost:** $0 (static NLP only)

---

## Method 3: Manual Local Re-Index

For testing or local development:

```bash
cd apps/codex
npm install
npm run index -- --validate
```

**Output Files:**
- `codex-index.json` - Full searchable index
- `codex-report.json` - Analytics and validation report

**To Deploy:** master is protected, so the files reach it through a pull request whose Test Suite and rename-guard checks pass:
```bash
git switch -c chore/manual-re-index
git add codex-index.json codex-report.json
git commit -m "chore: manual re-index"
git push -u origin chore/manual-re-index
gh pr create --base master --fill
```

---

## Landing Label

### Default Behavior: Review Required

Full re-catalog PRs wait for **review**. Nothing merges a PR automatically: a PR lands only after its reviews and comments are read, fixed or answered and its threads resolved.

### Label for Landing

Export this variable in the shell that runs the script:

```bash
export AUTO_CATALOG_LAND=true
```

**When set:**
- The script adds the `landing` label to its PR and one comment naming the guards that passed (the indexer run and its file counts)
- A run in which the indexer skipped a file gets no label, since that file is missing from the index
- A maintainer lands the PR after its review comments are read
- `AUTO_CATALOG_MERGE` and `--auto-merge` are older names for the same setting

### Toggle via Script

```bash
# Label the PR for landing
AUTO_CATALOG_LAND=true ./scripts/retrigger-full-catalog.sh

# Without the label (default)
./scripts/retrigger-full-catalog.sh

# Label the PR for landing (one-time override)
./scripts/retrigger-full-catalog.sh --land
```

---

## What Gets Updated

### Static NLP Analysis (Always Runs)

1. **Keywords Extraction** (TF-IDF)
   - Identifies most important terms
   - Filters stop words
   - Ranks by relevance

2. **Phrase Detection** (N-grams)
   - Finds common 2-3 word phrases
   - Identifies repeated patterns
   - Suggests tags

3. **Category Matching**
   - Matches against controlled vocabulary
   - Assigns subjects and topics
   - Calculates confidence scores

4. **Difficulty Detection**
   - Heuristic analysis of complexity indicators
   - Keyword-based classification
   - Assigns beginner/intermediate/advanced/expert

5. **Summary Generation**
   - Extractive summarization
   - Picks most representative sentence
   - Truncates to 300 characters

6. **Validation**
   - Schema compliance
   - Required fields check
   - Content quality rules
   - Duplicate detection

### What Does NOT Get Updated

❌ **Manual metadata is preserved:**
- Explicitly set titles, summaries, tags
- User-defined relationships
- Custom categorization
- Version numbers
- Author information

✅ **Only auto-generated fields are updated:**
- `metadata.autoGenerated.*`
- Missing fields (if not explicitly set)
- Validation warnings/suggestions

---

## Reviewing Re-Catalog PRs

### What to Check

1. **Metadata Changes**
   - Are auto-tags accurate?
   - Is difficulty level appropriate?
   - Are subjects/topics correct?

2. **Categorization Confidence**
   - Check `confidence` scores in report
   - Low confidence (<0.5) may need manual review

3. **Validation Issues**
   - Review `codex-report.json` → `validation.fileErrors`
   - Fix any schema violations
   - Address quality warnings

4. **Vocabulary Suggestions**
   - Review `vocabulary.suggestedAdditions`
   - Consider adding frequent terms to controlled vocabulary

### Approval Checklist

- [ ] Spot-check 5-10 random files for accuracy
- [ ] Review files with low confidence scores
- [ ] Check for any unexpected categorization changes
- [ ] Verify no content was lost or corrupted
- [ ] Review vocabulary suggestions for next iteration

---

## Cost Estimates (AI Enhancement)

### Static NLP (Default)

**Cost: $0**
- TF-IDF, n-grams, vocabulary matching
- Runs locally in GitHub Actions
- No external API calls

### AI Enhancement (Optional)

No re-catalog calls a model. The AI block enhancement (`ai-enhance-blocks.yml`) calls one only on a run someone starts, by hand or with the `ai-enhance` label on a PR, and stops when its spend reaches its `max_cost` input (5.00 US dollars when left out).

---

## Troubleshooting

### "No changes detected"

The index is already up to date. No action needed.

### "Validation failed"

Fix errors in the files listed in `codex-report.json` → `validation.fileErrors`, then re-run.

### "PR creation failed"

Check that `GH_PAT` is set and has `repo` scope. Verify token hasn't expired.

### "Could not label the PR"

Ensure `GH_PAT` can write issues and pull requests on the repository. The PR stays open for manual review.

---

## Scheduled Re-Catalogs

### Weekly (Recommended)

Add to `.github/workflows/auto-index.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday at 2 AM UTC
```

### Monthly

```yaml
on:
  schedule:
    - cron: '0 2 1 * *'  # First day of month at 2 AM UTC
```

---

## Next Steps

1. ✅ Run initial catalog: `./scripts/retrigger-full-catalog.sh --dry-run`
2. ✅ Review output in `codex-report.json`
3. ✅ If satisfied, run without `--dry-run` to create PR
4. ✅ Review and merge PR
5. ✅ Set up scheduled re-catalogs (optional)
6. ✅ Set `AUTO_CATALOG_LAND=true` if re-catalog PRs should arrive labelled for landing

---


