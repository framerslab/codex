---
blocks:
  - id: qa-system-architecture
    line: 1
    endLine: 1
    type: heading
    headingLevel: 1
    headingText: Q&A System Architecture
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
    worthiness:
      score: 0.746
      signals:
        topicShift: 0.5
        entityDensity: 0.5
        semanticNovelty: 0.855
        structuralImportance: 1
  - id: block-3
    line: 3
    endLine: 4
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.471
      signals:
        topicShift: 0.789
        entityDensity: 0.139
        semanticNovelty: 0.554
        structuralImportance: 0.48
  - id: philosophy-questions-as-knowledge-traversal
    line: 5
    endLine: 5
    type: heading
    headingLevel: 2
    headingText: 'Philosophy: Questions as Knowledge Traversal'
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.865
      signals:
        topicShift: 0.851
        entityDensity: 0.75
        semanticNovelty: 0.874
        structuralImportance: 0.95
  - id: block-7
    line: 7
    endLine: 8
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.474
      signals:
        topicShift: 0.861
        entityDensity: 0.148
        semanticNovelty: 0.59
        structuralImportance: 0.42
  - id: core-architecture
    line: 9
    endLine: 9
    type: heading
    headingLevel: 2
    headingText: Core Architecture
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
    worthiness:
      score: 0.849
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.922
        structuralImportance: 0.85
  - id: block-11
    line: 11
    endLine: 35
    type: code
    tags: []
    suggestedTags:
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.611
      signals:
        topicShift: 1
        entityDensity: 0.208
        semanticNovelty: 0.569
        structuralImportance: 0.7
  - id: components
    line: 37
    endLine: 37
    type: heading
    headingLevel: 2
    headingText: Components
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.819
      signals:
        topicShift: 1
        entityDensity: 0.5
        semanticNovelty: 0.984
        structuralImportance: 0.85
  - id: 1-question-input-interface
    line: 39
    endLine: 39
    type: heading
    headingLevel: 3
    headingText: 1. Question Input Interface
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.771
      signals:
        topicShift: 1
        entityDensity: 0.7
        semanticNovelty: 0.755
        structuralImportance: 0.7
  - id: block-41
    line: 41
    endLine: 42
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.46
      signals:
        topicShift: 1
        entityDensity: 0.15
        semanticNovelty: 0.676
        structuralImportance: 0.25
  - id: block-43
    line: 43
    endLine: 46
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.446
      signals:
        topicShift: 0.706
        entityDensity: 0
        semanticNovelty: 0.649
        structuralImportance: 0.5
  - id: 2-question-processor
    line: 48
    endLine: 48
    type: heading
    headingLevel: 3
    headingText: 2. Question Processor
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.742
      signals:
        topicShift: 0.869
        entityDensity: 0.625
        semanticNovelty: 0.833
        structuralImportance: 0.7
  - id: block-50
    line: 50
    endLine: 51
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.516
      signals:
        topicShift: 1
        entityDensity: 0.25
        semanticNovelty: 0.865
        structuralImportance: 0.23
    extractiveSummary: 'Transforms natural language into structured queries:'
  - id: intent-analyzer
    line: 52
    endLine: 52
    type: heading
    headingLevel: 4
    headingText: Intent Analyzer
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.744
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.922
        structuralImportance: 0.55
  - id: block-53
    line: 53
    endLine: 55
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.615
      signals:
        topicShift: 1
        entityDensity: 0.38
        semanticNovelty: 0.812
        structuralImportance: 0.45
  - id: entity-extractor
    line: 57
    endLine: 57
    type: heading
    headingLevel: 4
    headingText: Entity Extractor
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.75
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.955
        structuralImportance: 0.55
  - id: block-58
    line: 58
    endLine: 60
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.584
      signals:
        topicShift: 1
        entityDensity: 0.327
        semanticNovelty: 0.722
        structuralImportance: 0.45
  - id: 3-semantic-search-engine
    line: 62
    endLine: 62
    type: heading
    headingLevel: 3
    headingText: 3. Semantic Search Engine
    tags: []
    suggestedTags:
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.782
      signals:
        topicShift: 1
        entityDensity: 0.7
        semanticNovelty: 0.809
        structuralImportance: 0.7
  - id: block-64
    line: 64
    endLine: 65
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.521
      signals:
        topicShift: 1
        entityDensity: 0.3
        semanticNovelty: 0.835
        structuralImportance: 0.225
    extractiveSummary: 'The heart of intelligent retrieval:'
  - id: onnx-runtime-web
    line: 66
    endLine: 66
    type: heading
    headingLevel: 4
    headingText: ONNX Runtime Web
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.755
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.873
        structuralImportance: 0.55
  - id: block-67
    line: 67
    endLine: 70
    type: list
    tags: []
    suggestedTags:
      - tag: embeddings
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.573
      signals:
        topicShift: 1
        entityDensity: 0.192
        semanticNovelty: 0.747
        structuralImportance: 0.5
  - id: embedding-index
    line: 72
    endLine: 72
    type: heading
    headingLevel: 4
    headingText: Embedding Index
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.735
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.878
        structuralImportance: 0.55
  - id: block-73
    line: 73
    endLine: 76
    type: list
    tags: []
    suggestedTags:
      - tag: rag
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: graph
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: embeddings
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: indexing
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.571
      signals:
        topicShift: 1
        entityDensity: 0.208
        semanticNovelty: 0.718
        structuralImportance: 0.5
  - id: similarity-scoring
    line: 78
    endLine: 78
    type: heading
    headingLevel: 4
    headingText: Similarity Scoring
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.737
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.889
        structuralImportance: 0.55
  - id: block-79
    line: 79
    endLine: 82
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.5
      signals:
        topicShift: 0.737
        entityDensity: 0.161
        semanticNovelty: 0.684
        structuralImportance: 0.5
  - id: 4-answer-builder
    line: 84
    endLine: 84
    type: heading
    headingLevel: 3
    headingText: 4. Answer Builder
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.775
      signals:
        topicShift: 1
        entityDensity: 0.625
        semanticNovelty: 0.866
        structuralImportance: 0.7
  - id: block-86
    line: 86
    endLine: 87
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.563
      signals:
        topicShift: 1
        entityDensity: 0.375
        semanticNovelty: 0.961
        structuralImportance: 0.22
    extractiveSummary: 'Constructs comprehensive, contextual responses:'
  - id: block-88
    line: 88
    endLine: 92
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
    worthiness:
      score: 0.6
      signals:
        topicShift: 1
        entityDensity: 0.203
        semanticNovelty: 0.785
        structuralImportance: 0.55
  - id: data-flow
    line: 94
    endLine: 94
    type: heading
    headingLevel: 2
    headingText: Data Flow
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.851
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.933
        structuralImportance: 0.85
  - id: block-96
    line: 96
    endLine: 118
    type: code
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
      - tag: rag
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: graph
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.653
      signals:
        topicShift: 1
        entityDensity: 0.37
        semanticNovelty: 0.579
        structuralImportance: 0.7
  - id: embedding-generation
    line: 120
    endLine: 120
    type: heading
    headingLevel: 2
    headingText: Embedding Generation
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.826
      signals:
        topicShift: 0.92
        entityDensity: 0.667
        semanticNovelty: 0.889
        structuralImportance: 0.85
  - id: pre-processing-pipeline
    line: 122
    endLine: 122
    type: heading
    headingLevel: 3
    headingText: Pre-processing Pipeline
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.801
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.945
        structuralImportance: 0.7
  - id: block-124
    line: 124
    endLine: 137
    type: code
    tags: []
    suggestedTags:
      - tag: metadata
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.654
      signals:
        topicShift: 1
        entityDensity: 0.338
        semanticNovelty: 0.625
        structuralImportance: 0.7
  - id: chunking-strategy
    line: 139
    endLine: 139
    type: heading
    headingLevel: 3
    headingText: Chunking Strategy
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.805
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.967
        structuralImportance: 0.7
  - id: block-141
    line: 141
    endLine: 144
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.569
      signals:
        topicShift: 1
        entityDensity: 0.219
        semanticNovelty: 0.696
        structuralImportance: 0.5
  - id: user-experience-design
    line: 146
    endLine: 146
    type: heading
    headingLevel: 2
    headingText: User Experience Design
    tags: []
    suggestedTags:
      - tag: design
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
    worthiness:
      score: 0.865
      signals:
        topicShift: 1
        entityDensity: 0.75
        semanticNovelty: 0.9
        structuralImportance: 0.85
  - id: question-bar
    line: 148
    endLine: 148
    type: heading
    headingLevel: 3
    headingText: Question Bar
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.781
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.844
        structuralImportance: 0.7
  - id: block-150
    line: 150
    endLine: 158
    type: code
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.636
      signals:
        topicShift: 1
        entityDensity: 0.25
        semanticNovelty: 0.642
        structuralImportance: 0.7
  - id: answer-cards
    line: 160
    endLine: 160
    type: heading
    headingLevel: 3
    headingText: Answer Cards
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.785
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.866
        structuralImportance: 0.7
  - id: block-162
    line: 162
    endLine: 163
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.454
      signals:
        topicShift: 0.711
        entityDensity: 0.188
        semanticNovelty: 0.904
        structuralImportance: 0.24
  - id: block-164
    line: 164
    endLine: 191
    type: code
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: architecture
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: rag
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.626
      signals:
        topicShift: 1
        entityDensity: 0.269
        semanticNovelty: 0.567
        structuralImportance: 0.7
  - id: conversational-flow
    line: 193
    endLine: 193
    type: heading
    headingLevel: 3
    headingText: Conversational Flow
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.776
      signals:
        topicShift: 0.887
        entityDensity: 0.667
        semanticNovelty: 0.933
        structuralImportance: 0.7
  - id: block-195
    line: 195
    endLine: 196
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.465
      signals:
        topicShift: 1
        entityDensity: 0.188
        semanticNovelty: 0.673
        structuralImportance: 0.24
  - id: block-197
    line: 197
    endLine: 203
    type: code
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
    worthiness:
      score: 0.646
      signals:
        topicShift: 0.936
        entityDensity: 0.267
        semanticNovelty: 0.734
        structuralImportance: 0.7
  - id: performance-optimization
    line: 205
    endLine: 205
    type: heading
    headingLevel: 2
    headingText: Performance Optimization
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.86
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.978
        structuralImportance: 0.85
  - id: client-side-caching
    line: 207
    endLine: 207
    type: heading
    headingLevel: 3
    headingText: Client-Side Caching
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.803
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.955
        structuralImportance: 0.7
  - id: block-209
    line: 209
    endLine: 211
    type: list
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: embeddings
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.57
      signals:
        topicShift: 1
        entityDensity: 0.26
        semanticNovelty: 0.736
        structuralImportance: 0.45
  - id: progressive-enhancement
    line: 213
    endLine: 213
    type: heading
    headingLevel: 3
    headingText: Progressive Enhancement
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.807
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.978
        structuralImportance: 0.7
  - id: block-215
    line: 215
    endLine: 217
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
    worthiness:
      score: 0.611
      signals:
        topicShift: 1
        entityDensity: 0.395
        semanticNovelty: 0.774
        structuralImportance: 0.45
  - id: resource-management
    line: 219
    endLine: 219
    type: heading
    headingLevel: 3
    headingText: Resource Management
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.805
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.967
        structuralImportance: 0.7
  - id: block-221
    line: 221
    endLine: 228
    type: code
    tags: []
    suggestedTags:
      - tag: ai
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.686
      signals:
        topicShift: 1
        entityDensity: 0.31
        semanticNovelty: 0.816
        structuralImportance: 0.7
  - id: implementation-phases
    line: 230
    endLine: 230
    type: heading
    headingLevel: 2
    headingText: Implementation Phases
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.853
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.944
        structuralImportance: 0.85
  - id: phase-1-foundation-current
    line: 232
    endLine: 232
    type: heading
    headingLevel: 3
    headingText: 'Phase 1: Foundation (Current)'
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.786
      signals:
        topicShift: 1
        entityDensity: 0.6
        semanticNovelty: 0.955
        structuralImportance: 0.7
  - id: block-233
    line: 233
    endLine: 236
    type: list
    tags: []
    suggestedTags:
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.608
      signals:
        topicShift: 1
        entityDensity: 0.341
        semanticNovelty: 0.739
        structuralImportance: 0.5
  - id: phase-2-intelligence
    line: 238
    endLine: 238
    type: heading
    headingLevel: 3
    headingText: 'Phase 2: Intelligence'
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.79
      signals:
        topicShift: 1
        entityDensity: 0.625
        semanticNovelty: 0.944
        structuralImportance: 0.7
  - id: block-239
    line: 239
    endLine: 242
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.637
      signals:
        topicShift: 1
        entityDensity: 0.4
        semanticNovelty: 0.811
        structuralImportance: 0.5
  - id: phase-3-advanced
    line: 244
    endLine: 244
    type: heading
    headingLevel: 3
    headingText: 'Phase 3: Advanced'
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.792
      signals:
        topicShift: 1
        entityDensity: 0.625
        semanticNovelty: 0.955
        structuralImportance: 0.7
  - id: block-245
    line: 245
    endLine: 248
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.643
      signals:
        topicShift: 1
        entityDensity: 0.4
        semanticNovelty: 0.841
        structuralImportance: 0.5
  - id: privacy-security
    line: 250
    endLine: 250
    type: heading
    headingLevel: 2
    headingText: Privacy & Security
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.802
      signals:
        topicShift: 1
        entityDensity: 0.5
        semanticNovelty: 0.9
        structuralImportance: 0.85
  - id: data-protection
    line: 252
    endLine: 252
    type: heading
    headingLevel: 3
    headingText: Data Protection
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.805
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.967
        structuralImportance: 0.7
  - id: block-253
    line: 253
    endLine: 256
    type: list
    tags: []
    suggestedTags:
      - tag: rag
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: embeddings
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.58
      signals:
        topicShift: 1
        entityDensity: 0.182
        semanticNovelty: 0.797
        structuralImportance: 0.5
  - id: model-security
    line: 258
    endLine: 258
    type: heading
    headingLevel: 3
    headingText: Model Security
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.783
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.855
        structuralImportance: 0.7
  - id: block-259
    line: 259
    endLine: 261
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.566
      signals:
        topicShift: 0.838
        entityDensity: 0.283
        semanticNovelty: 0.852
        structuralImportance: 0.45
  - id: api-design
    line: 263
    endLine: 263
    type: heading
    headingLevel: 2
    headingText: API Design
    tags: []
    suggestedTags:
      - tag: design
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.837
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.866
        structuralImportance: 0.85
  - id: question-api
    line: 265
    endLine: 265
    type: heading
    headingLevel: 3
    headingText: Question API
    tags: []
    suggestedTags:
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.665
      signals:
        topicShift: 0.5
        entityDensity: 0.667
        semanticNovelty: 0.766
        structuralImportance: 0.7
  - id: block-267
    line: 267
    endLine: 287
    type: code
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.726
      signals:
        topicShift: 0.8
        entityDensity: 0.771
        semanticNovelty: 0.639
        structuralImportance: 0.7
  - id: answer-api
    line: 289
    endLine: 289
    type: heading
    headingLevel: 3
    headingText: Answer API
    tags: []
    suggestedTags:
      - tag: api
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.772
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.8
        structuralImportance: 0.7
  - id: block-291
    line: 291
    endLine: 314
    type: code
    tags: []
    suggestedTags:
      - tag: metadata
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.682
      signals:
        topicShift: 0.933
        entityDensity: 0.51
        semanticNovelty: 0.616
        structuralImportance: 0.7
  - id: future-enhancements
    line: 316
    endLine: 316
    type: heading
    headingLevel: 2
    headingText: Future Enhancements
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.86
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.978
        structuralImportance: 0.85
  - id: multimodal-qa
    line: 318
    endLine: 318
    type: heading
    headingLevel: 3
    headingText: Multimodal Q&A
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.725
      signals:
        topicShift: 1
        entityDensity: 0.333
        semanticNovelty: 0.984
        structuralImportance: 0.7
  - id: block-319
    line: 319
    endLine: 321
    type: list
    tags: []
    suggestedTags:
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.581
      signals:
        topicShift: 1
        entityDensity: 0.26
        semanticNovelty: 0.793
        structuralImportance: 0.45
  - id: collaborative-intelligence
    line: 323
    endLine: 323
    type: heading
    headingLevel: 3
    headingText: Collaborative Intelligence
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.805
      signals:
        topicShift: 1
        entityDensity: 0.667
        semanticNovelty: 0.967
        structuralImportance: 0.7
  - id: block-324
    line: 324
    endLine: 326
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.606
      signals:
        topicShift: 1
        entityDensity: 0.3
        semanticNovelty: 0.869
        structuralImportance: 0.45
  - id: predictive-qa
    line: 328
    endLine: 328
    type: heading
    headingLevel: 3
    headingText: Predictive Q&A
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.725
      signals:
        topicShift: 1
        entityDensity: 0.333
        semanticNovelty: 0.984
        structuralImportance: 0.7
  - id: block-329
    line: 329
    endLine: 331
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.577
      signals:
        topicShift: 1
        entityDensity: 0.2
        semanticNovelty: 0.848
        structuralImportance: 0.45
  - id: conclusion
    line: 333
    endLine: 333
    type: heading
    headingLevel: 2
    headingText: Conclusion
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.819
      signals:
        topicShift: 1
        entityDensity: 0.5
        semanticNovelty: 0.984
        structuralImportance: 0.85
  - id: block-335
    line: 335
    endLine: 338
    type: paragraph
    tags: []
    suggestedTags:
      - tag: design
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subjects'
      - tag: search
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: subtopics'
    worthiness:
      score: 0.536
      signals:
        topicShift: 1
        entityDensity: 0.169
        semanticNovelty: 0.595
        structuralImportance: 0.5
    extractiveSummary: >-
      The Frame Codex Q&A system transforms the act of questioning from mere
      retrieval into a journey of discovery
  - id: block-339
    line: 339
    endLine: 339
    type: list
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.54
      signals:
        topicShift: 1
        entityDensity: 0
        semanticNovelty: 1
        structuralImportance: 0.4
  - id: block-341
    line: 341
    endLine: 346
    type: paragraph
    tags: []
    suggestedTags: []
    worthiness:
      score: 0.459
      signals:
        topicShift: 0.5
        entityDensity: 0.367
        semanticNovelty: 0.768
        structuralImportance: 0.325
