import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { OutputContractSchema, type OutputContract } from '../../contracts/src/capability-io.js';
import { validateOutputPayload } from '../../contracts/src/contract-values.js';
import { canonicalOutputPath, parseLocalResultManifest } from '../../contracts/src/local-result.js';
import { detectFileMime, isMatchingFileType } from '../../contracts/src/file-types.js';

const attemptIdSchema = z.uuid();
const manifestLimit = 262_144;

export class OutputCollectionError extends Error {
  constructor(readonly code: 'INSECURE_ROOT' | 'INVALID_MANIFEST' | 'INVALID_PATH' |
    'UNDECLARED_OUTPUT' | 'INVALID_FILE' | 'UNSUPPORTED_TYPE' | 'LIMIT_EXCEEDED') {
    super(`Output collection refused: ${code}`); this.name = 'OutputCollectionError';
  }
}

export interface CollectedFile {
  readonly fieldKey: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly sha256: `sha256:${string}`;
  readonly detectedMimeType: string;
}

export interface CollectedLocalResult {
  readonly values: Readonly<Record<string, unknown>>;
  readonly files: readonly CollectedFile[];
}

export interface PlatformFileLimits {
  readonly maxFileBytes: number;
  readonly maxResultBytes: number;
}

async function privateDirectory(path: string): Promise<string> {
  try {
    const info = await lstat(path);
    if (info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o077) === 0 &&
      (typeof process.getuid !== 'function' || info.uid === process.getuid())) return realpath(path);
  } catch { /* Fail with a sanitized code. */ }
  throw new OutputCollectionError('INSECURE_ROOT');
}

function contained(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\');
}

async function boundedRegularFile(path: string, maxBytes: number): Promise<{ bytes: Buffer; size: number }> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > maxBytes) throw new OutputCollectionError('INVALID_FILE');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.byteLength !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs) {
      throw new OutputCollectionError('INVALID_FILE');
    }
    return { bytes, size: info.size };
  } catch (error) {
    if (error instanceof OutputCollectionError) throw error;
    throw new OutputCollectionError('INVALID_FILE');
  } finally { await handle?.close(); }
}

/** Inspect a stopped, private staging tree without following links or trusting filename MIME. */
export async function inspectPrivateStagedFile(outputRoot: string, relPath: string, maxBytes: number): Promise<{
  sizeBytes: number; sha256: `sha256:${string}`; detectedMimeType: string;
}> {
  const canonical = canonicalOutputPath(relPath);
  const parts = canonical.split('/');
  let current = outputRoot;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = join(current, parts[i]!);
    const info = await lstat(current).catch(() => { throw new OutputCollectionError('INVALID_PATH'); });
    if (!info.isDirectory() || info.isSymbolicLink()) throw new OutputCollectionError('INVALID_PATH');
  }
  const path = join(outputRoot, canonical);
  const real = await realpath(path).catch(() => { throw new OutputCollectionError('INVALID_PATH'); });
  if (!contained(outputRoot, real)) throw new OutputCollectionError('INVALID_PATH');
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > maxBytes) {
      throw new OutputCollectionError('INVALID_FILE');
    }
    const header = Buffer.alloc(Math.min(before.size, 4096));
    let headerSize = 0;
    while (headerSize < header.length) {
      const read = await handle.read(header, headerSize, header.length - headerSize, headerSize);
      if (read.bytesRead === 0) break;
      headerSize += read.bytesRead;
    }
    const detectedMimeType = detectFileMime(header.subarray(0, headerSize), canonical);
    if (!detectedMimeType) throw new OutputCollectionError('UNSUPPORTED_TYPE');
    const textual = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'model/obj'].includes(detectedMimeType);
    if (detectedMimeType === 'application/json' && before.size > 1_048_576) {
      throw new OutputCollectionError('LIMIT_EXCEEDED');
    }
    const decoder = textual ? new TextDecoder('utf-8', { fatal: true }) : null;
    const jsonChunks: Buffer[] = [];
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      if (size > maxBytes) throw new OutputCollectionError('LIMIT_EXCEEDED');
      hash.update(bytes);
      if (textual) {
        if (bytes.includes(0)) throw new OutputCollectionError('UNSUPPORTED_TYPE');
        try { decoder!.decode(bytes, { stream: true }); }
        catch { throw new OutputCollectionError('UNSUPPORTED_TYPE'); }
      }
      if (detectedMimeType === 'application/json') jsonChunks.push(bytes);
    }
    if (decoder) {
      try { decoder.decode(); } catch { throw new OutputCollectionError('UNSUPPORTED_TYPE'); }
    }
    if (detectedMimeType === 'application/json') {
      try { JSON.parse(Buffer.concat(jsonChunks).toString('utf8')); }
      catch { throw new OutputCollectionError('UNSUPPORTED_TYPE'); }
    }
    const after = await handle.stat();
    if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new OutputCollectionError('INVALID_FILE');
    }
    return { sizeBytes: size, sha256: `sha256:${hash.digest('hex')}`, detectedMimeType };
  } catch (error) {
    if (error instanceof OutputCollectionError) throw error;
    throw new OutputCollectionError('INVALID_FILE');
  } finally { await handle?.close(); }
}

