const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');
const { v4: uuidv4, validate: validateUUID } = require('uuid');

// The content types and the kind pattern come from the schema files, so this check and the schemas agree.
const readSchema = (name) =>
  yaml.load(fs.readFileSync(path.join(__dirname, '..', 'schema', `${name}.schema.yaml`), 'utf8'));
const CONTENT_TYPES = readSchema('thread').properties.contentType.enum;
const KIND = {
  weave: new RegExp(readSchema('weave').properties.kind.pattern),
  loom: new RegExp(readSchema('loom').properties.kind.pattern),
};
const KIND_ERROR = 'kind must be one lowercase word (letters, digits and hyphens, starting with a letter)';

class CodexValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }

  // Validate weave schema
  validateWeave(data, filePath) {
    const required = ['slug', 'title', 'description'];
    required.forEach(field => {
      if (!data[field]) {
        this.errors.push(`${filePath}: Missing required field '${field}'`);
      }
    });

    if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
      this.errors.push(`${filePath}: Slug must be lowercase alphanumeric with hyphens`);
    }

    if (data.tags && !Array.isArray(data.tags)) {
      this.errors.push(`${filePath}: Tags must be an array`);
    }

    if (data.kind !== undefined && !(typeof data.kind === 'string' && KIND.weave.test(data.kind))) {
      this.errors.push(`${filePath}: ${KIND_ERROR}`);
    }

    if (!data.license) {
      this.warnings.push(`${filePath}: No license specified (defaults to MIT)`);
    }
  }

  // Validate loom schema
  validateLoom(data, filePath) {
    const required = ['slug', 'title', 'summary'];
    required.forEach(field => {
      if (!data[field]) {
        this.errors.push(`${filePath}: Missing required field '${field}'`);
      }
    });

    if (data.kind !== undefined && !(typeof data.kind === 'string' && KIND.loom.test(data.kind))) {
      this.errors.push(`${filePath}: ${KIND_ERROR}`);
    }

    if (data.ordering) {
      if (!['sequential', 'hierarchical', 'network'].includes(data.ordering.type)) {
        this.errors.push(`${filePath}: Invalid ordering type`);
      }
      if (data.ordering.items && !Array.isArray(data.ordering.items)) {
        this.errors.push(`${filePath}: Ordering items must be an array`);
      }
    }
  }

  // Validate strand schema
  validateStrand(data, filePath) {
    const required = ['id', 'slug', 'title'];
    required.forEach(field => {
      if (!data[field]) {
        this.errors.push(`${filePath}: Missing required field '${field}'`);
      }
    });

    if (data.id && !validateUUID(data.id)) {
      this.errors.push(`${filePath}: ID must be a valid UUID`);
    }

    if (data.contentType && !CONTENT_TYPES.includes(data.contentType)) {
      this.errors.push(`${filePath}: Invalid content type`);
    }

    if (data.difficulty && !['beginner', 'intermediate', 'advanced', 'expert'].includes(data.difficulty)) {
      this.errors.push(`${filePath}: Invalid difficulty level`);
    }

    if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
      this.warnings.push(`${filePath}: Version should follow semver format (x.y.z)`);
    }

    // Check relationships
    if (data.relationships) {
      if (data.relationships.requires && !Array.isArray(data.relationships.requires)) {
        this.errors.push(`${filePath}: Relationships.requires must be an array`);
      }
      if (data.relationships.references && !Array.isArray(data.relationships.references)) {
        this.errors.push(`${filePath}: Relationships.references must be an array`);
      }
    }

    // Validate ECA (Educational Content Atom) fields
    this.validateECAFields(data, filePath);

    // Suggest improvements
    if (!data.summary) {
      this.suggestions.push(`${filePath}: Consider adding a summary for better searchability`);
    }
    if (!data.tags || data.tags.length === 0) {
      this.suggestions.push(`${filePath}: Consider adding tags for better categorization`);
    }
    if (!data.version) {
      this.suggestions.push(`${filePath}: Consider adding a version number`);
    }
  }

  // Validate OpenStrand ECA (Educational Content Atom) fields
  validateECAFields(data, filePath) {
    // Learning Design validation
    if (data.learningDesign) {
      if (data.learningDesign.objectives) {
        if (!Array.isArray(data.learningDesign.objectives)) {
          this.errors.push(`${filePath}: learningDesign.objectives must be an array`);
        } else {
          data.learningDesign.objectives.forEach((obj, idx) => {
            if (!obj.description) {
              this.errors.push(`${filePath}: learningDesign.objectives[${idx}] missing description`);
            }
            if (obj.bloomsLevel && !['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].includes(obj.bloomsLevel)) {
              this.errors.push(`${filePath}: learningDesign.objectives[${idx}] invalid bloomsLevel`);
            }
          });
        }
      }

      if (data.learningDesign.pedagogicalApproach) {
        const validApproaches = ['direct_instruction', 'discovery_learning', 'problem_based', 'collaborative', 'experiential', 'inquiry_based'];
        if (!Array.isArray(data.learningDesign.pedagogicalApproach)) {
          this.errors.push(`${filePath}: learningDesign.pedagogicalApproach must be an array`);
        } else {
          data.learningDesign.pedagogicalApproach.forEach(approach => {
            if (!validApproaches.includes(approach)) {
              this.errors.push(`${filePath}: Invalid pedagogicalApproach: ${approach}`);
            }
          });
        }
      }
    }

    // Time Estimates validation
    if (data.timeEstimates) {
      ['reading', 'exercises', 'projects', 'total'].forEach(field => {
        if (data.timeEstimates[field] !== undefined && typeof data.timeEstimates[field] !== 'number') {
          this.errors.push(`${filePath}: timeEstimates.${field} must be a number`);
        }
      });

      if (data.timeEstimates.total && data.timeEstimates.reading && data.timeEstimates.exercises) {
        const sum = (data.timeEstimates.reading || 0) + (data.timeEstimates.exercises || 0) + (data.timeEstimates.projects || 0);
        if (Math.abs(sum - data.timeEstimates.total) > 1) {
          this.warnings.push(`${filePath}: timeEstimates.total (${data.timeEstimates.total}) doesn't match sum of components (${sum})`);
        }
      }
    }

    // Modalities validation
    if (data.modalities) {
      if (data.modalities.text !== undefined && typeof data.modalities.text !== 'boolean') {
        this.errors.push(`${filePath}: modalities.text must be boolean`);
      }

      if (data.modalities.visual) {
        ['diagrams', 'images', 'charts'].forEach(field => {
          if (data.modalities.visual[field] !== undefined && typeof data.modalities.visual[field] !== 'number') {
            this.errors.push(`${filePath}: modalities.visual.${field} must be a number`);
          }
        });
      }

      if (data.modalities.audio && data.modalities.audio.narration !== undefined && typeof data.modalities.audio.narration !== 'boolean') {
        this.errors.push(`${filePath}: modalities.audio.narration must be boolean`);
      }
    }

    // Interactive Elements validation
    if (data.interactiveElements) {
      if (!Array.isArray(data.interactiveElements)) {
        this.errors.push(`${filePath}: interactiveElements must be an array`);
      } else {
        const validTypes = ['quiz', 'poll', 'simulation', 'code_exercise', 'discussion_prompt', 'reflection', 'peer_review'];
        data.interactiveElements.forEach((elem, idx) => {
          if (!elem.id) {
            this.errors.push(`${filePath}: interactiveElements[${idx}] missing id`);
          }
          if (!elem.type || !validTypes.includes(elem.type)) {
            this.errors.push(`${filePath}: interactiveElements[${idx}] invalid or missing type`);
          }
          if (elem.required !== undefined && typeof elem.required !== 'boolean') {
            this.errors.push(`${filePath}: interactiveElements[${idx}].required must be boolean`);
          }
        });
      }
    }

    // Assessments validation
    if (data.assessments) {
      ['formative', 'summative'].forEach(assessmentType => {
        if (data.assessments[assessmentType]) {
          if (!Array.isArray(data.assessments[assessmentType])) {
            this.errors.push(`${filePath}: assessments.${assessmentType} must be an array`);
          } else {
            data.assessments[assessmentType].forEach((assessment, idx) => {
              if (!assessment.id) {
                this.errors.push(`${filePath}: assessments.${assessmentType}[${idx}] missing id`);
              }
              if (!assessment.type) {
                this.errors.push(`${filePath}: assessments.${assessmentType}[${idx}] missing type`);
              }
              if (assessment.weight !== undefined && (typeof assessment.weight !== 'number' || assessment.weight < 0 || assessment.weight > 1)) {
                this.errors.push(`${filePath}: assessments.${assessmentType}[${idx}].weight must be between 0 and 1`);
              }
              if (assessmentType === 'summative' && assessment.passingScore !== undefined) {
                if (typeof assessment.passingScore !== 'number' || assessment.passingScore < 0 || assessment.passingScore > 100) {
                  this.errors.push(`${filePath}: assessments.summative[${idx}].passingScore must be between 0 and 100`);
                }
              }
            });
          }
        }
      });
    }

    // Accessibility validation
    if (data.accessibility) {
      if (data.accessibility.wcagLevel && !['A', 'AA', 'AAA'].includes(data.accessibility.wcagLevel)) {
        this.errors.push(`${filePath}: accessibility.wcagLevel must be A, AA, or AAA`);
      }

      if (data.accessibility.features) {
        const validFeatures = ['alt_text', 'captions', 'transcripts', 'audio_description', 'sign_language', 'easy_read', 'high_contrast', 'keyboard_navigation'];
        if (!Array.isArray(data.accessibility.features)) {
          this.errors.push(`${filePath}: accessibility.features must be an array`);
        } else {
          data.accessibility.features.forEach(feature => {
            if (!validFeatures.includes(feature)) {
              this.warnings.push(`${filePath}: Unknown accessibility feature: ${feature}`);
            }
          });
        }
      }

      if (data.accessibility.readingLevel !== undefined) {
        if (typeof data.accessibility.readingLevel !== 'number' || data.accessibility.readingLevel < 1 || data.accessibility.readingLevel > 20) {
          this.errors.push(`${filePath}: accessibility.readingLevel must be between 1 and 20`);
        }
      }
    }

    // Cultural Adaptations validation
    if (data.culturalAdaptations) {
      if (!Array.isArray(data.culturalAdaptations)) {
        this.errors.push(`${filePath}: culturalAdaptations must be an array`);
      } else {
        data.culturalAdaptations.forEach((adaptation, idx) => {
          if (!adaptation.culture) {
            this.errors.push(`${filePath}: culturalAdaptations[${idx}] missing culture code`);
          }
          if (adaptation.culture && !/^[A-Z]{2}$/.test(adaptation.culture)) {
            this.warnings.push(`${filePath}: culturalAdaptations[${idx}].culture should be ISO 3166-1 alpha-2 (e.g., US, GB)`);
          }
        });
      }
    }

    // Quality metrics validation
    if (data.quality) {
      if (data.quality.peerReview) {
        if (data.quality.peerReview.status && !['pending', 'reviewed', 'approved'].includes(data.quality.peerReview.status)) {
          this.errors.push(`${filePath}: quality.peerReview.status must be pending, reviewed, or approved`);
        }
        if (data.quality.peerReview.score !== undefined) {
          if (typeof data.quality.peerReview.score !== 'number' || data.quality.peerReview.score < 0 || data.quality.peerReview.score > 5) {
            this.errors.push(`${filePath}: quality.peerReview.score must be between 0 and 5`);
          }
        }
      }

      if (data.quality.evidenceBased) {
        if (!Array.isArray(data.quality.evidenceBased)) {
          this.errors.push(`${filePath}: quality.evidenceBased must be an array`);
        } else {
          data.quality.evidenceBased.forEach((evidence, idx) => {
            if (!evidence.claim || !evidence.evidence || !evidence.citation) {
              this.errors.push(`${filePath}: quality.evidenceBased[${idx}] missing required fields (claim, evidence, citation)`);
            }
            if (evidence.strength && !['strong', 'moderate', 'emerging'].includes(evidence.strength)) {
              this.errors.push(`${filePath}: quality.evidenceBased[${idx}].strength must be strong, moderate, or emerging`);
            }
          });
        }
      }

      if (data.quality.updateFrequency && !['static', 'annual', 'biannual', 'quarterly', 'dynamic'].includes(data.quality.updateFrequency)) {
        this.errors.push(`${filePath}: quality.updateFrequency must be static, annual, biannual, quarterly, or dynamic`);
      }
    }

    // Suggest ECA enhancements
    if (!data.learningDesign && !data.timeEstimates && !data.modalities) {
      this.suggestions.push(`${filePath}: Consider adding ECA fields (learningDesign, timeEstimates, modalities) for enhanced learning analytics`);
    }
  }

  // Validate file
  validateFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let data = {};

      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        data = yaml.load(content);
        
        // Determine type by path or content
        if (filePath.includes('weave.yaml')) {
          this.validateWeave(data, filePath);
        } else if (filePath.includes('loom.yaml')) {
          this.validateLoom(data, filePath);
        }
      } else if (filePath.endsWith('.md')) {
        const { data: frontmatter, content: body } = matter(content);
        data = frontmatter;
        
        // Validate as strand
        this.validateStrand(data, filePath);
        
        // Check content length
        if (body.trim().length < 100) {
          this.warnings.push(`${filePath}: Content is very short (< 100 characters)`);
        }
        
        // Check for TODO/FIXME
        if (/TODO:|FIXME:/i.test(body)) {
          this.warnings.push(`${filePath}: Contains TODO/FIXME comments`);
        }
      }

      return true;
    } catch (error) {
      this.errors.push(`${filePath}: ${error.message}`);
      return false;
    }
  }

  // Check for duplicates
  checkDuplicates(files) {
    const seen = {
      ids: new Map(),
      slugs: new Map(),
      titles: new Map()
    };

    files.forEach(filePath => {
      if (!filePath.endsWith('.md') && !filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
        return;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        let data = {};

        if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
          data = yaml.load(content);
        } else if (filePath.endsWith('.md')) {
          const { data: frontmatter } = matter(content);
          data = frontmatter;
        }

        // Check ID duplicates
        if (data.id) {
          if (seen.ids.has(data.id)) {
            this.errors.push(`Duplicate ID '${data.id}' in ${filePath} and ${seen.ids.get(data.id)}`);
          } else {
            seen.ids.set(data.id, filePath);
          }
        }

        // Check slug duplicates within same directory
        if (data.slug) {
          const dir = path.dirname(filePath);
          const key = `${dir}:${data.slug}`;
          if (seen.slugs.has(key)) {
            this.errors.push(`Duplicate slug '${data.slug}' in ${filePath} and ${seen.slugs.get(key)}`);
          } else {
            seen.slugs.set(key, filePath);
          }
        }

        // Check title similarity
        if (data.title) {
          const normalizedTitle = data.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (seen.titles.has(normalizedTitle)) {
            this.warnings.push(`Similar title '${data.title}' in ${filePath} and ${seen.titles.get(normalizedTitle)}`);
          } else {
            seen.titles.set(normalizedTitle, filePath);
          }
        }
      } catch (error) {
        // Skip files with errors
      }
    });
  }

  // Generate new strand template
  static generateStrandTemplate(title, options = {}) {
    return {
      id: uuidv4(),
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: title,
      summary: options.summary || '',
      version: '1.0.0',
      contentType: options.contentType || 'markdown',
      difficulty: options.difficulty || 'intermediate',
      taxonomy: {
        subjects: options.subjects || [],
        topics: options.topics || []
      },
      tags: options.tags || [],
      relationships: {
        requires: [],
        references: [],
        seeAlso: []
      },
      publishing: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        status: 'draft'
      }
    };
  }

  // Validate directory
  validateDirectory(dirPath, options = {}) {
    const files = [];
    
    // Collect all files
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        if (entry.name.startsWith('.')) return;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(fullPath);
        }
      });
    };

    walk(dirPath);

    // Validate each file
    if (options.files) {
      // Validate only specific files
      options.files.forEach(file => {
        const fullPath = path.resolve(dirPath, file);
        if (fs.existsSync(fullPath)) {
          this.validateFile(fullPath);
        }
      });
    } else {
      // Validate all files
      files.forEach(file => this.validateFile(file));
    }

    // Check for duplicates
    if (!options.skipDuplicates) {
      this.checkDuplicates(files);
    }

    // Generate report
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions,
      stats: {
        totalFiles: files.length,
        errorCount: this.errors.length,
        warningCount: this.warnings.length,
        suggestionCount: this.suggestions.length
      }
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const validator = new CodexValidator();
  
  if (args.includes('--generate')) {
    // Generate template
    const title = args[args.indexOf('--generate') + 1];
    const template = CodexValidator.generateStrandTemplate(title);
    console.log(yaml.dump(template));
  } else {
    // Validate
    const dir = args.includes('--path') ? args[args.indexOf('--path') + 1] : '.';
    const files = args.includes('--files') ? args[args.indexOf('--files') + 1].split(',') : null;
    
    const result = validator.validateDirectory(dir, { files });
    
    // Output results
    console.log('\nCodex Validation Results\n' + '='.repeat(40));
    console.log(`Total files: ${result.stats.totalFiles}`);
    console.log(`Errors: ${result.stats.errorCount}`);
    console.log(`Warnings: ${result.stats.warningCount}`);
    console.log(`Suggestions: ${result.stats.suggestionCount}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warn => console.log(`  - ${warn}`));
    }
    
    if (result.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      result.suggestions.forEach(sug => console.log(`  - ${sug}`));
    }
    
    // Exit with error code if validation failed
    process.exit(result.valid ? 0 : 1);
  }
}

module.exports = CodexValidator;