---
# Q&A System Architecture

The Frame Codex Q&A system represents a paradigm shift in knowledge retrieval—combining the precision of semantic search with the intuition of natural language understanding. This document outlines the architecture, implementation, and philosophy behind our question-answering oracle.

## Philosophy: Questions as Knowledge Traversal

Traditional search treats queries as keyword matching exercises. The Frame Codex Q&A system treats **questions as journeys through the knowledge graph**. When you ask "How does authentication work?", you're not looking for documents containing "authentication"—you're seeking understanding of a concept's mechanics, relationships, and implications.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Question   │  │   Suggested  │  │  Answer Cards   │  │
│  │    Input     │  │  Questions   │  │  (Contextual)   │  │
│  └──────┬──────┘  └──────────────┘  └─────────▲────────┘  │
└─────────┼────────────────────────────────────────┼──────────┘
          │                                         │
┌─────────▼─────────────────────────────────────────┼──────────┐
│                    Question Processor              │          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────▼────────┐ │
│  │   Intent     │  │   Entity     │  │  Answer Builder   │ │
│  │  Analyzer    │  │  Extractor   │  │  (Multi-source)   │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────▲────────┘ │
└─────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                   │
┌─────────▼─────────────────▼───────────────────┼──────────┐
│                  Semantic Search Engine         │          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────▼────────┐ │
│  │   ONNX       │  │  Embedding   │  │  Similarity    │ │
│  │  Runtime     │  │   Index      │  │   Scoring      │ │
│  └──────────────┘  └──────────────┘  └────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

