/* global URL, Response */
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import test from 'node:test';
import { HttpsPollingWorkerTransport } from
  '../dist/packages/infrastructure/netsons/src/https-polling.js';
import { NetsonsWorkerJobCloud } from '../dist/packages/infrastructure/netsons/src/job-cloud.js';
import { verifyWorkerEnvelopeSignature } from '../dist/packages/worker-protocol/src/auth.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

test('Netsons job RPC signs fixed requests and propagates authoritative payment denial', async () => {
  const keys = generateKeyPairSync('ed25519');
  const workerDeviceId = randomUUID();
  const signer = { deviceId: workerDeviceId,
    signChallenge(bytes) { return sign(null, bytes, keys.privateKey); } };
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const paths = [];
  const transport = new HttpsPollingWorkerTransport('plane-a', 'https://plane.kivro.example/',
    signer, { fetcher: async (url, request) => {
      assert.equal(request.method, 'POST'); assert.equal(request.redirect, 'manual');
      paths.push(new URL(url).pathname);
      const signed = JSON.parse(request.body);
      assert.equal(verifyWorkerEnvelopeSignature(publicKey, signed.envelope, signed.body)
        .workerDeviceId, workerDeviceId);
      if (new URL(url).pathname.endsWith('renew-lease')) {
        return new Response(JSON.stringify({ code: 'PAYMENT_NOT_SECURED' }), { status: 403 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } });
  const cloud = new NetsonsWorkerJobCloud(transport);
  const digest = `sha256:${'a'.repeat(64)}`;
  const offer = { type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', jobId: randomUUID(),
    executionId: randomUUID(), attemptId: randomUUID(), workerDeviceId,
    capabilityId: randomUUID(), capabilityVersionId: randomUUID(),
    inputManifestId: randomUUID(), paymentReservationId: randomUUID(),
    workerManifestHash: digest, localPackageHash: digest, permissionPolicyHash: digest,
    policyValidationHash: digest, inputSchemaHash: digest, inputManifestHash: digest,
    inputTotalBytes: 10, inputFileCount: 0, pauseSupport: 'FULL_RESUME',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    leaseToken: 'x'.repeat(32), paymentSecured: true };
  await cloud.accept(offer, randomUUID());
  await assert.rejects(cloud.renewLease(offer, 60), { code: 'PAYMENT_NOT_SECURED' });
  assert.deepEqual(paths, ['/worker/jobs/accept', '/worker/jobs/renew-lease']);
  await assert.rejects(cloud.accept({ ...offer, controlPlaneId: 'other' }, randomUUID()),
    { code: 'WRONG_CONTROL_PLANE' });
  assert.equal(paths.length, 2);
});
