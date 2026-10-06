import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOptions, Algorithm, Version } from '@node-rs/argon2';
import { hashAccountPassword, verifyAccountPassword } from '../dist/apps/web/src/auth/password.js';

test('new passwords use explicit Argon2id v19 with pinned memory-hard parameters', async () => {
  const password = 'A strong Kivro fixture password 123!';
  const first = await hashAccountPassword(password);
  const second = await hashAccountPassword(password);
  assert.notEqual(first, second, 'Every password gets a new salt');
  assert.match(first, /^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
  const parameters = parseOptions(first);
  assert.equal(parameters.algorithm, Algorithm.Argon2id);
  assert.equal(parameters.version, Version.V0x13);
  assert.equal(parameters.saltLen >= 16, true);
  assert.equal(await verifyAccountPassword({ hash: first, password }), true);
  assert.equal(await verifyAccountPassword({ hash: first, password: 'wrong-password' }), false);
});

test('malformed or downgraded password hashes are rejected', async () => {
  for (const hash of ['plain-text', 'salt:hash', '$argon2id$invalid', 'x'.repeat(300)]) {
    assert.equal(await verifyAccountPassword({ hash, password: 'password' }), false);
  }
  await assert.rejects(hashAccountPassword('short'), TypeError);
});
