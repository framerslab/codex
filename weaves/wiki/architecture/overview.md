---
id: 8f4e7c3a-9b2d-4e1a-a5f6-1c8d9e0b2f3a
slug: codex-architecture-overview
title: Frame Codex Architecture Overview
summary: >-
  High-level architecture of Frame Codex: three-tier knowledge organization, SQL
  caching, static NLP, and automation
version: 1.0.0
contentType: markdown
difficulty: intermediate
taxonomy:
  subjects:
    - technology
    - knowledge
  topics:
    - architecture
    - getting-started
tags:
  - architecture
  - weave
  - loom
  - strand
  - sql-cache
  - nlp
relationships:
  references:
    - sql-cache-architecture
    - nlp-pipeline
    - automation-workflows
publishing:
  status: published
blocks:
  - id: frame-codex-architecture-overview
    line: 2
    endLine: 2
    type: heading
    headingLevel: 1
    headingText: Frame Codex Architecture Overview
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.787
      signals:
        topicShift: 0.5
        entityDensity: 0.8
        semanticNovelty: 0.686
        structuralImportance: 1
  - id: block-4
    line: 4
    endLine: 5
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.459
      signals:
        topicShift: 0.757
        entityDensity: 0.167
        semanticNovelty: 0.619
        structuralImportance: 0.405
  - id: core-concepts
    line: 6
    endLine: 6
    type: heading
    headingLevel: 2
    headingText: Core Concepts
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.893
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.968
        structuralImportance: 0.95
  - id: four-tier-knowledge-organization
    line: 8
    endLine: 8
    type: heading
    headingLevel: 3
    headingText: Four-Tier Knowledge Organization
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.808
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.877
        structuralImportance: 0.7
  - id: block-10
    line: 10
    endLine: 19
    type: code
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.657
      signals:
        topicShift: 1
        entityDensity: 0.446
        semanticNovelty: 0.502
        structuralImportance: 0.7
  - id: block-21
    line: 21
    endLine: 24
    type: list
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.501
      signals:
        topicShift: 0.826
        entityDensity: 0.203
        semanticNovelty: 0.551
        structuralImportance: 0.5
  - id: block-26
    line: 26
    endLine: 29
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.497
      signals:
        topicShift: 0.672
        entityDensity: 0.263
        semanticNovelty: 0.609
        structuralImportance: 0.5
  - id: block-31
    line: 31
    endLine: 34
    type: list
    tags: []
    suggestedTags:
      - tag: metadata
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.535
      signals:
        topicShift: 0.889
        entityDensity: 0.217
        semanticNovelty: 0.64
        structuralImportance: 0.5
  - id: block-36
    line: 36
    endLine: 39
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.471
      signals:
        topicShift: 0.567
        entityDensity: 0.22
        semanticNovelty: 0.64
        structuralImportance: 0.5
  - id: why-this-structure
    line: 41
    endLine: 41
    type: heading
    headingLevel: 3
    headingText: Why This Structure?
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.814
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.909
        structuralImportance: 0.7
  - id: block-43
    line: 43
    endLine: 48
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: ingestion
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.59
      signals:
        topicShift: 0.911
        entityDensity: 0.304
        semanticNovelty: 0.609
        structuralImportance: 0.6
  - id: superintelligence-at-fabric-scope
    line: 50
    endLine: 50
    type: heading
    headingLevel: 3
    headingText: Superintelligence at Fabric Scope
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.766
      signals:
        topicShift: 1
        entityDensity: 0.6
        semanticNovelty: 0.857
        structuralImportance: 0.7
  - id: block-52
    line: 52
    endLine: 53
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.423
      signals:
        topicShift: 0.874
        entityDensity: 0.083
        semanticNovelty: 0.628
        structuralImportance: 0.29
  - id: block-54
    line: 54
    endLine: 56
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: graph
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.508
      signals:
        topicShift: 0.863
        entityDensity: 0.167
        semanticNovelty: 0.682
        structuralImportance: 0.45
  - id: block-58
    line: 58
    endLine: 59
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.476
      signals:
        topicShift: 1
        entityDensity: 0.214
        semanticNovelty: 0.702
        structuralImportance: 0.235
  - id: sql-cache-layer
    line: 60
    endLine: 60
    type: heading
    headingLevel: 2
    headingText: SQL Cache Layer
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.864
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.896
        structuralImportance: 0.85
  - id: block-62
    line: 62
    endLine: 63
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.481
      signals:
        topicShift: 0.759
        entityDensity: 0.429
        semanticNovelty: 0.701
        structuralImportance: 0.235
  - id: performance
    line: 64
    endLine: 64
    type: heading
    headingLevel: 3
    headingText: Performance
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.766
      signals:
        topicShift: 1
        entityDensity: 0.5
        semanticNovelty: 0.978
        structuralImportance: 0.7
  - id: block-66
    line: 66
    endLine: 68
    type: list
    tags: []
    suggestedTags:
      - tag: rag
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.538
      signals:
        topicShift: 1
        entityDensity: 0.146
        semanticNovelty: 0.723
        structuralImportance: 0.45
  - id: how-it-works
    line: 70
    endLine: 70
    type: heading
    headingLevel: 3
    headingText: How It Works
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.82
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.937
        structuralImportance: 0.7
  - id: block-72
    line: 72
    endLine: 75
    type: list
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.605
      signals:
        topicShift: 1
        entityDensity: 0.371
        semanticNovelty: 0.688
        structuralImportance: 0.5
  - id: cache-tables
    line: 77
    endLine: 77
    type: heading
    headingLevel: 3
    headingText: Cache Tables
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.774
      signals:
        topicShift: 0.877
        entityDensity: 0.667
        semanticNovelty: 0.937
        structuralImportance: 0.7
  - id: block-79
    line: 79
    endLine: 83
    type: code
    tags: []
    suggestedTags:
      - tag: metadata
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.629
      signals:
        topicShift: 1
        entityDensity: 0.2
        semanticNovelty: 0.671
        structuralImportance: 0.7
  - id: static-nlp-pipeline
    line: 85
    endLine: 85
    type: heading
    headingLevel: 2
    headingText: Static NLP Pipeline
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.872
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.935
        structuralImportance: 0.85
  - id: block-87
    line: 87
    endLine: 87
    type: list
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.556
      signals:
        topicShift: 1
        entityDensity: 0.188
        semanticNovelty: 0.933
        structuralImportance: 0.35
  - id: block-89
    line: 89
    endLine: 93
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.638
      signals:
        topicShift: 1
        entityDensity: 0.37
        semanticNovelty: 0.762
        structuralImportance: 0.55
  - id: output
    line: 95
    endLine: 95
    type: heading
    headingLevel: 3
    headingText: Output
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.766
      signals:
        topicShift: 1
        entityDensity: 0.5
        semanticNovelty: 0.978
        structuralImportance: 0.7
  - id: block-97
    line: 97
    endLine: 98
    type: list
    tags: []
    suggestedTags:
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.534
      signals:
        topicShift: 1
        entityDensity: 0.292
        semanticNovelty: 0.604
        structuralImportance: 0.4
  - id: automation-workflows
    line: 100
    endLine: 100
    type: heading
    headingLevel: 2
    headingText: Automation Workflows
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.848
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.921
        structuralImportance: 0.85
  - id: on-every-pr
    line: 102
    endLine: 102
    type: heading
    headingLevel: 3
    headingText: On Every PR
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.828
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.978
        structuralImportance: 0.7
  - id: block-104
    line: 104
    endLine: 107
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: schema
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.596
      signals:
        topicShift: 1
        entityDensity: 0.31
        semanticNovelty: 0.718
        structuralImportance: 0.5
  - id: auto-merge-trusted-weavers
    line: 109
    endLine: 109
    type: heading
    headingLevel: 3
    headingText: Auto-Merge (Trusted Weavers)
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.79
      signals:
        topicShift: 0.902
        entityDensity: 0.75
        semanticNovelty: 0.888
        structuralImportance: 0.7
  - id: block-111
    line: 111
    endLine: 113
    type: list
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.523
      signals:
        topicShift: 0.742
        entityDensity: 0.206
        semanticNovelty: 0.826
        structuralImportance: 0.45
  - id: full-re-catalog
    line: 115
    endLine: 115
    type: heading
    headingLevel: 3
    headingText: Full Re-Catalog
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.799
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.937
        structuralImportance: 0.7
  - id: block-117
    line: 117
    endLine: 120
    type: list
    tags: []
    suggestedTags:
      - tag: metadata
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.622
      signals:
        topicShift: 1
        entityDensity: 0.341
        semanticNovelty: 0.809
        structuralImportance: 0.5
  - id: openstrand-integration
    line: 122
    endLine: 122
    type: heading
    headingLevel: 2
    headingText: OpenStrand Integration
    tags: []
    suggestedTags:
      - tag: openstrand
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.928
      signals:
        topicShift: 1
        entityDensity: 1
        semanticNovelty: 0.905
        structuralImportance: 0.85
  - id: block-124
    line: 124
    endLine: 125
    type: paragraph
    tags: []
    suggestedTags:
      - tag: education
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.572
      signals:
        topicShift: 1
        entityDensity: 0.556
        semanticNovelty: 0.738
        structuralImportance: 0.245
    extractiveSummary: >-
      Frame Codex implements the **Educational Content Atom (ECA)**
      specification:
  - id: block-126
    line: 126
    endLine: 131
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: design
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.655
      signals:
        topicShift: 1
        entityDensity: 0.342
        semanticNovelty: 0.799
        structuralImportance: 0.6
  - id: frame-codex-vs-openstrand
    line: 133
    endLine: 133
    type: heading
    headingLevel: 3
    headingText: Frame Codex vs OpenStrand
    tags: []
    suggestedTags:
      - tag: openstrand
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.772
      signals:
        topicShift: 1
        entityDensity: 0.8
        semanticNovelty: 0.637
        structuralImportance: 0.7
  - id: block-135
    line: 135
    endLine: 136
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.476
      signals:
        topicShift: 0.47
        entityDensity: 0.452
        semanticNovelty: 0.645
        structuralImportance: 0.4
  - id: repository-structure
    line: 138
    endLine: 138
    type: heading
    headingLevel: 2
    headingText: Repository Structure
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.81
      signals:
        topicShift: 0.838
        entityDensity: 0.667
        semanticNovelty: 0.889
        structuralImportance: 0.85
  - id: block-140
    line: 140
    endLine: 160
    type: code
    tags: []
    suggestedTags:
      - tag: openstrand
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: architecture
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: schema
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.577
      signals:
        topicShift: 1
        entityDensity: 0.191
        semanticNovelty: 0.419
        structuralImportance: 0.7
  - id: block-162
    line: 162
    endLine: 162
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.498
      signals:
        topicShift: 0.946
        entityDensity: 0.219
        semanticNovelty: 0.66
        structuralImportance: 0.35
  - id: learn-more
    line: 164
    endLine: 164
    type: heading
    headingLevel: 2
    headingText: Learn More
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.875
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.968
        structuralImportance: 0.9
  - id: block-166
    line: 166
    endLine: 168
    type: list
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: weave
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: loom
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: strand
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: sql-cache
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
      - tag: nlp
        confidence: 0.5
        source: existing
        reasoning: Propagated from document tags
    worthiness:
      score: 0.721
      signals:
        topicShift: 1
        entityDensity: 0.7
        semanticNovelty: 0.855
        structuralImportance: 0.5
