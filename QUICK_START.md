# Frame Codex Quick Start

## 🚀 Run Initial Catalog (First Time)

```bash
cd apps/codex
npm install
npm run index -- --validate
```

**Output:** `codex-index.json` and `codex-report.json` generated

---

## 🔄 Trigger Full Re-Catalog

### Option A: GitHub Actions (Simplest)

```bash
gh workflow run auto-index.yml --repo framerslab/codex
```

Or click "Run workflow" at:  
https://github.com/framerslab/codex/actions/workflows/auto-index.yml

The run builds the index from master and opens or updates the pull request from `ci/codex-index`; the index reaches master when that pull request lands.

### Option B: Local Script with PR

```bash
cd apps/codex
./scripts/retrigger-full-catalog.sh
```

Creates a PR for review. With `AUTO_CATALOG_LAND=true` (or `--land`) the PR gets the `landing` label; it lands after its review comments are read.

---

## 🔑 Required GitHub Secrets

```bash
GH_PAT=ghp_...                    # The changelog's reads and the inbox categorizer's PRs and issues
OPENAI_API_KEY=sk-...            # Optional: the AI block enhancement, run by hand
```

---

## 💰 Cost Breakdown

| Feature | Cost | When |
|---------|------|------|
| Static NLP indexing | $0 | Every PR, every re-catalog |
| AI block enhancement | Up to its `max_cost` input (5.00 US dollars when left out) a run | Only on a run someone starts |
| Full re-catalog (100 files) | $0 | By hand |

**Default setup: $0/month** (no workflow calls a model unless someone starts one)

---

## 📝 How It Works

1. **PR Opened** → Test Suite and rename-guard run (free), and the review bots comment
2. **Review comments read, answered and resolved** → A maintainer labels it `landing` and merges it
3. **On merge** → `auto-index.yml` rebuilds the index (free) and opens or updates the pull request from `ci/codex-index`
4. **That pull request lands** → The new index is on master, where frame.dev reads it

---

## 🎯 Landing Control

**Nothing merges a PR automatically.** A PR is merged after its reviews and comments are read, fixed or answered and its threads resolved.

**Label re-catalog PRs for landing:**
```bash
# In the shell that runs the re-catalog script
AUTO_CATALOG_LAND=true ./scripts/retrigger-full-catalog.sh
```

The `landing` label marks a PR whose checks and guards passed; a maintainer lands it after the comment pass.

---

## 📚 Full Documentation

- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - Complete dev guide
- **[RECATALOG_GUIDE.md](./docs/RECATALOG_GUIDE.md)** - Re-catalog details
- **[how-to-submit.md](./docs/contributing/how-to-submit.md)** - Contributor guide
- **[submission-schema.md](./docs/contributing/submission-schema.md)** - Schema reference

---

*Frame Codex: The OS for humans, the codex of humanity.*

