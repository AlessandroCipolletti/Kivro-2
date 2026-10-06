import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { hashWorkerManifest } from '../dist/packages/contracts/src/worker-manifest.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';
import { assessJobOffer } from '../dist/apps/worker/src/job-admission.js';

test('Worker admission binds immutable package, seller pause and fresh runtime proof', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-m07-admission-'));
  const worker = randomUUID(), capability = randomUUID(), version = randomUUID();
  const policy = { policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY',
    browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
    selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
    shell: false, externalSideEffects: false, buyerFileAccess: false, sellerCredentialRefs: [] };
  const manifest = { manifestVersion: 1, workerId: randomUUID(), capabilityVersionId: version,
    runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
    skills: [], tools: { allow: [], deny: ['browser', 'exec', 'gateway'] }, resources: [],
    network: { default: 'deny', allow: [] },
    limits: { timeoutSeconds: 120, memoryMb: 128, cpu: 1, maxPids: 32,
      maxInputBytes: 1000, maxOutputBytes: 1000 } };
  const pkg = { packageVersion: 1, capabilityId: capability, capabilityVersionId: version,
    workerDeviceId: worker, workerManifest: manifest,
    dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null, alternatives: [],
      nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill', requirement: 'REQUIRED',
        sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
        marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false, health: 'UNKNOWN' }] },
    permissionPolicy: policy, sellerInferenceConfigHash: null,
    ioContract: { contractVersion: 1,
      input: { schemaVersion: 1, fields: [{ key: 'question', label: 'Question', order: 0,
        required: true, type: 'SHORT_TEXT' }] },
      output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer', order: 0,
        required: true, type: 'LONG_TEXT' }] } },
    priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
    exampleRefs: [], testRefs: [], pauseSupport: 'FULL_RESUME' };
  const offer = { type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', jobId: randomUUID(),
    executionId: randomUUID(), attemptId: randomUUID(), workerDeviceId: worker,
    capabilityId: capability, capabilityVersionId: version, inputManifestId: randomUUID(),
    paymentReservationId: randomUUID(), workerManifestHash: hashWorkerManifest(manifest),
    localPackageHash: hashCanonicalJson(pkg), permissionPolicyHash: hashCanonicalJson(policy),
    policyValidationHash: `sha256:${'a'.repeat(64)}`,
    inputSchemaHash: hashCanonicalJson(pkg.ioContract.input),
    inputManifestHash: `sha256:${'b'.repeat(64)}`,
    inputTotalBytes: 50, inputFileCount: 0, pauseSupport: 'FULL_RESUME',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    leaseToken: 'x'.repeat(32), paymentSecured: true };
  const local = new WorkerLocalState(dir, { async check() { return { ready: true,
    checkedAt: new Date().toISOString(), blockingReasons: [] }; } });
  const context = { authenticatedControlPlaneId: 'plane-a', localWorkerDeviceId: worker,
    localPauseState: local,
    readiness: { async check() { return { ready: true, checkedAt: new Date().toISOString(),
      policyValidationHash: offer.policyValidationHash, sandboxVerified: true,
      requiredSecretsReady: true, runtimeHealthy: true, capacityAvailable: true }; } } };
  try {
    assert.equal((await assessJobOffer(offer, pkg, context)).jobId, offer.jobId);
    await assert.rejects(assessJobOffer({ ...offer, controlPlaneId: 'other' }, pkg, context),
      { code: 'WRONG_CONTROL_PLANE' });
    await assert.rejects(assessJobOffer({ ...offer, inputTotalBytes: 1001 }, pkg, context),
      { code: 'INPUT_LIMIT' });
    await assert.rejects(assessJobOffer({ ...offer, localPackageHash: `sha256:${'0'.repeat(64)}` }, pkg, context),
      { code: 'VERSION_MISMATCH' });
    local.pauseCapability(capability, 'local:1000');
    await assert.rejects(assessJobOffer(offer, pkg, context), { code: 'SELLER_PAUSED' });
  } finally { local.close(); rmSync(dir, { recursive: true, force: true }); }
});
