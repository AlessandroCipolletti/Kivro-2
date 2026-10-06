import { open, mkdir, lstat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { canonicalOutputPath } from '../../contracts/src/local-result.js';

const maxEntries = 256;
const archiveOverheadBytes = 8 * 1024 * 1024;

export class OutputTransferError extends Error {
  constructor(readonly code: 'INVALID_ARCHIVE' | 'INVALID_PATH' | 'INVALID_ENTRY' | 'LIMIT_EXCEEDED') {
    super(`Sandbox output transfer refused: ${code}`);
    this.name = 'OutputTransferError';
  }
}

function archivePath(raw: string): string | null {
  const stripped = raw.replace(/^\.\//, '').replace(/\/$/, '');
  if (stripped === '' || stripped === '.') return null;
  if (stripped === 'result.json') return stripped;
  try { return canonicalOutputPath(stripped); }
  catch { throw new OutputTransferError('INVALID_PATH'); }
}

/** Docker cp emits a tar stream. Only regular files and directories with portable names are accepted. */
export async function extractBoundedOutputTar(source: AsyncIterable<Uint8Array>, outputRoot: string,
  maxOutputBytes: number): Promise<void> {
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1) {
    throw new OutputTransferError('LIMIT_EXCEEDED');
  }
  await mkdir(outputRoot, { mode: 0o700 });
  const rootInfo = await lstat(outputRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || (rootInfo.mode & 0o077) !== 0) {
    throw new OutputTransferError('INVALID_PATH');
  }
  const entries = new Set<string>();
  let archiveBytes = 0;
  let fileBytes = 0;
  let count = 0;
  const boundedSource = Readable.from((async function* () {
    for await (const part of source) {
      archiveBytes += part.byteLength;
      if (archiveBytes > maxOutputBytes + archiveOverheadBytes) {
        throw new OutputTransferError('LIMIT_EXCEEDED');
      }
      yield part;
    }
  })());
  const extract = tar.extract();
  extract.on('entry', (header, stream, next) => {
    // Destroying the parser also destroys the current entry; the pipeline reports the error.
    stream.on('error', () => undefined);
    void (async () => {
      count += 1;
      if (count > maxEntries) throw new OutputTransferError('LIMIT_EXCEEDED');
      const path = archivePath(header.name);
      if (path === null) {
        if (header.type !== 'directory' || (header.size ?? 0) !== 0) throw new OutputTransferError('INVALID_ENTRY');
        for await (const part of stream) {
          if (part.byteLength !== 0) throw new OutputTransferError('INVALID_ENTRY');
        }
        return;
      }
      if (entries.has(path)) throw new OutputTransferError('INVALID_ARCHIVE');
      entries.add(path);
      const destination = join(outputRoot, path);
      if (header.type === 'directory') {
        if ((header.size ?? 0) !== 0) throw new OutputTransferError('INVALID_ENTRY');
        await mkdir(destination, { recursive: true, mode: 0o700 });
        for await (const part of stream) {
          if (part.byteLength !== 0) throw new OutputTransferError('INVALID_ENTRY');
        }
        return;
      }
      const declaredSize = header.size;
      if (header.type !== 'file') throw new OutputTransferError('INVALID_ENTRY');
      if (typeof declaredSize !== 'number' || !Number.isSafeInteger(declaredSize) || declaredSize < 0 ||
        declaredSize > maxOutputBytes || fileBytes + declaredSize > maxOutputBytes) {
        throw new OutputTransferError(header.type === 'file' ? 'LIMIT_EXCEEDED' : 'INVALID_ENTRY');
      }
      fileBytes += declaredSize;
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      let handle;
      let written = 0;
      try {
        handle = await open(destination, 'wx', 0o600);
        for await (const part of stream) {
          const bytes = Buffer.from(part);
          written += bytes.byteLength;
          if (written > declaredSize) throw new OutputTransferError('INVALID_ARCHIVE');
          let offset = 0;
          while (offset < bytes.byteLength) {
            const result = await handle.write(bytes, offset, bytes.byteLength - offset);
            if (result.bytesWritten <= 0) throw new OutputTransferError('INVALID_ARCHIVE');
            offset += result.bytesWritten;
          }
        }
        if (written !== declaredSize) throw new OutputTransferError('INVALID_ARCHIVE');
      } catch (error) {
        await handle?.close();
        await unlink(destination).catch(() => undefined);
        throw error;
      } finally { await handle?.close(); }
    })().then(() => next(), (error: unknown) => extract.destroy(
      error instanceof Error ? error : new OutputTransferError('INVALID_ARCHIVE')));
  });
  try { await pipeline(boundedSource, extract); }
  catch (error) {
    if (error instanceof OutputTransferError) throw error;
    throw new OutputTransferError('INVALID_ARCHIVE');
  }
  if (!entries.has('result.json')) throw new OutputTransferError('INVALID_ARCHIVE');
}
