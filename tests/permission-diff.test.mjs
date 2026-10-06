import assert from 'node:assert/strict';
import test from 'node:test';
import { securitySurfaceExpansion } from '../dist/packages/policy-engine/src/permission-diff.js';

const digest = `sha256:${'a'.repeat(64)}`;
const uuid = '2f5f7789-e280-45a7-b472-6adb82111d36';
const basePolicy = {
  policyVersion: 1, aiInference: 'SELLER', publicInternet: 'DECLARED_DOMAINS', browser: false,
  proprietaryDatabase: 'NONE', privateApi: 'NONE', selectedFileResourceIds: ['file-a'],
  selectedDirectoryResourceIds: [], localSoftware: false, shell: false,
  externalSideEffects: false, buyerFileAccess: false, sellerCredentialRefs: ['seller:inference-a'],
};
const baseManifest = {
  manifestVersion: 1, workerId: uuid, capabilityVersionId: uuid,
  runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
  skills: [{ name: 'research', contentHash: digest }],
  tools: { allow: ['safe-read'], deny: ['browser'] },
  resources: [{ id: 'file-a', type: 'selected-file', permissions: ['read'] }],
  network: { default: 'deny', allow: [{ host: 'api.example.test', ports: [443], purpose: 'research' }] },
  limits: { timeoutSeconds: 60, memoryMb: 512, cpu: 1, maxPids: 64, maxInputBytes: 100, maxOutputBytes: 100 },
};
const root = {
  id: 'root', type: 'SKILL', name: 'research', requirement: 'REQUIRED', sensitivity: 'MEDIUM',
  discoveredFrom: ['SKILL_METADATA'], dependsOn: [], marketplaceSupport: 'SUPPORTED',
  confidence: 'CONFIRMED', selected: true, health: 'READY',
};
const baseGraph = { graphVersion: 1, rootId: 'root', inference: null, nodes: [root], alternatives: [] };
const base = { permissionPolicy: basePolicy, workerManifest: baseManifest, dependencyGraph: baseGraph };

test('security surface diff detects exact new references even with unchanged public categories', () => {
  const next = {
    permissionPolicy: { ...basePolicy,
      selectedFileResourceIds: ['file-b'], sellerCredentialRefs: ['seller:inference-b'] },
    workerManifest: { ...baseManifest,
      skills: [{ name: 'research', contentHash: `sha256:${'b'.repeat(64)}` }],
      tools: { ...baseManifest.tools, allow: ['safe-read', 'write'] },
      resources: [{ id: 'file-b', type: 'selected-file', permissions: ['read'] }],
      network: { default: 'deny', allow: [
        ...baseManifest.network.allow,
        { host: 'other.example.test', ports: [443], purpose: 'new endpoint' },
      ] },
    },
    dependencyGraph: { ...baseGraph, nodes: [root, { ...root, id: 'new-node', type: 'LOCAL_FILE',
      name: 'file-b', sensitivity: 'HIGH' }] },
  };
  const diff = securitySurfaceExpansion(base, next);
  assert.ok(diff.some((change) => change.kind === 'RESOURCE_REFERENCE' && change.reference === 'file:file-b'));
  assert.ok(diff.some((change) => change.kind === 'CREDENTIAL_REFERENCE' && change.reference === 'seller:inference-b'));
  assert.ok(diff.some((change) => change.kind === 'SKILL' && change.reference === 'research'));
  assert.ok(diff.some((change) => change.kind === 'TOOL' && change.reference === 'write'));
  assert.ok(diff.some((change) => change.kind === 'RESOURCE_PERMISSION' && change.reference === 'file-b'));
  assert.ok(diff.some((change) => change.kind === 'NETWORK_DESTINATION' && change.reference === 'other.example.test:443'));
  assert.ok(diff.some((change) => change.kind === 'DEPENDENCY' && change.reference === 'new-node'));
});

test('identical surface has no expansion and changed inference is reviewed', () => {
  assert.deepEqual(securitySurfaceExpansion(base, globalThis.structuredClone(base)), []);
  const nextGraph = { ...baseGraph, inference: {
    mode: 'LOCAL', dependencyId: 'root', provider: 'local', model: 'test', billingOwner: 'SELLER',
  } };
  const diff = securitySurfaceExpansion(base, { ...base, dependencyGraph: nextGraph });
  assert.deepEqual(diff, [{ kind: 'INFERENCE', reference: 'configuration' }]);
});
