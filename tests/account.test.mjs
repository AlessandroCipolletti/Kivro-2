import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountIdentitySchema, AccountSchema, SellerProfileSchema } from '../dist/packages/contracts/src/account.js';
import { accountCapabilities } from '../dist/packages/domain/src/account.js';

const id = 'b3451661-a538-4907-8acc-b1cf00e04899';
const otherId = '48ed805a-d11a-4f3a-a601-35014a39e810';
const account = { id, primaryEmail: 'buyer@example.com', emailVerifiedAt: '2026-10-06T12:00:00Z',
  status: 'ACTIVE', termsAcceptedAt: '2026-10-06T12:00:00Z', createdAt: '2026-10-06T11:00:00Z' };
const seller = { id: otherId, accountId: id, displayName: 'Research Studio', status: 'ACTIVE', payoutStatus: 'READY', createdAt: '2026-10-06T12:00:00Z' };

test('one account can use buyer features without OpenClaw or a seller profile', () => {
  const parsed = AccountSchema.parse(account);
  assert.deepEqual(accountCapabilities(parsed), {
    canUseAccount: true, canEnterPaidBuyerFlow: true,
    canConfigureSelling: false, meetsSellerAccountPrerequisites: false,
  });
  assert.deepEqual(accountCapabilities(parsed, SellerProfileSchema.parse(seller)), {
    canUseAccount: true, canEnterPaidBuyerFlow: true,
    canConfigureSelling: true, meetsSellerAccountPrerequisites: true,
  });
});

test('unverified and suspended identities cannot enter sensitive account flows', () => {
  assert.equal(accountCapabilities({ ...account, emailVerifiedAt: null }, seller).canEnterPaidBuyerFlow, false);
  assert.equal(accountCapabilities({ ...account, emailVerifiedAt: null }, seller).canConfigureSelling, false);
  assert.equal(accountCapabilities({ ...account, status: 'SUSPENDED' }, seller).meetsSellerAccountPrerequisites, false);
  assert.equal(accountCapabilities(account, { ...seller, accountId: otherId }).canConfigureSelling, false);
});

test('identity schema distinguishes password and Google without leaking secrets', () => {
  const identity = { id, accountId: id, provider: 'GOOGLE', providerSubject: 'google-subject',
    email: 'buyer@example.com', emailVerified: true, createdAt: '2026-10-06T12:00:00Z' };
  assert.equal(AccountIdentitySchema.safeParse(identity).success, true);
  assert.equal(AccountIdentitySchema.safeParse({ ...identity, oauthToken: 'secret' }).success, false);
  assert.equal(AccountIdentitySchema.safeParse({ ...identity, provider: 'UNVERIFIED_EMAIL' }).success, false);
});
