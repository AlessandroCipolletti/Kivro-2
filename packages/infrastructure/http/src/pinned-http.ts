import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { DnsResolver, PinnedPublicHttpTransport, PublicHttpResponse } from '../../contracts/src/research-ports.js';
import { isPublicInternetAddress, NetworkPolicyError, parseResearchUrl } from '../../../policy-engine/src/public-destination.js';

export class SystemDnsResolver implements DnsResolver {
  async lookupAll(host: string): Promise<readonly string[]> {
    const literal = host.replace(/^\[|\]$/g, '');
    if (isIP(literal)) return [literal];
    const records = await lookup(host, { all: true, verbatim: true });
    return records.map((item) => item.address);
  }
}

/** No proxy, no connection pooling and no second DNS lookup: the vetted address is pinned at socket creation. */
export class NodePinnedPublicHttpTransport implements PinnedPublicHttpTransport {
  request(input: { url: URL; pinnedAddress: string; method: 'GET' | 'HEAD'; maxBytes: number; timeoutMs: number;
    headers?: Readonly<Record<string, string>> }): Promise<PublicHttpResponse> {
    if (!Number.isInteger(input.maxBytes) || input.maxBytes < 1 || input.maxBytes > 5_000_000 ||
      !Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 15_000) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    if (!isPublicInternetAddress(input.pinnedAddress)) throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
    const url = parseResearchUrl(input.url.href);
    const originalHost = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(originalHost) && originalHost !== input.pinnedAddress) throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
    if (input.method !== 'GET' && input.method !== 'HEAD') throw new NetworkPolicyError('METHOD_NOT_ALLOWED');
    const client = input.url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const request = client.request(url, {
        hostname: input.pinnedAddress, servername: originalHost,
        method: input.method, agent: false, timeout: input.timeoutMs,
        headers: { ...input.headers, 'Host': url.host,
          'Accept': 'text/html,text/plain,application/json,application/pdf,image/jpeg,image/png',
          'Accept-Encoding': 'identity', 'User-Agent': 'KivroResearch/1.0' },
      }, (response) => {
        const headers: Record<string, string | undefined> = {};
        for (const [name, value] of Object.entries(response.headers)) headers[name] = Array.isArray(value) ? undefined : value;
        const length = Number(headers['content-length'] ?? 0);
        if (headers['content-encoding'] && headers['content-encoding'] !== 'identity') {
          response.destroy(); reject(new NetworkPolicyError('NETWORK_POLICY_DENIED')); return;
        }
        if (Number.isFinite(length) && length > input.maxBytes) {
          response.destroy(); reject(new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED')); return;
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > input.maxBytes) {
            response.destroy(new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers, body: Buffer.concat(chunks, size) }));
      });
      request.on('timeout', () => request.destroy(new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED')));
      request.on('error', reject);
      request.end();
    });
  }
}
