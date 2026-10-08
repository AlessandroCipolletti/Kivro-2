import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import process from 'node:process';
import {handleSellerPairingRequest,handleSellerWorkerRevokeRequest} from
  '../dist/apps/web/src/seller/pairing-handler.js';

const priorOrigin=process.env.APP_ORIGIN;
before(()=>{process.env.APP_ORIGIN='http://localhost:3000';});
after(()=>{if(priorOrigin===undefined)delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN=priorOrigin;});

const accountId=randomUUID(),profileId=randomUUID();
function fixture(authenticated=true,acknowledged=true){
  const calls=[];
  const database={
    async query(sql,values){
      calls.push({sql,values});
      if(sql.includes('seller_execution_model_acknowledgements'))
        return {rows:acknowledged?[{id:profileId}]:[],rowCount:acknowledged?1:0};
      if(sql.includes('JOIN accounts'))
        return {rows:[{id:profileId}],rowCount:1};
      if(sql.includes('INSERT INTO worker_pairing_codes'))return {rows:[],rowCount:1};
      if(sql.includes("UPDATE worker_devices d SET status='REVOKED'"))
        return {rows:[],rowCount:acknowledged?1:0};
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const service={database,auth:{api:{async getSession(){return authenticated?
    {user:{id:accountId}}:null;}}}};
  return {service,calls};
}
function issue(origin='http://localhost:3000',body='{}'){
  return new globalThis.Request('http://localhost:3000/api/seller/pairing/issue',{
    method:'POST',headers:{origin,'content-type':'application/json'},body});
}

test('pairing code requires authenticated seller, same origin and explicit execution acknowledgement',async()=>{
  const anonymous=fixture(false);
  assert.equal((await handleSellerPairingRequest(issue(),'issue',anonymous.service)).status,401);
  assert.equal(anonymous.calls.length,0);
  const crossOrigin=fixture();
  assert.equal((await handleSellerPairingRequest(issue('https://other.example'),'issue',
    crossOrigin.service)).status,403);
  assert.equal(crossOrigin.calls.length,0);
  const noConsent=fixture(true,false);
  assert.equal((await handleSellerPairingRequest(issue(),'issue',noConsent.service)).status,403);
  assert.equal(noConsent.calls.length,1);
  const malformed=fixture();
  assert.equal((await handleSellerPairingRequest(issue(undefined,'{"sellerId":"other"}'),
    'issue',malformed.service)).status,400);
  assert.equal(malformed.calls.length,0);
});

test('one-time code is returned once while only its digest reaches storage',async()=>{
  const {service,calls}=fixture();
  const response=await handleSellerPairingRequest(issue(),'issue',service);
  assert.equal(response.status,201);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  const body=await response.json();
  assert.match(body.code,/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
  assert.ok(new Date(body.expiresAt).getTime()>Date.now());
  const insert=calls.find((call)=>call.sql.includes('INSERT INTO worker_pairing_codes'));
  assert.ok(insert);
  assert.equal(insert.values[1],profileId);
  assert.match(insert.values[2],/^sha256:[a-f0-9]{64}$/);
  assert.notEqual(insert.values[2],body.code);
});

test('pairing route rejects unrelated methods and malformed redemption',async()=>{
  const {service}=fixture();
  assert.equal((await handleSellerPairingRequest(new globalThis.Request('http://localhost:3000'),
    'issue',service)).status,405);
  const response=await handleSellerPairingRequest(new globalThis.Request(
    'http://localhost:3000/api/seller/pairing/redeem',{method:'POST',
      headers:{'content-type':'application/json'},body:'{}'}),'redeem',service);
  assert.equal(response.status,400);
});

test('seller Worker revocation is same-origin, owner-bound and replay safe',async()=>{
  const deviceId=randomUUID();
  const request=(origin='http://localhost:3000',body='{}')=>
    new globalThis.Request(`http://localhost:3000/api/seller/worker-devices/${deviceId}/revoke`,{
      method:'POST',headers:{origin,'content-type':'application/json'},body});
  const denied=fixture(false);
  assert.equal((await handleSellerWorkerRevokeRequest(request(),deviceId,
    denied.service)).status,401);
  assert.equal(denied.calls.length,0);
  const crossOrigin=fixture();
  assert.equal((await handleSellerWorkerRevokeRequest(request('https://evil.example'),
    deviceId,crossOrigin.service)).status,403);
  assert.equal(crossOrigin.calls.length,0);
  const foreign=fixture(true,false);
  assert.equal((await handleSellerWorkerRevokeRequest(request(),deviceId,
    foreign.service)).status,403);
  assert.equal((await handleSellerWorkerRevokeRequest(request(),randomUUID(),
    foreign.service)).status,403);
  const owner=fixture();
  for(let replay=0;replay<2;replay++){
    const response=await handleSellerWorkerRevokeRequest(request(),deviceId,
      owner.service);
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{deviceId,revoked:true});
  }
  assert.equal(owner.calls.length,2);
  assert.deepEqual(owner.calls[0].values,[deviceId,accountId]);
  assert.equal((await handleSellerWorkerRevokeRequest(request(undefined,
    '{"accountId":"forged"}'),deviceId,owner.service)).status,400);
  assert.equal(owner.calls.length,2);
});
