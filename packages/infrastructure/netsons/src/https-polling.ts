import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from '../../../contracts/src/canonical-json.js';
import { workerMessageHash, workerSignatureBytes } from '../../../worker-protocol/src/auth.js';
import { JobAcceptedSchema, JobOfferSchema, WorkerHeartbeatSchema, WorkerHelloSchema,
  WorkerJobControlAckSchema, WorkerJobControlCommandSchema, WorkerWelcomeSchema,
  WorkerLocalJobControlReportSchema,
  WORKER_PROTOCOL_VERSION } from '../../../worker-protocol/src/messages.js';
import type { WorkerProtocolTransport } from '../../../worker-protocol/src/transport.js';

const controlPlane = z.strictObject({
  id: z.string().min(1).max(160),
  state: z.enum(['ACTIVE', 'DRAINING']),
  endpoint: z.url(),
});
const discovery = z.strictObject({
  discoveryVersion: z.literal(1),
  controlPlanes: z.array(controlPlane).min(1).max(4),
});
const pollResponse = z.strictObject({
  protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messages: z.array(z.union([WorkerWelcomeSchema, JobOfferSchema,
    WorkerJobControlCommandSchema])).max(32),
});
const outboundMessage = z.union([WorkerHeartbeatSchema, JobAcceptedSchema,
  WorkerJobControlAckSchema,WorkerLocalJobControlReportSchema]);

export interface WorkerMessageSigner {
  readonly deviceId: string;
  signChallenge(bytes: Uint8Array): Uint8Array;
}

export class WorkerPollingError extends Error {
  constructor(readonly code: 'UNTRUSTED_ENDPOINT' | 'DISCOVERY_FAILED' | 'PROTOCOL_MISMATCH' |
    'TRANSPORT_FAILED' | 'RESPONSE_LIMIT' | 'WRONG_CONTROL_PLANE') {
    super(code); this.name = 'WorkerPollingError';
  }
}

export class WorkerJobRpcError extends Error {
  constructor(readonly code: 'PAYMENT_NOT_SECURED' | 'NOT_ELIGIBLE' | 'WRONG_WORKER' |
    'WRONG_CONTROL_PLANE' | 'INVALID_LEASE' | 'LEASE_EXPIRED' | 'CONFLICT') {
    super(code); this.name = 'WorkerJobRpcError';
  }
}

const rpcDenial = z.strictObject({ code: z.enum(['PAYMENT_NOT_SECURED', 'NOT_ELIGIBLE',
  'WRONG_WORKER', 'WRONG_CONTROL_PLANE', 'INVALID_LEASE', 'LEASE_EXPIRED', 'CONFLICT']) });

function safeUrl(raw: string, allowLocalHttp: boolean): URL {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new WorkerPollingError('UNTRUSTED_ENDPOINT'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const localDevelopment = allowLocalHttp && process.env.NODE_ENV !== 'production';
  if ((url.protocol !== 'https:' && !(localDevelopment && local && url.protocol === 'http:')) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new WorkerPollingError('UNTRUSTED_ENDPOINT');
  }
  return url;
}

async function boundedJson(response: Response, maxBytes: number, requireOk = true): Promise<unknown> {
  if ((requireOk && !response.ok) || !response.body) throw new WorkerPollingError('TRANSPORT_FAILED');
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) > maxBytes) throw new WorkerPollingError('RESPONSE_LIMIT');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new WorkerPollingError('RESPONSE_LIMIT');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new WorkerPollingError('PROTOCOL_MISMATCH'); }
}

/** Stable HTTPS discovery may direct a Worker to two simultaneous control planes. */
export async function discoverWorkerControlPlanes(rawUrl: string, options: {
  readonly allowLocalHttp?: boolean; readonly fetcher?: typeof fetch;
} = {}): Promise<readonly z.infer<typeof controlPlane>[]> {
  const url = safeUrl(rawUrl, options.allowLocalHttp === true);
  const endpoint = new URL('/.well-known/kivro-worker', url);
  let response: Response;
  try { response = await (options.fetcher ?? fetch)(endpoint, {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10_000),
    headers: { accept: 'application/json' },
  }); } catch { throw new WorkerPollingError('DISCOVERY_FAILED'); }
  if (!response.ok) throw new WorkerPollingError('DISCOVERY_FAILED');
  const parsed = discovery.safeParse(await boundedJson(response, 16_384));
  if (!parsed.success) throw new WorkerPollingError('PROTOCOL_MISMATCH');
  const ids = new Set<string>();
  for (const plane of parsed.data.controlPlanes) {
    if (ids.has(plane.id)) throw new WorkerPollingError('PROTOCOL_MISMATCH');
    ids.add(plane.id);
    safeUrl(plane.endpoint, options.allowLocalHttp === true);
  }
  return parsed.data.controlPlanes;
}

