import assert from 'node:assert/strict';
import {chmodSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {WorkerLocalState} from '../dist/apps/worker/src/local-state.js';
import {WorkerDispatchCapacity} from '../dist/apps/worker/src/dispatch-capacity.js';
import {WorkerDispatchLoop} from '../dist/apps/worker/src/dispatch-loop.js';
import {assertWorkerPlaneSet} from '../dist/apps/worker/src/execution-runtime.js';
import {WORKER_PROTOCOL_VERSION} from '../dist/packages/worker-protocol/src/messages.js';
import {randomUUID} from 'node:crypto';

const capability='d54f4053-a43d-4e66-b576-c721ee30cba6';
const other='9d747171-3018-4a39-99c4-0c39db34b28d';
const ready={async check(){return {ready:true,checkedAt:new Date().toISOString(),
  blockingReasons:[]};}};
const directive=(revision,overrides={})=>({revision,paused:false,securityPaused:false,
  capabilityPauses:[],...overrides});

test('Worker discovery requires one active plane and at most one draining plane',()=>{
  const active={id:'new',state:'ACTIVE',endpoint:'https://new.example.test'};
  const old={id:'old',state:'DRAINING',endpoint:'https://old.example.test'};
  assert.doesNotThrow(()=>assertWorkerPlaneSet([active,old]));
  assert.throws(()=>assertWorkerPlaneSet([active,{...old,state:'ACTIVE'}]),
    /WORKER_ACTIVE_PLANE_AMBIGUOUS/);
  assert.throws(()=>assertWorkerPlaneSet([old]),/WORKER_ACTIVE_PLANE_AMBIGUOUS/);
  assert.throws(()=>assertWorkerPlaneSet([active,old,{...old,id:'older'}]),
    /WORKER_CONTROL_PLANE_SET_INVALID/);
});

test('independent control-plane revisions never clear another plane pause or security block',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'kivro-multiplane-'));chmodSync(dir,0o700);
  let state=new WorkerLocalState(dir,ready);
  try{
    state.registerControlPlane('old');state.registerControlPlane('new');
    state.pauseAll('local:operator');
    state.acknowledgeCloudRevisionForPlane('old',1);
    assert.equal(state.snapshot().cloudSyncPending,true,
      'old-plane acknowledgement cannot mask missing new-plane synchronization');
    state.acknowledgeCloudRevisionForPlane('new',1);
    assert.equal(state.snapshot().cloudSyncPending,false);
    await state.resumeAll('local:operator');
    state.acknowledgeCloudRevisionForPlane('old',2);
    state.acknowledgeCloudRevisionForPlane('new',2);
    state.applyCloudDirectiveForPlane('old',directive(20,{paused:true,
      capabilityPauses:[capability],securityPaused:true}));
    state.applyCloudDirectiveForPlane('new',directive(1));
    assert.equal(state.snapshot().cloudPaused,true);
    assert.equal(state.snapshot().securityPaused,true);
    assert.equal(state.isUnpausedForNewJobOffer(other),false);
    await assert.rejects(state.resumeAll('local:operator'),{code:'SECURITY_PAUSE'});
    state.applyCloudDirectiveForPlane('old',directive(21,{paused:false,
      securityPaused:false}));
    assert.equal(state.snapshot().cloudPaused,false);
    assert.equal(state.snapshot().securityPaused,true,'security remains latched without explicit clear');
    state.close();state=new WorkerLocalState(dir,ready);
    assert.equal(state.snapshot().securityPaused,true,'security latch survives Worker restart');
    assert.throws(()=>state.applyCloudDirectiveForPlane('old',directive(21,{paused:true})),
      {code:'INVALID_ARGUMENT'});
    state.applyCloudDirectiveForPlane('old',directive(22,{clearSecurityPause:true}));
    assert.equal(state.snapshot().securityPaused,false);
    assert.equal(state.isUnpausedForNewJobOffer(other),true);
    state.applyCloudDirectiveForPlane('new',directive(2,{capabilityPauses:[capability]}));
    assert.equal(state.isUnpausedForNewJobOffer(capability),false);
    assert.equal(state.isUnpausedForNewJobOffer(other),true);
    state.pauseCapability(capability,'local:operator');
    await assert.rejects(state.resumeCapability(capability,'local:operator'),
      {code:'SECURITY_PAUSE'});
  }finally{state.close();rmSync(dir,{recursive:true,force:true});}
});

test('legacy single-plane cloud pause migrates to draining plane without silent unpause',()=>{
  const dir=mkdtempSync(join(tmpdir(),'kivro-multiplane-'));chmodSync(dir,0o700);
  const state=new WorkerLocalState(dir,ready);
  try{
    state.applyCloudDirective(directive(8,{paused:true,capabilityPauses:[capability]}));
    state.migrateLegacyCloudDirective('old');
    state.applyCloudDirectiveForPlane('new',directive(100));
    assert.equal(state.snapshot().cloudPaused,true);
    assert.equal(state.isUnpausedForNewJobOffer(other),false);
    state.applyCloudDirectiveForPlane('old',directive(9));
    assert.equal(state.snapshot().cloudPaused,false);
    assert.equal(state.isUnpausedForNewJobOffer(other),true);
  }finally{state.close();rmSync(dir,{recursive:true,force:true});}
});