---

# Frame Codex Architecture Overview

Frame Codex is a structured, version-controlled knowledge repository designed as the canonical source of truth for AI systems and human learners.

## Core Concepts

### Four-Tier Knowledge Organization

```
Fabric (Whole Codex)
└── Weave (Universe)
    ├── Loom (Folder)
    │   ├── Strand (markdown file)
    │   ├── Strand (markdown file)
    │   └── ...
    └── Loom (Folder)
        └── ...
```

**Fabric**: The entire Codex corpus viewed as one living whole
- Composed of multiple weaves (e.g., `frame`, `wiki`, `technology`)
- Enables cross-weave traversal when operating at Fabric scope
- Used by superintelligence/agents for holistic aggregation and synthesis

**Weave**: Complete, isolated knowledge universe
- No cross-weave relationships
- Independent scope and taxonomy
- Examples: `wiki`, `frame`, `technology`

**Loom**: Any folder inside a weave
- Organized by topic or module
- No explicit `looms/` prefix needed
- Metadata in optional `loom.yaml`

**Strand**: Any markdown file inside a weave
- Self-contained, focused on one concept
- Rich metadata in YAML frontmatter
- No explicit `strands/` folder needed

### Why This Structure?

1. **Modularity**: Each strand is independent and reusable
2. **Discoverability**: Looms (folders) provide natural organization
3. **Isolation**: Weaves prevent namespace collisions
4. **Scalability**: Can grow to millions of strands
5. **AI-Friendly**: Clear structure for LLM ingestion
6. **Simple**: Folders = looms, markdown files = strands (auto-detected)

