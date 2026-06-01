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

Creates a PR that requires manual approval (unless `AUTO_CATALOG_MERGE=true`)

---

## 🔑 Required GitHub Secrets

```bash
GH_PAT=ghp_...                    # Required for auto-merge
OPENAI_API_KEY=sk-...            # Optional for AI analysis
AUTO_CATALOG_MERGE=false         # Default: requires manual approval
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
3. **If author in WEAVERS.txt** → Auto-approve & merge
4. **Else** → Manual review required
5. **On merge** → Index rebuilds (free, 30s)
6. **Live on frame.dev/codex** immediately

---

## 🎯 Auto-Merge Control

**Default: Manual approval required** ✅ (Recommended)

**Enable auto-merge:**
```bash
# In GitHub secrets
AUTO_CATALOG_MERGE=true
```

**When to enable:**
- High confidence in automation
- Frequent re-catalogs needed
- Well-tested vocabulary

**When to keep disabled:**
- Want human oversight
- Testing new rules
- Initial setup phase

---

## 📚 Full Documentation

- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - Complete dev guide
- **[RECATALOG_GUIDE.md](./docs/RECATALOG_GUIDE.md)** - Re-catalog details
- **[how-to-submit.md](./docs/contributing/how-to-submit.md)** - Contributor guide
- **[submission-schema.md](./docs/contributing/submission-schema.md)** - Schema reference

---

*Frame Codex: The OS for humans, the codex of humanity.*

