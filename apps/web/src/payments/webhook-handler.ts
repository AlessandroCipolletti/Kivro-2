import type { FinanceService } from './server.js';
import { FinanceError } from '../../../../packages/application/src/finance-policy.js';
import { ZodError } from 'zod';

/** Stripe signs raw bytes. Never parse JSON or mutate the body before verification. */
export async function handleStripeWebhook(request: Request, service: FinanceService): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ code: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  const signature = request.headers.get('stripe-signature');
  if (!signature || request.headers.get('content-type')?.split(';',1)[0] !== 'application/json') {
    return Response.json({ code: 'INVALID_WEBHOOK' }, { status: 400 });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 1_000_000) {
    return Response.json({ code: 'INVALID_WEBHOOK' }, { status: 413 });
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ code: 'INVALID_WEBHOOK' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 1_000_000) {
        await reader.cancel();
        return Response.json({ code: 'INVALID_WEBHOOK' }, { status: 413 });
      }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  try {
    await service.repository.receiveStripeWebhook(Buffer.concat(chunks), signature, service.webhookSecret);
    // The durable inbox is processed by bounded reconciliation, never in the webhook request.
    return Response.json({ received: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const invalid = error instanceof FinanceError || error instanceof ZodError ||
      error instanceof SyntaxError || error instanceof Error &&
      error.message.startsWith('STRIPE_WEBHOOK_');
    return Response.json({ code: invalid ? 'INVALID_WEBHOOK' : 'WEBHOOK_PERSISTENCE_UNAVAILABLE' },
      { status: invalid ? 400 : 500,
      headers: { 'Cache-Control': 'no-store' } });
  }
}
