import type { AgentInferenceTask } from '../../../contracts/src/marketplace-agent.js';

export type PlatformInferenceErrorCode = 'AUTHENTICATION_ERROR'|'RATE_LIMITED'|
  'PROVIDER_UNAVAILABLE'|'TIMEOUT'|'INVALID_REQUEST'|'MODEL_UNAVAILABLE'|
  'CONTENT_POLICY'|'CONTEXT_LIMIT'|'UNKNOWN_PROVIDER_ERROR'|'INVALID_OUTPUT'|
  'CONFIGURATION_ERROR'|'BUDGET_EXCEEDED';

export class PlatformInferenceError extends Error {
  constructor(readonly code: PlatformInferenceErrorCode, readonly retryable = false) {
    super(code); this.name = 'PlatformInferenceError';
  }
}

export interface PlatformToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}
export interface PlatformInferenceRequest {
  readonly task: AgentInferenceTask;
  readonly system: string;
  readonly messages: readonly { role: 'USER'|'ASSISTANT'|'TOOL'; content: string }[];
  readonly tools?: readonly PlatformToolDefinition[];
  readonly toolExchange?: {readonly calls:readonly {id:string;name:string;arguments:unknown}[];
    readonly results:readonly {id:string;name:string;result:unknown}[]};
  readonly responseSchema?: Readonly<Record<string, unknown>>;
  readonly maxOutputTokens: number;
  readonly metadata: { readonly userId?: string; readonly conversationId?: string;
    readonly orchestrationId?: string };
}
export interface PlatformInferenceResponse {
  readonly provider: string;
  readonly model: string;
  readonly text: string | null;
  readonly structuredOutput: unknown;
  readonly toolCalls: readonly { id: string; name: string; arguments: unknown }[];
  readonly usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  readonly latencyMs: number;
}
export interface PlatformInferenceProvider {
  readonly id: 'openai'|'anthropic';
  generate(request: PlatformInferenceRequest, model: string): Promise<PlatformInferenceResponse>;
  healthCheck(): Promise<'READY'|'UNAVAILABLE'>;
}

/** A server-only sink. Seller inference must not write here. */
export interface PlatformInferenceUsageSink {
  recordRoutingConfiguration?(profiles: Readonly<Record<string, unknown>>): Promise<void>;
  reserveRequest(input: {userId: string; task: AgentInferenceTask; maxTokens: number}): Promise<string>;
  recordUsage(input: { requestId: string; userId: string; conversationId?: string;
    orchestrationId?: string; task: AgentInferenceTask; provider: string; model: string;
    inputTokens: number; outputTokens: number; cachedInputTokens: number;
    estimatedCostMicrousd: number|null; latencyMs: number; outcome: 'SUCCESS'|'FAILURE';
    errorCode?: PlatformInferenceErrorCode; toolCallCount: number }): Promise<void>;
}
