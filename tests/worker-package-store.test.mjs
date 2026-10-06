import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerCapabilityPackageStore } from '../dist/apps/worker/src/capability-package-store.js';

test('private local package store requires review and never mutates a published version', () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-package-store-'));
  const capabilityVersionId = randomUUID();
  const pkg = { packageVersion: 1, capabilityId: randomUUID(), capabilityVersionId,
    workerDeviceId: randomUUID(), workerManifest: { manifestVersion: 1,
      workerId: randomUUID(), capabilityVersionId,
      runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
      skills: [], tools: { allow: [], deny: [] }, resources: [],
      network: { default: 'deny', allow: [] }, limits: { timeoutSeconds: 60,
        memoryMb: 1024, cpu: 1, maxPids: 128, maxInputBytes: 1000, maxOutputBytes: 65536 } },
    dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null, alternatives: [],
      nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill', requirement: 'REQUIRED',
        sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
        marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false,
        health: 'UNKNOWN' }] }, permissionPolicy: { policyVersion: 1, aiInference: 'NONE',
      publicInternet: 'DENY', browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
      selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
      shell: false, externalSideEffects: false, buyerFileAccess: false,
      sellerCredentialRefs: [] }, sellerInferenceConfigHash: null,
    ioContract: { contractVersion: 1, input: { schemaVersion: 1, fields: [{ key: 'question',
      label: 'Question', order: 0, required: true, type: 'SHORT_TEXT' }] },
      output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer', order: 0,
        required: true, type: 'SHORT_TEXT' }] } }, priceTier: 'USD_999',
    dependencySnapshot: [], concurrencyLimit: 1, pauseSupport: 'FULL_RESUME',
    exampleRefs: [], testRefs: [] };
  const review = { actorId: 'local:seller', approvedAt: new Date().toISOString(),
    reviewEvidenceHash: `sha256:${'a'.repeat(64)}` };
  try {
    const store = new WorkerCapabilityPackageStore(root);
    assert.throws(() => store.installReviewed(pkg, {}));
    const installed = store.installReviewed(pkg, review);
    assert.equal(store.installReviewed(pkg, review).packageHash, installed.packageHash);
    assert.throws(() => store.installReviewed({ ...pkg, sellerInstructions: 'changed' }, review),
      { code: 'CONFLICT' });
    store.close();
    const reopened = new WorkerCapabilityPackageStore(root);
    assert.deepEqual(reopened.load(capabilityVersionId), pkg);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
