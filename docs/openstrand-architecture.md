---
id: openstrand-architecture-overview
slug: openstrand-architecture
title: OpenQuarry Architecture Overview
summary: Comprehensive guide to OpenQuarry's knowledge infrastructure, explaining how Weaves, Looms, and Threads work together to create the foundation for Frame Codex
version: 1.0.0
contentType: markdown
difficulty: intermediate
taxonomy:
  subjects:
    - technology
    - ai
    - knowledge
  topics:
    - architecture
    - getting-started
tags: [openstrand, architecture, knowledge-graph, weave, loom, strand]
relationships:
  references:
    - frame-codex-intro
    - schema-reference
  seeAlso:
    - https://openstrand.ai
    - https://frame.dev
publishing:
  created: 2025-01-15T00:00:00Z
  updated: 2025-01-15T00:00:00Z
  status: published
---

# OpenQuarry Architecture Overview

OpenQuarry is the knowledge infrastructure that powers Frame.dev and Frame Codex. It provides a structured, AI-native way to organize, store, and retrieve humanity's knowledge.

## Core Concepts

### The Four-Tier Hierarchy

OpenQuarry organizes knowledge using four fundamental primitives:

**Fabric** - A collection of weaves
- The highest level of organization
- Represents an entire knowledge repository or ecosystem
- Example: Frame Codex itself is a fabric
- Contains multiple weaves that are conceptually related but independent

**Thread** - The atomic unit of knowledge
- A single document, image, dataset, or media file
- Contains rich metadata for categorization and discovery
- Can reference other threads within the same weave
- Immutable once published (new versions create new threads)

**Loom** - A curated collection of related threads
- Groups threads by topic, theme, or learning path
- Defines ordering (sequential, hierarchical, or network)
- Provides context and relationships between threads
- Acts as a module or chapter in the knowledge base

**Weave** - A complete universe of knowledge
- Self-contained collection with no external dependencies
- Represents a domain, project, or knowledge area
- No relationships exist between different weaves
- Think of it as a separate universe or dimension

### Why This Structure?

The Fabric/Weave/Loom/Strand architecture solves several key problems:

1. **Isolation**: Weaves are completely independent, preventing knowledge pollution
2. **Scalability**: Each weave can grow infinitely without affecting others
3. **Clarity**: Clear boundaries make it obvious where knowledge belongs
4. **Versioning**: Threads are immutable, making version control natural
5. **AI-Friendly**: Structured metadata enables semantic search and RAG
6. **Fabric-Scope Reasoning**: A single Fabric view allows cross-weave synthesis while preserving provenance

### Superintelligence at Fabric Scope

While weaves remain isolated for organization and provenance, analysis at the **Fabric** level permits traversal
across weaves for:

- Cross-domain retrieval and context assembly
- Whole-of-corpus synthesis and summarization
- Global topic maps and knowledge graphs

Fabric-level queries always preserve original weave/loom/strand provenance. OpenQuarry uses this fabric view to let
agents and superintelligence move seamlessly across domains while still understanding exactly where every fact came from.

## How It Works

### Knowledge Flow

```
Fabric (Repository)
  └── Weave (Universe)
        └── Loom (Collection / any subdirectory)
              ├── Strand (Markdown file)
              ├── Strand (Markdown file)
              └── Loom (Nested subdirectory)
                    └── Strand (Markdown file)
```

### Example: Frame Ecosystem Weave

```yaml
# weaves/frame/weave.yaml
slug: frame
title: Frame.dev Ecosystem
description: Complete knowledge base for Frame products and infrastructure
```

This weave contains looms for:
- OpenQuarry documentation
- AgentOS guides
- Frame API reference
- Architecture patterns

💡 **Physical layout**: Loosely structured folders — no `looms/` or `strands/` prefixes are required.

```
weaves/frame/
├── weave.yaml
├── overview.md
├── openstrand/
│   ├── loom.yaml
│   └── architecture.md
└── guides/agentos/deployment.md
```

Each folder inside `weaves/frame/` is treated as a loom, and every markdown file (at any depth) is a thread that can reference other strands.

### Hierarchical Topic Structure (Critical Rule)

**Folder depth determines topic specificity.** This is a fundamental OpenQuarry principle:

> 📐 **Subfolders are SUBTOPICS of their parent folder. Topics MUST become more specific as you go deeper.**

#### How It Works

```
weaves/technology/                     # Topic: technology (broad)
├── programming/                       # Topic: programming (more specific)
│   ├── python/                        # Topic: python (even more specific)
│   │   └── async/                     # Topic: async-python (most specific)
│   │       └── coroutines.md          # Strand about Python coroutines
│   └── rust/                          # Topic: rust (sibling to python)
│       └── memory-safety.md
└── infrastructure/                    # Topic: infrastructure (sibling to programming)
    └── kubernetes/
        └── networking.md
```

**The hierarchy implies:**
- `programming/` is a subtopic of `technology/`
- `python/` is a subtopic of `programming/`
- `async/` is a subtopic of `python/`
- Content in `async/` MUST be about async Python, not general async concepts

#### Topics vs Tags: The Critical Distinction

