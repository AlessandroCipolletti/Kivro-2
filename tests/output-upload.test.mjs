import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { uploadValidatedOutput } from '../dist/apps/worker/src/output-upload.js';
import { collectStoppedAttemptOutput } from '../dist/packages/sandbox-adapter/src/output-collector.js';

const outputContract = { schemaVersion: 1, fields: [
  { key: 'message', label: 'Message', order: 0, required: true, type: 'SHORT_TEXT' },
  { key: 'file', label: 'File', order: 1, required: true, type: 'FILE', constraints: {
    maxFiles: 1, maxFileSizeBytes: 1024, maxTotalSizeBytes: 1024,
    allowedMimeTypes: ['text/plain'], allowedExtensions: ['.txt'],
  } },
] };
const retainUntil = new Date(Date.now() + 86_400_000).toISOString();

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kivro-upload-'));
  const attemptId = randomUUID();
  const output = join(root, attemptId, 'output');
  mkdirSync(output, { recursive: true, mode: 0o700 });
  writeFileSync(join(output, 'note.txt'), 'hello');
  writeFileSync(join(output, 'result.json'), JSON.stringify({ schemaVersion: 1, fields: {
    message: { type: 'SHORT_TEXT', value: 'ok' }, file: { type: 'FILE', path: 'note.txt' },
  } }));
  return { root, attemptId, output, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function memoryStorage(corrupt = false) {
  const objects = new Map();
  return { objects,
    async putPrivateObject(key, body, options) {
      const chunks = [];
      for await (const part of body) chunks.push(Buffer.from(part));
      const bytes = Buffer.concat(chunks);
      assert.equal(bytes.length, options.sizeBytes);
      assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, options.sha256);
      objects.set(key, corrupt ? Buffer.from('changed') : bytes);
    },
    async headPrivateObject(key) {
      const bytes = objects.get(key);
      return bytes ? { sizeBytes: bytes.length, claimedSha256: null } : null;
    },
    async readPrivateObject(key) {
      const bytes = objects.get(key);
      return (async function* () { if (bytes) yield bytes; })();
    },
    async deletePrivateObject(key) { objects.delete(key); },
  };
}

test('Worker streams only validated output to private storage and returns a job-scoped manifest', async () => {
  const f = fixture();
  try {
    const collected = await collectStoppedAttemptOutput(f.root, f.attemptId, outputContract,
      { maxFileBytes: 1024, maxResultBytes: 4096 });
    const storage = memoryStorage();
    const ownerAccountId = randomUUID();
    const sourceJobId = randomUUID();
    const uploaded = await uploadValidatedOutput(storage, { ownerAccountId, sourceJobId,
      retainUntil, maxTotalBytes: 4096,
      outputRoot: f.output, outputContract, collected });
    assert.equal(uploaded.assets.length, 1);
    assert.equal(uploaded.assets[0].ownerAccountId, ownerAccountId);
    assert.equal(uploaded.assets[0].sourceJobId, sourceJobId);
    assert.equal(uploaded.payload.values.message, 'ok');
    assert.deepEqual(uploaded.payload.assets.file, [uploaded.assets[0].id]);
    assert.match(uploaded.assets[0].objectKey, /^private\/assets\//);
    assert.equal(storage.objects.size, 1);
  } finally { f.cleanup(); }
});

test('Worker refuses a corrupt stored object and removes its tentative upload', async () => {
  const f = fixture();
  try {
    const collected = await collectStoppedAttemptOutput(f.root, f.attemptId, outputContract,
      { maxFileBytes: 1024, maxResultBytes: 4096 });
    const storage = memoryStorage(true);
    await assert.rejects(uploadValidatedOutput(storage, { ownerAccountId: randomUUID(),
      sourceJobId: randomUUID(), retainUntil, maxTotalBytes: 4096,
      outputRoot: f.output, outputContract, collected }), { code: 'UPLOAD_FAILED' });
    assert.equal(storage.objects.size, 0);
  } finally { f.cleanup(); }
});
