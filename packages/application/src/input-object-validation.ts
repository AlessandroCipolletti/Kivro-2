import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Sha256DigestSchema, PrivateAssetObjectKeySchema } from '../../contracts/src/assets.js';
import { InputFieldSchema } from '../../contracts/src/capability-io.js';
import { detectFileMime, isMatchingFileType } from '../../contracts/src/file-types.js';
import type { ObjectStoragePort } from '../../infrastructure/contracts/src/ports.js';

const fileNameSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const jsonLimit = 1_048_576;

export class InputObjectValidationError extends Error {
  constructor(readonly code: 'INVALID_FIELD' | 'MISSING_OBJECT' | 'SIZE_MISMATCH' |
    'HASH_MISMATCH' | 'UNSUPPORTED_TYPE' | 'LIMIT_EXCEEDED') {
    super(`Input object validation refused: ${code}`);
    this.name = 'InputObjectValidationError';
  }
}

/** Run after direct upload and before changing a private input asset to READY. */
export async function validateUploadedInputObject(storage: ObjectStoragePort, raw: {
  objectKey: string; fileName: string; expectedSizeBytes: number; expectedSha256: string;
  maxPlatformFileBytes: number; field: unknown;
}): Promise<{ sizeBytes: number; sha256: `sha256:${string}`; detectedMimeType: string }> {
  const objectKey = PrivateAssetObjectKeySchema.parse(raw.objectKey);
  const fileName = fileNameSchema.parse(raw.fileName);
  const expectedSha256 = Sha256DigestSchema.parse(raw.expectedSha256);
  const parsedField = InputFieldSchema.safeParse(raw.field);
  if (!parsedField.success || (parsedField.data.type !== 'FILE' && parsedField.data.type !== 'FILES')) {
    throw new InputObjectValidationError('INVALID_FIELD');
  }
  const field = parsedField.data;
  if (!Number.isSafeInteger(raw.expectedSizeBytes) || raw.expectedSizeBytes < 0 ||
    !Number.isSafeInteger(raw.maxPlatformFileBytes) || raw.maxPlatformFileBytes < 1 ||
    raw.expectedSizeBytes > Math.min(field.constraints.maxFileSizeBytes, raw.maxPlatformFileBytes)) {
    throw new InputObjectValidationError('LIMIT_EXCEEDED');
  }
  const head = await storage.headPrivateObject(objectKey);
  if (!head) throw new InputObjectValidationError('MISSING_OBJECT');
  if (head.sizeBytes !== raw.expectedSizeBytes) throw new InputObjectValidationError('SIZE_MISMATCH');
  const hash = createHash('sha256');
  const header = Buffer.alloc(Math.min(raw.expectedSizeBytes, 4096));
  let headerLength = 0;
  let bytesRead = 0;
  let utf8Valid = true;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const jsonChunks: Buffer[] = [];
  for await (const rawChunk of await storage.readPrivateObject(objectKey)) {
    const chunk = Buffer.from(rawChunk);
    bytesRead += chunk.byteLength;
    if (bytesRead > raw.expectedSizeBytes || bytesRead > raw.maxPlatformFileBytes) {
      throw new InputObjectValidationError('LIMIT_EXCEEDED');
    }
    hash.update(chunk);
    if (headerLength < header.length) {
      const copied = chunk.copy(header, headerLength, 0, header.length - headerLength);
      headerLength += copied;
    }
    if (utf8Valid) {
      if (chunk.includes(0)) utf8Valid = false;
      else {
        try { decoder.decode(chunk, { stream: true }); }
        catch { utf8Valid = false; }
      }
    }
    if (fileName.toLowerCase().endsWith('.json')) {
      if (bytesRead > jsonLimit) throw new InputObjectValidationError('LIMIT_EXCEEDED');
      jsonChunks.push(chunk);
    }
  }
  if (bytesRead !== raw.expectedSizeBytes) throw new InputObjectValidationError('SIZE_MISMATCH');
  if (`sha256:${hash.digest('hex')}` !== expectedSha256) throw new InputObjectValidationError('HASH_MISMATCH');
  const detectedMimeType = detectFileMime(header.subarray(0, headerLength), fileName);
  if (!detectedMimeType || !isMatchingFileType(fileName, detectedMimeType,
    field.constraints.allowedMimeTypes, field.constraints.allowedExtensions)) {
    throw new InputObjectValidationError('UNSUPPORTED_TYPE');
  }
  if (['text/plain', 'text/markdown', 'text/csv', 'application/json', 'model/obj'].includes(detectedMimeType)) {
    if (!utf8Valid) throw new InputObjectValidationError('UNSUPPORTED_TYPE');
    try { decoder.decode(); } catch { throw new InputObjectValidationError('UNSUPPORTED_TYPE'); }
  }
  if (detectedMimeType === 'application/json') {
    try { JSON.parse(Buffer.concat(jsonChunks).toString('utf8')); }
    catch { throw new InputObjectValidationError('UNSUPPORTED_TYPE'); }
  }
  return Object.freeze({ sizeBytes: bytesRead, sha256: expectedSha256 as `sha256:${string}`,
    detectedMimeType });
}
