# Frame Codex Development Guide

## Initial Setup & Cataloging

### First-Time Setup

1. **Install Dependencies**
```bash
cd apps/codex
npm install
```

2. **Run Initial Catalog** (categorizes ALL existing content)
```bash
npm run index -- --validate
```

This will:
- Scan all markdown files in `weaves/`, `docs/`, `wiki/`
- Extract keywords using TF-IDF
- Auto-categorize using NLP (no LLM, pure statistical)
- Generate `codex-index.json` (searchable index)
- Generate `codex-report.json` (analytics)
- Output validation errors/warnings/suggestions

**First run takes ~30 seconds for 100 files**

### How It Works Subsequently

**Automatic on Every PR Merge:**

1. GitHub Actions triggers `build-index.yml` on push to `main`
2. Runs `npm run index -- --validate` (static NLP only)
3. Generates updated index files
4. Pushes to `index` branch for consumption
5. **No AI/LLM calls** - pure TF-IDF, n-grams, vocabulary matching

**Static NLP Tools Used:**
- **TF-IDF**: Keyword extraction (no external API)
- **N-gram extraction**: Common phrases (local computation)
- **Vocabulary matching**: Controlled taxonomy (regex/string matching)
- **Readability scoring**: Flesch-Kincaid (formula-based)
- **Sentiment heuristics**: Simple keyword patterns

**Cost: $0** - All processing is local/in-CI

---

## Environment Variables & Secrets

### Required GitHub Secrets

Add to `framerslab/codex` repository settings:

```bash
# Required for auto-merge workflow
GH_PAT=ghp_xxxxxxxxxxxxxxxxxxxx  # GitHub Personal Access Token (repo scope)

# AI Enhancement (OPTIONAL - only if you want AI-powered PR analysis)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx

# Auto-merge control (default: false - requires manual approval)
AUTO_CATALOG_MERGE=false  # Set to 'true' to auto-merge re-catalog PRs

# Configuration (optional)
AI_PROVIDER=disabled  # Set to 'disabled' to skip AI entirely
```

### Secret Configuration

**To enable AI enhancement:**
```bash
OPENAI_API_KEY=sk-...
```

**To enable auto-merge for re-catalog PRs:**
```bash
AUTO_CATALOG_MERGE=true
# Default: false (requires manual approval)
# Recommended: keep false to review metadata changes
```

**To disable AI enhancement:**
```bash
AI_PROVIDER=disabled
# Or just don't set OPENAI_API_KEY
```

### Local Development

Create `.env` in `apps/codex/`:

```bash
# Optional - only for testing AI enhancement locally
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=openai
```

**Note:** The indexer and validator work WITHOUT any API keys. AI is only for optional PR enhancement.

---

## Triggering a Full Re-Catalog

### Method 1: Automated Script (Recommended)

```bash
cd apps/codex
chmod +x scripts/retrigger-full-catalog.sh

# Dry run first (see what would change)
./scripts/retrigger-full-catalog.sh --dry-run

# Create PR with changes (requires manual approval)
./scripts/retrigger-full-catalog.sh

# Force auto-merge (one-time override)
./scripts/retrigger-full-catalog.sh --auto-merge
```

**What it does:**
1. Runs full static NLP analysis on ALL files
2. Creates branch: `catalog/full-reindex-{timestamp}`
3. Commits updated index files
4. Creates PR with detailed summary
5. **Waits for manual approval** (unless `AUTO_CATALOG_MERGE=true`)

**Requirements:**
- `GH_PAT` environment variable

### Method 2: GitHub Actions Trigger

```bash
# Via GitHub CLI
gh workflow run build-index.yml --repo framerslab/codex

# Or via web UI
# Go to: https://github.com/framerslab/codex/actions/workflows/build-index.yml
# Click "Run workflow" → "Run workflow"
```

**What it does:**
- Runs indexer in CI
- Pushes directly to `index` branch (no PR)
- Updates live immediately

### Method 3: Local Re-Index

```bash
cd apps/codex
npm run index -- --validate

# Review changes
cat codex-report.json | jq '.summary'

# Commit manually
git add codex-index.json codex-report.json
git commit -m "chore: re-index all content"
git push
```

