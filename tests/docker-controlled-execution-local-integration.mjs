import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { DockerSandboxAdapter, DockerJobControlAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';
import { WorkerJobControl, newLocalJobCommand } from '../dist/apps/worker/src/job-control.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b';
const plan = { planVersion: 1, image, networkMode: 'none', readOnlyRoot: true,
  capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin', runAs: '65532:65532',
  maxRuntimeSeconds: 4, memoryMb: 128, cpu: 1, maxPids: 32, maxOutputBytes: 4096 };
const contract = { schemaVersion: 1, fields: [
  { key: 'answer', label: 'Answer', order: 0, required: true, type: 'SHORT_TEXT' },
] };
const ready = { async check() { return { ready: true, checkedAt: new Date().toISOString(), blockingReasons: [] }; } };

test('short controlled execution records verified start before output delivery', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-short-controlled-'));
  const attemptId = randomUUID(), jobId = randomUUID();
  mkdirSync(join(root, attemptId, 'input'), { recursive: true, mode: 0o700 });
  const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
    collectorImage: image, attemptRoot: root });
  let starts = 0;
  try {
    const result = await sandbox.runWithOutputControlled(plan, attemptId,
      ['/bin/sh', '-c', 'printf \'{"schemaVersion":1,"fields":{"answer":{"type":"SHORT_TEXT","value":"quick"}}}\' > /job/output/result.json'],
      contract, { maxFileBytes: 1024, maxResultBytes: 4096 }, async (collected) => {
        assert.equal(starts >= 1, true);
        assert.equal(collected.values.answer, 'quick');
      }, { jobId,
        async onReady() {}, async onStartPermitted() {},
        async onStarted() { starts++; }, async onWatchdogTick() {}, async onStopped() {},
      });
    assert.equal(result.exitCode, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('controlled Docker execution stops all work during pause and excludes paused time from runtime budget', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-controlled-'));
  const attemptId = randomUUID(), jobId = randomUUID(), executionId = randomUUID();
  mkdirSync(join(root, attemptId, 'input'), { recursive: true, mode: 0o700 });
  const control = new WorkerJobControl(join(root, 'state'), new DockerJobControlAdapter(docker),
    ready, { maxPauseDurationMs: 60_000 });
  const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
    collectorImage: image, attemptRoot: root });
  let started = false;
  let run;
  try {
    run = sandbox.runWithOutputControlled(plan, attemptId,
      ['/bin/sh', '-c', 'sleep 4; sleep 2; printf \'{"schemaVersion":1,"fields":{"answer":{"type":"SHORT_TEXT","value":"done"}}}\' > /job/output/result.json'],
      contract, { maxFileBytes: 1024, maxResultBytes: 4096 }, async (collected) => {
        assert.equal(collected.values.answer, 'done');
      }, { jobId,
        async onReady(containerId) {
          control.register({ jobId, executionId, attemptId, capabilityVersionId: randomUUID(),
            containerId, controlPlaneId: 'plane-a', pauseSupport: 'FULL_RESUME',
            leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() });
        },
        async onStartPermitted(containerId) { control.assertStartPermitted(jobId, containerId); },
        async onStarted() { control.markRunning(jobId); started = true; },
        async onWatchdogTick() { await control.expireLeases(); await control.expireOverdue(); },
        async onStopped(containerId) { control.markStopped(jobId, containerId); },
      });
    const waitUntil = Date.now() + 8_000;
    while (!started && Date.now() < waitUntil) await delay(50);
    assert.equal(started, true);
    assert.equal((await control.pause(newLocalJobCommand(jobId, 'local:1', 'CLI'))).status, 'PAUSED');
    await delay(4_500);
    assert.equal(control.snapshot(jobId).status, 'PAUSED');
    assert.equal((await control.resume(newLocalJobCommand(jobId, 'local:1', 'CLI'))).status, 'RUNNING');
    assert.equal((await run).exitCode, 0);
    assert.equal(control.snapshot(jobId).status, 'STOPPED');
  } finally {
    if (run) {
      if (started && !['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(control.snapshot(jobId).status)) {
        await control.cancel(newLocalJobCommand(jobId, 'local:1', 'CLI')).catch(() => undefined);
      }
      await run.catch(() => undefined);
    }
    control.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('controlled Docker execution stops locally when its cloud lease expires offline', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-lease-stop-'));
  const attemptId = randomUUID(), jobId = randomUUID(), executionId = randomUUID();
  mkdirSync(join(root, attemptId, 'input'), { recursive: true, mode: 0o700 });
  const control = new WorkerJobControl(join(root, 'state'), new DockerJobControlAdapter(docker),
    ready, { maxPauseDurationMs: 60_000 });
  const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
    collectorImage: image, attemptRoot: root });
  try {
    await assert.rejects(sandbox.runWithOutputControlled({ ...plan, maxRuntimeSeconds: 30 }, attemptId,
      ['/bin/sh', '-c', 'sleep 20'], contract,
      { maxFileBytes: 1024, maxResultBytes: 4096 }, async () => {
        throw new Error('expired output must never be consumed');
      }, { jobId,
        async onReady(containerId) {
          control.register({ jobId, executionId, attemptId, capabilityVersionId: randomUUID(),
            containerId, controlPlaneId: 'plane-a', pauseSupport: 'FULL_RESUME',
            leaseExpiresAt: new Date(Date.now() + 1_500).toISOString() });
        },
        async onStartPermitted(containerId) { control.assertStartPermitted(jobId, containerId); },
        async onStarted() { control.markRunning(jobId); },
        async onWatchdogTick() { await control.expireLeases(); },
        async onStopped(containerId) { control.markStopped(jobId, containerId); },
      }));
    assert.equal(control.snapshot(jobId).status, 'TIMED_OUT');
    assert.equal(control.commandHistory(jobId).at(-1).reason, 'LEASE_EXPIRED');
  } finally {
    control.close();
    rmSync(root, { recursive: true, force: true });
  }
});
