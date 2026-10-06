import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import tar from 'tar-stream';
import { extractBoundedOutputTar } from '../dist/packages/sandbox-adapter/src/output-transfer.js';

function archive(entries) {
  const pack = tar.pack();
  pack.on('error', () => undefined);
  for (const entry of entries) {
    pack.entry({ name: entry.name, type: entry.type ?? 'file',
      ...(entry.linkname ? { linkname: entry.linkname } : {}) }, entry.body ?? '');
  }
  pack.finalize();
  return pack;
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kivro-tar-'));
  return { root, output: join(root, 'output'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('bounded Docker tar transfer accepts only portable regular output files', async () => {
  const f = fixture();
  try {
    await extractBoundedOutputTar(archive([
      { name: './', type: 'directory' },
      { name: './result.json', body: '{"schemaVersion":1,"fields":{}}' },
      { name: './renders/front.png', body: 'PNG fixture' },
    ]), f.output, 1024);
    assert.equal(readFileSync(join(f.output, 'renders/front.png'), 'utf8'), 'PNG fixture');
  } finally { f.cleanup(); }
});

test('bounded Docker tar transfer refuses traversal, symlinks, duplicates and over-limit files', async () => {
  const cases = [
    [{ name: './result.json', body: '{}' }, { name: '../outside', body: 'escape' }],
    [{ name: './result.json', body: '{}' },
      { name: './escape', type: 'symlink', linkname: '/etc/passwd' }],
    [{ name: './result.json', body: '{}' }, { name: './result.json', body: '{}' }],
    [{ name: './result.json', body: '{}' }, { name: './large.txt', body: 'a'.repeat(200) }],
  ];
  for (const entries of cases) {
    const f = fixture();
    try { await assert.rejects(extractBoundedOutputTar(archive(entries), f.output, 128)); }
    finally { f.cleanup(); }
  }
});
