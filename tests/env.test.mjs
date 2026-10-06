import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('checked-in environment example contains names and no values', () => {
  const text = readFileSync(join(root, '.env.example'), 'utf8');
  const entries = text.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
  assert.ok(entries.length > 0);
  for (const entry of entries) assert.match(entry, /^[A-Z][A-Z0-9_]*=$/);
});
