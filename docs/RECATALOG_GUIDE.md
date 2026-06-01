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

1. Go to https://github.com/framerslab/codex/actions/workflows/build-index.yml
2. Click **"Run workflow"** dropdown (top right)
3. Select branch: `main`
4. Click **"Run workflow"** button
5. Wait ~1-2 minutes for completion

### Via GitHub CLI

```bash
gh workflow run build-index.yml --repo framerslab/codex
```

**What It Does:**
- Runs `npm run index -- --validate` on ALL files
- Generates `codex-index.json` and `codex-report.json`
- Pushes to `index` branch (no PR needed)
- Updates live immediately on frame.dev/codex

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
6. **Creates a PR** (requires manual approval by default)
7. Optionally auto-merges if `AUTO_CATALOG_MERGE=true`

**Options:**

```bash
# Dry run (see what would change, no PR)
./scripts/retrigger-full-catalog.sh --dry-run

# Force auto-merge (overrides AUTO_CATALOG_MERGE setting)
./scripts/retrigger-full-catalog.sh --auto-merge
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

**To Deploy:**
```bash
git add codex-index.json codex-report.json
git commit -m "chore: manual re-index"
git push
```

---

## Auto-Merge Configuration

### Default Behavior: Manual Approval Required

By default, full re-catalog PRs require **manual review and approval**. This is the recommended setting to catch any unexpected metadata changes.

### Enable Auto-Merge

Set this GitHub secret to enable automatic merging:

```bash
AUTO_CATALOG_MERGE=true
```

**When enabled:**
- Re-catalog PRs will auto-merge after validation passes
- No human review required
- Faster iteration, but less oversight

**When to enable:**
- High trust in automation
- Frequent re-catalogs needed
- Well-tested vocabulary and schema

**When to keep disabled (recommended):**
- Initial setup phase
- Testing new categorization rules
- Want to review metadata changes
- Prefer human oversight

### Toggle via Script

```bash
# With auto-merge
AUTO_CATALOG_MERGE=true ./scripts/retrigger-full-catalog.sh

# Without auto-merge (default)
./scripts/retrigger-full-catalog.sh

# Force auto-merge (one-time override)
./scripts/retrigger-full-catalog.sh --auto-merge
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

Only runs if `OPENAI_API_KEY` is set:

| Content Length | Words | Tokens (est.) | Cost/PR |
|----------------|-------|---------------|---------|
| Short article  | 100-500 | 150-750 | $0.01-0.03 |
| Medium article | 500-2K | 750-3K | $0.03-0.08 |
| Long article   | 2K-10K | 3K-15K | $0.08-0.20 |
| Documentation  | 10K-50K | 15K-75K | $0.20-1.00 |
| Large corpus   | 50K-100K | 75K-150K | $1.00-2.00 |

**Calculation:**
- GPT-4 Turbo: $0.01/1K input tokens, $0.03/1K output tokens
- Average PR: ~2K input, ~500 output = ~$0.035
- **Varies significantly based on content length**

**Monthly Budget Estimate:**
- 10 PRs/month × $0.05 avg = **~$0.50/month**
- 50 PRs/month × $0.05 avg = **~$2.50/month**
- 200 PRs/month × $0.05 avg = **~$10/month**

**Full Re-Catalog (100 files):**
- 100 files × $0.05 avg = **~$5.00 per full run**
- Recommended: Run monthly or quarterly

---

## Troubleshooting

### "No changes detected"

The index is already up to date. No action needed.

### "Validation failed"

Fix errors in the files listed in `codex-report.json` → `validation.fileErrors`, then re-run.

### "PR creation failed"

Check that `GH_PAT` is set and has `repo` scope. Verify token hasn't expired.

### "Auto-merge failed"

Check branch protection rules. Ensure `GH_PAT` has sufficient permissions.

---

## Scheduled Re-Catalogs

### Weekly (Recommended)

Add to `.github/workflows/build-index.yml`:

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
6. ✅ Configure `AUTO_CATALOG_MERGE` based on your workflow

---