### Superintelligence at Fabric Scope

While weaves remain isolated for organization and provenance, analysis at the **Fabric** level permits traversal across weaves for:

- Cross-domain retrieval and context assembly
- Whole-of-corpus synthesis and summarization
- Global topic maps and knowledge graphs

Fabric-level queries always preserve original weave/loom/strand provenance.

## SQL Cache Layer

Frame Codex uses [@framers/sql-storage-adapter](https://github.com/framerslab/sql-storage-adapter) for intelligent caching.

### Performance

- **First run**: ~30s for 100 files (full analysis)
- **Subsequent**: ~2-5s for 5 changed files (85-95% speedup)
- **Storage**: ~500KB-2MB for 100 files

### How It Works

1. **SHA-based change detection**: Only re-process modified files
2. **Loom-scoped caching**: Store aggregate stats per loom (folder)
3. **Keyword caching**: Pre-computed TF-IDF scores
4. **GitHub Actions cache**: Persistent across CI runs

### Cache Tables

```sql
files       -- File metadata, SHA, analysis JSON
keywords    -- Extracted keywords with TF-IDF scores
stats       -- Loom/weave aggregate statistics
```

## Static NLP Pipeline

**No LLM calls, $0 cost, runs in CI:**

1. **TF-IDF**: Keyword extraction and ranking
2. **N-grams**: Common phrase detection
3. **Vocabulary matching**: Auto-categorization
4. **Readability scoring**: Flesch-Kincaid grade level
5. **Sentiment heuristics**: Simple keyword patterns

### Output

- `codex-index.json`: Searchable index for frame.dev/codex
- `codex-report.json`: Analytics and validation results

## Automation Workflows

### On Every PR

1. **Schema validation**: Required fields, types, enums
2. **Content quality**: Length, forbidden patterns, duplicates
3. **Static NLP**: Auto-categorization and tagging
4. **Optional AI**: GPT-4 quality analysis (if `OPENAI_API_KEY` set)

### Auto-Merge (Trusted Weavers)

- Users in `.github/WEAVERS.txt` get auto-approved + merged
- Requires 5+ high-quality contributions
- Validation must pass

### Full Re-Catalog

- Triggered manually or on schedule
- Updates all metadata and statistics
- Creates PR (manual approval by default)
- Toggle: `AUTO_CATALOG_MERGE=true`

## OpenStrand Integration

Frame Codex implements the **Educational Content Atom (ECA)** specification:

- **Learning Design**: Objectives, outcomes, Bloom's taxonomy
- **Time Estimates**: Reading, exercises, projects
- **Modalities**: Text, visual, audio, video, kinesthetic
- **Assessments**: Formative and summative
- **Accessibility**: WCAG compliance, reading levels
- **Quality Metrics**: Peer review, evidence-based claims

### Frame Codex vs OpenStrand

- **Frame Codex**: Public markdown repository (this repo)
- **OpenStrand**: Full PKMS at openstrand.ai (all file types, AI analysis, private workspaces)

## Repository Structure

```
codex/
├── weaves/              # Knowledge universes
│   ├── wiki/           # Meta-documentation
│   │   ├── weave.yaml
│   │   ├── architecture/    # Loom (folder)
│   │   │   └── overview.md  # Strand (markdown file)
│   │   └── ...
│   ├── frame/          # Frame ecosystem knowledge
│   │   ├── weave.yaml
│   │   ├── openstrand/      # Loom (folder)
│   │   │   └── architecture.md  # Strand (markdown file)
│   │   └── ...
│   └── technology/     # Tech & CS content
├── schema/             # Validation schemas
├── docs/               # Development guides
├── scripts/            # Automation scripts
├── tests/              # Test suite
└── .github/
    └── workflows/      # CI/CD automation
```

**Note:** Looms and strands are auto-detected from folder structure. No explicit `looms/` or `strands/` folders needed.

## Learn More

- [Changelog System](../../docs/CHANGELOG_SYSTEM.md)
- [Development Guide](../../docs/DEVELOPMENT.md)
- [How to Submit](../../docs/contributing/how-to-submit.md)
