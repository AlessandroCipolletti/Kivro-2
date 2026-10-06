import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { test } from 'node:test';
import { URL } from 'node:url';
import { betterAuth } from 'better-auth';
import { getAuthService } from '../dist/apps/web/src/auth/server.js';
import { createAuthOptions } from '../dist/apps/web/src/auth/options.js';
import { handleAuthRequest } from '../dist/apps/web/src/auth/handler.js';
import { createSmtpAuthTransport } from '../dist/apps/web/src/auth/smtp-transport.js';
import { handleSellerProfileRequest } from '../dist/apps/web/src/seller/profile-handler.js';

const base = 'http://localhost:3000';
const mailpit = 'http://127.0.0.1:18025';

function post(service, path, body, cookie) {
  return handleAuthRequest(new globalThis.Request(`${base}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }), service);
}

async function getMessage(recipient, subject) {
  const listResponse = await globalThis.fetch(`${mailpit}/api/v1/messages`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  const summary = list.messages.find((item) => item.Subject === subject &&
    item.To.some((address) => address.Address === recipient));
  assert.ok(summary, `Expected local ${subject} email`);
  const detailResponse = await globalThis.fetch(`${mailpit}/api/v1/message/${summary.ID}`);
  assert.equal(detailResponse.status, 200);
  return detailResponse.json();
}

function linkFrom(message) {
  const link = /https?:\/\/[^\s]+/.exec(message.Text)?.[0];
  assert.ok(link, 'Expected auth link in local email');
  return link;
}

test('local email registration, verification, login, reset, and logout use PostgreSQL and Mailpit', async () => {
  const service = getAuthService();
  const databaseHost = new URL(process.env.DATABASE_URL ?? '').hostname;
  assert.equal(process.env.NODE_ENV, 'development');
  assert.ok(['localhost', '127.0.0.1'].includes(databaseHost), 'Integration test requires local-only PostgreSQL');
  // Repeatable local runs must not inherit yesterday's test traffic quota.
  await service.database.query('DELETE FROM auth_rate_limits');
  const email = `m02-${randomUUID()}@example.test`;
  const password = 'A strong local fixture password 123!';
  const newPassword = 'A different strong fixture password 456!';
  const transport = createSmtpAuthTransport({
    host: '127.0.0.1', port: 11025, from: 'Kivro Dev <no-reply@kivro.local>',
    security: 'LOCAL_PLAINTEXT', production: false,
  });
  try {
    const signup = await post(service, '/sign-up/email', { name: 'M02 Buyer', email, password });
    assert.equal(signup.status, 200);
    assert.equal(signup.headers.get('set-cookie'), null, 'Signup must not create a session before verification');
    const duplicateSignup = await post(service, '/sign-up/email', { name: 'M02 Buyer', email, password });
    assert.equal(duplicateSignup.status, signup.status, 'Duplicate signup response status must not enumerate accounts');
    assert.equal(duplicateSignup.headers.get('set-cookie'), null);
    assert.doesNotMatch(await duplicateSignup.text(), /already|exists|taken/i);
    const credential = await service.database.query(
      `SELECT password_hash FROM account_identities i JOIN accounts a ON a.id = i.account_id
       WHERE a.primary_email = $1 AND i.provider = 'credential'`, [email],
    );
    assert.equal(credential.rowCount, 1);
    assert.ok(credential.rows[0].password_hash.length > 60);
    assert.notEqual(credential.rows[0].password_hash, password);
    const beforeVerification = await post(service, '/sign-in/email', { email, password });
    assert.notEqual(beforeVerification.status, 200, 'Unverified account must not receive a session');

    const firstDelivery = await service.outbox.deliverDue(transport);
    assert.ok(firstDelivery.sent >= 1);
    const verifyLink = linkFrom(await getMessage(email, 'Verify your Kivro email'));
    const verification = await handleAuthRequest(new globalThis.Request(verifyLink), service);
    assert.ok(verification.status >= 200 && verification.status < 400);
    const reusedVerification = await handleAuthRequest(new globalThis.Request(verifyLink), service);
    assert.ok(reusedVerification.status >= 400);
    const expiredEmail = `m02-expired-${randomUUID()}@example.test`;
    assert.equal((await post(service, '/sign-up/email', { name: 'Expired Buyer', email: expiredEmail, password })).status, 200);
    await service.outbox.deliverDue(transport);
    const expiredVerifyLink = linkFrom(await getMessage(expiredEmail, 'Verify your Kivro email'));
    await service.database.query(
      `UPDATE auth_one_time_tokens SET expires_at = now() - interval '1 second'
       WHERE purpose = 'VERIFY_EMAIL' AND recipient = $1`, [expiredEmail],
    );
    assert.ok((await handleAuthRequest(new globalThis.Request(expiredVerifyLink), service)).status >= 400);
    assert.equal((await service.database.query(
      'SELECT auth_email_verified FROM accounts WHERE primary_email = $1', [expiredEmail],
    )).rows[0].auth_email_verified, false);
    const resendStatuses = [];
    for (let index = 0; index < 6; index += 1) {
      resendStatuses.push((await post(service, '/send-verification-email', {
        email: expiredEmail, callbackURL: '/sign-in?verified=1',
      })).status);
    }
    assert.ok(resendStatuses.slice(0, 5).every((status) => status === 200));
    assert.equal(resendStatuses[5], 429, 'Verification resend must be rate-limited');
    await service.database.query('DELETE FROM auth_rate_limits');
    const knownResend = await post(service, '/send-verification-email', {
      email: expiredEmail, callbackURL: '/sign-in?verified=1',
    });
    const unknownResend = await post(service, '/send-verification-email', {
      email: `unknown-${randomUUID()}@example.test`, callbackURL: '/sign-in?verified=1',
    });
    assert.equal(knownResend.status, unknownResend.status, 'Resend status must not reveal account existence');
    assert.equal(await knownResend.text(), await unknownResend.text(), 'Resend body must not reveal account existence');
    const account = await service.database.query(
      'SELECT id, auth_email_verified, email_verified_at FROM accounts WHERE primary_email = $1', [email],
    );
    assert.equal(account.rowCount, 1);
    assert.equal(account.rows[0].auth_email_verified, true);
    assert.ok(account.rows[0].email_verified_at);

    const login = await post(service, '/sign-in/email', { email, password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const sellerUrl = `${base}/api/seller/profile`;
    assert.equal((await handleSellerProfileRequest(new globalThis.Request(sellerUrl), service)).status, 401);
    const emptySeller = await handleSellerProfileRequest(new globalThis.Request(sellerUrl, { headers: { cookie } }), service);
    assert.deepEqual(await emptySeller.json(), { profile: null });
    const sellerRequest = (body, origin = base) => new globalThis.Request(sellerUrl, {
      method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await handleSellerProfileRequest(sellerRequest({ displayName: 'A seller', executionModelConfirmed: true }, 'https://attacker.example'), service)).status, 403);
    assert.equal((await handleSellerProfileRequest(new globalThis.Request(sellerUrl, {
      method: 'POST', headers: { cookie, origin: base, 'content-type': 'application/jsonp' }, body: '{}',
    }), service)).status, 415);
    assert.equal((await handleSellerProfileRequest(sellerRequest({ displayName: 'x'.repeat(5000), executionModelConfirmed: true }), service)).status, 400);
    assert.equal((await handleSellerProfileRequest(sellerRequest({ displayName: 'A seller', executionModelConfirmed: true, accountId: randomUUID() }), service)).status, 400);
    assert.equal((await handleSellerProfileRequest(sellerRequest({ displayName: 'A seller', executionModelConfirmed: false }), service)).status, 400);
    const sellerCreated = await handleSellerProfileRequest(sellerRequest({ displayName: 'Studio North', executionModelConfirmed: true }), service);
    assert.equal(sellerCreated.status, 201);
    const createdProfile = (await sellerCreated.json()).profile;
    assert.equal(createdProfile.accountId, account.rows[0].id);
    assert.equal(createdProfile.status, 'DRAFT');
    assert.equal(createdProfile.executionModelAcknowledged, true);
    const sellerReplay = await handleSellerProfileRequest(sellerRequest({ displayName: 'Ignored on retry', executionModelConfirmed: true }), service);
    assert.equal(sellerReplay.status, 200);
    assert.equal((await sellerReplay.json()).profile.id, createdProfile.id);
    assert.equal((await handleSellerProfileRequest(new globalThis.Request(sellerUrl, { headers: { cookie } }), service)).headers.get('cache-control'), 'no-store');
    const resetRequest = await post(service, '/request-password-reset', { email });
    assert.equal(resetRequest.status, 200);
    const unknownReset = await post(service, '/request-password-reset', { email: `missing-${randomUUID()}@example.test` });
    assert.equal(unknownReset.status, resetRequest.status);
    const resetDelivery = await service.outbox.deliverDue(transport);
    assert.ok(resetDelivery.sent >= 1);
    const resetLink = linkFrom(await getMessage(email, 'Reset your Kivro password'));
    const token = new URL(resetLink).pathname.split('/').pop();
    assert.ok(token);
    assert.ok((await handleAuthRequest(new globalThis.Request(
      `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=/sign-in`,
    ), service)).status >= 400, 'Reset token must not verify email');
    const reset = await post(service, '/reset-password', { token, newPassword });
    assert.equal(reset.status, 200);
    assert.ok((await post(service, '/reset-password', { token, newPassword })).status >= 400);
    assert.notEqual((await post(service, '/sign-in/email', { email, password })).status, 200);
    assert.equal((await post(service, '/sign-in/email', { email, password: newPassword })).status, 200);
    assert.equal((await post(service, '/sign-out', {}, cookie)).status, 200);
    assert.equal((await post(service, '/request-password-reset', { email })).status, 200);
    await service.outbox.deliverDue(transport);
    const expiredResetLink = linkFrom(await getMessage(email, 'Reset your Kivro password'));
    assert.notEqual(expiredResetLink, resetLink, 'A fresh reset must issue a distinct token');
    const expiredResetToken = new URL(expiredResetLink).pathname.split('/').pop();
    assert.ok(expiredResetToken);
    await service.database.query(
      `UPDATE auth_verifications SET expires_at = now() - interval '1 second'
       WHERE created_at > now() - interval '5 minutes' AND expires_at > now()`,
    );
    assert.ok((await post(service, '/reset-password', { token: expiredResetToken, newPassword: password })).status >= 400,
      'Expired reset token must be rejected');
    assert.equal((await post(service, '/sign-in/email', { email, password: newPassword })).status, 200);
    const audit = await service.database.query(
      `SELECT event_type, http_status FROM auth_audit_events
       WHERE account_id = $1 OR event_type IN ('SIGN_UP_EMAIL_REQUEST','SIGN_IN_EMAIL_REQUEST','RESET_REQUEST','RESET_PASSWORD_REQUEST')
       ORDER BY id`, [account.rows[0].id],
    );
    const kinds = new Set(audit.rows.map((row) => row.event_type));
    for (const event of ['ACCOUNT_CREATED', 'EMAIL_VERIFIED', 'CREDENTIAL_CREATED', 'PASSWORD_UPDATED',
      'SESSION_CREATED', 'SESSION_REVOKED', 'SIGN_IN_EMAIL_REQUEST', 'RESET_REQUEST']) {
      assert.ok(kinds.has(event), `Missing auth audit event ${event}`);
    }
    assert.ok(audit.rows.some((row) => row.event_type === 'SIGN_IN_EMAIL_REQUEST' && row.http_status !== 200));

    const googleOnlyEmail = `google-only-${randomUUID()}@example.test`;
    const googleOnlyId = randomUUID();
    await service.database.query(
      `INSERT INTO accounts(id, primary_email, status, auth_name, auth_email_verified)
       VALUES ($1, $2, 'ACTIVE', 'Google Only', true)`, [googleOnlyId, googleOnlyEmail],
    );
    await service.database.query(
      `INSERT INTO account_identities(id, account_id, provider, provider_subject, email)
       VALUES ($1, $2, 'google', $3, $4)`, [randomUUID(), googleOnlyId, `google-${randomUUID()}`, googleOnlyEmail],
    );
    assert.equal((await post(service, '/request-password-reset', { email: googleOnlyEmail })).status, 200);
    assert.equal((await service.database.query(
      `SELECT count(*)::integer AS count FROM auth_email_outbox WHERE recipient = $1 AND purpose = 'RESET_PASSWORD'`,
      [googleOnlyEmail],
    )).rows[0].count, 1, 'Google-origin password setup must require an explicit recovery request');
    await service.outbox.deliverDue(transport);
    const googlePasswordLink = linkFrom(await getMessage(googleOnlyEmail, 'Reset your Kivro password'));
    const googlePasswordToken = new URL(googlePasswordLink).pathname.split('/').pop();
    assert.ok(googlePasswordToken);
    assert.equal((await post(service, '/reset-password', { token: googlePasswordToken, newPassword: password })).status, 200);
    assert.ok((await post(service, '/reset-password', { token: googlePasswordToken, newPassword })).status >= 400);
    assert.equal((await service.database.query(
      `SELECT count(*)::integer AS count FROM accounts WHERE primary_email = $1`, [googleOnlyEmail],
    )).rows[0].count, 1);
    const googleIdentities = await service.database.query(
      `SELECT provider, account_id FROM account_identities WHERE account_id = $1 ORDER BY provider`, [googleOnlyId],
    );
    assert.deepEqual(googleIdentities.rows.map((item) => item.provider), ['credential', 'google']);
    assert.ok(googleIdentities.rows.every((item) => item.account_id === googleOnlyId));
    assert.equal((await post(service, '/sign-in/email', { email: googleOnlyEmail, password })).status, 200);

    const googleAuth = betterAuth(createAuthOptions({
      database: service.database, baseURL: base, secret: process.env.BETTER_AUTH_SECRET,
      outbox: service.outbox, verificationTokens: service.verificationTokens,
      google: { clientId: 'kivro-local-test-client.apps.googleusercontent.com', clientSecret: 'local-test-only' },
    }));
    const oauthStart = await post({ ...service, auth: googleAuth }, '/sign-in/social',
      { provider: 'google', callbackURL: '/account' });
    assert.equal(oauthStart.status, 200);
    const authorization = new URL((await oauthStart.json()).url);
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.deepEqual(new Set(authorization.searchParams.get('scope')?.split(' ')), new Set(['openid', 'email', 'profile']));
    assert.equal(authorization.searchParams.get('include_granted_scopes'), null);
    assert.equal(authorization.searchParams.get('redirect_uri'), `${base}/api/auth/callback/google`);
    assert.ok((authorization.searchParams.get('state') ?? '').length >= 20);
  } finally {
    await service.database.end();
  }
});
