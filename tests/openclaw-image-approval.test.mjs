import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { OpenClawImageApproval, hashOpenClawRuntimeSource } from
  '../dist/packages/openclaw-adapter/src/image-approval.js';

test('image approval is exact, private, source-bound, and rejects missing evidence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-image-approval-'));
  const recordPath = join(root, 'approval.json');
  const runtimeRoot = resolve('runtime/openclaw');
  const image = `kivro-openclaw-runtime@sha256:${'a'.repeat(64)}`;
  const sourceHash = await hashOpenClawRuntimeSource(runtimeRoot);
  const approval = new OpenClawImageApproval(recordPath, runtimeRoot, '/usr/local/bin/docker');
  const record = { schemaVersion: 1, image, openClawVersion: '2026.8.2',
    runtimeSourceHash: sourceHash, conformanceSuite: 'm07-openclaw-execution/1',
    conformancePassedAt: new Date().toISOString() };
  try {
    await assert.rejects(approval.assertApprovedImage(image), { code: 'INVALID_RECORD' });
    writeFileSync(recordPath, JSON.stringify(record), { mode: 0o644 });
    chmodSync(recordPath, 0o644);
    await assert.rejects(approval.assertApprovedImage(image), { code: 'INVALID_RECORD' });
    chmodSync(recordPath, 0o600);
    await assert.rejects(approval.assertApprovedImage(`other@sha256:${'a'.repeat(64)}`),
      { code: 'NOT_APPROVED' });
    writeFileSync(recordPath, JSON.stringify({ ...record,
      runtimeSourceHash: `sha256:${'b'.repeat(64)}` }), { mode: 0o600 });
    await assert.rejects(approval.assertApprovedImage(image), { code: 'SOURCE_CHANGED' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
