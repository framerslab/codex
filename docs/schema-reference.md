---
id: schema-reference-guide
slug: schema-reference
title: Frame Codex Schema Reference
summary: Complete reference for Weave, Loom, and Thread schemas with examples and validation rules
version: 1.0.0
contentType: markdown
difficulty: intermediate
taxonomy:
  subjects:
    - technology
  topics:
    - api-reference
    - architecture
tags: [schema, yaml, validation, weave, loom, strand]
relationships:
  references:
    - openstrand-architecture
publishing:
  created: 2025-01-15T00:00:00Z
  updated: 2025-01-15T00:00:00Z
  status: published
---

# Frame Codex Schema Reference

This document provides the complete schema reference for all Frame Codex content types.

## Weave Schema

A Weave represents a complete, self-contained universe of knowledge.

### Required Fields

- `slug` (string): Unique identifier, lowercase with hyphens
- `title` (string): Human-readable name
- `description` (string): Comprehensive description

### Optional Fields

- `maintainedBy` (object): Maintainer information
  - `name` (string): Name of person or organization
  - `url` (string): Contact or website URL
- `license` (string): Content license (default: MIT)
- `tags` (array): Categorization tags from controlled vocabulary

### Example

```yaml
slug: frame
title: Frame.dev Ecosystem
description: Comprehensive knowledge base for Frame.dev products and infrastructure
maintainedBy:
  name: Frame.dev Team
  url: https://frame.dev
license: MIT
tags:
  - technology
  - ai-infrastructure
  - superintelligence
```

## Loom Schema

A Loom is a curated collection of related threads within a weave.

### Required Fields

- `slug` (string): Unique identifier within the weave
- `title` (string): Display title
- `summary` (string): Brief description

### Optional Fields

- `tags` (array): Subject tags for categorization
- `ordering` (object): How threads are organized
  - `type` (enum): `sequential`, `hierarchical`, or `network`
  - `items` (array): Ordered list of thread slugs

### Example

```yaml
slug: getting-started
title: Getting Started with Frame
summary: Essential guides and tutorials for new Frame developers
tags:
  - tutorial
  - beginner
ordering:
  type: sequential
  items:
    - installation
    - hello-world
    - core-concepts
    - first-project
```

## Thread Schema

A Thread is an atomic unit of knowledge - a document, image, or dataset.

### Required Fields

- `id` (string): Globally unique identifier (UUID)
- `slug` (string): URL-friendly identifier
- `title` (string): Display title

### Optional Fields

- `summary` (string): Brief abstract (recommended for search)
- `version` (string): Semantic version (default: 1.0.0)
- `contentType` (enum): `markdown`, `code`, `data`, or `media`
- `difficulty` (enum): `beginner`, `intermediate`, `advanced`, or `expert`
- `taxonomy` (object): Categorization
  - `subjects` (array): High-level categories
  - `topics` (array): Specific topics **⚠️ MUST match folder depth - see note below**
- `tags` (array): Freeform tags **✓ Independent - can be shared across any level**
- `skills` (array): Learning prerequisites for spiral learning **🎯 Used for path planning**

