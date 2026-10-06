import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PgAuthAudit, classifyAuthRequest } from '../dist/apps/web/src/auth/audit.js';
import { handleAuthRequest } from '../dist/apps/web/src/auth/handler.js';

function request(path, method = 'POST') {
  return new globalThis.Request(`http://localhost:3000/api/auth/${path}`, { method });
}

test('audit request classification covers credential, recovery, verification and Google boundaries', () => {
  assert.equal(classifyAuthRequest(request('sign-in/email')), 'SIGN_IN_EMAIL_REQUEST');
  assert.equal(classifyAuthRequest(request('request-password-reset')), 'RESET_REQUEST');
  assert.equal(classifyAuthRequest(request('verify-email?token=secret', 'GET')), 'VERIFY_EMAIL_REQUEST');
  assert.equal(classifyAuthRequest(request('callback/google?state=secret', 'GET')), 'GOOGLE_CALLBACK_REQUEST');
  assert.equal(classifyAuthRequest(request('get-session', 'GET')), undefined);
});

test('audit insert records event and status only', async () => {
  const calls = [];
  const audit = new PgAuthAudit({ async query(sql, parameters) { calls.push({ sql, parameters }); } });
  await audit.record('SIGN_IN_EMAIL_REQUEST', 401);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].parameters, ['SIGN_IN_EMAIL_REQUEST', 401]);
  assert.doesNotMatch(JSON.stringify(calls), /secret|password|token|email@example/);
  await assert.rejects(audit.record('SIGN_IN_EMAIL_REQUEST', 999), TypeError);
});

test('auditing failure suppresses a newly issued auth response and cookie', async () => {
  const service = {
    auth: { handler: async () => new globalThis.Response('signed in', { status: 200, headers: { 'set-cookie': 'session=secret' } }) },
    audit: { record: async () => { throw new Error('audit unavailable'); } },
  };
  const response = await handleAuthRequest(request('sign-in/email'), service);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
