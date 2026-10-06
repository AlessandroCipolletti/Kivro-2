import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { collectStoppedAttemptOutput } from '../dist/packages/sandbox-adapter/src/output-collector.js';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const outputContract = { schemaVersion: 1, fields: [
  { key: 'summary', label: 'Summary', order: 0, required: true, type: 'MARKDOWN' },
  { key: 'renders', label: 'Renders', order: 1, required: true, type: 'FILES', constraints: {
    minFiles: 1, maxFiles: 2, maxFileSizeBytes: 1024, maxTotalSizeBytes: 2048,
    allowedMimeTypes: ['image/png'], allowedExtensions: ['.png'],
  } },
] };
const limits = { maxFileBytes: 4096, maxResultBytes: 8192 };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kivro-output-'));
  const attemptId = randomUUID();
  const output = join(root, attemptId, 'output');
  mkdirSync(join(output, 'renders'), { recursive: true, mode: 0o700 });
  writeFileSync(join(output, 'renders', 'front.png'), png);
  const manifest = { schemaVersion: 1, fields: {
    summary: { type: 'MARKDOWN', value: '# Result' },
    renders: { type: 'FILES', paths: ['renders/front.png'] },
  } };
  const save = () => writeFileSync(join(output, 'result.json'), JSON.stringify(manifest));
  save();
  return { root, attemptId, output, manifest, save, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('stopped-attempt collector validates contract, hashes approved files and omits local paths from values', async () => {
  const f = fixture();
  try {
    const result = await collectStoppedAttemptOutput(f.root, f.attemptId, outputContract, limits);
    assert.equal(result.values.summary, '# Result');
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].relativePath, 'renders/front.png');
    assert.equal(result.files[0].detectedMimeType, 'image/png');
    assert.match(result.files[0].sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(result.values, 'renders'), false);
  } finally { f.cleanup(); }
});

test('collector refuses missing required output, undeclared fields and MIME mismatch', async () => {
  const f = fixture();
  try {
    delete f.manifest.fields.renders;
    f.save();
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, outputContract, limits),
      { code: 'INVALID_MANIFEST' });
    f.manifest.fields.renders = { type: 'FILES', paths: ['renders/front.png'] };
    f.manifest.fields.admin = { type: 'SHORT_TEXT', value: 'unsafe' };
    f.save();
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, outputContract, limits),
      { code: 'UNDECLARED_OUTPUT' });
    delete f.manifest.fields.admin;
    writeFileSync(join(f.output, 'renders', 'front.png'), Buffer.from('not a png'));
    f.save();
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, outputContract, limits),
      { code: 'UNSUPPORTED_TYPE' });
  } finally { f.cleanup(); }
});

test('collector rejects a valid JPEG disguised as PNG when both formats are allowed', async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.output, 'renders', 'front.png'), Buffer.from([255, 216, 255, 0, 1]));
    const bothFormats = JSON.parse(JSON.stringify(outputContract));
    bothFormats.fields[1].constraints.allowedMimeTypes.push('image/jpeg');
    bothFormats.fields[1].constraints.allowedExtensions.push('.jpg');
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, bothFormats, limits),
      { code: 'UNSUPPORTED_TYPE' });
  } finally { f.cleanup(); }
});

test('collector refuses symlink/hardlink escape and platform byte limit', async () => {
  const f = fixture();
  try {
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, outputContract,
      { maxFileBytes: 4096, maxResultBytes: 5 }), { code: 'LIMIT_EXCEEDED' });
    const outside = join(f.root, 'outside.png');
    writeFileSync(outside, png);
    rmSync(join(f.output, 'renders', 'front.png'));
    symlinkSync(outside, join(f.output, 'renders', 'front.png'));
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, outputContract, limits),
      { code: 'INVALID_PATH' });
    rmSync(join(f.output, 'renders', 'front.png'));
    linkSync(outside, join(f.output, 'renders', 'front.png'));
    await assert.rejects(collectStoppedAttemptOutput(f.root, f.attemptId, outputContract, limits),
      { code: 'INVALID_FILE' });
  } finally { f.cleanup(); }
});
