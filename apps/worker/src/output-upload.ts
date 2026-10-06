import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { newPrivateAssetKey } from '../../../packages/contracts/src/assets.js';
import { validateOutputPayload, type ContractPayload } from '../../../packages/contracts/src/contract-values.js';
import { canonicalOutputPath } from '../../../packages/contracts/src/local-result.js';
import type { CollectedLocalResult } from '../../../packages/sandbox-adapter/src/output-collector.js';
import { verifyStoredObject } from '../../../packages/application/src/object-integrity.js';
import type { ObjectStoragePort } from '../../../packages/infrastructure/contracts/src/ports.js';

export interface VerifiedOutputAsset {
  readonly id: string;
  readonly fieldKey: string;
  readonly ownerAccountId: string;
  readonly sourceJobId: string;
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly sha256: `sha256:${string}`;
  readonly detectedMimeType: string;
  readonly retainUntil: string;
}

export interface VerifiedOutputUpload {
  readonly payload: ContractPayload;
  readonly assets: readonly VerifiedOutputAsset[];
}

export class OutputUploadError extends Error {
  constructor(readonly code: 'INVALID_SOURCE' | 'LIMIT_EXCEEDED' | 'UPLOAD_FAILED') {
    super(`Output upload refused: ${code}`); this.name = 'OutputUploadError';
  }
}

/** Files exist only during the sandbox consumer callback; this function does not commit delivery. */
export async function uploadValidatedOutput(storage: ObjectStoragePort, raw: {
  ownerAccountId: string; sourceJobId: string; retainUntil: string; maxTotalBytes: number;
  outputRoot: string; outputContract: unknown; collected: CollectedLocalResult;
}): Promise<VerifiedOutputUpload> {
  const ownerAccountId = z.uuid().parse(raw.ownerAccountId);
  const sourceJobId = z.uuid().parse(raw.sourceJobId);
  const retainUntil = z.iso.datetime({ offset: true }).parse(raw.retainUntil);
  if (Date.parse(retainUntil) <= Date.now()) throw new OutputUploadError('INVALID_SOURCE');
  if (!Number.isSafeInteger(raw.maxTotalBytes) || raw.maxTotalBytes < 1) {
    throw new OutputUploadError('LIMIT_EXCEEDED');
  }
  const root = await realpath(raw.outputRoot);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || (rootInfo.mode & 0o077) !== 0) {
    throw new OutputUploadError('INVALID_SOURCE');
  }
  const createdKeys: string[] = [];
  const assets: VerifiedOutputAsset[] = [];
  const references: Record<string, string[]> = Object.create(null);
  let totalBytes = 0;
  try {
    for (const file of raw.collected.files) {
      totalBytes += file.sizeBytes;
      if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0 || totalBytes > raw.maxTotalBytes) {
        throw new OutputUploadError('LIMIT_EXCEEDED');
      }
      const path = join(root, canonicalOutputPath(file.relativePath));
      const real = await realpath(path);
      const rel = relative(root, real);
      if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) {
        throw new OutputUploadError('INVALID_SOURCE');
      }
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const id = randomUUID();
      const objectKey = newPrivateAssetKey(id);
      try {
        const before = await handle.stat();
        if (!before.isFile() || before.nlink !== 1 || before.size !== file.sizeBytes) {
          throw new OutputUploadError('INVALID_SOURCE');
        }
        createdKeys.push(objectKey);
        await storage.putPrivateObject(objectKey, handle.createReadStream({ autoClose: false }), {
          contentType: file.detectedMimeType, sizeBytes: file.sizeBytes, sha256: file.sha256,
        });
        const after = await handle.stat();
        if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
          throw new OutputUploadError('INVALID_SOURCE');
        }
      } finally { await handle.close(); }
      await verifyStoredObject(storage, { key: objectKey, sizeBytes: file.sizeBytes,
        sha256: file.sha256, maxAllowedBytes: raw.maxTotalBytes });
      assets.push(Object.freeze({ id, fieldKey: file.fieldKey, ownerAccountId, sourceJobId,
        objectKey, sizeBytes: file.sizeBytes, sha256: file.sha256,
        detectedMimeType: file.detectedMimeType, retainUntil }));
      (references[file.fieldKey] ??= []).push(id);
    }
    const payload = validateOutputPayload(raw.outputContract,
      { values: raw.collected.values, assets: references });
    return Object.freeze({ payload, assets: Object.freeze(assets) });
  } catch (error) {
    await Promise.allSettled(createdKeys.map((key) => storage.deletePrivateObject(key)));
    if (error instanceof OutputUploadError) throw error;
    throw new OutputUploadError('UPLOAD_FAILED');
  }
}
