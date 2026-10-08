#!/usr/bin/env node
/**
 * block-tagging.js - Auto-tag suggestion engine for blocks
 * 
 * This module suggests tags for blocks based on:
 * 1. Controlled vocabulary matching (tags/index.yaml)
 * 2. Document-level tag propagation
 * 3. TF-IDF keyword extraction
 * 4. Prior block tag consistency
 * 
 * Usage:
 *   import { suggestTagsForBlock, suggestTagsForStrand } from './lib/block-tagging.js';
 *   
 *   // Or as CLI:
 *   node lib/block-tagging.js [file.md | directory]
 *   node lib/block-tagging.js --all
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ROOT = process.cwd();
const TAGS_FILE = path.join(ROOT, 'tags', 'index.yaml');
const VOCAB_DIR = path.join(ROOT, 'vocab');
const WEAVES_DIR = path.join(ROOT, 'weaves');

// Minimum confidence to suggest a tag
const MIN_CONFIDENCE = 0.3;
// Maximum suggestions per block
const MAX_SUGGESTIONS_PER_BLOCK = 5;

// Pattern for extracting inline hashtags from content
// Matches: #react, #frontend-dev, #web/javascript
// Does NOT match: #123 (must start with letter), markdown headings
const INLINE_TAG_PATTERN = /#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

// ============================================================================
// VOCABULARY LOADING
// ============================================================================

let vocabulary = null;
let flatVocab = null;

/**
 * Load and flatten the vocabulary from tags/index.yaml and vocab/
 */
