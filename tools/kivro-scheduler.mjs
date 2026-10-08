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
import { S3PrivateObjectStorage } from '../dist/packages/infrastructure/s3/src/storage.js';

const url=process.env.DATABASE_URL;
const mode=process.env.KIVRO_STRIPE_MODE;
const interval=Number(process.env.KIVRO_SCHEDULER_INTERVAL_MS ?? 5000);
const planeId=process.env.KIVRO_CONTROL_PLANE_ID;
const planeState=process.env.KIVRO_CONTROL_PLANE_STATE;
const maxPauseSeconds=Number(process.env.KIVRO_MAX_PAUSE_DURATION_SECONDS??14400);
if (!url || (mode!=='test'&&mode!=='live') || !planeId ||
  !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(planeId) ||
  !['ACTIVE','DRAINING'].includes(planeState) || !Number.isSafeInteger(interval) ||
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
const storageConfigured=!!process.env.OBJECT_STORAGE_BUCKET&&!!process.env.OBJECT_STORAGE_REGION&&
  (!!process.env.OBJECT_STORAGE_ACCESS_KEY_ID===!!process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY);
if(process.env.NODE_ENV==='production'&&!storageConfigured)
  throw new Error('OUTPUT_STORAGE_CLEANUP_NOT_CONFIGURED');
const storage=storageConfigured?new S3PrivateObjectStorage({
  bucket:process.env.OBJECT_STORAGE_BUCKET,region:process.env.OBJECT_STORAGE_REGION,
  ...(process.env.OBJECT_STORAGE_ENDPOINT?{endpoint:process.env.OBJECT_STORAGE_ENDPOINT}:{}),
  ...(process.env.OBJECT_STORAGE_ACCESS_KEY_ID?{
    accessKeyId:process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY}:{}),
  allowInsecureLoopback:process.env.NODE_ENV!=='production'}):null;
const maintenance=async(limit)=>{
  const availabilitySamples=await metrics.sample(limit);
  const maintenanceResumed=await sellerOperations.expireMaintenance(limit);
  const timedOut=await jobs.expireOverduePausedJobs(maxPauseSeconds,limit);
  const staleWorkers=await health.recordStaleWorkers(limit);
  const lostExecutions=await jobs.expireLostWorkerExecutions(limit);
  const financeResult=await finance.reconcileTerminalJobs(limit);
  const dispatch=planeState==='ACTIVE'?await jobs.dispatchEligible(planeId,limit):
    {examined:0,offered:0,ineligible:0};
  const outputStagingRemoved=storage?await jobs.reconcileOutputStaging(storage,limit):null;
  return {availabilitySamples,maintenanceResumed,timedOut,staleWorkers,lostExecutions,dispatch,
    outputStagingRemoved,...financeResult};
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
        code:typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?
          error.code:'SCHEDULER_ERROR'})}\n`)});
  }
} finally {
  await database.end();
}
