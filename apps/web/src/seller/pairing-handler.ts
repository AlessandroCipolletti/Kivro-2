import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { PostgresWorkerPairingRepository, WorkerPairingError } from
  '../../../../packages/persistence/src/worker-pairing.js';

const maxBodyBytes = 4096;

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !==
    'application/json') throw new TypeError('INVALID_CONTENT_TYPE');
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError('EMPTY_BODY');
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBodyBytes) {
        void reader.cancel().catch(() => undefined);
        throw new TypeError('BODY_TOO_LARGE');
      }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
}

function json(value: unknown, status: number): Response {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

const redeemSchema = z.strictObject({
  code: z.string(), deviceId: z.uuid(), publicKeyPem: z.string(),
  possessionSignature: z.string(), name: z.string(),
  platform: z.enum(['MACOS', 'LINUX', 'WINDOWS']), workerRelease: z.string(),
});

/** Pairing is a one-time capability grant from an authenticated seller to a key-holding device. */
export async function handleSellerPairingRequest(request: Request, action: string,
  auth: AuthService): Promise<Response> {
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const pairing = new PostgresWorkerPairingRepository(auth.database);
    if (action === 'issue') {
      const origin = process.env.APP_ORIGIN;
      if (!origin || request.headers.get('origin') !== new URL(origin).origin) {
        return json({ code: 'ORIGIN_DENIED' }, 403);
      }
      const session = await auth.auth.api.getSession({ headers: request.headers });
      if (!session) return json({ code: 'UNAUTHENTICATED' }, 401);
      z.strictObject({}).parse(await readJson(request));
      const owner = await auth.database.query<{ id: string }>(`SELECT id FROM seller_profiles
        WHERE account_id=$1 AND EXISTS (SELECT 1 FROM seller_execution_model_acknowledgements
          WHERE seller_profile_id=seller_profiles.id AND statement_version=1)`, [session.user.id]);
      if (!owner.rows[0]) return json({ code: 'SELLER_PROFILE_REQUIRED' }, 403);
      return json(await pairing.issue(session.user.id, owner.rows[0].id), 201);
    }
    if (action === 'redeem') {
      // The signed proof and one-time random code authenticate this CLI request.
      // A browser session cannot substitute for possession of the device key.
      const body = redeemSchema.parse(await readJson(request));
      return json(await pairing.redeem(body), 201);
    }
    return json({ code: 'NOT_FOUND' }, 404);
  } catch (error) {
    if (error instanceof WorkerPairingError) return json({ code: error.code },
      error.code === 'NOT_ELIGIBLE' ? 403 : 409);
    if (error instanceof z.ZodError || error instanceof TypeError || error instanceof SyntaxError) {
      return json({ code: 'INVALID_INPUT' }, 400);
    }
    throw error;
  }
}

/** Revocation is seller-owned and takes effect in Worker signature validation
 * before another offer or RPC can be accepted. It remains available even if
 * the seller's setup acknowledgement is no longer current. */
export async function handleSellerWorkerRevokeRequest(request: Request,
  deviceId: string, auth: AuthService): Promise<Response> {
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  const origin=process.env.APP_ORIGIN;
  if(!origin||request.headers.get('origin')!==new URL(origin).origin)
    return json({code:'ORIGIN_DENIED'},403);
  const session=await auth.auth.api.getSession({headers:request.headers});
  if(!session)return json({code:'UNAUTHENTICATED'},401);
  try{
    z.uuid().parse(deviceId);
    z.strictObject({}).parse(await readJson(request));
    await new PostgresWorkerPairingRepository(auth.database)
      .revoke(session.user.id,deviceId);
    return json({deviceId,revoked:true},200);
  }catch(error){
    if(error instanceof WorkerPairingError)return json({code:error.code},403);
    if(error instanceof z.ZodError||error instanceof TypeError||
      error instanceof SyntaxError)return json({code:'INVALID_INPUT'},400);
    throw error;
  }
}
