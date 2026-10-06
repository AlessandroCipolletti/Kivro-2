import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { verifyStoredObject } from '../dist/packages/application/src/object-integrity.js';

const key = `private/assets/${randomUUID()}/${randomUUID()}`;
const bytes = Buffer.from('private fixture');
const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const request = { key, sizeBytes: bytes.length, sha256, maxAllowedBytes: 1024 };
function storage(body, headSize = body?.length ?? 0) {
  return { headPrivateObject: async () => body === null ? null : { sizeBytes: headSize, claimedSha256: sha256 },
    readPrivateObject: async () => (async function* () { if (body) yield body; })() };
}

test('private object must match bytes and hash, never just claimed HEAD metadata', async () => {
  await verifyStoredObject(storage(bytes), request);
  await assert.rejects(verifyStoredObject(storage(null), request), { code: 'MISSING' });
  await assert.rejects(verifyStoredObject(storage(bytes, bytes.length - 1), request), { code: 'SIZE_MISMATCH' });
  await assert.rejects(verifyStoredObject(storage(Buffer.from('different bytes')), request),
    { code: 'HASH_MISMATCH' });
  await assert.rejects(verifyStoredObject(storage(bytes), { ...request, maxAllowedBytes: 5 }),
    { code: 'LIMIT_EXCEEDED' });
});
