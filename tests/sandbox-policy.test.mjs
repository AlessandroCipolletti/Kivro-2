import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOfflineSandboxPlan } from '../dist/packages/policy-engine/src/sandbox.js';

const id = '247e28b9-10df-4604-bbeb-1d38c5fdc42b';
const image = `alpine@sha256:${'a'.repeat(64)}`;
const otherImage = `alpine@sha256:${'b'.repeat(64)}`;
const manifest = {
  manifestVersion: 1, workerId: id, capabilityVersionId: id,
  runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
  skills: [], tools: { allow: [], deny: ['browser', 'exec', 'gateway'] }, resources: [],
  network: { default: 'deny', allow: [] },
  limits: { timeoutSeconds: 30, memoryMb: 256, cpu: 1, maxPids: 64,
    maxInputBytes: 1024, maxOutputBytes: 1024 },
};
const policy = {
  policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY', browser: false,
  proprietaryDatabase: 'NONE', privateApi: 'NONE', selectedFileResourceIds: [],
  selectedDirectoryResourceIds: [], localSoftware: false, shell: false,
  externalSideEffects: false, buyerFileAccess: false, sellerCredentialRefs: [],
};

test('offline sandbox plan fixes deny-default Docker controls and platform limits', () => {
  const plan = buildOfflineSandboxPlan(manifest, policy, image, image);
  assert.equal(plan.networkMode, 'none');
  assert.equal(plan.readOnlyRoot, true);
  assert.deepEqual(plan.capDrop, ['ALL']);
  assert.equal(plan.noNewPrivileges, true);
  assert.equal(plan.seccomp, 'builtin');
  assert.equal(plan.runAs, '65532:65532');
  assert.equal(plan.maxRuntimeSeconds, 30);
  assert.ok(Object.isFrozen(plan));
});

test('offline profile refuses unapproved image, network, inference, resources, browser and tools', () => {
  assert.throws(() => buildOfflineSandboxPlan(manifest, policy, image, otherImage), { code: 'IMAGE_NOT_APPROVED' });
  assert.throws(() => buildOfflineSandboxPlan({ ...manifest, network: { default: 'deny',
    allow: [{ host: 'api.example.test', ports: [443], purpose: 'provider' }] } }, policy, image, image),
  { code: 'NETWORK_BROKER_REQUIRED' });
  assert.throws(() => buildOfflineSandboxPlan(manifest, { ...policy, aiInference: 'SELLER' }, image, image),
    { code: 'NETWORK_BROKER_REQUIRED' });
  assert.throws(() => buildOfflineSandboxPlan(manifest, { ...policy, selectedFileResourceIds: ['seller-file'] }, image, image),
    { code: 'RESOURCE_BROKER_REQUIRED' });
  assert.throws(() => buildOfflineSandboxPlan(manifest, { ...policy, browser: true }, image, image),
    { code: 'BROWSER_UNSUPPORTED' });
  assert.throws(() => buildOfflineSandboxPlan({ ...manifest, tools: { allow: ['exec'], deny: [] } }, policy, image, image),
    { code: 'TOOL_UNSUPPORTED' });
  assert.throws(() => buildOfflineSandboxPlan({ ...manifest, limits: { ...manifest.limits, memoryMb: 8192 } }, policy, image, image),
    { code: 'LIMIT_EXCEEDED' });
});