## Components

### 1. Question Input Interface

The entry point for natural language queries with intelligent features:

- **Auto-complete** based on common questions and recent queries
- **Voice input** with real-time transcription
- **Question templates** for common patterns
- **Multi-language** support with automatic translation

### 2. Question Processor

Transforms natural language into structured queries:

#### Intent Analyzer
- Classifies question types: How, What, Where, Why, When
- Identifies action verbs: implement, configure, debug, optimize
- Detects scope: specific file, concept, or system-wide

#### Entity Extractor
- Identifies key concepts: authentication, React hooks, API endpoints
- Extracts constraints: "in TypeScript", "for production", "with examples"
- Recognizes relationships: "difference between X and Y"

### 3. Semantic Search Engine

The heart of intelligent retrieval:

#### ONNX Runtime Web
- Runs MiniLM-L6-v2 model entirely in the browser
- No server calls = complete privacy
- ~22MB model size with 384-dimensional embeddings
- Sub-100ms inference time

#### Embedding Index
- Pre-computed embeddings for all threads
- Stored in `codex-embeddings.json`
- Hierarchical indexing: thread → section → paragraph
- Incremental updates on new content

#### Similarity Scoring
- Cosine similarity for semantic matching
- BM25 for keyword relevance
- Hybrid scoring: 0.7 × semantic + 0.3 × keyword
- Context window expansion for better answers