> **⚠️ Topics vs Tags vs Skills**:
> - **Topics** are HIERARCHICAL and must become MORE SPECIFIC as folder depth increases
> - **Tags** are INDEPENDENT categorization labels - what the content is *about*
> - **Skills** are PREREQUISITES for learning - what you need to *know* before reading
> 
> See [Hierarchical Topic Structure](./openstrand-architecture.md#hierarchical-topic-structure-critical-rule) and [Skills & Spiral Learning](#skills--spiral-learning) below.

- `relationships` (object): Connections to other threads
  - `requires` (array): Prerequisites
  - `references` (array): Related threads
  - `seeAlso` (array): External URLs
- `publishing` (object): Publication metadata
  - `created` (string): ISO 8601 timestamp
  - `updated` (string): ISO 8601 timestamp
  - `status` (enum): `draft`, `published`, `archived`

### Example

```yaml
---
id: 550e8400-e29b-41d4-a716-446655440000
slug: openstrand-architecture
title: OpenStrand Architecture Overview
summary: Comprehensive guide to OpenStrand's system architecture and design principles
version: 1.2.0
contentType: markdown
difficulty: intermediate
taxonomy:
  subjects:
    - technology
    - ai
  topics:
    - architecture
    - getting-started
tags:
  - openstrand
  - architecture
  - knowledge-graph
skills:
  - typescript
  - yaml
  - git
relationships:
  requires:
    - core-concepts
  references:
    - frame-codex-intro
    - api-reference
  seeAlso:
    - https://openstrand.ai
    - https://frame.dev
publishing:
  created: 2025-01-15T00:00:00Z
  updated: 2025-01-15T00:00:00Z
  status: published
---

# Your content here...
```

## Validation Rules

### Slug Format

- Lowercase letters, numbers, and hyphens only
- No spaces or special characters
- Must be unique within scope (weave/loom)

### ID Format

- Must be a valid UUID v4
- Globally unique across all threads
- Generate using `npm run generate-template`

### Version Format

- Semantic versioning: `MAJOR.MINOR.PATCH`
- Example: `1.0.0`, `2.1.3`

### Content Requirements

- Minimum 100 characters of meaningful content
- No unfinished sections or test content
- Proper markdown formatting
- Valid YAML frontmatter

## Auto-Generated Metadata

The indexer automatically generates:

- **Keywords**: Extracted using TF-IDF algorithm
- **Phrases**: Common multi-word expressions
- **Subjects**: Matched from controlled vocabulary
- **Topics**: Detected from content analysis
- **Difficulty**: Inferred from language complexity
- **Summary**: Generated if missing

You can override any auto-generated values by specifying them explicitly in your frontmatter.

## Controlled Vocabulary

Tags should use terms from the controlled vocabulary when possible:

### Subjects
- technology, science, philosophy, ai, knowledge, design, security

### Topics
- getting-started, architecture, api-reference, best-practices, troubleshooting, deployment, testing, performance

### Difficulty
- beginner, intermediate, advanced, expert

The indexer will suggest additions to the vocabulary based on frequently occurring terms across documents.

## Validation Commands

```bash
# Validate all content
npm run validate

# Validate specific files
npm run validate -- --files weaves/frame/openstrand/architecture.md

# Check for duplicates
npm run check-duplicates

# Generate a new strand template
npm run generate-template -- "My New Document"
```

## Skills & Spiral Learning

Skills are a special metadata field designed for the **Spiral Learning Path** feature. Unlike tags (which describe what content is *about*), skills define what a reader needs to *know* before reading.

### Skills vs Tags

| Aspect | Tags | Skills |
|--------|------|--------|
| **Purpose** | Categorization | Prerequisites |
| **Question** | "What is this about?" | "What do I need to know?" |
| **Specificity** | Can be specific or broad | Should be as generalized as possible |
| **Examples** | `react-hooks-tutorial`, `nextjs-routing` | `react`, `javascript`, `typescript` |
| **Use in UI** | Filtering, search, discovery | Learning path calculation |

### Skill Guidelines

1. **Be generalized**: Use `typescript` not `typescript-generics`
2. **Use lowercase**: `react` not `React` or `REACT`
3. **Prefer established terms**: `git` not `version-control-system`
4. **Avoid duplicating tags**: If a tag and skill overlap, prefer the skill

### Common Skills Vocabulary

```yaml
# Programming Languages
- javascript
- typescript
- python
- rust
- go

# Frameworks
- react
- nextjs
- nodejs
- express

# Tools
- git
- docker
- kubernetes
- ci-cd

# Concepts
- state-management
- api-design
- authentication
- testing
```

### How Skills Power Spiral Learning

The spiral learning algorithm uses skills to:

1. **Build prerequisite graphs**: Skills create edges between threads
2. **Calculate learning paths**: Find optimal order to learn topics
3. **Track mastery**: Skills can be marked as "learned" by users
4. **Personalize recommendations**: Suggest content based on skill gaps

### Example: Skills in Action

```yaml
# Advanced strand requiring multiple skills
---
title: Building a Real-time Dashboard
difficulty: advanced
skills:
  - typescript
  - react
  - websockets
  - state-management
tags:
  - dashboard
  - real-time
  - tutorial
---
```

When a user sets this as their "goal" in the Spiral Path, the system:
1. Identifies they need `typescript`, `react`, `websockets`, `state-management`
2. Finds beginner threads that **teach** these skills
3. Builds an optimal learning path from start → goal

### Skill Detection

The auto-indexer attempts to detect skills from content by:
- Matching code blocks to language skills
- Detecting framework imports and usage patterns
- Identifying prerequisite mentions in text

You can always override auto-detected skills in frontmatter.

## Best Practices

1. **Always include metadata**: Title and summary are required
2. **Use UUIDs for IDs**: Generate with `uuidgen` or our template tool
3. **Tag appropriately**: Use controlled vocabulary when possible
4. **Define skills for advanced content**: Help build the learning graph
5. **Link related content**: Build the knowledge graph
6. **Version your content**: Update version on significant changes
7. **Write for both humans and AI**: Clear, structured, comprehensive

## Schema Evolution

Schemas may evolve over time. When they do:

- Old content remains valid
- New fields are optional
- Migration guides are provided
- Validation warns about deprecated fields

## Learn More

- [OpenQuarry Architecture](./openstrand-architecture.md)
- [Contributing Guide](../.github/pull_request_template.md)
- [Auto-Indexing Documentation](../scripts/auto-index.js)
