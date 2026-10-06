import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEmail, resolveGoogleAccount } from '../dist/packages/domain/src/identity-linking.js';

test('canonical email normalization preserves provider-specific aliases', () => {
  assert.equal(normalizeEmail('  Buyer+Tools@Example.COM  '), 'buyer+tools@example.com');
  assert.notEqual(normalizeEmail('buyer+tools@example.com'), normalizeEmail('buyer@example.com'));
});

test('verified Google identity links to the existing verified Kivro account', () => {
  const decision = resolveGoogleAccount(
    { subject: 'google-subject-1', email: 'BUYER@example.com', emailVerified: true },
    { providerSubjectAccountId: null, normalizedEmailAccountId: 'account-1', normalizedEmailVerified: true },
  );
  assert.deepEqual(decision, { action: 'LINK_TO_VERIFIED_ACCOUNT', accountId: 'account-1', normalizedEmail: 'buyer@example.com' });
});

test('unverified provider claim cannot link or create a paid account', () => {
  assert.deepEqual(resolveGoogleAccount(
    { subject: 'google-subject-1', email: 'buyer@example.com', emailVerified: false },
    { providerSubjectAccountId: null, normalizedEmailAccountId: 'account-1', normalizedEmailVerified: true },
  ), { action: 'REJECT_UNVERIFIED_CLAIM' });
  assert.deepEqual(resolveGoogleAccount(
    { subject: 'google-subject-1', email: 'buyer@example.com', emailVerified: true },
    { providerSubjectAccountId: null, normalizedEmailAccountId: 'account-1', normalizedEmailVerified: false },
  ), { action: 'REQUIRE_EXPLICIT_VERIFICATION', normalizedEmail: 'buyer@example.com' });
});

test('stable provider subject wins only when it does not conflict with email ownership', () => {
  assert.deepEqual(resolveGoogleAccount(
    { subject: 'google-subject-1', email: 'buyer@example.com', emailVerified: true },
    { providerSubjectAccountId: 'account-1', normalizedEmailAccountId: 'account-1', normalizedEmailVerified: true },
  ), { action: 'USE_LINKED_ACCOUNT', accountId: 'account-1' });
  assert.throws(() => resolveGoogleAccount(
    { subject: 'google-subject-1', email: 'buyer@example.com', emailVerified: true },
    { providerSubjectAccountId: 'account-1', normalizedEmailAccountId: 'account-2', normalizedEmailVerified: true },
  ));
});
