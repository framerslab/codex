/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Frame Codex Auto-Indexer
 * 
 * This script automatically indexes all content in the Codex repository,
 * extracting metadata, categorizing content using NLP techniques, and
 * generating a searchable index for client-side consumption.
 * 
 * Features:
 * - Keyword extraction using TF-IDF
 * - Auto-categorization based on extensive external vocabulary with stemming
 * - Summary generation from content
 * - Quality validation
 * - Duplicate detection
 * - Relationship mapping
 * 
 * Usage:
 *   npm run index                    # Build full index
 *   npm run index -- --validate      # Build with validation
 *   npm run index -- --verbose       # Show detailed output
 * 
 * Output:
 *   codex-index.json   - Full searchable index
 *   codex-report.json  - Indexing statistics and validation report
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULARY LOADER - External vocabulary files with stemming & normalization
// ═══════════════════════════════════════════════════════════════════════════
const { getVocabularyLoader, PorterStemmer } = require('./vocab-loader');

// Initialize vocabulary from external files
let vocabLoader = null;
let VOCABULARY = null;
let STOP_WORDS = null;
let stemmer = null;

function initializeVocabulary() {
  if (vocabLoader) return;
  
  try {
    vocabLoader = getVocabularyLoader();
    stemmer = new PorterStemmer();
    
    // Convert to legacy format for backward compatibility
    VOCABULARY = vocabLoader.toLegacyFormat();
    
    // Convert stop words Set to standard Set
    STOP_WORDS = vocabLoader.loadStopWords();
    
    const stats = vocabLoader.getStats();
    console.log(`📚 Vocabulary loaded from external files:`);
    console.log(`   • Stop words: ${stats.stopWords}`);
    console.log(`   • Subjects: ${Object.keys(stats.subjects).length} categories, ${Object.values(stats.subjects).reduce((a, b) => a + b, 0)} terms`);
    console.log(`   • Topics: ${Object.keys(stats.topics).length} categories, ${Object.values(stats.topics).reduce((a, b) => a + b, 0)} terms`);
    console.log(`   • Skills: ${Object.keys(stats.skills || {}).length} categories, ${Object.values(stats.skills || {}).reduce((a, b) => a + b, 0)} terms`);
    console.log(`   • Difficulty: ${Object.keys(stats.difficulty).length} levels, ${Object.values(stats.difficulty).reduce((a, b) => a + b, 0)} terms`);
    console.log(`   • Stemmed index: ${stats.stemmedIndex} unique stems`);
  } catch (err) {
    console.warn(`⚠️ Failed to load external vocabulary, using fallback: ${err.message}`);
    
    // Fallback to minimal hardcoded vocabulary
    VOCABULARY = {
      subjects: {
        technology: ['api', 'code', 'software', 'programming', 'development'],
        science: ['research', 'study', 'experiment', 'hypothesis', 'theory'],
        philosophy: ['ethics', 'morality', 'existence', 'consciousness'],
        ai: ['artificial intelligence', 'machine learning', 'neural', 'model'],
        knowledge: ['information', 'data', 'wisdom', 'learning', 'documentation'],
      },
      topics: {
        'getting-started': ['tutorial', 'guide', 'introduction', 'beginner'],
        'architecture': ['design', 'structure', 'pattern', 'system'],
        'troubleshooting': ['error', 'issue', 'problem', 'fix', 'debug'],
      },
      difficulty: {
        beginner: ['basic', 'simple', 'intro', 'fundamental', 'easy'],
        intermediate: ['moderate', 'practical', 'hands-on', 'implement'],
        advanced: ['complex', 'expert', 'optimization', 'performance'],
      }
    };
    
    STOP_WORDS = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
      'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don',
      'now', 'use', 'using', 'used'
    ]);
    
    stemmer = new PorterStemmer();
  }
}

// Initialize on module load
initializeVocabulary();

class CodexIndexer {
  constructor() {
    this.index = [];
    this.stats = {
      totalFiles: 0,
      indexedFiles: 0,
      skippedFiles: 0,
      cachedFiles: 0,
      errors: [],
      vocabulary: {
        extractedTerms: new Set(),
        suggestedAdditions: []
      },
      performance: {
        cacheHitRate: 0,
        timeElapsed: 0
      }
    };
    this.documentFrequency = {}; // For TF-IDF
    this.allDocuments = [];
    this.cache = null; // SQL cache instance
  }

