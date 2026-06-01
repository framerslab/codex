---
id: submission-schema-reference
slug: submission-schema
title: "Frame Codex Submission Schema Reference"
summary: "Complete technical reference for Frame Codex content schema, including all fields, validation rules, and OpenStrand ECA integration"
version: "2.0.0"
contentType: markdown
difficulty: intermediate
taxonomy:
  subjects: [technology, knowledge]
  topics: [api-reference, architecture]
tags: [schema, metadata, yaml, validation, eca, openstrand]
relationships:
  requires:
    - how-to-submit
  references:
    - openstrand-architecture
publishing:
  created: "2025-01-15T00:00:00Z"
  status: published
---

# Frame Codex Submission Schema Reference

This document provides the complete technical specification for Frame Codex content schema, including integration with OpenStrand's Educational Content Atom (ECA) standard.

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Strand Schema (Individual Content)](#strand-schema)
3. [Loom Schema (Collections)](#loom-schema)
4. [Weave Schema (Universes)](#weave-schema)
5. [ECA Integration](#eca-integration)
6. [Validation Rules](#validation-rules)
7. [Examples](#examples)

---

## Schema Overview

Frame Codex uses a three-tier knowledge organization:

```
Weave (Universe)
├── Loom (Collection)
│   ├── Strand (Content)
│   ├── Strand (Content)
│   └── ...
├── Loom (Collection)
│   └── ...
└── ...
```

### Key Principles

- **Strands** are atomic, self-contained knowledge units
- **Looms** curate related strands into coherent learning paths
- **Weaves** represent complete, isolated knowledge universes
- **No cross-weave relationships** (each weave is independent)
- **Subfolders are SUBTOPICS** - folder depth determines topic specificity (deeper = more specific)
- **Topics are hierarchical** - must narrow scope as you go deeper in the folder tree
- **Tags are independent** - can be shared freely across any folder level

---

## Strand Schema

Strands are individual markdown files with YAML frontmatter.

### Required Fields

```yaml
id: string (UUID v4)
slug: string (lowercase, hyphens, alphanumeric)
title: string (3-100 characters)
summary: string (20-300 characters)
version: string (semver: x.y.z)
contentType: enum [markdown, code, data, media]
difficulty: enum [beginner, intermediate, advanced, expert]
```

### Recommended Fields

```yaml
taxonomy:
  subjects: array<string>          # High-level categories
  topics: array<string>            # ⚠️ MUST match folder depth (see below)
  subtopics: array<string>         # Even more specific narrowing
  concepts: array<object>
    - term: string
      weight: number (0-1)
      definition: string (optional)
  skills: array<object>
    - name: string
      level: enum [introduce, develop, master]

tags: array<string>               # ✓ Independent - NO hierarchy

# ─────────────────────────────────────────────────────────────────────
# ⚠️  CRITICAL: Topics vs Tags
# ─────────────────────────────────────────────────────────────────────
# 
# TOPICS are HIERARCHICAL:
#   - Subfolders = subtopics of parent folder
#   - Topics MUST become MORE SPECIFIC as folder depth increases
#   - A file in /programming/python/async/ must have topics about async Python
#   - NOT broad topics like "web-development"
#
# TAGS are INDEPENDENT:
#   - No hierarchy, flat structure
#   - Can be shared across ANY folder level
#   - A deeply nested file can share tags with root files
#   - Example: both /python/async/coroutines.md and /overview.md can use
#     the tag "best-practices"
#
# See: openstrand-architecture.md#hierarchical-topic-structure-critical-rule
# ─────────────────────────────────────────────────────────────────────

relationships:
  requires: array<string> (slugs of prerequisite strands)
  references: array<string> (slugs of related strands)
  seeAlso: array<string> (external URLs)

publishing:
  created: string (ISO 8601 datetime)
  updated: string (ISO 8601 datetime)
  status: enum [draft, review, published, archived]
  license: string (default: CC-BY-4.0)
  authors: array<string>
```

### OpenStrand ECA Extended Fields

Frame Codex supports the full OpenStrand Educational Content Atom (ECA) specification for advanced learning design:

```yaml
# Learning Design
learningDesign:
  objectives: array<object>
    - id: string
      description: string
      bloomsLevel: enum [remember, understand, apply, analyze, evaluate, create]
      measurable: boolean
  
  outcomes: array<object>
    - id: string
      description: string
      assessment: string (optional)
  
  pedagogicalApproach: array<enum>
    # Options: direct_instruction, discovery_learning, problem_based,
    #          collaborative, experiential, inquiry_based
  
  instructionalStrategies: array<string>

# Time Estimates
timeEstimates:
  reading: number (minutes)
  exercises: number (minutes)
  projects: number (minutes)
  total: number (minutes)

# Modality Support
modalities:
  text: boolean
  visual:
    diagrams: number
    images: number
    charts: number
  audio:
    narration: boolean
    duration: number (seconds, optional)
  video:
    embedded: number
    duration: number (seconds, optional)
  kinesthetic:
    simulations: number
    exercises: number

# Interactive Elements
interactiveElements: array<object>
  - id: string
    type: enum [quiz, poll, simulation, code_exercise, discussion_prompt, reflection, peer_review]
    required: boolean
    data: object (type-specific)

# Assessment
assessments:
  formative: array<object>
    - id: string
      type: string
      weight: number (0-1)
  summative: array<object>
    - id: string
      type: string
      weight: number (0-1)
      passingScore: number (0-100)

# Accessibility
accessibility:
  wcagLevel: enum [A, AA, AAA]
  features: array<enum>
    # Options: alt_text, captions, transcripts, audio_description,
    #          sign_language, easy_read, high_contrast, keyboard_navigation
  languages: array<string> (ISO 639-1 codes)
  readingLevel: number (Flesch-Kincaid grade level)

# Cultural Adaptations
culturalAdaptations: array<object>
  - culture: string (ISO 3166-1 alpha-2)
    modifications:
      examples: boolean
      imagery: boolean
      language: boolean
      values: boolean
    notes: string (optional)

# Quality Metrics
quality:
  peerReview:
    status: enum [pending, reviewed, approved]
    reviewers: array<string>
    score: number (0-5, optional)
  evidenceBased: array<object>
    - claim: string
      evidence: string
      citation: string
      strength: enum [strong, moderate, emerging]
  lastUpdated: string (ISO 8601 datetime)
  updateFrequency: enum [static, annual, biannual, quarterly, dynamic]
```

### Full Example

```yaml
---
id: 550e8400-e29b-41d4-a716-446655440000
slug: intro-to-recursion
title: "Introduction to Recursion in Programming"
summary: "Learn the fundamentals of recursive functions, base cases, and common patterns with practical examples"
version: "1.0.0"
contentType: markdown
difficulty: intermediate

taxonomy:
  subjects: [technology, knowledge]
  topics: [getting-started, architecture]
  subtopics: [algorithms, functions]
  concepts:
    - term: "recursion"
      weight: 1.0
      definition: "A function that calls itself"
    - term: "base case"
      weight: 0.8
      definition: "The terminating condition for recursion"
  skills:
    - name: "recursive-thinking"
      level: introduce
    - name: "algorithm-design"
      level: develop

tags: [recursion, programming, algorithms, computer-science, functions]

relationships:
  requires:
    - functions-basics
    - control-flow
  references:
    - algorithm-complexity
    - stack-memory
  seeAlso:
    - https://en.wikipedia.org/wiki/Recursion_(computer_science)

learningDesign:
  objectives:
    - id: obj-1
      description: "Understand what recursion is and when to use it"
      bloomsLevel: understand
      measurable: true
    - id: obj-2
      description: "Implement recursive solutions to common problems"
      bloomsLevel: apply
      measurable: true
  
  outcomes:
    - id: outcome-1
      description: "Can write recursive functions with proper base cases"
      assessment: "code-exercise-1"
  
  pedagogicalApproach: [direct_instruction, problem_based]
  instructionalStrategies: ["worked examples", "progressive complexity"]

timeEstimates:
  reading: 15
  exercises: 30
  projects: 0
  total: 45

modalities:
  text: true
  visual:
    diagrams: 3
    images: 0
    charts: 1
  audio:
    narration: false
  video:
    embedded: 1
    duration: 300
  kinesthetic:
    simulations: 0
    exercises: 5

interactiveElements:
  - id: quiz-1
    type: quiz
    required: true
    data:
      questions: 5
      passingScore: 80
  - id: code-ex-1
    type: code_exercise
    required: true
    data:
      language: python
      starterCode: "def factorial(n):\n    # Your code here\n    pass"

assessments:
  formative:
    - id: quiz-1
      type: multiple-choice
      weight: 0.3
  summative:
    - id: final-project
      type: coding-challenge
      weight: 0.7
      passingScore: 70

accessibility:
  wcagLevel: AA
  features: [alt_text, captions, keyboard_navigation]
  languages: [en, es, fr]
  readingLevel: 10

quality:
  peerReview:
    status: approved
    reviewers: [alice, bob]
    score: 4.5
  evidenceBased:
    - claim: "Recursion is fundamental to functional programming"
      evidence: "Widely used in Lisp, Haskell, and other FP languages"
      citation: "Abelson & Sussman, SICP (1996)"
      strength: strong
  lastUpdated: "2025-01-15T00:00:00Z"
  updateFrequency: annual

publishing:
  created: "2025-01-15T00:00:00Z"
  updated: "2025-01-15T00:00:00Z"
  status: published
  license: CC-BY-4.0
  authors: [johndoe]
---

# Introduction to Recursion in Programming

[Content goes here...]
```

---

## Loom Schema

Looms are YAML manifest files that organize strands into collections.

### File Location

```
weaves/[weave-name]/[optional-folder-path]/loom.yaml
```

### Required Fields

```yaml
slug: string (lowercase, hyphens)
title: string
summary: string
```

### Recommended Fields

```yaml
description: string (longer than summary)

ordering:
  type: enum [sequential, hierarchical, network]
  items: array<string> (strand slugs in order)
  rationale: string (why this order?)

metadata:
  estimatedTime: number (total minutes)
  difficulty: enum [beginner, intermediate, advanced, expert]
  prerequisites: array<string> (other loom slugs)
  
tags: array<string>

publishing:
  created: string (ISO 8601)
  updated: string (ISO 8601)
  status: enum [draft, published]
  maintainers: array<string>
```

### Example

```yaml
slug: python-fundamentals
title: "Python Programming Fundamentals"
summary: "Master the core concepts of Python programming from variables to functions"

description: |
  This loom guides you through the essential building blocks of Python programming.
  By the end, you'll be comfortable writing Python scripts and understanding
  fundamental programming concepts.

ordering:
  type: sequential
  items:
    - variables-and-types
    - operators-and-expressions
    - control-flow
    - functions-basics
    - data-structures-intro
  rationale: "Each concept builds on the previous, forming a solid foundation"

metadata:
  estimatedTime: 180
  difficulty: beginner
  prerequisites: []

tags: [python, programming, fundamentals, beginner]

publishing:
  created: "2025-01-15T00:00:00Z"
  updated: "2025-01-15T00:00:00Z"
  status: published
  maintainers: [johndoe]
```

---

## Weave Schema

Weaves are top-level YAML manifest files representing complete knowledge universes.

### File Location

```
weaves/[weave-name]/weave.yaml
```

### Required Fields

```yaml
slug: string (lowercase, hyphens)
title: string
description: string
```

### Recommended Fields

```yaml
scope: string (what this weave encompasses)
boundaries: string (what's excluded)

looms: array<string> (folder-relative loom slugs in this weave)

metadata:
  domain: string
  audience: array<string>
  license: string (default: CC-BY-4.0)

tags: array<string>

publishing:
  created: string (ISO 8601)
  updated: string (ISO 8601)
  status: enum [draft, published]
  maintainers: array<string>
```

### Example

```yaml
slug: computer-science
title: "Computer Science Fundamentals"
description: "A comprehensive collection of computer science knowledge from algorithms to systems"

scope: |
  This weave covers foundational computer science topics including:
  - Programming fundamentals
  - Data structures and algorithms
  - Computer architecture
  - Operating systems
  - Databases
  - Software engineering

boundaries: |
  This weave does NOT cover:
  - Specific framework tutorials (see 'web-development' weave)
  - Hardware repair or electronics
  - Non-CS mathematics

looms:
  - programming-basics
  - data-structures
  - algorithms
  - computer-architecture
  - operating-systems
  - databases
  - software-engineering

metadata:
  domain: computer-science
  audience: [students, self-learners, professionals]
  license: CC-BY-4.0

tags: [computer-science, programming, algorithms, systems]

publishing:
  created: "2025-01-15T00:00:00Z"
  updated: "2025-01-15T00:00:00Z"
  status: published
  maintainers: [johndoe, janedoe]
```

---

## ECA Integration

Frame Codex fully integrates with OpenStrand's Educational Content Atom (ECA) specification, enabling:

### Learning Analytics
- Track learner progress through strands
- Measure mastery levels
- Identify knowledge gaps
- Recommend personalized paths

### Adaptive Learning
- Adjust difficulty based on performance
- Suggest prerequisites when struggling
- Skip redundant content when mastered
- Optimize learning velocity

### Multi-Modal Delivery
- Generate audio narration from text
- Create visual summaries
- Provide alternative representations
- Support diverse learning styles

### Assessment Integration
- Embed quizzes and exercises
- Track completion and scores
- Provide instant feedback
- Generate certificates

### Accessibility
- WCAG compliance tracking
- Multi-language support
- Screen reader optimization
- Cognitive load management

---

## Validation Rules

### Automatic Validation

Run validation locally:

```bash
npm run validate
```

Or validate specific files:

```bash
npm run validate -- --files "weaves/tech/python/intro.md"
```

### Schema Compliance

**Required Field Validation:**
- All required fields must be present
- Fields must match expected types
- Enums must use valid values

**Content Quality:**
- Minimum 100 characters of content
- No placeholder text (test content, TODO, FIXME)
- No broken markdown syntax

**Unique Constraints:**
- `id` must be globally unique (UUID)
- `slug` must be unique within scope (loom or weave)
- No duplicate titles within same loom

### Quality Scoring

The auto-indexer assigns quality scores based on:

- **Completeness** (0-100): Percentage of recommended fields filled
- **Readability** (easy/moderate/difficult): Flesch-Kincaid analysis
- **SEO Score** (0-100): Title, summary, tags optimization
- **Confidence** (0-1): Categorization confidence

---

## Examples

### Minimal Valid Strand

```yaml
---
id: 550e8400-e29b-41d4-a716-446655440000
slug: hello-world
title: "Hello World"
summary: "A simple introduction"
version: "1.0.0"
contentType: markdown
difficulty: beginner
---

# Hello World

This is the minimal valid content.
```

### Comprehensive Strand

See [Full Example](#full-example) above for a complete, production-ready strand with all ECA fields.

### Simple Loom

```yaml
slug: quick-start
title: "Quick Start Guide"
summary: "Get started in 5 minutes"
ordering:
  type: sequential
  items: [install, configure, first-app]
```

### Simple Weave

```yaml
slug: tutorials
title: "Tutorials Collection"
description: "Step-by-step guides for common tasks"
looms: [quick-start, advanced-topics]
```

---

## Best Practices

### Metadata

1. **Be Specific**: Use precise, descriptive titles
2. **Be Consistent**: Follow existing vocabulary
3. **Be Complete**: Fill recommended fields when applicable
4. **Be Accurate**: Ensure difficulty matches content

### Content

1. **One Topic**: Each strand should cover one focused topic
2. **Self-Contained**: Strands should be understandable alone
3. **Well-Structured**: Use headings, lists, code blocks
4. **Examples**: Include practical examples
5. **Citations**: Link to sources and references

### Relationships

1. **Prerequisites**: List only direct prerequisites
2. **References**: Link to related, not duplicate content
3. **See Also**: External resources for deeper learning
4. **Avoid Cycles**: No circular prerequisite chains

---

## Validation Tools

### Local Validation

```bash
# Full validation
npm run validate

# Specific files
npm run validate -- --files "path/to/file.md"

# Check duplicates
npm run check-duplicates

# Generate template
npm run generate-template -- "My New Content"
```

### CI/CD Validation

All PRs automatically run:
- Schema validation
- Quality checks
- Duplicate detection
- NLP analysis
- AI enhancement (optional)

---

## Schema Evolution

This schema is versioned using semantic versioning:

- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New optional fields
- **Patch** (0.0.x): Clarifications, fixes

**Current Version:** 2.0.0

**Changelog:**
- 2.0.0: Added full ECA integration
- 1.1.0: Added quality metrics
- 1.0.0: Initial schema

---

## Resources

- **OpenStrand ECA Spec**: [openstrand-architecture.md](../openstrand-architecture.md)
- **Submission Guide**: [how-to-submit.md](./how-to-submit.md)
- **GitHub Repo**: [github.com/framerslab/codex](https://github.com/framerslab/codex)
- **Discord**: [wilds.ai/discord](https://wilds.ai/discord)

---

*Schema version: 2.0.0*

