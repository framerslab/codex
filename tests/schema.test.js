/**
 * The format's schema files. thread.schema.yaml is the note schema under the thread names (title ThreadFrontmatter);
 * strand.schema.yaml stays an identical copy, title StrandFrontmatter, for one major version; fabric.schema.yaml describes
 * the optional manifest at a fabric's root. The schemas must accept the frontmatter the corpus stores today: the fixture
 * under rename/fixtures/ is a copy of that shape, and its keys (relationships: among them) keep their names.
 *
 * The course layer: a weave and a loom take an optional `kind` (a course is a weave of kind course, a unit a loom of kind
 * unit), and catalogue.schema.yaml describes the catalogue record at a fabric's root. Both are additions: a weave or a
 * loom without `kind` reads as before.
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
      'catalogue.schema.yaml',
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

  it("accepts every link type the app writes, and the skill ids a note teaches and requires", () => {
    const valid = compile('thread.schema.yaml');
    const base = {
      id: '3fce914f-0801-45fd-b886-f0521aeeb4a1',
      slug: 'link-types',
      title: 'Link types',
      version: '1.0.0',
      contentType: 'lesson',
    };
    // the link types of the app's LinkType (apps/frame.dev lib/content/types.ts), written by its frontmatter writer
    const appLinkTypes = [
      'extends', 'contrasts', 'supports', 'example-of', 'implements', 'questions', 'refines', 'applies', 'summarizes',
      'prerequisite', 'related', 'follows', 'references', 'contradicts', 'updates', 'parallels', 'synthesizes', 'custom',
    ];
    for (const type of appLinkTypes) {
      expect(valid({ ...base, relationships: [{ type, target: 'another-note' }] }), type).toBe(true);
    }
    expect(valid({ ...base, relationships: [{ type: 'unrelated-to', target: 'another-note' }] })).toBe(false);
    const skills = { teaches: ['qs/library/skill/slope'], requires: ['qs/library/skill/linear-equation'] };
    expect(valid({ ...base, ...skills }), JSON.stringify(valid.errors)).toBe(true);
    expect(valid({ ...base, teaches: 'qs/library/skill/slope' })).toBe(false);
  });

  it('a weave and a loom take an optional kind, a lowercase word', () => {
    const weave = compile('weave.schema.yaml');
    const loom = compile('loom.schema.yaml');
    expect(weave({ slug: 'reading-a-map', title: 'Reading a map', kind: 'course' }), JSON.stringify(weave.errors)).toBe(true);
    expect(loom({ slug: 'the-map', title: 'The map', kind: 'unit', ordering: 'manual' }), JSON.stringify(loom.errors)).toBe(true);
    // a publisher's own noun passes; the weaves and looms the corpus stores today carry no kind and still pass
    expect(weave({ slug: 'field-guide', title: 'Field guide', kind: 'field-guide' })).toBe(true);
    expect(weave({ slug: 'wiki', title: 'Frame Wiki', description: 'The wiki weave.', license: 'MIT' })).toBe(true);
    expect(loom({ slug: 'frame', title: 'Frame', summary: 'The Frame loom.', ordering: 'manual' })).toBe(true);
    for (const kind of ['Course', 'two words', '2nd-year', '', 7, ['course']]) {
      expect(weave({ slug: 'reading-a-map', title: 'Reading a map', kind }), JSON.stringify(kind)).toBe(false);
      expect(loom({ slug: 'the-map', title: 'The map', kind }), JSON.stringify(kind)).toBe(false);
    }
    for (const file of ['weave.schema.yaml', 'loom.schema.yaml']) {
      const schema = load(file);
      expect(schema.properties.kind.pattern, file).toBe('^[a-z][a-z0-9-]*$');
      expect(schema.required, file).toEqual(['slug', 'title']);
    }
  });

  it('the catalogue record lists subjects and one entry a weave, and refuses a key it does not name', () => {
    const valid = compile('catalogue.schema.yaml');
    const catalogue = {
      id: 'outdoor-skills',
      title: 'Outdoor skills',
      subjects: [
        { id: 'outdoors', title: 'Outdoors', broader: [] },
        { id: 'navigation', title: 'Navigation', broader: ['outdoors'] },
      ],
      entries: [
        { slug: 'reading-a-map', home: 'navigation', subjects: ['navigation'], requires: [] },
        { slug: 'night-navigation', home: 'navigation', subjects: ['navigation', 'outdoors'], requires: ['reading-a-map'] },
      ],
    };
    expect(valid(catalogue), JSON.stringify(valid.errors)).toBe(true);
    expect(valid({ ...catalogue, subjects: [], entries: [] }), JSON.stringify(valid.errors)).toBe(true);
    expect(load('catalogue.schema.yaml').title).toBe('Catalogue');

    const { entries: _entries, ...withoutEntries } = catalogue;
    expect(valid(withoutEntries)).toBe(false);
    const [first] = catalogue.entries;
    const withEntry = (entry) => ({ ...catalogue, entries: [entry] });
    const { home: _home, ...withoutHome } = first;
    expect(valid(withEntry(withoutHome))).toBe(false);
    expect(valid(withEntry({ ...first, subjects: [] }))).toBe(false);
    expect(valid(withEntry({ ...first, slug: 'Reading a map' }))).toBe(false);
    expect(valid(withEntry({ ...first, requires: 'night-navigation' }))).toBe(false);
    // closed at every level: the record, a subject and an entry
    expect(valid({ ...catalogue, url: 'https://example.org/' })).toBe(false);
    expect(valid({ ...catalogue, subjects: [{ id: 'outdoors', title: 'Outdoors', broader: [], colour: 'green' }] })).toBe(false);
    expect(valid(withEntry({ ...first, lessons: 12 }))).toBe(false);
    expect(valid({ ...catalogue, subjects: [{ id: 'outdoors', title: '', broader: [] }] })).toBe(false);
    expect(valid({ ...catalogue, subjects: [{ id: 'outdoors', title: 'Outdoors' }] })).toBe(false);
  });
});
