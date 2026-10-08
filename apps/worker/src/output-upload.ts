import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
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
  constructor(readonly code: 'INVALID_SOURCE' | 'LIMIT_EXCEEDED' | 'UPLOAD_FAILED',
    cause?: Error) {
    super(`Output upload refused: ${code}`, { cause }); this.name = 'OutputUploadError';
  }
}

/** Files exist only during the sandbox consumer callback; this function does not commit delivery. */
export async function uploadValidatedOutput(storage: ObjectStoragePort | null, raw: {
  ownerAccountId: string; sourceJobId: string; retainUntil: string; maxTotalBytes: number;
  outputRoot: string; outputContract: unknown; collected: CollectedLocalResult;
  storageOrigin?:string;allowInsecureLoopback?:boolean;
  uploadFetcher?:typeof fetch;
  prepareAsset?:(asset:{assetId:string;fieldKey:string;extension:string;sizeBytes:number;
    sha256:string;detectedMimeType:string})=>Promise<{assetId:string;objectKey:string;
      uploadUrl:string;uploadHeaders:Readonly<Record<string,string>>}>;
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
      const id = randomUUID();
      const prepared=raw.prepareAsset?await raw.prepareAsset({assetId:id,fieldKey:file.fieldKey,
        extension:extname(file.relativePath).toLowerCase(),sizeBytes:file.sizeBytes,
        sha256:file.sha256,detectedMimeType:file.detectedMimeType}):null;
      if(prepared&&(prepared.assetId!==id||prepared.objectKey.split('/')[2]!==id))
        throw new OutputUploadError('UPLOAD_FAILED');
      const objectKey=prepared?.objectKey??newPrivateAssetKey(id);
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const before = await handle.stat();
        if (!before.isFile() || before.nlink !== 1 || before.size !== file.sizeBytes) {
          throw new OutputUploadError('INVALID_SOURCE');
        }
        if(prepared){
          if(!raw.storageOrigin)throw new OutputUploadError('UPLOAD_FAILED');
          const destination=new URL(prepared.uploadUrl),allowed=new URL(raw.storageOrigin);
          const loopback=['127.0.0.1','::1','localhost'].includes(destination.hostname);
          if(destination.origin!==allowed.origin||
            (destination.protocol!=='https:'&&!(raw.allowInsecureLoopback&&loopback)))
            throw new OutputUploadError('UPLOAD_FAILED');
          const response=await (raw.uploadFetcher??fetch)(destination,{method:'PUT',redirect:'manual',
            headers:prepared.uploadHeaders,
            body:handle.createReadStream({autoClose:false}) as unknown as RequestInit['body'],
            duplex:'half',signal:AbortSignal.timeout(600_000)} as RequestInit & {duplex:'half'});
          if(!response.ok)throw new OutputUploadError('UPLOAD_FAILED',
            new Error(`Private object upload returned HTTP ${response.status}`));
        }else{
          if(!storage)throw new OutputUploadError('UPLOAD_FAILED');
          createdKeys.push(objectKey);
          await storage.putPrivateObject(objectKey, handle.createReadStream({ autoClose: false }), {
            contentType: file.detectedMimeType, sizeBytes: file.sizeBytes, sha256: file.sha256,
          });
        }
        const after = await handle.stat();
        if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
          throw new OutputUploadError('INVALID_SOURCE');
        }
      } finally { await handle.close(); }
      if(!prepared&&storage)await verifyStoredObject(storage, { key: objectKey, sizeBytes: file.sizeBytes,
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
    await Promise.allSettled(createdKeys.map((key) => storage!.deletePrivateObject(key)));
    if (error instanceof OutputUploadError) throw error;
    throw new OutputUploadError('UPLOAD_FAILED');
  }
}
