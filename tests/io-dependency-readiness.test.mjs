import assert from 'node:assert/strict';
import test from 'node:test';
import { assessInputDependencyReadiness } from '../dist/packages/domain/src/io-dependency-readiness.js';

const contract = { contractVersion: 1,
  input: { schemaVersion: 1, fields: [{ key: 'scene', label: 'Scene', order: 0,
    required: true, type: 'FILE', constraints: { maxFiles: 1,
      maxFileSizeBytes: 1000, maxTotalSizeBytes: 1000,
      allowedMimeTypes: ['application/x-blender'], allowedExtensions: ['.blend'] } }] },
  output: { schemaVersion: 1, fields: [{ key: 'summary', label: 'Summary',
    order: 0, required: true, type: 'SHORT_TEXT' }] } };
const graph = { graphVersion: 1, rootId: 'root', inference: null, alternatives: [],
  nodes: [{ id: 'root', type: 'SKILL', name: 'Renderer', requirement: 'REQUIRED',
    sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
    marketplaceSupport: 'SUPPORTED', confidence: 'CONFIRMED', selected: true,
    health: 'READY' }] };

test('file dependency checks warn without granting or guessing tool readiness', () => {
  assert.deepEqual(assessInputDependencyReadiness(contract, graph).map((issue) => issue.code),
    ['NO_DECLARED_HANDLER']);
  const declared = { ...graph, nodes: [{ ...graph.nodes[0], handlesMimeTypes: ['application/x-blender'],
    selected: false }] };
  assert.deepEqual(assessInputDependencyReadiness(contract, declared).map((issue) => issue.code),
    ['UNSELECTED_HANDLER']);
  declared.nodes[0].selected = true;
  declared.nodes[0].health = 'UNKNOWN';
  assert.deepEqual(assessInputDependencyReadiness(contract, declared).map((issue) => issue.code),
    ['UNVERIFIED_HANDLER']);
  declared.nodes[0].health = 'READY';
  assert.deepEqual(assessInputDependencyReadiness(contract, declared), []);
});