| Aspect | **Topics** (Hierarchical) | **Tags** (Independent) |
|--------|---------------------------|------------------------|
| Structure | Tree-like, parent-child | Flat, no hierarchy |
| Inheritance | Child topics MUST narrow parent scope | No inheritance |
| Sharing | Cannot share across unrelated branches | Can share across ANY level |
| Purpose | Determines WHERE content lives | Describes WHAT content covers |
| Example | `programming > python > async` | `best-practices`, `tutorial`, `advanced` |

#### Correct vs Incorrect Examples

✅ **CORRECT** - Topics narrow as depth increases:
```yaml
# File: weaves/technology/programming/python/async/coroutines.md
taxonomy:
  subjects: [technology]
  topics: [async-programming, coroutines]  # Specific to this subloom
tags: [python, best-practices, tutorial]   # Tags can be anything relevant
```

❌ **INCORRECT** - Topics too broad for location:
```yaml
# File: weaves/technology/programming/python/async/coroutines.md
taxonomy:
  subjects: [technology]
  topics: [programming, web-development]  # TOO BROAD! Should be about async
tags: [python]
```

❌ **INCORRECT** - Content doesn't match folder hierarchy:
```yaml
# File: weaves/technology/programming/python/async/kubernetes-networking.md
# WRONG LOCATION! This should be in weaves/technology/infrastructure/kubernetes/
```

#### Why This Matters

1. **AI Navigation**: Superintelligence uses folder structure to understand topic relationships
2. **Search Precision**: Queries can filter by hierarchy depth for specificity
3. **Knowledge Graph**: Parent-child topic relationships are inferred from paths
4. **Validation**: The indexer can detect misplaced content by comparing topics to path
5. **Learning Paths**: Sequential traversal respects topic dependencies

#### Tags Are Free-Form

Unlike topics, **tags have no hierarchy**. A deeply nested thread can share tags with root-level content:

```yaml
# weaves/technology/programming/python/async/coroutines.md
tags: [best-practices, performance, tutorial]

# weaves/technology/overview.md  
tags: [best-practices, getting-started]  # Same "best-practices" tag is fine!
```

Both files share `best-practices` because tags describe cross-cutting concerns, not hierarchical position.

### Metadata Schema

Every thread includes:
- **Identity**: UUID, slug, title
- **Content**: Summary, body, content type
- **Taxonomy**: Subjects, topics, tags
- **Relationships**: Prerequisites, references, related content
- **Publishing**: Dates, status, version

This rich metadata enables:
- Semantic search
- Knowledge graph visualization
- Prerequisite tracking
- Learning path generation
- AI-powered recommendations

## Integration with Frame Codex

Frame Codex is the public manifestation of OpenQuarry's architecture:

1. **Data Layer**: Codex stores all weaves, looms, and threads as files
2. **Index Layer**: Auto-indexing creates searchable metadata
3. **API Layer**: Frame API exposes the knowledge graph
4. **UI Layer**: Frame.dev provides the browsing interface

### For LLMs

The structure is optimized for Large Language Model consumption:

- **Structured metadata** enables precise retrieval
- **Clear relationships** provide context
- **Immutable versions** ensure consistency
- **Rich tagging** improves relevance

LLMs can:
- Navigate the knowledge graph
- Understand prerequisites
- Find related content
- Extract specific information
- Generate summaries

### For Humans

The same structure benefits human users:

- **Browse by topic** through looms
- **Follow learning paths** with ordered threads
- **Discover connections** via relationships
- **Search semantically** using natural language
- **Track versions** to see evolution

## Technical Implementation

### Storage

- **GitHub**: Primary storage as markdown and YAML files
- **Git**: Version control for all content
- **Raw URLs**: Direct access to any thread

### Indexing

- **Auto-indexing**: NLP-powered categorization on every commit
- **TF-IDF**: Keyword extraction for search
- **Validation**: Quality checks before merging
- **Relationships**: Automatic link discovery

### Access

- **GitHub API**: Dynamic folder browsing
- **Raw Content**: Direct file fetching
- **Search Index**: Pre-built JSON for client-side search
- **Frame API**: Structured queries with relationships

## Roadmap

Future enhancements planned:

1. **LLM-Powered QC**: Automated quality control using our own models
2. **Smart Suggestions**: AI-generated metadata improvements
3. **Auto-Relationships**: Discover connections between threads
4. **Translation**: Multi-language support with auto-translation
5. **Embeddings**: Vector search for semantic similarity

These features will be powered by Frame's independent LLM service, not third-party APIs, ensuring privacy and control.

## Contributing

When you contribute to Frame Codex, you're adding to this knowledge infrastructure:

1. **Choose a weave** - Or create a new one
2. **Find or create a loom** - Group related content
3. **Add your thread** - Follow the schema
4. **Let automation help** - Auto-tagging and validation

The system will:
- Suggest appropriate tags
- Validate your metadata
- Check for duplicates
- Generate summaries if needed
- Ensure schema compliance

## Learn More

- [Schema Reference](./schema-reference.md)
- [Contributing Guide](../../.github/pull_request_template.md)
- [Frame Codex](https://frame.dev/codex)
- [OpenQuarry](https://openstrand.ai)
