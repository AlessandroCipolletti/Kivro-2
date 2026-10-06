import { createHash, randomUUID } from 'node:crypto';
import type { DnsResolver, PinnedPublicHttpTransport, ResearchUsagePort, SearchResult, WebSearchProvider } from '../../infrastructure/contracts/src/research-ports.js';
import { InternetPolicySchema, type PublicResearchPolicy } from '../../contracts/src/internet-policy.js';
import { isPublicInternetAddress, NetworkPolicyError, parseResearchUrl } from '../../policy-engine/src/public-destination.js';

export interface ResearchBinding { readonly jobId: string; readonly capabilityVersionId: string; readonly internetPolicy: unknown }
export interface ResearchSource { readonly url: string; readonly title?: string; readonly accessedAt: string }
export interface WebPageResult { readonly finalUrl: string; readonly title?: string; readonly text: string;
  readonly contentType: string; readonly fetchedAt: string; readonly trust: 'UNTRUSTED_PUBLIC_WEB' }
export interface DownloadResult { readonly finalUrl: string; readonly name: string; readonly contentType: string;
  readonly sha256: `sha256:${string}`; readonly bytes: Uint8Array; readonly trust: 'UNTRUSTED_DOWNLOAD_DATA' }
export interface NormalizedSearchResult extends SearchResult { readonly trust: 'UNTRUSTED_PUBLIC_WEB' }

function requestIdOrNew(value: string | undefined): string {
  if (value === undefined) return randomUUID();
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }
  return value;
}

function policyFor(binding: ResearchBinding): PublicResearchPolicy {
  const policy = InternetPolicySchema.parse(binding.internetPolicy);
  if (policy.mode !== 'PUBLIC_WEB_RESEARCH') throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  return policy;
}

function ensureDomain(policy: PublicResearchPolicy, url: URL): void {
  if (policy.domains.mode === 'ONLY_DECLARED_DOMAINS' && !policy.domains.hosts.includes(url.hostname)) {
    throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }
}

function contentType(headers: Readonly<Record<string, string | undefined>>): string {
  return (headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function readableText(bytes: Uint8Array, type: string): string {
  let value: string;
  try { value = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new NetworkPolicyError('NETWORK_POLICY_DENIED'); }
  if (type === 'text/html') {
    value = value.replace(/<!--[^]*?-->/g, ' ').replace(/<(script|style|svg|iframe|object|template)\b[^>]*>[^]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ').replace(/&(?:lt|gt|amp|quot|#39|nbsp);/gi, (match) => ({
        '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
      } as Record<string, string>)[match.toLowerCase()] ?? ' ');
  }
  return [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, 1_000_000);
}

function matchesDownloadType(bytes: Uint8Array, type: string): boolean {
  const prefix = Buffer.from(bytes.subarray(0, 8));
  if (type === 'application/pdf') return prefix.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return prefix.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  if (type === 'text/csv') {
    try { return !new TextDecoder('utf-8', { fatal: true }).decode(bytes).includes('\0'); }
    catch { return false; }
  }
  return false;
}

export class ResearchBroker {
  constructor(private readonly searchProvider: WebSearchProvider, private readonly resolver: DnsResolver,
    private readonly transport: PinnedPublicHttpTransport, private readonly usage: ResearchUsagePort) {}

  private budget(binding: ResearchBinding, policy: PublicResearchPolicy, operation: 'SEARCH' | 'FETCH' | 'DOWNLOAD',
    requestId: string, host: string | null, bytes: number, queryHash: string | null = null) {
    return { requestId, jobId: binding.jobId, capabilityVersionId: binding.capabilityVersionId, operation, host, queryHash,
      byteReservation: bytes, maxTotalBytes: policy.limits.maxNetworkBytesPerJob,
      maxQueries: policy.search.enabled ? policy.search.maxQueriesPerJob : 0,
      maxPages: policy.fetch.enabled ? policy.fetch.maxPagesPerJob : 0,
      maxDownloads: policy.download.enabled ? policy.download.maxDownloadsPerJob : 0,
      maxDownloadsBytes: policy.download.enabled ? policy.download.maxBytesPerJob : 0,
      maxConcurrent: policy.limits.maxConcurrentRequests, maxPerHost: policy.limits.maxRequestsPerHost,
      maxDurationMs: policy.limits.maxDurationMs };
  }

