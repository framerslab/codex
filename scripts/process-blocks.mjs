#!/usr/bin/env node
/**
 * process-blocks.mjs - Unified Block Processing Pipeline
 * 
 * Single entry point that combines:
 * 1. block-processor.js - Parse markdown into blocks, calculate worthiness
 * 2. block-tagging.js - Suggest tags (inline, NLP, vocabulary)
 * 3. build-index.mjs - Build codex-blocks.json index
 * 
 * Usage:
 *   node scripts/process-blocks.mjs                    # Process all strands
 *   node scripts/process-blocks.mjs --file path.md    # Process single file
 *   node scripts/process-blocks.mjs --dry-run         # Preview without writing
 *   node scripts/process-blocks.mjs --watch           # Watch mode (dev)
 *   node scripts/process-blocks.mjs --skip-index      # Skip index build
 * 
 * This replaces the 3-step pipeline:
 *   1. node scripts/block-processor.js --all
 *   2. node lib/block-tagging.js --all  
 *   3. npm run build:index
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const WEAVES_DIR = path.join(ROOT, 'weaves');
const TAGS_FILE = path.join(ROOT, 'tags', 'index.yaml');
const VOCAB_DIR = path.join(ROOT, 'vocab');

// Configuration
const CONFIG = {
    WORTHINESS_THRESHOLD: 0.5,
    AUTO_CONFIRM_THRESHOLD: 0.5,
    MAX_TAGS_PER_BLOCK: 10,
    MIN_CONFIDENCE: 0.3,
};

// Patterns
const INLINE_TAG_PATTERN = /#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
const HEADING_PATTERNS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const IGNORED_SEGMENTS = new Set(['.git', '.github', '.DS_Store', 'node_modules', '.cache']);

// Block types
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
// VOCABULARY LOADING
// ============================================================================

let vocabulary = null;
let flatVocab = null;

function loadVocabulary() {
    if (flatVocab) return flatVocab;

    const vocab = new Map();

    // Load from tags/index.yaml
    if (fs.existsSync(TAGS_FILE)) {
        try {
            const tagsData = yaml.load(fs.readFileSync(TAGS_FILE, 'utf8'));

            const addTags = (obj, parentPath = '') => {
                if (!obj || typeof obj !== 'object') return;

                for (const [key, value] of Object.entries(obj)) {
                    const termKey = key.toLowerCase().replace(/\s+/g, '-');
                    vocab.set(termKey, {
                        term: key,
                        category: parentPath,
                        source: 'tags',
                        aliases: []
                    });

                    if (Array.isArray(value)) {
                        for (const item of value) {
                            if (typeof item === 'string') {
                                vocab.set(item.toLowerCase().replace(/\s+/g, '-'), {
                                    term: item,
                                    category: key,
                                    source: 'tags',
                                    aliases: []
                                });
                            }
                        }
                    } else if (typeof value === 'object') {
                        addTags(value, key);
                    }
                }
            };

            addTags(tagsData);
        } catch (e) {
            console.warn('  ⚠️ Could not load tags/index.yaml:', e.message);
        }
    }

    // Load from vocab/*.yaml
    if (fs.existsSync(VOCAB_DIR)) {
        try {
            const vocabFiles = fs.readdirSync(VOCAB_DIR).filter(f => f.endsWith('.yaml'));
            for (const file of vocabFiles) {
                const vocabData = yaml.load(fs.readFileSync(path.join(VOCAB_DIR, file), 'utf8'));
                if (vocabData?.terms) {
                    for (const term of vocabData.terms) {
                        const termObj = typeof term === 'string' ? { term } : term;
                        vocab.set(termObj.term.toLowerCase().replace(/\s+/g, '-'), {
                            term: termObj.term,
                            category: vocabData.category || file.replace('.yaml', ''),
                            source: 'vocab',
                            aliases: termObj.aliases || []
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('  ⚠️ Could not load vocab files:', e.message);
        }
    }

    flatVocab = vocab;
    return vocab;
}

// ============================================================================
// TEXT PROCESSING
// ============================================================================

function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
}

function termFrequency(tokens) {
    const tf = {};
    for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
    }
    const max = Math.max(...Object.values(tf), 1);
    for (const token in tf) {
        tf[token] /= max;
    }
    return tf;
}

function cosineSimilarity(tf1, tf2) {
    const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
    let dotProduct = 0, norm1 = 0, norm2 = 0;
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
// MARKDOWN PARSING
// ============================================================================

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
                currentBlock = { type: BLOCK_TYPES.BLOCKQUOTE, line: lineNum, content: [] };
            }
            currentBlock.content.push(line);
            continue;
        }

        // Handle lists
        const listMatch = trimmed.match(/^[-*+]|\d+\.\s/);
        if (listMatch) {
            if (!currentBlock || currentBlock.type !== BLOCK_TYPES.LIST) {
                if (currentBlock) {
                    currentBlock.endLine = lineNum - 1;
                    blocks.push(currentBlock);
                }
                currentBlock = { type: BLOCK_TYPES.LIST, line: lineNum, content: [] };
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
                currentBlock = { type: BLOCK_TYPES.TABLE, line: lineNum, content: [] };
                inTable = true;
            }
            currentBlock.content.push(line);
            continue;
        } else if (inTable && currentBlock) {
            currentBlock.endLine = lineNum - 1;
            blocks.push(currentBlock);
            currentBlock = null;
            inTable = false;
        }

        // Handle HTML
        if (trimmed.startsWith('<') && !trimmed.startsWith('<!--')) {
            if (currentBlock) {
                currentBlock.endLine = lineNum - 1;
                blocks.push(currentBlock);
            }
            currentBlock = { type: BLOCK_TYPES.HTML, line: lineNum, content: [line] };
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
            currentBlock = { type: BLOCK_TYPES.PARAGRAPH, line: lineNum, content: [] };
        }
        currentBlock.content.push(line);
    }

    if (currentBlock) {
        currentBlock.endLine = lines.length;
        blocks.push(currentBlock);
    }

    return blocks;
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
}

// ============================================================================
// WORTHINESS SCORING
// ============================================================================

function calculateEntityDensity(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;

    let entityCount = 0;
    const capitalizedWords = words.filter(w => /^[A-Z][a-z]/.test(w));
    entityCount += capitalizedWords.length;

    const technicalTerms = words.filter(w =>
        /[a-z][A-Z]/.test(w) || /_/.test(w) || /^[A-Z]{2,}$/.test(w)
    );
    entityCount += technicalTerms.length;

    const codeTokens = words.filter(w => /[.:\[\]()<>{}]/.test(w));
    entityCount += codeTokens.length * 0.5;

    return Math.min(1, entityCount / words.length);
}

function calculateStructuralImportance(block, blockIndex, totalBlocks) {
    let score = 0;

    if (block.type === BLOCK_TYPES.HEADING) {
        score = 1 - (block.headingLevel - 1) * 0.15;
    } else if (block.type === BLOCK_TYPES.CODE) {
        score = 0.7;
    } else if (block.type === BLOCK_TYPES.TABLE) {
        score = 0.65;
    } else if (block.type === BLOCK_TYPES.BLOCKQUOTE) {
        score = 0.5;
    } else if (block.type === BLOCK_TYPES.LIST) {
        const itemCount = block.content?.length || 0;
        score = Math.min(0.6, 0.3 + itemCount * 0.05);
    } else {
        const text = (block.content || []).join(' ');
        const wordCount = text.split(/\s+/).length;
        score = Math.min(0.5, 0.2 + wordCount * 0.005);
    }

    if (blockIndex < 3) score += 0.1;
    if (blockIndex >= totalBlocks - 2) score += 0.05;

    return Math.min(1, Math.max(0, score));
}

function calculateWorthiness(block, blockIndex, totalBlocks, previousTf, documentTf) {
    const text = (block.content || []).join('\n');
    const tokens = tokenize(text);
    const blockTf = termFrequency(tokens);

    const topicShift = previousTf && Object.keys(previousTf).length > 0
        ? 1 - cosineSimilarity(blockTf, previousTf)
        : 0.5;

    const entityDensity = calculateEntityDensity(text);

    const semanticNovelty = documentTf && Object.keys(documentTf).length > 0
        ? 1 - cosineSimilarity(blockTf, documentTf)
        : 0.5;

    const structuralImportance = calculateStructuralImportance(block, blockIndex, totalBlocks);

    const score =
        topicShift * 0.2 +
        entityDensity * 0.25 +
        semanticNovelty * 0.2 +
        structuralImportance * 0.35;

    return {
        score: Math.round(score * 1000) / 1000,
        signals: {
            topicShift: Math.round(topicShift * 1000) / 1000,
            entityDensity: Math.round(entityDensity * 1000) / 1000,
            semanticNovelty: Math.round(semanticNovelty * 1000) / 1000,
            structuralImportance: Math.round(structuralImportance * 1000) / 1000
        }
    };
}

// ============================================================================
// TAG SUGGESTION
// ============================================================================

function extractInlineTags(text) {
    const tags = [];
    const seen = new Set();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        INLINE_TAG_PATTERN.lastIndex = 0;

        let match;
        while ((match = INLINE_TAG_PATTERN.exec(line)) !== null) {
            const tag = match[1].toLowerCase();
            if (HEADING_PATTERNS.has(tag) || seen.has(tag)) continue;

            seen.add(tag);
            tags.push({
                tag,
                confidence: 1.0,
                source: 'inline',
                reasoning: 'Explicit inline hashtag in content',
                lineNumber: i + 1
            });
        }
    }

    return tags;
}

function suggestTagsFromVocabulary(text, documentTags = []) {
    const vocab = loadVocabulary();
    const suggestions = [];
    const textLower = text.toLowerCase();
    const tokens = new Set(tokenize(text));

    // Match vocabulary terms
    for (const [termKey, termData] of vocab) {
        const searchTerms = [termKey, termData.term.toLowerCase(), ...(termData.aliases || [])];

        for (const searchTerm of searchTerms) {
            if (textLower.includes(searchTerm) || tokens.has(searchTerm.replace(/\s+/g, ''))) {
                suggestions.push({
                    tag: termKey,
                    confidence: 0.7,
                    source: 'nlp',
                    reasoning: `Vocabulary match: ${termData.category}`
                });
                break;
            }
        }
    }

    // Propagate document-level tags
    for (const docTag of documentTags) {
        const tagKey = docTag.toLowerCase().replace(/\s+/g, '-');
        if (!suggestions.find(s => s.tag === tagKey)) {
            suggestions.push({
                tag: tagKey,
                confidence: 0.5,
                source: 'existing',
                reasoning: 'Propagated from document tags'
            });
        }
    }

    return suggestions.slice(0, CONFIG.MAX_TAGS_PER_BLOCK);
}

function suggestTagsForBlock(blockContent, documentTags = []) {
    const allTags = [];
    const seen = new Set();

    // 1. Inline tags (highest priority)
    const inlineTags = extractInlineTags(blockContent);
    for (const tag of inlineTags) {
        seen.add(tag.tag);
        allTags.push(tag);
    }

    // 2. Vocabulary/NLP tags (skip duplicates)
    const nlpTags = suggestTagsFromVocabulary(blockContent, documentTags);
    for (const tag of nlpTags) {
        if (!seen.has(tag.tag)) {
            seen.add(tag.tag);
            allTags.push(tag);
        }
    }

    return allTags.slice(0, CONFIG.MAX_TAGS_PER_BLOCK);
}

// ============================================================================
// STRAND PROCESSING
// ============================================================================

function processStrand(filePath, options = {}) {
    const { dryRun = false } = options;

    const raw = fs.readFileSync(filePath, 'utf8');
    const { content, data: frontmatter } = matter(raw);
    const title = frontmatter.title || path.basename(filePath, '.md');

    // Parse blocks
    const parsedBlocks = parseMarkdownToBlocks(content);
    if (parsedBlocks.length === 0) return null;

    // Calculate document TF for worthiness
    const documentTokens = tokenize(content);
    const documentTf = termFrequency(documentTokens);
    const documentTags = frontmatter.taxonomy?.topic || frontmatter.tags || [];

    // Process each block
    const blocks = [];
    let previousTf = null;

    for (let i = 0; i < parsedBlocks.length; i++) {
        const block = parsedBlocks[i];
        const text = (block.content || []).join('\n');
        const tokens = tokenize(text);
        const blockTf = termFrequency(tokens);

        // Calculate worthiness
        const worthiness = calculateWorthiness(block, i, parsedBlocks.length, previousTf, documentTf);

        // Suggest tags (inline + NLP)
        const suggestedTags = worthiness.score >= CONFIG.WORTHINESS_THRESHOLD
            ? suggestTagsForBlock(text, documentTags)
            : [];

        // Generate block ID
        const blockId = block.type === BLOCK_TYPES.HEADING && block.headingSlug
            ? block.headingSlug
            : `block-${block.line}`;

        // Build block entry
        const blockEntry = {
            id: blockId,
            line: block.line,
            endLine: block.endLine,
            type: block.type,
            ...(block.headingLevel && { headingLevel: block.headingLevel }),
            ...(block.headingText && { headingText: block.headingText }),
            tags: [],
            suggestedTags,
            worthiness
        };

        // Generate extractive summary for worthy paragraphs
        if (worthiness.score >= CONFIG.WORTHINESS_THRESHOLD && block.type === BLOCK_TYPES.PARAGRAPH) {
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            if (sentences.length > 0) {
                blockEntry.extractiveSummary = sentences[0].trim().slice(0, 200);
            }
        }

        blocks.push(blockEntry);
        previousTf = blockTf;
    }

    // Update frontmatter
    const updatedFrontmatter = { ...frontmatter, blocks };
    const output = matter.stringify(content, updatedFrontmatter);

    if (!dryRun) {
        fs.writeFileSync(filePath, output, 'utf8');
    }

    return { filePath, title, blocks };
}

// ============================================================================
// INDEX BUILDING
// ============================================================================

function buildIndex(results, options = {}) {
    const now = new Date().toISOString();
    const uniqueTagsSet = new Set();

    const blocksIndex = {
        generatedAt: now,
        version: '1.0.0',
        stats: {
            totalStrands: 0,
            totalBlocks: 0,
            totalTags: 0,
            uniqueTags: 0,
            worthyBlocks: 0,
            pendingSuggestions: 0,
            autoConfirmedTags: 0,
            tagsBySource: { inline: 0, nlp: 0, llm: 0, existing: 0, user: 0 },
            blocksByType: {}
        },
        tagIndex: {},
        strands: {}
    };

    for (const result of results) {
        if (!result) continue;

        const strandPath = path.relative(ROOT, result.filePath).replace(/\\/g, '/');

        blocksIndex.stats.totalStrands++;

        const strandBlocks = {
            path: strandPath,
            title: result.title,
            blockCount: result.blocks.length,
            tagCount: 0,
            worthyBlockCount: 0,
            blocks: []
        };

        for (const block of result.blocks) {
            blocksIndex.stats.totalBlocks++;

            // Count block types
            const blockType = block.type || 'unknown';
            blocksIndex.stats.blocksByType[blockType] = (blocksIndex.stats.blocksByType[blockType] || 0) + 1;

            // Start with existing tags
            const tags = [...(block.tags || [])];
            const suggestedTags = block.suggestedTags || [];

            // Auto-confirm high-confidence suggestions
            const remainingSuggestions = [];
            for (const st of suggestedTags) {
                if (st.confidence >= CONFIG.AUTO_CONFIRM_THRESHOLD && !tags.includes(st.tag)) {
                    tags.push(st.tag);
                    blocksIndex.stats.autoConfirmedTags++;
                } else if (!tags.includes(st.tag)) {
                    remainingSuggestions.push(st);
                }
            }

            // Process confirmed tags
            for (const tag of tags) {
                blocksIndex.stats.totalTags++;
                uniqueTagsSet.add(tag);

                if (!blocksIndex.tagIndex[tag]) {
                    blocksIndex.tagIndex[tag] = [];
                }
                blocksIndex.tagIndex[tag].push({
                    strandPath,
                    blockId: block.id,
                    confidence: 1.0
                });
            }
            strandBlocks.tagCount += tags.length;

            // Track remaining suggestions
            if (remainingSuggestions.length > 0) {
                blocksIndex.stats.pendingSuggestions++;
                for (const st of remainingSuggestions) {
                    const source = st.source || 'nlp';
                    blocksIndex.stats.tagsBySource[source] = (blocksIndex.stats.tagsBySource[source] || 0) + 1;
                }
            }

            // Check worthiness
            if ((block.worthiness?.score ?? 0) >= CONFIG.WORTHINESS_THRESHOLD) {
                blocksIndex.stats.worthyBlocks++;
                strandBlocks.worthyBlockCount++;
            }

            // Add to strand
            strandBlocks.blocks.push({
                id: block.id,
                line: block.line,
                endLine: block.endLine,
                type: block.type,
                headingLevel: block.headingLevel,
                headingText: block.headingText,
                tags,
                suggestedTags: remainingSuggestions,
                worthiness: block.worthiness,
                extractiveSummary: block.extractiveSummary,
                warrantsIllustration: block.warrantsIllustration
            });
        }

        blocksIndex.strands[strandPath] = strandBlocks;
    }

    blocksIndex.stats.uniqueTags = uniqueTagsSet.size;

    // Write index
    const blocksOutPath = path.join(ROOT, 'codex-blocks.json');
    fs.writeFileSync(blocksOutPath, JSON.stringify(blocksIndex, null, 2), 'utf8');

    return blocksIndex;
}

// ============================================================================
// MAIN CLI
// ============================================================================

function walkDirectory(dirPath, callback) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (IGNORED_SEGMENTS.has(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            walkDirectory(fullPath, callback);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            if (['weave.yaml', 'loom.yaml'].includes(entry.name)) continue;
            callback(fullPath);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const skipIndex = args.includes('--skip-index');
    const fileArg = args.find(a => a.startsWith('--file='));
    const targetFile = fileArg ? fileArg.split('=')[1] : null;

    console.log('🔧 Unified Block Processing Pipeline');
    console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
    console.log('');

    const results = [];

    if (targetFile) {
        // Process single file
        console.log(`📄 Processing: ${targetFile}`);
        const result = processStrand(path.resolve(targetFile), { dryRun });
        if (result) {
            results.push(result);
            console.log(`   ✅ ${result.blocks.length} blocks`);
        }
    } else {
        // Process all strands
        console.log(`📁 Processing all threads in ${WEAVES_DIR}`);
        console.log('');

        walkDirectory(WEAVES_DIR, (filePath) => {
            try {
                const result = processStrand(filePath, { dryRun });
                if (result) {
                    results.push(result);
                    const worthy = result.blocks.filter(b => b.worthiness?.score >= CONFIG.WORTHINESS_THRESHOLD).length;
                    console.log(`   ✅ ${path.basename(filePath)} (${result.blocks.length} blocks, ${worthy} worthy)`);
                }
            } catch (err) {
                console.error(`   ❌ ${path.basename(filePath)}: ${err.message}`);
            }
        });
    }

    console.log('');
    console.log(`✨ Processed ${results.length} threads`);

    // Build index unless skipped
    if (!skipIndex && !dryRun) {
        console.log('');
        console.log('📊 Building codex-blocks.json...');

        const index = buildIndex(results);

        console.log('');
        console.log('   📊 Block Stats:');
        console.log(`      - Threads with blocks: ${index.stats.totalStrands}`);
        console.log(`      - Total blocks: ${index.stats.totalBlocks}`);
        console.log(`      - Total block tags: ${index.stats.totalTags}`);
        console.log(`      - Unique tags: ${index.stats.uniqueTags}`);
        console.log(`      - Worthy blocks (≥0.5): ${index.stats.worthyBlocks}`);
        console.log(`      - Auto-confirmed tags: ${index.stats.autoConfirmedTags}`);
        console.log(`      - Pending suggestions: ${index.stats.pendingSuggestions}`);
        console.log('');
        console.log('✅ Wrote codex-blocks.json');
    }
}

main().catch(console.error);
