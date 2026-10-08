#!/usr/bin/env node
/**
 * build-index.mjs - Builds the codex index and block-level tags index
 * 
 * Generates:
 * - index.json (legacy) / codex-index.json - Main strand index
 * - codex-blocks.json - Block-level tags index
 * 
 * Block-level tags are read from frontmatter.blocks[] in each strand.
 * See schema/strand.schema.yaml and schema/blocks-index.schema.yaml
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const WEAVES_DIR = path.join(ROOT, 'weaves');
const TAGS_FILE = path.join(ROOT, 'tags', 'index.yaml');

const read = (p) => fs.readFileSync(p, 'utf8');
const safeRead = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const IGNORED_SEGMENTS = new Set(['.git', '.github', '.DS_Store', 'node_modules', '.cache']);

// Auto-confirm suggested tags with confidence >= this threshold
const AUTO_CONFIRM_THRESHOLD = 0.5;

// Block index accumulator
const blocksIndex = {
  generatedAt: null,
  version: '1.0.0',
  stats: {
    totalStrands: 0,
    totalBlocks: 0,
    totalTags: 0,
    uniqueTags: 0,
    worthyBlocks: 0,
    pendingSuggestions: 0,
    autoConfirmedTags: 0, // NEW: Track auto-confirmed tags
    tagsBySource: { inline: 0, nlp: 0, llm: 0, existing: 0, user: 0 },
    blocksByType: {}
  },
  tagIndex: {},
  strands: {}
};

// Track unique tags
const uniqueTagsSet = new Set();

function loadYAML(filePath) {
  const txt = safeRead(filePath);
  if (!txt) return null;
  return yaml.load(txt);
}

/**
 * Process blocks from frontmatter and add to blocks index
 */
function processBlocks(strandPath, title, blocks) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return;
  }

  blocksIndex.stats.totalStrands++;

  const strandBlocks = {
    path: strandPath,
    title: title,
    blockCount: blocks.length,
    tagCount: 0,
    worthyBlockCount: 0,
    blocks: []
  };

  for (const block of blocks) {
    blocksIndex.stats.totalBlocks++;

    // Count block types
    const blockType = block.type || 'unknown';
    blocksIndex.stats.blocksByType[blockType] = (blocksIndex.stats.blocksByType[blockType] || 0) + 1;

    // Start with existing accepted tags
    const tags = [...(block.tags || [])];
    const suggestedTags = block.suggestedTags || [];

    // AUTO-CONFIRM: Promote high-confidence suggestedTags to tags
    const remainingSuggestions = [];
    for (const st of suggestedTags) {
      if (st.confidence >= AUTO_CONFIRM_THRESHOLD && !tags.includes(st.tag)) {
        // Auto-confirm this tag
        tags.push(st.tag);
        blocksIndex.stats.autoConfirmedTags++;
      } else if (!tags.includes(st.tag)) {
        // Keep as suggestion
        remainingSuggestions.push(st);
      }
    }

    // Process accepted tags (including auto-confirmed ones)
    for (const tag of tags) {
      blocksIndex.stats.totalTags++;
      uniqueTagsSet.add(tag);

      // Add to inverted tag index
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

    // Process remaining suggested tags (below threshold)
    if (remainingSuggestions.length > 0) {
      blocksIndex.stats.pendingSuggestions++;
      for (const st of remainingSuggestions) {
        const source = st.source || 'nlp';
        blocksIndex.stats.tagsBySource[source] = (blocksIndex.stats.tagsBySource[source] || 0) + 1;
      }
    }

    // Check worthiness
    const worthinessScore = block.worthiness?.score ?? 0;
    if (worthinessScore >= 0.5) {
      blocksIndex.stats.worthyBlocks++;
      strandBlocks.worthyBlockCount++;
    }

    // Add block to strand entry (with auto-confirmed tags merged)
    strandBlocks.blocks.push({
      id: block.id,
      line: block.line,
      endLine: block.endLine,
      type: block.type,
      headingLevel: block.headingLevel,
      headingText: block.headingText,
      tags: tags,  // Now includes auto-confirmed tags
      suggestedTags: remainingSuggestions,  // Only low-confidence suggestions remain
      worthiness: block.worthiness,
      extractiveSummary: block.extractiveSummary,
      warrantsIllustration: block.warrantsIllustration
    });
  }

  blocksIndex.strands[strandPath] = strandBlocks;
}

