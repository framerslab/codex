/**
 * LLM Inference Library - Multi-Provider Structured Output Engine
 * @module lib/llm
 * 
 * @description
 * High-level LLM API with structured data validation, automatic retries,
 * and multi-provider fallback support. Used by:
 * - ai-enhance.js (PR analysis)
 * - auto-index.js (metadata generation)
 * - build-search-index.mjs (summary generation)
 * 
 * @features
 * - Multi-provider: OpenAI, Anthropic Claude, OpenRouter
 * - JSON schema validation with automatic retry on parse errors
 * - Exponential backoff with jitter
 * - Token counting and cost estimation
 * - Graceful degradation
 * 
 * @example
 * ```javascript
 * const { llm, schemas } = require('./lib/llm');
 * 
 * // Configure (auto-detects from env vars)
 * llm.configure();
 * 
 * // Generate with schema validation
 * const result = await llm.generate({
 *   prompt: 'Suggest tags for this content...',
 *   schema: schemas.tagSuggestion,
 *   maxRetries: 3,
 * });
 * 
 * console.log(result.data.tags); // ['react', 'typescript']
 * ```
 * 
 * @environment
 * - OPENAI_API_KEY - OpenAI API key
 * - ANTHROPIC_API_KEY - Anthropic Claude API key  
 * - OPENROUTER_API_KEY - OpenRouter API key
 * - AI_PROVIDER - Force provider ('openai'|'anthropic'|'openrouter'|'disabled')
 * - AI_MODEL - Override default model
 * - AI_TEMPERATURE - Override temperature (0-1)
 * - AI_MAX_RETRIES - Override max retries
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURATION
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Default models per provider
 * @constant {Object.<string, string>}
 */
const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  openrouter: 'anthropic/claude-3-haiku',
};

/**
 * API endpoints per provider
 * @constant {Object.<string, string>}
 */
const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

/**
 * Default configuration values
 * @constant {Object}
 */
const DEFAULTS = {
  maxTokens: 2048,
  temperature: 0.3,
  maxRetries: 3,
  timeout: 60000,
  initialBackoff: 1000,
  maxBackoff: 16000,
};

/* ═══════════════════════════════════════════════════════════════════════════
   PREDEFINED SCHEMAS
   
   JSON Schema definitions for common structured outputs.
   Used for validation and to guide LLM responses.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Predefined schemas for common use cases
 * @namespace schemas
 */
const schemas = {
  /**
   * Tag suggestion schema
   * @type {Object}
   */
  tagSuggestion: {
    type: 'object',
    required: ['tags'],
    properties: {
      tags: {
        type: 'array',
        items: {
          type: 'object',
          required: ['value', 'confidence'],
          properties: {
            value: { type: 'string', description: 'Tag value (lowercase, hyphenated)' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string' },
          },
        },
        maxItems: 15,
      },
      suggestedDifficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      },
      suggestedTopics: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 5,
      },
    },
  },

  /**
   * Content analysis schema (for PR enhancement)
   * @type {Object}
   */
  contentAnalysis: {
    type: 'object',
    required: ['qualityScore', 'completeness', 'suggestions'],
    properties: {
      qualityScore: { type: 'number', minimum: 0, maximum: 100 },
      completeness: { type: 'number', minimum: 0, maximum: 100 },
      readability: { type: 'string', enum: ['easy', 'moderate', 'difficult'] },
      seoScore: { type: 'number', minimum: 0, maximum: 100 },
      estimatedReadingTime: { type: 'number', description: 'Minutes' },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'severity', 'message'],
          properties: {
            type: { type: 'string', enum: ['metadata', 'content', 'structure', 'quality'] },
            severity: { type: 'string', enum: ['error', 'warning', 'info'] },
            message: { type: 'string' },
            details: { type: 'string' },
            suggestedFix: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            line: { type: 'number' },
          },
        },
      },
      autoTags: { type: 'array', items: { type: 'string' } },
      suggestedDifficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
      suggestedSubjects: { type: 'array', items: { type: 'string' } },
      suggestedTopics: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } },
      missingFields: { type: 'array', items: { type: 'string' } },
      generatedSummary: { type: 'string', maxLength: 500 },
    },
  },

  /**
   * Summary generation schema
   * @type {Object}
   */
  summaryGeneration: {
    type: 'object',
    required: ['summary'],
    properties: {
      summary: { type: 'string', maxLength: 300 },
      keyPoints: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      targetAudience: { type: 'string' },
    },
  },

  /**
   * Question generation schema
   * @type {Object}
   */
  questionGeneration: {
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['question', 'answer'],
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            topic: { type: 'string' },
          },
        },
        maxItems: 10,
      },
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sleep with exponential backoff and jitter
 * 
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @param {number} [initialMs=1000] - Initial backoff in milliseconds
 * @returns {Promise<void>}
 * 
 * @example
 * await backoff(2); // ~4 seconds with jitter
 */
