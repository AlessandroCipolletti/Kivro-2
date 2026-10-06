import { Pool } from 'pg';
import { PostgresFinanceRepository } from '../../../../packages/persistence/src/finance.js';
import { StripeHttpGateway } from '../../../../packages/infrastructure/stripe/src/gateway.js';

export interface FinanceService {
  readonly repository: PostgresFinanceRepository;
  readonly gateway: StripeHttpGateway;
  readonly webhookSecret: string;
  readonly database: Pool;
}
let cached: FinanceService | undefined;

/** Server-only construction; no Stripe secret or provider object enters a Worker offer. */
export function getFinanceService(): FinanceService {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  const mode = process.env.KIVRO_STRIPE_MODE;
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!url || !key || !secret || (mode !== 'test' && mode !== 'live') ||
    !secret.startsWith('whsec_')) throw new Error('Missing server-side finance configuration');
  const database = new Pool({ connectionString: url, max: 8 });
  const gateway = new StripeHttpGateway(key, mode);
  cached = { database, gateway, webhookSecret: secret,
    repository: new PostgresFinanceRepository(database, mode) };
  return cached;
}
