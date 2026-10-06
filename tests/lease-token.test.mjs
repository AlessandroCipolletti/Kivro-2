import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { HmacLeaseTokenIssuer, leaseTokenIssuerFromEnvironment } from '../dist/packages/application/src/lease-token.js';

const key = (value) => Buffer.alloc(32, value).toString('base64');
const identity = () => ({ executionId: randomUUID(), jobId: randomUUID(),
  attemptId: randomUUID(), workerDeviceId: randomUUID(), controlPlaneId: 'plane-a', keyVersion: 'v1' });

test('lease token survives process restart and old key rotation without changing ownership', () => {
  const first = leaseTokenIssuerFromEnvironment({ KIVRO_LEASE_KEY_VERSION: 'v1',
    KIVRO_LEASE_KEY_BASE64: key(1) });
  const claim = identity();
  const token = first.derive(claim);
  const rotated = leaseTokenIssuerFromEnvironment({ KIVRO_LEASE_KEY_VERSION: 'v2',
    KIVRO_LEASE_KEY_BASE64: key(2), KIVRO_LEASE_PREVIOUS_KEYS_JSON: JSON.stringify({ v1: key(1) }) });
  assert.equal(rotated.derive(claim), token);
  assert.notEqual(rotated.derive({ ...claim, controlPlaneId: 'plane-b' }), token);
  assert.throws(() => new HmacLeaseTokenIssuer({ v2: Buffer.alloc(32, 2) }, 'v2').derive(claim),
    /LEASE_KEY_UNAVAILABLE/);
});

test('lease key configuration rejects absent, weak and noncanonical secrets', () => {
  const base = { KIVRO_LEASE_KEY_VERSION: 'v1' };
  assert.throws(() => leaseTokenIssuerFromEnvironment(base));
  assert.throws(() => leaseTokenIssuerFromEnvironment({ ...base, KIVRO_LEASE_KEY_BASE64: key(1).slice(0, 20) }));
  assert.throws(() => leaseTokenIssuerFromEnvironment({ ...base, KIVRO_LEASE_KEY_BASE64: key(1),
    KIVRO_LEASE_PREVIOUS_KEYS_JSON: JSON.stringify({ v1: key(1) }) }));
});
