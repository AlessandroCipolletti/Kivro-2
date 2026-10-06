import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DeviceIdentityError, EncryptedDeviceIdentityStore, verifyDeviceSignature } from '../dist/apps/worker/src/device-identity.js';

test('persistent Ed25519 identity signs challenges and keeps private material encrypted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-device-'));
  chmodSync(dir, 0o700);
  try {
    const store = new EncryptedDeviceIdentityStore(dir);
    const publicIdentity = store.create('long unique test passphrase for identity');
    assert.equal(store.readPublic().deviceId, publicIdentity.deviceId);
    const file = readFileSync(join(dir, 'device-identity.json'), 'utf8');
    assert.doesNotMatch(file, /BEGIN PRIVATE KEY|long unique test passphrase/);
    const signer = new EncryptedDeviceIdentityStore(dir).unlock('long unique test passphrase for identity');
    const challenge = randomBytes(32);
    assert.equal(verifyDeviceSignature(signer.publicKeyPem, challenge, signer.signChallenge(challenge)), true);
    assert.equal(verifyDeviceSignature(signer.publicKeyPem, randomBytes(32), signer.signChallenge(challenge)), false);
    assert.throws(() => store.create('another long passphrase for identity'), { code: 'ALREADY_EXISTS' });
    assert.throws(() => store.unlock('wrong but sufficiently long passphrase'), { code: 'INVALID_PASSPHRASE' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('private key file with broad permissions is rejected before reading', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-device-'));
  chmodSync(dir, 0o700);
  try {
    const store = new EncryptedDeviceIdentityStore(dir);
    store.create('long unique test passphrase for identity');
    chmodSync(join(dir, 'device-identity.json'), 0o644);
    assert.throws(() => store.readPublic(), DeviceIdentityError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
