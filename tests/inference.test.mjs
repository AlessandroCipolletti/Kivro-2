import assert from 'node:assert/strict';
import test from 'node:test';
import { PlatformInferenceConfigSchema, SellerInferenceConfigSchema } from '../dist/packages/contracts/src/inference.js';

test('platform and seller inference ownership and credential references cannot be exchanged', () => {
  const platform = { owner: 'PLATFORM', providerId: 'openai', modelId: 'model-a', credentialRef: 'platform:model-key' };
  const seller = { owner: 'SELLER', providerId: 'anthropic', modelId: 'model-b', credentialRef: 'seller:local-key', estimatedCostMinor: 20, currency: 'USD' };
  assert.equal(PlatformInferenceConfigSchema.safeParse(platform).success, true);
  assert.equal(SellerInferenceConfigSchema.safeParse(seller).success, true);
  assert.equal(SellerInferenceConfigSchema.safeParse({ ...seller, credentialRef: platform.credentialRef }).success, false);
  assert.equal(PlatformInferenceConfigSchema.safeParse({ ...platform, credentialRef: seller.credentialRef }).success, false);
  assert.equal(SellerInferenceConfigSchema.safeParse({ ...seller, apiKey: 'secret' }).success, false);
});
