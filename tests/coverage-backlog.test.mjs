import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('every deferred verification row has one dependency and closing-evidence entry', () => {
  const coverage = readFileSync(join(root, 'spec/COVERAGE.md'), 'utf8');
  const backlog = readFileSync(join(root, 'docs/verification-backlog.md'), 'utf8');
  const deferred = [...coverage.matchAll(/^\s*`([A-Z]+-\d+)`\s+.*`DEFERRED_VERIFICATION`/gm)].map((match) => match[1]);
  const entries = [...backlog.matchAll(/^\| `([A-Z]+-\d+)` \(§\d+\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];
  assert.equal(new Set(deferred).size, deferred.length, 'coverage IDs must be unique');
  assert.equal(new Set(entries.map((entry) => entry[1])).size, entries.length, 'backlog IDs must be unique');
  assert.deepEqual(new Set(deferred), new Set(entries.map((entry) => entry[1])));
  for (const entry of entries) {
    assert.ok(entry[2].trim().length > 20, `missing reason for ${entry[1]}`);
    assert.ok(entry[3].trim().length > 8, `missing dependency for ${entry[1]}`);
    assert.ok(entry[4].trim().length > 20, `missing closing evidence for ${entry[1]}`);
  }
});
