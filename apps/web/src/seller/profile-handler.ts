import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { createSellerProfile, getSellerProfile, SellerProfileError } from '../../../../packages/persistence/src/seller-profiles.js';

const createBody = z.strictObject({ displayName: z.string(), executionModelConfirmed: z.literal(true) });
const maximumBodyBytes = 4096;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function boundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new TypeError('Missing request body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maximumBodyBytes) {
        void reader.cancel().catch(() => undefined);
        throw new TypeError('Request body is too large');
      }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

/** Session identity is the only account selector; the request may never name another seller. */
export async function handleSellerProfileRequest(request: Request, service: AuthService): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.method === 'POST') {
    const configuredOrigin = process.env.APP_ORIGIN;
    if (!configuredOrigin || request.headers.get('origin') !== new URL(configuredOrigin).origin) {
      return json({ code: 'ORIGIN_DENIED' }, 403);
    }
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      return json({ code: 'INVALID_CONTENT_TYPE' }, 415);
    }
  }
  const session = await service.auth.api.getSession({ headers: request.headers });
  if (!session) return json({ code: 'UNAUTHENTICATED' }, 401);
  const accountId = session.user.id;
  if (request.method === 'GET') {
    const profile = await getSellerProfile(service.database, accountId);
    return json({ profile }, 200);
  }
  try {
    const body = createBody.parse(await boundedJson(request));
    const existing = await getSellerProfile(service.database, accountId);
    const profile = await createSellerProfile(service.database, accountId, body.displayName, body.executionModelConfirmed);
    return json({ profile }, existing ? 200 : 201);
  } catch (error) {
    if (error instanceof SellerProfileError) return json({ code: error.code }, 403);
    if (error instanceof z.ZodError || error instanceof TypeError || error instanceof SyntaxError) {
      return json({ code: 'INVALID_INPUT' }, 400);
    }
    throw error;
  }
}
