import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { parseCapabilityTestCase } from '../dist/packages/contracts/src/capability-test-case.js';

const contract = { contractVersion: 1,
  input: { schemaVersion: 1, fields: [{ key: 'instructions', label: 'Instructions',
    order: 0, required: true, type: 'LONG_TEXT' }] },
  output: { schemaVersion: 1, fields: [{ key: 'renders', label: 'Renders', order: 0,
    required: true, type: 'FILES', constraints: { minFiles: 1, maxFiles: 2,
      maxFileSizeBytes: 1024, maxTotalSizeBytes: 2048,
      allowedMimeTypes: ['image/png'], allowedExtensions: ['.png'] } }] } };

test('seller-authored contract test case is typed and cannot contradict published I/O', () => {
  const fixture = { schemaVersion: 1, id: randomUUID(), capabilityVersionId: randomUUID(),
    name: 'Render fixture', input: { values: { instructions: 'Render the scene' }, assets: {} },
    expectedFiles: [{ fieldKey: 'renders', minFiles: 1, allowedMimeTypes: ['image/png'] }],
    semanticAssertions: ['Label is legible'], maxRuntimeSeconds: 300,
    maxInferenceCostMinor: 100, costCurrency: 'usd' };
  assert.equal(parseCapabilityTestCase(fixture, contract).name, 'Render fixture');
  assert.throws(() => parseCapabilityTestCase({ ...fixture, expectedFiles: [
    { fieldKey: 'renders', minFiles: 3, allowedMimeTypes: ['image/png'] },
  ] }, contract));
  assert.throws(() => parseCapabilityTestCase({ ...fixture, input: {
    values: {}, assets: {},
  } }, contract));
  assert.throws(() => parseCapabilityTestCase({ ...fixture, expectedFiles: [
    { fieldKey: 'renders', minFiles: 1, allowedMimeTypes: ['application/pdf'] },
  ] }, contract));
});