**See full guide:** [RECATALOG_GUIDE.md](./RECATALOG_GUIDE.md)

---

## Search Artifacts (BM25 + MiniLM embeddings)

Frame.dev’s advanced search UI consumes a separate static artifact, `codex-search.json`, which contains:

- BM25 postings (term → docId, term frequency)
- Document metadata (path, weave, loom, summary, doc length)
- Packed Float32 embeddings (all-MiniLM-L6-v2, mean pooled, normalized)

Generate it after the main index:

```bash
cd apps/codex
npm run build:search

# Commit alongside codex-index.json to publish updated search data
git add codex-search.json
```

This command uses `@xenova/transformers` entirely in Node.js (no Python, no API keys) and produces a fully static JSON blob that can be hosted on GitHub Pages or any CDN.

---

## SQL Cache Architecture

Frame Codex uses [@framers/sql-storage-adapter](https://github.com/framerslab/sql-storage-adapter) for intelligent incremental indexing.

### How It Works

**On First Run:**
1. Creates `.cache/codex.db` (better-sqlite3 in CI, IndexedDB in browser)
2. Analyzes ALL files with static NLP (TF-IDF, n-grams)
3. Stores: file path, SHA hash, mtime, analysis JSON, keywords
4. Generates `codex-index.json` and `codex-report.json`
5. **Time: ~30 seconds for 100 files**

**On Subsequent Runs:**
1. Reads cache database
2. Computes diff: `SELECT path, sha FROM files`
3. Compares current filesystem SHA vs cached SHA
4. Only re-processes changed files (added, modified)
5. Merges cached + new analyses
6. **Time: ~2-5 seconds for 5 changed files (85-95% speedup)**

### Cache Tables

```sql
-- File metadata and analysis cache
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  sha TEXT NOT NULL,           -- SHA-256 of content
  mtime INTEGER NOT NULL,       -- Last modified timestamp
  size INTEGER NOT NULL,        -- File size in bytes
  analysis TEXT NOT NULL,       -- JSON analysis result
  indexed_at INTEGER NOT NULL   -- When indexed
);

-- Keyword cache (for TF-IDF optimization)
CREATE TABLE keywords (
  file_path TEXT NOT NULL,
  keyword TEXT NOT NULL,
  tfidf_score REAL NOT NULL,
  frequency INTEGER NOT NULL,
  PRIMARY KEY (file_path, keyword)
);

-- Loom/Weave aggregate statistics
CREATE TABLE stats (
  scope TEXT PRIMARY KEY,       -- Loom or weave path
  scope_type TEXT NOT NULL,     -- 'loom' or 'weave'
  total_files INTEGER NOT NULL,
  total_keywords INTEGER NOT NULL,
  avg_difficulty TEXT,
  subjects TEXT,                -- JSON array
  topics TEXT,                  -- JSON array
  last_updated INTEGER NOT NULL
);
```

### Diff Algorithm

```javascript
// Pseudo-code
async function computeDiff(currentFiles) {
  const cached = await db.all('SELECT path, sha FROM files')
  const cachedMap = new Map(cached.map(f => [f.path, f.sha]))
  
  const added = []
  const modified = []
  const unchanged = []
  
  for (const file of currentFiles) {
    const currentSha = calculateSHA(readFile(file))
    const cachedSha = cachedMap.get(file)
    
    if (!cachedSha) {
      added.push(file)
    } else if (cachedSha !== currentSha) {
      modified.push(file)
    } else {
      unchanged.push(file)
    }
  }
  
  const deleted = [...cachedMap.keys()].filter(p => !currentFiles.includes(p))
  
  return { added, modified, deleted, unchanged }
}
```

### Cache Persistence

**GitHub Actions:**
```yaml
- uses: actions/cache@v4
  with:
    path: .cache/codex.db
    key: codex-cache-${{ hashFiles('weaves/**/*.md') }}
```

**Browser:**
- Automatic via IndexedDB (persistent across sessions)
- Quota managed by browser (typically 50MB-1GB)

### Configuration

```bash
# Disable SQL caching (use full indexing)
SQL_CACHE_DISABLED=true

# Clear cache before building
npm run index -- --clear-cache
```

---

## Smart File Placement Algorithm

### How It Works

When a file is uploaded/submitted, the system:

1. **Analyzes Content** (TF-IDF keywords, n-grams)
2. **Checks SQL Cache** for similar files in existing looms
3. **Matches Against Existing Looms**:
   - Compares keywords to cached loom vocabularies (from `stats` table)
   - Calculates similarity scores (cosine similarity)
   - Finds best-matching loom (threshold: 0.6)

3. **Decision Logic**:
   ```
   IF similarity > 0.8:
     → Place in existing loom (high confidence)
   ELSE IF similarity > 0.6:
     → Suggest existing loom + create new loom option
   ELSE:
     → Create new loom (content is sufficiently unique)
   ```

4. **Folder Structure**:
   ```
   weaves/
     [detected-weave]/        # Based on primary subject
       [topic-folder]/        # Any folder = loom (auto-detected)
         subtopic/
           [filename].md      # Strand (markdown file)
   ```

### Similarity Calculation

```javascript
// Pseudo-code
function findBestLoom(uploadedContent) {
  const uploadKeywords = extractKeywords(uploadedContent)
  
  for (const loom of existingLooms) {
    const loomKeywords = aggregateKeywords(loom.strands)
    const similarity = cosineSimilarity(uploadKeywords, loomKeywords)
    
    if (similarity > bestScore) {
      bestScore = similarity
      bestLoom = loom
    }
  }
  
  return { loom: bestLoom, confidence: bestScore }
}
```

### Re-Categorization on PR

**Automatic (Static NLP):**
- Runs on every PR
- Validates placement
- Suggests better loom if similarity is low
- Posts comment: "Consider moving to `weaves/<slug>/better-match/`"

**AI-Powered (Optional):**
- Only if `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set
- Analyzes semantic meaning (not just keywords)
- Suggests structural improvements
- **Only runs if PR author is a Weaver** (for auto-apply)

---

## Authentication & PR Flow

### No Server-Side Auth Needed!

**Client-Side Flow:**
1. User clicks "Submit" on frame.dev/codex
2. Provides GitHub Personal Access Token (stored in localStorage)
3. Client-side JS calls GitHub API directly
4. Creates PR with proper metadata
5. GitHub handles all auth via PAT

**Why This Works:**
- No backend server needed
- No database for user accounts
- GitHub is the auth provider
- Rate limiting via GitHub API limits

### PR Template Auto-Fill

When user clicks "Submit via GitHub":
```
https://github.com/framerslab/codex/compare/main...user:branch?
  quick_pull=1&
  title=Add: [Auto-Generated Title]&
  body=[Pre-filled PR template with metadata]
```

User just needs to:
1. Be logged into GitHub
2. Click "Create Pull Request"
3. Done!

---

## Caching & Performance Optimization

### Current Strategy

**Problem:** Re-analyzing entire weave on every PR is expensive

**Solution:** Incremental analysis with caching

### Loom-Scoped Analysis

```javascript
// Only analyze affected loom + neighbors
function analyzeAffectedContent(changedFile) {
  const loom = detectLoom(changedFile)
  const relatedLooms = findRelatedLooms(loom) // Based on shared tags
  
  // Only process these looms, not entire weave
  const scope = [loom, ...relatedLooms]
  
  return analyzeLooms(scope)
}
```

### Caching Strategy

**Cache Key:** `loom-id:last-modified-timestamp`

```javascript
// Check cache before processing
const cacheKey = `${loomId}:${lastModified}`
const cached = await redis.get(cacheKey)

if (cached) {
  return JSON.parse(cached)
}

// Process and cache
const result = await analyzeLoom(loom)
await redis.setex(cacheKey, 3600, JSON.stringify(result)) // 1 hour TTL
```

### Neighbor Detection

```javascript
function findRelatedLooms(loom) {
  const loomTags = loom.metadata.tags
  
  return allLooms.filter(otherLoom => {
    const sharedTags = intersection(loomTags, otherLoom.metadata.tags)
    return sharedTags.length >= 2 // At least 2 shared tags
  })
}
```

### Cost Optimization

**Without Caching:**
- 100 strands × 0.5s = 50 seconds per PR
- Expensive for large weaves

**With Loom-Scoped + Caching:**
- 1 loom (5 strands) × 0.5s = 2.5 seconds
- 2 related looms (10 strands) × 0.5s = 5 seconds
- **Total: ~7.5 seconds** (85% reduction)

**Cache Hit Rate:**
- Most PRs affect 1-2 looms
- Related looms rarely change simultaneously
- Expected hit rate: 70-80%
- **Effective time: ~2-3 seconds per PR**

### Implementation

Add to `scripts/auto-index.js`:

```javascript
class CachedIndexer extends CodexIndexer {
  constructor() {
    super()
    this.cache = new Map() // In-memory for CI, Redis for production
  }
  
  async processLoomIncremental(loomPath, changedFiles) {
    const loomId = path.basename(loomPath)
    const lastModified = this.getLastModified(loomPath)
    const cacheKey = `${loomId}:${lastModified}`
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      console.log(`✓ Cache hit: ${loomId}`)
      return this.cache.get(cacheKey)
    }
    
    // Process only changed strands + neighbors
    const affectedStrands = this.findAffectedStrands(loomPath, changedFiles)
    const result = await this.processStrands(affectedStrands)
    
    // Cache result
    this.cache.set(cacheKey, result)
    return result
  }
}
```

---

## Weave vs Loom Aggregation

### When to Aggregate

**Loom-Level (Always):**
- Total strands in loom
- Average difficulty
- Topic distribution
- Vocabulary frequency
- **Cost: O(n) where n = strands in loom**

**Weave-Level (On-Demand Only):**
- Total strands across all looms
- Cross-loom relationships
- Global vocabulary
- **Cost: O(n) where n = all strands in weave**

### Aggregation Strategy

```javascript
// Efficient: Aggregate only affected looms
function aggregateLoomStats(loom) {
  return {
    totalStrands: loom.strands.length,
    avgDifficulty: mean(loom.strands.map(s => s.difficulty)),
    topics: countBy(loom.strands, 'taxonomy.topics'),
    keywords: extractTopKeywords(loom.strands, 20)
  }
}