### 4. Answer Builder

Constructs comprehensive, contextual responses:

- **Multi-source synthesis**: Combines relevant sections from multiple threads
- **Code extraction**: Highlights relevant code snippets
- **Visual aids**: Includes diagrams and images when helpful
- **Related links**: Suggests deeper reading
- **Confidence scoring**: Shows relevance percentage

## Data Flow

```
1. User asks: "How do I implement authentication with JWT?"
   ↓
2. Intent: HOW_TO + IMPLEMENT
   Entities: ["authentication", "JWT"]
   Constraints: ["implementation"]
   ↓
3. Query embedding: [0.23, -0.45, 0.67, ...] (384 dims)
   ↓
4. Search index for nearest neighbors
   - auth-jwt-guide.md (0.92 similarity)
   - security-best-practices.md (0.87 similarity)
   - api-design.md (0.76 similarity)
   ↓
5. Extract relevant sections + expand context
   ↓
6. Build answer with:
   - Summary paragraph
   - Step-by-step implementation
   - Code examples
   - Security considerations
   - Links to full strands
```

## Embedding Generation

### Pre-processing Pipeline

```typescript
interface EmbeddingEntry {
  id: string              // Unique identifier
  path: string           // Strand path
  content: string        // Text content
  embedding: number[]    // 384-dimensional vector
  metadata: {
    type: 'strand' | 'section' | 'code'
    title: string
    tags: string[]
    lastModified: string
  }
}
```

