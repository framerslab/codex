---
id: 3fce914f-0801-45fd-b886-f0521aeeb4a1
slug: rename-fixture-architecture-overview
title: Rename fixture, architecture overview (the frontmatter shape of 2026-10-07)
summary: >-
  A copy of the frontmatter shape the corpus stores today, kept for the rename
  lane's compatibility test: the id, slug, title, summary, version, contentType,
  difficulty, taxonomy, tags, relationships, publishing and blocks keys.
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
links:
  references:
    - sql-cache-architecture
    - nlp-pipeline
    - automation-workflows
publishing:
  status: published
blocks:
  - id: rename-fixture-architecture-overview
    line: 2
    endLine: 2
    type: heading
    headingLevel: 1
    headingText: Rename fixture, architecture overview
    tags: []
    suggestedTags:
      - tag: architecture
        confidence: 0.7
        source: nlp
        reasoning: 'Vocabulary match: topics'
      - tag: strand
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
---

# Rename fixture, architecture overview

This file is a copy of the frontmatter shape the corpus stored on 2026-10-07 (the keys and nesting of
weaves/wiki/architecture/overview.md), with its own id, slug and title so the validator's duplicate check never sees
two records with one id. The rename lane's compatibility test reads it through scripts/validate.js and
scripts/auto-index.js and asserts the parsed record round-trips unchanged.
