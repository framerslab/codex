/**
 * The corpus validator (scripts/validate.js) and the course layer: a lesson, an exercise and an assessment are threads
 * the thread schema takes, and a weave or a loom may carry a `kind` that is one lowercase word. `npm run validate` must
 * agree with the schema files on both.
 *
 * Run: npx vitest run tests/validate-course.test.js
 */

import { describe, it, expect } from 'vitest';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const CodexValidator = require('../scripts/validate.js');

const schema = (name) => yaml.load(fs.readFileSync(path.join(__dirname, '..', 'schema', `${name}.schema.yaml`), 'utf8'));

const thread = {
  id: '70c967bf-2dba-4399-aef1-671174eb904f',
  slug: 'scale-and-distance',
  title: 'Scale and distance',
  version: '1.0.0',
};

const errorsFor = (method, data) => {
  const validator = new CodexValidator();
  validator[method](data, 'file');
  return validator.errors;
};

describe('the corpus validator and the thread schema', () => {
  it('takes every contentType the thread schema takes', () => {
    const allowed = schema('thread').properties.contentType.enum;
    expect(allowed).toEqual(expect.arrayContaining(['lesson', 'exercise', 'assessment']));
    for (const contentType of allowed) {
      expect(errorsFor('validateStrand', { ...thread, contentType }), contentType).toEqual([]);
    }
  });

  it('refuses a contentType the thread schema does not take', () => {
    expect(errorsFor('validateStrand', { ...thread, contentType: 'lecture' })).toEqual(['file: Invalid content type']);
  });
});

describe('the corpus validator and kind', () => {
  const weave = { slug: 'reading-a-map', title: 'Reading a map', description: 'A course.', license: 'MIT' };
  const loom = { slug: 'the-map', title: 'The map', summary: 'What a map shows.' };

  it('takes a kind that is one lowercase word, or none', () => {
    for (const kind of [undefined, 'course', 'field-guide']) {
      expect(errorsFor('validateWeave', { ...weave, kind }), String(kind)).toEqual([]);
    }
    for (const kind of [undefined, 'unit', 'week']) {
      expect(errorsFor('validateLoom', { ...loom, kind }), String(kind)).toEqual([]);
    }
  });

  it('refuses a kind the weave and loom schemas refuse', () => {
    for (const name of ['weave', 'loom']) {
      expect(schema(name).properties.kind.pattern, name).toBe('^[a-z][a-z0-9-]*$');
    }
    for (const kind of ['Course', 'two words', '2nd-year', '', 3]) {
      expect(errorsFor('validateWeave', { ...weave, kind }), JSON.stringify(kind)).toEqual([
        "file: kind must be one lowercase word (letters, digits and hyphens, starting with a letter)",
      ]);
      expect(errorsFor('validateLoom', { ...loom, kind }), JSON.stringify(kind)).toEqual([
        "file: kind must be one lowercase word (letters, digits and hyphens, starting with a letter)",
      ]);
    }
  });
});
