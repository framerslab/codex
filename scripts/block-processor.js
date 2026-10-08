#!/usr/bin/env node
/**
 * block-processor.js - Parse markdown into blocks and score worthiness
 * 
 * This script processes markdown files and:
 * 1. Parses content into semantic blocks (headings, paragraphs, code, lists, etc.)
 * 2. Scores each block for "worthiness" using offline NLP heuristics
 * 3. Updates frontmatter with blocks[] array
 * 
 * Worthiness signals:
 * - topicShift: How much the block shifts from the previous topic (TF-IDF cosine)
 * - entityDensity: Named entity density (capitalized words, technical terms)
 * - semanticNovelty: Distance from document centroid
 * - structuralImportance: Heading level, position in document
 * 
 * Usage:
 *   node scripts/block-processor.js [file.md | directory]
 *   node scripts/block-processor.js --all          # Process all strands
 *   node scripts/block-processor.js --dry-run      # Preview without writing
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ROOT = process.cwd();
const WEAVES_DIR = path.join(ROOT, 'weaves');
const WORTHINESS_THRESHOLD = 0.5;

// Block types we recognize
const BLOCK_TYPES = {
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  CODE: 'code',
  LIST: 'list',
  BLOCKQUOTE: 'blockquote',
  TABLE: 'table',
  HTML: 'html'
};

// ============================================================================
// MARKDOWN PARSING
// ============================================================================

/**
 * Parse markdown content into blocks with line numbers
 */
function parseMarkdownToBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = null;
  let inCodeBlock = false;
  let codeBlockLang = '';
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        // Start code block
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        codeBlockLang = trimmed.slice(3).trim();
        currentBlock = {
          type: BLOCK_TYPES.CODE,
          line: lineNum,
          content: [],
          language: codeBlockLang
        };
        inCodeBlock = true;
      } else {
        // End code block
        currentBlock.content.push(line);
        currentBlock.endLine = lineNum;
        blocks.push(currentBlock);
        currentBlock = null;
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      currentBlock.content.push(line);
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentBlock) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
      }
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const slug = generateSlug(text);
      
      currentBlock = {
        type: BLOCK_TYPES.HEADING,
        line: lineNum,
        endLine: lineNum,
        headingLevel: level,
        headingText: text,
        headingSlug: slug,
        content: [line]
      };
      blocks.push(currentBlock);
      currentBlock = null;
      continue;
    }

    // Handle blockquotes
    if (trimmed.startsWith('>')) {
      if (!currentBlock || currentBlock.type !== BLOCK_TYPES.BLOCKQUOTE) {
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: BLOCK_TYPES.BLOCKQUOTE,
          line: lineNum,
          content: []
        };
      }
      currentBlock.content.push(line);
      continue;
    }

    // Handle lists (unordered and ordered)
    const listMatch = trimmed.match(/^[-*+]|\d+\.\s/);
    if (listMatch) {
      if (!currentBlock || currentBlock.type !== BLOCK_TYPES.LIST) {
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: BLOCK_TYPES.LIST,
          line: lineNum,
          content: []
        };
      }
      currentBlock.content.push(line);
      continue;
    }

    // Handle tables
    if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.match(/^\|?[\s-:|]+\|?$/))) {
      if (!currentBlock || currentBlock.type !== BLOCK_TYPES.TABLE) {
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: BLOCK_TYPES.TABLE,
          line: lineNum,
          content: []
        };
        inTable = true;
      }
      currentBlock.content.push(line);
      continue;
    } else if (inTable && currentBlock) {
      // End table
      currentBlock.endLine = lineNum - 1;
      blocks.push(currentBlock);
      currentBlock = null;
      inTable = false;
    }

    // Handle HTML blocks
    if (trimmed.startsWith('<') && !trimmed.startsWith('<!--')) {
      if (currentBlock) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
      }
      currentBlock = {
        type: BLOCK_TYPES.HTML,
        line: lineNum,
        content: [line]
      };
      // Simple single-line HTML
      if (trimmed.endsWith('>') || trimmed.match(/<[^>]+\/>/)) {
        currentBlock.endLine = lineNum;
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Handle empty lines
    if (trimmed === '') {
      if (currentBlock && currentBlock.type !== BLOCK_TYPES.PARAGRAPH) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Default: paragraph
    if (!currentBlock || currentBlock.type !== BLOCK_TYPES.PARAGRAPH) {
      if (currentBlock) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
      }
      currentBlock = {
        type: BLOCK_TYPES.PARAGRAPH,
        line: lineNum,
        content: []
      };
    }
    currentBlock.content.push(line);
  }

  // Don't forget the last block
  if (currentBlock) {
    currentBlock.endLine = lines.length;
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Generate a URL-friendly slug from text
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// ============================================================================
// TF-IDF IMPLEMENTATION (Lightweight)
// ============================================================================

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/**
 * Calculate term frequency for a document
 */
function termFrequency(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  // Normalize
  const max = Math.max(...Object.values(tf), 1);
  for (const token in tf) {
    tf[token] /= max;
  }
  return tf;
}

/**
 * Calculate cosine similarity between two TF vectors
 */
function cosineSimilarity(tf1, tf2) {
  const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const term of allTerms) {
    const v1 = tf1[term] || 0;
    const v2 = tf2[term] || 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ============================================================================
// WORTHINESS SCORING
// ============================================================================

/**
 * Calculate topic shift from previous block (1 - cosine similarity)
 */
function calculateTopicShift(currentTf, previousTf) {
  if (!previousTf || Object.keys(previousTf).length === 0) {
    return 0.5; // Neutral for first block
  }
  const similarity = cosineSimilarity(currentTf, previousTf);
  return 1 - similarity; // Higher = more topic shift
}

/**
 * Calculate entity density (capitalized words, technical terms)
 */
function calculateEntityDensity(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;

  let entityCount = 0;
  
  // Capitalized words (potential named entities)
  const capitalizedWords = words.filter(w => /^[A-Z][a-z]/.test(w));
  entityCount += capitalizedWords.length;
  
  // Technical terms (camelCase, snake_case, ALL_CAPS)
  const technicalTerms = words.filter(w => 
    /[a-z][A-Z]/.test(w) || // camelCase
    /_/.test(w) ||          // snake_case
    /^[A-Z]{2,}$/.test(w)   // ACRONYMS
  );
  entityCount += technicalTerms.length;
  
  // Code-like tokens (with dots, colons, brackets)
  const codeTokens = words.filter(w => /[.:\[\]()<>{}]/.test(w));
  entityCount += codeTokens.length * 0.5;

  // Normalize by word count
  return Math.min(1, entityCount / words.length);
}

/**
 * Calculate semantic novelty (distance from document centroid)
 */
function calculateSemanticNovelty(blockTf, documentTf) {
  if (!documentTf || Object.keys(documentTf).length === 0) {
    return 0.5;
  }
  const similarity = cosineSimilarity(blockTf, documentTf);
  // Inverse: more different = more novel
  return 1 - similarity;
}

/**
 * Calculate structural importance
 */
function calculateStructuralImportance(block, blockIndex, totalBlocks) {
  let score = 0;

  // Headings are inherently important
  if (block.type === BLOCK_TYPES.HEADING) {
    // H1 = 1.0, H2 = 0.85, H3 = 0.7, etc.
    score = 1 - (block.headingLevel - 1) * 0.15;
  } else if (block.type === BLOCK_TYPES.CODE) {
    // Code blocks are often important
    score = 0.7;
  } else if (block.type === BLOCK_TYPES.TABLE) {
    // Tables contain structured data
    score = 0.65;
  } else if (block.type === BLOCK_TYPES.BLOCKQUOTE) {
    // Quotes can be important citations
    score = 0.5;
  } else if (block.type === BLOCK_TYPES.LIST) {
    // Lists with many items are more important
    const itemCount = block.content?.length || 0;
    score = Math.min(0.6, 0.3 + itemCount * 0.05);
  } else {
    // Paragraphs: check length
    const text = (block.content || []).join(' ');
    const wordCount = text.split(/\s+/).length;
    score = Math.min(0.5, 0.2 + wordCount * 0.005);
  }

  // Position bonus: first few blocks are often important (intro)
  if (blockIndex < 3) {
    score += 0.1;
  }
  // Last block might be conclusion
  if (blockIndex >= totalBlocks - 2) {
    score += 0.05;
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Calculate overall worthiness score for a block
 */
function calculateWorthiness(block, blockIndex, totalBlocks, previousTf, documentTf) {
  const text = (block.content || []).join('\n');
  const tokens = tokenize(text);
  const blockTf = termFrequency(tokens);

  const signals = {
    topicShift: calculateTopicShift(blockTf, previousTf),
    entityDensity: calculateEntityDensity(text),
    semanticNovelty: calculateSemanticNovelty(blockTf, documentTf),
    structuralImportance: calculateStructuralImportance(block, blockIndex, totalBlocks)
  };

  // Weighted combination
  const weights = {
    topicShift: 0.2,
    entityDensity: 0.25,
    semanticNovelty: 0.2,
    structuralImportance: 0.35
  };

  const score = 
    signals.topicShift * weights.topicShift +
    signals.entityDensity * weights.entityDensity +
    signals.semanticNovelty * weights.semanticNovelty +
    signals.structuralImportance * weights.structuralImportance;

  return {
    score: Math.round(score * 1000) / 1000,
    signals: {
      topicShift: Math.round(signals.topicShift * 1000) / 1000,
      entityDensity: Math.round(signals.entityDensity * 1000) / 1000,
      semanticNovelty: Math.round(signals.semanticNovelty * 1000) / 1000,
      structuralImportance: Math.round(signals.structuralImportance * 1000) / 1000
    }
  };
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/**
 * Process a single markdown file
 */
function processFile(filePath, dryRun = false) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  // Parse content into blocks
  const parsedBlocks = parseMarkdownToBlocks(content);
  
  if (parsedBlocks.length === 0) {
    console.log(`  ⚠️  No blocks found in ${path.basename(filePath)}`);
    return null;
  }

  // Calculate document-level TF for semantic novelty
  const documentTokens = tokenize(content);
  const documentTf = termFrequency(documentTokens);

  // Process each block
  const blocks = [];
  let previousTf = null;

  for (let i = 0; i < parsedBlocks.length; i++) {
    const block = parsedBlocks[i];
    const text = (block.content || []).join('\n');
    const tokens = tokenize(text);
    const blockTf = termFrequency(tokens);

    // Calculate worthiness
    const worthiness = calculateWorthiness(
      block, i, parsedBlocks.length, previousTf, documentTf
    );

    // Generate block ID
    let blockId;
    if (block.type === BLOCK_TYPES.HEADING && block.headingSlug) {
      blockId = block.headingSlug;
    } else {
      blockId = `block-${block.line}`;
    }

    // Build block entry
    const blockEntry = {
      id: blockId,
      line: block.line,
      endLine: block.endLine,
      type: block.type,
      ...(block.headingLevel && { headingLevel: block.headingLevel }),
      ...(block.headingText && { headingText: block.headingText }),
      tags: [], // Will be populated by block-tagging.js
      suggestedTags: [], // Will be populated by block-tagging.js
      worthiness
    };

    // Generate extractive summary for worthy blocks
    if (worthiness.score >= WORTHINESS_THRESHOLD && block.type === BLOCK_TYPES.PARAGRAPH) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        blockEntry.extractiveSummary = sentences[0].trim().slice(0, 200);
      }
    }

    blocks.push(blockEntry);
    previousTf = blockTf;
  }

  // Update frontmatter
  const updatedFrontmatter = {
    ...frontmatter,
    blocks
  };

  // Rebuild file
  const output = matter.stringify(content, updatedFrontmatter);

  if (dryRun) {
    console.log(`  📋 Would update ${path.basename(filePath)}`);
    console.log(`     - ${blocks.length} blocks`);
    console.log(`     - ${blocks.filter(b => b.worthiness.score >= WORTHINESS_THRESHOLD).length} worthy blocks`);
    return { filePath, blocks, dryRun: true };
  }

  fs.writeFileSync(filePath, output, 'utf8');
  console.log(`  ✅ Updated ${path.basename(filePath)}`);
  console.log(`     - ${blocks.length} blocks`);
  console.log(`     - ${blocks.filter(b => b.worthiness.score >= WORTHINESS_THRESHOLD).length} worthy blocks`);
  
  return { filePath, blocks, dryRun: false };
}

/**
 * Process all markdown files in a directory
 */
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
        // Skip weave.yaml and loom.yaml disguised as .md
        if (['weave.yaml', 'loom.yaml'].includes(entry.name)) continue;
        
        try {
          const result = processFile(fullPath, dryRun);
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

// ============================================================================
// CLI
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const processAll = args.includes('--all');
  
  // Filter out flags
  const paths = args.filter(a => !a.startsWith('--'));

  console.log('🔧 Block Processor');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log('');

  if (processAll || paths.length === 0) {
    console.log(`📁 Processing all threads in ${WEAVES_DIR}`);
    const results = processDirectory(WEAVES_DIR, dryRun);
    console.log('');
    console.log(`✨ Processed ${results.length} files`);
  } else {
    for (const p of paths) {
      const fullPath = path.resolve(p);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        console.log(`📁 Processing directory: ${p}`);
        processDirectory(fullPath, dryRun);
      } else if (stat.isFile() && fullPath.endsWith('.md')) {
        console.log(`📄 Processing file: ${p}`);
        processFile(fullPath, dryRun);
      } else {
        console.warn(`⚠️  Skipping: ${p} (not a .md file or directory)`);
      }
    }
  }
}

main();

