import assert from 'node:assert/strict';
import test from 'node:test';
import { CapabilityIOContractSchema } from '../dist/packages/contracts/src/capability-io.js';
import { validateInputPayload, validateOutputPayload } from '../dist/packages/contracts/src/contract-values.js';

const assetId = 'b3451661-a538-4907-8acc-b1cf00e04899';
const text = (key, order, required = true) => ({ key, label: key, order, required, type: 'SHORT_TEXT' });
const contract = {
  contractVersion: 1,
  input: { schemaVersion: 1, fields: [
    text('instructions', 0),
    { key: 'mode', label: 'Mode', order: 1, required: true, type: 'SELECT', constraints: { allowedValues: ['text', 'video'] } },
    { key: 'video', label: 'Video', order: 2, required: true, type: 'FILE', visibleWhen: { fieldKey: 'mode', equals: 'video' }, constraints: {
      maxFiles: 1, maxFileSizeBytes: 20_000_000, maxTotalSizeBytes: 20_000_000,
      allowedMimeTypes: ['video/mp4'], allowedExtensions: ['.mp4'],
    } },
  ] },
  output: { schemaVersion: 1, fields: [
    { key: 'summary', label: 'Summary', order: 0, required: true, type: 'MARKDOWN' },
  ] },
};

test('one versioned contract validates both input and output shapes', () => {
  assert.equal(CapabilityIOContractSchema.safeParse(contract).success, true);
  const payload = validateInputPayload(contract.input, { values: { instructions: 'Analyze this', mode: 'text' }, assets: {} });
  assert.equal(payload.values.instructions, 'Analyze this');
  assert.equal(validateOutputPayload(contract.output, { values: { summary: '# Result' }, assets: {} }).values.summary, '# Result');
  assert.equal(CapabilityIOContractSchema.safeParse({ ...contract, contractVersion: 2 }).success, false);
});

test('contract rejects duplicate keys, impossible conditions, and unbounded file fields', () => {
  assert.equal(CapabilityIOContractSchema.safeParse({ ...contract, input: { schemaVersion: 1, fields: [text('x', 0), text('x', 1)] } }).success, false);
  assert.equal(CapabilityIOContractSchema.safeParse({ ...contract, input: { schemaVersion: 1, fields: [text('x', 0), { ...text('y', 1), visibleWhen: { fieldKey: 'missing', equals: true } }] } }).success, false);
  assert.equal(CapabilityIOContractSchema.safeParse({ ...contract, input: { schemaVersion: 1, fields: [{ key: 'upload', label: 'Upload', order: 0, required: true, type: 'FILE' }] } }).success, false);
  const impossibleChoice = JSON.parse(JSON.stringify(contract));
  impossibleChoice.input.fields[2].visibleWhen.equals = 'audio';
  assert.equal(CapabilityIOContractSchema.safeParse(impossibleChoice).success, false);
  const wrongType = JSON.parse(JSON.stringify(contract));
  wrongType.input.fields[2].visibleWhen.equals = true;
  assert.equal(CapabilityIOContractSchema.safeParse(wrongType).success, false);
});

test('server validation rejects hidden, missing, unknown, malformed and duplicate asset inputs', () => {
  const base = { values: { instructions: 'Analyze this', mode: 'video' }, assets: { video: [assetId] } };
  assert.deepEqual(validateInputPayload(contract.input, base).assets.video, [assetId]);
  assert.throws(() => validateInputPayload(contract.input, { ...base, assets: {} }), { code: 'MISSING_FIELD', field: 'video' });
  assert.throws(() => validateInputPayload(contract.input, { ...base, values: { ...base.values, mode: 'text' } }), { code: 'HIDDEN_FIELD', field: 'video' });
  assert.throws(() => validateInputPayload(contract.input, { ...base, values: { ...base.values, admin: true } }), { code: 'UNKNOWN_FIELD', field: 'admin' });
  assert.throws(() => validateInputPayload(contract.input, { ...base, assets: { video: [assetId, assetId] } }), { code: 'INVALID_ASSET_REFERENCE', field: 'video' });
  assert.throws(() => validateInputPayload(contract.input, { ...base, values: { ...base.values, instructions: '' } }), { code: 'INVALID_VALUE', field: 'instructions' });
});

test('URL fields accept only credential-free HTTP(S) syntax; JSON fields reject unsafe structures', () => {
  const input = { schemaVersion: 1, fields: [
    { key: 'website', label: 'Website', order: 0, required: true, type: 'URL' },
    { key: 'data', label: 'Data', order: 1, required: true, type: 'JSON', maxBytes: 1024 },
  ] };
  assert.equal(validateInputPayload(input, { values: { website: 'https://example.com', data: { score: 1 } }, assets: {} }).values.website, 'https://example.com');
  assert.throws(() => validateInputPayload(input, { values: { website: 'file:///etc/passwd', data: {} }, assets: {} }), { code: 'INVALID_VALUE', field: 'website' });
  assert.throws(() => validateInputPayload(input, { values: { website: 'https://user:pass@example.com', data: {} }, assets: {} }), { code: 'INVALID_VALUE', field: 'website' });
  const unsafe = JSON.parse('{"__proto__":{"isAdmin":true}}');
  assert.throws(() => validateInputPayload(input, { values: { website: 'https://example.com', data: unsafe }, assets: {} }), { code: 'INVALID_VALUE', field: 'data' });
});

test('published scalar defaults fill omitted fields but cannot hide file or invalid choice input', () => {
  const input = { schemaVersion: 1, fields: [
    { key: 'resolution', label: 'Resolution', order: 0, required: true, type: 'SELECT',
      constraints: { allowedValues: ['1080p', '4K'] }, defaultValue: '1080p' },
    { key: 'variants', label: 'Variants', order: 1, required: true, type: 'INTEGER',
      constraints: { minimum: 1, maximum: 10 }, defaultValue: 1 },
  ] };
  assert.equal(validateInputPayload(input, { values: {}, assets: {} }).values.resolution, '1080p');
  assert.equal(validateInputPayload(input, { values: {}, assets: {} }).values.variants, 1);
  assert.equal(CapabilityIOContractSchema.safeParse({ contractVersion: 1, input: {
    ...input, fields: [{ ...input.fields[0], defaultValue: '8K' }, input.fields[1]],
  }, output: contract.output }).success, false);
  assert.equal(CapabilityIOContractSchema.safeParse({ contractVersion: 1, input: {
    ...contract.input, fields: [{ ...contract.input.fields[2], defaultValue: 'asset-id' }],
  }, output: contract.output }).success, false);
});
