import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

/** Local host-native cron caller. Plans and financial truth remain in PostgreSQL. */
export function agentSchedulerConfiguration(env){
  const origin=env.APP_ORIGIN,secret=env.AGENT_CRON_SECRET;
  const interval=Number(env.KIVRO_AGENT_RECONCILE_INTERVAL_MS??5000);
  if(!origin||!secret||secret.length<32||!Number.isSafeInteger(interval)||
    interval<100||interval>300_000)throw new Error('INVALID_AGENT_SCHEDULER_CONFIGURATION');
  const url=new globalThis.URL('/api/internal/agent/reconcile',origin);
  if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||
    new globalThis.URL(origin).pathname!=='/')
    throw new Error('AGENT_SCHEDULER_REQUIRES_LOOPBACK_WEB');
  return {url,secret,interval};
}

export async function reconcileAgentOnce(config,fetchImpl=globalThis.fetch){
  const response=await fetchImpl(config.url,{method:'POST',redirect:'error',
    headers:{Authorization:`Bearer ${config.secret}`},signal:globalThis.AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(`AGENT_RECONCILE_HTTP_${response.status}`);
  const result=await response.json();
  if(!result||!Number.isInteger(result.processed)||!Number.isInteger(result.errors))
    throw new Error('INVALID_AGENT_RECONCILE_RESULT');
  return {processed:result.processed,errors:result.errors};
}

export async function runAgentScheduler(config,signal,fetchImpl=globalThis.fetch,onError=()=>{}){
  while(!signal.aborted){
    try{await reconcileAgentOnce(config,fetchImpl);}
    catch(error){onError(error);}
    try{await delay(config.interval,undefined,{signal});}catch{/* Shutdown. */}
  }
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const config=agentSchedulerConfiguration(process.env);
  const abort=new globalThis.AbortController();
  process.once('SIGINT',()=>abort.abort());
  process.once('SIGTERM',()=>abort.abort());
  if(process.argv.includes('--once')){
    const result=await reconcileAgentOnce(config);
    process.stdout.write(`${JSON.stringify({event:'agent_reconcile',...result})}\n`);
  }else{
    await runAgentScheduler(config,abort.signal,globalThis.fetch,(error)=>
      process.stderr.write(`${JSON.stringify({event:'agent_reconcile_error',
        code:typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?
          error.code:'AGENT_RECONCILE_ERROR'})}\n`));
  }
}
