import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import process from 'node:process';
import { test } from 'node:test';
import { URL } from 'node:url';
import { createAuthOptions } from '../dist/apps/web/src/auth/options.js';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { getAuthTables } = await import(requireFromWeb.resolve('better-auth/db'));

function configuration(overrides = {}) {
  const messages = [];
  const tokens = [];
  return {
    messages,
    tokens,
    value: {
      database: {},
      baseURL: 'http://localhost:3000',
      secret: '0123456789abcdef0123456789abcdef',
      outbox: { async enqueue(message) { messages.push(message); } },
      verificationTokens: { async register(token, recipient) { tokens.push({ token, recipient }); }, async consume() { return false; } },
      ...overrides,
    },
  };
}

test('auth configuration maps Better Auth to one Kivro account and identity model', () => {
  const options = createAuthOptions(configuration().value);
  const tables = getAuthTables(options);
  assert.equal(tables.user.modelName, 'accounts');
  assert.equal(tables.user.fields.email.fieldName, 'primary_email');
  assert.equal(tables.user.fields.emailVerified.fieldName, 'auth_email_verified');
  assert.equal(tables.account.modelName, 'account_identities');
  assert.equal(tables.account.fields.userId.fieldName, 'account_id');
  assert.equal(tables.account.fields.accountId.fieldName, 'provider_subject');
  assert.equal(tables.session.modelName, 'auth_sessions');
  assert.equal(tables.verification.modelName, 'auth_verifications');
  assert.equal(tables.rateLimit.modelName, 'auth_rate_limits');
  assert.equal(options.advanced.database.generateId, 'uuid');
});

test('unverified password accounts cannot sign in and verification identifiers are hashed', () => {
  const options = createAuthOptions(configuration().value);
  assert.equal(options.emailAndPassword.requireEmailVerification, true);
  assert.equal(options.emailVerification.sendOnSignUp, true);
  assert.equal(options.emailVerification.autoSignInAfterVerification, false);
  assert.equal(options.verification.storeIdentifier, 'hashed');
  assert.equal(options.rateLimit.enabled, true);
  assert.equal(options.rateLimit.storage, 'database');
});

test('Google login requests only identity scopes and cannot trust unverified claims', () => {
  const options = createAuthOptions(configuration({ google: {
    clientId: 'test-client', clientSecret: 'test-secret',
  } }).value);
  assert.deepEqual(options.socialProviders.google.scope, []);
  assert.equal(options.socialProviders.google.includeGrantedScopes, false);
  assert.equal(options.socialProviders.google.accessType, 'online');
  assert.deepEqual(options.account.accountLinking.trustedProviders, []);
  assert.equal(options.account.accountLinking.requireLocalEmailVerified, true);
  assert.equal(options.account.accountLinking.allowDifferentEmails, false);
  assert.equal(options.account.encryptOAuthTokens, true);
});

test('verification and reset messages use distinct durable outbox purposes', async () => {
  const config = configuration();
  const options = createAuthOptions(config.value);
  assert.equal(options.logger.disabled, true);
  const payload = { user: { email: 'buyer@example.test' }, url: 'http://localhost:3000/token', token: 'hidden' };
  await options.emailVerification.sendVerificationEmail(payload);
  await options.emailAndPassword.sendResetPassword(payload);
  assert.deepEqual(config.messages, [
    { purpose: 'VERIFY_EMAIL', recipient: 'buyer@example.test', url: 'http://localhost:3000/token?callbackURL=%2Fsign-in%3Fverified%3D1' },
    { purpose: 'RESET_PASSWORD', recipient: 'buyer@example.test', url: 'http://localhost:3000/token' },
  ]);
  assert.deepEqual(config.tokens, [{ token: 'hidden', recipient: 'buyer@example.test' }]);
});

test('auth setup rejects insecure origins and missing secrets', () => {
  assert.throws(() => createAuthOptions(configuration({ secret: 'short' }).value), TypeError);
  assert.throws(() => createAuthOptions(configuration({ baseURL: 'http://kivro.example' }).value), TypeError);
  assert.throws(() => createAuthOptions(configuration({ google: { clientId: 'id', clientSecret: '' } }).value), TypeError);
});

test('production startup rejects missing Google credentials without a development bypass', () => {
  const moduleUrl = new URL('../dist/apps/web/src/auth/server.js', import.meta.url).href;
  const code = `import { getAuthService } from ${JSON.stringify(moduleUrl)};
    try { getAuthService(); process.exit(2); }
    catch (error) { process.exit(String(error).includes('Google identity configuration is required') ? 0 : 3); }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    env: {
      NODE_ENV: 'production', DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
      APP_ORIGIN: 'https://kivro.example', BETTER_AUTH_SECRET: 'x'.repeat(32),
      AUTH_OUTBOX_KEY_BASE64: Buffer.alloc(32).toString('base64'),
    }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 0, `Unexpected production auth startup status ${result.status}`);
});
