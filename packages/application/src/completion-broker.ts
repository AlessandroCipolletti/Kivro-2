import { z } from 'zod';
import { ProviderBudgetPolicySchema } from '../../contracts/src/provider-budget-policy.js';
import type { ProviderUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';
import type { SellerCredentialVault } from './provider-broker.js';

const toolName = z.string().regex(/^[a-z][a-z0-9_]{1,79}$/);
const toolCall = z.strictObject({ id: z.string().min(1).max(160), type: z.literal('function'),
  function: z.strictObject({ name: toolName, arguments: z.string().max(100_000) }) });
const message = z.discriminatedUnion('role', [
  z.strictObject({ role: z.literal('system'), content: z.string().max(500_000) }),
  z.strictObject({ role: z.literal('user'), content: z.string().max(500_000) }),
  z.strictObject({ role: z.literal('assistant'), content: z.string().max(500_000).nullable(),
    tool_calls: z.array(toolCall).max(16).optional() }),
  z.strictObject({ role: z.literal('tool'), tool_call_id: z.string().min(1).max(160),
    content: z.string().max(500_000) }),
]);
const tool = z.strictObject({ type: z.literal('function'), function: z.strictObject({
  name: toolName, description: z.string().max(1000), parameters: z.unknown(),
}) });
const requestSchema = z.strictObject({
  model: z.string().min(1).max(160), messages: z.array(message).min(1).max(128),
  stream: z.boolean(), stream_options: z.strictObject({ include_usage: z.boolean() }).optional(),
  tools: z.array(tool).max(32).optional(),
  tool_choice: z.union([z.enum(['auto', 'none', 'required']), z.strictObject({ type: z.literal('function'),
    function: z.strictObject({ name: toolName }) })]).optional(),
  max_completion_tokens: z.number().int().min(1).max(200_000).optional(),
  max_tokens: z.number().int().min(1).max(200_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});
const responseSchema = z.strictObject({
  id: z.string().min(1).max(160), object: z.literal('chat.completion'),
  created: z.number().int().nonnegative(), model: z.string().min(1).max(160),
  choices: z.tuple([z.strictObject({ index: z.literal(0),
    finish_reason: z.enum(['stop', 'tool_calls', 'length']),
    message: z.strictObject({ role: z.literal('assistant'),
      content: z.string().max(500_000).nullable(), tool_calls: z.array(toolCall).max(16).optional() }),
  })]),
  usage: z.strictObject({ prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(), total_tokens: z.number().int().nonnegative() }),
});

export type CompletionRequest = z.infer<typeof requestSchema>;
export type CompletionResponse = z.infer<typeof responseSchema>;

/** A provider adapter owns HTTPS, DNS pinning and credential injection; it never runs in the sandbox. */
export interface CompletionConnector {
  readonly providerId: string;
  complete(request: CompletionRequest, credential: string, signal: AbortSignal): Promise<unknown>;
}

function upperCost(input: number, output: number, prices: {
  inputPriceMicroUsdPerMillionTokens: number; outputPriceMicroUsdPerMillionTokens: number }): number {
  return Math.ceil(input * prices.inputPriceMicroUsdPerMillionTokens / 1_000_000) +
    Math.ceil(output * prices.outputPriceMicroUsdPerMillionTokens / 1_000_000);
}

function deny(): never { throw new NetworkPolicyError('NETWORK_POLICY_DENIED'); }

/** Validates OpenClaw's structured tool-call transcript and reserves worst-case seller cost first. */
export class SellerCompletionBroker {
  constructor(private readonly vault: SellerCredentialVault, private readonly connector: CompletionConnector,
    private readonly usage: ProviderUsagePort) {}

  async invoke(binding: { jobId: string; capabilityVersionId: string; providerBudget: unknown;
    allowedToolNames: readonly string[] }, rawRequest: unknown, requestId: string, signal: AbortSignal): Promise<CompletionResponse> {
    const policy = ProviderBudgetPolicySchema.parse(binding.providerBudget);
    const parsed = requestSchema.safeParse(rawRequest);
    if (!parsed.success) return deny();
    const request = parsed.data;
    const maxOutput = request.max_completion_tokens ?? request.max_tokens;
    const allowed = new Set(binding.allowedToolNames);
    if (policy.providerId !== this.connector.providerId || request.model !== policy.modelId ||
      maxOutput === undefined || maxOutput > policy.maxOutputTokensPerRequest ||
      request.messages.some((item) => item.role === 'assistant' && item.tool_calls?.some((call) =>
        !allowed.has(call.function.name))) ||
      request.tools?.some((item) => !allowed.has(item.function.name)) ||
      (typeof request.tool_choice === 'object' && !allowed.has(request.tool_choice.function.name)) ||
      (request.tools !== undefined && request.tools.length !== new Set(
        request.tools.map((item) => item.function.name)).size) ||
      !/^[0-9a-f-]{36}$/i.test(requestId)) return deny();
    const encoded = JSON.stringify(request);
    if (Buffer.byteLength(encoded) > 1_048_576 ||
      request.tools?.some((item) => Buffer.byteLength(JSON.stringify(item.function.parameters)) > 32_768)) return deny();
    const reserved = upperCost(policy.maxInputTokensPerRequest, maxOutput, policy);
    if (reserved <= 0) return deny();
    await this.usage.reserve({ requestId, jobId: binding.jobId,
      capabilityVersionId: binding.capabilityVersionId, providerId: policy.providerId,
      modelId: policy.modelId, reserveMicroUsd: reserved,
      maxRequestsPerJob: policy.maxRequestsPerJob,
      maxSpendMicroUsdPerJob: policy.maxEstimatedSpendMicroUsdPerJob,
      reservedInputTokens: policy.maxInputTokensPerRequest, reservedOutputTokens: maxOutput,
      maxTokensPerJob: policy.maxTokensPerJob ??
        (policy.maxInputTokensPerRequest + policy.maxOutputTokensPerRequest) * policy.maxRequestsPerJob,
      maxDailyJobs: policy.maxDailyJobs ?? 1,
      maxDailySpendMicroUsd: policy.maxDailyProviderSpendMicroUsd ?? policy.maxEstimatedSpendMicroUsdPerJob });
    let accounted = reserved, inputTokens = 0, outputTokens = 0;
    let status: 'SUCCEEDED' | 'FAILED' = 'FAILED';
    try {
      const credential = await this.vault.resolve(policy.credentialRef);
      if (!credential) return deny();
      // Kivro streams only the validated whole completion back to OpenClaw.
      const upstream = { ...request, stream: false };
      delete upstream.stream_options;
      const rawResponse = await this.connector.complete(upstream, credential, signal);
      if (signal.aborted) return deny();
      const result = responseSchema.safeParse(rawResponse);
      if (!result.success) return deny();
      const response = result.data;
      inputTokens = response.usage.prompt_tokens;
      outputTokens = response.usage.completion_tokens;
      if (response.model !== policy.modelId ||
        response.usage.total_tokens !== inputTokens + outputTokens ||
        inputTokens > policy.maxInputTokensPerRequest || outputTokens > maxOutput ||
        response.choices[0].message.tool_calls?.some((call) => !allowed.has(call.function.name)) ||
        JSON.stringify(response).includes(credential)) return deny();
      accounted = upperCost(inputTokens, outputTokens, policy);
      status = 'SUCCEEDED';
      return response;
    } finally {
      await this.usage.settle({ requestId, accountedMicroUsd: accounted, inputTokens, outputTokens, status });
    }
  }
}
