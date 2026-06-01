# Block-Level Tagging Tutorial

This step-by-step tutorial walks you through the complete block-level tagging workflow.

## Prerequisites

- Node.js 18+
- pnpm installed
- Git configured
- (Optional) OpenAI or Anthropic API key for AI enhancement

## Part 1: Setup

### Clone the Repository

```bash
git clone https://github.com/framerslab/codex.git
cd codex
pnpm install
```

### Verify Installation

```bash
node scripts/block-processor.js --help
```

You should see usage information.

## Part 2: Processing Your First Strand

### Create a Sample Strand

Create `weaves/tutorial/my-first-strand.md`:

```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"
slug: "my-first-strand"
title: "My First Strand"
version: "1.0.0"
contentType: reference
taxonomy:
  topic:
    - tutorial
    - block-tagging
---

# My First Strand

This is a tutorial document about block-level tagging.

## Introduction

Block-level tagging allows granular metadata at the section level.
This enables precise search and navigation within documents.

## Key Concepts

### Worthiness Scoring

Not every block needs tags. The system calculates a "worthiness score":

- **Topic Shift**: How much does this block change topic?
- **Entity Density**: How many named entities are present?
- **Semantic Novelty**: How unique is this content?
- **Structural Importance**: Is this a heading? A code block?

### Tag Sources

Tags can come from multiple sources:

1. **NLP Pipeline** - Vocabulary matching and TF-IDF
2. **AI Enhancement** - LLM-based suggestions
3. **Existing Tags** - Propagated from document level
4. **User Contributions** - Manual tag additions

## Code Example

Here's a simple JavaScript example:

```javascript
function calculateWorthiness(block) {
  const signals = {
    topicShift: analyzeTopicShift(block),
    entityDensity: countEntities(block),
    semanticNovelty: measureNovelty(block),
    structuralImportance: scoreStructure(block)
  };
  
  return weightedAverage(signals);
}
```

## Conclusion

Block-level tagging provides granular metadata for better search,
navigation, and knowledge organization.
```

### Process the Strand

Run the block processor:

```bash
node scripts/block-processor.js weaves/tutorial/my-first-strand.md
```

Output:
```
🔧 Block Processor
   Mode: WRITE

📄 Processing file: weaves/tutorial/my-first-strand.md
  ✅ Updated my-first-strand.md
     - 8 blocks
     - 5 worthy blocks
```

### View the Results

Open the file and check the frontmatter:

```yaml
blocks:
  - id: "my-first-strand"
    line: 11
    endLine: 11
    type: heading
    headingLevel: 1
    headingText: "My First Strand"
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.85
      signals:
        topicShift: 0.5
        entityDensity: 0.3
        semanticNovelty: 0.5
        structuralImportance: 1
  # ... more blocks
```

## Part 3: Generating Tag Suggestions

### Run the Tag Suggester

```bash
node lib/block-tagging.js weaves/tutorial/my-first-strand.md
```

Output:
```
🏷️  Block Tagger
   Mode: WRITE

[block-tagging] Loaded vocabulary: 234 terms

📄 Processing file: weaves/tutorial/my-first-strand.md
  ✅ my-first-strand.md: 12 suggestions across 8 blocks
```

### Review Suggestions

Check the updated frontmatter:

```yaml
blocks:
  - id: "key-concepts"
    line: 17
    endLine: 28
    type: heading
    headingLevel: 2
    headingText: "Key Concepts"
    tags: []
    suggestedTags:
      - tag: "block-tagging"
        confidence: 0.85
        source: nlp
        reasoning: "Vocabulary match (topic)"
      - tag: "worthiness"
        confidence: 0.72
        source: nlp
        reasoning: "TF-IDF keyword extraction"
    worthiness:
      score: 0.78
```

## Part 4: AI Enhancement (Optional)

### Set Up API Key

```bash
export OPENAI_API_KEY=sk-your-key-here
```

### Run AI Enhancement

```bash
node scripts/ai-enhance-blocks.js weaves/tutorial/my-first-strand.md --max-cost 1.00
```

Output:
```
🤖 AI Block Enhancer
   Provider: openai
   Model: gpt-4o-mini
   Max Cost: $1.00
   Mode: WRITE

📚 Loaded 234 vocabulary terms

📄 Processing file: weaves/tutorial/my-first-strand.md
  ✅ my-first-strand.md: 5/8 blocks enhanced

📊 Summary:
   Blocks processed: 5
   Total cost: $0.0234
```

### Review AI Suggestions

```yaml
suggestedTags:
  - tag: "machine-learning"
    confidence: 0.82
    source: llm
    reasoning: "The worthiness scoring signals (topic shift, semantic novelty) are concepts commonly used in ML-based content analysis."
```

## Part 5: Building the Index

### Generate codex-blocks.json

```bash
pnpm run index
```

Output:
```
✅ Wrote index.json with 150 strands.
✅ Wrote codex-index.json
✅ Wrote codex-blocks.json
   📊 Block Stats:
      - Strands with blocks: 150
      - Total blocks: 2340
      - Total block tags: 5670
      - Unique tags: 234
      - Worthy blocks (≥0.5): 1890
      - Pending suggestions: 456
```

### Inspect the Index

```bash
cat codex-blocks.json | jq '.stats'
```

## Part 6: Contributing Tags

### Accept Suggestions Manually

Edit the strand frontmatter to move suggestions to tags:

```yaml
blocks:
  - id: "key-concepts"
    tags:
      - block-tagging     # Moved from suggestedTags
      - worthiness        # Moved from suggestedTags
    suggestedTags: []     # Cleared
```

### Submit Changes

```bash
git add weaves/tutorial/my-first-strand.md
git commit -m "docs(tutorial): add block tags to my-first-strand"
git push
```

Or submit a PR if you forked the repo.

## Part 7: Automation with GitHub Actions

The repository has automated workflows:

### Auto-Index (on push)

When you push changes to `weaves/`:
1. Blocks are processed
2. Tags are suggested
3. Index is rebuilt
4. JSON files are committed

### AI Enhancement (manual trigger)

1. Go to Actions → "AI Enhance Block Tags"
2. Click "Run workflow"
3. Set max cost and provider
4. Review the PR with AI suggestions

## Part 8: Viewing in Frame.dev

### Open the Viewer

1. Go to [quarry.space](https://quarry.space)
2. Navigate to your strand
3. Click the **Blocks** tab

### What You'll See

- Block list with types and line numbers
- Worthiness scores with visual bars
- Accepted tags (green pills)
- Pending suggestions (amber pills)
- Extractive summaries

## Next Steps

1. **Process more strands**: Run `node scripts/block-processor.js --all`
2. **Improve vocabulary**: Add terms to `tags/index.yaml`
3. **Review suggestions**: Accept or reject pending tags
4. **Contribute**: Submit PRs with tag improvements

## Troubleshooting

### No blocks generated?

- Check that your file has proper markdown structure
- Ensure frontmatter is valid YAML
- Run with `--dry-run` first to preview

### AI enhancement failing?

- Verify API key is set correctly
- Check rate limits and quotas
- Try a different model: `--model gpt-4o-mini`

### Index not updating?

- Rebuild manually: `pnpm run index`
- Check for YAML syntax errors
- Validate with: `node scripts/validate.js`

## See Also

- [Block Tagging Guide](./BLOCK_TAGGING_GUIDE.md)
- [Block Tagging Schema](./BLOCK_TAGGING_SCHEMA.md)
- [Block Tagging API](./BLOCK_TAGGING_API.md)

