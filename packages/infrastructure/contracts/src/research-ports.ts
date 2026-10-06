import type { ReadOnlyResourceOperation } from '../../../contracts/src/local-resource-policy.js';

export interface SearchResult { readonly url: string; readonly title: string; readonly description: string }
export interface WebSearchProvider {
  search(request: { query: string; maxResults: number; locale?: string }): Promise<readonly SearchResult[]>;
}

export interface DnsResolver {
  lookupAll(host: string): Promise<readonly string[]>;
}

export interface PublicHttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: Uint8Array;
}

/** Implementations must connect to pinnedAddress, preserving original host for Host/SNI. */
export interface PinnedPublicHttpTransport {
  request(input: { url: URL; pinnedAddress: string; method: 'GET' | 'HEAD'; maxBytes: number; timeoutMs: number;
    headers?: Readonly<Record<string, string>> }): Promise<PublicHttpResponse>;
}

export interface ResearchUsagePort {
  begin(input: { requestId: string; jobId: string; capabilityVersionId: string; operation: 'SEARCH' | 'FETCH' | 'DOWNLOAD';
    host: string | null; queryHash: string | null; byteReservation: number; maxTotalBytes: number;
    maxQueries: number; maxPages: number; maxDownloads: number; maxDownloadsBytes: number;
    maxConcurrent: number; maxPerHost: number; maxDurationMs: number }): Promise<void>;
  finish(input: { requestId: string; bytes: number; contentType: string | null; status: number | null; blockedReason: string | null }): Promise<void>;
  deny(input: { jobId: string; capabilityVersionId: string; operation: 'SEARCH' | 'FETCH' | 'DOWNLOAD';
    host: string | null; queryHash: string | null; reason: string }): Promise<void>;
  markPrivateResourceRead(jobId: string, capabilityVersionId: string): Promise<void>;
}

export interface LocalResourceAuditPort {
  record(input: { jobId: string; capabilityVersionId: string; resourceId: string; operationId: string;
    rowCount: number; status: 'ALLOWED' | 'DENIED'; reason: string | null; occurredAt: string }): Promise<void>;
}

export interface LocalResourceQueryPort {
  query(operation: ReadOnlyResourceOperation, lookup: string, statementTimeoutMs: number): Promise<readonly Record<string, unknown>[]>;
}

export interface DeclaredApiUsagePort {
  begin(input: { requestId: string; jobId: string; capabilityVersionId: string; connectorId: string;
    host: string; method: string; maxRequestsPerJob: number }): Promise<void>;
  finish(input: { requestId: string; responseBytes: number; status: 'ALLOWED' | 'DENIED'; reason: string | null }): Promise<void>;
  deny(input: { jobId: string; capabilityVersionId: string; connectorId: string; reason: string }): Promise<void>;
}

export interface ProviderUsagePort {
  reserve(input: { requestId: string; jobId: string; capabilityVersionId: string; providerId: string;
    modelId: string; reserveMicroUsd: number; maxRequestsPerJob: number; maxSpendMicroUsdPerJob: number;
    reservedInputTokens: number; reservedOutputTokens: number; maxTokensPerJob: number;
    maxDailyJobs: number; maxDailySpendMicroUsd: number }): Promise<void>;
  settle(input: { requestId: string; accountedMicroUsd: number; inputTokens: number; outputTokens: number;
    status: 'SUCCEEDED' | 'FAILED'; measuredCostMicroUsd?: number | null }): Promise<void>;
}
