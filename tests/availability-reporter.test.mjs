import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { WorkerAvailabilityReporter } from '../dist/apps/worker/src/availability-reporter.js';

const deviceId=randomUUID(), capabilityId=randomUUID(), versionId=randomUUID();
const digest=`sha256:${'b'.repeat(64)}`;
const packages={ listInstalled(){return [{workerDeviceId:deviceId,capabilityId,
  capabilityVersionId:versionId}];} };
const state={ snapshot(){return {globalPaused:false,securityPaused:false,localRevision:0};},
  isUnpausedForNewJobOffer(){return true;} };
const input={controlPlaneId:'m09-plane',workerRelease:'test',openClawVersion:null,
  runningJobs:0,capacity:1,policyVersion:1};

test('Worker reports READY only from fresh local sandbox/secret/runtime checks', async () => {
  const port={async check(){return {ready:true,checkedAt:new Date().toISOString(),
    policyValidationHash:digest,sandboxVerified:true,requiredSecretsReady:true,
    runtimeHealthy:true,capacityAvailable:true};}};
  const reporter=new WorkerAvailabilityReporter(deviceId,packages,state,port);
  assert.deepEqual((await reporter.heartbeat(input)).capabilityReadiness,
    [{capabilityVersionId:versionId,policyValidationHash:digest,state:'READY'}]);
  const busy=new WorkerAvailabilityReporter(deviceId,packages,state,{async check(){return {
    ...await port.check(),capacityAvailable:false};}});
  assert.equal((await busy.heartbeat({...input,runningJobs:1})).capabilityReadiness[0].state,
    'READY');
  const stale=new WorkerAvailabilityReporter(deviceId,packages,state,{async check(){return {
    ...await port.check(),checkedAt:new Date(Date.now()-60_000).toISOString()};}});
  assert.equal((await stale.heartbeat(input)).capabilityReadiness[0].state,'NOT_READY');
  const missing=new WorkerAvailabilityReporter(deviceId,packages,state,{async check(){throw new Error('Docker down');}});
  assert.deepEqual((await missing.heartbeat(input)).capabilityReadiness,
    [{capabilityVersionId:versionId,policyValidationHash:null,state:'NOT_READY'}]);
});

test('local pause and wrong Worker package fail closed', async () => {
  const paused=new WorkerAvailabilityReporter(deviceId,packages,{
    ...state,snapshot(){return {globalPaused:true,securityPaused:false,localRevision:2};},
    isUnpausedForNewJobOffer(){return false;}
  },{async check(){return {ready:true,checkedAt:new Date().toISOString(),
    policyValidationHash:digest,sandboxVerified:true,requiredSecretsReady:true,
    runtimeHealthy:true,capacityAvailable:true};}});
  const report=await paused.heartbeat(input);
  assert.equal(report.status,'PAUSED');
  assert.equal(report.capabilityReadiness[0].state,'NOT_READY');
  const foreign=new WorkerAvailabilityReporter(deviceId,{listInstalled(){return [
    {workerDeviceId:randomUUID(),capabilityId,capabilityVersionId:versionId}];}},state,
  {async check(){throw new Error('should not be called');}});
  await assert.rejects(foreign.heartbeat(input),/WRONG_WORKER_PACKAGE/);
});
