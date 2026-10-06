import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVersionCandidate, createJobContractSnapshot } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { priceForTier } from '../dist/packages/domain/src/pricing.js';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

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
const dependencyGraph = {
  graphVersion: 1, rootId: 'document-analyzer', inference: null, alternatives: [],
  nodes: [{ id: 'document-analyzer', type: 'SKILL', name: 'Document Analyzer', requirement: 'REQUIRED',
    sensitivity: 'MEDIUM', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
    marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false, health: 'UNKNOWN' }],
};
const localPackage = {
  packageVersion: 1, capabilityId: id, capabilityVersionId: nextId, workerDeviceId: id,
  workerManifest: manifest, dependencyGraph, permissionPolicy: policy,
  sellerInferenceConfigHash: null, ioContract, priceTier: 'USD_999', dependencySnapshot: [],
  concurrencyLimit: 1, exampleRefs: [], testRefs: [],
  pauseSupport: 'NOT_SUPPORTED',
};
const input = {
  id: nextId, capabilityId: id, versionNumber: 1, workerDeviceId: id,
  requestedAt: '2026-10-06T12:00:00Z', localPackage,
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
  source.localPackage.ioContract.input.fields[0].label = 'Changed later';
  source.localPackage.workerManifest.limits.timeoutSeconds = 999;
  assert.equal(version.ioContract.input.fields[0].label, 'Question');
  assert.equal(version.resourceLimits.timeoutSeconds, 120);
  assert.match(version.dependencyGraphHash, /^sha256:[a-f0-9]{64}$/);
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
  assert.throws(() => buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    workerManifest: { ...manifest, capabilityVersionId: id } } }));
  assert.throws(() => buildVersionCandidate({ ...input, localPackage: { ...localPackage, priceTier: 'USD_1234' } }));
  assert.throws(() => buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    permissionPolicy: { ...policy, credentialValue: 'secret' } } }));
  assert.throws(() => buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    sellerInferenceConfigHash: hash } }));
  assert.throws(() => buildVersionCandidate({ ...input, workerDeviceId: nextId }));
});

test('full local graph is frozen by a candidate hash while the cloud candidate stays sanitized', () => {
  const before = buildVersionCandidate(input);
  const changed = buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    dependencyGraph: { ...dependencyGraph, nodes: [{ ...dependencyGraph.nodes[0], name: 'Revised' }] },
  } });
  assert.notEqual(changed.localPackageHash, before.localPackageHash);
  assert.notEqual(changed.dependencyGraphHash, before.dependencyGraphHash);
  assert.equal(JSON.stringify(before).includes('Document Analyzer'), false);
});

test('public research policy is pinned in the sanitized published/job snapshot without seller secrets', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/m06-advertising-capability.json', import.meta.url), 'utf8'));
  const candidate = buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    permissionPolicy: { ...policy, publicInternet: 'PUBLIC_RESEARCH_BROKER', internet: fixture.internetPolicy },
  } });
  assert.equal(candidate.publicResearchPolicy.mode, 'PUBLIC_WEB_RESEARCH');
  const publishedFields = JSON.parse(JSON.stringify(candidate));
  delete publishedFields.requestedAt;
  const published = PublishedCapabilityVersionSchema.parse({ ...publishedFields,
    publicationState: 'PUBLISHED', publishedAt: '2026-10-06T12:30:00Z', policyValidationHash: hash,
  });
  const job = createJobContractSnapshot(published, id, id, '2026-10-06T13:00:00Z');
  assert.deepEqual(job.publicResearchPolicySnapshot, fixture.internetPolicy);
  assert.doesNotMatch(JSON.stringify(job), /seller:|credentialRef|privateDatabase/);
});

test('networked package cannot publish from a coarse permission or unselected connector', () => {
  assert.throws(() => buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    permissionPolicy: { ...policy, publicInternet: 'PUBLIC_RESEARCH_BROKER' },
  } }), /Networked capability requires detailed Internet policy/);
  const connectorPolicy = { version: 1, mode: 'DECLARED_API_ACCESS', connectors: [{ id: 'ads.search',
    host: 'api.example.com', method: 'POST', path: '/search', maxRequestsPerJob: 2,
    maxRequestBytes: 100, maxResponseBytes: 1000 }] };
  assert.throws(() => buildVersionCandidate({ ...input, localPackage: { ...localPackage,
    permissionPolicy: { ...policy, publicInternet: 'DECLARED_DOMAINS', internet: connectorPolicy },
  } }), /Declared API connector is not selected/);
});
