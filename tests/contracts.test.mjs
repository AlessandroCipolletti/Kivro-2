import assert from 'node:assert/strict';
import test from 'node:test';
import { hashWorkerManifest, WorkerManifestSchema } from '../dist/packages/contracts/src/worker-manifest.js';
import { parseJobOffer, WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

const id = 'b3451661-a538-4907-8acc-b1cf00e04899';
const manifest = {
  manifestVersion: 1,
  workerId: id,
  capabilityVersionId: id,
  runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
  skills: [{ name: 'document-analyzer', contentHash: `sha256:${'a'.repeat(64)}` }],
  tools: { allow: [], deny: ['browser', 'exec', 'gateway'] },
  resources: [],
  network: { default: 'deny', allow: [] },
  limits: { timeoutSeconds: 120, memoryMb: 1024, cpu: 1, maxPids: 128, maxInputBytes: 10485760, maxOutputBytes: 52428800 },
};

test('manifest rejects unknown fields and unsupported versions', () => {
  assert.equal(WorkerManifestSchema.safeParse(manifest).success, true);
  assert.equal(WorkerManifestSchema.safeParse({ ...manifest, apiKey: 'secret' }).success, false);
  assert.equal(WorkerManifestSchema.safeParse({ ...manifest, manifestVersion: 2 }).success, false);
});

test('manifest hash is stable across object key order and changes on policy change', () => {
  assert.equal(hashWorkerManifest(manifest), hashWorkerManifest({ ...manifest, tools: { deny: manifest.tools.deny, allow: [] } }));
  assert.notEqual(hashWorkerManifest(manifest), hashWorkerManifest({ ...manifest, limits: { ...manifest.limits, timeoutSeconds: 121 } }));
});

test('job offer requires secured payment and a compatible protocol version', () => {
  const offer = {
    type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION, messageId: id,
    controlPlaneId: 'kivro-prod-a', jobId: id, executionId: id, attemptId: id,
    workerDeviceId: id, capabilityId: id, capabilityVersionId: id, inputManifestId: id,
    paymentReservationId: id, workerManifestHash: `sha256:${'a'.repeat(64)}`,
    localPackageHash: `sha256:${'d'.repeat(64)}`,
    permissionPolicyHash: `sha256:${'e'.repeat(64)}`,
    policyValidationHash: `sha256:${'b'.repeat(64)}`,
    inputSchemaHash: `sha256:${'f'.repeat(64)}`,
    inputManifestHash: `sha256:${'c'.repeat(64)}`, pauseSupport: 'NOT_SUPPORTED',
    inputTotalBytes: 0, inputFileCount: 0,
    expiresAt: '2026-10-07T12:00:00Z', leaseToken: 'x'.repeat(32), paymentSecured: true,
  };
  assert.equal(parseJobOffer(offer).paymentSecured, true);
  assert.throws(() => parseJobOffer({ ...offer, paymentSecured: false }));
  assert.throws(() => parseJobOffer({ ...offer, protocolVersion: 'kivro-worker/2' }));
  assert.throws(() => parseJobOffer({ ...offer, buyerEmail: 'buyer@example.com' }));
});
