import assert from 'node:assert/strict';
import test from 'node:test';
import { SellerProviderBroker } from '../dist/packages/application/src/provider-broker.js';

const policy = { providerId: 'example', modelId: 'example-small', credentialRef: 'seller:dedicated-worker-key',
  maxRequestsPerJob: 2, maxInputTokensPerRequest: 100, maxOutputTokensPerRequest: 50,
  maxEstimatedSpendMicroUsdPerJob: 1000, inputPriceMicroUsdPerMillionTokens: 1000000,
  outputPriceMicroUsdPerMillionTokens: 2000000 };
const binding = { jobId: '00000000-0000-4000-8000-000000000001',
  capabilityVersionId: '00000000-0000-4000-8000-000000000002', providerBudget: policy };

test('provider broker reserves worst-case cost and injects seller key only into fixed connector', async () => {
  const calls = [];
  const broker = new SellerProviderBroker({ async resolve(ref) { calls.push(ref); return 'provider-secret'; } },
    { providerId: 'example', async invoke(input) { calls.push(input); return { text: 'answer', inputTokens: 20, outputTokens: 10 }; } },
    { async reserve(input) { calls.push(input); }, async settle(input) { calls.push(input); } });
  const result = await broker.invoke(binding, { modelId: 'example-small', prompt: 'question',
    estimatedInputTokens: 40, maxOutputTokens: 20 });
  assert.equal(result.text, 'answer');
  assert.equal(result.usage.costOwner, 'SELLER');
  assert.equal(calls[0].reserveMicroUsd, 80);
  assert.equal(calls[3].accountedMicroUsd, 40);
  assert.doesNotMatch(JSON.stringify(result), /provider-secret|dedicated-worker-key/);
  await assert.rejects(broker.invoke(binding, { modelId: 'other', prompt: 'question', estimatedInputTokens: 40,
    maxOutputTokens: 20 }), /NETWORK_POLICY_DENIED/);
  await assert.rejects(broker.invoke(binding, { modelId: 'example-small', prompt: 'question', estimatedInputTokens: 101,
    maxOutputTokens: 20 }), /NETWORK_POLICY_DENIED/);
});

test('provider response cannot return raw credential or exceed reserved tokens', async () => {
  const usage = { async reserve() {}, async settle() {} };
  const vault = { async resolve() { return 'provider-secret'; } };
  const leak = new SellerProviderBroker(vault, { providerId: 'example', async invoke() {
    return { text: 'provider-secret', inputTokens: 1, outputTokens: 1 };
  } }, usage);
  await assert.rejects(leak.invoke(binding, { modelId: 'example-small', prompt: 'x', estimatedInputTokens: 10,
    maxOutputTokens: 5 }), /NETWORK_POLICY_DENIED/);
  const over = new SellerProviderBroker(vault, { providerId: 'example', async invoke() {
    return { text: 'x', inputTokens: 11, outputTokens: 1 };
  } }, usage);
  await assert.rejects(over.invoke(binding, { modelId: 'example-small', prompt: 'x', estimatedInputTokens: 10,
    maxOutputTokens: 5 }), /NETWORK_POLICY_DENIED/);
});
