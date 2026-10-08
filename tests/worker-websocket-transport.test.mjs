import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import process from 'node:process';
/* global Response */
import {generateKeyPairSync,randomUUID,sign,verify} from 'node:crypto';
import test from 'node:test';
import {startWorkerWebSocketServer} from
  '../dist/apps/web/src/worker/websocket-server.js';
import {WebSocketWorkerTransport} from
  '../dist/packages/infrastructure/adapters/src/websocket-worker.js';
import {workerMessageHash,workerSignatureBytes} from
  '../dist/packages/worker-protocol/src/auth.js';
import {WORKER_PROTOCOL_VERSION} from
  '../dist/packages/worker-protocol/src/messages.js';
import {selectWorkerTransport} from
  '../dist/packages/infrastructure/netsons/src/https-polling.js';

const plane='aws-active',deviceId=randomUUID();
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const signer={deviceId,signChallenge(bytes){return sign(null,bytes,privateKey);}};
function verified(request){return request.json().then(({envelope,body})=>{
  const {signature,...unsigned}=envelope;
  assert.equal(envelope.workerDeviceId,deviceId);
  assert.equal(envelope.controlPlaneId,plane);
  assert.equal(envelope.bodyHash,workerMessageHash(body));
  assert.equal(verify(null,workerSignatureBytes(unsigned),publicKey,
    Buffer.from(signature,'base64url')),true);
  return body;
});}
const directive={revision:1,paused:false,securityPaused:false,capabilityPauses:[]};

test('WSS adapter carries signed protocol frames and reconnects without changing plane owner',async()=>{
  const seen=[];
  const server=await startWorkerWebSocketServer({host:'127.0.0.1',port:0,
    allowLocalWs:true,handlers:{
      async poll(request){const body=await verified(request);seen.push(body.type);
        return Response.json({protocolVersion:WORKER_PROTOCOL_VERSION,messages:[{
          type:'WORKER_WELCOME',messageId:randomUUID(),controlPlaneId:plane,
          selectedProtocolVersion:WORKER_PROTOCOL_VERSION,controlPlaneState:'ACTIVE',
          serverTime:new Date().toISOString(),pauseDirective:directive}]});},
      async message(request){const body=await verified(request);seen.push(body.type);
        return new Response(null,{status:204});},
      async rpc(request,kind){const body=await verified(request);seen.push(kind);
        assert.equal(body.controlPlaneId,plane);
        if(kind==='RESEARCH_FETCH')return Response.json({code:'PAUSE_PENDING'},
          {status:409});
        return Response.json({ok:true});},
    }});
  const endpoint=`ws://127.0.0.1:${server.port}/worker/socket`;
  const transport=new WebSocketWorkerTransport(plane,endpoint,signer,
    {allowLocalHttp:true});
  try{
    await transport.send({type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
      messageId:randomUUID(),workerDeviceId:deviceId,controlPlaneId:plane,
      workerRelease:'m16',openClawVersion:null,status:'NOT_READY',runningJobs:0,
      capacity:0,policyVersion:1,localRevision:0});
    const hello=()=>({type:'WORKER_HELLO',messageId:randomUUID(),workerDeviceId:deviceId,
      controlPlaneId:plane,supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],
      workerRelease:'m16',localRevision:0,activeExecutionIds:[]});
    assert.equal((await transport.poll(hello()))[0].pauseDirective.revision,1);
    assert.deepEqual(await transport.postJobRpc('ACCEPT',{controlPlaneId:plane}),{ok:true});
    await assert.rejects(transport.postJobRpc('RESEARCH_FETCH',{controlPlaneId:plane}),
      {code:'PAUSE_PENDING'});
    assert.equal((await transport.poll(hello()))[0].type,'WORKER_WELCOME');
    assert.deepEqual(seen,['WORKER_HEARTBEAT','WORKER_HELLO','ACCEPT',
      'RESEARCH_FETCH','WORKER_HELLO']);
  }finally{await transport.close();await server.close();}
});

test('transport discovery prefers advertised WSS and fails closed on untrusted downgrade',()=>{
  const planeDoc={id:plane,state:'ACTIVE',endpoint:'https://example.test',
    transports:[{type:'POLLING',version:1,endpoint:'https://example.test'},
      {type:'WEBSOCKET',version:1,endpoint:'wss://example.test/worker/socket'}]};
  assert.equal(selectWorkerTransport(planeDoc).type,'WEBSOCKET');
  assert.throws(()=>selectWorkerTransport({...planeDoc,transports:[{
    type:'WEBSOCKET',version:1,endpoint:'ws://example.test/worker/socket'}]}),
  {code:'UNTRUSTED_ENDPOINT'});
  assert.throws(()=>new WebSocketWorkerTransport(plane,
    'ws://example.test/worker/socket',signer,{allowLocalHttp:true}),
  {code:'UNTRUSTED_ENDPOINT'});
});

test('production WebSocket listener refuses cleartext regardless of local setting',async()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{await assert.rejects(startWorkerWebSocketServer({host:'127.0.0.1',
    port:0,allowLocalWs:true}),/WORKER_WSS_TLS_REQUIRED/);}
  finally{if(previous===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=previous;}
});