  /**
   * Extract keywords using TF-IDF (Term Frequency-Inverse Document Frequency)
   * This is more sophisticated than simple frequency counting
   */
  extractKeywordsTFIDF(text, allTexts) {
    const words = this.tokenize(text);
    const termFrequency = {};
    
    // Calculate term frequency for this document
    words.forEach(word => {
      termFrequency[word] = (termFrequency[word] || 0) + 1;
    });
    
    // Normalize by document length
    const docLength = words.length;
    Object.keys(termFrequency).forEach(word => {
      termFrequency[word] = termFrequency[word] / docLength;
    });
    
    // Calculate TF-IDF scores
    const tfidf = {};
    Object.keys(termFrequency).forEach(word => {
      const tf = termFrequency[word];
      const idf = this.calculateIDF(word, allTexts);
      tfidf[word] = tf * idf;
    });
    
    // Return top keywords by TF-IDF score
    return Object.entries(tfidf)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);
  }

  /**
   * Calculate Inverse Document Frequency
   */
  calculateIDF(term, allTexts) {
    const docsWithTerm = allTexts.filter(text => 
      this.tokenize(text).includes(term)
    ).length;
    
    if (docsWithTerm === 0) return 0;
    
    return Math.log(allTexts.length / docsWithTerm);
  }

  /**
   * Tokenize text into words
   */
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word));
  }

  /**
   * Extract n-grams (phrases) for better context
   */
  extractNGrams(text, n = 2) {
    const words = this.tokenize(text);
    const ngrams = [];
    
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      ngrams.push(ngram);
    }
    
    // Count frequency
    const ngramFreq = {};
    ngrams.forEach(ngram => {
      ngramFreq[ngram] = (ngramFreq[ngram] || 0) + 1;
    });
    
    // Return top n-grams
    return Object.entries(ngramFreq)
      .filter(([_, count]) => count > 1) // Only repeated phrases
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ngram]) => ngram);
  }

  /**
   * Auto-categorize content using NLP and controlled vocabulary
   */
  autoCategorize(content, metadata = {}) {
    const text = `${metadata.title || ''} ${metadata.summary || ''} ${content}`.toLowerCase();
    const keywords = this.extractKeywordsTFIDF(text, this.allDocuments);
    const phrases = this.extractNGrams(text, 2);
    
    const categories = {
      subjects: [],
      topics: [],
      skills: [],  // Learning prerequisites
      difficulty: 'intermediate', // default
      confidence: {}
    };
    
    // Match subjects with confidence scoring
    for (const [subject, terms] of Object.entries(VOCABULARY.subjects)) {
      const matches = terms.filter(term => text.includes(term));
      if (matches.length > 0) {
        categories.subjects.push(subject);
        categories.confidence[subject] = matches.length / terms.length;
      }
    }
    
    // Match topics with confidence scoring
    for (const [topic, terms] of Object.entries(VOCABULARY.topics)) {
      const matches = terms.filter(term => text.includes(term));
      if (matches.length > 0) {
        categories.topics.push(topic);
        categories.confidence[topic] = matches.length / terms.length;
      }
    }
    
    // Match skills (learning prerequisites) with confidence scoring
    if (VOCABULARY.skills) {
      for (const [skillCategory, terms] of Object.entries(VOCABULARY.skills)) {
        const matches = terms.filter(term => text.includes(term));
        if (matches.length > 0) {
          // For skills, add the individual matched terms (not the category)
          // This gives granular skill tracking
          matches.forEach(match => {
            const normalizedSkill = match.toLowerCase().replace(/\s+/g, '-');
            if (!categories.skills.includes(normalizedSkill)) {
              categories.skills.push(normalizedSkill);
              categories.confidence[`skill:${normalizedSkill}`] = 0.5 + (matches.length / terms.length) * 0.5;
            }
          });
        }
      }
      // Limit to top 10 skills
      if (categories.skills.length > 10) {
        categories.skills = categories.skills.slice(0, 10);
      }
    }
    
    // Determine difficulty with scoring
    const difficultyScores = {};
    for (const [level, terms] of Object.entries(VOCABULARY.difficulty)) {
      difficultyScores[level] = terms.filter(term => text.includes(term)).length;
    }
    
    // Pick highest scoring difficulty
    const maxScore = Math.max(...Object.values(difficultyScores));
    if (maxScore > 0) {
      categories.difficulty = Object.keys(difficultyScores).find(
        level => difficultyScores[level] === maxScore
      ) || 'intermediate';
    }
    
    // Merge with existing metadata
    if (metadata.taxonomy?.subjects) {
      categories.subjects = [...new Set([...categories.subjects, ...metadata.taxonomy.subjects])];
    }
    if (metadata.taxonomy?.topics) {
      categories.topics = [...new Set([...categories.topics, ...metadata.taxonomy.topics])];
    }
    // Merge explicit skills from frontmatter
    if (metadata.skills && Array.isArray(metadata.skills)) {
      categories.skills = [...new Set([...metadata.skills, ...categories.skills])];
    }
    if (metadata.difficulty) {
      categories.difficulty = metadata.difficulty;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // AUTOMATED SKILL EXTRACTION FROM CODE
    // ═══════════════════════════════════════════════════════════════════════
    // Extract skills from code blocks, imports, and patterns
    const codeSkills = this.extractSkillsFromCode(content);
    if (codeSkills.length > 0) {
      categories.skills = [...new Set([...categories.skills, ...codeSkills])];
    }
    
    // Limit to top 15 skills (prioritize explicit > vocabulary-matched > code-detected)
    if (categories.skills.length > 15) {
      // Explicit skills from frontmatter have highest priority
      const explicit = metadata.skills || [];
      const rest = categories.skills.filter(s => !explicit.includes(s));
      categories.skills = [...explicit.slice(0, 10), ...rest.slice(0, 15 - Math.min(explicit.length, 10))];
    }
    
    // Discover new vocabulary terms
    keywords.forEach(keyword => {
      this.stats.vocabulary.extractedTerms.add(keyword);
    });
    
    return { categories, keywords, phrases };
  }

  /**
   * Generate summary using extractive summarization
   */
  generateSummary(content) {
    // Remove code blocks and special formatting
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/#{1,6}\s/g, '')
      .trim();
    
    // Split into sentences
    const sentences = cleanContent.split(/[.!?]+\s+/).filter(s => s.length > 20);
    
    if (sentences.length === 0) {
      return cleanContent.substring(0, 200) + '...';
    }
    
    // Score sentences by keyword density
    const keywords = this.tokenize(cleanContent);
    const keywordSet = new Set(keywords.slice(0, 20)); // Top 20 keywords
    
    const scoredSentences = sentences.map(sentence => {
      const sentenceWords = this.tokenize(sentence);
      const score = sentenceWords.filter(word => keywordSet.has(word)).length;
      return { sentence, score };
    });
    
    // Pick top sentence
    scoredSentences.sort((a, b) => b.score - a.score);
    const summary = scoredSentences[0]?.sentence || sentences[0];
    
    return summary.length > 300 ? summary.substring(0, 297) + '...' : summary;
  }

  /**
   * Calculate Flesch-Kincaid Reading Level
   * Returns grade level (0-18+) and readability score (0-100)
   */
  calculateReadingLevel(content) {
    try {
      const syllable = require('syllable');
      
      // Clean content
      const cleanContent = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/#{1,6}\s/g, '')
        .trim();
      
      // Count sentences, words, syllables
      const sentences = cleanContent.split(/[.!?]+\s+/).filter(s => s.length > 10);
      const words = cleanContent.split(/\s+/).filter(w => w.length > 0);
      
      if (sentences.length === 0 || words.length === 0) {
        return { gradeLevel: 0, readabilityScore: 0 };
      }
      
      const totalSyllables = words.reduce((sum, word) => {
        const clean = word.replace(/[^\w]/g, '');
        return sum + syllable(clean);
      }, 0);
      
      const avgWordsPerSentence = words.length / sentences.length;
      const avgSyllablesPerWord = totalSyllables / words.length;
      
      // Flesch-Kincaid Grade Level
      const gradeLevel = Math.max(0, 
        0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
      );
      
      // Flesch Reading Ease (0-100, higher = easier)
      const readabilityScore = Math.max(0, Math.min(100,
        206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
      ));
      
      return {
        gradeLevel: Math.round(gradeLevel * 10) / 10,
        readabilityScore: Math.round(readabilityScore),
        sentences: sentences.length,
        words: words.length,
        syllables: totalSyllables
      };
    } catch (error) {
      console.warn('Reading level calculation failed:', error.message);
      return { gradeLevel: 0, readabilityScore: 0 };
    }
  }

  /**
   * Extract named entities (people, places, organizations)
   * Using compromise library for NER
   */
  extractEntities(content) {
    try {
      const nlp = require('compromise');
      
      const doc = nlp(content);
      
      const entities = {
        people: doc.people().out('array').slice(0, 10),
        places: doc.places().out('array').slice(0, 10),
        organizations: doc.organizations().out('array').slice(0, 10),
        topics: doc.topics().out('array').slice(0, 15)
      };
      
      return entities;
    } catch (error) {
      console.warn('Entity extraction failed:', error.message);
      return { people: [], places: [], organizations: [], topics: [] };
    }
  }

  /**
   * Extract skills automatically from code blocks, imports, and patterns
   * Uses NLP and pattern matching for automated skill detection
   * 
   * @param {string} content - Document content
   * @returns {string[]} Array of detected skills
   */
  extractSkillsFromCode(content) {
    const skills = new Set();
    
    // ═══════════════════════════════════════════════════════════════════════
    // 1. CODE BLOCK LANGUAGE DETECTION
    // ═══════════════════════════════════════════════════════════════════════
    const codeBlockLangs = content.matchAll(/```(\w+)/g);
    const langToSkill = {
      'javascript': 'javascript', 'js': 'javascript',
      'typescript': 'typescript', 'ts': 'typescript',
      'python': 'python', 'py': 'python',
      'rust': 'rust', 'rs': 'rust',
      'go': 'go', 'golang': 'go',
      'java': 'java',
      'csharp': 'csharp', 'cs': 'csharp',
      'cpp': 'cpp', 'c++': 'cpp',
      'c': 'c',
      'ruby': 'ruby', 'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kotlin': 'kotlin', 'kt': 'kotlin',
      'scala': 'scala',
      'sql': 'sql',
      'bash': 'shell', 'sh': 'shell', 'zsh': 'shell', 'shell': 'shell',
      'powershell': 'powershell', 'ps1': 'powershell',
      'html': 'html',
      'css': 'css', 'scss': 'css', 'sass': 'css', 'less': 'css',
      'yaml': 'yaml', 'yml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'graphql': 'graphql', 'gql': 'graphql',
      'dockerfile': 'docker',
      'terraform': 'terraform', 'tf': 'terraform',
      'hcl': 'terraform',
      'jsx': 'react', 'tsx': 'react',
      'vue': 'vue',
      'svelte': 'svelte',
    };
    
    for (const match of codeBlockLangs) {
      const lang = match[1].toLowerCase();
      if (langToSkill[lang]) {
        skills.add(langToSkill[lang]);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2. IMPORT/REQUIRE STATEMENT ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════
    const importPatterns = [
      // ES6 imports: import X from 'package'
      /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g,
      // CommonJS: require('package')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Python: from X import Y, import X
      /(?:from\s+(\w+)|^import\s+(\w+))/gm,
      // Go: import "package"
      /import\s+(?:\([\s\S]*?\)|["']([^"']+)["'])/g,
      // Rust: use crate::X
      /use\s+([\w:]+)/g,
    ];
    
    const packageToSkill = {
      // React ecosystem
      'react': 'react', 'react-dom': 'react', 'react-router': 'react',
      'next': 'nextjs', 'next/': 'nextjs',
      'gatsby': 'gatsby',
      '@tanstack/react-query': 'react-query', 'react-query': 'react-query',
      'redux': 'redux', '@reduxjs/toolkit': 'redux', 'react-redux': 'redux',
      'zustand': 'zustand', 'jotai': 'jotai', 'recoil': 'recoil',
      'mobx': 'mobx',
      
      // Vue ecosystem
      'vue': 'vue', '@vue/': 'vue',
      'nuxt': 'nuxt', '@nuxt/': 'nuxt',
      'pinia': 'pinia', 'vuex': 'vuex',
      
      // Node.js & Backend
      'express': 'express', 'fastify': 'fastify', 'koa': 'koa',
      'nestjs': 'nestjs', '@nestjs/': 'nestjs',
      'hapi': 'hapi', '@hapi/': 'hapi',
      
      // Databases
      'mongoose': 'mongodb', 'mongodb': 'mongodb',
      'pg': 'postgresql', 'postgres': 'postgresql',
      'mysql': 'mysql', 'mysql2': 'mysql',
      'prisma': 'prisma', '@prisma/client': 'prisma',
      'typeorm': 'typeorm', 'sequelize': 'sequelize',
      'drizzle-orm': 'drizzle',
      'redis': 'redis', 'ioredis': 'redis',
      
      // Testing
      'jest': 'jest', '@jest/': 'jest',
      'vitest': 'vitest',
      'mocha': 'mocha', 'chai': 'mocha',
      'cypress': 'cypress',
      'playwright': 'playwright', '@playwright/': 'playwright',
      'testing-library': 'testing-library', '@testing-library/': 'testing-library',
      
      // Build tools
      'webpack': 'webpack',
      'vite': 'vite',
      'rollup': 'rollup',
      'esbuild': 'esbuild',
      'parcel': 'parcel',
      
      // Cloud & DevOps
      'aws-sdk': 'aws', '@aws-sdk/': 'aws',
      '@azure/': 'azure',
      '@google-cloud/': 'gcp',
      'docker': 'docker',
      'kubernetes': 'kubernetes', '@kubernetes/': 'kubernetes',
      
      // GraphQL
      'graphql': 'graphql', '@graphql/': 'graphql',
      'apollo': 'apollo', '@apollo/': 'apollo',
      'urql': 'urql',
      
      // Auth
      'passport': 'authentication', 'jsonwebtoken': 'jwt',
      'next-auth': 'authentication', '@auth/': 'authentication',
      'oauth': 'oauth',
      
      // Python packages
      'django': 'django', 'flask': 'flask', 'fastapi': 'fastapi',
      'pandas': 'pandas', 'numpy': 'numpy',
      'tensorflow': 'tensorflow', 'torch': 'pytorch', 'pytorch': 'pytorch',
      'sklearn': 'scikit-learn', 'scikit-learn': 'scikit-learn',
    };
    
    for (const pattern of importPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const pkg = (match[1] || match[2] || '').toLowerCase();
        if (!pkg) continue;
        
        // Check direct matches
        for (const [key, skill] of Object.entries(packageToSkill)) {
          if (pkg === key || pkg.startsWith(key)) {
            skills.add(skill);
            break;
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 3. PATTERN-BASED SKILL DETECTION
    // ═══════════════════════════════════════════════════════════════════════
    const patternSkills = [
      // Git patterns
      { pattern: /git\s+(clone|commit|push|pull|merge|rebase|branch)/gi, skill: 'git' },
      { pattern: /\.git(hub|lab|ignore)/gi, skill: 'git' },
      
      // Docker patterns
      { pattern: /docker\s+(build|run|compose|image|container)/gi, skill: 'docker' },
      { pattern: /Dockerfile|docker-compose/gi, skill: 'docker' },
      
      // Kubernetes patterns
      { pattern: /kubectl|k8s|kubernetes/gi, skill: 'kubernetes' },
      { pattern: /\.ya?ml.*kind:\s*(Deployment|Service|Pod|ConfigMap)/gi, skill: 'kubernetes' },
      
      // CI/CD patterns
      { pattern: /github\s*actions?|\.github\/workflows/gi, skill: 'github-actions' },
      { pattern: /gitlab-ci|\.gitlab-ci\.yml/gi, skill: 'gitlab-ci' },
      { pattern: /jenkins(file)?/gi, skill: 'jenkins' },
      
      // API patterns
      { pattern: /REST\s*API|RESTful/gi, skill: 'rest-api' },
      { pattern: /GraphQL\s*(query|mutation|subscription)/gi, skill: 'graphql' },
      { pattern: /WebSocket|Socket\.io|ws:/gi, skill: 'websockets' },
      
      // State management patterns
      { pattern: /useState|useReducer|useContext/gi, skill: 'react-hooks' },
      { pattern: /createStore|configureStore|createSlice/gi, skill: 'redux' },
      
      // Testing patterns
      { pattern: /describe\s*\(|it\s*\(|test\s*\(|expect\s*\(/gi, skill: 'testing' },
      { pattern: /mock|stub|spy|fixture/gi, skill: 'testing' },
      
      // Database patterns
      { pattern: /SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET/gi, skill: 'sql' },
      { pattern: /CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE/gi, skill: 'sql' },
      { pattern: /MongoDB|\.find\(|\.aggregate\(|\.insertOne\(/gi, skill: 'mongodb' },
      
      // Security patterns  
      { pattern: /bcrypt|argon2|scrypt|hash.*password/gi, skill: 'security' },
      { pattern: /JWT|Bearer\s+token|OAuth|OIDC/gi, skill: 'authentication' },
      { pattern: /XSS|CSRF|SQL\s*injection|sanitize/gi, skill: 'security' },
      
      // Async patterns
      { pattern: /async\s+function|await\s+|Promise\.|\.then\(/gi, skill: 'async-programming' },
      { pattern: /Observable|RxJS|subscribe\(/gi, skill: 'reactive-programming' },
    ];
    
    for (const { pattern, skill } of patternSkills) {
      if (pattern.test(content)) {
        skills.add(skill);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. NLP-BASED SOFT SKILL DETECTION
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const nlp = require('compromise');
      const doc = nlp(content.toLowerCase());
      
      // Detect collaboration/teamwork mentions
      const collabTerms = doc.match('(team|collaborate|together|pair|mob|review|feedback)').out('array');
      if (collabTerms.length >= 2) skills.add('collaboration');
      
      // Detect communication mentions
      const commTerms = doc.match('(communicate|document|explain|present|write|read)').out('array');
      if (commTerms.length >= 2) skills.add('communication');
      
      // Detect problem-solving mentions
      const problemTerms = doc.match('(solve|debug|fix|troubleshoot|investigate|analyze)').out('array');
      if (problemTerms.length >= 2) skills.add('problem-solving');
      
      // Detect learning/growth mentions
      const learnTerms = doc.match('(learn|understand|study|research|explore|discover)').out('array');
      if (learnTerms.length >= 2) skills.add('continuous-learning');
      
    } catch (err) {
      // NLP optional, continue without it
    }
    
    return Array.from(skills);
  }

  /**
   * Validate content quality
   */
  validateContent(metadata, content, filePath) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    const requiredFields = ['title', 'summary'];
    requiredFields.forEach(field => {
      if (!metadata[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Title validation
    if (metadata.title) {
      if (metadata.title.length < 3) errors.push('Title too short (< 3 chars)');
      if (metadata.title.length > 100) errors.push('Title too long (> 100 chars)');
    }
    
    // Summary validation
    if (metadata.summary) {
      if (metadata.summary.length < 20) warnings.push('Summary too short (< 20 chars)');
      if (metadata.summary.length > 300) warnings.push('Summary too long (> 300 chars)');
    }
    
    // Content validation
    if (content.length < 100) warnings.push('Content very short (< 100 chars)');
    
    // Forbidden patterns (only check actual content, not docs/guides)
    const isDocumentation = filePath.includes('/docs/') || filePath.includes('/wiki/') || 
                           filePath.includes('README') || filePath.includes('GUIDE') ||
                           filePath.includes('CONTRIBUTING');
    
    if (!isDocumentation) {
      const forbiddenPatterns = [
        { pattern: /lorem ipsum/i, message: 'Contains placeholder text' },
        { pattern: /TODO:/i, message: 'Contains TODO comments' },
        { pattern: /FIXME:/i, message: 'Contains FIXME comments' },
        { pattern: /test test test/i, message: 'Contains test placeholder' },
      ];
      
      forbiddenPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(content)) {
          errors.push(message);
        }
      });
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Suggest improvements based on content analysis
   */
  suggestImprovements(metadata, content, analysis) {
    const suggestions = [];
    
    // Missing metadata
    if (!metadata.id) suggestions.push('Add unique ID (UUID recommended)');
    if (!metadata.version) suggestions.push('Add version number (semver format)');
    
    // Tags
    if (!metadata.tags || metadata.tags.length === 0) {
      suggestions.push(`Consider adding tags: ${analysis.keywords.slice(0, 5).join(', ')}`);
    }
    
    // Relationships
    if (!metadata.relationships) {
      suggestions.push('Consider adding relationships (requires, references, seeAlso)');
    }
    
    // Categorization
    if (!metadata.taxonomy || !metadata.taxonomy.subjects) {
      suggestions.push(`Auto-detected subjects: ${analysis.categories.subjects.join(', ')}`);
    }
    if (!metadata.taxonomy || !metadata.taxonomy.topics) {
      suggestions.push(`Auto-detected topics: ${analysis.categories.topics.join(', ')}`);
    }
    
    // Difficulty
    if (!metadata.difficulty) {
      suggestions.push(`Suggested difficulty: ${analysis.categories.difficulty}`);
    }
    
    // Key phrases
    if (analysis.phrases.length > 0) {
      suggestions.push(`Key phrases found: ${analysis.phrases.slice(0, 3).join(', ')}`);
    }
    
    return suggestions;
  }

  /**
   * Process a single file
   */
  processFile(filePath, basePath) {
    const relativePath = path.relative(basePath, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    
    this.stats.totalFiles++;
    
    try {
      let metadata = {};
      let content = '';
      
      // Parse file based on type
      if (fileName.endsWith('.md') || fileName.endsWith('.mdx')) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(fileContent);
        metadata = parsed.data;
        content = parsed.content;
      } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
        content = fs.readFileSync(filePath, 'utf8');
        metadata = yaml.load(content) || {};
      } else {
        this.stats.skippedFiles++;
        return null;
      }
      
      // Store for TF-IDF calculation
      this.allDocuments.push(content);
      
      // Auto-fill missing metadata
      if (!metadata.title && fileName !== 'README.md') {
        metadata.title = fileName
          .replace(/\.(md|mdx|yaml|yml)$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
      
      if (!metadata.summary && content) {
        metadata.summary = this.generateSummary(content);
      }
      
      // Auto-categorize using NLP
      const analysis = this.autoCategorize(content, metadata);
      
      // Calculate reading level
      const readingLevel = this.calculateReadingLevel(content);
      
      // Extract named entities
      const entities = this.extractEntities(content);
      
      // Validate
      const validation = this.validateContent(metadata, content, relativePath);
      
      // Generate suggestions
      const suggestions = this.suggestImprovements(metadata, content, analysis);
      
      // Build index entry
      const entry = {
        path: relativePath,
        name: fileName,
        type: 'file',
        metadata: {
          ...metadata,
          autoGenerated: {
            keywords: analysis.keywords,
            phrases: analysis.phrases,
            subjects: analysis.categories.subjects,
            topics: analysis.categories.topics,
            skills: analysis.categories.skills,  // Learning prerequisites
            difficulty: analysis.categories.difficulty,
            confidence: analysis.categories.confidence,
            readingLevel: readingLevel.gradeLevel,
            readabilityScore: readingLevel.readabilityScore,
            statistics: {
              sentences: readingLevel.sentences,
              words: readingLevel.words,
              syllables: readingLevel.syllables
            },
            entities: {
              people: entities.people,
              places: entities.places,
              organizations: entities.organizations,
              topics: entities.topics
            },
            lastIndexed: new Date().toISOString()
          }
        },
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          suggestions
        },
        content: content.substring(0, 5000), // First 5,000 characters; the search postings read the whole file (scripts/search-index.mjs)
        searchText: `${metadata.title || ''} ${metadata.summary || ''} ${analysis.keywords.join(' ')} ${analysis.phrases.join(' ')}`.toLowerCase()
      };
      
      this.index.push(entry);
      this.stats.indexedFiles++;
      
      return entry;
      
    } catch (error) {
      this.stats.errors.push({
        file: relativePath,
        error: error.message
      });
      this.stats.skippedFiles++;
      return null;
    }
  }

  /**
   * Walk directory recursively
   */
  walkDirectory(dir, basePath) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      if (file.startsWith('.')) return; // Skip hidden files
      if (file === 'node_modules') return; // Skip node_modules
      
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.walkDirectory(filePath, basePath);
      } else {
        this.processFile(filePath, basePath);
      }
    });
  }

  /**
   * Analyze vocabulary and suggest expansions
   */
  analyzeVocabulary() {
    const extractedTerms = Array.from(this.stats.vocabulary.extractedTerms);
    const existingTerms = new Set();
    
    // Collect all existing vocabulary terms
    Object.values(VOCABULARY).forEach(category => {
      Object.values(category).forEach(terms => {
        terms.forEach(term => existingTerms.add(term));
      });
    });
    
    // Find new terms that appear frequently
    const termFrequency = {};
    this.index.forEach(entry => {
      entry.metadata.autoGenerated.keywords.forEach(keyword => {
        if (!existingTerms.has(keyword)) {
          termFrequency[keyword] = (termFrequency[keyword] || 0) + 1;
        }
      });
    });
    
    // Suggest terms that appear in 3+ documents
    this.stats.vocabulary.suggestedAdditions = Object.entries(termFrequency)
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term, count]) => ({ term, frequency: count }));
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const report = {
      summary: {
        totalFiles: this.stats.totalFiles,
        indexedFiles: this.stats.indexedFiles,
        skippedFiles: this.stats.skippedFiles,
        validFiles: this.index.filter(e => e.validation.valid).length,
        filesWithErrors: this.index.filter(e => !e.validation.valid).length,
        filesWithWarnings: this.index.filter(e => e.validation.warnings.length > 0).length,
        filesWithSuggestions: this.index.filter(e => e.validation.suggestions.length > 0).length
      },
      categorization: {
        bySubject: {},
        byTopic: {},
        byDifficulty: {},
        confidenceScores: []
      },
      validation: {
        commonErrors: {},
        commonWarnings: {},
        fileErrors: [],
        fileWarnings: []
      },
      vocabulary: {
        totalUniqueTerms: this.stats.vocabulary.extractedTerms.size,
        suggestedAdditions: this.stats.vocabulary.suggestedAdditions
      }
    };
    
    // Analyze categorization
    this.index.forEach(entry => {
      const auto = entry.metadata.autoGenerated;
      
      auto.subjects.forEach(subject => {
        report.categorization.bySubject[subject] = (report.categorization.bySubject[subject] || 0) + 1;
      });
      
      auto.topics.forEach(topic => {
        report.categorization.byTopic[topic] = (report.categorization.byTopic[topic] || 0) + 1;
      });
      
      report.categorization.byDifficulty[auto.difficulty] = (report.categorization.byDifficulty[auto.difficulty] || 0) + 1;
      
      // Track confidence scores
      if (auto.confidence) {
        Object.entries(auto.confidence).forEach(([category, score]) => {
          report.categorization.confidenceScores.push({
            file: entry.path,
            category,
            score
          });
        });
      }
      
      // Track validation issues
      if (!entry.validation.valid) {
        report.validation.fileErrors.push({
          path: entry.path,
          errors: entry.validation.errors
        });
        
        entry.validation.errors.forEach(error => {
          report.validation.commonErrors[error] = (report.validation.commonErrors[error] || 0) + 1;
        });
      }
      
      if (entry.validation.warnings.length > 0) {
        report.validation.fileWarnings.push({
          path: entry.path,
          warnings: entry.validation.warnings
        });
        
        entry.validation.warnings.forEach(warning => {
          report.validation.commonWarnings[warning] = (report.validation.commonWarnings[warning] || 0) + 1;
        });
      }
    });
    
    return report;
  }

  /**
   * Build and save index with SQL caching for incremental updates
   * 
   * @param {string} baseDir - Base directory to index
   * @param {Object} options - Build options
   * @param {boolean} options.validate - Exit with error code if validation fails
   * @param {boolean} options.verbose - Show detailed output
   * @param {boolean} options.clearCache - Clear SQL cache before building
   * @returns {Promise<Object>} Build report with statistics
   */
  async build(baseDir = '.', options = {}) {
    const startTime = Date.now();
    console.log('🚀 Building Frame Codex index with SQL caching...\n');
    
    // Initialize SQL cache
    try {
      const CodexCacheDB = require('./cache-db.js');
      this.cache = await CodexCacheDB.create();
      
      if (options.clearCache && this.cache.isInitialized) {
        console.log('🗑️  Clearing cache (--clear-cache flag)...');
        await this.cache.clear();
      }
      
      if (this.cache.isInitialized) {
        const cacheStats = await this.cache.getStats();
        console.log(`💾 SQL cache loaded: ${cacheStats.totalFiles} files cached, ${Math.round(cacheStats.cacheSize / 1024)}KB\n`);
      }
    } catch (error) {
      console.warn('⚠️ SQL cache unavailable, running full index:', error.message);
    }
    
    // Collect all files first
    const allFiles = [];
    const dirs = ['weaves', 'schema', 'docs', 'wiki'];
    
    const collectFiles = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        // Skip hidden files/folders, node_modules, and common dev folders
        if (entry.name.startsWith('.')) return;
        if (['node_modules', '.github', '.husky', '.cache', 'dist', 'build', 'coverage'].includes(entry.name)) return;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
          allFiles.push(fullPath);
        }
      });
    };
    
    dirs.forEach(dir => {
      const dirPath = path.join(baseDir, dir);
      if (fs.existsSync(dirPath)) {
        collectFiles(dirPath);
      }
    });
    
    // Compute diff if cache available
    let diff = { added: allFiles, modified: [], deleted: [], unchanged: [] };
    if (this.cache && this.cache.isInitialized) {
      diff = await this.cache.getDiff(allFiles);
      console.log(`📊 Cache diff:`);
      console.log(`   Added: ${diff.added.length}`);
      console.log(`   Modified: ${diff.modified.length}`);
      console.log(`   Deleted: ${diff.deleted.length}`);
      console.log(`   Unchanged: ${diff.unchanged.length} (using cache)\n`);
      
      // Delete removed files from cache
      if (diff.deleted.length > 0) {
        await this.cache.deleteFiles(diff.deleted);
      }
    }
    
    // Process only changed files
    const filesToProcess = [...diff.added, ...diff.modified];
    const filesToCache = [...diff.unchanged];
    
    // Load cached analyses
    for (const filePath of filesToCache) {
      const cached = await this.cache.getCachedAnalysis(filePath);
      if (cached) {
        this.index.push(cached);
        this.stats.cachedFiles++;
        this.allDocuments.push(cached.content || '');
      } else {
        // Cache miss, add to process list
        filesToProcess.push(filePath);
      }
    }
    
    // Process changed files
    console.log(`🔄 Processing ${filesToProcess.length} changed files...\n`);
    for (const filePath of filesToProcess) {
      const entry = this.processFile(filePath, baseDir);
      
      // Save to cache
      if (entry && this.cache && this.cache.isInitialized) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          await this.cache.saveFileAnalysis(filePath, content, entry);
        } catch (error) {
          console.warn(`Failed to cache ${filePath}:`, error.message);
        }
      }
    }
    
    // Calculate performance metrics
    const timeElapsed = Date.now() - startTime;
    this.stats.performance.timeElapsed = timeElapsed;
    this.stats.performance.cacheHitRate = this.stats.totalFiles > 0
      ? Math.round((this.stats.cachedFiles / this.stats.totalFiles) * 100)
      : 0;
    
    // Analyze vocabulary
    this.analyzeVocabulary();
    
    // Generate report
    const report = this.generateReport();
    
    // Add performance metrics to report
    report.performance = {
      timeElapsed: `${(timeElapsed / 1000).toFixed(2)}s`,
      cacheHitRate: `${this.stats.performance.cacheHitRate}%`,
      filesProcessed: filesToProcess.length,
      filesCached: this.stats.cachedFiles,
      speedup: diff.unchanged.length > 0 
        ? `${Math.round((diff.unchanged.length / this.stats.totalFiles) * 100)}% faster`
        : 'N/A (first run)'
    };
    
    // Save index
    fs.writeFileSync(
      path.join(baseDir, 'codex-index.json'),
      JSON.stringify(this.index, null, 2)
    );
    
    // Save report
    fs.writeFileSync(
      path.join(baseDir, 'codex-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Print summary
    console.log('\n✅ Indexing complete!');
    console.log(`⏱️  Time: ${report.performance.timeElapsed} (${report.performance.speedup})`);
    console.log(`💾 Cache hit rate: ${report.performance.cacheHitRate}`);
    console.log(`📊 Total files: ${report.summary.totalFiles}`);
    console.log(`✓ Successfully indexed: ${report.summary.indexedFiles}`);
    console.log(`✓ Valid files: ${report.summary.validFiles}`);
    console.log(`⚠️  Files with warnings: ${report.summary.filesWithWarnings}`);
    console.log(`❌ Files with errors: ${report.summary.filesWithErrors}`);
    console.log(`💡 Files with suggestions: ${report.summary.filesWithSuggestions}`);
    
    // Vocabulary insights
    if (report.vocabulary.suggestedAdditions.length > 0) {
      console.log('\n📚 Suggested vocabulary additions:');
      report.vocabulary.suggestedAdditions.slice(0, 10).forEach(({ term, frequency }) => {
        console.log(`  - "${term}" (appears in ${frequency} documents)`);
      });
    }
    
    // Validation errors
    if (report.validation.fileErrors.length > 0) {
      console.log('\n❌ Validation errors:');
      report.validation.fileErrors.slice(0, 5).forEach(({ path, errors }) => {
        console.log(`  ${path}:`);
        errors.forEach(error => console.log(`    - ${error}`));
      });
      if (report.validation.fileErrors.length > 5) {
        console.log(`  ... and ${report.validation.fileErrors.length - 5} more files with errors`);
      }
    }
    
    // Common issues
    if (Object.keys(report.validation.commonErrors).length > 0) {
      console.log('\n📋 Most common errors:');
      Object.entries(report.validation.commonErrors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  - ${error}: ${count} files`);
        });
    }
    
    // Close cache
    if (this.cache) {
      await this.cache.close();
    }
    
    return report;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    validate: args.includes('--validate'),
    verbose: args.includes('--verbose'),
    clearCache: args.includes('--clear-cache')
  };
  
  const indexer = new CodexIndexer();
  
  // Run async build
  indexer.build('.', options).then(report => {
    // Exit with error code if validation failed and --validate flag is set
    if (options.validate && report.summary.filesWithErrors > 0) {
      console.error('\n❌ Validation failed. Fix errors before committing.');
      process.exit(1);
    }
  }).catch(error => {
    console.error('❌ Fatal error during indexing:', error);
    process.exit(1);
  });
}

// Export for both CommonJS and ES module imports
module.exports = CodexIndexer;
module.exports.CodexIndexer = CodexIndexer;