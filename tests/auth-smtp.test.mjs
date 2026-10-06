import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSmtpAuthTransport } from '../dist/apps/web/src/auth/smtp-transport.js';

const local = { host: '127.0.0.1', port: 1025, from: 'Kivro <no-reply@localhost>',
  security: 'LOCAL_PLAINTEXT', production: false };

test('SMTP plaintext is confined to local development', () => {
  assert.ok(createSmtpAuthTransport(local));
  assert.throws(() => createSmtpAuthTransport({ ...local, production: true }), TypeError);
  assert.throws(() => createSmtpAuthTransport({ ...local, host: 'mail.example' }), TypeError);
  assert.throws(() => createSmtpAuthTransport({ ...local, security: 'unknown' }), TypeError);
});

test('SMTP adapter rejects incomplete credentials and header injection', () => {
  assert.throws(() => createSmtpAuthTransport({ ...local, username: 'user' }), TypeError);
  assert.throws(() => createSmtpAuthTransport({ ...local, from: 'safe\r\nBcc: attacker@example' }), TypeError);
  assert.ok(createSmtpAuthTransport({ ...local, host: 'mail.example', port: 587,
    security: 'STARTTLS', production: true, username: 'user', password: 'pass' }));
});
