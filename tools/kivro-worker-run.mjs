import process from 'node:process';
import { runWorkerExecution } from '../dist/apps/worker/src/execution-runtime.js';

const controller=new globalThis.AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
try{await runWorkerExecution(controller.signal);}
catch(error){
  const code=error instanceof Error&&'code' in error&&
    typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?
    error.code:error instanceof Error&&
      /^WORKER_[A-Z0-9_]{1,79}$/.test(error.message)?
      error.message:'WORKER_RUNTIME_UNAVAILABLE';
  process.stderr.write(`${code}\n`);
  process.exitCode=1;
}
