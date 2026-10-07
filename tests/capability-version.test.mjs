import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVersionCandidate, createJobContractSnapshot, describePublicationChanges } from '../dist/packages/domain/src/capability-version.js';
import { randomUUID } from 'node:crypto';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
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
  selectedPrice: { tier:'USD_999',currency:'USD',buyerAmountMinor:999,
    platformFeeMinor:199,sellerEarningMinor:800 },
};

test('publication candidate requires a catalog-selected split and matching tier', () => {
  assert.throws(() => buildVersionCandidate({ ...input,selectedPrice:undefined }));
  assert.throws(() => buildVersionCandidate({ ...input,
    selectedPrice:{...input.selectedPrice,platformFeeMinor:200} }));
  assert.throws(() => buildVersionCandidate({ ...input,
    selectedPrice:{...input.selectedPrice,tier:'USD_299'} }));
});

test('candidate cannot promise step restart before a checkpoint runtime exists',()=>{
  assert.throws(()=>buildVersionCandidate({...input,
    localPackage:{...localPackage,pauseSupport:'RESTART_STEP'}}),
  /RESTART_STEP requires a verified checkpoint runtime/);
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
  const networked={...localPackage,permissionPolicy:{...policy,
    publicInternet:'PUBLIC_RESEARCH_BROKER',internet:fixture.internetPolicy}};
  assert.throws(()=>buildVersionCandidate({...input,externalProcessors:[],localPackage:networked}),
    /External processors must be declared/);
  const candidate = buildVersionCandidate({ ...input, externalProcessors: ['Brave Search'],
    localPackage: networked });
  assert.equal(candidate.publicResearchPolicy.mode, 'PUBLIC_WEB_RESEARCH');
  const publishedFields = JSON.parse(JSON.stringify(candidate));
  delete publishedFields.requestedAt;
  const published = PublishedCapabilityVersionSchema.parse({ ...publishedFields,
    publicationState: 'PUBLISHED', publishedAt: '2026-10-06T12:30:00Z', policyValidationHash: hash,
  });
  const job = createJobContractSnapshot(published, id, id, '2026-10-06T13:00:00Z');
  assert.deepEqual(job.publicResearchPolicySnapshot, fixture.internetPolicy);
  assert.deepEqual(job.externalProcessorsSnapshot,['Brave Search']);
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

test('prepublication diff exposes changed economics, contracts and opaque access changes',()=>{
  const original=buildVersionCandidate(input);
  const publishedFields=JSON.parse(JSON.stringify(original));
  delete publishedFields.requestedAt;
  const current=PublishedCapabilityVersionSchema.parse({...publishedFields,
    publicationState:'PUBLISHED',publishedAt:'2026-10-06T12:30:00Z',
    policyValidationHash:hash});
  const newer=randomUUID();
  const candidate=buildVersionCandidate({...input,id:newer,versionNumber:2,
    localPackage:{...localPackage,capabilityVersionId:newer,priceTier:'USD_1499',
      workerManifest:{...manifest,capabilityVersionId:newer},
      ioContract:{...ioContract,output:{...ioContract.output,fields:[{
        ...ioContract.output.fields[0],label:'Revised answer'}]}},
      permissionPolicy:{...policy,buyerFileAccess:true}},
    selectedPrice:{tier:'USD_1499',currency:'USD',buyerAmountMinor:1499,
      platformFeeMinor:299,sellerEarningMinor:1200}});
  const changes=describePublicationChanges(current,candidate);
  assert.ok(changes.some((item)=>item.includes('buyer $9.99 → $14.99')));
  assert.ok(changes.some((item)=>item.includes('Result output contract changed')));
  assert.ok(changes.some((item)=>item.includes('Detailed permission policy changed')));
  assert.ok(changes.some((item)=>/buyer file access/i.test(item)));
  assert.throws(()=>describePublicationChanges(current,original),/cannot be compared/);
});
