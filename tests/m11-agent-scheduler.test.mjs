import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp,readFile,writeFile,chmod,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import test from 'node:test';
import { agentSchedulerConfiguration,reconcileAgentOnce,runAgentScheduler } from
  '../tools/kivro-agent-scheduler.mjs';

const token=randomBytes(32).toString('hex');
test('local Agent scheduler rejects remote origin and authenticates bounded reconciliation',async()=>{
  assert.throws(()=>agentSchedulerConfiguration({APP_ORIGIN:'https://example.com',
    AGENT_CRON_SECRET:token}),/LOOPBACK/);
  const config=agentSchedulerConfiguration({APP_ORIGIN:'http://127.0.0.1:3000',
    AGENT_CRON_SECRET:token,KIVRO_AGENT_RECONCILE_INTERVAL_MS:'100'});
  const called=[];
  const result=await reconcileAgentOnce(config,async(url,options)=>{
    called.push({url:url.toString(),options});
    return new globalThis.Response(JSON.stringify({processed:2,errors:0}),{status:200});
  });
  assert.deepEqual(result,{processed:2,errors:0});
  assert.equal(called[0].options.headers.Authorization,`Bearer ${token}`);
  assert.equal(called[0].options.redirect,'error');
  assert.equal(called[0].url,'http://127.0.0.1:3000/api/internal/agent/reconcile');
});

test('local Agent scheduler retries after Web/API outage without buyer browser',async()=>{
  const config=agentSchedulerConfiguration({APP_ORIGIN:'http://localhost:3000',
    AGENT_CRON_SECRET:token,KIVRO_AGENT_RECONCILE_INTERVAL_MS:'100'});
  const abort=new globalThis.AbortController();
  const errors=[];let calls=0;
  await runAgentScheduler(config,abort.signal,async()=>{
    calls++;
    if(calls===1)throw new Error('WEB_UNAVAILABLE');
    abort.abort();
    return new globalThis.Response(JSON.stringify({processed:1,errors:0}),{status:200});
  },(error)=>errors.push(error.message));
  assert.deepEqual(errors,['WEB_UNAVAILABLE']);
  assert.equal(calls,2);
});

test('local setup adds a private Agent token once without replacing existing env',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'kivro-m11-agent-env-'));
  const file=join(dir,'.env.local');
  try{
    await writeFile(file,'APP_ORIGIN=http://localhost:3000\n',{mode:0o600});
    await chmod(file,0o600);
    const script=resolve('tools/setup-local-agent.mjs');
    const first=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
    assert.equal(first.status,0,first.stderr);
    const once=await readFile(file,'utf8');
    assert.match(once,/AGENT_CRON_SECRET=[a-f0-9]{64}/);
    const second=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
    assert.equal(second.status,0,second.stderr);
    assert.equal(await readFile(file,'utf8'),once);
  }finally{await rm(dir,{recursive:true,force:true});}
});