test('one capacity guard prevents old and new planes spending the same host slot',()=>{
  const capacity=new WorkerDispatchCapacity(1);
  const first={executionId:'a',controlPlaneId:'old',capabilityVersionId:'v'};
  const next={executionId:'b',controlPlaneId:'new',capabilityVersionId:'v'};
  assert.equal(capacity.reserve(first,1,[]),'ACQUIRED');
  assert.equal(capacity.reserve(next,1,[]),'CAPACITY_FULL');
  assert.equal(capacity.reserve({...first,controlPlaneId:'new'},1,[]),'WRONG_CONTROL_PLANE');
  capacity.release('a','new');
  assert.equal(capacity.activeCount([]),1);
  capacity.release('a','old');
  assert.equal(capacity.reserve(next,1,[]),'ACQUIRED');
  capacity.release('b','new');
  assert.equal(capacity.reserve(next,1,[{executionId:'a',controlPlaneId:'old',
    capabilityVersionId:'v',status:'RUNNING'}]),'CAPACITY_FULL');
});

test('two polling loops share one execution slot while keeping plane ownership',async()=>{
  const deviceId=randomUUID(),versionId=randomUUID(),capabilityId=randomUUID();
  const capacity=new WorkerDispatchCapacity(1);
  const pkg={capabilityVersionId:versionId,concurrencyLimit:1};
  const errors=[];const started=[];
  let finish;
  const blocked=new Promise((resolve)=>{finish=resolve;});
  const local={snapshot(){return {localRevision:0,securityPaused:false};},
    acknowledgeCloudRevisionForPlane(){},applyCloudDirectiveForPlane(){},
    recordCloudContact(){},isUnpausedForNewJobOffer(){return true;}};
  const control={snapshots(){return [];},async stopOrphanedAtStartup(){},
    async expireLeases(){},async expireOverdue(){}};
  const packages={load(){return pkg;},loadReviewedSkills(){return [];}};
  const make=(planeId)=>{
    const offer={type:'JOB_OFFER',protocolVersion:WORKER_PROTOCOL_VERSION,
      messageId:randomUUID(),controlPlaneId:planeId,workerDeviceId:deviceId,
      executionId:randomUUID(),capabilityVersionId:versionId,capabilityId};
    const transport={controlPlaneId:planeId,kind:'HTTPS_POLLING',
      supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],async send(){},async close(){},
      async poll(){return [{type:'WORKER_WELCOME',controlPlaneId:planeId,
        controlPlaneState:'ACTIVE',pauseDirective:{revision:1,paused:false,
          securityPaused:false,capabilityPauses:[]}},offer];}};
    return new WorkerDispatchLoop(transport,deviceId,packages,local,control,
      {async execute(seen){started.push(seen.controlPlaneId);await blocked;}},
      (_offer,error)=>errors.push(error.code),
      {reporter:{async heartbeat(){return {localRevision:0,
        capabilityReadiness:[{capabilityVersionId:versionId,state:'READY'}]};}},
      capacity:1,coordinator:capacity,workerRelease:'test',openClawVersion:null,
      policyVersion:1});
  };
  const old=make('old'),next=make('new');
  await old.pollOnce();await next.pollOnce();
  assert.deepEqual(started,['old']);
  assert.deepEqual(errors,['CAPACITY_FULL']);
  finish();await old.awaitActiveForTest();
  await next.pollOnce();
  assert.deepEqual(started,['old','new']);
  next.setDiscoveryState('DRAINING');
  await next.pollOnce();
  assert.equal(errors.at(-1),'DRAINING',
    'a stale ACTIVE welcome cannot override discovery drain during cutover');
  assert.deepEqual(started,['old','new'],
    'a refused offer must not interrupt already owned work');
});

test('a draining connection reports zero capacity until discovery promotes it to active',async()=>{
  const deviceId=randomUUID(),versionId=randomUUID();
  const reported=[];
  const transport={controlPlaneId:'new',kind:'HTTPS_POLLING',
    supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],async send(){},async close(){},
    async poll(){return [{type:'WORKER_WELCOME',controlPlaneId:'new',
      controlPlaneState:'ACTIVE',pauseDirective:directive(1)}];}};
  const local={snapshot(){return {localRevision:0,securityPaused:false};},
    acknowledgeCloudRevisionForPlane(){},applyCloudDirectiveForPlane(){},
    recordCloudContact(){}};
  const control={snapshots(){return [];},async stopOrphanedAtStartup(){},
    async expireLeases(){},async expireOverdue(){}};
  const loop=new WorkerDispatchLoop(transport,deviceId,{load(){},loadReviewedSkills(){}},
    local,control,{async execute(){}},()=>{},
    {reporter:{async heartbeat(input){reported.push(input.capacity);
      return {localRevision:0,capabilityReadiness:[{capabilityVersionId:versionId,
        state:'READY'}]};}},capacity:1,workerRelease:'test',openClawVersion:null,
      policyVersion:1});
  loop.setDiscoveryState('DRAINING');
  await loop.pollOnce();
  loop.setDiscoveryState('ACTIVE');
  await loop.pollOnce();
  assert.deepEqual(reported,[0,1]);
});
