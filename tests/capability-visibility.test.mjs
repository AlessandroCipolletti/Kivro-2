import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideCapabilityVisibility, isLegalVersionTransition } from '../dist/packages/domain/src/capability-visibility.js';

const sellerAccountId = '11111111-1111-4111-8111-111111111111';
const buyerAccountId = '22222222-2222-4222-8222-222222222222';

function decide(visibility, overrides = {}) {
  return decideCapabilityVisibility({ visibility, sellerAccountId, viewerAccountId: buyerAccountId,
    arrivedByDirectLink: false, explicitPrivateGrant: false, ...overrides });
}

test('draft and private capability access require seller ownership or an explicit private grant', () => {
  assert.equal(decide('DRAFT').canViewDetail, false);
  assert.equal(decide('DRAFT', { viewerAccountId: sellerAccountId }).canViewDetail, true);
  assert.equal(decide('PRIVATE', { arrivedByDirectLink: true }).canViewDetail, false,
    'An obscure link is not a private authorization grant');
  assert.equal(decide('PRIVATE', { explicitPrivateGrant: true }).canViewDetail, true);
  assert.equal(decide('PRIVATE', { viewerAccountId: null, explicitPrivateGrant: true }).canViewDetail, false);
});

test('unlisted direct access and public discovery stay separate', () => {
  assert.deepEqual(decide('UNLISTED'), { canViewDetail: false, appearsInSearch: false,
    visibilityAllowsAgentRecommendation: false });
  assert.deepEqual(decide('UNLISTED', { arrivedByDirectLink: true }), {
    canViewDetail: true, appearsInSearch: false, visibilityAllowsAgentRecommendation: false,
  });
  assert.deepEqual(decide('PUBLIC', { viewerAccountId: null }), {
    canViewDetail: true, appearsInSearch: true, visibilityAllowsAgentRecommendation: true,
  });
});

test('a published version snapshot never returns to draft and retirement is terminal', () => {
  for (const [from, to] of [['DRAFT', 'TESTING'], ['TESTING', 'READY_TO_PUBLISH'],
    ['READY_TO_PUBLISH', 'PUBLISHED'], ['PUBLISHED', 'RETIRED']]) {
    assert.equal(isLegalVersionTransition(from, to), true);
  }
  for (const [from, to] of [['DRAFT', 'PUBLISHED'], ['PUBLISHED', 'DRAFT'],
    ['RETIRED', 'PUBLISHED'], ['PUBLISHED', 'PUBLISHED']]) {
    assert.equal(isLegalVersionTransition(from, to), false);
  }
});
