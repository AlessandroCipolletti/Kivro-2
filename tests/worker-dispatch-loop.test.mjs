import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { WorkerDispatchLoop,workerRetryDelayMs } from
  '../dist/apps/worker/src/dispatch-loop.js';

test('transport retry jitter remains bounded and rejects invalid inputs',()=>{
  assert.equal(workerRetryDelayMs(1_000,0),800);
  assert.equal(workerRetryDelayMs(1_000,0.5),1_000);
  assert.ok(workerRetryDelayMs(30_000,0.99)<=30_000);
  assert.throws(()=>workerRetryDelayMs(1_000,1),RangeError);
});
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

test('poll dispatcher loads only local reviewed packages and never starts one offer twice', async () => {
  const deviceId = randomUUID(), executionId = randomUUID(), capabilityVersionId = randomUUID();
  const offer = { type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', jobId: randomUUID(),
    executionId, attemptId: randomUUID(), workerDeviceId: deviceId,
    capabilityId: randomUUID(), capabilityVersionId, inputManifestId: randomUUID(),
    paymentReservationId: randomUUID(), workerManifestHash: `sha256:${'a'.repeat(64)}`,
    localPackageHash: `sha256:${'b'.repeat(64)}`,
    permissionPolicyHash: `sha256:${'c'.repeat(64)}`,
    policyValidationHash: `sha256:${'d'.repeat(64)}`,
    inputSchemaHash: `sha256:${'e'.repeat(64)}`,
    inputManifestHash: `sha256:${'f'.repeat(64)}`,
    inputTotalBytes: 10, inputFileCount: 0, pauseSupport: 'FULL_RESUME',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    leaseToken: 'x'.repeat(32), paymentSecured: true };
  let resolveExecution;
  const blocked = new Promise((resolve) => { resolveExecution = resolve; });
  const calls = [], errors = [];
  const transport = { controlPlaneId: 'plane-a', kind: 'HTTPS_POLLING',
    supportedProtocolVersions: [WORKER_PROTOCOL_VERSION],
    async poll(hello) {
      assert.equal(hello.workerDeviceId, deviceId);
      assert.equal(hello.workerRelease, '2026.10.7');
      return [{type:'WORKER_WELCOME',messageId:randomUUID(),controlPlaneId:'plane-a',
        selectedProtocolVersion:WORKER_PROTOCOL_VERSION,controlPlaneState:'ACTIVE',
        serverTime:new Date().toISOString(),pauseDirective:{revision:1,paused:false,
          securityPaused:false,capabilityPauses:[]}},offer,
        { ...offer, messageId: randomUUID() }];
    }, async send() {}, async close() {} };
  const dispatcher = new WorkerDispatchLoop(transport, deviceId,
    { load(versionId) { calls.push(['load', versionId]); return { reviewed: true }; },
      loadReviewedSkills(versionId) { calls.push(['load-skills', versionId]); return []; } },
    { snapshot() { return { localRevision: 0 }; },applyCloudDirective() {},recordCloudContact() {},
      acknowledgeCloudRevision(){},
      isUnpausedForNewJobOffer(){return true;} },
    { snapshots() { return []; }, async stopOrphanedAtStartup() {},
      async expireLeases() {}, async expireOverdue() {} },
    { async execute(seen, pkg) { calls.push(['execute', seen.executionId, pkg]); await blocked; } },
    (seen, error) => errors.push([seen, error]),
    {reporter:{async heartbeat(){return {localRevision:0,capabilityReadiness:[{
      capabilityVersionId,state:'READY'}]};}},capacity:1,workerRelease:'2026.10.7',
      openClawVersion:null,policyVersion:1});
  await dispatcher.pollOnce();
  assert.equal(calls.filter(([kind]) => kind === 'execute').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'load').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'load-skills').length, 1);
  resolveExecution();
  await dispatcher.awaitActiveForTest();
  assert.deepEqual(errors, []);
});

