#!/usr/bin/env node
/**
 * ai-enhance-blocks.js - AI-powered block tag enhancement
 * 
 * Uses LLM (OpenAI/Anthropic) with chain-of-thought prompting to:
 * 1. Validate and refine NLP-suggested tags
 * 2. Suggest additional relevant tags from vocabulary
 * 3. Generate better extractive summaries
 * 4. Identify cross-references to other strands
 * 
 * Environment:
 *   OPENAI_API_KEY or ANTHROPIC_API_KEY
 * 
 * Usage:
 *   node scripts/ai-enhance-blocks.js [file.md | directory]
 *   node scripts/ai-enhance-blocks.js --all --max-cost 5.00
 *   node scripts/ai-enhance-blocks.js --dry-run
 *   node scripts/ai-enhance-blocks.js --provider anthropic
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
const WEAVES_DIR = path.join(ROOT, 'weaves');

// Cost tracking (USD per 1K tokens)
const PRICING = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
};

// Default model
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_TOKENS_PER_BLOCK = 500;
const MIN_WORTHINESS_FOR_AI = 0.4;

// ============================================================================
// LLM PROVIDERS
// ============================================================================

async function callOpenAI(messages, model = 'gpt-4o-mini') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: MAX_TOKENS_PER_BLOCK,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
  };
}

async function callAnthropic(messages, model = 'claude-3-haiku-20240307') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  // Convert OpenAI format to Anthropic format
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS_PER_BLOCK,
      system: systemMsg,
      messages: userMsgs.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content[0].text,
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens
    }
  };
}

// ============================================================================
// CHAIN OF THOUGHT PROMPTS
// ============================================================================

function buildSystemPrompt(vocabulary) {
  return `You are an expert knowledge taxonomist and content analyst for a technical documentation system called "Codex".

Your task is to analyze content blocks and improve their tagging and metadata.

Available vocabulary/tags (use these preferentially):
${JSON.stringify(vocabulary.slice(0, 100), null, 2)}

You must respond with valid JSON in this exact format:
{
  "thinking": "Your step-by-step reasoning about the content and appropriate tags",
  "refinedTags": ["tag1", "tag2"],
  "additionalTags": [
    {"tag": "newTag", "confidence": 0.85, "reasoning": "Why this tag applies"}
  ],
  "removeSuggestions": ["tagToRemove"],
  "extractiveSummary": "A concise 1-2 sentence summary of the block",
  "crossReferences": ["potential-related-strand-slug"],
  "qualityScore": 0.8
}

Rules:
1. Think step-by-step before making decisions
2. Prefer tags from the provided vocabulary
3. Confidence scores: 0.9+ = highly confident, 0.7-0.9 = confident, 0.5-0.7 = uncertain
4. Only suggest tags that genuinely apply to the content
5. extractiveSummary should capture the key point in 1-2 sentences
6. qualityScore reflects how well the block is suited for tagging (0-1)`;
}

function buildUserPrompt(block, documentContext) {
  return `Analyze this content block and improve its tagging:

DOCUMENT CONTEXT:
- Title: ${documentContext.title}
- Document Tags: ${documentContext.tags.join(', ')}
- Content Type: ${documentContext.contentType}

BLOCK INFORMATION:
- Type: ${block.type}
- Line: ${block.line}-${block.endLine}
${block.headingText ? `- Heading: ${block.headingText}` : ''}
- Current Worthiness Score: ${block.worthiness?.score || 'N/A'}
- Existing Tags: ${(block.tags || []).join(', ') || 'None'}
- NLP Suggested Tags: ${(block.suggestedTags || []).map(t => `${t.tag} (${t.confidence.toFixed(2)})`).join(', ') || 'None'}

BLOCK CONTENT:
"""
${block.content}
"""

Please analyze this block using chain-of-thought reasoning and provide your recommendations in the specified JSON format.`;
}

// ============================================================================
// PROCESSING
// ============================================================================

let totalCost = 0;
let blocksProcessed = 0;

function calculateCost(usage, model) {
  const pricing = PRICING[model] || PRICING['gpt-4o-mini'];
  const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

async function enhanceBlock(block, documentContext, vocabulary, options) {
  const { provider = 'openai', model = DEFAULT_MODEL, dryRun = false } = options;

  // Skip low-worthiness blocks
  if ((block.worthiness?.score || 0) < MIN_WORTHINESS_FOR_AI) {
    return null;
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(vocabulary) },
    { role: 'user', content: buildUserPrompt(block, documentContext) }
  ];

  if (dryRun) {
    console.log(`    [DRY RUN] Would enhance block ${block.id}`);
    return null;
  }

  try {
    const callLLM = provider === 'anthropic' ? callAnthropic : callOpenAI;
    const result = await callLLM(messages, model);
    
    // Track cost
    const cost = calculateCost(result.usage, model);
    totalCost += cost;
    blocksProcessed++;

    // Parse response
    const enhancement = JSON.parse(result.content);

    // Update block with AI enhancements
    const updatedSuggestedTags = [
      // Keep existing high-confidence suggestions
      ...(block.suggestedTags || []).filter(t => 
        t.confidence >= 0.7 && !enhancement.removeSuggestions?.includes(t.tag)
      ),
      // Add AI suggestions
      ...(enhancement.additionalTags || []).map(t => ({
        tag: t.tag,
        confidence: t.confidence,
        source: 'llm',
        reasoning: t.reasoning
      }))
    ];

    // Deduplicate
    const seenTags = new Set(block.tags || []);
    const deduped = updatedSuggestedTags.filter(t => {
      if (seenTags.has(t.tag.toLowerCase())) return false;
      seenTags.add(t.tag.toLowerCase());
      return true;
    });

    return {
      suggestedTags: deduped,
      extractiveSummary: enhancement.extractiveSummary || block.extractiveSummary,
      aiEnhanced: true,
      aiQualityScore: enhancement.qualityScore,
      aiThinking: enhancement.thinking
    };
  } catch (err) {
    console.error(`    ❌ Error enhancing block ${block.id}:`, err.message);
    return null;
  }
}

async function enhanceStrand(filePath, vocabulary, options) {
  const { dryRun = false, maxCost = Infinity } = options;

  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  const blocks = frontmatter.blocks || [];
  if (blocks.length === 0) {
    console.log(`  ⚠️  No blocks in ${path.basename(filePath)}`);
    return null;
  }

  // Build document context
  const documentContext = {
    title: frontmatter.title || path.basename(filePath, '.md'),
    tags: [
      ...(frontmatter.taxonomy?.topic || []),
      ...(frontmatter.taxonomy?.subtopic || []),
      ...(frontmatter.taxonomy?.subject || [])
    ],
    contentType: frontmatter.contentType || 'reference'
  };

  // Get block contents from file
  const lines = content.split('\n');
  for (const block of blocks) {
    block.content = lines.slice(block.line - 1, block.endLine).join('\n');
  }

  // Enhance worthy blocks
  let enhanced = 0;
  for (const block of blocks) {
    // Check cost limit
    if (totalCost >= maxCost) {
      console.log(`  ⚠️  Max cost limit reached ($${maxCost.toFixed(2)})`);
      break;
    }

    const enhancement = await enhanceBlock(block, documentContext, vocabulary, options);
    if (enhancement) {
      Object.assign(block, enhancement);
      delete block.content; // Remove content before saving
      enhanced++;
    } else {
      delete block.content;
    }
  }

  // Save updated frontmatter
  if (!dryRun && enhanced > 0) {
    const updated = matter.stringify(content, { ...frontmatter, blocks });
    fs.writeFileSync(filePath, updated, 'utf8');
  }

  console.log(`  ${dryRun ? '📋' : '✅'} ${path.basename(filePath)}: ${enhanced}/${blocks.length} blocks enhanced`);
  
  return { filePath, enhanced, total: blocks.length };
}

// ============================================================================
// CLI
// ============================================================================

function loadVocabulary() {
  const vocabList = [];
  
  if (fs.existsSync(TAGS_FILE)) {
    try {
      const tagsData = yaml.load(fs.readFileSync(TAGS_FILE, 'utf8'));
      
      if (tagsData.subjects) {
        for (const [subject, data] of Object.entries(tagsData.subjects)) {
          vocabList.push(subject);
          if (data.topics) {
            vocabList.push(...Object.keys(data.topics));
          }
        }
      }
      
      if (tagsData.skills) {
        vocabList.push(...tagsData.skills);
      }
    } catch (err) {
      console.warn('[ai-enhance] Failed to load vocabulary:', err.message);
    }
  }
  
  return vocabList;
}

async function processDirectory(dirPath, vocabulary, options) {
  const results = [];
  
  const walk = async (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', '.git', '.cache'].includes(entry.name)) continue;
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check cost limit
        if (totalCost >= options.maxCost) {
          console.log(`  ⚠️  Max cost limit reached ($${options.maxCost.toFixed(2)})`);
          return;
        }
        
        try {
          const result = await enhanceStrand(fullPath, vocabulary, options);
          if (result) results.push(result);
        } catch (err) {
          console.error(`  ❌ Error processing ${entry.name}:`, err.message);
        }
      }
    }
  };
  
  await walk(dirPath);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const processAll = args.includes('--all');
  
  // Parse options
  let provider = 'openai';
  let model = DEFAULT_MODEL;
  let maxCost = 5.0; // Default $5 max
  
  const providerIdx = args.indexOf('--provider');
  if (providerIdx !== -1 && args[providerIdx + 1]) {
    provider = args[providerIdx + 1];
    if (provider === 'anthropic') {
      model = 'claude-3-haiku-20240307';
    }
  }
  
  const modelIdx = args.indexOf('--model');
  if (modelIdx !== -1 && args[modelIdx + 1]) {
    model = args[modelIdx + 1];
  }
  
  const maxCostIdx = args.indexOf('--max-cost');
  if (maxCostIdx !== -1 && args[maxCostIdx + 1]) {
    maxCost = parseFloat(args[maxCostIdx + 1]);
  }
  
  const paths = args.filter(a => !a.startsWith('--') && 
    !['openai', 'anthropic', model, maxCost.toString()].includes(a));

  console.log('🤖 AI Block Enhancer');
  console.log(`   Provider: ${provider}`);
  console.log(`   Model: ${model}`);
  console.log(`   Max Cost: $${maxCost.toFixed(2)}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log('');

  // Check for API key
  const apiKey = provider === 'anthropic' 
    ? process.env.ANTHROPIC_API_KEY 
    : process.env.OPENAI_API_KEY;
  
  if (!apiKey && !dryRun) {
    console.error(`❌ ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} not set`);
    process.exit(1);
  }

  // Load vocabulary
  const vocabulary = loadVocabulary();
  console.log(`📚 Loaded ${vocabulary.length} vocabulary terms`);
  console.log('');

  const options = { provider, model, dryRun, maxCost };

  if (processAll || paths.length === 0) {
    console.log(`📁 Processing all threads in ${WEAVES_DIR}`);
    await processDirectory(WEAVES_DIR, vocabulary, options);
  } else {
    for (const p of paths) {
      const fullPath = path.resolve(p);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        console.log(`📁 Processing directory: ${p}`);
        await processDirectory(fullPath, vocabulary, options);
      } else if (stat.isFile() && fullPath.endsWith('.md')) {
        console.log(`📄 Processing file: ${p}`);
        await enhanceStrand(fullPath, vocabulary, options);
      }
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   Blocks processed: ${blocksProcessed}`);
  console.log(`   Total cost: $${totalCost.toFixed(4)}`);
}

main().catch(console.error);