async function backoff(attempt, initialMs = DEFAULTS.initialBackoff) {
  const maxMs = DEFAULTS.maxBackoff;
  const baseDelay = Math.min(initialMs * Math.pow(2, attempt), maxMs);
  const jitter = baseDelay * (0.5 + Math.random() * 0.5);
  await new Promise(resolve => setTimeout(resolve, jitter));
}

/**
 * Extract JSON from text that may contain markdown code blocks
 * 
 * @param {string} text - Raw text possibly containing JSON
 * @returns {string} Extracted JSON string
 * 
 * @example
 * extractJSON('```json\n{"foo": "bar"}\n```') // '{"foo": "bar"}'
 */
function extractJSON(text) {
  // Try to extract from markdown code block
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  
  // Try to find raw JSON object/array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  
  return text.trim();
}

/**
 * Validate data against JSON schema (basic implementation)
 * 
 * @param {any} data - Data to validate
 * @param {Object} schema - JSON schema
 * @returns {{valid: boolean, errors: string[]}}
 * 
 * @example
 * const result = validateSchema({tags: []}, schemas.tagSuggestion);
 * if (!result.valid) console.error(result.errors);
 */
function validateSchema(data, schema) {
  const errors = [];
  
  if (!schema) return { valid: true, errors: [] };
  
  // Check type
  if (schema.type === 'object' && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    errors.push(`Expected object, got ${typeof data}`);
    return { valid: false, errors };
  }
  
  if (schema.type === 'array' && !Array.isArray(data)) {
    errors.push(`Expected array, got ${typeof data}`);
    return { valid: false, errors };
  }
  
  // Check required fields
  if (schema.required && schema.type === 'object') {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  // Check properties (shallow)
  if (schema.properties && typeof data === 'object') {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        // Type check
        if (propSchema.type === 'number' && typeof data[key] !== 'number') {
          errors.push(`Field ${key}: expected number, got ${typeof data[key]}`);
        }
        if (propSchema.type === 'string' && typeof data[key] !== 'string') {
          errors.push(`Field ${key}: expected string, got ${typeof data[key]}`);
        }
        if (propSchema.type === 'array' && !Array.isArray(data[key])) {
          errors.push(`Field ${key}: expected array, got ${typeof data[key]}`);
        }
        // Enum check
        if (propSchema.enum && !propSchema.enum.includes(data[key])) {
          errors.push(`Field ${key}: value must be one of [${propSchema.enum.join(', ')}]`);
        }
        // Range check
        if (propSchema.minimum !== undefined && data[key] < propSchema.minimum) {
          errors.push(`Field ${key}: value must be >= ${propSchema.minimum}`);
        }
        if (propSchema.maximum !== undefined && data[key] > propSchema.maximum) {
          errors.push(`Field ${key}: value must be <= ${propSchema.maximum}`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Convert JSON schema to human-readable description for LLM
 * 
 * @param {Object} schema - JSON schema
 * @returns {string} Human-readable schema description
 */
function schemaToPrompt(schema) {
  return JSON.stringify(schema, null, 2);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROVIDER IMPLEMENTATIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Call OpenAI API
 * 
 * @param {Object} config - Provider configuration
 * @param {Array} messages - Chat messages
 * @param {Object} options - Request options
 * @returns {Promise<{content: string, usage: Object}>}
 * @throws {LLMError}
 */
async function callOpenAI(config, messages, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULTS.timeout);
  
  try {
    const response = await fetch(API_ENDPOINTS.openai, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODELS.openai,
        messages,
        max_tokens: options.maxTokens || DEFAULTS.maxTokens,
        temperature: options.temperature ?? DEFAULTS.temperature,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const err = new Error(error.error?.message || 'OpenAI API error');
      err.code = response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR';
      err.provider = 'openai';
      err.status = response.status;
      throw err;
    }
    
    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Anthropic Claude API
 * 
 * @param {Object} config - Provider configuration
 * @param {Array} messages - Chat messages
 * @param {Object} options - Request options
 * @returns {Promise<{content: string, usage: Object}>}
 * @throws {LLMError}
 */
async function callAnthropic(config, messages, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULTS.timeout);
  
  // Extract system message and convert format
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
  
  try {
    const response = await fetch(API_ENDPOINTS.anthropic, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODELS.anthropic,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || DEFAULTS.maxTokens,
        temperature: options.temperature ?? DEFAULTS.temperature,
        ...(systemMsg && { system: systemMsg }),
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const err = new Error(error.error?.message || 'Anthropic API error');
      err.code = response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR';
      err.provider = 'anthropic';
      err.status = response.status;
      throw err;
    }
    
    const data = await response.json();
    return {
      content: data.content?.[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call OpenRouter API (OpenAI-compatible)
 * 
 * @param {Object} config - Provider configuration
 * @param {Array} messages - Chat messages
 * @param {Object} options - Request options
 * @returns {Promise<{content: string, usage: Object}>}
 * @throws {LLMError}
 */
async function callOpenRouter(config, messages, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULTS.timeout);
  
  try {
    const response = await fetch(API_ENDPOINTS.openrouter, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://github.com/framerslab/codex',
        'X-Title': 'Frame Codex',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODELS.openrouter,
        messages,
        max_tokens: options.maxTokens || DEFAULTS.maxTokens,
        temperature: options.temperature ?? DEFAULTS.temperature,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const err = new Error(error.error?.message || 'OpenRouter API error');
      err.code = response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR';
      err.provider = 'openrouter';
      err.status = response.status;
      throw err;
    }
    
    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LLM CLIENT CLASS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * LLM Client with multi-provider support and structured output validation
 * 
 * @class
 * @example
 * const client = new LLMClient();
 * client.configure(); // Auto-detect from env
 * 
 * const result = await client.generate({
 *   prompt: 'Analyze this content',
 *   schema: schemas.contentAnalysis,
 * });
 */
class LLMClient {
  constructor() {
    /** @type {Map<string, Object>} */
    this.providers = new Map();
    /** @type {string|null} */
    this.defaultProvider = null;
    /** @type {boolean} */
    this.configured = false;
  }
  
  /**
   * Configure the client from environment variables
   * 
   * @returns {LLMClient} this (for chaining)
   * 
   * @example
   * llm.configure(); // Auto-detect
   */
  configure() {
    // Check for forced disable
    if (process.env.AI_PROVIDER === 'disabled') {
      console.log('ℹ️  LLM disabled via AI_PROVIDER=disabled');
      this.configured = false;
      return this;
    }
    
    // Check for forced provider
    const forcedProvider = process.env.AI_PROVIDER;
    
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', { apiKey: process.env.OPENAI_API_KEY });
      if (!this.defaultProvider || forcedProvider === 'openai') {
        this.defaultProvider = 'openai';
      }
    }
    
    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', { apiKey: process.env.ANTHROPIC_API_KEY });
      if (!this.defaultProvider || forcedProvider === 'anthropic') {
        this.defaultProvider = 'anthropic';
      }
    }
    
    // OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set('openrouter', { apiKey: process.env.OPENROUTER_API_KEY });
      if (!this.defaultProvider || forcedProvider === 'openrouter') {
        this.defaultProvider = 'openrouter';
      }
    }
    
    this.configured = this.providers.size > 0;
    
    if (this.configured) {
      console.log(`✅ LLM configured with provider: ${this.defaultProvider}`);
    } else {
      console.log('⚠️  No LLM API keys found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY');
    }
    
    return this;
  }
  
  /**
   * Check if LLM is available
   * 
   * @returns {boolean}
   */
  isConfigured() {
    return this.configured && this.providers.size > 0;
  }
  
  /**
   * Get available providers
   * 
   * @returns {string[]}
   */
  getProviders() {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Generate a response with optional schema validation
   * 
   * @param {Object} options - Generation options
   * @param {string} options.prompt - The prompt to send
   * @param {string} [options.system] - Optional system message
   * @param {Object} [options.schema] - JSON schema for structured output
   * @param {string} [options.provider] - Force specific provider
   * @param {string} [options.model] - Override model
   * @param {number} [options.maxTokens] - Max response tokens
   * @param {number} [options.temperature] - Temperature (0-1)
   * @param {number} [options.maxRetries] - Max retry attempts
   * @param {number} [options.timeout] - Timeout in ms
   * @returns {Promise<{data: any, raw: string, model: string, provider: string, usage: Object, latency: number, retries: number}>}
   * @throws {Error}
   * 
   * @example
   * const result = await llm.generate({
   *   prompt: 'Suggest tags for: React hooks tutorial',
   *   schema: schemas.tagSuggestion,
   * });
   * console.log(result.data.tags);
   */
  async generate(options) {
    const {
      prompt,
      system,
      schema,
      provider: forcedProvider,
      model: forcedModel,
      maxTokens = process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS) : DEFAULTS.maxTokens,
      temperature = process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : DEFAULTS.temperature,
      maxRetries = process.env.AI_MAX_RETRIES ? parseInt(process.env.AI_MAX_RETRIES) : DEFAULTS.maxRetries,
      timeout = DEFAULTS.timeout,
    } = options;
    
    if (!this.isConfigured()) {
      throw new Error('LLM not configured. Call configure() first or set API keys.');
    }
    
    // Determine provider
    const provider = forcedProvider || this.defaultProvider;
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not configured`);
    }
    
    const model = forcedModel || process.env.AI_MODEL || DEFAULT_MODELS[provider];
    
    // Build messages
    const messages = [];
    
    // Add system message with schema instructions
    let systemMessage = system || '';
    if (schema) {
      systemMessage += `\n\nRespond with valid JSON matching this schema:\n${schemaToPrompt(schema)}\n\nOnly output the JSON object, no markdown code blocks or explanations.`;
    }
    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage.trim() });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    // Execute with retries
    let lastError = null;
    const startTime = Date.now();
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        // Call provider
        let result;
        switch (provider) {
          case 'openai':
            result = await callOpenAI(config, messages, { model, maxTokens, temperature, timeout });
            break;
          case 'anthropic':
            result = await callAnthropic(config, messages, { model, maxTokens, temperature, timeout });
            break;
          case 'openrouter':
            result = await callOpenRouter(config, messages, { model, maxTokens, temperature, timeout });
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
        
        // Parse and validate if schema provided
        let parsedData = result.content;
        
        if (schema) {
          try {
            const jsonStr = extractJSON(result.content);
            const jsonData = JSON.parse(jsonStr);
            
            // Validate against schema
            const validation = validateSchema(jsonData, schema);
            if (!validation.valid) {
              const err = new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
              err.code = 'VALIDATION_ERROR';
              throw err;
            }
            
            parsedData = jsonData;
          } catch (parseError) {
            if (parseError.code === 'VALIDATION_ERROR') {
              throw parseError;
            }
            const err = new Error(`Failed to parse JSON: ${parseError.message}`);
            err.code = 'PARSE_ERROR';
            throw err;
          }
        }
        
        return {
          data: parsedData,
          raw: result.content,
          model,
          provider,
          usage: result.usage,
          latency: Date.now() - startTime,
          retries: retry,
        };
        
      } catch (error) {
        lastError = error;
        
        // Log retry
        if (retry < maxRetries) {
          console.log(`⚠️  Retry ${retry + 1}/${maxRetries}: ${error.message}`);
          
          // For validation/parse errors, modify the prompt
          if (error.code === 'VALIDATION_ERROR' || error.code === 'PARSE_ERROR') {
            messages.push({ role: 'assistant', content: error.message });
            messages.push({ role: 'user', content: 'Your response was not valid JSON. Please try again with ONLY a valid JSON object, no markdown.' });
          }
          
          await backoff(retry);
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SINGLETON INSTANCE & EXPORTS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Global LLM client instance
 * @type {LLMClient}
 */
const llm = new LLMClient();

module.exports = {
  llm,
  LLMClient,
  schemas,
  validateSchema,
  extractJSON,
  backoff,
  DEFAULTS,
  DEFAULT_MODELS,
};
















