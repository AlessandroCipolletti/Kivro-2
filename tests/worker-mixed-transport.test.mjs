import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {generateKeyPairSync,randomUUID,sign,verify} from 'node:crypto';
import {createServer} from 'node:http';
import test from 'node:test';
import {startWorkerWebSocketServer} from
  '../dist/apps/web/src/worker/websocket-server.js';
import {WorkerDispatchLoop} from '../dist/apps/worker/src/dispatch-loop.js';
import {WorkerDispatchCapacity} from '../dist/apps/worker/src/dispatch-capacity.js';
import {HttpsPollingWorkerTransport} from
  '../dist/packages/infrastructure/netsons/src/https-polling.js';
import {WebSocketWorkerTransport} from
  '../dist/packages/infrastructure/adapters/src/websocket-worker.js';
import {workerMessageHash,workerSignatureBytes} from
  '../dist/packages/worker-protocol/src/auth.js';
import {WORKER_PROTOCOL_VERSION} from
  '../dist/packages/worker-protocol/src/messages.js';

/* global Response */
const oldPlane='netsons-old',newPlane='aws-new';
const deviceId=randomUUID(),versionId=randomUUID(),capabilityId=randomUUID();
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const signer={deviceId,signChallenge(bytes){return sign(null,bytes,privateKey);}};
function checkSigned(value,plane){
  const {signature,...unsigned}=value.envelope;
  assert.equal(unsigned.workerDeviceId,deviceId);
  assert.equal(unsigned.controlPlaneId,plane);
  assert.equal(unsigned.bodyHash,workerMessageHash(value.body));
  assert.equal(verify(null,workerSignatureBytes(unsigned),publicKey,
    Buffer.from(signature,'base64url')),true);
}
const welcome=(plane,state)=>({type:'WORKER_WELCOME',messageId:randomUUID(),
  controlPlaneId:plane,selectedProtocolVersion:WORKER_PROTOCOL_VERSION,
  controlPlaneState:state,serverTime:new Date().toISOString(),
  pauseDirective:{revision:1,paused:false,securityPaused:false,capabilityPauses:[]}});
const offer=(plane)=>({type:'JOB_OFFER',protocolVersion:WORKER_PROTOCOL_VERSION,
  messageId:randomUUID(),controlPlaneId:plane,jobId:randomUUID(),
  executionId:randomUUID(),attemptId:randomUUID(),workerDeviceId:deviceId,
  capabilityId,capabilityVersionId:versionId,inputManifestId:randomUUID(),
  paymentReservationId:randomUUID(),workerManifestHash:`sha256:${'a'.repeat(64)}`,
  localPackageHash:`sha256:${'b'.repeat(64)}`,
  permissionPolicyHash:`sha256:${'c'.repeat(64)}`,
  policyValidationHash:`sha256:${'d'.repeat(64)}`,
  inputSchemaHash:`sha256:${'e'.repeat(64)}`,
  inputManifestHash:`sha256:${'f'.repeat(64)}`,
  inputTotalBytes:0,inputFileCount:0,pauseSupport:'FULL_RESUME',
  expiresAt:new Date(Date.now()+60_000).toISOString(),
  leaseToken:'x'.repeat(32),paymentSecured:true});

