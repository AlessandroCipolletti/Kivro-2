import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { InputContractSchema } from '../dist/packages/contracts/src/capability-io.js';
import { effectiveFileCeilings, PLATFORM_FILE_LIMITS } from '../dist/packages/contracts/src/file-limits.js';
import { fileConstraintsFromPreset } from '../dist/packages/contracts/src/media-presets.js';
import { detectFileMime, isMatchingFileType } from '../dist/packages/contracts/src/file-types.js';

test('common presets compile to the same bounded formal file contract', () => {
  const constraints = fileConstraintsFromPreset('IMAGES', 10, 25_000_000);
  assert.equal(InputContractSchema.safeParse({ schemaVersion: 1, fields: [
    { key: 'references', label: 'References', order: 0, required: false, type: 'FILES', constraints },
  ] }).success, true);
  assert.ok(constraints.allowedMimeTypes.includes('image/png'));
  assert.ok(constraints.allowedExtensions.includes('.webp'));
  assert.ok(fileConstraintsFromPreset('VIDEO', 1, 1000).allowedExtensions.includes('.webm'));
  assert.ok(fileConstraintsFromPreset('AUDIO', 1, 1000).allowedExtensions.includes('.mp3'));
  assert.ok(fileConstraintsFromPreset('AUDIO', 1, 1000).allowedExtensions.includes('.m4a'));
  assert.throws(() => fileConstraintsFromPreset('IMAGES', 51, 1));
  assert.throws(() => fileConstraintsFromPreset('IMAGES', 1, PLATFORM_FILE_LIMITS.maxSingleFileBytes + 1));
  assert.equal(isMatchingFileType('photo.png', 'image/jpeg', constraints.allowedMimeTypes,
    constraints.allowedExtensions), false);
  assert.equal(detectFileMime(Buffer.from([255, 216, 255]), 'photo.png'), 'image/jpeg');
  assert.equal(detectFileMime(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84,
    0x77, 0x65, 0x62, 0x6d]), 'movie.webm'), 'video/webm');
  assert.equal(detectFileMime(Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00]), 'audio.mp3'), 'audio/mpeg');
  assert.equal(detectFileMime(Buffer.from([0xff, 0xfb, 0x90, 0x64]), 'audio.mp3'), 'audio/mpeg');
  assert.equal(detectFileMime(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x4d, 0x34, 0x41, 0x20]), 'audio.m4a'), 'audio/mp4');
  assert.equal(detectFileMime(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x65, 0x76, 0x69, 0x6c]), 'movie.mp4'), null);
});

test('effective safety limits are the stricter of seller and platform choices', () => {
  const ceilings = effectiveFileCeilings({ maxFileSizeBytes: 500_000_000, maxTotalSizeBytes: 1_000_000_000,
    maxFiles: 2 }, PLATFORM_FILE_LIMITS);
  assert.deepEqual(ceilings, { maxFileSizeBytes: 500_000_000, maxTotalSizeBytes: 1_000_000_000, maxFiles: 2 });
  assert.equal(effectiveFileCeilings({ maxFileSizeBytes: 2_000_000_000,
    maxTotalSizeBytes: 10_000_000_000, maxFiles: 100 }, PLATFORM_FILE_LIMITS).maxFiles, 50);
  assert.throws(() => effectiveFileCeilings({ maxFileSizeBytes: -1,
    maxTotalSizeBytes: 10_000_000, maxFiles: 1 }, PLATFORM_FILE_LIMITS));
});