### Chunking Strategy

1. **Thread-level**: Entire document for overview matching
2. **Section-level**: Markdown headers create natural boundaries
3. **Semantic chunks**: ~500 tokens with 50-token overlap
4. **Code blocks**: Treated as atomic units with language tags

## User Experience Design

### Question Bar

```
┌─────────────────────────────────────────────────────────┐
│ 🔮  Ask anything about the Codex...                [🎤] │
│                                                          │
│ Suggested: How does the spiral curriculum work?         │
│           What is a strand in Frame Codex?              │
│           Show me authentication examples               │
└─────────────────────────────────────────────────────────┘
```

### Answer Cards

Each answer presents as a beautifully designed card:

```
┌─────────────────────────────────────────────────────────┐
│ ❓ How does authentication work in Frame Codex?         │
├─────────────────────────────────────────────────────────┤
│ 📊 Confidence: 94%  |  🔍 4 sources  |  ⏱️ 0.3s        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Frame Codex uses a GitHub-based authentication flow:    │
│                                                          │
│ 1. **Personal Access Tokens (PATs)** for API access    │
│ 2. **Encrypted client-side storage** for security      │
│ 3. **OAuth flow** for web authentication (coming soon) │
│                                                          │
│ ```typescript                                           │
│ // Example: Setting up authentication                   │
│ import { GitSync } from '@/lib/github/gitSync'         │
│                                                          │
│ const sync = new GitSync()                              │
│ await sync.initialize() // Uses stored PAT             │
│ ```                                                      │
│                                                          │
│ 📚 **Learn More:**                                      │
│ • [Security Architecture](/codex/security/overview)     │
│ • [API Authentication](/codex/api/auth)                 │
│ • [GitHub Integration](/codex/guides/github)            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Conversational Flow

The Q&A system maintains context for follow-up questions:

```
User: "What is a strand?"
Bot:  [Explains strand concept]

