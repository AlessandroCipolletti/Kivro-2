import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DeviceIdentityError, EncryptedDeviceIdentityStore, KeychainDeviceIdentityStore, verifyDeviceSignature } from '../dist/apps/worker/src/device-identity.js';

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

test('keychain identity stores only public metadata in private Worker files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-keychain-device-'));
  chmodSync(dir, 0o700);
  const secrets = new Map();
  const vault = {
    async put(id, secret) { assert.equal(secrets.has(id), false); secrets.set(id, Buffer.from(secret)); },
    async get(id) { const value = secrets.get(id); return value && Buffer.from(value); },
    async delete(id) { secrets.delete(id); },
  };
  try {
    const store = new KeychainDeviceIdentityStore(dir, vault);
    const publicIdentity = await store.create();
    const record = readFileSync(join(dir, 'device-keychain.json'), 'utf8');
    assert.equal(statSync(join(dir, 'device-keychain.json')).mode & 0o777, 0o600);
    assert.equal(JSON.parse(record).storage, 'os-keychain');
    assert.doesNotMatch(record, /BEGIN PRIVATE KEY|PRIVATE_KEY|ciphertext|password/);
    assert.ok(secrets.get(publicIdentity.deviceId).toString().includes('BEGIN PRIVATE KEY'));
    const signer = await new KeychainDeviceIdentityStore(dir, vault).unlock();
    const challenge = randomBytes(32);
    assert.equal(verifyDeviceSignature(publicIdentity.publicKeyPem, challenge, signer.signChallenge(challenge)), true);
    await assert.rejects(store.create(), { code: 'ALREADY_EXISTS' });
    assert.equal(secrets.size, 1, 'failed create must remove newly written vault secret');
    secrets.clear();
    await assert.rejects(store.unlock(), { code: 'NOT_FOUND' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('keychain outage fails closed without writing a fallback private key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-keychain-device-'));
  chmodSync(dir, 0o700);
  try {
    const unavailable = { async put() { throw new DeviceIdentityError('KEYCHAIN_UNAVAILABLE'); },
      async get() { throw new DeviceIdentityError('KEYCHAIN_UNAVAILABLE'); }, async delete() {} };
    const store = new KeychainDeviceIdentityStore(dir, unavailable);
    await assert.rejects(store.create(), { code: 'KEYCHAIN_UNAVAILABLE' });
    assert.deepEqual((await import('node:fs')).readdirSync(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
