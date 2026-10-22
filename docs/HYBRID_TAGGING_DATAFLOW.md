# Hybrid Tagging Data Flow

This document describes the complete data flow for the hybrid block tagging system, which combines **inline hashtags** with **automatic NLP/AI suggestions**.

## Overview

The hybrid tagging system supports two complementary approaches:

| Approach | Source | Confidence | Color | Description |
|----------|--------|------------|-------|-------------|
| **Inline Tags** | `inline` | 1.0 (100%) | Blue | Explicit `#hashtag` written in content |
| **NLP Tags** | `nlp` | 0.3-0.85 | Cyan | Vocabulary matching, TF-IDF extraction |
| **LLM Tags** | `llm` | 0.5-0.95 | Violet | AI-suggested with reasoning |
| **Existing Tags** | `existing` | 0.35-0.75 | Emerald | Propagated from document-level tags |
| **User Tags** | `user` | 1.0 (100%) | Emerald | Manually confirmed by contributors |

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARKDOWN SOURCE                                   │
│  weaves/technology/react-hooks.md                                          │
│  ─────────────────────────────────────────────────                         │
│  # React Hooks Guide                                                        │
│                                                                             │
│  This section covers useState and useEffect. #react #hooks #frontend       │
│                                                                             │
│  ## Custom Hooks                                                            │
│  Building reusable hooks for state management...                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         block-processor.js                                  │
│  ─────────────────────────────────────────────────────────                 │
│  • Parses markdown into semantic blocks (headings, paragraphs, code, etc.) │
│  • Calculates worthiness scores for each block                              │
│  • Writes block metadata to frontmatter YAML                                │
│                                                                             │
│  Worthiness Signals:                                                        │
│  ├── topicShift (20%) - Divergence from previous content                   │
│  ├── entityDensity (25%) - Named entities, technical terms                 │
│  ├── semanticNovelty (20%) - Distance from document centroid               │
│  └── structuralImportance (35%) - Heading level, position                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          block-tagging.js                                   │
│  ─────────────────────────────────────────────────────────                 │
│                                                                             │
│  PHASE 1: Extract Inline Tags (100% confidence)                            │
│  ├── Pattern: /#([a-zA-Z][a-zA-Z0-9_/-]*)/g                               │
│  ├── Skips: #h1-#h6 (markdown heading patterns)                            │
│  └── Deduplicates: Same tag only appears once per block                    │
│                                                                             │
│  PHASE 2: NLP Suggestions (vocabulary matching)                             │
│  ├── Vocabulary lookup from tags/index.yaml                                 │
│  ├── TF-IDF keyword extraction                                              │
│  └── Document tag propagation                                               │
│                                                                             │
│  PHASE 3: Merge & Deduplicate                                               │
│  ├── Inline tags take precedence (confidence 1.0)                          │
│  └── NLP duplicates filtered if same tag exists as inline                  │
│                                                                             │
│  Output: suggestedTags[] with source, confidence, reasoning                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      (Optional) ai-enhance-blocks.js                        │
│  ─────────────────────────────────────────────────────────                 │
│  • Uses OpenAI/Anthropic API for deeper analysis                            │
│  • Adds chain-of-thought reasoning to suggestions                           │
│  • Confidence: 0.5-0.95 based on LLM certainty                             │
│  • Cost-controlled with --max-cost flag                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTMATTER STORAGE                               │
│  ─────────────────────────────────────────────────────────                 │
│  ---                                                                        │
│  title: "React Hooks Guide"                                                 │
│  blocks:                                                                    │
│    - id: "react-hooks-guide"                                               │
│      line: 1                                                                │
│      type: heading                                                          │
│      headingLevel: 1                                                        │
│      tags: []                                                               │
│      suggestedTags:                                                         │
│        - tag: "react"                                                       │
│          confidence: 1.0                                                    │
│          source: inline                                                     │
│          reasoning: "Explicit inline hashtag in content"                    │
│        - tag: "hooks"                                                       │
│          confidence: 1.0                                                    │
│          source: inline                                                     │
│          reasoning: "Explicit inline hashtag in content"                    │
│        - tag: "frontend"                                                    │
│          confidence: 1.0                                                    │
│          source: inline                                                     │
│          reasoning: "Explicit inline hashtag in content"                    │
│        - tag: "state-management"                                            │
│          confidence: 0.78                                                   │
│          source: nlp                                                        │
│          reasoning: "TF-IDF keyword extraction"                             │
│      worthiness:                                                            │
│        score: 0.82                                                          │
│        signals:                                                             │
│          topicShift: 0.0                                                    │
│          entityDensity: 0.9                                                 │
│          semanticNovelty: 0.5                                               │
│          structuralImportance: 1.0                                          │
│  ---                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          build-index.mjs                                    │
│  ─────────────────────────────────────────────────────────                 │
│  • Scans all weaves for strands with blocks                                 │
│  • Compiles frontmatter blocks into unified index                           │
│  • Builds inverted tag index for fast lookup                                │
│  • Tracks statistics by source type                                         │
│                                                                             │
│  Output: codex-blocks.json                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         codex-blocks.json                                   │
│  ─────────────────────────────────────────────────────────                 │
│  {                                                                          │
│    "generatedAt": "2025-01-08T...",                                        │
│    "version": "1.0.0",                                                      │
│    "stats": {                                                               │
│      "totalStrands": 14,                                                    │
│      "totalBlocks": 1166,                                                   │
│      "totalTags": 2340,                                                     │
│      "uniqueTags": 156,                                                     │
│      "tagsBySource": {                                                      │
│        "inline": 89,                                                        │
│        "nlp": 1842,                                                         │
│        "llm": 234,                                                          │
│        "existing": 175,                                                     │
│        "user": 0                                                            │
│      }                                                                      │
│    },                                                                       │
│    "tagIndex": {                                                            │
│      "react": [                                                             │
│        { "strandPath": "weaves/tech/react-hooks.md", "blockId": "..." }    │
│      ]                                                                      │
│    },                                                                       │
│    "strands": { ... }                                                       │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions Workflow                             │
│  ─────────────────────────────────────────────────────────                 │
│  .github/workflows/auto-index.yml                                           │
│                                                                             │
│  Triggers: a push that changes weaves/, scripts/ or schema/; a dispatch     │
│                                                                             │
│  Steps:                                                                     │
│  1. Checkout repository                                                     │
│  2. Setup pnpm and Node.js                                                  │
│  3. Install dependencies                                                    │
│  4. Process blocks                                                          │
│     └── node scripts/block-processor.js --all                               │
│  5. Generate tag suggestions                                                │
│     └── node lib/block-tagging.js --all                                     │
│  6. Build codex-index.json and codex-search.json                            │
│     └── pnpm run index; pnpm run build:search                               │
│  7. Upload artifacts                                                        │
│  8. On master: open or update the pull request from ci/codex-index          │
│                                                                             │
│  It does not run npm run build:index, so codex-blocks.json keeps the        │
│  build last committed to master                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frame.dev Frontend                                │
│  ─────────────────────────────────────────────────────────                 │
│                                                                             │
│  useBlockTags.ts                                                            │
│  ├── Fetches codex-blocks.json from GitHub raw URL                         │
│  └── Falls back to /index/blocks.json                                      │
│                                                                             │
│  blockDatabase.ts                                                           │
│  ├── Indexes blocks into SQLite (browser)                                  │
│  ├── Provides query functions (by tag, by strand, full-text)               │
│  └── Tracks tag statistics by level (doc vs block)                         │
│                                                                             │
│  BlockTagsSidebarPanel.tsx                                                  │
│  ├── Displays blocks grouped by type                                        │
│  ├── Shows tag badges with source colors                                    │
│  ├── Info tooltip explains source types                                     │
│  └── Allows filtering by worthiness, type, tags                            │
│                                                                             │
│  BlockTagsDisplay.tsx                                                       │
│  └── Renders individual tag badges with source-specific colors             │
│      ├── inline: Blue (bg-blue-500/20 text-blue-400)                       │
│      ├── llm: Violet (bg-violet-500/20 text-violet-400)                    │
│      ├── nlp: Cyan (bg-cyan-500/20 text-cyan-400)                          │
│      └── existing: Emerald (bg-emerald-500/20 text-emerald-400)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Inline Tag Pattern

```javascript
// Pattern for extracting inline hashtags from content
// Matches: #react, #frontend-dev, #web/javascript
// Does NOT match: #123 (must start with letter), markdown headings (#h1-#h6)
const INLINE_TAG_PATTERN = /#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
```

### Valid Inline Tags

| Pattern | Valid | Notes |
|---------|-------|-------|
| `#react` | Yes | Simple tag |
| `#frontend-dev` | Yes | Kebab-case |
| `#web/javascript` | Yes | Hierarchical |
| `#React_Hooks` | Yes | Mixed case (normalized to lowercase) |
| `#123` | No | Must start with letter |
| `#h2` | No | Reserved for markdown headings |
| `##heading` | No | Markdown heading syntax |

## Deduplication Logic

When the same tag appears from multiple sources:

1. **Inline tags win** - If a tag appears inline, NLP/LLM suggestions for the same tag are filtered out
2. **Higher confidence wins** - Among NLP/LLM sources, the higher confidence suggestion is kept
3. **All sources tracked** - Statistics track all sources for analytics, even if some are filtered from output

```javascript
// Deduplication order
const tagPriority = {
  'inline': 1,  // Highest priority
  'user': 2,
  'llm': 3,
  'nlp': 4,
  'existing': 5  // Lowest priority
};
```

## CLI Commands

```bash
# Process all strands (parses markdown into blocks)
node scripts/block-processor.js --all

# Process specific strand
node scripts/block-processor.js weaves/technology/react-hooks.md

# Generate tag suggestions (inline + NLP)
node lib/block-tagging.js --all

# AI enhancement (requires API key)
export OPENAI_API_KEY=sk-...
node scripts/ai-enhance-blocks.js --all --max-cost 5.00

# Build final index
npm run build:index

# View stats
cat codex-blocks.json | jq '.stats'
```

## Example: Same Tag from Multiple Sources

```markdown
This paragraph explains React hooks for state management. #react #hooks

The hooks API provides useState and useEffect for component state.
```

**Block 1 suggestedTags:**
```yaml
- tag: react
  confidence: 1.0
  source: inline      # Wins - explicit user intent
  reasoning: "Explicit inline hashtag in content"
- tag: hooks
  confidence: 1.0
  source: inline      # Wins - explicit user intent
  reasoning: "Explicit inline hashtag in content"
- tag: state-management
  confidence: 0.82
  source: nlp         # Included - no inline duplicate
  reasoning: "TF-IDF keyword extraction"
# Note: NLP might also suggest "react" but it's filtered (inline already has it)
```

**Block 2 suggestedTags:**
```yaml
- tag: react
  confidence: 0.78
  source: nlp         # Included - no inline in this block
  reasoning: "Vocabulary match in tags/index.yaml"
- tag: hooks
  confidence: 0.75
  source: nlp
  reasoning: "Context propagation from document"
```

## See Also

- [Block Tagging Guide](./BLOCK_TAGGING_GUIDE.md) - User guide for tagging
- [Block Tagging Schema](./BLOCK_TAGGING_SCHEMA.md) - Technical schema reference
- [Block Tagging API](./BLOCK_TAGGING_API.md) - Index format and endpoints
- [NLP Vocabulary System](./NLP_VOCABULARY_SYSTEM.md) - How vocabulary matching works
