import process from 'node:process';
import { runWorkerControlSync } from '../dist/apps/worker/src/control-sync-runtime.js';

const controller=new globalThis.AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
try{await runWorkerControlSync(controller.signal);}
catch(error){
  const value=typeof error?.code==='string'?error.code:
    error instanceof Error?error.message:'';
  const code=/^(?:WORKER|CONTROL)_[A-Z0-9_]{1,79}$/.test(value)?
    value:'WORKER_CONTROL_SYNC_FAILED';
  process.stderr.write(`${JSON.stringify({event:'worker_control_sync_failed',
    at:new Date().toISOString(),code})}\n`);
  process.exitCode=1;
}
