import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardAuthReturnPaths, guardGoogleIdentityRequest } from '../dist/apps/web/src/auth/request-guard.js';

function request(body, path = '/api/auth/sign-in/social') {
  return new globalThis.Request(`http://localhost:3000${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('Google OAuth request guard accepts only identity flow parameters', async () => {
  assert.equal(await guardGoogleIdentityRequest(request({ provider: 'google', callbackURL: '/dashboard' })), null);
  assert.equal(await guardGoogleIdentityRequest(request({ provider: 'google', scopes: [] })), null);
  for (const body of [
    { provider: 'google', scopes: ['https://www.googleapis.com/auth/drive'] },
    { provider: 'google', additionalParams: { include_granted_scopes: 'true' } },
    { provider: 'google', idToken: { token: 'unverified' } },
    { provider: 'google', additionalData: { arbitrary: true } },
    { provider: 'other' },
  ]) assert.equal((await guardGoogleIdentityRequest(request(body))).status, 400);
});

test('Google OAuth request guard rejects external and malformed callback paths', async () => {
  for (const callbackURL of ['https://attacker.example', '//attacker.example', '/\\attacker.example', 'dashboard']) {
    assert.equal((await guardGoogleIdentityRequest(request({ provider: 'google', callbackURL }))).status, 400);
  }
  assert.equal(await guardGoogleIdentityRequest(request({ provider: 'google' }, '/api/auth/callback/google')), null);
});

test('Google OAuth request guard bounds parsed request body', async () => {
  const response = await guardGoogleIdentityRequest(request({ provider: 'google', loginHint: 'x'.repeat(9000) }));
  assert.equal(response.status, 413);
});

test('all auth callback and reset paths reject external and encoded redirects', async () => {
  for (const callbackURL of ['https://attacker.example', '//attacker.example', '/\\attacker.example',
    '/%2fattacker.example', '/%5cattacker.example', 'dashboard']) {
    assert.equal((await guardAuthReturnPaths(request({ name: 'Buyer', email: 'buyer@example.test',
      password: 'A strong fixture password', callbackURL }, '/api/auth/sign-up/email'))).status, 400);
    assert.equal((await guardAuthReturnPaths(new globalThis.Request(
      `http://localhost:3000/api/auth/verify-email?callbackURL=${encodeURIComponent(callbackURL)}`))).status, 400);
  }
  assert.equal(await guardAuthReturnPaths(request({ email: 'buyer@example.test',
    redirectTo: '/reset-password' }, '/api/auth/request-password-reset')), null);
});
