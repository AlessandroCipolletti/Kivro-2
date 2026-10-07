import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import process from 'node:process';
import test from 'node:test';
import { HttpsPollingWorkerTransport, discoverWorkerControlPlanes } from '../dist/packages/infrastructure/netsons/src/https-polling.js';
import { verifyWorkerEnvelopeSignature } from '../dist/packages/worker-protocol/src/auth.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

const workerDeviceId = randomUUID();
const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const signer = { deviceId: workerDeviceId,
  signChallenge(bytes) { return sign(null, bytes, keys.privateKey); } };

test('discovery accepts only bounded HTTPS control planes or explicit loopback development', async () => {
  const fetcher = async (_url, request) => {
    assert.equal(request.redirect, 'manual');
    return new globalThis.Response(JSON.stringify({ discoveryVersion: 1, controlPlanes: [
      { id: 'netsons', state: 'DRAINING', endpoint: 'https://old.kivro.example/' },
      { id: 'aws', state: 'ACTIVE', endpoint: 'https://new.kivro.example/' },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  assert.equal((await discoverWorkerControlPlanes('https://discovery.kivro.example/', { fetcher })).length, 2);
  await assert.rejects(discoverWorkerControlPlanes('http://192.168.1.2/', { fetcher }),
    { code: 'UNTRUSTED_ENDPOINT' });
  await assert.rejects(discoverWorkerControlPlanes('http://127.0.0.1:3000/', { fetcher }),
    { code: 'UNTRUSTED_ENDPOINT' });
  assert.equal((await discoverWorkerControlPlanes('http://127.0.0.1:3000/',
    { fetcher, allowLocalHttp: true })).length, 2);
  const oldMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(discoverWorkerControlPlanes('http://127.0.0.1:3000/',
      { fetcher, allowLocalHttp: true }), { code: 'UNTRUSTED_ENDPOINT' });
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldMode;
  }
  await assert.rejects(discoverWorkerControlPlanes('https://discovery.kivro.example/', {
    fetcher: async () => new globalThis.Response(null, { status: 302, headers: { location: 'https://other.example/' } }),
  }), { code: 'DISCOVERY_FAILED' });
});

test('outbound polling signs strict safe metadata and rejects cross-plane or oversized responses', async () => {
  const calls = [];
  const fetcher = async (url, request) => {
    calls.push({ url: String(url), request });
    const payload = JSON.parse(request.body);
    assert.equal(verifyWorkerEnvelopeSignature(publicKey, payload.envelope, payload.body).workerDeviceId,
      workerDeviceId);
    if (String(url).endsWith('/worker/messages')) return new globalThis.Response(null, { status: 204 });
    return new globalThis.Response(JSON.stringify({ protocolVersion: WORKER_PROTOCOL_VERSION, messages: [{
      type: 'WORKER_WELCOME', messageId: randomUUID(), controlPlaneId: 'plane-a',
      selectedProtocolVersion: WORKER_PROTOCOL_VERSION, controlPlaneState: 'ACTIVE',
      serverTime: new Date().toISOString(),
      pauseDirective:{revision:0,paused:false,securityPaused:false,capabilityPauses:[]},
    }] }), { status: 200 });
  };
  const transport = new HttpsPollingWorkerTransport('plane-a', 'https://plane.kivro.example/',
    signer, { fetcher });
  const beat = { type: 'WORKER_HEARTBEAT', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', workerDeviceId,
    workerRelease: '0.0.0-dev', openClawVersion: null, status: 'ONLINE',
    runningJobs: 0, capacity: 1, policyVersion: 1, localRevision: 0 };
  await transport.send(beat);
  await assert.rejects(transport.send({ ...beat, localPath: '/Users/seller/secrets' }));
  await assert.rejects(transport.send({ ...beat, controlPlaneId: 'plane-b' }),
    { code: 'WRONG_CONTROL_PLANE' });
  const hello = { type: 'WORKER_HELLO', messageId: randomUUID(), workerDeviceId,
    controlPlaneId: 'plane-a', supportedProtocolVersions: [WORKER_PROTOCOL_VERSION],
    workerRelease: '0.0.0-dev', localRevision: 0, activeExecutionIds: [] };
  assert.equal((await transport.poll(hello))[0].type, 'WORKER_WELCOME');
  assert.equal(calls.length, 2);
  assert.equal(JSON.stringify(calls).includes('/Users/seller'), false);
  const oversized = new HttpsPollingWorkerTransport('plane-a', 'https://plane.kivro.example/',
    signer, { fetcher: async () => new globalThis.Response('x'.repeat(262_145), { status: 200 }) });
  await assert.rejects(oversized.poll(hello), { code: 'RESPONSE_LIMIT' });
  const omittedPause=new HttpsPollingWorkerTransport('plane-a',
    'https://plane.kivro.example/',signer,{fetcher:async()=>new globalThis.Response(
      JSON.stringify({protocolVersion:WORKER_PROTOCOL_VERSION,messages:[{
        type:'WORKER_WELCOME',messageId:randomUUID(),controlPlaneId:'plane-a',
        selectedProtocolVersion:WORKER_PROTOCOL_VERSION,controlPlaneState:'ACTIVE',
        serverTime:new Date().toISOString()}]}),{status:200})});
  await assert.rejects(omittedPause.poll(hello),{code:'PROTOCOL_MISMATCH'});
});