User: "How do I create one?"  // "one" understood as "strand"
Bot:  [Shows creation process with context from previous answer]
```

## Performance Optimization

### Client-Side Caching

- **Embedding cache**: Store computed embeddings in IndexedDB
- **Answer cache**: LRU cache for recent Q&A pairs
- **Prefetch strategy**: Load embeddings for visible threads

### Progressive Enhancement

1. **Instant**: Keyword search (BM25) returns immediately
2. **Fast**: Cached embeddings search (~50ms)
3. **Complete**: Fresh embedding computation (~200ms)

### Resource Management

```typescript
// Lazy loading of ONNX runtime
const loadSemanticSearch = async () => {
  const ort = await import('onnxruntime-web')
  const model = await fetch('/models/minilm-l6-v2.onnx')
  return new SemanticSearchEngine(ort, model)
}
```

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Basic keyword search
- [ ] ONNX runtime integration
- [ ] Embedding pre-computation
- [ ] Simple Q&A interface

### Phase 2: Intelligence
- [ ] Intent classification
- [ ] Multi-source answers
- [ ] Code extraction
- [ ] Conversational context

### Phase 3: Advanced
- [ ] Voice input/output
- [ ] Multi-language support
- [ ] Learning from feedback
- [ ] Personalization

## Privacy & Security

### Data Protection
- **No server calls**: All processing happens in-browser
- **No tracking**: Questions are never logged or sent externally
- **Local storage**: Embeddings cached with encryption
- **Opt-in sync**: Choose to share improved embeddings

### Model Security
- **Integrity check**: Verify model hash before loading
- **Sandboxed execution**: ONNX runs in isolated context
- **Resource limits**: Prevent DoS via computation

## API Design

### Question API

```typescript
interface Question {
  text: string
  context?: QuestionContext
  language?: string
  options?: QuestionOptions
}

