import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFieldMapping, classifyContractChange } from '../dist/packages/domain/src/io-compatibility.js';

const fileConstraints = { minFiles: 1, maxFiles: 2, maxFileSizeBytes: 1024,
  maxTotalSizeBytes: 2048, allowedMimeTypes: ['image/png'], allowedExtensions: ['.png'] };
const source = { key: 'images', label: 'Images', order: 0, required: true,
  type: 'FILES', constraints: fileConstraints };
const target = { key: 'references', label: 'References', order: 0, required: true,
  type: 'FILES', constraints: { ...fileConstraints, maxFiles: 3, maxFileSizeBytes: 2048,
    maxTotalSizeBytes: 4096 } };

test('deterministic orchestration mapping checks format, size, cardinality and semantic role', () => {
  assert.deepEqual(assessFieldMapping(source, target), { status: 'DIRECT', code: 'FILE_SAFE' });
  assert.equal(assessFieldMapping(source, { ...target, constraints: { ...target.constraints,
    allowedMimeTypes: ['application/pdf'], allowedExtensions: ['.pdf'] } }).status, 'INCOMPATIBLE');
  assert.equal(assessFieldMapping(source, { ...target, constraints: { ...target.constraints,
    maxFileSizeBytes: 512 } }).code, 'CARDINALITY_OR_SIZE');
  assert.equal(assessFieldMapping(source, { ...target, semanticType: 'reference_image' }).status, 'REVIEW_REQUIRED');
  assert.equal(assessFieldMapping({ ...source, semanticType: 'reference_image' },
    { ...target, semanticType: 'reference_image' }).status, 'DIRECT');
  assert.equal(assessFieldMapping({ ...source, semanticType: 'product_image' },
    { ...target, semanticType: 'reference_image' }).status, 'REVIEW_REQUIRED');
  assert.equal(assessFieldMapping({ ...source, required: false }, target).code, 'OPTIONAL_SOURCE');
  assert.deepEqual(assessFieldMapping({ key: 'report', label: 'Report', order: 0,
    required: true, type: 'MARKDOWN' }, { key: 'content', label: 'Content', order: 0,
    required: true, type: 'LONG_TEXT' }), { status: 'SAFE_TEXT_MAPPING', code: 'TEXT_ADAPTATION' });
});

test('contract revisions classify required/output changes as breaking and presentation as nonbreaking', () => {
  const previous = { contractVersion: 1,
    input: { schemaVersion: 1, fields: [{ key: 'instructions', label: 'Instructions',
      order: 0, required: true, type: 'SHORT_TEXT' }] },
    output: { schemaVersion: 1, fields: [{ key: 'report', label: 'Report',
      order: 0, required: false, type: 'MARKDOWN' }] } };
  const renamed = JSON.parse(JSON.stringify(previous));
  renamed.input.fields[0].label = 'Task instructions';
  assert.deepEqual(classifyContractChange(previous, renamed).changes.map((change) => change.code),
    ['PRESENTATION_CHANGED']);
  assert.equal(classifyContractChange(previous, renamed).breaking, false);
  const outputRequired = JSON.parse(JSON.stringify(previous));
  outputRequired.output.fields[0].required = true;
  assert.equal(classifyContractChange(previous, outputRequired).breaking, true);
  const addedOptional = JSON.parse(JSON.stringify(previous));
  addedOptional.input.fields.push({ key: 'variant', label: 'Variant', order: 1,
    required: false, type: 'NUMBER', defaultValue: 1 });
  assert.equal(classifyContractChange(previous, addedOptional).breaking, false);
  const addedRequired = JSON.parse(JSON.stringify(previous));
  addedRequired.input.fields.push({ key: 'variant', label: 'Variant', order: 1,
    required: true, type: 'NUMBER' });
  assert.equal(classifyContractChange(previous, addedRequired).breaking, true);
});
