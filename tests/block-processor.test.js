/**
 * Unit tests for block-processor.js
 * 
 * Tests block parsing, worthiness scoring, and frontmatter updates.
 * 
 * Run: npx vitest run tests/block-processor.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { parseMarkdownToBlocks } from '../scripts/markdown-blocks.mjs'

// The parser is the script's own (scripts/markdown-blocks.mjs). The scoring helpers below are copies of the
// script's logic (block-processor.js runs its command line on import, so they cannot be imported from it).

// ============================================================================
// MOCK IMPLEMENTATIONS (extracted logic for testing)
// ============================================================================

const BLOCK_TYPES = {
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  CODE: 'code',
  LIST: 'list',
  BLOCKQUOTE: 'blockquote',
  TABLE: 'table',
  HTML: 'html'
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
}

function termFrequency(tokens) {
  const tf = {}
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1
  }
  const max = Math.max(...Object.values(tf), 1)
  for (const token in tf) {
    tf[token] /= max
  }
  return tf
}

function cosineSimilarity(tf1, tf2) {
  const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)])
  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (const term of allTerms) {
    const v1 = tf1[term] || 0
    const v2 = tf2[term] || 0
    dotProduct += v1 * v2
    norm1 += v1 * v1
    norm2 += v2 * v2
  }

  if (norm1 === 0 || norm2 === 0) return 0
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
}

function calculateEntityDensity(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return 0

  let entityCount = 0
  const capitalizedWords = words.filter(w => /^[A-Z][a-z]/.test(w))
  entityCount += capitalizedWords.length
  
  const technicalTerms = words.filter(w => 
    /[a-z][A-Z]/.test(w) || /_/.test(w) || /^[A-Z]{2,}$/.test(w)
  )
  entityCount += technicalTerms.length

  return Math.min(1, entityCount / words.length)
}

function calculateStructuralImportance(block, blockIndex, totalBlocks) {
  let score = 0

  if (block.type === BLOCK_TYPES.HEADING) {
    score = 1 - (block.headingLevel - 1) * 0.15
  } else if (block.type === BLOCK_TYPES.CODE) {
    score = 0.7
  } else if (block.type === BLOCK_TYPES.PARAGRAPH) {
    const text = (block.content || []).join(' ')
    const wordCount = text.split(/\s+/).length
    score = Math.min(0.5, 0.2 + wordCount * 0.005)
  }

  if (blockIndex < 3) score += 0.1
  if (blockIndex >= totalBlocks - 2) score += 0.05

  return Math.min(1, Math.max(0, score))
}

// ============================================================================
// TESTS
// ============================================================================

describe('Block Processor', () => {
  describe('parseMarkdownToBlocks', () => {
    it('should parse headings correctly', () => {
      const content = `# Heading 1\n\n## Heading 2\n\n### Heading 3`
      const blocks = parseMarkdownToBlocks(content)
      
      expect(blocks).toHaveLength(3)
      expect(blocks[0].type).toBe('heading')
      expect(blocks[0].headingLevel).toBe(1)
      expect(blocks[0].headingText).toBe('Heading 1')
      expect(blocks[1].headingLevel).toBe(2)
      expect(blocks[2].headingLevel).toBe(3)
    })

    it('should parse code blocks correctly', () => {
      const content = "Some text\n\n```javascript\nconst x = 1;\n```\n\nMore text"
      const blocks = parseMarkdownToBlocks(content)
      
      const codeBlock = blocks.find(b => b.type === 'code')
      expect(codeBlock).toBeDefined()
      expect(codeBlock.content).toContain('const x = 1;')
    })

    it('should parse paragraphs correctly', () => {
      const content = `This is paragraph one.\n\nThis is paragraph two.`
      const blocks = parseMarkdownToBlocks(content)
      
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('paragraph')
      expect(blocks[1].type).toBe('paragraph')
    })

    it('should track line numbers', () => {
      const content = `# Heading\n\nParagraph text here.\n\nMore text.`
      const blocks = parseMarkdownToBlocks(content)
      
      expect(blocks[0].line).toBe(1)
      expect(blocks[1].line).toBe(3)
    })

    it('should handle empty content', () => {
      const blocks = parseMarkdownToBlocks('')
      expect(blocks).toHaveLength(0)
    })

    it('should handle multiple consecutive code blocks', () => {
      const content = "```js\ncode1\n```\n\n```python\ncode2\n```"
      const blocks = parseMarkdownToBlocks(content)
      
      const codeBlocks = blocks.filter(b => b.type === 'code')
      expect(codeBlocks).toHaveLength(2)
    })
  })

  describe('generateSlug', () => {
    it('should convert to lowercase', () => {
      expect(generateSlug('Hello World')).toBe('hello-world')
    })

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('hello world')).toBe('hello-world')
    })

    it('should remove special characters', () => {
      expect(generateSlug("What's New?")).toBe('whats-new')
    })

    it('should truncate long slugs', () => {
      const longText = 'a'.repeat(100)
      expect(generateSlug(longText).length).toBeLessThanOrEqual(50)
    })

    it('should handle empty strings', () => {
      expect(generateSlug('')).toBe('')
    })
  })

  describe('tokenize', () => {
    it('should split text into words', () => {
      const tokens = tokenize('Hello world test')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).toContain('test')
    })

    it('should filter short words', () => {
      const tokens = tokenize('I am a test')
      expect(tokens).not.toContain('i')
      expect(tokens).not.toContain('am')
      expect(tokens).not.toContain('a')
      expect(tokens).toContain('test')
    })

    it('should lowercase all tokens', () => {
      const tokens = tokenize('HELLO World')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
    })
  })

  describe('termFrequency', () => {
    it('should calculate normalized TF', () => {
      const tf = termFrequency(['word', 'word', 'test'])
      expect(tf['word']).toBe(1) // max frequency
      expect(tf['test']).toBe(0.5) // half of max
    })

    it('should handle empty tokens', () => {
      const tf = termFrequency([])
      expect(Object.keys(tf)).toHaveLength(0)
    })
  })

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const tf = { word: 1, test: 0.5 }
      expect(cosineSimilarity(tf, tf)).toBeCloseTo(1)
    })

    it('should return 0 for orthogonal vectors', () => {
      const tf1 = { a: 1 }
      const tf2 = { b: 1 }
      expect(cosineSimilarity(tf1, tf2)).toBe(0)
    })

    it('should handle empty vectors', () => {
      expect(cosineSimilarity({}, {})).toBe(0)
      expect(cosineSimilarity({ a: 1 }, {})).toBe(0)
    })
  })

  describe('calculateEntityDensity', () => {
    it('should detect capitalized words', () => {
      const density = calculateEntityDensity('JavaScript and React are popular')
      expect(density).toBeGreaterThan(0)
    })

    it('should detect camelCase', () => {
      const density = calculateEntityDensity('use useState and useEffect')
      expect(density).toBeGreaterThan(0)
    })

    it('should detect acronyms', () => {
      const density = calculateEntityDensity('HTTP API REST JSON')
      expect(density).toBeGreaterThan(0)
    })

    it('should return 0 for empty text', () => {
      expect(calculateEntityDensity('')).toBe(0)
    })
  })

  describe('calculateStructuralImportance', () => {
    it('should score H1 highest', () => {
      const h1 = { type: 'heading', headingLevel: 1 }
      const h2 = { type: 'heading', headingLevel: 2 }
      
      const score1 = calculateStructuralImportance(h1, 0, 10)
      const score2 = calculateStructuralImportance(h2, 0, 10)
      
      expect(score1).toBeGreaterThan(score2)
    })

    it('should score code blocks higher than paragraphs', () => {
      const code = { type: 'code', content: ['code'] }
      const para = { type: 'paragraph', content: ['short'] }
      
      const codeScore = calculateStructuralImportance(code, 5, 10)
      const paraScore = calculateStructuralImportance(para, 5, 10)
      
      expect(codeScore).toBeGreaterThan(paraScore)
    })

    it('should give bonus to early blocks', () => {
      const block = { type: 'paragraph', content: ['text'] }
      
      const earlyScore = calculateStructuralImportance(block, 0, 10)
      const lateScore = calculateStructuralImportance(block, 5, 10)
      
      expect(earlyScore).toBeGreaterThan(lateScore)
    })
  })
})

describe('Integration', () => {
  let tempDir

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'block-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should process a complete markdown document', () => {
    const content = `---
title: Test Document
---

# Introduction

This is the introduction paragraph.

## Features

- Feature one
- Feature two

### Code Example

\`\`\`javascript
const test = true;
\`\`\`
`
    
    const filePath = path.join(tempDir, 'test.md')
    fs.writeFileSync(filePath, content)

    // Parse blocks (simulating what block-processor does)
    const markdownContent = content.split('---').slice(2).join('---').trim()
    const blocks = parseMarkdownToBlocks(markdownContent)

    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some(b => b.type === 'heading')).toBe(true)
    expect(blocks.some(b => b.type === 'paragraph')).toBe(true)
    expect(blocks.some(b => b.type === 'code')).toBe(true)
  })
})