  private async audited<T>(binding: ResearchBinding, operation: 'SEARCH' | 'FETCH' | 'DOWNLOAD',
    host: string | null, queryHash: string | null, work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) {
      await this.usage.deny({ jobId: binding.jobId, capabilityVersionId: binding.capabilityVersionId,
        operation, host, queryHash, reason: error instanceof NetworkPolicyError ? error.code : 'BROKER_UNAVAILABLE' });
      throw error;
    }
  }

  async search(binding: ResearchBinding, input: { query: string; maxResults: number; locale?: string; requestId?: string }): Promise<readonly NormalizedSearchResult[]> {
    return this.audited(binding, 'SEARCH', null, typeof input.query === 'string' && input.query.length <= 256 ?
      `sha256:${createHash('sha256').update(input.query).digest('hex')}` : null,
      () => this.searchInternal(binding, input));
  }

  private async searchInternal(binding: ResearchBinding, input: { query: string; maxResults: number; locale?: string; requestId?: string }): Promise<readonly NormalizedSearchResult[]> {
    const policy = policyFor(binding);
    if (!policy.search.enabled || typeof input.query !== 'string' || input.query.length < 2 || input.query.length > 256 ||
      !Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > policy.search.maxResults ||
      (input.locale !== undefined && (typeof input.locale !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.locale)))) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    const requestId = requestIdOrNew(input.requestId);
    const hash = `sha256:${createHash('sha256').update(input.query).digest('hex')}`;
    await this.usage.begin(this.budget(binding, policy, 'SEARCH', requestId, null, 1_000_000, hash));
    let bytes = 0, status: number | null = null, reason: string | null = null;
    try {
      const raw = await this.searchProvider.search({ query: input.query, maxResults: input.maxResults,
        ...(input.locale ? { locale: input.locale } : {}) });
      const results = raw.slice(0, input.maxResults).flatMap((item) => {
        try {
          const url = parseResearchUrl(item.url); ensureDomain(policy, url);
          return [{ url: url.href, title: readableText(Buffer.from(item.title.slice(0, 200)), 'text/html'),
            description: readableText(Buffer.from(item.description.slice(0, 500)), 'text/html'),
            trust: 'UNTRUSTED_PUBLIC_WEB' as const }];
        } catch { return []; }
      });
      bytes = Buffer.byteLength(JSON.stringify(results));
      if (bytes > 1_000_000) throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      status = 200;
      return results;
    } catch (error) {
      const structured = error instanceof NetworkPolicyError ? error : new NetworkPolicyError('BROKER_UNAVAILABLE');
      reason = structured.code;
      throw structured;
    }
    finally { await this.usage.finish({ requestId, bytes, contentType: 'application/json', status, blockedReason: reason }); }
  }

  private async retrieve(binding: ResearchBinding, rawUrl: string, operation: 'FETCH' | 'DOWNLOAD', method: string,
    requestId: string): Promise<{ finalUrl: URL; bytes: Uint8Array; type: string; text: string | null }> {
    const policy = policyFor(binding);
    if (method !== 'GET' && method !== 'HEAD') throw new NetworkPolicyError('METHOD_NOT_ALLOWED');
    if ((operation === 'FETCH' && !policy.fetch.enabled) || (operation === 'DOWNLOAD' && (!policy.download.enabled || method !== 'GET'))) {
      throw new NetworkPolicyError(operation === 'DOWNLOAD' ? 'DOWNLOAD_POLICY_DENIED' : 'NETWORK_POLICY_DENIED');
    }
    const initial = parseResearchUrl(rawUrl); ensureDomain(policy, initial);
    const maxBytes = operation === 'FETCH' ? policy.fetch.maxResponseBytes : policy.download.maxFileBytes;
    const reservation = maxBytes + policy.fetch.maxRedirects * 65_536;
    await this.usage.begin(this.budget(binding, policy, operation, requestId, initial.hostname, reservation));
    let bytes = 0, status: number | null = null, type: string | null = null, reason: string | null = null;
    try {
      let url = initial;
      const visited = new Set<string>();
      for (let redirects = 0; redirects <= policy.fetch.maxRedirects; redirects += 1) {
        if (visited.has(url.href)) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
        visited.add(url.href);
        const host = url.hostname.replace(/^\[|\]$/g, '');
        const addresses = await this.resolver.lookupAll(host);
        if (!addresses.length || addresses.some((address) => !isPublicInternetAddress(address))) {
          throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
        }
        const remaining = Math.min(maxBytes, reservation - bytes);
        const response = await this.transport.request({ url, pinnedAddress: addresses[0]!, method, maxBytes: remaining,
          timeoutMs: policy.fetch.timeoutMs });
        bytes += response.body.byteLength;
        status = response.status;
        if ([301, 302, 303, 307, 308].includes(status)) {
          if (redirects === policy.fetch.maxRedirects || response.body.byteLength > 65_536 || !response.headers.location) {
            throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
          }
          url = parseResearchUrl(new URL(response.headers.location, url).href); ensureDomain(policy, url);
          continue;
        }
        if (status < 200 || status >= 300) throw new NetworkPolicyError('SOURCE_UNAVAILABLE');
        type = contentType(response.headers);
        const allowed = operation === 'FETCH' ? policy.fetch.allowedContentTypes : policy.download.allowedMimeTypes;
        if (!allowed.includes(type)) throw new NetworkPolicyError(operation === 'DOWNLOAD' ? 'DOWNLOAD_POLICY_DENIED' : 'NETWORK_POLICY_DENIED');
        if (operation === 'DOWNLOAD' && !matchesDownloadType(response.body, type)) {
          throw new NetworkPolicyError('DOWNLOAD_POLICY_DENIED');
        }
        const text = operation === 'FETCH' ? readableText(response.body, type) : null;
        return { finalUrl: url, bytes: response.body, type, text };
      }
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    } catch (error) {
      const structured = error instanceof NetworkPolicyError ? error : new NetworkPolicyError('SOURCE_UNAVAILABLE');
      reason = structured.code;
      throw structured;
    }
    finally { await this.usage.finish({ requestId, bytes, contentType: type, status, blockedReason: reason }); }
  }

  async fetch(binding: ResearchBinding, input: { url: string; method?: string; requestId?: string }): Promise<WebPageResult> {
    return this.audited(binding, 'FETCH', null, null, () => this.fetchInternal(binding, input));
  }

  private async fetchInternal(binding: ResearchBinding, input: { url: string; method?: string; requestId?: string }): Promise<WebPageResult> {
    const policy = policyFor(binding);
    if (!policy.fetch.enabled) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const result = await this.retrieve(binding, input.url, 'FETCH', input.method ?? 'GET', requestIdOrNew(input.requestId));
    return { finalUrl: result.finalUrl.href, text: result.text ?? '', contentType: result.type,
      fetchedAt: new Date().toISOString(), trust: 'UNTRUSTED_PUBLIC_WEB' };
  }

  async download(binding: ResearchBinding, input: { url: string; requestId?: string }): Promise<DownloadResult> {
    return this.audited(binding, 'DOWNLOAD', null, null, () => this.downloadInternal(binding, input));
  }

  private async downloadInternal(binding: ResearchBinding, input: { url: string; requestId?: string }): Promise<DownloadResult> {
    const result = await this.retrieve(binding, input.url, 'DOWNLOAD', 'GET', requestIdOrNew(input.requestId));
    return { finalUrl: result.finalUrl.href, name: `research-${randomUUID()}.data`, contentType: result.type,
      sha256: `sha256:${createHash('sha256').update(result.bytes).digest('hex')}`, bytes: result.bytes,
      trust: 'UNTRUSTED_DOWNLOAD_DATA' };
  }
}
