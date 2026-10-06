import { getFinanceService } from '../../../../src/payments/server.js';
import { handleStripeWebhook } from '../../../../src/payments/webhook-handler.js';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return handleStripeWebhook(request, getFinanceService());
}
