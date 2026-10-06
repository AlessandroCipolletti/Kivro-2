import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';

const capabilityId = 'd54f4053-a43d-4e66-b576-c721ee30cba6';
const ready = { async check() { return { ready: true, checkedAt: new Date().toISOString(), blockingReasons: [] }; } };
const notReady = { async check() { return { ready: false, checkedAt: new Date().toISOString(), blockingReasons: ['sandbox unavailable'] }; } };

function withState(checker, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-worker-state-'));
  chmodSync(dir, 0o700);
  try {
    return fn(dir, new WorkerLocalState(dir, checker));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('local pause is committed before return and survives restart without a cloud connection', () => {
  withState(notReady, (dir, state) => {
    const paused = state.pauseAll('local:501', 'LOCAL_CLI', 'maintenance');
    assert.equal(paused.globalPaused, true);
    assert.equal(paused.cloudSyncPending, true);
    assert.equal(paused.localRevision, 1);
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId), false);
    assert.equal(state.pauseAll('local:501').localRevision, 1, 'duplicate pause is idempotent');
    assert.equal(lstatSync(join(dir, 'worker.sqlite')).mode & 0o077, 0);
    state.close();
    const reopened = new WorkerLocalState(dir, notReady);
    try {
      assert.equal(reopened.snapshot().globalPaused, true);
      assert.equal(reopened.snapshot().pauseReason, 'maintenance');
      assert.equal(reopened.auditEvents().length, 1);
      assert.equal(reopened.isUnpausedForNewJobOffer(capabilityId), false);
      reopened.acknowledgeCloudRevision(1);
      assert.equal(reopened.snapshot().cloudSyncPending, false);
    } finally {
      reopened.close();
    }
  });
});

test('resume fails closed on missing readiness and platform security pause', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-worker-state-'));
  chmodSync(dir, 0o700);
  const state = new WorkerLocalState(dir, notReady);
  try {
    state.pauseAll('local:501');
    await assert.rejects(state.resumeAll('local:501'), { code: 'NOT_READY' });
    assert.equal(state.snapshot().globalPaused, true);
    state.applySecurityPause('platform:policy', 'sandbox escape protection failed');
    await assert.rejects(state.resumeAll('local:501'), { code: 'SECURITY_PAUSE' });
    assert.equal(state.snapshot().securityPaused, true);
    assert.equal(state.auditEvents().length, 2);
  } finally {
    state.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('global pause overrides capability resume and capability pause persists', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-worker-state-'));
  chmodSync(dir, 0o700);
  const state = new WorkerLocalState(dir, ready);
  try {
    state.pauseCapability(capabilityId, 'local:501');
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId), false);
    state.pauseAll('local:501');
    await assert.rejects(state.resumeCapability(capabilityId, 'local:501'), { code: 'SECURITY_PAUSE' });
    await state.resumeAll('local:501');
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId), false);
    await state.resumeCapability(capabilityId, 'local:501');
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId), true);
    assert.equal(state.auditEvents().length, 4);
  } finally {
    state.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pause arriving during readiness check cannot be lost by a concurrent resume', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-worker-state-'));
  chmodSync(dir, 0o700);
  let finishCheck;
  const checker = { check: () => new Promise((resolve) => { finishCheck = resolve; }) };
  const state = new WorkerLocalState(dir, checker);
  try {
    state.pauseAll('local:501');
    const resuming = state.resumeAll('local:501');
    state.pauseCapability(capabilityId, 'local:501');
    finishCheck({ ready: true, checkedAt: new Date().toISOString(), blockingReasons: [] });
    await assert.rejects(resuming, { code: 'NOT_READY' });
    assert.equal(state.snapshot().globalPaused, true);
  } finally {
    state.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stale readiness cannot clear an emergency pause', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-worker-state-'));
  chmodSync(dir, 0o700);
  const checker = { async check() { return { ready: true, checkedAt: new Date(Date.now() - 60_000).toISOString(), blockingReasons: [] }; } };
  const state = new WorkerLocalState(dir, checker);
  try {
    state.pauseAll('local:501');
    await assert.rejects(state.resumeAll('local:501'), { code: 'NOT_READY' });
    assert.equal(state.snapshot().globalPaused, true);
  } finally {
    state.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('existing group-readable directories and symlinks are refused', () => {
  const parent = mkdtempSync(join(tmpdir(), 'kivro-worker-state-'));
  try {
    const insecure = join(parent, 'insecure');
    mkdirSync(insecure, { mode: 0o755 });
    assert.throws(() => new WorkerLocalState(insecure, notReady), { code: 'INSECURE_STATE_PATH' });
    const link = join(parent, 'link');
    symlinkSync(insecure, link);
    assert.throws(() => new WorkerLocalState(link, notReady), { code: 'INSECURE_STATE_PATH' });
    const privateDir = join(parent, 'private');
    mkdirSync(privateDir, { mode: 0o700 });
    symlinkSync(join(parent, 'uncreated-target'), join(privateDir, 'worker.sqlite'));
    assert.throws(() => new WorkerLocalState(privateDir, notReady), { code: 'INSECURE_STATE_PATH' });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
