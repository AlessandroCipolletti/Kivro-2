import process from 'node:process';
import pg from 'pg';
import { BuyerWebhookRepository } from '../dist/packages/persistence/src/buyer-webhooks.js';
import { SystemDnsResolver } from '../dist/packages/infrastructure/http/src/pinned-http.js';
import { NodePinnedWebhookPost } from
  '../dist/packages/infrastructure/http/src/pinned-webhook-post.js';

const interval=Number(process.env.KIVRO_WEBHOOK_DISPATCH_INTERVAL_MS??5000);
if(!process.env.DATABASE_URL||!process.env.KIVRO_WEBHOOK_ENCRYPTION_KEY||
  !Number.isSafeInteger(interval)||interval<500||interval>300_000)
  throw new Error('INVALID_WEBHOOK_DISPATCH_CONFIGURATION');
if(process.env.NODE_ENV==='production'&&!process.env.KIVRO_WEBHOOK_BLOCKED_HOSTS)
  throw new Error('MISSING_WEBHOOK_CONTROL_PLANE_DENYLIST');
const blocked=[process.env.APP_ORIGIN,process.env.WORKER_DISCOVERY_URL]
  .flatMap((value)=>{try{return value?[new globalThis.URL(value).hostname]:[];}catch{return [];}})
  .concat((process.env.KIVRO_WEBHOOK_BLOCKED_HOSTS??'').split(',')
    .map((item)=>item.trim().toLowerCase()).filter(Boolean));
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4});
const repository=new BuyerWebhookRepository(pool,new SystemDnsResolver(),
  process.env.KIVRO_WEBHOOK_ENCRYPTION_KEY,blocked);
const transport=new NodePinnedWebhookPost();
let stopped=false;
process.once('SIGINT',()=>{stopped=true;});
process.once('SIGTERM',()=>{stopped=true;});
const wait=(milliseconds)=>new Promise((resolve)=>globalThis.setTimeout(resolve,milliseconds));
try{
  do{
    try{
      const attempted=await repository.deliverDue(transport,20);
      process.stdout.write(`${JSON.stringify({event:'webhook_dispatch',attempted})}\n`);
    }catch(error){
      process.stderr.write(`${JSON.stringify({event:'webhook_dispatch_error',
        code:error instanceof Error?error.name:'UNKNOWN'})}\n`);
      if(process.argv.includes('--once'))throw error;
    }
    if(process.argv.includes('--once'))break;
    await wait(interval);
  }while(!stopped);
}finally{await pool.end();}
