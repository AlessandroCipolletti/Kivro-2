import type { DnsResolver, PinnedPublicHttpTransport, SearchResult, WebSearchProvider } from '../../contracts/src/research-ports.js';
import { isPublicInternetAddress, NetworkPolicyError } from '../../../policy-engine/src/public-destination.js';

/** Platform credential stays in the cloud composition root; never pass it to OpenClaw or the Worker. */
export class BraveWebSearchProvider implements WebSearchProvider {
  constructor(private readonly subscriptionToken: string, private readonly resolver: DnsResolver,
    private readonly transport: PinnedPublicHttpTransport) {
    if (!subscriptionToken || subscriptionToken.length > 4096 ||
      [...subscriptionToken].some((character) => character.charCodeAt(0) < 33 || character.charCodeAt(0) === 127)) {
      throw new Error('Search provider credential unavailable');
    }
  }

  async search(input: { query: string; maxResults: number; locale?: string }): Promise<readonly SearchResult[]> {
    if (typeof input.query !== 'string' || input.query.length < 2 || input.query.length > 256 ||
      !Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > 20 ||
      (input.locale !== undefined && !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.locale))) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', input.query);
    url.searchParams.set('count', String(input.maxResults));
    url.searchParams.set('safesearch', 'strict');
    if (input.locale) url.searchParams.set('country', input.locale.slice(-2).toUpperCase());
    const addresses = await this.resolver.lookupAll(url.hostname);
    if (!addresses.length || addresses.some((address) => !isPublicInternetAddress(address))) {
      throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
    }
    const response = await this.transport.request({ url, pinnedAddress: addresses[0]!, method: 'GET',
      maxBytes: 1_000_000, timeoutMs: 10_000, headers: { 'X-Subscription-Token': this.subscriptionToken } });
    if (response.status !== 200 || (response.headers['content-type'] ?? '').split(';')[0] !== 'application/json') {
      throw new Error('Search provider unavailable');
    }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body)); }
    catch { throw new Error('Invalid search provider response'); }
    if (!parsed || typeof parsed !== 'object' || !('web' in parsed) || !parsed.web || typeof parsed.web !== 'object' ||
      !('results' in parsed.web) || !Array.isArray(parsed.web.results)) throw new Error('Invalid search provider response');
    return parsed.web.results.slice(0, input.maxResults).flatMap((row: unknown) => {
      if (!row || typeof row !== 'object' || !('url' in row) || !('title' in row) || typeof row.url !== 'string' ||
        typeof row.title !== 'string') return [];
      const description = 'description' in row && typeof row.description === 'string' ? row.description : '';
      return [{ url: row.url.slice(0, 2048), title: row.title.slice(0, 200), description: description.slice(0, 500) }];
    });
  }
}