test('dispatch refuses a package whose reviewed skill snapshot is missing', async () => {
  const deviceId = randomUUID(), capabilityVersionId = randomUUID();
  const offer = { type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', jobId: randomUUID(),
    executionId: randomUUID(), attemptId: randomUUID(), workerDeviceId: deviceId,
    capabilityId: randomUUID(), capabilityVersionId, inputManifestId: randomUUID(),
    paymentReservationId: randomUUID(), workerManifestHash: `sha256:${'a'.repeat(64)}`,
    localPackageHash: `sha256:${'b'.repeat(64)}`, permissionPolicyHash: `sha256:${'c'.repeat(64)}`,
    policyValidationHash: `sha256:${'d'.repeat(64)}`, inputSchemaHash: `sha256:${'e'.repeat(64)}`,
    inputManifestHash: `sha256:${'f'.repeat(64)}`, inputTotalBytes: 10, inputFileCount: 0,
    pauseSupport: 'FULL_RESUME', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    leaseToken: 'x'.repeat(32), paymentSecured: true };
  const errors = [];
  let executed = false;
  const transport = { controlPlaneId: 'plane-a', kind: 'HTTPS_POLLING',
    supportedProtocolVersions: [WORKER_PROTOCOL_VERSION], async send() {}, async close() {},
    async poll() { return [{ type: 'WORKER_WELCOME', messageId: randomUUID(),
      controlPlaneId: 'plane-a', selectedProtocolVersion: WORKER_PROTOCOL_VERSION,
      controlPlaneState: 'ACTIVE', serverTime: new Date().toISOString(),
      pauseDirective: { revision: 1, paused: false, securityPaused: false,
        capabilityPauses: [] } }, offer]; } };
  const loop = new WorkerDispatchLoop(transport, deviceId,
    { load() { return { reviewed: true }; }, loadReviewedSkills() { throw Error('SKILL_MISSING'); } },
    { snapshot() { return { localRevision: 0 }; }, applyCloudDirective() {},
      recordCloudContact() {}, acknowledgeCloudRevision() {},
      isUnpausedForNewJobOffer() { return true; } },
    { snapshots() { return []; }, async stopOrphanedAtStartup() {},
      async expireLeases() {}, async expireOverdue() {} },
    { async execute() { executed = true; } }, (_seen, error) => errors.push(error),
    { reporter: { async heartbeat() { return { localRevision: 0, capabilityReadiness: [
      { capabilityVersionId, state: 'READY' }] }; } }, capacity: 1,
    workerRelease: '2026.10.7', openClawVersion: null, policyVersion: 1 });
  await loop.pollOnce();
  assert.equal(executed, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /SKILL_MISSING/);
});

test('dispatch never exceeds the published capability concurrency limit',async()=>{
  const deviceId=randomUUID(),versionId=randomUUID(),capabilityId=randomUUID();
  const offer={type:'JOB_OFFER',controlPlaneId:'plane-a',workerDeviceId:deviceId,
    executionId:randomUUID(),capabilityVersionId:versionId,capabilityId};
  const transport={controlPlaneId:'plane-a',kind:'HTTPS_POLLING',
    supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],async send(){},async close(){},
    async poll(){return [{type:'WORKER_WELCOME',controlPlaneId:'plane-a',
      controlPlaneState:'ACTIVE',pauseDirective:{revision:0,paused:false,
        securityPaused:false,capabilityPauses:[]}},offer];}};
  const failures=[];let executed=false;
  const loop=new WorkerDispatchLoop(transport,deviceId,
    {load(){return {capabilityVersionId:versionId,concurrencyLimit:1};},
      loadReviewedSkills(){return [];}},
    {snapshot(){return {localRevision:0};},applyCloudDirective(){},
      recordCloudContact(){},acknowledgeCloudRevision(){},
      isUnpausedForNewJobOffer(){return true;}},
    {snapshots(){return [{capabilityVersionId:versionId,status:'RUNNING'}];},
      async stopOrphanedAtStartup(){},async expireLeases(){},async expireOverdue(){}},
    {async execute(){executed=true;}},(_offer,error)=>failures.push(error),
    {reporter:{async heartbeat(){return {localRevision:0,capabilityReadiness:[{
      capabilityVersionId:versionId,state:'READY'}]};}},capacity:1,
      workerRelease:'2026.10.7',openClawVersion:'2026.8.2',policyVersion:1});
  await loop.pollOnce();
  assert.equal(executed,false);
  assert.equal(failures[0]?.code,'CAPACITY_FULL');
});

test('dispatch refuses a paid offer without same-cycle capability readiness',async()=>{
  const deviceId=randomUUID(),capabilityId=randomUUID(),versionId=randomUUID();
  const offer={type:'JOB_OFFER',protocolVersion:WORKER_PROTOCOL_VERSION,
    messageId:randomUUID(),controlPlaneId:'plane-a',jobId:randomUUID(),executionId:randomUUID(),
    attemptId:randomUUID(),workerDeviceId:deviceId,capabilityId,
    capabilityVersionId:versionId,paymentSecured:true};
  const transport={controlPlaneId:'plane-a',kind:'HTTPS_POLLING',
    supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],async send(){},async close(){},
    async poll(){return [{type:'WORKER_WELCOME',messageId:randomUUID(),controlPlaneId:'plane-a',
      selectedProtocolVersion:WORKER_PROTOCOL_VERSION,controlPlaneState:'ACTIVE',
      serverTime:new Date().toISOString(),pauseDirective:{revision:0,paused:false,
        securityPaused:false,capabilityPauses:[]}},offer];}};
  const local={snapshot(){return {localRevision:0};},applyCloudDirective(){},
    recordCloudContact(){},isUnpausedForNewJobOffer(){return true;}};
  const control={snapshots(){return [];},async stopOrphanedAtStartup(){},
    async expireLeases(){},async expireOverdue(){}};
  const errors=[];
  const loop=new WorkerDispatchLoop(transport,deviceId,{load(){throw Error('NO_LOAD');}},
    local,control,{async execute(){throw Error('NO_EXECUTION');}},
    (_offer,error)=>errors.push(error.code));
  await loop.pollOnce();
  await loop.pollOnce();
  assert.deepEqual(errors,['NOT_READY','NOT_READY'],
    'a denied offer cannot crash the Worker or execute after retry');
});

