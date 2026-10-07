import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { WorkerControlSync } from '../dist/apps/worker/src/control-sync.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

function fixture(messages){
  const id=randomUUID(),seen=[];let acked=-1,applied=null,contact=0;
  const state={localRevision:3,cloudRevision:0,globalPaused:true,localPaused:true,
    securityPaused:false,localCapabilityPauses:[]};
  const local={snapshot(){return {...state};},acknowledgeCloudRevision(revision){acked=revision;},
    applyCloudDirective(directive){applied=directive;state.cloudRevision=directive.revision;},
    recordCloudContact(){contact++;}};
  const transport={controlPlaneId:'local-primary',kind:'HTTPS_POLLING',
    supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],
    async send(value){seen.push(value);},async poll(value){seen.push(value);return messages;},
    async close(){}};
  const health={runningJobs:0,checks:[{code:'DOCKER_DAEMON',state:'HEALTHY',action:'Docker ready'},
    {code:'APPROVED_SANDBOX_IMAGE',state:'BLOCKING',action:'Repair image'}]};
  const sync=new WorkerControlSync(transport,id,local,async()=>health,'0.0.0-dev');
  return {id,seen,local,transport,sync,state,get acked(){return acked;},
    get applied(){return applied;},get contact(){return contact;}};
}
const welcome=(directive)=>({type:'WORKER_WELCOME',messageId:randomUUID(),
  controlPlaneId:'local-primary',selectedProtocolVersion:WORKER_PROTOCOL_VERSION,
  controlPlaneState:'ACTIVE',serverTime:new Date().toISOString(),pauseDirective:directive});

test('control sync sends actual local pause and health, advertises zero paid capacity, then applies cloud pause',async()=>{
  const directive={revision:7,paused:true,securityPaused:false,capabilityPauses:[]};
  const f=fixture([welcome(directive)]);
  await f.sync.syncOnce();
  assert.equal(f.seen[0].capacity,0);
  assert.equal(f.seen[0].status,'PAUSED');
  assert.equal(f.seen[0].localPause.globalPaused,true);
  assert.deepEqual(f.seen[0].operationalChecks,[
    {code:'DOCKER_DAEMON',state:'HEALTHY'},
    {code:'APPROVED_SANDBOX_IMAGE',state:'BLOCKING'}]);
  assert.equal(f.acked,3);
  assert.deepEqual(f.applied,directive);
  assert.equal(f.contact,1);
});

test('lost heartbeat acknowledgement keeps local pause unsynchronized',async()=>{
  const f=fixture([welcome({revision:1,paused:false,securityPaused:false,capabilityPauses:[]})]);
  f.transport.send=async()=>{throw new Error('TRANSPORT_FAILED');};
  await assert.rejects(f.sync.syncOnce(),/TRANSPORT_FAILED/);
  assert.equal(f.acked,-1);assert.equal(f.applied,null);assert.equal(f.contact,0);
});

test('control-only process refuses offers and commands instead of executing without M13 RPC',async()=>{
  const f=fixture([welcome({revision:0,paused:false,securityPaused:false,capabilityPauses:[]}),
    {type:'JOB_OFFER'}]);
  await assert.rejects(f.sync.syncOnce(),/CONTROL_ONLY_REJECTED_EXECUTION_MESSAGE/);
  assert.equal(f.applied?.revision,0);assert.equal(f.contact,1);
});
