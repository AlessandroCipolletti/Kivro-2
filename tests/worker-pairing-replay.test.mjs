import assert from 'node:assert/strict';
import { generateKeyPairSync,randomUUID,sign } from 'node:crypto';
import { test } from 'node:test';
import { PostgresWorkerPairingRepository,workerPairingProofBytes } from
  '../dist/packages/persistence/src/worker-pairing.js';

const code='AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD';
const deviceId=randomUUID(),sellerProfileId=randomUUID(),sellerAccountId=randomUUID();
const key=generateKeyPairSync('ed25519');
const publicKeyPem=key.publicKey.export({type:'spki',format:'pem'}).toString();
const input={code,deviceId,publicKeyPem,name:'Seller computer',platform:'MACOS',
  workerRelease:'0.0.0-dev',possessionSignature:sign(null,
    workerPairingProofBytes(code,deviceId,publicKeyPem),key.privateKey).toString('base64url')};

function database(status='PAIRED'){
  const commands=[];
  const client={
    async query(sql){
      commands.push(sql);
      if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[],rowCount:0};
      if(sql.includes('FROM worker_pairing_codes'))return {rows:[{
        seller_profile_id:sellerProfileId,expires_at:new Date(0),
        consumed_at:new Date(),paired_device_id:deviceId}],rowCount:1};
      if(sql.includes('FROM seller_profiles'))return {rows:[{id:sellerProfileId,
        account_id:sellerAccountId}],rowCount:1};
      if(sql.includes('FROM worker_devices'))return {rows:[{public_key:publicKeyPem,status}],rowCount:1};
      throw new Error(`Unexpected SQL: ${sql}`);
    },release(){},
  };
  return {pool:{async connect(){return client;}},commands};
}

test('lost pairing acknowledgement replays one already committed identity without a second insert',async()=>{
  const fixture=database();
  const result=await new PostgresWorkerPairingRepository(fixture.pool).redeem(input);
  assert.deepEqual(result,{deviceId,sellerProfileId,sellerAccountId});
  assert.equal(fixture.commands.at(-1),'COMMIT');
  assert.equal(fixture.commands.some((sql)=>sql.includes('INSERT INTO worker_devices')),false);
});

test('revoked device cannot use a consumed pairing code to regain authority',async()=>{
  const fixture=database('REVOKED');
  await assert.rejects(new PostgresWorkerPairingRepository(fixture.pool).redeem(input),
    {code:'INVALID_CODE'});
  assert.equal(fixture.commands.at(-1),'ROLLBACK');
});
