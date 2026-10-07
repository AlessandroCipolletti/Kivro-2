import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';

const ready={async check(){return {ready:true,checkedAt:new Date().toISOString(),blockingReasons:[]};}};

test('cloud emergency stop is durable, revisioned and cannot clear a local stop',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'kivro-m12-local-'));chmodSync(directory,0o700);
  const capabilityId=randomUUID();
  let state=new WorkerLocalState(directory,ready);
  try{
    state.applyCloudDirective({revision:1,paused:true,securityPaused:false,
      capabilityPauses:[capabilityId]});
    assert.equal(state.snapshot().cloudPaused,true);
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId),false);
    state.close();state=new WorkerLocalState(directory,ready);
    assert.equal(state.snapshot().cloudPaused,true,'Worker restart must not clear web pause');
    await assert.rejects(state.resumeAll('local:seller'),{code:'NOT_READY'});
    assert.throws(()=>state.applyCloudDirective({revision:1,paused:false,
      securityPaused:false,capabilityPauses:[]}),{code:'INVALID_ARGUMENT'});
    state.pauseAll('local:seller');
    state.applyCloudDirective({revision:2,paused:false,securityPaused:false,
      capabilityPauses:[]});
    assert.equal(state.snapshot().localPaused,true);
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId),false);
    await state.resumeAll('local:seller');
    assert.equal(state.isUnpausedForNewJobOffer(capabilityId),true);
    state.applyCloudDirective({revision:1,paused:true,securityPaused:false,
      capabilityPauses:[capabilityId]});
    assert.equal(state.snapshot().cloudPaused,false,'old cloud revision cannot reapply a stop');
  }finally{state.close();rmSync(directory,{recursive:true,force:true});}
});

test('security directive latches and seller resume cannot override',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'kivro-m12-security-'));chmodSync(directory,0o700);
  const state=new WorkerLocalState(directory,ready);
  try{
    state.applyCloudDirective({revision:1,paused:false,securityPaused:true,
      capabilityPauses:[]});
    assert.equal(state.snapshot().securityPaused,true);
    state.applyCloudDirective({revision:2,paused:false,securityPaused:false,
      capabilityPauses:[]});
    assert.equal(state.snapshot().securityPaused,true,'seller directive cannot clear security latch');
    await assert.rejects(state.resumeAll('local:seller'),{code:'SECURITY_PAUSE'});
    state.applyCloudDirective({revision:3,paused:false,securityPaused:false,
      clearSecurityPause:true,capabilityPauses:[]});
    assert.equal(state.snapshot().securityPaused,false,
      'only a newer explicit platform clear releases a cloud security latch');
    state.applyCloudDirective({revision:1,paused:false,securityPaused:true,
      capabilityPauses:[]});
    assert.equal(state.snapshot().securityPaused,false,'stale block cannot replay');
    state.applySecurityPause('local-health','Local sandbox isolation failed');
    state.applyCloudDirective({revision:4,paused:false,securityPaused:false,
      clearSecurityPause:true,capabilityPauses:[]});
    assert.equal(state.snapshot().securityPaused,true,
      'platform clear cannot release an independent local security finding');
  }finally{state.close();rmSync(directory,{recursive:true,force:true});}
});
