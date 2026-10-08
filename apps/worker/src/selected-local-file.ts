import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { z } from 'zod';
import { SelectedLocalBindingSchema, type SelectedLocalBinding } from
  '../../../packages/contracts/src/selected-local-file.js';

const MAX_TOTAL_BYTES = 64_000_000;
const MAX_CHUNK_BYTES = 65_536;
const MAX_DEPTH = 4;
const segmentPattern = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/;
const sensitive = new Set(['.ssh', '.aws', '.codex', '.openclaw', '.kivro',
  '.gnupg', '.config', '.local', 'openclaw', 'keychains', 'etc', 'root',
  'system', 'library', 'applications']);

export class SelectedLocalFileError extends Error {
  constructor(readonly code: 'SELECTED_FILE_DENIED' | 'SELECTED_FILE_CHANGED' |
    'SELECTED_FILE_LIMIT') { super(code); this.name = 'SelectedLocalFileError'; }
}

function safeSegments(relative: string): readonly string[] {
  const segments = relative.split('/');
  if (!relative || relative.startsWith('/') || relative.includes('\\') ||
    segments.length > MAX_DEPTH || segments.some((part) =>
      part === '.' || part === '..' || !segmentPattern.test(part) ||
      part.trim() !== part || sensitive.has(part.toLowerCase()))) {
    throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
  }
  return segments;
}

async function noSymlinkComponents(path: string): Promise<void> {
  if (!isAbsolute(path) || resolve(path) !== path || path.includes('\0'))
    throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
  let cursor: string = sep;
  for (const part of path.split(sep).filter(Boolean)) {
    if (sensitive.has(part.toLowerCase()))
      throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
    cursor = join(cursor, part);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && cursor !== path))
      throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
  }
  if (await realpath(path) !== path)
    throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
}

async function openRegular(path: string, expected?: { device: number; inode: number;
  sizeBytes: number; sha256: string }): Promise<Buffer> {
  await noSymlinkComponents(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16_000_000 ||
      expected && (stat.dev !== expected.device || stat.ino !== expected.inode ||
        stat.size !== expected.sizeBytes))
      throw new SelectedLocalFileError('SELECTED_FILE_CHANGED');
    const bytes = await handle.readFile();
    if (bytes.length !== stat.size || expected &&
      `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== expected.sha256)
      throw new SelectedLocalFileError('SELECTED_FILE_CHANGED');
    return bytes;
  } finally { await handle.close(); }
}

/** Captures an explicit seller selection before review. Every child is pinned to
 * the immutable capability version; changed content requires another review. */
export async function captureSelectedLocalBinding(input: { resourceId: string;
  kind: 'FILE' | 'DIRECTORY'; absolutePath: string }): Promise<SelectedLocalBinding> {
  const root = input.absolutePath;
  await noSymlinkComponents(root);
  const rootStat = await lstat(root);
  if (input.kind === 'FILE' ? !rootStat.isFile() : !rootStat.isDirectory())
    throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
  const files: SelectedLocalBinding['files'][number][] = [];
  let total = 0;
  async function capture(relativePath: string): Promise<void> {
    const path = relativePath === '.' ? root : join(root, ...safeSegments(relativePath));
    const bytes = await openRegular(path);
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES || files.length >= 64)
      throw new SelectedLocalFileError('SELECTED_FILE_LIMIT');
    const stat = await lstat(path);
    files.push({ fileId: `file-${createHash('sha256').update(relativePath).digest('hex')}`,
      relativePath, device: stat.dev, inode: stat.ino, sizeBytes: bytes.length,
      sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` });
  }
  async function walk(relative: string): Promise<void> {
    const path = relative ? join(root, ...safeSegments(relative)) : root;
    await noSymlinkComponents(path);
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      safeSegments(child);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) await capture(child);
      else throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
    }
  }
  if (input.kind === 'FILE') await capture('.');
  else await walk('');
  if (files.length === 0) throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
  return SelectedLocalBindingSchema.parse({ resourceId: input.resourceId,
    kind: input.kind, absolutePath: root, device: rootStat.dev, inode: rootStat.ino,
    files });
}

