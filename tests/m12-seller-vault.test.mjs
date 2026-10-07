import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { KeychainSellerCredentialVault } from
  '../dist/apps/worker/src/seller-credential-vault.js';

test('seller credential vault scopes refs to Worker and redacts health checks',async()=>{
  const values=new Map();
  const entry=(name)=>({async getSecret(){const value=values.get(name);
    return value?Uint8Array.from(value):null;},async setSecret(value){values.set(name,Uint8Array.from(value));}});
  const first=randomUUID(),second=randomUUID();
  const vault=new KeychainSellerCredentialVault(first,entry);
  const other=new KeychainSellerCredentialVault(second,entry);
  const secret=Buffer.from('seller-test-key');
  await vault.put('seller:provider-primary',secret);
  assert.equal(await vault.exists('seller:provider-primary'),true);
  assert.equal(await other.exists('seller:provider-primary'),false);
  assert.equal(await vault.resolve('seller:provider-primary'),'seller-test-key');
  await assert.rejects(vault.resolve('seller:absent'),{code:'MISSING'});
  await assert.rejects(vault.exists('platform:provider-primary'),{code:'INVALID_REFERENCE'});
  await assert.rejects(vault.put('seller:bad',Buffer.alloc(8193)),{code:'INVALID_SECRET'});
  assert.equal([...values.keys()][0],`${first}:seller:provider-primary`);
});
