import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerJobControl, newLocalJobCommand } from '../dist/apps/worker/src/job-control.js';

const ready = { async check() { return { ready: true, checkedAt: new Date().toISOString(), blockingReasons: [] }; } };
const uuid = () => randomUUID();

function fixture(mode = 'FULL_RESUME') {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-m07-job-'));
  const jobId = uuid(), executionId = uuid(), attemptId = uuid(), capabilityVersionId = uuid();
  const containerId = 'a'.repeat(64);
  const state = { status: 'running', pauseCalls: 0, resumeCalls: 0, stopCalls: 0 };
  const docker = {
    async pause() { state.pauseCalls++; state.status = 'paused'; },
    async resume() { state.resumeCalls++; state.status = 'running'; },
    async stop() { state.stopCalls++; state.status = 'exited'; },
    async status() { return state.status; },
  };
  const open = () => new WorkerJobControl(dir, docker, ready, { maxPauseDurationMs: 60_000 });
  const control = open();
  control.register({ jobId, executionId, attemptId, capabilityVersionId, containerId,
    controlPlaneId: 'plane-a', pauseSupport: mode,
    leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  control.markRunning(jobId);
  return { dir, jobId, executionId, control, state, open,
    cleanup() { control.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('local per-job pause persists offline, verifies container, and survives restart', async () => {
  const f = fixture();
  try {
    const cmd = newLocalJobCommand(f.jobId, 'local:1000', 'LOCAL_UI', 'stop expensive work');
    const paused = await f.control.pause(cmd);
    assert.equal(paused.status, 'PAUSED');
    assert.equal(paused.cloudSyncPending, true);
    assert.ok(Date.parse(paused.pauseExpiresAt) > Date.now());
    assert.equal(f.state.pauseCalls, 1);
    assert.equal((await f.control.pause(cmd)).status, 'PAUSED');
    assert.equal(f.state.pauseCalls, 1);
    await assert.rejects(f.control.pause({ ...cmd, actorId: 'different-actor' }), { code: 'CONFLICT' });
    assert.equal(f.control.commandHistory(f.jobId).length, 1);
    const revision = paused.localRevision;
    assert.equal(f.control.acknowledge(f.jobId, f.executionId, 'plane-a', revision).cloudSyncPending, false);
    assert.throws(() => f.control.acknowledge(f.jobId, f.executionId, 'plane-b', revision), { code: 'CONFLICT' });
    f.control.close();
    const reopened = f.open();
    assert.equal((await reopened.reconcile(f.jobId)).status, 'PAUSED');
    const resumed = await reopened.resume(newLocalJobCommand(f.jobId, 'local:1000', 'LOCAL_UI'));
    assert.equal(resumed.status, 'RUNNING');
    assert.equal(f.state.resumeCalls, 1);
    reopened.close();
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('pause is not acknowledged when process-tree control fails', async () => {
  const f = fixture();
  try {
    f.control.close();
    const failing = { async pause() { throw new Error('daemon unavailable'); }, async status() { return 'running'; } };
    const control = new WorkerJobControl(f.dir, failing, ready, { maxPauseDurationMs: 60_000 });
    await assert.rejects(control.pause(newLocalJobCommand(f.jobId, 'local:1000', 'CLI')),
      { code: 'CONTROL_FAILED' });
    assert.equal(control.snapshot(f.jobId).status, 'PAUSE_REQUESTED');
    assert.equal(control.commandHistory(f.jobId)[0].confirmed_at, null);
    control.close();
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('unsupported mode is explicit, never silently cancelled', async () => {
  const f = fixture('NOT_SUPPORTED');
  try {
    await assert.rejects(f.control.pause(newLocalJobCommand(f.jobId, 'local:1000', 'CLI')),
      { code: 'PAUSE_NOT_SUPPORTED' });
    assert.equal(f.control.snapshot(f.jobId).status, 'RUNNING');
    assert.equal(f.state.stopCalls, 0);
  } finally { f.cleanup(); }
});

test('restart reconciliation confirms an already-paused container and its audit/deadline', async () => {
  const f = fixture();
  try {
    f.control.close();
    const uncertain = { async pause() { f.state.status = 'paused'; throw new Error('lost acknowledgement'); },
      async status() { return f.state.status; } };
    const first = new WorkerJobControl(f.dir, uncertain, ready, { maxPauseDurationMs: 60_000 });
    const cmd = newLocalJobCommand(f.jobId, 'local:1000', 'CLI');
    await assert.rejects(first.pause(cmd), { code: 'CONTROL_FAILED' });
    first.close();
    const restarted = f.open();
    const reconciled = await restarted.reconcile(f.jobId);
    assert.equal(reconciled.status, 'PAUSED');
    assert.ok(reconciled.pauseExpiresAt);
    assert.ok(restarted.commandHistory(f.jobId)[0].confirmed_at);
    restarted.close();
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('security pause cannot be seller-resumed; cancellation remains available', async () => {
  const f = fixture();
  try {
    await f.control.pause(newLocalJobCommand(f.jobId, 'platform', 'PLATFORM_SECURITY', 'policy violation'));
    assert.equal(f.control.snapshot(f.jobId).status, 'SECURITY_PAUSED');
    await assert.rejects(f.control.resume(newLocalJobCommand(f.jobId, 'local:1000', 'CLI')),
      { code: 'SECURITY_BLOCK' });
    assert.equal((await f.control.cancel(newLocalJobCommand(f.jobId, 'local:1000', 'CLI'))).status, 'CANCELLED');
    assert.equal(f.state.stopCalls, 1);
  } finally { f.cleanup(); }
});

test('configured maximum pause duration stops local execution without settling delivery', async () => {
  const f = fixture();
  try {
    const paused = await f.control.pause(newLocalJobCommand(f.jobId, 'local:1000', 'CLI'));
    const expired = await f.control.expireOverdue(new Date(Date.parse(paused.pauseExpiresAt) + 1));
    assert.equal(expired.length, 1);
    assert.equal(expired[0].status, 'TIMED_OUT');
    assert.equal(f.state.stopCalls, 1);
    assert.equal(f.control.commandHistory(f.jobId).at(-1).reason, 'MAX_PAUSE_DURATION');
  } finally { f.cleanup(); }
});

test('restart reconciliation never reports a removed execution as still paused', async () => {
  const f = fixture();
  try {
    await f.control.pause(newLocalJobCommand(f.jobId, 'local:1000', 'CLI'));
    f.state.status = 'exited';
    assert.equal((await f.control.reconcile(f.jobId)).status, 'STOPPED');
  } finally { f.cleanup(); }
});

test('expired local lease stops offline work and cannot be resumed or extended', async () => {
  const f = fixture();
  try {
    const original = f.control.snapshot(f.jobId).leaseExpiresAt;
    assert.equal(f.control.extendLease(f.jobId, f.executionId, 'plane-a',
      new Date(Date.parse(original) + 30_000).toISOString()).leaseExpiresAt > original, true);
    assert.throws(() => f.control.extendLease(f.jobId, f.executionId, 'plane-b',
      new Date(Date.parse(original) + 60_000).toISOString()), { code: 'CONFLICT' });
    const expiry = f.control.snapshot(f.jobId).leaseExpiresAt;
    const ended = await f.control.expireLeases(new Date(Date.parse(expiry) + 1));
    assert.equal(ended.length, 1);
    assert.equal(ended[0].status, 'TIMED_OUT');
    assert.equal(f.state.stopCalls, 1);
    assert.equal(f.control.commandHistory(f.jobId).at(-1).reason, 'LEASE_EXPIRED');
    assert.deepEqual(await f.control.expireLeases(new Date(Date.parse(expiry) + 1)), []);
    await assert.rejects(f.control.resume(newLocalJobCommand(f.jobId, 'local:1', 'CLI')),
      { code: 'INVALID_STATE' });
  } finally { f.cleanup(); }
});
