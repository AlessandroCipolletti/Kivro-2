import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { STRIPE_API_VERSION, type StripeMode } from '../../infrastructure/contracts/src/payment-ports.js';

const StripeEventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/),
  object: z.literal('event'),
  type: z.string().min(3).max(100),
  api_version: z.literal(STRIPE_API_VERSION),
  livemode: z.boolean(),
  created: z.number().int().positive(),
  account: z.string().regex(/^acct_[A-Za-z0-9]+$/).optional(),
  data: z.object({ object: z.object({ id: z.string().min(4).max(160),
    object: z.string().min(2).max(100) }) }),
});

export interface VerifiedStripeEvent {
  readonly id: string; readonly type: string; readonly objectId: string;
  readonly objectType: string; readonly mode: StripeMode; readonly createdAt: string;
  readonly connectedAccountId: string | null;
  readonly payloadHash: string;
}

/** Verify original HTTP bytes before parsing; never store the card-bearing raw event. */
export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string,
  webhookSecret: string, mode: StripeMode, nowSeconds = Math.floor(Date.now() / 1000)):
  VerifiedStripeEvent {
  if (!Buffer.isBuffer(rawBody) || rawBody.length < 2 || rawBody.length > 1_000_000 ||
    !webhookSecret.startsWith('whsec_') || signatureHeader.length > 1000) {
    throw new Error('STRIPE_WEBHOOK_INVALID');
  }
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampText = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestampText || !/^\d{10,11}$/.test(timestampText) || !signatures.length) {
    throw new Error('STRIPE_WEBHOOK_SIGNATURE');
  }
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
    throw new Error('STRIPE_WEBHOOK_EXPIRED');
  }
  const expected = createHmac('sha256', webhookSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest();
  if (!signatures.some((signature) => /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(expected, Buffer.from(signature, 'hex')))) {
    throw new Error('STRIPE_WEBHOOK_SIGNATURE');
  }
  const event = StripeEventSchema.parse(JSON.parse(rawBody.toString('utf8')) as unknown);
  if (event.livemode !== (mode === 'live')) throw new Error('STRIPE_WEBHOOK_MODE');
  return { id: event.id, type: event.type, objectId: event.data.object.id,
    objectType: event.data.object.object, mode,
    connectedAccountId: event.account ?? null,
    createdAt: new Date(event.created * 1000).toISOString(),
    payloadHash: `sha256:${createHash('sha256').update(rawBody).digest('hex')}` };
}
