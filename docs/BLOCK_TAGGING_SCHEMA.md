# Block-Level Tagging Schema Reference

This document provides the technical schema reference for block-level tags in the Frame Codex.

## Frontmatter Schema

Block data is stored in the `blocks` array within each thread's YAML frontmatter:

```yaml
---
title: "Document Title"
id: "uuid-here"
# ... other frontmatter ...

blocks:
  - id: "introduction"
    line: 5
    endLine: 12
    type: heading
    headingLevel: 2
    headingText: "Introduction"
    tags:
      - javascript
      - getting-started
    suggestedTags:
      - tag: "es6"
        confidence: 0.78
        source: nlp
        reasoning: "TF-IDF keyword extraction"
    worthiness:
      score: 0.72
      signals:
        topicShift: 0.45
        entityDensity: 0.8
        semanticNovelty: 0.3
        structuralImportance: 0.85
    extractiveSummary: "This section introduces the basics of JavaScript..."
    warrantsIllustration: false
---
```

## Block Properties

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique block identifier (heading slug or `block-{line}`) |
| `line` | integer | Starting line number in the markdown file (1-indexed) |
| `type` | enum | Block type (see Block Types below) |

### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| `endLine` | integer | Ending line number (inclusive) |
| `headingLevel` | 1-6 | Heading level (only for `heading` type) |
| `headingText` | string | Heading text content |
| `tags` | string[] | Accepted/confirmed tags |
| `suggestedTags` | SuggestedTag[] | Pending tag suggestions |
| `worthiness` | Worthiness | Worthiness scoring data |
| `extractiveSummary` | string | Auto-generated summary (max 200 chars) |
| `warrantsIllustration` | boolean | Whether block benefits from visuals |

## Block Types

```yaml
type: heading | paragraph | code | list | blockquote | table | html
```

| Type | Description | Auto-detected |
|------|-------------|---------------|
| `heading` | H1-H6 markdown headings | Lines starting with `#` |
| `paragraph` | Text paragraphs | Default for text content |
| `code` | Fenced code blocks | Triple backticks ``` |
| `list` | Ordered/unordered lists | Lines starting with `-`, `*`, `1.` |
| `blockquote` | Quoted content | Lines starting with `>` |
| `table` | Markdown tables | Pipe-delimited content |
| `html` | Inline HTML | Lines starting with `<` |

## SuggestedTag Object

```yaml
suggestedTags:
  - tag: "typescript"
    confidence: 0.85
    source: nlp
    reasoning: "Detected TypeScript syntax in code block"
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tag` | string | Yes | The suggested tag |
| `confidence` | 0.0-1.0 | Yes | Confidence score |
| `source` | enum | Yes | Tag source (see Source Types below) |
| `reasoning` | string | No | Explanation for AI-suggested tags |

### Source Types

The `source` field indicates how a tag was generated:

| Source | Confidence | UI Color | Description |
|--------|------------|----------|-------------|
| `inline` | 1.0 | Blue | Explicit `#hashtag` written directly in content |
| `user` | 1.0 | Emerald | Manually confirmed by human contributors |
| `llm` | 0.5-0.95 | Violet | AI-suggested with chain-of-thought reasoning |
| `nlp` | 0.3-0.85 | Cyan | Vocabulary matching, TF-IDF keyword extraction |
| `existing` | 0.35-0.75 | Emerald | Propagated from document-level tags or prior blocks |

**Hybrid Tagging:** The system supports both inline and automatic tagging. Inline tags (explicit `#hashtag` in content) are extracted with 100% confidence and take precedence over NLP/LLM suggestions for the same tag. This allows authors to explicitly mark important tags while still benefiting from automatic suggestions.

## Worthiness Object

```yaml
worthiness:
  score: 0.72
  signals:
    topicShift: 0.45
    entityDensity: 0.8
    semanticNovelty: 0.3
    structuralImportance: 0.85
```

| Property | Type | Description |
|----------|------|-------------|
| `score` | 0.0-1.0 | Overall worthiness score |
| `signals.topicShift` | 0.0-1.0 | Topic divergence from previous block |
| `signals.entityDensity` | 0.0-1.0 | Named entity density |
| `signals.semanticNovelty` | 0.0-1.0 | Novelty relative to document |
| `signals.structuralImportance` | 0.0-1.0 | Importance based on structure |

## Block ID Generation

Block IDs are generated deterministically:

1. **Headings**: Slugified heading text
   - Input: `## Getting Started with JavaScript`
   - Output: `getting-started-with-javascript`

2. **Other blocks**: Line-based ID
   - Format: `block-{startLine}`
   - Example: `block-42`

### Slug Generation Rules

```javascript
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/[\s_]+/g, '-')    // Spaces/underscores to hyphens
    .replace(/^-+|-+$/g, '')    // Trim leading/trailing hyphens
    .slice(0, 50);              // Max 50 chars
}
```

## Validation

Frontmatter blocks are validated against the JSON Schema at:
`schema/strand.schema.yaml`

To validate manually:

```bash
node scripts/validate.js weaves/technology/my-strand.md
```

## Example: Complete Block Entry

```yaml
blocks:
  - id: "async-await-patterns"
    line: 45
    endLine: 78
    type: heading
    headingLevel: 3
    headingText: "Async/Await Patterns"
    tags:
      - javascript
      - async
      - es2017
      - patterns
    suggestedTags:
      - tag: "promises"
        confidence: 0.82
        source: nlp
        reasoning: "High TF-IDF score for 'Promise' mentions"
      - tag: "error-handling"
        confidence: 0.65
        source: llm
        reasoning: "Block discusses try/catch patterns with async"
    worthiness:
      score: 0.88
      signals:
        topicShift: 0.72
        entityDensity: 0.95
        semanticNovelty: 0.55
        structuralImportance: 0.85
    extractiveSummary: "This section covers modern async/await patterns in JavaScript, including error handling and sequential vs parallel execution."
    warrantsIllustration: true
```

## See Also

- [strand.schema.yaml](../schema/strand.schema.yaml) - Full frontmatter schema
- [blocks-index.schema.yaml](../schema/blocks-index.schema.yaml) - Index schema
- [Block Tagging Guide](./BLOCK_TAGGING_GUIDE.md) - User guide
- [Block Tagging API](./BLOCK_TAGGING_API.md) - API reference