// Expensive: Only run on full re-index
function aggregateWeaveStats(weave) {
  return weave.looms.map(aggregateLoomStats).reduce(merge)
}
```

### When to Run Full Weave Aggregation

**Trigger Conditions:**
1. Manual full re-index (user-initiated)
2. New loom created (affects weave structure)
3. Loom deleted/moved
4. Weekly scheduled job (off-peak hours)

**NOT on:**
- Individual strand updates
- Metadata-only changes
- PR reviews/comments

---

## TypeScript vs JavaScript Decision

### Current: JavaScript ✅

**Pros:**
- Faster iteration (no compile step)
- Simpler CI (no build artifacts)
- Node.js native (no transpilation)
- Easier for contributors (lower barrier)
- Scripts run directly (`node script.js`)

**Cons:**
- No type safety
- Harder to refactor
- IDE autocomplete less reliable

### Should We Convert to TypeScript?

**Recommendation: Keep JavaScript for scripts, use TypeScript for UI**

**Rationale:**
- **Scripts** (`auto-index.js`, `validate.js`, `ai-enhance.js`):
  - Run in CI/Node.js directly
  - Simple, focused logic
  - Rarely refactored
  - **Keep as JS**

- **UI Components** (`codex-submit.tsx`, `codex-stats.tsx`):
  - Already TypeScript
  - Complex state management
  - Frequent updates
  - **Already TS ✓**

**If Converting Scripts to TS:**
```bash
# Would need:
npm install -D typescript @types/node ts-node
npx tsc scripts/*.ts --outDir dist/
node dist/auto-index.js
```

**Cost/Benefit:**
- Conversion effort: 2-4 hours
- Ongoing maintenance: +10% time
- Bug reduction: ~15-20%
- **Verdict: Not worth it for simple scripts**

---

## Complete Workflow Example

### Scenario: User Submits New Content

1. **User Action:**
   - Visits frame.dev/codex
   - Clicks "Contribute" → "Submit Content"
   - Pastes markdown or uploads file

2. **Client-Side Processing:**
   ```javascript
   // Extract keywords (TF-IDF)
   const keywords = extractKeywords(content)
   
   // Generate summary
   const summary = generateSummary(content)
   
   // Detect difficulty
   const difficulty = detectDifficulty(content)
   
   // Find best loom
   const { loom, confidence } = await findBestLoom(keywords)
   ```

3. **User Reviews Metadata:**
   - Auto-filled: title, summary, tags, difficulty
   - Suggested loom: `weaves/technology/programming/`
   - User can edit or accept

4. **PR Creation:**
   ```javascript
   // Create branch
   await github.git.createRef({
     ref: `refs/heads/submit/${Date.now()}`,
     sha: mainSha
   })
   
  // Add file
  await github.repos.createOrUpdateFileContents({
    path: `weaves/technology/programming/${slug}.md`,
     content: base64(frontmatter + content),
     branch: branchName
   })
   
   // Create PR
   await github.pulls.create({
     title: `Add: ${title}`,
     head: branchName,
     base: 'main'
   })
   ```

5. **Automated Validation (GitHub Actions):**
   ```yaml
   - Run schema validation
   - Run static NLP analysis
   - Check for duplicates
   - Verify loom placement
   - [Optional] Run AI enhancement
   ```

6. **Auto-Merge (If Weaver):**
   ```javascript
   if (isWeaver(author) && validationPassed) {
     await github.pulls.merge({ pull_number })
   }
   ```

7. **Index Rebuild:**
   ```bash
   npm run index -- --validate
   # Only processes affected loom + neighbors
   # Uses cached results for unchanged looms
   # Completes in ~3-5 seconds
   ```

8. **Live on Site:**
   - New index pushed to `index` branch
   - frame.dev/codex fetches updated index
   - Content searchable immediately

**Total Time: 10-30 seconds** (most of it is GitHub API calls)

---

## Monitoring & Debugging

### Check Index Health

```bash
cd apps/codex
npm run validate
npm run index -- --validate

# View report
cat codex-report.json | jq '.summary'
```

### Debug Categorization

```bash
# Test single file
node scripts/auto-index.js --files "weaves/tech/python/intro.md"

# View extracted keywords
node -e "
const indexer = require('./scripts/auto-index.js')
const content = require('fs').readFileSync('path/to/file.md', 'utf8')
console.log(indexer.extractKeywords(content))
"
```

### Monitor CI Performance

```bash
# View workflow runs
gh run list --workflow=build-index.yml --limit 10

# View specific run
gh run view <run-id> --log
```

---

## FAQ

**Q: Do I need API keys to use the indexer?**  
A: No. Static NLP works without any API keys. AI enhancement (OpenAI) is optional.

**Q: How much does AI enhancement cost?**  
A: Varies by content length:
   - 100-500 words: ~$0.01-0.03/PR
   - 500-2K words: ~$0.03-0.08/PR
   - 2K-10K words: ~$0.08-0.20/PR
   - 10K-100K words: ~$0.20-2.00/PR
   
   Can be disabled with `AI_PROVIDER=disabled`.

**Q: Can I run everything locally?**  
A: Yes. `npm run index` works offline. AI enhancement needs API keys.

**Q: How do I add a new subject/topic to vocabulary?**  
A: Edit `scripts/auto-index.js` → `VOCABULARY` object → commit.

**Q: What if the auto-categorization is wrong?**  
A: The AI/human reviewer can suggest a different loom in PR comments.

**Q: How do I become a Weaver?**  
A: Submit 5+ high-quality PRs. Maintainers will add you to `WEAVERS.txt`.

---

## Next Steps

1. ✅ Set up GitHub secrets (GH_PAT required, OPENAI_API_KEY optional)
2. ✅ Run initial catalog: `npm run index -- --validate`
3. ✅ Test submission UI at frame.dev/codex
4. ✅ Monitor first few PRs for accuracy
5. ✅ Add trusted contributors to WEAVERS.txt
6. ✅ Enable caching (Redis) for production scale

---


