import { createHash } from 'node:crypto';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { mkdir, open, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { Sha256DigestSchema } from '../../../packages/contracts/src/assets.js';
import { inspectPrivateStagedFile } from '../../../packages/sandbox-adapter/src/output-collector.js';
import type { JobFileBinding } from '../../../packages/application/src/job-instructions.js';

export interface InputDownload {
  readonly binding: JobFileBinding;
  readonly signedGetUrl: string;
  readonly expectedSha256: string;
}

export class InputStagingError extends Error {
  constructor(readonly code: 'INSECURE_ROOT' | 'INVALID_BINDING' | 'UNTRUSTED_URL' |
    'DOWNLOAD_FAILED' | 'SIZE_MISMATCH' | 'HASH_MISMATCH' | 'TYPE_MISMATCH' | 'LIMIT_EXCEEDED') {
    super(`Buyer input staging refused: ${code}`); this.name = 'InputStagingError';
  }
}

function privateRoot(path: string): string {
  if (!isAbsolute(path)) throw new InputStagingError('INSECURE_ROOT');
  const resolved = resolve(path);
  try {
    const info = lstatSync(resolved);
    if (info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o077) === 0 &&
      (typeof process.getuid !== 'function' || info.uid === process.getuid())) return realpathSync(resolved);
  } catch { /* Fail closed below. */ }
  throw new InputStagingError('INSECURE_ROOT');
}

function checkedUrl(raw: string, rawOrigin: string, allowInsecureLoopback: boolean): URL {
  let url: URL;
  let origin: URL;
  try { url = new URL(raw); origin = new URL(rawOrigin); }
  catch { throw new InputStagingError('UNTRUSTED_URL'); }
  const loopback = ['127.0.0.1', 'localhost'].includes(origin.hostname);
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password ||
    url.origin !== origin.origin || url.username || url.password || url.hash ||
    (url.protocol !== 'https:' && !(allowInsecureLoopback && loopback && url.protocol === 'http:'))) {
    throw new InputStagingError('UNTRUSTED_URL');
  }
  return url;
}

/** Caller authenticates the job offer and obtains these short-lived URLs from the cloud. */
export async function withStagedBuyerInputs<T>(options: {
  attemptRoot: string; attemptId: string; storageOrigin: string; allowInsecureLoopback?: boolean;
  downloads: readonly InputDownload[]; maxFileBytes: number; maxTotalBytes: number;
  timeoutMs: number; fetcher?: typeof fetch;
}, consume: (inputRoot: string) => Promise<T>): Promise<T> {
  const root = privateRoot(options.attemptRoot);
  const attemptId = z.uuid().parse(options.attemptId);
  if (![options.maxFileBytes, options.maxTotalBytes, options.timeoutMs].every(
    (value) => Number.isSafeInteger(value) && value > 0) || options.timeoutMs > 3_600_000 ||
    options.downloads.length > 256) throw new InputStagingError('LIMIT_EXCEEDED');
  const attempt = join(root, attemptId);
  const inputRoot = join(attempt, 'input');
  const fetcher = options.fetcher ?? fetch;
  const seenPaths = new Set<string>();
  let totalBytes = 0;
  await mkdir(attempt, { mode: 0o700 });
  try {
    await mkdir(inputRoot, { mode: 0o700 });
    for (const download of options.downloads) {
      const { binding } = download;
      const expectedSha256 = Sha256DigestSchema.parse(download.expectedSha256);
      const fieldKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).parse(binding.fieldKey);
      const assetId = z.uuid().parse(binding.assetId);
      const extension = z.string().regex(/^\.[a-z0-9]{1,16}$/).parse(binding.path.slice(
        `/job/input/${fieldKey}/${assetId}`.length));
      const expectedPath = `/job/input/${fieldKey}/${assetId}${extension}`;
      if (binding.path !== expectedPath || seenPaths.has(expectedPath) ||
        !Number.isSafeInteger(binding.sizeBytes) || binding.sizeBytes < 0 ||
        binding.sizeBytes > options.maxFileBytes) throw new InputStagingError('INVALID_BINDING');
      seenPaths.add(expectedPath);
      totalBytes += binding.sizeBytes;
      if (totalBytes > options.maxTotalBytes) throw new InputStagingError('LIMIT_EXCEEDED');
      const url = checkedUrl(download.signedGetUrl, options.storageOrigin,
        options.allowInsecureLoopback === true);
      const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs) });
      if (!response.ok || !response.body) throw new InputStagingError('DOWNLOAD_FAILED');
      const declaredLength = response.headers.get('content-length');
      if (declaredLength !== null && Number(declaredLength) !== binding.sizeBytes) {
        throw new InputStagingError('SIZE_MISMATCH');
      }
      const fieldDirectory = join(inputRoot, fieldKey);
      await mkdir(fieldDirectory, { mode: 0o700, recursive: true });
      const destination = join(fieldDirectory, `${assetId}${extension}`);
      const handle = await open(destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      const hash = createHash('sha256');
      let size = 0;
      try {
        for await (const rawChunk of Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)) {
          const chunk = Buffer.from(rawChunk);
          size += chunk.byteLength;
          if (size > binding.sizeBytes || size > options.maxFileBytes) {
            throw new InputStagingError('LIMIT_EXCEEDED');
          }
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.byteLength) {
            const written = await handle.write(chunk, offset, chunk.byteLength - offset);
            if (written.bytesWritten <= 0) throw new InputStagingError('DOWNLOAD_FAILED');
            offset += written.bytesWritten;
          }
        }
      } finally { await handle.close(); }
      if (size !== binding.sizeBytes) throw new InputStagingError('SIZE_MISMATCH');
      if (`sha256:${hash.digest('hex')}` !== expectedSha256) throw new InputStagingError('HASH_MISMATCH');
      const inspected = await inspectPrivateStagedFile(inputRoot,
        `${fieldKey}/${assetId}${extension}`, options.maxFileBytes);
      if (inspected.sizeBytes !== binding.sizeBytes || inspected.sha256 !== expectedSha256 ||
        inspected.detectedMimeType !== binding.detectedMimeType) throw new InputStagingError('TYPE_MISMATCH');
    }
    return await consume(inputRoot);
  } finally { await rm(attempt, { recursive: true, force: true }); }
}

/** Crash recovery removes only attempt directories recorded in the private
 * Worker job journal, after their sandbox containers have been stopped. */
export async function removeKnownStagedAttempts(attemptRoot:string,
  attemptIds:readonly string[]):Promise<void>{
  const root=privateRoot(attemptRoot);
  for(const rawId of new Set(attemptIds)){
    const id=z.uuid().parse(rawId);
    const path=join(root,id);
    let stat;
    try{stat=lstatSync(path);}
    catch(error){
      if(error instanceof Error&&'code' in error&&error.code==='ENOENT')continue;
      throw error;
    }
    if(!stat.isDirectory()||stat.isSymbolicLink()||
      (stat.mode&0o077)!==0||
      (typeof process.getuid==='function'&&stat.uid!==process.getuid()))
      throw new InputStagingError('INSECURE_ROOT');
    await rm(path,{recursive:true,force:false});
  }
}
