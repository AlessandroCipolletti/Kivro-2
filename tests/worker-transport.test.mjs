import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { WorkerTransportRouter } from '../dist/packages/worker-protocol/src/transport.js';

test('mixed polling/WSS connections keep old executions on their original control plane', async () => {
  const sent = [];
  const transport = (controlPlaneId, kind) => ({ controlPlaneId, kind,
    supportedProtocolVersions: ['kivro-worker/1'],
    async send(message) { sent.push([controlPlaneId, message]); }, async close() {} });
  const router = new WorkerTransportRouter();
  router.connect(transport('old', 'HTTPS_POLLING'), 'ACTIVE');
  const oldId = randomUUID();
  router.ownExecution(oldId, 'old');
  router.markDraining('old');
  router.connect(transport('new', 'WEBSOCKET'), 'ACTIVE');
  const newId = randomUUID();
  router.ownExecution(newId, 'new');
  await router.sendForExecution(oldId, { type: 'OLD_JOB_ACK' });
  await router.sendForExecution(newId, { type: 'NEW_JOB_ACK' });
  assert.deepEqual(sent.map(([plane]) => plane), ['old', 'new']);
  assert.throws(() => router.ownExecution(randomUUID(), 'old'), { code: 'RETIRED_CONTROL_PLANE' });
  assert.throws(() => router.restoreExecution(oldId, 'new'), { code: 'WRONG_CONTROL_PLANE' });
  router.releaseExecution(oldId);
  await router.disconnect('old');
  await assert.rejects(router.sendForExecution(oldId, {}), { code: 'UNKNOWN_CONTROL_PLANE' });
});

test('unknown protocol is rejected before a session can carry jobs', () => {
  const router = new WorkerTransportRouter();
  assert.throws(() => router.connect({ controlPlaneId: 'x', kind: 'WEBSOCKET',
    supportedProtocolVersions: ['kivro-worker/99'], async send() {}, async close() {} }, 'ACTIVE'),
  { code: 'INCOMPATIBLE_PROTOCOL' });
});
