import { SystemDnsResolver, NodePinnedPublicHttpTransport } from '../dist/packages/infrastructure/http/src/pinned-http.js';
import { isPublicInternetAddress } from '../dist/packages/policy-engine/src/public-destination.js';
import process from 'node:process';
import { URL } from 'node:url';

const url = new URL('https://example.com/');
const addresses = await new SystemDnsResolver().lookupAll(url.hostname);
if (!addresses.length || addresses.some((address) => !isPublicInternetAddress(address))) {
  throw new Error('Public fetch health check resolved an unsafe address');
}
const response = await new NodePinnedPublicHttpTransport().request({ url, pinnedAddress: addresses[0],
  method: 'GET', maxBytes: 100_000, timeoutMs: 5_000 });
if (response.status !== 200 || !(response.headers['content-type'] ?? '').startsWith('text/html') ||
  response.body.byteLength === 0) throw new Error('Public fetch health check failed');
process.stdout.write(`Public pinned HTTPS fetch passed: ${response.status}, ${response.body.byteLength} bytes\n`);