function loadVocabulary() {
  if (vocabulary) return vocabulary;

  vocabulary = {
    subjects: [],
    topics: [],
    skills: [],
    terms: new Map() // term -> { category, synonyms }
  };

  // Load main tags index
  if (fs.existsSync(TAGS_FILE)) {
    try {
      const tagsData = yaml.load(fs.readFileSync(TAGS_FILE, 'utf8'));
      
      if (tagsData.subjects) {
        vocabulary.subjects = Object.keys(tagsData.subjects);
        for (const [subject, data] of Object.entries(tagsData.subjects)) {
          vocabulary.terms.set(subject.toLowerCase(), { category: 'subject', original: subject });
          // Add topics under subjects
          if (data.topics) {
            for (const topic of Object.keys(data.topics)) {
              vocabulary.topics.push(topic);
              vocabulary.terms.set(topic.toLowerCase(), { category: 'topic', original: topic, parent: subject });
            }
          }
        }
      }
      
      if (tagsData.skills) {
        vocabulary.skills = tagsData.skills;
        for (const skill of tagsData.skills) {
          vocabulary.terms.set(skill.toLowerCase(), { category: 'skill', original: skill });
        }
      }
    } catch (err) {
      console.warn('[block-tagging] Failed to load tags/index.yaml:', err.message);
    }
  }

  // Load additional vocabulary files
  if (fs.existsSync(VOCAB_DIR)) {
    const vocabFiles = fs.readdirSync(VOCAB_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of vocabFiles) {
      try {
        const vocabData = yaml.load(fs.readFileSync(path.join(VOCAB_DIR, file), 'utf8'));
        if (vocabData && typeof vocabData === 'object') {
          for (const [term, data] of Object.entries(vocabData)) {
            vocabulary.terms.set(term.toLowerCase(), { 
              category: data.category || 'term', 
              original: term,
              synonyms: data.synonyms || []
            });
            // Add synonyms as aliases
            if (data.synonyms) {
              for (const syn of data.synonyms) {
                vocabulary.terms.set(syn.toLowerCase(), { 
                  category: data.category || 'term', 
                  original: term,
                  isSynonym: true
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[block-tagging] Failed to load vocab/${file}:`, err.message);
      }
    }
  }

  // Create flat vocab for quick matching
  flatVocab = Array.from(vocabulary.terms.entries()).map(([term, data]) => ({
    term,
    ...data
  }));

  console.log(`[block-tagging] Loaded vocabulary: ${vocabulary.terms.size} terms`);
  return vocabulary;
}

// ============================================================================
// TEXT PROCESSING
// ============================================================================

/**
 * Tokenize and normalize text
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/**
 * Extract n-grams from tokens
 */
function extractNgrams(tokens, n = 2) {
  const ngrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Calculate TF-IDF score for terms
 */
function calculateTfIdf(tokens, idf = {}) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  
  const scores = {};
  const maxTf = Math.max(...Object.values(tf), 1);
  
  for (const [token, count] of Object.entries(tf)) {
    const normalizedTf = count / maxTf;
    const idfScore = idf[token] || 1.5; // Default IDF for unknown terms
    scores[token] = normalizedTf * idfScore;
  }
  
  return scores;
}

// ============================================================================
// INLINE TAG EXTRACTION
// ============================================================================

/**
 * Extract inline hashtags from content
 * Returns array of tag suggestions with source: 'inline' and confidence: 1.0
 *
 * @param {string} text - Content to extract tags from
 * @returns {Array<{tag: string, confidence: number, source: string, reasoning: string}>}
 */
export function extractInlineTags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matches = [];
  const seen = new Set();
  let match;

  // Reset regex state for global pattern
  INLINE_TAG_PATTERN.lastIndex = 0;

  while ((match = INLINE_TAG_PATTERN.exec(text)) !== null) {
    const tag = match[1].toLowerCase();

    // Skip markdown heading patterns (h1-h6) and already seen tags
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    matches.push({
      tag,
      confidence: 1.0,  // Inline tags are explicit user intent - full confidence
      source: 'inline',
      reasoning: 'Explicit inline hashtag in content'
    });
  }

  return matches;
}

// ============================================================================
// TAG SUGGESTION
// ============================================================================

/**
 * Suggest tags for a single block
 */
export function suggestTagsForBlock(blockContent, options = {}) {
  const {
    documentTags = [],
    priorBlockTags = [],
    blockType = 'paragraph',
    worthinessScore = 0.5
  } = options;

  loadVocabulary();

  const suggestions = [];
  const text = typeof blockContent === 'string'
    ? blockContent
    : (blockContent.content || []).join('\n');

  if (!text || text.trim().length === 0) {
    return suggestions;
  }

  // 1. INLINE TAG EXTRACTION (highest priority - explicit user intent)
  const inlineTags = extractInlineTags(text);
  suggestions.push(...inlineTags);

  const tokens = tokenize(text);
  const bigrams = extractNgrams(tokens, 2);
  const trigrams = extractNgrams(tokens, 3);
  const allTerms = [...tokens, ...bigrams, ...trigrams];
  const tfIdfScores = calculateTfIdf(tokens);

  // 2. Vocabulary matching
  for (const term of allTerms) {
    const vocabEntry = vocabulary.terms.get(term);
    if (vocabEntry) {
      const confidence = vocabEntry.isSynonym ? 0.7 : 0.85;
      suggestions.push({
        tag: vocabEntry.original,
        confidence,
        source: 'nlp',
        reasoning: `Vocabulary match (${vocabEntry.category})`
      });
    }
  }

  // 3. Document tag propagation
  for (const docTag of documentTags) {
    const tagLower = docTag.toLowerCase();
    // Check if any token relates to the document tag
    const relevance = tokens.filter(t => 
      t.includes(tagLower) || tagLower.includes(t) || levenshteinDistance(t, tagLower) <= 2
    ).length;
    
    if (relevance > 0) {
      suggestions.push({
        tag: docTag,
        confidence: Math.min(0.75, 0.4 + relevance * 0.1),
        source: 'existing',
        reasoning: 'Propagated from document tags'
      });
    }
  }

  // 4. Prior block tag consistency
  for (const priorTag of priorBlockTags) {
    const tagLower = priorTag.toLowerCase();
    const relevance = tokens.filter(t => 
      t.includes(tagLower) || tagLower.includes(t)
    ).length;
    
    if (relevance > 0) {
      suggestions.push({
        tag: priorTag,
        confidence: Math.min(0.7, 0.35 + relevance * 0.1),
        source: 'existing',
        reasoning: 'Consistent with prior block tags'
      });
    }
  }

  // 5. TF-IDF keyword extraction (for high-scoring terms not in vocab)
  const topKeywords = Object.entries(tfIdfScores)
    .filter(([term, score]) => score > 0.3 && term.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  for (const [keyword, score] of topKeywords) {
    // Only suggest if not already covered by vocab
    if (!vocabulary.terms.has(keyword)) {
      suggestions.push({
        tag: keyword,
        confidence: Math.min(0.6, score * 0.5),
        source: 'nlp',
        reasoning: 'TF-IDF keyword extraction'
      });
    }
  }

  // 6. Block type specific suggestions (language detection for code blocks)
  if (blockType === 'code') {
    // Try to detect programming language
    const langPatterns = {
      'python': /\b(def|import|from|class|self)\b/,
      'javascript': /\b(const|let|var|function|=>|async|await)\b/,
      'typescript': /\b(interface|type|enum|as|implements)\b/,
      'rust': /\b(fn|let|mut|impl|pub|mod)\b/,
      'go': /\b(func|package|import|defer|go|chan)\b/,
      'sql': /\b(SELECT|FROM|WHERE|JOIN|INSERT|UPDATE)\b/i,
      'bash': /\b(echo|cd|ls|grep|awk|sed)\b/,
    };
    
    for (const [lang, pattern] of Object.entries(langPatterns)) {
      if (pattern.test(text)) {
        suggestions.push({
          tag: lang,
          confidence: 0.8,
          source: 'nlp',
          reasoning: 'Detected programming language'
        });
        break;
      }
    }
  }

  // Deduplicate and filter
  // Note: Inline tags are added first and have confidence 1.0, so they take precedence
  // When the same tag appears from both inline and NLP, the inline version is kept
  const seen = new Set();
  const filtered = suggestions
    .filter(s => s.confidence >= MIN_CONFIDENCE)
    .filter(s => {
      const key = s.tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      // Sort by confidence descending, inline tags always first for equal confidence
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.source === 'inline' && b.source !== 'inline') return -1;
      if (b.source === 'inline' && a.source !== 'inline') return 1;
      return 0;
    })
    .slice(0, MAX_SUGGESTIONS_PER_BLOCK);

  return filtered;
}

/**
 * Suggest tags for all blocks in a strand
 */
export function suggestTagsForStrand(filePath, dryRun = false) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  // Get document-level tags
  const documentTags = [
    ...(frontmatter.taxonomy?.topic || []),
    ...(frontmatter.taxonomy?.subtopic || []),
    ...(frontmatter.taxonomy?.subject || []),
    ...(frontmatter.tags || [])
  ];

  // Process existing blocks
  const blocks = frontmatter.blocks || [];
  if (blocks.length === 0) {
    console.log(`  ⚠️  No blocks in ${path.basename(filePath)} - run block-processor.js first`);
    return null;
  }

  let priorBlockTags = [];
  let totalSuggestions = 0;

  for (const block of blocks) {
    // Skip blocks with low worthiness
    if ((block.worthiness?.score || 0) < 0.3) {
      continue;
    }

    // Get block content from the file using line numbers
    const lines = content.split('\n');
    const blockContent = lines.slice(block.line - 1, block.endLine).join('\n');

    // Generate suggestions
    const suggestions = suggestTagsForBlock(blockContent, {
      documentTags,
      priorBlockTags,
      blockType: block.type,
      worthinessScore: block.worthiness?.score || 0.5
    });

    // Update block
    block.suggestedTags = suggestions;
    totalSuggestions += suggestions.length;

    // Update prior tags for consistency
    priorBlockTags = [
      ...priorBlockTags.slice(-10), // Keep last 10
      ...(block.tags || []),
      ...suggestions.map(s => s.tag)
    ];
  }

  // Write back
  if (!dryRun) {
    const updated = matter.stringify(content, { ...frontmatter, blocks });
    fs.writeFileSync(filePath, updated, 'utf8');
  }

  console.log(`  ${dryRun ? '📋' : '✅'} ${path.basename(filePath)}: ${totalSuggestions} suggestions across ${blocks.length} blocks`);
  
  return { filePath, blocks, totalSuggestions };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================================================
// CLI
// ============================================================================

function processDirectory(dirPath, dryRun = false) {
  const results = [];
  
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', '.git', '.cache'].includes(entry.name)) continue;
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const result = suggestTagsForStrand(fullPath, dryRun);
          if (result) results.push(result);
        } catch (err) {
          console.error(`  ❌ Error processing ${entry.name}:`, err.message);
        }
      }
    }
  };
  
  walk(dirPath);
  return results;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const processAll = args.includes('--all');
  
  const paths = args.filter(a => !a.startsWith('--'));

  console.log('🏷️  Block Tagger');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log('');

  // Load vocabulary first
  loadVocabulary();
  console.log('');

  if (processAll || paths.length === 0) {
    console.log(`📁 Processing all threads in ${WEAVES_DIR}`);
    const results = processDirectory(WEAVES_DIR, dryRun);
    const totalSuggestions = results.reduce((sum, r) => sum + r.totalSuggestions, 0);
    console.log('');
    console.log(`✨ Processed ${results.length} files, ${totalSuggestions} total suggestions`);
  } else {
    for (const p of paths) {
      const fullPath = path.resolve(p);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        console.log(`📁 Processing directory: ${p}`);
        processDirectory(fullPath, dryRun);
      } else if (stat.isFile() && fullPath.endsWith('.md')) {
        console.log(`📄 Processing file: ${p}`);
        suggestTagsForStrand(fullPath, dryRun);
      }
    }
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].includes('block-tagging')) {
  main();
}

export default { suggestTagsForBlock, suggestTagsForStrand };

