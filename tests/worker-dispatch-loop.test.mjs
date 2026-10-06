import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { WorkerDispatchLoop } from '../dist/apps/worker/src/dispatch-loop.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

test('poll dispatcher loads only local reviewed packages and never starts one offer twice', async () => {
  const deviceId = randomUUID(), executionId = randomUUID(), capabilityVersionId = randomUUID();
  const offer = { type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', jobId: randomUUID(),
    executionId, attemptId: randomUUID(), workerDeviceId: deviceId,
    capabilityId: randomUUID(), capabilityVersionId, inputManifestId: randomUUID(),
    paymentReservationId: randomUUID(), workerManifestHash: `sha256:${'a'.repeat(64)}`,
    localPackageHash: `sha256:${'b'.repeat(64)}`,
    permissionPolicyHash: `sha256:${'c'.repeat(64)}`,
    policyValidationHash: `sha256:${'d'.repeat(64)}`,
    inputSchemaHash: `sha256:${'e'.repeat(64)}`,
    inputManifestHash: `sha256:${'f'.repeat(64)}`,
    inputTotalBytes: 10, inputFileCount: 0, pauseSupport: 'FULL_RESUME',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    leaseToken: 'x'.repeat(32), paymentSecured: true };
  let resolveExecution;
  const blocked = new Promise((resolve) => { resolveExecution = resolve; });
  const calls = [], errors = [];
  const transport = { controlPlaneId: 'plane-a', kind: 'HTTPS_POLLING',
    supportedProtocolVersions: [WORKER_PROTOCOL_VERSION],
    async poll(hello) {
      assert.equal(hello.workerDeviceId, deviceId);
      return [offer, { ...offer, messageId: randomUUID() }];
    }, async send() {}, async close() {} };
  const dispatcher = new WorkerDispatchLoop(transport, deviceId,
    { load(versionId) { calls.push(['load', versionId]); return { reviewed: true }; } },
    { snapshot() { return { localRevision: 0 }; } },
    { snapshots() { return []; }, async stopOrphanedAtStartup() {},
      async expireLeases() {}, async expireOverdue() {} },
    { async execute(seen, pkg) { calls.push(['execute', seen.executionId, pkg]); await blocked; } },
    (seen, error) => errors.push([seen, error]));
  await dispatcher.pollOnce();
  assert.equal(calls.filter(([kind]) => kind === 'execute').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'load').length, 1);
  resolveExecution();
  await dispatcher.awaitActiveForTest();
  assert.deepEqual(errors, []);
});

test('draining control plane refuses a fresh job offer', async () => {
  const deviceId = randomUUID();
  const transport = { controlPlaneId: 'plane-a', kind: 'HTTPS_POLLING',
    supportedProtocolVersions: [WORKER_PROTOCOL_VERSION], async poll() { return [
      { type: 'WORKER_WELCOME', messageId: randomUUID(), controlPlaneId: 'plane-a',
        selectedProtocolVersion: WORKER_PROTOCOL_VERSION, controlPlaneState: 'DRAINING',
        serverTime: new Date().toISOString() },
      { type: 'JOB_OFFER', controlPlaneId: 'plane-a', workerDeviceId: deviceId },
    ]; }, async send() {}, async close() {} };
  const dispatcher = new WorkerDispatchLoop(transport, deviceId, { load() {
    throw new Error('SHOULD_NOT_LOAD'); } }, { snapshot() { return { localRevision: 0 }; } },
  { snapshots() { return []; }, async stopOrphanedAtStartup() {},
    async expireLeases() {}, async expireOverdue() {} },
  { async execute() { throw new Error('SHOULD_NOT_EXECUTE'); } }, () => {});
  await assert.rejects(dispatcher.pollOnce(), { code: 'DRAINING' });
});
