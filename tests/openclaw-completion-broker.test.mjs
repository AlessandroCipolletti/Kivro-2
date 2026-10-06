/* global AbortController */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { SellerCompletionBroker } from '../dist/packages/application/src/completion-broker.js';
import { OpenAiCompatibleHttpsConnector } from
  '../dist/packages/infrastructure/adapters/src/openai-compatible-https.js';

const budget = { providerId: 'synthetic', modelId: 'broker', credentialRef: 'seller:worker-only',
  maxRequestsPerJob: 2, maxInputTokensPerRequest: 8192, maxOutputTokensPerRequest: 1024,
  maxEstimatedSpendMicroUsdPerJob: 100_000,
  inputPriceMicroUsdPerMillionTokens: 1_000_000,
  outputPriceMicroUsdPerMillionTokens: 1_000_000 };
const binding = { jobId: randomUUID(), capabilityVersionId: randomUUID(), providerBudget: budget,
  allowedToolNames: ['kivro_submit_result'] };
const request = { model: 'broker', stream: true, max_tokens: 128,
  messages: [{ role: 'user', content: 'Answer safely.' }],
  tools: [{ type: 'function', function: { name: 'kivro_submit_result',
    description: 'submit', parameters: {} } }] };

test('completion broker reserves before resolving secrets and rejects undeclared tool expansion', async () => {
  const events = [];
  const broker = new SellerCompletionBroker({ async resolve() { events.push('secret'); return 'test-secret'; } },
    { providerId: 'synthetic', async complete(input, secret) {
      events.push('upstream'); assert.equal(secret, 'test-secret');
      assert.equal(input.stream, false);
      return { id: randomUUID(), object: 'chat.completion', created: 1, model: 'broker',
        choices: [{ index: 0, finish_reason: 'stop',
          message: { role: 'assistant', content: 'safe' } }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 } };
    } }, { async reserve(input) { events.push('reserve'); assert.ok(input.reserveMicroUsd > 0); },
      async settle(input) { events.push('settle'); assert.equal(input.status, 'SUCCEEDED'); } });
  await assert.rejects(broker.invoke(binding, { ...request, tools: [{ type: 'function',
    function: { name: 'exec', description: 'host shell', parameters: {} } }] },
  randomUUID(), new AbortController().signal), { code: 'NETWORK_POLICY_DENIED' });
  assert.deepEqual(events, []);
  const answer = await broker.invoke(binding, request, randomUUID(), new AbortController().signal);
  assert.equal(answer.choices[0].message.content, 'safe');
  assert.deepEqual(events, ['reserve', 'secret', 'upstream', 'settle']);
});

test('completion broker rejects provider-secret echo and still accounts the reserved call', async () => {
  const events = [];
  const broker = new SellerCompletionBroker({ async resolve() { return 'test-secret'; } },
    { providerId: 'synthetic', async complete() {
      return { id: randomUUID(), object: 'chat.completion', created: 1, model: 'broker',
        choices: [{ index: 0, finish_reason: 'stop',
          message: { role: 'assistant', content: 'test-secret' } }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 } };
    } }, { async reserve() { events.push('reserve'); },
      async settle(input) { events.push(input.status); } });
  await assert.rejects(broker.invoke(binding, request, randomUUID(), new AbortController().signal),
    { code: 'NETWORK_POLICY_DENIED' });
  assert.deepEqual(events, ['reserve', 'FAILED']);
});

test('provider connector rejects private DNS, unsafe endpoints, and credentials before HTTPS', async () => {
  assert.throws(() => new OpenAiCompatibleHttpsConnector('synthetic', 'http://example.com/v1'),
    { code: 'NETWORK_POLICY_DENIED' });
  const connector = new OpenAiCompatibleHttpsConnector('synthetic', 'https://example.com/v1',
    { async lookup() { return [{ address: '127.0.0.1', family: 4 }]; } });
  await assert.rejects(connector.complete({ ...request, stream: false }, 'key',
    new AbortController().signal), { code: 'PRIVATE_DESTINATION_DENIED' });
  await assert.rejects(connector.complete({ ...request, stream: false }, 'bad\r\nkey',
    new AbortController().signal), { code: 'NETWORK_POLICY_DENIED' });
});
