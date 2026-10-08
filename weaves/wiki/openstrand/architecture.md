---
id: 3c3ac6d5-8cc2-4106-9f4a-4f6134c3d0b2
slug: openstrand-architecture
title: OpenQuarry Architecture – Condensed Overview
summary: >-
  A practical, implementation-focused overview of OpenStrand's architecture for
  ingestion and RAG.
version: 1.0.0
contentType: reference
difficulty:
  overall: advanced
  cognitive: 8
  prerequisites: 5
  conceptual: 8
taxonomy:
  subject:
    - computing
    - knowledge-systems
  topic:
    - openstrand
    - architecture
  subtopic:
    - api
    - pipelines
    - metadata
    - search
    - embeddings
  concepts:
    - term: strands
      weight: 0.8
    - term: looms
      weight: 0.6
    - term: weaves
      weight: 0.6
    - term: knowledge-graph
      weight: 0.8
    - term: ingestion
      weight: 0.7
relationships:
  - targetSlug: openstrand-ingestion
    type: follows
    strength: 0.7
    bidirectional: false
publishing:
  status: published
  license: MIT
blocks:
  - id: block-2
    line: 2
    endLine: 3
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.428
      signals:
        topicShift: 0.5
        entityDensity: 0.276
        semanticNovelty: 0.514
        structuralImportance: 0.445
  - id: key-ideas
    line: 4
    endLine: 4
    type: heading
    headingLevel: 2
    headingText: Key Ideas
    tags: []
    suggestedTags:
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.884
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.926
        structuralImportance: 0.95
  - id: block-5
    line: 5
    endLine: 8
    type: list
    tags: []
    suggestedTags:
      - tag: ingestion
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: graph
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: pipelines
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.536
      signals:
        topicShift: 1
        entityDensity: 0.254
        semanticNovelty: 0.314
        structuralImportance: 0.6
  - id: ingestion-mapping
    line: 10
    endLine: 10
    type: heading
    headingLevel: 2
    headingText: Ingestion Mapping
    tags: []
    suggestedTags:
      - tag: ingestion
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.825
      signals:
        topicShift: 0.916
        entityDensity: 0.667
        semanticNovelty: 0.889
        structuralImportance: 0.85
  - id: block-11
    line: 11
    endLine: 17
    type: list
    tags: []
    suggestedTags:
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: embeddings
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.534
      signals:
        topicShift: 1
        entityDensity: 0.246
        semanticNovelty: 0.313
        structuralImportance: 0.6
  - id: rag-search
    line: 19
    endLine: 19
    type: heading
    headingLevel: 2
    headingText: RAG & Search
    tags: []
    suggestedTags:
      - tag: rag
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.774
      signals:
        topicShift: 0.904
        entityDensity: 0.5
        semanticNovelty: 0.851
        structuralImportance: 0.85
  - id: block-20
    line: 20
    endLine: 22
    type: list
    tags: []
    suggestedTags:
      - tag: graph
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.51
      signals:
        topicShift: 0.869
        entityDensity: 0.268
        semanticNovelty: 0.561
        structuralImportance: 0.45
  - id: governance-seo
    line: 24
    endLine: 24
    type: heading
    headingLevel: 2
    headingText: Governance & SEO
    tags: []
    suggestedTags:
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.825
      signals:
        topicShift: 1
        entityDensity: 0.5
        semanticNovelty: 0.926
        structuralImportance: 0.9
  - id: block-25
    line: 25
    endLine: 26
    type: list
    tags: []
    suggestedTags:
      - tag: openstrand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.514
      signals:
        topicShift: 1
        entityDensity: 0.196
        semanticNovelty: 0.539
        structuralImportance: 0.45
---

This thread condenses the OpenQuarry Architecture into a short practitioner guide. For full details, see the comprehensive architecture document in the OpenQuarry repo and related threads in this loom.

## Key Ideas
- Threads: atomic assets (docs, media, datasets); Looms: curated groups of threads (folders); Weaves: entire universes of content. No cross-weave edges.
- Ingestion: parse frontmatter → validate → persist ECA → index (text + vector) → construct relations (within weave).
- Retrieval: combine lexical + semantic + graph edges; re-rank with pedagogical and structural signals.
- Pipelines: support multi-format content; normalize to Markdown + frontmatter; attach assets alongside strands.

## Ingestion Mapping
1. Read `weave.yaml` → create workspace scope  
2. Detect looms: any folder inside a weave is a loom (no `looms/` prefix needed)
3. For each thread (markdown file):
   - Extract frontmatter (id, slug, title, taxonomy, relationships)
   - Store Markdown and assets
   - Create edges only to threads in the same weave
4. Build search index + embeddings

## RAG & Search
- Flat inverted index for fast client-side search (GitHub Pages).
- Vector store for semantic similarity (server-side or local).
- Graph traversal to suggest next-items within a loom.

## Governance & SEO
- Short executive summaries; single-topic threads; stable anchors; internal links between strands.
- Controlled vocabulary in `tags/index.yaml`; CI validates tag usage and relationships.
