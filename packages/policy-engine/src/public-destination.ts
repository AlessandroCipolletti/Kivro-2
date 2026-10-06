import { BlockList, isIP } from 'node:net';

const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [subnet, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(subnet, prefix, 'ipv4');
for (const [subnet, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['::ffff:0:0', 96],
] as const) blockedV6.addSubnet(subnet, prefix, 'ipv6');

/** Conservative global-unicast-only rule; uncertainty fails closed. */
export function isPublicInternetAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  if (family !== 6 || !/^[23][0-9a-f]*:/i.test(address)) return false;
  return !blockedV6.check(address, 'ipv6');
}

export function parseResearchUrl(raw: string): URL {
  if (typeof raw !== 'string' || raw.length > 2048 || [...raw].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }
  let url: URL;
  try { url = new URL(raw); } catch { throw new NetworkPolicyError('NETWORK_POLICY_DENIED'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || !url.hostname ||
      url.hostname.endsWith('.') || url.hostname.endsWith('.local') || url.hostname === 'localhost') {
    throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }
  if (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  // WHATWG URL canonicalizes numeric IPv4 and encoded host forms before this test.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicInternetAddress(host)) throw new NetworkPolicyError('PRIVATE_DESTINATION_DENIED');
  return url;
}

export type NetworkPolicyErrorCode = 'NETWORK_POLICY_DENIED' | 'PRIVATE_DESTINATION_DENIED' | 'METHOD_NOT_ALLOWED' |
  'NETWORK_BUDGET_EXCEEDED' | 'DOWNLOAD_POLICY_DENIED' | 'SOURCE_UNAVAILABLE' | 'BROKER_UNAVAILABLE';

export class NetworkPolicyError extends Error {
  constructor(readonly code: NetworkPolicyErrorCode) { super(code); this.name = 'NetworkPolicyError'; }
}
