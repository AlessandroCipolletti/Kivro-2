import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { EncryptedDeviceIdentityStore } from
  '../dist/apps/worker/src/device-identity.js';

test('paid Worker startup fails closed before pairing and redacts private paths',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-paid-start-'));
  chmodSync(root,0o700);
  const entry=join(process.cwd(),'tools/kivro-worker-run.mjs');
  try{
    const empty=spawnSync(process.execPath,[entry],{encoding:'utf8',
      env:{...process.env,KIVRO_WORKER_STATE_DIR:root}});
    assert.equal(empty.status,1);
    assert.match(empty.stderr,/WORKER_IDENTITY_NOT_UNLOCKED/);
    const passphrase='private-test-passphrase';
    new EncryptedDeviceIdentityStore(root).create(passphrase);
    const secret=join(root,'passphrase');
    writeFileSync(secret,passphrase,{mode:0o600});
    const unpaired=spawnSync(process.execPath,[entry],{encoding:'utf8',
      env:{...process.env,KIVRO_WORKER_STATE_DIR:root,
        KIVRO_WORKER_PASSPHRASE_FILE:secret}});
    assert.equal(unpaired.status,1);
    assert.match(unpaired.stderr,/WORKER_PAIRING_REQUIRED/);
    assert.doesNotMatch(unpaired.stderr,RegExp(root));
    assert.doesNotMatch(unpaired.stderr,/private-test-passphrase/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
