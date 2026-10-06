import { randomUUID } from 'node:crypto';
import { ProviderBudgetPolicySchema, type ProviderBudgetPolicy } from '../../contracts/src/provider-budget-policy.js';
import type { ProviderUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';

export interface SellerCredentialVault { resolve(ref: string): Promise<string> }
export interface InferenceConnector {
  readonly providerId: string;
  invoke(input: { modelId: string; prompt: string; maxOutputTokens: number; credential: string }): Promise<{
    text: string; inputTokens: number; outputTokens: number }>; 
}

function upperCost(policy: ProviderBudgetPolicy, inputTokens: number, outputTokens: number): number {
  return Math.ceil(inputTokens * policy.inputPriceMicroUsdPerMillionTokens / 1_000_000) +
    Math.ceil(outputTokens * policy.outputPriceMicroUsdPerMillionTokens / 1_000_000);
}

/** Credential and cost enforcement stays outside OpenClaw. Job/version authenticity is supplied by M07. */
export class SellerProviderBroker {
  constructor(private readonly vault: SellerCredentialVault, private readonly connector: InferenceConnector,
    private readonly usage: ProviderUsagePort) {}

  async invoke(binding: { jobId: string; capabilityVersionId: string; providerBudget: unknown },
    input: { modelId: string; prompt: string; estimatedInputTokens: number; maxOutputTokens: number; requestId?: string }) {
    const policy = ProviderBudgetPolicySchema.parse(binding.providerBudget);
    if (policy.providerId !== this.connector.providerId || input.modelId !== policy.modelId ||
      !Number.isInteger(input.estimatedInputTokens) || input.estimatedInputTokens < 1 ||
      input.estimatedInputTokens > policy.maxInputTokensPerRequest ||
      !Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 ||
      input.maxOutputTokens > policy.maxOutputTokensPerRequest ||
      input.prompt.length > 500_000) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const reserveMicroUsd = upperCost(policy, input.estimatedInputTokens, input.maxOutputTokens);
    if (reserveMicroUsd <= 0) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const requestId = input.requestId ?? randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    await this.usage.reserve({ requestId, jobId: binding.jobId, capabilityVersionId: binding.capabilityVersionId,
      providerId: policy.providerId, modelId: policy.modelId, reserveMicroUsd,
      maxRequestsPerJob: policy.maxRequestsPerJob, maxSpendMicroUsdPerJob: policy.maxEstimatedSpendMicroUsdPerJob });
    let accountedMicroUsd = reserveMicroUsd, inputTokens = 0, outputTokens = 0;
    let status: 'SUCCEEDED' | 'FAILED' = 'FAILED';
    try {
      const credential = await this.vault.resolve(policy.credentialRef);
      if (!credential) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const response = await this.connector.invoke({ modelId: policy.modelId, prompt: input.prompt,
        maxOutputTokens: input.maxOutputTokens, credential });
      inputTokens = response.inputTokens; outputTokens = response.outputTokens;
      if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens) || inputTokens < 0 || outputTokens < 0 ||
        inputTokens > input.estimatedInputTokens || outputTokens > input.maxOutputTokens ||
        response.text.includes(credential)) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      accountedMicroUsd = upperCost(policy, inputTokens, outputTokens);
      status = 'SUCCEEDED';
      return { text: response.text, usage: { inputTokens, outputTokens, estimatedCostMicroUsd: accountedMicroUsd,
        costOwner: 'SELLER' as const } };
    } finally { await this.usage.settle({ requestId, accountedMicroUsd, inputTokens, outputTokens, status }); }
  }
}