test('old signed polling and new signed WSS coexist without cross-plane execution',async()=>{
  const oldOffer=offer(oldPlane),newOffer=offer(newPlane);
  let oldState='ACTIVE',oldOffered=false,newOffered=true;
  const oldServer=createServer(async(request,response)=>{
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const signed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    checkSigned(signed,oldPlane);
    if(request.url==='/worker/messages'){
      response.writeHead(204);response.end();return;}
    assert.equal(request.url,'/worker/poll');
    const messages=[welcome(oldPlane,oldState)];
    if(!oldOffered){messages.push(oldOffer);oldOffered=true;}
    response.setHeader('content-type','application/json');
    response.end(JSON.stringify({protocolVersion:WORKER_PROTOCOL_VERSION,messages}));
  });
  await new Promise((resolve)=>oldServer.listen(0,'127.0.0.1',resolve));
  const wss=await startWorkerWebSocketServer({host:'127.0.0.1',port:0,
    allowLocalWs:true,handlers:{
      async poll(request){const signed=await request.json();checkSigned(signed,newPlane);
        const messages=[welcome(newPlane,'ACTIVE')];
        if(newOffered)messages.push(newOffer);
        return Response.json({protocolVersion:WORKER_PROTOCOL_VERSION,messages});},
      async message(request){checkSigned(await request.json(),newPlane);
        return new Response(null,{status:204});},
      async rpc(){throw new Error('UNEXPECTED_RPC');},
    }});
  const old=new HttpsPollingWorkerTransport(oldPlane,
    `http://127.0.0.1:${oldServer.address().port}`,signer,{allowLocalHttp:true});
  const next=new WebSocketWorkerTransport(newPlane,
    `ws://127.0.0.1:${wss.port}/worker/socket`,signer,{allowLocalHttp:true});
  const capacity=new WorkerDispatchCapacity(1),executions=[],errors=[];
  const snapshots=[];
  let finishOld;
  const holdOld=new Promise((resolve)=>{finishOld=resolve;});
  const control={snapshots(){return snapshots;},async stopOrphanedAtStartup(){},
    async expireLeases(){},async expireOverdue(){}};
  const local={snapshot(){return {localRevision:0,securityPaused:false};},
    acknowledgeCloudRevisionForPlane(){},applyCloudDirectiveForPlane(){},
    recordCloudContact(){},isUnpausedForNewJobOffer(){return true;}};
  const packages={load(){return {capabilityVersionId:versionId,concurrencyLimit:1};},
    loadReviewedSkills(){return [];}};
  const reporter={async heartbeat(input){return {
    type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
    messageId:randomUUID(),controlPlaneId:input.controlPlaneId,
    workerDeviceId:deviceId,workerRelease:'m16',openClawVersion:null,
    status:'ONLINE',runningJobs:input.runningJobs,capacity:input.capacity,
    policyVersion:1,localRevision:0,capabilityReadiness:[{
      capabilityVersionId:versionId,policyValidationHash:`sha256:${'a'.repeat(64)}`,
      state:'READY',checks:{sandboxVerified:true,requiredSecretsReady:true,
        runtimeHealthy:true}}]};}};
  const supervisor={async execute(seen){
    executions.push([seen.controlPlaneId,seen.executionId]);
    snapshots.push({executionId:seen.executionId,
      capabilityVersionId:versionId,controlPlaneId:seen.controlPlaneId,
      status:'RUNNING'});
    if(seen.controlPlaneId===oldPlane)await holdOld;
    snapshots.at(-1).status='STOPPED';
  }};
  const loop=(transport)=>new WorkerDispatchLoop(transport,deviceId,packages,
    local,control,supervisor,(_offer,error)=>errors.push(error.code),
    {reporter,capacity:1,coordinator:capacity,workerRelease:'m16',
      openClawVersion:null,policyVersion:1});
  const oldLoop=loop(old),newLoop=loop(next);
  try{
    await oldLoop.pollOnce();
    assert.equal(executions.length,1);
    oldState='DRAINING';oldLoop.setDiscoveryState('DRAINING');
    await newLoop.pollOnce();
    assert.deepEqual(errors,['CAPACITY_FULL']);
    finishOld();await oldLoop.awaitActiveForTest();
    await newLoop.pollOnce();await newLoop.awaitActiveForTest();
    assert.deepEqual(executions,[[oldPlane,oldOffer.executionId],
      [newPlane,newOffer.executionId]]);
    assert.equal(capacity.activeCount(snapshots),0);
    // A delayed duplicate offer and stale active welcome cannot admit old work.
    oldOffered=false;await oldLoop.pollOnce();
    assert.equal(errors.at(-1),'DRAINING');
    newOffered=false;await newLoop.pollOnce();
    assert.equal(executions.length,2);
  }finally{
    finishOld();await oldLoop.awaitActiveForTest();
    await old.close();await next.close();await wss.close();
    await new Promise((resolve)=>oldServer.close(resolve));
  }
});
