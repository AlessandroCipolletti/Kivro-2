import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DependencyGraphSchema } from '../dist/packages/contracts/src/dependency-graph.js';
import {
  analyzeDependencyGraph, applySellerSelection, missingPermissionConsents,
} from '../dist/packages/domain/src/dependency-graph.js';

const sellerAccountId = '11111111-1111-4111-8111-111111111111';
const workerDeviceId = '22222222-2222-4222-8222-222222222222';
const capabilityVersionId = '33333333-3333-4333-8333-333333333333';
const manifestHash = `sha256:${'a'.repeat(64)}`;

function node(id, type, dependsOn = [], overrides = {}) {
  return {
    id, type, name: id, requirement: 'REQUIRED', sensitivity: 'LOW',
    discoveredFrom: ['SKILL_METADATA'], dependsOn,
    marketplaceSupport: 'SUPPORTED', confidence: 'CONFIRMED',
    selected: false, health: 'UNKNOWN', ...overrides,
  };
}

function graph() {
  return {
    graphVersion: 1, rootId: 'research', inference: null,
    nodes: [
      node('research', 'SKILL', ['company-db', 'model']),
      node('company-db', 'DATABASE', [], { sensitivity: 'HIGH' }),
      node('model', 'AI_MODEL', ['credential']),
      node('credential', 'CREDENTIAL', [], { sensitivity: 'HIGH' }),
    ],
  };
}

function select(input, dependencyId) {
  return applySellerSelection(input, {
    sellerAccountId, dependencyId, selected: true,
    actedAt: '2026-10-06T00:00:00.000Z', source: 'SELLER_ACTION',
  });
}

test('selecting a discovered skill never silently selects its DB, inference or credential', () => {
  const selected = select(graph(), 'research');
  assert.deepEqual(selected.nodes.filter((item) => item.selected).map((item) => item.id), ['research']);
  const issues = analyzeDependencyGraph(selected).issues;
  assert.deepEqual(issues.filter((issue) => issue.code === 'REQUIRED_NOT_SELECTED').map((item) => item.dependencyId),
    ['company-db', 'credential', 'model']);
  assert.ok(issues.some((item) => item.code === 'INFERENCE_UNDECLARED'));
  assert.equal(analyzeDependencyGraph(selected).publishable, false);
  assert.ok(Object.isFrozen(selected.nodes[0]));
});

test('inference, selected dependencies and real health are all required before graph readiness', () => {
  let current = graph();
  for (const id of ['research', 'company-db', 'model', 'credential']) current = select(current, id);
  current = { ...current, inference: {
    mode: 'REMOTE_PROVIDER', dependencyId: 'model', provider: 'anthropic', model: 'claude',
    credentialRef: 'credential', billingOwner: 'SELLER',
  } };
  assert.deepEqual(analyzeDependencyGraph(current).issues.map((item) => item.code),
    ['HEALTH_UNKNOWN', 'HEALTH_UNKNOWN', 'HEALTH_UNKNOWN', 'HEALTH_UNKNOWN']);
  const healthy = { ...current, nodes: current.nodes.map((item) => ({ ...item, health: 'READY' })) };
  assert.deepEqual(analyzeDependencyGraph(healthy), { issues: [], publishable: true });
  const missingCredential = { ...healthy, nodes: healthy.nodes.map((item) => item.id === 'credential'
    ? { ...item, selected: false } : item) };
  assert.ok(analyzeDependencyGraph(missingCredential).issues.some((item) => item.code === 'INFERENCE_CREDENTIAL_NOT_SELECTED'));
});

test('blocked, unsupported, uncertain and cyclic dependencies cannot be silently published', () => {
  const blocked = graph();
  blocked.nodes[1].marketplaceSupport = 'UNSUPPORTED';
  assert.throws(() => select(blocked, 'company-db'), /Unsupported dependency/);
  blocked.nodes[1].selected = true;
  assert.ok(analyzeDependencyGraph(blocked).issues.some((item) => item.code === 'UNSUPPORTED_DEPENDENCY'));
  const cyclic = graph();
  cyclic.nodes[1].dependsOn = ['research'];
  assert.ok(analyzeDependencyGraph(cyclic).issues.some((item) => item.code === 'DEPENDENCY_CYCLE'));
  const uncertain = graph();
  uncertain.nodes[0].selected = true;
  uncertain.nodes[0].confidence = 'UNKNOWN';
  assert.ok(analyzeDependencyGraph(uncertain).issues.some((item) => item.code === 'DEPENDENCY_UNCERTAIN'));
});

test('schema rejects dangling edges, duplicate IDs and duplicate edges', () => {
  const dangling = graph();
  dangling.nodes[0].dependsOn = ['missing'];
  assert.equal(DependencyGraphSchema.safeParse(dangling).success, false);
  const duplicate = graph();
  duplicate.nodes.push({ ...duplicate.nodes[0] });
  assert.equal(DependencyGraphSchema.safeParse(duplicate).success, false);
  const duplicateEdge = graph();
  duplicateEdge.nodes[0].dependsOn.push('model');
  assert.equal(DependencyGraphSchema.safeParse(duplicateEdge).success, false);
});

test('any-of binary declarations require one explicit choice rather than all alternatives', () => {
  const input = graph();
  input.nodes[0].dependsOn.push('curl', 'wget');
  input.nodes.push(node('curl', 'SYSTEM_BINARY', [], { requirement: 'OPTIONAL' }));
  input.nodes.push(node('wget', 'SYSTEM_BINARY', [], { requirement: 'OPTIONAL' }));
  input.alternatives = [{ groupId: 'any-http-client', candidateIds: ['curl', 'wget'], requirement: 'REQUIRED' }];
  const rootSelected = select(input, 'research');
  assert.ok(analyzeDependencyGraph(rootSelected).issues.some((item) => item.code === 'ALTERNATIVE_UNSELECTED'));
  const oneSelected = select(rootSelected, 'curl');
  assert.ok(!analyzeDependencyGraph(oneSelected).issues.some((item) => item.code === 'ALTERNATIVE_UNSELECTED'));
  assert.equal(oneSelected.nodes.find((item) => item.id === 'wget').selected, false);
});

test('consent is tied to seller, Worker, version and exact manifest hash', () => {
  let current = graph();
  for (const id of ['research', 'company-db']) current = select(current, id);
  const context = { sellerAccountId, workerDeviceId, capabilityVersionId, manifestHash };
  const consent = (dependencyId, overrides = {}) => ({
    ...context, dependencyId, permissionType: dependencyId === 'research' ? 'SKILL' : 'DATABASE',
    permissionValueRef: dependencyId, approvedAt: '2026-10-06T00:00:00.000Z',
    source: 'SELLER_ACTION', ...overrides,
  });
  assert.deepEqual(missingPermissionConsents(current, [], context), ['company-db', 'research']);
  assert.deepEqual(missingPermissionConsents(current, [consent('research'),
    consent('company-db', { manifestHash: `sha256:${'b'.repeat(64)}` })], context), ['company-db']);
  assert.deepEqual(missingPermissionConsents(current, [consent('research'), consent('company-db')], context), []);
  assert.deepEqual(missingPermissionConsents(current, [consent('research', { sellerAccountId: workerDeviceId })], context),
    ['company-db', 'research']);
});
