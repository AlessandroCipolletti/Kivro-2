import process from 'node:process';
import pg from 'pg';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { runAvailabilityScheduler } from '../dist/packages/application/src/scheduler-loop.js';

const url=process.env.DATABASE_URL;
const mode=process.env.KIVRO_STRIPE_MODE;
const interval=Number(process.env.KIVRO_SCHEDULER_INTERVAL_MS ?? 5000);
if (!url || (mode!=='test'&&mode!=='live') || !Number.isSafeInteger(interval) ||
  interval<100 || interval>300_000) throw new Error('INVALID_SCHEDULER_CONFIGURATION');

const database=new pg.Pool({connectionString:url,max:4});
const repository=new PostgresAvailabilityRepository(database,
  new PostgresFinanceRepository(database,mode));
const abort=new globalThis.AbortController();
process.once('SIGINT',()=>abort.abort());
process.once('SIGTERM',()=>abort.abort());

try {
  if (process.argv.includes('--once')) {
    const result=await repository.reconcile(100);
    process.stdout.write(`${JSON.stringify({event:'schedule_reconcile',...result})}\n`);
  } else {
    await runAvailabilityScheduler({repository,signal:abort.signal,intervalMs:interval,
      onError:(error)=>process.stderr.write(`${JSON.stringify({event:'schedule_error',
        message:error instanceof Error?error.message:'UNKNOWN_ERROR'})}\n`)});
  }
} finally {
  await database.end();
}
