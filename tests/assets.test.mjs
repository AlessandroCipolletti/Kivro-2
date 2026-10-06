import assert from 'node:assert/strict';
import test from 'node:test';
import { AssetRecordSchema, newPrivateAssetKey } from '../dist/packages/contracts/src/assets.js';
import { mayReadPrivateAsset } from '../dist/packages/domain/src/assets.js';

const owner = '781f0b90-8472-4a80-a51c-2807d132fd79';
const stranger = '7807b6dc-be75-411b-8952-f2d91cc3ef40';
const assetId = 'ec1868ca-f451-4c9b-a424-40b17ea281fa';
const jobId = 'df4c02f3-075c-4a50-ae1d-0a0db954713b';
const workerId = 'bc068bea-057c-4b27-9910-b52d93783083';
const now = new Date('2026-10-06T12:00:00Z');
const asset = { id: assetId, ownerAccountId: owner, sourceJobId: null, kind: 'BUYER_INPUT',
  state: 'READY', objectKey: newPrivateAssetKey(assetId), sizeBytes: 10,
  sha256: `sha256:${'a'.repeat(64)}`, detectedMimeType: 'image/png',
  retainUntil: '2026-10-20T12:00:00Z' };
const grant = { assetId, targetJobId: jobId, expiresAt: '2026-10-07T12:00:00Z', revokedAt: null };
const job = { id: jobId, buyerAccountId: owner, workerDeviceId: workerId,
  status: 'RUNNING', paymentSecured: true, workerActive: true };

test('private object keys omit filenames and owner identity', () => {
  assert.match(asset.objectKey, /^private\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
  assert.ok(!asset.objectKey.includes(owner));
  assert.equal(AssetRecordSchema.safeParse({ ...asset,
    objectKey: newPrivateAssetKey(stranger) }).success, false);
});

test('only owning buyer or explicitly granted assigned Worker can read retained ready asset', () => {
  assert.equal(mayReadPrivateAsset(asset, { type: 'BUYER', accountId: owner }, now), true);
  assert.equal(mayReadPrivateAsset(asset, { type: 'BUYER', accountId: stranger }, now), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'WORKER', workerDeviceId: workerId }, now, grant, job), true);
  assert.equal(mayReadPrivateAsset(asset, { type: 'WORKER', workerDeviceId: stranger }, now, grant, job), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'WORKER', workerDeviceId: workerId }, now,
    { ...grant, targetJobId: stranger }, job), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'WORKER', workerDeviceId: workerId }, now,
    { ...grant, revokedAt: '2026-10-06T11:00:00Z' }, job), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'WORKER', workerDeviceId: workerId }, now, grant,
    { ...job, paymentSecured: false }), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'WORKER', workerDeviceId: workerId }, now, grant,
    { ...job, status: 'COMPLETED' }), false);
  assert.equal(mayReadPrivateAsset({ ...asset, state: 'EXPIRED' }, { type: 'BUYER', accountId: owner }, now), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'BUYER', accountId: owner }, new Date('2026-10-21T00:00:00Z')), false);
  assert.equal(mayReadPrivateAsset(asset, { type: 'BUYER', accountId: owner }, new Date('invalid')), false);
});