/** Outbound-only transport. Every request is signed by the persistent Worker device key. */
export class HttpsPollingWorkerTransport implements WorkerProtocolTransport {
  readonly kind = 'HTTPS_POLLING' as const;
  readonly supportedProtocolVersions = [WORKER_PROTOCOL_VERSION];
  private readonly endpoint: URL;
  private readonly fetcher: typeof fetch;

  constructor(readonly controlPlaneId: string, rawEndpoint: string,
    private readonly signer: WorkerMessageSigner, options: {
      readonly allowLocalHttp?: boolean; readonly fetcher?: typeof fetch;
    } = {}) {
    this.controlPlaneId = z.string().min(1).max(160).parse(controlPlaneId);
    z.uuid().parse(signer.deviceId);
    this.endpoint = safeUrl(rawEndpoint, options.allowLocalHttp === true);
    this.fetcher = options.fetcher ?? fetch;
  }

  private signedBody(body: unknown): string {
    const unsigned = { workerDeviceId: this.signer.deviceId,
      controlPlaneId: this.controlPlaneId, messageId: randomUUID(),
      signedAt: new Date().toISOString(), bodyHash: workerMessageHash(body) };
    const signature = Buffer.from(this.signer.signChallenge(workerSignatureBytes(unsigned))).toString('base64url');
    return canonicalJson({ envelope: { ...unsigned, signature }, body });
  }

  async send(message: unknown): Promise<void> {
    const checked = outboundMessage.parse(message);
    if (checked.workerDeviceId !== this.signer.deviceId ||
      checked.controlPlaneId !== this.controlPlaneId) throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    let response: Response;
    try { response = await this.fetcher(new URL('/worker/messages', this.endpoint), {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15_000),
      headers: { 'content-type': 'application/json' }, body: this.signedBody(checked),
    }); } catch { throw new WorkerPollingError('TRANSPORT_FAILED'); }
    if (response.status !== 204) throw new WorkerPollingError('TRANSPORT_FAILED');
  }

  async poll(rawHello: unknown): Promise<z.infer<typeof pollResponse>['messages']> {
    const hello = WorkerHelloSchema.parse(rawHello);
    if (hello.workerDeviceId !== this.signer.deviceId || hello.controlPlaneId !== this.controlPlaneId) {
      throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    }
    let response: Response;
    try { response = await this.fetcher(new URL('/worker/poll', this.endpoint), {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(35_000),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: this.signedBody(hello),
    }); } catch { throw new WorkerPollingError('TRANSPORT_FAILED'); }
    const parsed = pollResponse.safeParse(await boundedJson(response, 262_144));
    if (!parsed.success) throw new WorkerPollingError('PROTOCOL_MISMATCH');
    if (parsed.data.messages.some((message) => message.controlPlaneId !== this.controlPlaneId)) {
      throw new WorkerPollingError('WRONG_CONTROL_PLANE');
    }
    if(parsed.data.messages[0]?.type!=='WORKER_WELCOME'||
      !parsed.data.messages[0].pauseDirective)
      throw new WorkerPollingError('PROTOCOL_MISMATCH');
    return parsed.data.messages;
  }

  /** Fixed authenticated job RPCs; full server routes are composed with the API milestone. */
  async postJobRpc(kind: 'ACCEPT' | 'ACCEPTED_INPUT' | 'TRANSITION' | 'RENEW_LEASE' |
    'FINALIZE_RESULT', body: unknown): Promise<unknown> {
    const path = ({ ACCEPT: '/worker/jobs/accept', ACCEPTED_INPUT: '/worker/jobs/accepted-input',
      TRANSITION: '/worker/jobs/transition', RENEW_LEASE: '/worker/jobs/renew-lease',
      FINALIZE_RESULT: '/worker/jobs/finalize-result' } as const)[kind];
    let response: Response;
    try { response = await this.fetcher(new URL(path, this.endpoint), {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: this.signedBody(body),
    }); } catch { throw new WorkerPollingError('TRANSPORT_FAILED'); }
    if (!response.ok) {
      const denied = rpcDenial.safeParse(await boundedJson(response, 4096, false));
      if (denied.success) throw new WorkerJobRpcError(denied.data.code);
      throw new WorkerPollingError('TRANSPORT_FAILED');
    }
    return boundedJson(response, kind === 'ACCEPTED_INPUT' ? 2_097_152 : 262_144);
  }

  async close(): Promise<void> { /* Each poll request is bounded and owns no incoming listener. */ }
}