test('draining control plane refuses a fresh job offer', async () => {
  const deviceId = randomUUID();
  const errors=[];
  const transport = { controlPlaneId: 'plane-a', kind: 'HTTPS_POLLING',
    supportedProtocolVersions: [WORKER_PROTOCOL_VERSION], async poll() { return [
      { type: 'WORKER_WELCOME', messageId: randomUUID(), controlPlaneId: 'plane-a',
        selectedProtocolVersion: WORKER_PROTOCOL_VERSION, controlPlaneState: 'DRAINING',
        serverTime: new Date().toISOString(),pauseDirective:{revision:0,paused:false,
          securityPaused:false,capabilityPauses:[]} },
      { type: 'JOB_OFFER', controlPlaneId: 'plane-a', workerDeviceId: deviceId },
    ]; }, async send() {}, async close() {} };
  const dispatcher = new WorkerDispatchLoop(transport, deviceId, { load() {
    throw new Error('SHOULD_NOT_LOAD'); } }, { snapshot() { return { localRevision: 0 }; },
      applyCloudDirective(){},recordCloudContact() {} },
  { snapshots() { return []; }, async stopOrphanedAtStartup() {},
    async expireLeases() {}, async expireOverdue() {} },
  { async execute() { throw new Error('SHOULD_NOT_EXECUTE'); } },
  (_offer,error)=>errors.push(error.code));
  await dispatcher.pollOnce();
  assert.deepEqual(errors,['DRAINING']);
});

test('local emergency revision is acknowledged only after durable cloud heartbeat',async()=>{
  const deviceId=randomUUID();let fail=true;const acknowledgements=[];
  const transport={controlPlaneId:'plane-a',kind:'HTTPS_POLLING',
    supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],
    async poll(){return [{type:'WORKER_WELCOME',messageId:randomUUID(),
      controlPlaneId:'plane-a',selectedProtocolVersion:WORKER_PROTOCOL_VERSION,
      controlPlaneState:'ACTIVE',serverTime:new Date().toISOString(),
      pauseDirective:{revision:1,paused:false,securityPaused:false,capabilityPauses:[]}}];},
    async send(){if(fail)throw new Error('CLOUD_UNAVAILABLE');},async close(){}};
  const local={snapshot(){return {localRevision:7};},applyCloudDirective(){},
    recordCloudContact(){},acknowledgeCloudRevision(revision){acknowledgements.push(revision);}};
  const control={snapshots(){return [];},async stopOrphanedAtStartup(){},
    async expireLeases(){},async expireOverdue(){}};
  const reporter={async heartbeat(){return {localRevision:7};}};
  const loop=new WorkerDispatchLoop(transport,deviceId,{load(){throw Error('NO_OFFER');}},
    local,control,{async execute(){throw Error('NO_OFFER');}},()=>{},
    {reporter,capacity:1,workerRelease:'0.0.0-dev',openClawVersion:null,policyVersion:1});
  await assert.rejects(loop.pollOnce(),/CLOUD_UNAVAILABLE/);
  assert.deepEqual(acknowledgements,[]);
  fail=false;await loop.pollOnce();assert.deepEqual(acknowledgements,[7]);
});

test('every signed polling heartbeat includes freshly observed sandbox health',async()=>{
  const deviceId=randomUUID(),seen=[];
  const transport={controlPlaneId:'plane-a',kind:'HTTPS_POLLING',
    supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],
    async send(message){seen.push(message);},async close(){},async poll(){return [
      {type:'WORKER_WELCOME',messageId:randomUUID(),controlPlaneId:'plane-a',
        selectedProtocolVersion:WORKER_PROTOCOL_VERSION,controlPlaneState:'ACTIVE',
        serverTime:new Date().toISOString(),pauseDirective:{revision:0,paused:false,
          securityPaused:false,capabilityPauses:[]}}];}};
  const local={snapshot(){return {localRevision:0};},applyCloudDirective(){},
    recordCloudContact(){},acknowledgeCloudRevision(){}};
  const control={snapshots(){return [];},async stopOrphanedAtStartup(){},
    async expireLeases(){},async expireOverdue(){}};
  let checks=0;
  const loop=new WorkerDispatchLoop(transport,deviceId,{listInstalled(){return [];},
    load(){throw Error('NO_OFFER');}},local,control,
  {async execute(){throw Error('NO_OFFER');}},()=>{},
  {reporter:{async heartbeat(input){return {localRevision:0,
    operationalChecks:input.operationalChecks,capabilityReadiness:[]};}},
  capacity:1,workerRelease:'0.0.0-dev',openClawVersion:'2026.8.2',policyVersion:1,
  async operationalChecks(){checks++;return [{code:'DOCKER_DAEMON',
    state:checks===1?'HEALTHY':'BLOCKING'}];}});
  await loop.pollOnce();await loop.pollOnce();
  assert.deepEqual(seen.map((beat)=>beat.operationalChecks),[
    [{code:'DOCKER_DAEMON',state:'HEALTHY'}],
    [{code:'DOCKER_DAEMON',state:'BLOCKING'}]]);
});