function loadStrand(filePath) {
  const raw = read(filePath);
  const fm = matter(raw);
  const fmData = fm.data || {};
  const title = fmData.title || path.basename(filePath, '.md');
  const summary = fmData.summary || '';
  const slug = fmData.slug || path.basename(filePath, '.md');
  const tags = (fmData.taxonomy?.topic || []).concat(fmData.taxonomy?.subtopic || []);
  const strandPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  // Process block-level tags from frontmatter
  if (fmData.blocks && Array.isArray(fmData.blocks)) {
    processBlocks(strandPath, title, fmData.blocks);
  }

  return {
    id: fmData.id || null,
    slug,
    title,
    summary,
    path: strandPath,
    contentType: fmData.contentType || 'reference',
    difficulty: fmData.difficulty || null,
    tags,
    relationships: fmData.relationships || [],
    hasBlocks: (fmData.blocks?.length || 0) > 0,
    blockCount: fmData.blocks?.length || 0
  };
}

const formatSegment = (segment = '') =>
  segment
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const formatLoomTitle = (relativePath = '') => {
  if (!relativePath) return 'Loose threads (root)';
  return relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .map(formatSegment)
    .join(' / ');
};

function ensureLoomNode(map, weaveDir, loomPath) {
  if (map.has(loomPath)) return map.get(loomPath);

  const absolutePath = loomPath ? path.join(weaveDir, loomPath) : weaveDir;
  const loomYaml = loadYAML(path.join(absolutePath, 'loom.yaml')) || {};

  const node = {
    slug: loomPath ? loomPath.replace(/[/\\]/g, '-').toLowerCase() : '__root__',
    title: loomYaml.title || formatLoomTitle(loomPath),
    summary: loomYaml.summary || (loomPath ? '' : 'Markdown files stored at the weave root'),
    tags: loomYaml.tags || [],
    strands: []
  };

  map.set(loomPath, node);
  return node;
}

function walkWeaveDirectory({ weaveDir, weaveSlug, weaveNode, flat }) {
  const loomMap = new Map();

  const walk = (currentDir, relativeDir = '') => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_SEGMENTS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const entryPath = path.join(currentDir, entry.name);
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        walk(entryPath, relativePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      if (entry.name === 'weave.yaml' || entry.name === 'loom.yaml') continue;

      const strand = loadStrand(entryPath);
      const normalized = relativePath.replace(/\\/g, '/');
      const loomPath = path.posix.dirname(normalized);
      const key = loomPath === '.' ? '' : loomPath;
      const loomNode = ensureLoomNode(loomMap, weaveDir, key);

      loomNode.strands.push(strand);
      flat.push({
        weave: weaveSlug,
        loom: key || null,
        ...strand
      });
    }
  };

  walk(weaveDir);
  weaveNode.looms = Array.from(loomMap.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function buildIndex() {
  const tags = loadYAML(TAGS_FILE) || {};
  const tree = [];
  const flat = [];

  if (!fs.existsSync(WEAVES_DIR)) {
    console.error('No weaves directory found.');
    process.exit(1);
  }

  const weaveDirs = fs
    .readdirSync(WEAVES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const weaveSlug of weaveDirs) {
    const weaveDir = path.join(WEAVES_DIR, weaveSlug);
    const weaveYaml = loadYAML(path.join(weaveDir, 'weave.yaml')) || {};
    const weaveNode = {
      slug: weaveSlug,
      title: weaveYaml.title || weaveSlug,
      description: weaveYaml.description || '',
      looms: []
    };

    walkWeaveDirectory({ weaveDir, weaveSlug, weaveNode, flat });
    tree.push(weaveNode);
  }

  const now = new Date().toISOString();

  // Build main index
  const index = {
    generatedAt: now,
    tags,
    tree,
    flat
  };
  const outPath = path.join(ROOT, 'index.json');
  fs.writeFileSync(outPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`✅ Wrote ${outPath} with ${flat.length} threads.`);

  // Also write as codex-index.json for consistency
  const codexIndexPath = path.join(ROOT, 'codex-index.json');
  fs.writeFileSync(codexIndexPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`✅ Wrote ${codexIndexPath}`);

  // Build blocks index
  blocksIndex.generatedAt = now;
  blocksIndex.stats.uniqueTags = uniqueTagsSet.size;

  const blocksOutPath = path.join(ROOT, 'codex-blocks.json');
  fs.writeFileSync(blocksOutPath, JSON.stringify(blocksIndex, null, 2), 'utf8');

  console.log(`✅ Wrote ${blocksOutPath}`);
  console.log(`   📊 Block Stats:`);
  console.log(`      - Threads with blocks: ${blocksIndex.stats.totalStrands}`);
  console.log(`      - Total blocks: ${blocksIndex.stats.totalBlocks}`);
  console.log(`      - Total block tags: ${blocksIndex.stats.totalTags}`);
  console.log(`      - Unique tags: ${blocksIndex.stats.uniqueTags}`);
  console.log(`      - Worthy blocks (≥0.5): ${blocksIndex.stats.worthyBlocks}`);
  console.log(`      - Auto-confirmed tags: ${blocksIndex.stats.autoConfirmedTags}`);
  console.log(`      - Pending suggestions: ${blocksIndex.stats.pendingSuggestions}`);
}

buildIndex();


