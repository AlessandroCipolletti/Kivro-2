import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerResultOutbox } from '../dist/apps/worker/src/result-outbox.js';

test('validated result intent survives Worker restart and reuses one manifest ID', () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-outbox-'));
  const offer = { jobId: randomUUID(), executionId: randomUUID(), attemptId: randomUUID(),
    workerDeviceId: randomUUID(), controlPlaneId: 'plane-a', leaseToken: 'x'.repeat(32) };
  const upload = { payload: { values: { answer: 'ready' }, assets: {} }, assets: [] };
  const retainUntil = new Date(Date.now() + 86_400_000).toISOString();
  try {
    const first = new WorkerResultOutbox(root);
    const recorded = first.record(offer, upload, retainUntil);
    assert.equal(first.record(offer, upload, retainUntil).resultManifestId, recorded.resultManifestId);
    assert.throws(() => first.record(offer, { payload: { values: { answer: 'changed' },
      assets: {} }, assets: [] }, retainUntil), /RESULT_OUTBOX_CONFLICT/);
    first.close();
    const reopened = new WorkerResultOutbox(root);
    assert.equal(reopened.pending()[0].resultManifestId, recorded.resultManifestId);
    reopened.acknowledge(offer.executionId);
    assert.deepEqual(reopened.pending(), []);
    assert.equal(reopened.load(offer.executionId).resultManifestId, recorded.resultManifestId);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
