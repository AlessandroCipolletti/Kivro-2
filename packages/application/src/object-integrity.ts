import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrivateAssetObjectKeySchema, Sha256DigestSchema } from '../../contracts/src/assets.js';
import type { ObjectStoragePort } from '../../infrastructure/contracts/src/ports.js';

const requestSchema = z.strictObject({
  key: PrivateAssetObjectKeySchema,
  sizeBytes: z.number().int().nonnegative(),
  sha256: Sha256DigestSchema,
  maxAllowedBytes: z.number().int().positive(),
});

export class ObjectIntegrityError extends Error {
  constructor(readonly code: 'MISSING' | 'SIZE_MISMATCH' | 'HASH_MISMATCH' | 'LIMIT_EXCEEDED') {
    super(`Private object verification failed: ${code}`); this.name = 'ObjectIntegrityError';
  }
}

/** HEAD metadata is advisory; READY requires a fresh stream hash from private storage. */
export async function verifyStoredObject(storage: ObjectStoragePort, rawRequest: unknown): Promise<void> {
  const request = requestSchema.parse(rawRequest);
  if (request.sizeBytes > request.maxAllowedBytes) throw new ObjectIntegrityError('LIMIT_EXCEEDED');
  const head = await storage.headPrivateObject(request.key);
  if (!head) throw new ObjectIntegrityError('MISSING');
  if (head.sizeBytes !== request.sizeBytes) throw new ObjectIntegrityError('SIZE_MISMATCH');
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of await storage.readPrivateObject(request.key)) {
    size += chunk.byteLength;
    if (size > request.maxAllowedBytes || size > request.sizeBytes) throw new ObjectIntegrityError('LIMIT_EXCEEDED');
    hash.update(chunk);
  }
  if (size !== request.sizeBytes) throw new ObjectIntegrityError('SIZE_MISMATCH');
  if (`sha256:${hash.digest('hex')}` !== request.sha256) throw new ObjectIntegrityError('HASH_MISMATCH');
}