/** Only call after the sandbox has stopped; no untrusted process may mutate output during collection. */
export async function collectStoppedAttemptOutput(attemptRoot: string, attemptId: string,
  rawContract: unknown, limits: PlatformFileLimits): Promise<CollectedLocalResult> {
  attemptIdSchema.parse(attemptId);
  if (!Number.isSafeInteger(limits.maxFileBytes) || limits.maxFileBytes <= 0 ||
    !Number.isSafeInteger(limits.maxResultBytes) || limits.maxResultBytes <= 0) {
    throw new OutputCollectionError('LIMIT_EXCEEDED');
  }
  const contract: OutputContract = OutputContractSchema.parse(rawContract);
  const root = await privateDirectory(resolve(attemptRoot));
  const attempt = await privateDirectory(join(root, attemptId));
  const outputPath = join(attempt, 'output');
  const outputInfo = await lstat(outputPath).catch(() => { throw new OutputCollectionError('INSECURE_ROOT'); });
  if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink()) throw new OutputCollectionError('INSECURE_ROOT');
  const outputRoot = await realpath(outputPath);
  if (!contained(attempt, outputRoot)) throw new OutputCollectionError('INSECURE_ROOT');
  let manifest;
  try {
    const { bytes } = await boundedRegularFile(join(outputRoot, 'result.json'), manifestLimit);
    manifest = parseLocalResultManifest(JSON.parse(bytes.toString('utf8')) as unknown);
  } catch { throw new OutputCollectionError('INVALID_MANIFEST'); }
  const byKey = new Map(contract.fields.map((field) => [field.key, field]));
  const values: Record<string, unknown> = Object.create(null);
  const validationAssets: Record<string, string[]> = Object.create(null);
  const pending: { fieldKey: string; path: string; field: OutputContract['fields'][number] & { type: 'FILE' | 'FILES' } }[] = [];
  const seenPaths = new Set<string>();
  for (const [fieldKey, entry] of Object.entries(manifest.fields)) {
    const field = byKey.get(fieldKey);
    if (!field || field.type !== entry.type) throw new OutputCollectionError('UNDECLARED_OUTPUT');
    if (entry.type === 'FILE' || entry.type === 'FILES') {
      if (field.type !== 'FILE' && field.type !== 'FILES') throw new OutputCollectionError('UNDECLARED_OUTPUT');
      const paths = entry.type === 'FILE' ? [entry.path] : entry.paths;
      validationAssets[fieldKey] = paths.map(() => randomUUID());
      for (const path of paths) {
        if (seenPaths.has(path)) throw new OutputCollectionError('INVALID_PATH');
        seenPaths.add(path);
        pending.push({ fieldKey, path, field });
      }
    } else values[fieldKey] = entry.value;
  }
  try { validateOutputPayload(contract, { values, assets: validationAssets }); }
  catch { throw new OutputCollectionError('INVALID_MANIFEST'); }
  const files: CollectedFile[] = [];
  let resultBytes = 0;
  const perField = new Map<string, number>();
  for (const { fieldKey, path, field } of pending) {
    const metadata = await inspectPrivateStagedFile(outputRoot, path,
      Math.min(limits.maxFileBytes, field.constraints.maxFileSizeBytes));
    if (!isMatchingFileType(path, metadata.detectedMimeType,
      field.constraints.allowedMimeTypes, field.constraints.allowedExtensions)) {
      throw new OutputCollectionError('UNSUPPORTED_TYPE');
    }
    resultBytes += metadata.sizeBytes;
    perField.set(fieldKey, (perField.get(fieldKey) ?? 0) + metadata.sizeBytes);
    if (resultBytes > limits.maxResultBytes || perField.get(fieldKey)! > field.constraints.maxTotalSizeBytes) {
      throw new OutputCollectionError('LIMIT_EXCEEDED');
    }
    files.push(Object.freeze({ fieldKey, relativePath: path, ...metadata }));
  }
  return Object.freeze({ values, files: Object.freeze(files) });
}
