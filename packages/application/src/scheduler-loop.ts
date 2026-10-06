import { setTimeout as delay } from 'node:timers/promises';

export interface SchedulingReconciler {
  reconcile(limit: number): Promise<{ checked: number; queued: number; waiting: number;
    expired: number }>;
}

/** Stateless runner: PostgreSQL plans are the source of truth on every wake and after restart. */
export async function runAvailabilityScheduler(input: { repository: SchedulingReconciler;
  signal: AbortSignal; intervalMs?: number; batchSize?: number;
  onError?: (error: unknown) => void }): Promise<void> {
  const intervalMs=input.intervalMs??5000, batchSize=input.batchSize??100;
  if (!Number.isSafeInteger(intervalMs)||intervalMs<100||intervalMs>300_000||
    !Number.isSafeInteger(batchSize)||batchSize<1||batchSize>500) {
    throw new RangeError('INVALID_SCHEDULER_INTERVAL');
  }
  while (!input.signal.aborted) {
    try { await input.repository.reconcile(batchSize); }
    catch (error) { input.onError?.(error); }
    try { await delay(intervalMs,undefined,{signal:input.signal}); }
    catch { /* Abort ends the loop. */ }
  }
}