interface QuestionContext {
  previousQuestions?: Question[]
  currentStrand?: string
  userIntent?: Intent
}

interface QuestionOptions {
  maxResults?: number
  minConfidence?: number
  includeCode?: boolean
  includeDiagrams?: boolean
}
```

### Answer API

```typescript
interface Answer {
  summary: string
  confidence: number
  sources: AnswerSource[]
  sections: AnswerSection[]
  relatedQuestions: string[]
  processingTime: number
}

interface AnswerSource {
  path: string
  title: string
  relevance: number
  excerpt: string
}

interface AnswerSection {
  type: 'text' | 'code' | 'list' | 'diagram'
  content: string
  language?: string
  metadata?: Record<string, any>
}
```

## Future Enhancements

### Multimodal Q&A
- Ask questions about images: "What does this diagram show?"
- Voice-first interaction: Complete hands-free experience
- Video segment search: Find specific moments in recordings

### Collaborative Intelligence
- Community-refined answers
- Expert annotations
- Crowd-sourced question templates

### Predictive Q&A
- Anticipate questions based on reading patterns
- Proactive knowledge suggestions
- Learning path generation

## Conclusion

The Frame Codex Q&A system transforms the act of questioning from mere retrieval into a journey of discovery. By combining semantic understanding with thoughtful UX design, we create an oracle that doesn't just find answers—it builds understanding.

Every question becomes a thread in the fabric of knowledge, weaving new connections and revealing hidden patterns. This is not just search. This is enlightenment.

---

metadata:
title: Q&A System Architecture
tags: [architecture, search, semantic, ONNX, NLP]
created: 2024-01-20
status: active
