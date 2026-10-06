import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isPublicInternetAddress, NetworkPolicyError } from '../../../policy-engine/src/public-destination.js';
import type { CompletionConnector, CompletionRequest } from '../../../application/src/completion-broker.js';

export interface CompletionDnsPort {
  lookup(host: string): Promise<readonly { address: string; family: number }[]>;
}

const systemDns: CompletionDnsPort = {
  async lookup(host) { return lookup(host, { all: true, verbatim: true }); },
};

function safeEndpoint(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new NetworkPolicyError('NETWORK_POLICY_DENIED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    url.port || url.pathname !== '/v1' || !/^[a-z0-9.-]+$/.test(url.hostname) ||
    !url.hostname.includes('.')) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  return url;
}

/** Fixed HTTPS endpoint, pinned public DNS answer, no redirect or proxy, bounded JSON only. */
export class OpenAiCompatibleHttpsConnector implements CompletionConnector {
  readonly providerId: string;
  private readonly endpoint: URL;

  constructor(providerId: string, endpoint: string, private readonly dns: CompletionDnsPort = systemDns) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(providerId)) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    this.providerId = providerId;
    this.endpoint = safeEndpoint(endpoint);
  }

  async complete(input: CompletionRequest, credential: string, signal: AbortSignal): Promise<unknown> {
    if (!credential || credential.length > 4096 || /[\r\n]/.test(credential) || signal.aborted ||
      input.stream !== false) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const addresses = await this.dns.lookup(this.endpoint.hostname);
    if (!addresses.length || addresses.length > 32 || addresses.some((item) =>
      (item.family !== 4 && item.family !== 6) || !isPublicInternetAddress(item.address))) {
      throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
    }
    const body = Buffer.from(JSON.stringify(input));
    if (body.byteLength > 1_048_576) throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
    const address = addresses[0]!;
    return new Promise((resolve, reject) => {
      const req = httpsRequest({ protocol: 'https:', hostname: this.endpoint.hostname,
        servername: this.endpoint.hostname, port: 443, path: '/v1/chat/completions', method: 'POST',
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json',
          accept: 'application/json', 'content-length': body.byteLength },
        timeout: 30_000, signal,
      }, (res) => {
        const type = res.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
        if (res.statusCode !== 200 || type !== 'application/json' ||
          (res.headers['content-length'] && Number(res.headers['content-length']) > 2_097_152)) {
          res.resume(); reject(new NetworkPolicyError('BROKER_UNAVAILABLE')); return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > 2_097_152) { req.destroy(new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED')); return; }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            const raw = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
            const first = Array.isArray(raw.choices) ? raw.choices[0] as Record<string, unknown> : undefined;
            resolve({ id: raw.id, object: raw.object, created: raw.created, model: raw.model,
              choices: first ? [{ index: first.index, finish_reason: first.finish_reason,
                message: first.message }] : [], usage: raw.usage });
          } catch { reject(new NetworkPolicyError('BROKER_UNAVAILABLE')); }
        });
      });
      req.on('timeout', () => req.destroy(new NetworkPolicyError('BROKER_UNAVAILABLE')));
      req.on('error', () => reject(new NetworkPolicyError('BROKER_UNAVAILABLE')));
      req.end(body);
    });
  }
}
