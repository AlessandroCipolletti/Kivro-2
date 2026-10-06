import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { DeclaredApiBroker } from '../dist/packages/application/src/declared-api-broker.js';

const policy = { version: 1, mode: 'DECLARED_API_ACCESS', connectors: [{ id: 'ads.search',
  host: 'api.example.com', method: 'POST', path: '/search', maxRequestsPerJob: 2,
  maxRequestBytes: 200, maxResponseBytes: 200 }] };
const binding = { jobId: '00000000-0000-4000-8000-000000000001',
  capabilityVersionId: '00000000-0000-4000-8000-000000000002', internetPolicy: policy };

test('declared typed POST connector is narrow, read-only and version matched', async () => {
  const observed = [];
  const connector = { id: 'ads.search', host: 'api.example.com', method: 'POST', path: '/search',
    sideEffect: 'READ_ONLY', input: z.strictObject({ company: z.string().min(1).max(50) }),
    output: z.strictObject({ count: z.number().int() }),
    async invoke(input) { observed.push(input); return { count: 2 }; } };
  const audit = { async begin(input) { observed.push(input); }, async finish(input) { observed.push(input); },
    async deny(input) { observed.push(input); } };
  const broker = new DeclaredApiBroker(new Map([[connector.id, connector]]), audit);
  assert.deepEqual(await broker.invoke(binding, { connectorId: 'ads.search', parameters: { company: 'Acme' } }), { count: 2 });
  assert.equal(observed[0].host, 'api.example.com');
  assert.equal(observed[2].status, 'ALLOWED');
  await assert.rejects(broker.invoke(binding, { connectorId: 'ads.search', parameters: { company: 'Acme', url: 'http://localhost' } }));
  await assert.rejects(broker.invoke(binding, { connectorId: 'evil.send', parameters: {} }), /NETWORK_POLICY_DENIED/);
  const mutated = new DeclaredApiBroker(new Map([[connector.id, { ...connector, host: 'evil.example.com' }]]), audit);
  await assert.rejects(mutated.invoke(binding, { connectorId: 'ads.search', parameters: { company: 'Acme' } }), /NETWORK_POLICY_DENIED/);
  const sideEffect = new DeclaredApiBroker(new Map([[connector.id, { ...connector, sideEffect: 'SIDE_EFFECTING' }]]), audit);
  await assert.rejects(sideEffect.invoke(binding, { connectorId: 'ads.search', parameters: { company: 'Acme' } }), /NETWORK_POLICY_DENIED/);
});