export interface SelectedFileAuditPort {
  markPrivateResourceRead(jobId: string, capabilityVersionId: string): Promise<void>;
  recordSelectedFile(input: { jobId: string; capabilityVersionId: string;
    resourceId: string; fileId: string; bytes: number; status: 'ALLOWED' | 'DENIED';
    reason: string | null }): Promise<void>;
}

export async function verifySelectedLocalBinding(raw: unknown): Promise<boolean> {
  try {
    const binding=SelectedLocalBindingSchema.parse(raw);
    await noSymlinkComponents(binding.absolutePath);
    const root=await lstat(binding.absolutePath);
    if(root.dev!==binding.device||root.ino!==binding.inode||
      (binding.kind==='FILE'?!root.isFile():!root.isDirectory()))return false;
    for(const file of binding.files){
      const path=binding.kind==='FILE'?binding.absolutePath:
        join(binding.absolutePath,...safeSegments(file.relativePath));
      await openRegular(path,file);
    }
    return true;
  }catch{return false;}
}

/** The sandbox supplies opaque IDs and byte ranges only. Host paths never cross
 * the bridge and every call rechecks the seller's exact approved snapshot. */
export class SelectedLocalFileBroker {
  private readonly binding: SelectedLocalBinding;
  constructor(raw: unknown, private readonly audit: SelectedFileAuditPort) {
    this.binding = SelectedLocalBindingSchema.parse(raw);
  }
  async read(binding: { jobId: string; capabilityVersionId: string }, raw: unknown,
    signal: AbortSignal): Promise<{ bytesBase64: string; offset: number;
      sizeBytes: number; eof: boolean }> {
    const input = z.strictObject({ resourceId: z.string(), fileId: z.string(),
      offset: z.number().int().nonnegative(),
      length: z.number().int().min(1).max(MAX_CHUNK_BYTES) }).parse(raw);
    let status: 'ALLOWED' | 'DENIED' = 'DENIED';
    let count = 0;
    let reason: string | null = 'SELECTED_FILE_DENIED';
    try {
      signal.throwIfAborted();
      if (input.resourceId !== this.binding.resourceId)
        throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
      const file = this.binding.files.find((item) => item.fileId === input.fileId);
      if (!file) throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
      await noSymlinkComponents(this.binding.absolutePath);
      const root = await lstat(this.binding.absolutePath);
      if (root.dev !== this.binding.device || root.ino !== this.binding.inode ||
        (this.binding.kind === 'DIRECTORY' ? !root.isDirectory() : !root.isFile()))
        throw new SelectedLocalFileError('SELECTED_FILE_CHANGED');
      const path = this.binding.kind === 'FILE' ? this.binding.absolutePath :
        join(this.binding.absolutePath, ...safeSegments(file.relativePath));
      if (this.binding.kind === 'DIRECTORY' &&
        !path.startsWith(`${this.binding.absolutePath}${sep}`))
        throw new SelectedLocalFileError('SELECTED_FILE_DENIED');
      const bytes = await openRegular(path, file);
      signal.throwIfAborted();
      // Establish the private-resource barrier before any seller bytes are
      // returned to OpenClaw. A missing audit/barrier fails this read closed.
      await this.audit.markPrivateResourceRead(binding.jobId,
        binding.capabilityVersionId);
      const chunk = bytes.subarray(input.offset,
        Math.min(bytes.length, input.offset + input.length));
      status = 'ALLOWED'; count = chunk.length; reason = null;
      return { bytesBase64: chunk.toString('base64'), offset: input.offset,
        sizeBytes: bytes.length, eof: input.offset + chunk.length >= bytes.length };
    } catch (error) {
      reason = error instanceof SelectedLocalFileError ? error.code : 'SELECTED_FILE_DENIED';
      throw error instanceof SelectedLocalFileError ? error :
        new SelectedLocalFileError('SELECTED_FILE_DENIED');
    } finally {
      await this.audit.recordSelectedFile({ ...binding, resourceId: this.binding.resourceId,
        fileId: input.fileId, bytes: count, status, reason });
    }
  }
}
