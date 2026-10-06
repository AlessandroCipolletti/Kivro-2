import { timingSafeEqual } from 'node:crypto';
import { getFinanceService } from '../../../../../src/payments/server.js';
import { reconcileFinance } from '../../../../../../../packages/application/src/finance-reconciliation.js';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.FINANCE_CRON_SECRET;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || secret.length < 32 || bearer.length !== secret.length ||
    !timingSafeEqual(Buffer.from(bearer), Buffer.from(secret))) {
    return Response.json({ code: 'UNAUTHORIZED' }, { status: 401,
      headers: { 'Cache-Control': 'no-store' } });
  }
  const service = getFinanceService();
  const result = await reconcileFinance(service.repository, service.gateway, 50);
  return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
