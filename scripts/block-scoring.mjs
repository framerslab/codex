/**
 * block-scoring.mjs - how worth a block is: term frequencies, topic shift, entity density, semantic novelty and
 * structural importance, weighted into one score. The block processor (scripts/block-processor.js) and its tests
 * import these from here, so the tests run the code the index job runs. No side effects.
 */

import { BLOCK_TYPES } from './markdown-blocks.mjs';

// ============================================================================
// TF-IDF IMPLEMENTATION (Lightweight)
// ============================================================================

/**
 * Tokenize text into words
 */
export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/**
 * Calculate term frequency for a document
 */
export function termFrequency(tokens) {
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
export function cosineSimilarity(tf1, tf2) {
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
export function calculateTopicShift(currentTf, previousTf) {
  if (!previousTf || Object.keys(previousTf).length === 0) {
    return 0.5; // Neutral for first block
  }
  const similarity = cosineSimilarity(currentTf, previousTf);
  return 1 - similarity; // Higher = more topic shift
}

/**
 * Calculate entity density (capitalized words, technical terms)
 */
export function calculateEntityDensity(text) {
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
export function calculateSemanticNovelty(blockTf, documentTf) {
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
export function calculateStructuralImportance(block, blockIndex, totalBlocks) {
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
export function calculateWorthiness(block, blockIndex, totalBlocks, previousTf, documentTf) {
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
