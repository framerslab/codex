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
gh workflow run build-index.yml --repo framerslab/codex
```

Or click "Run workflow" at:  
https://github.com/framerslab/codex/actions/workflows/build-index.yml

### Option B: Local Script with PR

```bash
cd apps/codex
./scripts/retrigger-full-catalog.sh
```

Creates a PR for review. With `AUTO_CATALOG_LAND=true` (or `--land`) the PR gets the `landing` label; it lands after its review comments are read.

---

## 🔑 Required GitHub Secrets

```bash
GH_PAT=ghp_...                    # Required for Weaver approvals
OPENAI_API_KEY=sk-...            # Optional for AI analysis
AI_PROVIDER=disabled             # Optional: disable AI
```

---

## 💰 Cost Breakdown

| Feature | Cost | When |
|---------|------|------|
| Static NLP indexing | $0 | Every PR, every re-catalog |
| AI quality analysis | $0.01-0.20/PR | Only if OPENAI_API_KEY set |
| Full re-catalog (100 files) | $0 or ~$5 | Manual trigger or scheduled |

**Default setup: $0/month** (AI disabled)

---

## 📝 How It Works

1. **PR Opened** → Static NLP runs (free, 30s)
2. **If OPENAI_API_KEY set** → AI analysis runs (~$0.05, 2min)
3. **If author in WEAVERS.txt** → Approve and label `landing`
4. **Else** → Manual review required
5. **Review comments read, answered and resolved** → A maintainer merges
6. **On merge** → Index rebuilds (free, 30s)
7. **Live on frame.dev/codex** immediately

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

