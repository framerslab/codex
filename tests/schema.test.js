/**
 * The format's schema files. thread.schema.yaml is the note schema under the thread names (title ThreadFrontmatter);
 * strand.schema.yaml stays an identical copy, title StrandFrontmatter, for one major version; fabric.schema.yaml describes
 * the optional manifest at a fabric's root. The schemas must accept the frontmatter the corpus stores today: the fixture
 * under rename/fixtures/ is a copy of that shape, and its keys (relationships: among them) keep their names.
 *
 * Run: npx vitest run tests/schema.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const schemaDir = path.join(__dirname, '..', 'schema');
const load = (file) => yaml.load(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
const compile = (file) => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(load(file));
};
const fixture = path.join(__dirname, '..', 'rename', 'fixtures', 'weaves', 'wiki', 'architecture', 'overview.md');

describe('the format schema files', () => {
  const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.schema.yaml')).sort();

  it('are all present and parse as YAML objects', () => {
    expect(files).toEqual([
      'blocks-index.schema.yaml',
      'fabric.schema.yaml',
      'loom.schema.yaml',
      'strand.schema.yaml',
      'thread.schema.yaml',
      'weave.schema.yaml',
    ]);
    for (const file of files) expect(typeof load(file)).toBe('object');
  });

  it('all compile as JSON Schema 2020-12', () => {
    for (const file of files) expect(() => compile(file), file).not.toThrow();
  });

  it('thread and strand schemas differ only in their title', () => {
    const { title: threadTitle, ...thread } = load('thread.schema.yaml');
    const { title: strandTitle, ...strand } = load('strand.schema.yaml');
    expect(threadTitle).toBe('ThreadFrontmatter');
    expect(strandTitle).toBe('StrandFrontmatter');
    expect(thread).toEqual(strand);
    expect(thread.required).toEqual(['id', 'slug', 'title', 'version', 'contentType']);
  });

  it('the fabric manifest takes format openquarry and version 1 or 2', () => {
    const valid = compile('fabric.schema.yaml');
    expect(valid({ format: 'openquarry', name: 'Frame Codex', version: 2 })).toBe(true);
    expect(valid({ format: 'openquarry', version: 1 })).toBe(true);
    expect(valid({ format: 'openquarry', version: 3 })).toBe(false);
    expect(valid({ format: 'openquarry', version: '2' })).toBe(false);
    expect(valid({ format: 'openstrand', version: 1 })).toBe(false);
    expect(valid({ format: 'openquarry' })).toBe(false);
  });

  it('accepts the frontmatter the corpus stores today, under both titles', () => {
    const { data } = matter(fs.readFileSync(fixture, 'utf8'));
    expect(data.relationships).toEqual({ references: ['sql-cache-architecture', 'nlp-pipeline', 'automation-workflows'] });
    for (const file of ['thread.schema.yaml', 'strand.schema.yaml']) {
      const valid = compile(file);
      const ok = valid(data);
      expect(valid.errors, file).toBeNull();
      expect(ok, file).toBe(true);
    }
  });

  it('accepts the list of typed links the corpus also stores, and the notes key as a list or as text', () => {
    const valid = compile('thread.schema.yaml');
    const base = {
      id: '3fce914f-0801-45fd-b886-f0521aeeb4a1',
      slug: 'typed-links',
      title: 'Typed links',
      version: '1.0.0',
      contentType: 'reference',
    };
    const linked = {
      ...base,
      relationships: [
        { targetSlug: 'architecture', type: 'extends', strength: 0.8 },
        { targetSlug: 'hierarchy', type: 'references', strength: 0.7, bidirectional: false },
      ],
    };
    expect(valid(linked), JSON.stringify(valid.errors)).toBe(true);
    expect(valid({ ...base, notes: ['Read the hooks note next.'] }), JSON.stringify(valid.errors)).toBe(true);
    expect(valid({ ...base, notes: 'Read the hooks note next.' }), JSON.stringify(valid.errors)).toBe(true);
    expect(valid({ ...base, contentType: 'poem' })).toBe(false);
  });
});
