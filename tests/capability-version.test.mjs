import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVersionCandidate, createJobContractSnapshot } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { priceForTier } from '../dist/packages/domain/src/pricing.js';

const id = 'b3451661-a538-4907-8acc-b1cf00e04899';
const nextId = '48ed805a-d11a-4f3a-a601-35014a39e810';
const hash = `sha256:${'a'.repeat(64)}`;
const manifest = {
  manifestVersion: 1, workerId: id, capabilityVersionId: nextId,
  runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
  skills: [{ name: 'document-analyzer', contentHash: hash }],
  tools: { allow: [], deny: ['browser', 'exec', 'gateway'] }, resources: [],
  network: { default: 'deny', allow: [] },
  limits: { timeoutSeconds: 120, memoryMb: 1024, cpu: 1, maxPids: 128, maxInputBytes: 1000, maxOutputBytes: 1000 },
};
const policy = {
  policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY', browser: false,
  proprietaryDatabase: 'NONE', privateApi: 'NONE', selectedFileResourceIds: [],
  selectedDirectoryResourceIds: [], localSoftware: false, shell: false,
  externalSideEffects: false, buyerFileAccess: false, sellerCredentialRefs: [],
};
const ioContract = {
  contractVersion: 1,
  input: { schemaVersion: 1, fields: [{ key: 'question', label: 'Question', order: 0, required: true, type: 'SHORT_TEXT' }] },
  output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer', order: 0, required: true, type: 'LONG_TEXT' }] },
};
const input = {
  id: nextId, capabilityId: id, versionNumber: 1, workerDeviceId: id,
  requestedAt: '2026-10-06T12:00:00Z', workerManifest: manifest,
  localPackageHash: hash, permissionPolicy: policy, sellerInferenceConfigHash: null,
  ioContract, priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
  exampleRefs: [], testRefs: [],
};

test('canonical USD tiers have exact integer buyer, fee and seller amounts', () => {
  const expected = [[99, 19, 80], [299, 59, 240], [499, 99, 400], [999, 199, 800],
    [1499, 299, 1200], [1999, 399, 1600], [2999, 599, 2400], [4999, 999, 4000], [9999, 1999, 8000]];
  const names = ['USD_099', 'USD_299', 'USD_499', 'USD_999', 'USD_1499', 'USD_1999', 'USD_2999', 'USD_4999', 'USD_9999'];
  for (let index = 0; index < names.length; index++) {
    const price = priceForTier(names[index]);
    assert.deepEqual([price.buyerAmountMinor, price.platformFeeMinor, price.sellerEarningMinor], expected[index]);
  }
  assert.throws(() => priceForTier('USD_1234'));
});

test('version candidate is immutable and cannot be used for a job', () => {
  const source = JSON.parse(JSON.stringify(input));
  const version = buildVersionCandidate(source);
  assert.equal(version.publicationState, 'DRAFT');
  assert.throws(() => createJobContractSnapshot(version, id, id, '2026-10-06T13:00:00Z'));
  assert.equal(version.price.buyerAmountMinor, 999);
  assert.ok(Object.isFrozen(version.ioContract.input.fields));
  source.ioContract.input.fields[0].label = 'Changed later';
  source.workerManifest.limits.timeoutSeconds = 999;
  assert.equal(version.ioContract.input.fields[0].label, 'Question');
  assert.equal(version.resourceLimits.timeoutSeconds, 120);
  assert.doesNotMatch(JSON.stringify(version), /sellerCredentialRefs|sellerInstructions|apiKey/);
});

test('historical job snapshot pins only a published version fixture', () => {
  const candidate = buildVersionCandidate(input);
  const fixture = JSON.parse(JSON.stringify(candidate));
  delete fixture.requestedAt;
  const published = PublishedCapabilityVersionSchema.parse({ ...fixture,
    publicationState: 'PUBLISHED', publishedAt: '2026-10-06T12:30:00Z', policyValidationHash: hash,
  });
  const job = createJobContractSnapshot(published, id, id, '2026-10-06T13:00:00Z');
  assert.equal(job.capabilityVersionId, nextId);
  assert.equal(job.priceSnapshot.sellerEarningMinor, 800);
  assert.equal(job.permissionManifestSnapshot.entries.find((entry) => entry.category === 'PUBLIC_INTERNET').state, 'NOT_USED');
  assert.ok(Object.isFrozen(job.permissionManifestSnapshot.entries));
  assert.equal(job.inputContractSnapshot.fields[0].label, 'Question');
});

test('candidate rejects mismatched worker version, arbitrary tier and secret-like fields', () => {
  assert.throws(() => buildVersionCandidate({ ...input, workerManifest: { ...manifest, capabilityVersionId: id } }));
  assert.throws(() => buildVersionCandidate({ ...input, priceTier: 'USD_1234' }));
  assert.throws(() => buildVersionCandidate({ ...input, permissionPolicy: { ...policy, credentialValue: 'secret' } }));
  assert.throws(() => buildVersionCandidate({ ...input, sellerInferenceConfigHash: hash }));
});
