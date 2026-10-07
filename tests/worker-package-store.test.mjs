import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerCapabilityPackageStore } from '../dist/apps/worker/src/capability-package-store.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { readLocalPermissionReview } from '../dist/apps/worker/src/import-permission-review.js';

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
    const nextVersionId = randomUUID();
    const next = { ...pkg, capabilityVersionId: nextVersionId,
      workerManifest: { ...pkg.workerManifest, capabilityVersionId: nextVersionId,
        tools: { allow: ['browser'], deny: [] } },
      permissionPolicy: { ...pkg.permissionPolicy, browser: true,
        sellerCredentialRefs: ['seller:extra'] } };
    reopened.installReviewed(next, review);
    const local = readLocalPermissionReview(root, pkg.workerDeviceId, nextVersionId,
      capabilityVersionId);
    assert.equal(local.previousVersionId, capabilityVersionId);
    assert.equal(local.packageHash, hashCanonicalJson(next));
    assert.equal(local.permissionPolicy.sellerCredentialRefs[0], 'seller:extra');
    assert.deepEqual(local.newOrChangedAccess.filter((item) => item.kind === 'TOOL'),
      [{ kind: 'TOOL', reference: 'browser' }]);
    assert.deepEqual(local.newOrChangedAccess.filter((item) =>
      item.kind === 'CREDENTIAL_REFERENCE'),
    [{ kind: 'CREDENTIAL_REFERENCE', reference: 'seller:extra' }]);
    assert.throws(() => readLocalPermissionReview(root, randomUUID(), nextVersionId),
      { code: 'PACKAGE_OWNER_MISMATCH' });
    const otherVersionId = randomUUID();
    const other = { ...pkg, capabilityId: randomUUID(),
      capabilityVersionId: otherVersionId,
      workerManifest: { ...pkg.workerManifest, capabilityVersionId: otherVersionId } };
    reopened.installReviewed(other, review);
    assert.throws(() => readLocalPermissionReview(root, pkg.workerDeviceId,
      nextVersionId, other.capabilityVersionId), { code: 'VERSION_MISMATCH' });
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reviewed skill bytes are pinned, private, immutable and required for dispatch', () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-skill-store-'));
  const versionId = randomUUID();
  const bytes = Buffer.from('---\nname: selected\n---\nOnly the approved task.\n');
  const contentHash = hashCanonicalJson([{ path: 'SKILL.md',
    sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }]);
  const selected = [{ name: 'selected', files: [{ path: 'SKILL.md',
    bytesBase64: bytes.toString('base64') }] }];
  const pkg = { packageVersion: 1, capabilityId: randomUUID(), capabilityVersionId: versionId,
    workerDeviceId: randomUUID(), workerManifest: { manifestVersion: 1,
      workerId: randomUUID(), capabilityVersionId: versionId,
      runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
      skills: [{ name: 'selected', contentHash }], tools: { allow: [], deny: [] },
      resources: [], network: { default: 'deny', allow: [] },
      limits: { timeoutSeconds: 60, memoryMb: 1024, cpu: 1, maxPids: 128,
        maxInputBytes: 1000, maxOutputBytes: 65536 } },
    dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null, alternatives: [],
      nodes: [{ id: 'skill', type: 'SKILL', name: 'selected', requirement: 'REQUIRED',
        sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
        marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false,
        health: 'UNKNOWN' }] },
    permissionPolicy: { policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY',
      browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
      selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
      shell: false, externalSideEffects: false, buyerFileAccess: false,
      sellerCredentialRefs: [] }, sellerInferenceConfigHash: null,
    ioContract: { contractVersion: 1,
      input: { schemaVersion: 1, fields: [{ key: 'question', label: 'Question',
        order: 0, required: true, type: 'SHORT_TEXT' }] },
      output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer',
        order: 0, required: true, type: 'SHORT_TEXT' }] } },
    priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
    pauseSupport: 'FULL_RESUME', exampleRefs: [], testRefs: [] };
  const review = { actorId: 'local:seller', approvedAt: new Date().toISOString(),
    reviewEvidenceHash: `sha256:${'a'.repeat(64)}` };
  const store = new WorkerCapabilityPackageStore(root);
  try {
    assert.throws(() => store.installReviewed(pkg, review), { code: 'CORRUPT' });
    assert.throws(() => store.installReviewed(pkg, review, [{ ...selected[0],
      files: [{ path: 'SKILL.md', bytesBase64: Buffer.from('changed').toString('base64') }] }]),
    { code: 'CORRUPT' });
    assert.equal(store.listInstalled().length, 0);
    store.installReviewed(pkg, review, selected);
    assert.deepEqual(store.loadReviewedSkills(versionId), selected);
    assert.equal(store.installReviewed(pkg, review, selected).packageHash, hashCanonicalJson(pkg));
    assert.throws(() => store.installReviewed(pkg, review, [{ ...selected[0], files: [
      { path: 'SKILL.md', bytesBase64: Buffer.from('other').toString('base64') }] }]),
    { code: 'CORRUPT' });
    assert.equal(store.listInstalled().length, 1);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
