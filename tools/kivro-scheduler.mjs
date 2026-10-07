import process from 'node:process';
import pg from 'pg';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { PostgresAvailabilityMetrics } from '../dist/packages/persistence/src/availability-metrics.js';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { PostgresSellerOperations } from '../dist/packages/persistence/src/seller-operations.js';
import { leaseTokenIssuerFromEnvironment } from '../dist/packages/application/src/lease-token.js';
import { runAvailabilityScheduler } from '../dist/packages/application/src/scheduler-loop.js';

const url=process.env.DATABASE_URL;
const mode=process.env.KIVRO_STRIPE_MODE;
const interval=Number(process.env.KIVRO_SCHEDULER_INTERVAL_MS ?? 5000);
const maxPauseSeconds=Number(process.env.KIVRO_MAX_PAUSE_DURATION_SECONDS??14400);
if (!url || (mode!=='test'&&mode!=='live') || !Number.isSafeInteger(interval) ||
  interval<100 || interval>300_000||!Number.isSafeInteger(maxPauseSeconds)||
  maxPauseSeconds<60||maxPauseSeconds>604800)
  throw new Error('INVALID_SCHEDULER_CONFIGURATION');

const database=new pg.Pool({connectionString:url,max:4});
const finance=new PostgresFinanceRepository(database,mode);
const repository=new PostgresAvailabilityRepository(database,finance);
const metrics=new PostgresAvailabilityMetrics(database,repository);
const jobs=new PostgresJobExecutionRepository(database,finance,
  leaseTokenIssuerFromEnvironment(process.env),repository);
const health=new PostgresWorkerHeartbeatRepository(database);
const sellerOperations=new PostgresSellerOperations(database,repository,finance);
const maintenance=async(limit)=>{
  const availabilitySamples=await metrics.sample(limit);
  const maintenanceResumed=await sellerOperations.expireMaintenance(limit);
  const timedOut=await jobs.expireOverduePausedJobs(maxPauseSeconds,limit);
  const staleWorkers=await health.recordStaleWorkers(limit);
  const financeResult=await finance.reconcileTerminalJobs(limit);
  return {availabilitySamples,maintenanceResumed,timedOut,staleWorkers,...financeResult};
};
const abort=new globalThis.AbortController();
process.once('SIGINT',()=>abort.abort());
process.once('SIGTERM',()=>abort.abort());

try {
  if (process.argv.includes('--once')) {
    const result=await repository.reconcile(100);
    const checks=await maintenance(100);
    process.stdout.write(`${JSON.stringify({event:'schedule_reconcile',...result,...checks})}\n`);
  } else {
    await runAvailabilityScheduler({repository,signal:abort.signal,intervalMs:interval,
      maintenance,
      onError:(error)=>process.stderr.write(`${JSON.stringify({event:'schedule_error',
        message:error instanceof Error?error.message:'UNKNOWN_ERROR'})}\n`)});
  }
} finally {
  await database.end();
}
