import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { EncryptedDeviceIdentityStore } from
  '../dist/apps/worker/src/device-identity.js';
import {assertWorkerEnvironmentIsolated} from
  '../dist/apps/worker/src/execution-runtime.js';

test('paid Worker refuses cloud financial, storage and platform credentials',()=>{
  assert.doesNotThrow(()=>assertWorkerEnvironmentIsolated({PATH:'/usr/bin'}));
  for(const key of ['DATABASE_URL','STRIPE_SECRET_KEY',
    'OBJECT_STORAGE_SECRET_ACCESS_KEY','KIVRO_BRAVE_SEARCH_TOKEN']){
    assert.throws(()=>assertWorkerEnvironmentIsolated({[key]:'private-value'}),
      /WORKER_CLOUD_CREDENTIAL_PRESENT/);
  }
  const entry=join(process.cwd(),'tools/kivro-worker-run.mjs');
  const blocked=spawnSync(process.execPath,[entry],{encoding:'utf8',
    env:{PATH:process.env.PATH,STRIPE_SECRET_KEY:'private-value'}});
  assert.equal(blocked.status,1);
  assert.equal(JSON.parse(blocked.stderr.trim()).code,
    'WORKER_CLOUD_CREDENTIAL_PRESENT');
  assert.doesNotMatch(blocked.stderr,/private-value/);
});

test('paid Worker startup fails closed before pairing and redacts private paths',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-paid-start-'));
  chmodSync(root,0o700);
  const entry=join(process.cwd(),'tools/kivro-worker-run.mjs');
  try{
    const empty=spawnSync(process.execPath,[entry],{encoding:'utf8',
      env:{...process.env,KIVRO_WORKER_STATE_DIR:root}});
    assert.equal(empty.status,1);
    assert.match(empty.stderr,/WORKER_IDENTITY_NOT_UNLOCKED/);
    assert.equal(JSON.parse(empty.stderr.trim()).event,'worker_runtime_unavailable');
    const passphrase='private-test-passphrase';
    new EncryptedDeviceIdentityStore(root).create(passphrase);
    const secret=join(root,'passphrase');
    writeFileSync(secret,passphrase,{mode:0o600});
    const unpaired=spawnSync(process.execPath,[entry],{encoding:'utf8',
      env:{...process.env,KIVRO_WORKER_STATE_DIR:root,
        KIVRO_WORKER_PASSPHRASE_FILE:secret}});
    assert.equal(unpaired.status,1);
    assert.match(unpaired.stderr,/WORKER_PAIRING_REQUIRED/);
    assert.equal(JSON.parse(unpaired.stderr.trim()).code,'WORKER_PAIRING_REQUIRED');
    assert.doesNotMatch(unpaired.stderr,RegExp(root));
    assert.doesNotMatch(unpaired.stderr,/private-test-passphrase/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('control-sync startup emits only a bounded structured diagnostic',()=>{
  const privatePath='/tmp/kivro-private-sentinel';
  const entry=join(process.cwd(),'tools/kivro-worker-sync.mjs');
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',
    env:{...process.env,KIVRO_WORKER_STATE_DIR:privatePath,
      WORKER_DISCOVERY_URL:''}});
  assert.equal(result.status,1);
  const diagnostic=JSON.parse(result.stderr.trim());
  assert.equal(diagnostic.event,'worker_control_sync_failed');
  assert.equal(diagnostic.code,'WORKER_DISCOVERY_NOT_CONFIGURED');
  assert.doesNotMatch(result.stderr,/kivro-private-sentinel|STACK|Error:/);
});
