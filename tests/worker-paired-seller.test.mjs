import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmodSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pairedSellerForDevice,rememberPairedSeller } from
  '../dist/apps/worker/src/paired-seller.js';

test('pairing owner survives restart but cannot be silently rebound',()=>{
  const directory=mkdtempSync(join(tmpdir(),'kivro-paired-seller-'));
  chmodSync(directory,0o700);
  const paired={deviceId:randomUUID(),sellerAccountId:randomUUID(),sellerProfileId:randomUUID()};
  try{
    assert.equal(pairedSellerForDevice(directory,paired.deviceId),null);
    assert.deepEqual(rememberPairedSeller(directory,paired),paired);
    assert.deepEqual(rememberPairedSeller(directory,paired),paired);
    assert.deepEqual(pairedSellerForDevice(directory,paired.deviceId),paired);
    assert.throws(()=>rememberPairedSeller(directory,{...paired,sellerAccountId:randomUUID()}),
      /PAIRING_OWNER_CHANGED/);
    assert.deepEqual(pairedSellerForDevice(directory,paired.deviceId),paired);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
