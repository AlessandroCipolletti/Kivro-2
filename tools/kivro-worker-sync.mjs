import process from 'node:process';
import { runWorkerControlSync } from '../dist/apps/worker/src/control-sync-runtime.js';

const controller=new globalThis.AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
try{await runWorkerControlSync(controller.signal);}
catch(error){
  process.stderr.write(`${error instanceof Error&&'code' in error?String(error.code):
    error instanceof Error?error.message:'WORKER_CONTROL_SYNC_FAILED'}\n`);
  process.exitCode=1;
}
