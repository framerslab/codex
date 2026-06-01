# Block-Level Tagging Guide

This guide explains how the block-level tagging system works in the Frame Codex and how to contribute tag suggestions.

## What are Block-Level Tags?

Block-level tags provide granular metadata for specific sections within a document, rather than just document-level tags. Each "block" represents a semantic unit:

- **Headings** (H1-H6)
- **Paragraphs** (conceptual sections)
- **Code blocks** (with language detection)
- **Lists** (ordered and unordered)
- **Blockquotes** (citations, callouts)
- **Tables** (data structures)

## Why Block-Level Tagging?

1. **Precise Search** - Find the exact section you need, not just the document
2. **Smart Navigation** - Jump directly to relevant content
3. **Knowledge Graphs** - Build relationships between specific concepts
4. **AI Enhancement** - Better context for RAG and summarization
5. **Learning Paths** - Create sequences of specific blocks, not just documents

## How Tags Are Generated

Block tags are generated through a pipeline:

```
Markdown File
     ↓
┌─────────────────────┐
│  block-processor.js │  ← Parses into blocks, calculates worthiness
└─────────────────────┘
     ↓
┌─────────────────────┐
│  block-tagging.js   │  ← Suggests tags from vocabulary
└─────────────────────┘
     ↓
┌─────────────────────┐
│  ai-enhance-blocks  │  ← (Optional) AI refinement
└─────────────────────┘
     ↓
┌─────────────────────┐
│  build-index.mjs    │  ← Compiles into codex-blocks.json
└─────────────────────┘
```

## Hybrid Tagging: Inline + NLP

The block tagging system supports **two complementary approaches** that work together:

### Inline Tags (Explicit)
Write hashtags directly in your markdown content:

```markdown
This paragraph explains React hooks for state management. #react #hooks #frontend
```

**Inline tags features:**
- Extracted with **100% confidence** (explicit user intent)
- Source type: `inline`
- Displayed with a **blue** badge in the UI
- Take precedence over NLP suggestions for the same tag
- Pattern: `#tag-name`, `#hierarchical/tag`, `#kebab-case-tag`

### NLP Tags (Automatic)
The system automatically suggests tags via:
- Vocabulary matching against `tags/index.yaml`
- TF-IDF keyword extraction
- Document tag propagation
- Language detection for code blocks

### Hybrid Behavior
When the same tag appears both inline and via NLP:
1. The inline version takes precedence (confidence 1.0)
2. NLP duplicates are filtered out
3. Both sources are tracked in stats

## Worthiness Scoring

Not every block needs tags. The system calculates a "worthiness score" (0-1) based on:

| Signal | Weight | Description |
|--------|--------|-------------|
| Topic Shift | 20% | How much the block diverges from previous content |
| Entity Density | 25% | Named entities, technical terms, code references |
| Semantic Novelty | 20% | Distance from document's overall topic |
| Structural Importance | 35% | Heading level, position, block type |

Blocks with worthiness ≥ 0.5 are prioritized for tagging.

## Tag Sources

Tags come from multiple sources, each with a confidence score:

| Source | Confidence | Color | Description |
|--------|------------|-------|-------------|
| `inline` | 1.0 | Blue | Explicit #hashtag written in content |
| `user` | 1.0 | Emerald | Manually confirmed by contributors |
| `llm` | 0.5-0.95 | Violet | AI-suggested with chain-of-thought reasoning |
| `nlp` | 0.3-0.85 | Cyan | Vocabulary matching, TF-IDF extraction |
| `existing` | 0.35-0.75 | Emerald | Propagated from document tags, prior blocks |

## Reading Block Tags in the Viewer

In the Frame.dev viewer (quarry.space):

1. Open any strand document
2. Click the **Blocks** tab in the right sidebar
3. View all blocks with their:
   - Type and position (line numbers)
   - Worthiness score
   - Accepted tags (green)
   - Pending suggestions (amber)
   - Extractive summary

## Contributing Tag Suggestions

Since block tags are stored in the Codex repository (not the browser), contributions are made via GitHub:

### Option 1: GitHub Issue

1. Click "Contribute tags" in the Blocks tab
2. Select a block and review its suggestions
3. Accept, reject, or add new tags
4. Submit as a GitHub issue

### Option 2: Direct PR

1. Fork the [framerslab/codex](https://github.com/framerslab/codex) repository
2. Edit the strand's frontmatter:

```yaml
---
title: "My Document"
blocks:
  - id: "introduction"
    line: 5
    endLine: 12
    type: heading
    headingLevel: 2
    headingText: "Introduction"
    tags:
      - javascript
      - web-development
    suggestedTags: []  # Clear suggestions once reviewed
    worthiness:
      score: 0.72
---
```

3. Submit a PR with your changes

## CLI Tools

### Process Blocks

```bash
# Process all strands
node scripts/block-processor.js --all

# Process specific file
node scripts/block-processor.js weaves/technology/javascript-basics.md

# Dry run (preview only)
node scripts/block-processor.js --all --dry-run
```

### Generate Tag Suggestions

```bash
# Suggest tags for all strands
node lib/block-tagging.js --all

# Specific file
node lib/block-tagging.js weaves/technology/javascript-basics.md
```

### AI Enhancement (requires API key)

```bash
# Set your API key
export OPENAI_API_KEY=sk-...

# Run AI enhancement
node scripts/ai-enhance-blocks.js --all --max-cost 5.00

# Use Anthropic instead
export ANTHROPIC_API_KEY=sk-ant-...
node scripts/ai-enhance-blocks.js --provider anthropic
```

## Best Practices

### DO:
- Accept suggestions that genuinely apply to the content
- Add tags from the controlled vocabulary when possible
- Provide reasoning for non-obvious tag additions
- Review suggestions in context (read the actual block content)

### DON'T:
- Tag every block - only worthy ones
- Add overly specific or redundant tags
- Remove tags without clear justification
- Auto-accept all AI suggestions without review

## Vocabulary

Tags should preferably come from the controlled vocabulary in `tags/index.yaml`:

```yaml
subjects:
  technology:
    topics:
      web-development:
        subtopics:
          - javascript
          - typescript
          - react
          - nodejs
```

Custom tags are allowed but may require vocabulary PR approval.

## See Also

- [Block Tagging Schema](./BLOCK_TAGGING_SCHEMA.md) - Technical schema reference
- [Block Tagging API](./BLOCK_TAGGING_API.md) - Index format and endpoints
- [Block Tagging Tutorial](./BLOCK_TAGGING_TUTORIAL.md) - Step-by-step walkthrough
- [NLP Vocabulary System](./NLP_VOCABULARY_SYSTEM.md) - How vocabulary works

