---
id: how-to-submit-guide
slug: how-to-submit
title: "How to Submit to Frame Codex"
summary: "Complete guide to contributing knowledge to Frame Codex using the submission UI, GitHub, or manual PR creation"
version: "1.0.0"
contentType: markdown
difficulty: beginner
taxonomy:
  subjects: [knowledge, technology]
  topics: [getting-started, best-practices]
tags: [contributing, submission, guide, tutorial]
publishing:
  created: "2025-01-15T00:00:00Z"
  status: published
---

# How to Submit to Frame Codex

Welcome! This guide will walk you through the different ways to contribute knowledge to Frame Codex.

## Quick Start

The easiest way to submit content is through our **enhanced contribution modal** at [frame.dev/codex](https://frame.dev/codex):

1. Click the green **"Contribute"** button in the Codex viewer toolbar
2. Fill in your content (title, summary, markdown body)
3. Specify or leave blank weave/loom for AI suggestion
4. Add tags (or use suggested tags from content analysis)
5. Choose difficulty level (beginner/intermediate/advanced/expert)
6. Toggle AI enhancement (optional, explains cost vs free static NLP)
7. Preview final markdown with frontmatter
8. Click **"Create Pull Request"** (uses GitHub API if you provide PAT, or opens GitHub editor)

That's it! Our automated validation runs, and maintainers review your submission.

---

## Submission Methods

### Method 1: Web Submission UI (Recommended)

**Best for:** Quick submissions, beginners, anyone without Git expertise

The enhanced contribution modal provides:
- ✅ Pre-filled metadata based on current context
- ✅ Tag suggestions from content analysis
- ✅ Weave/loom inference (or manual override)
- ✅ AI enhancement toggle (optional, cost-transparent)
- ✅ Direct GitHub PR creation via API
- ✅ Fallback to GitHub web editor (no PAT required)
- ✅ Preview step showing final markdown
- ✅ No local setup required

**Steps:**

1. **Open Contribution Modal**
   - Go to [frame.dev/codex](https://frame.dev/codex)
   - Click the green "Contribute" button in the toolbar
   - Or use quick actions dropdown (mobile)

2. **Fill in Content**
   - **Title**: Clear, descriptive title (required)
   - **Summary**: 20-300 character abstract (required)
   - **Content**: Write or paste markdown (minimum 100 characters, required)

3. **Specify Location** (Optional - AI can suggest if left blank)
   - **Weave**: Which knowledge universe (e.g., technology, science, community)
   - **Loom**: Topic collection (e.g., programming, algorithms)
   - System auto-detects from current path or suggests based on content

4. **Add Metadata**
   - **Tags**: Type and press Enter, or click suggested tags from content analysis
   - **Difficulty**: Select beginner/intermediate/advanced/expert
   - **Subjects/Topics**: Auto-suggested from controlled vocabulary

5. **AI Enhancement** (Optional)
   - Toggle ON: AI analyzes content, suggests better categorization (~$0.01-0.20 cost)
   - Toggle OFF: Static NLP only (free, still provides quality validation)

6. **GitHub PAT** (Optional)
   - Provide token for direct API PR creation
   - Token is used only in your browser to call GitHub APIs directly and is never stored in localStorage, IndexedDB, SQL, or on any Frame.dev server
   - Leave blank to open GitHub web editor instead

7. **Preview & Submit**
   - Review generated markdown with frontmatter
   - See final file path: `weaves/{weave}/{loom}/{slug}.md`
   - Click "Create Pull Request"
     - Summary (extractive summarization)
     - Tags (TF-IDF keyword extraction)
     - Difficulty level (heuristic detection)
     - Subjects and topics (vocabulary matching)
   - Edit any field as needed

4. **Provide GitHub Token**
   - Create a [Personal Access Token](https://github.com/settings/tokens/new?scopes=repo&description=Frame%20Codex%20Submission) with `repo` scope
   - Paste it into the token field in the Frame Codex UI
   - The token lives only in that browser tab’s memory while the modal is open, is never persisted in local storage / IndexedDB / SQL, and is sent only to GitHub (never to any Frame.dev backend)

5. **Submit**
   - Click "Create Pull Request"
   - A new PR will be created on GitHub
   - You'll receive a link to track the review

**Rate Limits:**
- 5 submissions per hour per user
- Resets automatically after 60 minutes

---

### Method 2: GitHub Direct (Advanced)

**Best for:** Bulk submissions, complex content, experienced contributors

**Steps:**

1. **Fork the Repository**
   ```bash
   gh repo fork framersai/codex --clone
   cd codex
   ```

2. **Create a Branch**
   ```bash
   git checkout -b add-my-content
   ```

3. **Add Your Content**
   - Place files directly within the target weave. Any folder becomes a loom, and any markdown file becomes a strand:
     ```
     weaves/
       [weave-name]/
         weave.yaml
         overview.md                 # Strand at weave root
         [loom-folder]/              # e.g. guides/, research/, notes/
           loom.yaml (optional)
           your-content.md
           nested/topic/advanced.md  # Nested looms are allowed
     ```
   - See [submission-schema.md](./submission-schema.md) for required metadata

4. **Validate Locally**
   ```bash
   npm install
   npm run validate
   npm run index -- --validate
   ```

5. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: add [your content title]"
   git push origin add-my-content
   ```

6. **Create Pull Request**
   ```bash
   gh pr create --title "Add: [Your Content Title]" --body "Description of your contribution"
   ```

---

### Method 3: GitHub Web Interface (No CLI)

**Best for:** Single file submissions, quick edits

1. Navigate to [github.com/framersai/codex](https://github.com/framersai/codex)
2. Click "Add file" → "Create new file"
3. Enter the file path: `weaves/[weave]/[optional-folders]/your-file.md`
4. Add your content with frontmatter (see schema below)
5. Scroll down and select "Create a new branch for this commit"
6. Click "Propose new file"
7. Fill in the PR template and submit

---

## Content Requirements

### Minimum Requirements

✅ **Required Fields:**
- `id`: Unique UUID (generate at [uuidgenerator.net](https://www.uuidgenerator.net/))
- `slug`: URL-friendly identifier (lowercase, hyphens)
- `title`: Clear, descriptive title (3-100 characters)
- `summary`: Brief abstract (20-300 characters)
- `version`: Semantic version (e.g., `1.0.0`)
- `contentType`: One of `markdown`, `code`, `data`, `media`
- `difficulty`: One of `beginner`, `intermediate`, `advanced`, `expert`

✅ **Quality Standards:**
- Minimum 100 characters of meaningful content
- No placeholder text (test content, unfinished sections)
- Proper formatting and structure
- Spell-checked and grammar-checked

✅ **Licensing:**
- Content must be original or properly licensed
- Will be published under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)
- Provide attribution for external sources

### Recommended Fields

💡 **Enhance Discoverability:**
- `tags`: Keywords for search (5-10 recommended)
- `taxonomy.subjects`: High-level categories
- `taxonomy.topics`: Specific topic areas
- `relationships.requires`: Prerequisites
- `relationships.references`: Related content
- `relationships.seeAlso`: External resources

---

## Example Submission

Here's a complete example of a well-formatted strand:

```markdown
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
  topics: [getting-started, best-practices]
tags: [recursion, programming, algorithms, computer-science, functions]
relationships:
  requires:
    - functions-basics
    - control-flow
  references:
    - algorithm-complexity
  seeAlso:
    - https://en.wikipedia.org/wiki/Recursion_(computer_science)
publishing:
  created: "2025-01-15T00:00:00Z"
  updated: "2025-01-15T00:00:00Z"
  status: published
---

# Introduction to Recursion in Programming

Recursion is a powerful programming technique where a function calls itself to solve a problem by breaking it down into smaller, similar subproblems.

## Key Concepts

### Base Case
Every recursive function must have a base case—a condition that stops the recursion...

[Rest of your content here]
```

---

## Automated Features

Frame Codex includes several automated systems to help ensure quality:

### 1. Auto-Indexing
- Runs on every commit to `main`
- Extracts keywords using TF-IDF
- Generates search index
- Suggests vocabulary additions

### 2. Auto-Tagging
- Matches content against controlled vocabulary
- Suggests subjects and topics
- Provides confidence scores

### 3. Validation
- Schema compliance checks
- Required field verification
- Content quality analysis
- Duplicate detection

### 4. AI Enhancement (Optional)
- Analyzes content quality (0-100 score)
- Suggests missing metadata
- Recommends structural improvements
- Can auto-apply safe fixes (with `auto-enhance` label)

---

## Review Process

### Standard Review (Non-Weavers)

1. **Automated Checks** (instant)
   - Schema validation
   - Quality checks
   - Duplicate detection
   - NLP analysis

2. **AI Review** (1-2 minutes)
   - Content analysis
   - Metadata suggestions
   - Quality scoring
   - Posted as PR comments

3. **Human Review** (1-7 days)
   - Maintainer review
   - Community feedback
   - Revisions if needed
   - Approval and merge

### Fast-Track (Trusted Weavers)

After 5+ high-quality contributions, you can become a **Trusted Weaver**:
- ✅ Auto-approval after validation passes
- ✅ Instant merge (no waiting)
- ✅ Direct commit access (optional)

To become a Weaver, maintain high quality and request nomination from maintainers.

---

## Tips for Success

### Content Quality

1. **Be Specific**: Focus on one topic per strand
2. **Be Clear**: Use simple language, define jargon
3. **Be Complete**: Cover the topic thoroughly
4. **Be Accurate**: Fact-check and cite sources
5. **Be Original**: Add unique insights or examples

### Metadata Quality

1. **Descriptive Titles**: Make it immediately clear what the content covers
2. **Concise Summaries**: One sentence that captures the essence
3. **Relevant Tags**: Use existing vocabulary when possible
4. **Proper Difficulty**: Be honest about complexity level
5. **Link Relationships**: Connect to prerequisites and related content

### Formatting

1. **Use Markdown**: Leverage headings, lists, code blocks
2. **Add Examples**: Include practical code or scenarios
3. **Include Visuals**: Diagrams, charts (as SVG or PNG)
4. **Structure Well**: Logical flow, clear sections
5. **Proofread**: Check spelling, grammar, formatting

---

## Common Issues

### Validation Errors

**"Missing required field: title"**
- Add `title: "Your Title"` to frontmatter

**"ID must be a valid UUID"**
- Generate a new UUID at [uuidgenerator.net](https://www.uuidgenerator.net/)
- Format: `550e8400-e29b-41d4-a716-446655440000`

**"Content is very short (< 100 characters)"**
- Expand your content with more detail and examples

**"Contains TODO/FIXME comments"**
- Remove unfinished comments before submitting

### Rate Limit Errors

**"Rate limit exceeded. Try again in X minutes"**
- Wait for the rate limit to reset
- Use GitHub direct method for bulk submissions

### PR Creation Errors

**"Failed to create PR: Bad credentials"**
- Verify your GitHub token is correct
- Ensure token has `repo` scope
- Generate a new token if expired

---

## Getting Help

- 💬 **Discord**: [wilds.ai/discord](https://wilds.ai/discord)
- 📧 **Email**: team@frame.dev
- 🐛 **Issues**: [github.com/framersai/codex/issues](https://github.com/framersai/codex/issues)
- 📚 **Docs**: [frame.dev/codex/docs](https://frame.dev/codex/docs)

---

## Next Steps

1. ✅ Read the [Submission Schema Guide](./submission-schema.md)
2. ✅ Browse existing content for examples
3. ✅ Start with a small, focused contribution
4. ✅ Join our Discord for questions
5. ✅ Work towards becoming a Trusted Weaver!

Thank you for contributing to Frame Codex—the codex of humanity! 🌟

