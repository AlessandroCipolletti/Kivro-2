import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFileContractReadiness } from '../dist/packages/domain/src/io-readiness.js';

function contract(mime, extension) {
  return { contractVersion: 1,
    input: { schemaVersion: 1, fields: [{ key: 'source', label: 'Source', order: 0,
      required: true, type: 'FILE', constraints: { maxFiles: 1, maxFileSizeBytes: 1000,
        maxTotalSizeBytes: 1000, allowedMimeTypes: [mime], allowedExtensions: [extension] } }] },
    output: { schemaVersion: 1, fields: [{ key: 'result', label: 'Result', order: 0,
      required: true, type: 'SHORT_TEXT' }] } };
}

test('publication readiness identifies unsupported archives and disconnected MIME/extension declarations', () => {
  assert.deepEqual(assessFileContractReadiness(contract('image/png', '.png')), []);
  assert.deepEqual(assessFileContractReadiness(contract('application/zip', '.zip')).map((issue) => issue.code),
    ['UNSUPPORTED_MIME', 'UNSUPPORTED_EXTENSION']);
  assert.deepEqual(assessFileContractReadiness(contract('image/png', '.jpg')).map((issue) => issue.code),
    ['MIME_EXTENSION_DISCONNECT', 'MIME_EXTENSION_DISCONNECT']);
});
