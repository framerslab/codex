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
import { BLOCK_TYPES, parseMarkdownToBlocks } from './markdown-blocks.mjs';
import { tokenize, termFrequency, calculateWorthiness } from './block-scoring.mjs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ROOT = process.cwd();
const WEAVES_DIR = path.join(ROOT, 'weaves');
const WORTHINESS_THRESHOLD = 0.5;

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

