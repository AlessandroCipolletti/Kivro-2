import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
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

test('published optional buyer fields remain optional at input validation', () => {
  const input = { schemaVersion: 1, fields: [
    { key: 'companyName', label: 'Company name', order: 0, required: true,
      type: 'SHORT_TEXT', constraints: { maxLength: 200 } },
    { key: 'website', label: 'Website', order: 1, required: false, type: 'URL' },
    { key: 'researchQuestion', label: 'Research question', order: 2,
      required: false, type: 'SHORT_TEXT', constraints: { maxLength: 500 } },
  ] };
  assert.equal(CapabilityIOContractSchema.safeParse({contractVersion:1,input,
    output:contract.output}).success,true);
  assert.deepEqual(Object.entries(validateInputPayload(input,
    {values:{companyName:'Acme'},assets:{}}).values),[['companyName','Acme']]);
  assert.equal(validateInputPayload(input,{values:{companyName:'Acme',
    website:'https://example.org'},assets:{}}).values.website,'https://example.org');
  assert.throws(()=>validateInputPayload(input,{values:{},assets:{}}),
    {code:'MISSING_FIELD',field:'companyName'});
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

test('opt-in research sources have standard provenance without making sources mandatory', () => {
  const output={schemaVersion:1,fields:[
    {key:'analysis',label:'Analysis',order:0,required:true,type:'MARKDOWN'},
    {key:'sources',label:'Sources',order:1,required:false,type:'JSON',
      semanticType:'RESEARCH_SOURCES',maxBytes:32_768},
  ]};
  assert.equal(validateOutputPayload(output,{values:{analysis:'Useful result'},assets:{}})
    .values.sources,undefined);
  const valid=[{url:'https://example.org/research',title:'Company facts',
    accessedAt:'2026-10-08T00:00:00.000Z'}];
  assert.deepEqual(validateOutputPayload(output,{values:{analysis:'Useful result',
    sources:valid},assets:{}}).values.sources,valid);
  for(const invalid of [
    [{url:'file:///etc/passwd',accessedAt:'2026-10-08T00:00:00.000Z'}],
    [{url:'https://user:secret@example.org',accessedAt:'2026-10-08T00:00:00.000Z'}],
    [{url:'https://example.org',accessedAt:'yesterday'}],
    [{url:'https://example.org',title:'',accessedAt:'2026-10-08T00:00:00.000Z'}],
  ])assert.throws(()=>validateOutputPayload(output,{values:{analysis:'Useful result',
    sources:invalid},assets:{}}),{code:'INVALID_VALUE',field:'sources'});
});

test('the original Blender example is one versioned I/O contract without a Blender runtime dependency',()=>{
  const example=JSON.parse(readFileSync(new URL('./fixtures/m16-blender-contract.json',
    import.meta.url),'utf8'));
  const parsed=CapabilityIOContractSchema.parse(example);
  assert.equal(parsed.input.fields.find((field)=>field.key==='scene')
    .constraints.maxFileSizeBytes,524288000);
  const scene='b3451661-a538-4907-8acc-b1cf00e04899';
  const reference='4e6eb60f-075c-4df2-81df-9d983352509b';
  assert.deepEqual(validateInputPayload(parsed.input,{values:{instructions:
    'Render the product in soft studio light',resolution:'4K'},assets:{scene:[scene],
    referenceImages:[reference]}}).assets.referenceImages,[reference]);
  assert.throws(()=>validateInputPayload(parsed.input,{values:{instructions:'Render',
    resolution:'8K'},assets:{scene:[scene]}}),{code:'INVALID_VALUE',field:'resolution'});
  assert.throws(()=>validateInputPayload(parsed.input,{values:{instructions:'Render',
    resolution:'1080p'},assets:{}}),{code:'MISSING_FIELD',field:'scene'});
  assert.deepEqual(validateOutputPayload(parsed.output,{values:{},
    assets:{renderedImages:[reference]}}).assets.renderedImages,[reference]);
  assert.throws(()=>validateOutputPayload(parsed.output,{values:{},assets:{
    renderedImages:Array.from({length:11},()=>randomUUID())}}),
  {code:'INVALID_ASSET_REFERENCE',field:'renderedImages'});
  assert.throws(()=>validateOutputPayload(parsed.output,{values:{},assets:{}}),
    {code:'MISSING_FIELD',field:'renderedImages'});
});
