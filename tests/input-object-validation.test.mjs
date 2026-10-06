import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { validateUploadedInputObject } from '../dist/packages/application/src/input-object-validation.js';

const field = { key: 'image', label: 'Image', order: 0, required: true, type: 'FILE', constraints: {
  maxFiles: 1, maxFileSizeBytes: 1024, maxTotalSizeBytes: 1024,
  allowedMimeTypes: ['image/png', 'image/jpeg'], allowedExtensions: ['.png', '.jpg'],
} };
const objectKey = `private/assets/${randomUUID()}/${randomUUID()}`;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function storage(bytes, headSize = bytes.length) {
  return { async headPrivateObject() { return { sizeBytes: headSize, claimedSha256: 'sha256:claimed' }; },
    async readPrivateObject() { return (async function* () {
      yield bytes.subarray(0, 3); yield bytes.subarray(3);
    })(); } };
}

test('direct-upload finalization independently hashes and detects stored input bytes', async () => {
  const result = await validateUploadedInputObject(storage(png), { objectKey,
    fileName: 'photo.png', expectedSizeBytes: png.length, expectedSha256: sha256(png),
    maxPlatformFileBytes: 1024, field });
  assert.equal(result.detectedMimeType, 'image/png');
  await assert.rejects(validateUploadedInputObject(storage(png), { objectKey,
    fileName: 'photo.jpg', expectedSizeBytes: png.length, expectedSha256: sha256(png),
    maxPlatformFileBytes: 1024, field }), { code: 'UNSUPPORTED_TYPE' });
  await assert.rejects(validateUploadedInputObject(storage(png), { objectKey,
    fileName: 'photo.png', expectedSizeBytes: png.length, expectedSha256: sha256(Buffer.from('other')),
    maxPlatformFileBytes: 1024, field }), { code: 'HASH_MISMATCH' });
  await assert.rejects(validateUploadedInputObject(storage(png, png.length + 1), { objectKey,
    fileName: 'photo.png', expectedSizeBytes: png.length, expectedSha256: sha256(png),
    maxPlatformFileBytes: 1024, field }), { code: 'SIZE_MISMATCH' });
});

test('direct-upload JSON validation rejects invalid content after streaming', async () => {
  const jsonField = { ...field, key: 'dataset', label: 'Dataset', constraints: {
    ...field.constraints, allowedMimeTypes: ['application/json'], allowedExtensions: ['.json'],
  } };
  const valid = Buffer.from('{"rows":[1,2]}');
  assert.equal((await validateUploadedInputObject(storage(valid), { objectKey,
    fileName: 'data.json', expectedSizeBytes: valid.length, expectedSha256: sha256(valid),
    maxPlatformFileBytes: 1024, field: jsonField })).detectedMimeType, 'application/json');
  const invalid = Buffer.from('{bad');
  await assert.rejects(validateUploadedInputObject(storage(invalid), { objectKey,
    fileName: 'data.json', expectedSizeBytes: invalid.length, expectedSha256: sha256(invalid),
    maxPlatformFileBytes: 1024, field: jsonField }), { code: 'UNSUPPORTED_TYPE' });
});
