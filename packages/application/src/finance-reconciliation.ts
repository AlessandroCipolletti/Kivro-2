import type { StripeGatewayPort } from '../../infrastructure/contracts/src/payment-ports.js';

export interface FinanceReconciliationPort {
  reconcileStripeInbox(gateway: StripeGatewayPort, limit: number): Promise<number>;
  reconcileStripeProcessingFees(gateway: StripeGatewayPort, limit: number): Promise<number>;
  reconcileStripeProviderState(gateway: StripeGatewayPort, limit: number): Promise<{
    purchases: number; sellers: number }>;
  reconcileTerminalJobs(limit: number): Promise<{ released: number; settled: number }>;
  matureEligibleEarnings(limit: number): Promise<number>;
  queueEligibleTransfers(limit: number): Promise<number>;
  processFinancialOutbox(gateway: StripeGatewayPort, limit: number): Promise<number>;
  reconcileLedger(): Promise<{ unbalancedJournals: number;
    negativeProtectedAccounts: number; reservationMismatches: number }>;
}

/** Bounded idempotent cron orchestration shared by both provider profiles. */
export async function reconcileFinance(repo: FinanceReconciliationPort,
  gateway: StripeGatewayPort, limit = 50) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Invalid limit');
  const inbox = await repo.reconcileStripeInbox(gateway, limit);
  const processingFees = await repo.reconcileStripeProcessingFees(gateway, limit);
  const providerState = await repo.reconcileStripeProviderState(gateway, limit);
  const terminal = await repo.reconcileTerminalJobs(limit);
  const mature = await repo.matureEligibleEarnings(limit);
  const queued = await repo.queueEligibleTransfers(limit);
  const outbox = await repo.processFinancialOutbox(gateway, limit);
  const audit = await repo.reconcileLedger();
  if (Object.values(audit).some((count) => count !== 0)) throw new Error('FINANCIAL_LEDGER_DRIFT');
  return { inbox, processingFees, providerState, terminal, mature, queued, outbox, audit };
}
