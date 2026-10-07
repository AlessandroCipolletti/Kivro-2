import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { EncryptedDeviceIdentityStore } from '../dist/apps/worker/src/device-identity.js';
import { workerPairingProofBytes } from '../dist/packages/persistence/src/worker-pairing.js';
import { pairedSellerForDevice,rememberPairedSeller } from '../dist/apps/worker/src/paired-seller.js';
import { WorkerUnreviewedPackageStore } from '../dist/apps/worker/src/import-package.js';
import { WorkerCapabilityPackageStore } from '../dist/apps/worker/src/capability-package-store.js';

const command = join(process.cwd(), 'tools', 'kivro-worker.mjs');

test('CLI pause commits before success and health sees it from a new process', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-worker-cli-'));
  chmodSync(directory, 0o700);
  const env = { ...process.env, KIVRO_WORKER_STATE_DIR: directory };
  try {
    const paused = execFileSync(process.execPath, [command, 'pause', '--all'], { env, encoding: 'utf8' });
    assert.match(paused, /Paused new jobs locally/);
    const health = JSON.parse(execFileSync(process.execPath, [command, 'health', '--json'], { env, encoding: 'utf8' }));
    assert.equal(health.localPaused, true);
    assert.equal(health.acceptingNewJobs, false);
    assert.equal(health.overall, 'PAUSED');
    assert.equal(health.cloudSyncPending, true);
    assert.equal(health.runningJobs, 0, 'local execution table has no running job');
    const denied = spawnSync(process.execPath, [command, 'resume', '--all'], { env, encoding: 'utf8' });
    assert.equal(denied.status, 1);
    assert.match(denied.stdout, /NOT_READY/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('doctor shows critical failures and does not print local paths or secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-worker-cli-'));
  chmodSync(directory, 0o700);
  const env = { ...process.env, KIVRO_WORKER_STATE_DIR: directory, SECRET_SENTINEL: 'do-not-print-me' };
  try {
    const result = spawnSync(process.execPath, [command, 'doctor', '--json'], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.overall, 'NOT_READY');
    assert.ok(report.checks.some((check) => check.name === 'APPROVED_SANDBOX_IMAGE' && check.status === 'FAIL'));
    assert.ok(report.checks.some((check) => check.name === 'EXECUTION_CAPACITY' && check.status === 'FAIL'));
    assert.doesNotMatch(result.stdout, /do-not-print-me|kivro-worker-cli-/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('seller discovery command reads metadata locally without consent or state mutation', () => {
  const home=mkdtempSync(join(realpathSync(tmpdir()),'kivro-worker-discover-'));
  const state=join(home,'.openclaw');
  const skill=join(state,'workspace','skills','summary');
  mkdirSync(skill,{recursive:true});
  writeFileSync(join(state,'openclaw.json'),'{}');
  writeFileSync(join(state,'.env'),'PRIVATE_TOKEN=never-print-this');
  writeFileSync(join(skill,'SKILL.md'),
    '---\nname: summary\nmetadata:\n  openclaw:\n    requires:\n      env: [SUMMARY_TOKEN]\n---\nPrivate skill body\n');
  const env={...process.env,OPENCLAW_HOME:home,OPENCLAW_STATE_DIR:state,
    OPENCLAW_WORKSPACE_DIR:join(state,'workspace'),
    OPENCLAW_CONFIG_PATH:join(state,'openclaw.json')};
  const snapshot=(root)=>{
    const visit=(path)=>[lstatSync(path).mode,lstatSync(path).mtimeMs,
      lstatSync(path).isFile()?readFileSync(path).toString('base64'):
        readdirSync(path).sort().map((name)=>[name,visit(join(path,name))])];
    return visit(root);
  };
  try{
    const before=snapshot(home);
    const result=spawnSync(process.execPath,[command,'discover','--json'],
      {env,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr+result.stdout);
    const data=JSON.parse(result.stdout);
    const found=data.skills.find((item)=>item.name==='summary');
    assert.ok(found);
    assert.equal(found.consent,'not-granted');
    assert.equal(found.readiness,'unknown');
    assert.deepEqual(found.declaredResources.environmentKeys,['SUMMARY_TOKEN']);
    assert.doesNotMatch(result.stdout,/never-print-this|Private skill body|openclaw\.json/);
    assert.deepEqual(snapshot(home),before);
    const plain=spawnSync(process.execPath,[command,'discover'],{env,encoding:'utf8'});
    assert.equal(plain.status,0);
    assert.match(plain.stdout,/grants no Kivro permissions/);
  }finally{rmSync(home,{recursive:true,force:true});}
});

test('seller import requires pairing, keeps discovery local and records only explicit selections',()=>{
  const home=mkdtempSync(join(realpathSync(tmpdir()),'kivro-worker-import-'));
  const state=join(home,'.openclaw');
  const skill=join(state,'workspace','skills','summary');
  const directory=join(home,'worker-state');
  mkdirSync(skill,{recursive:true});mkdirSync(directory,{mode:0o700});
  writeFileSync(join(state,'openclaw.json'),'{}');
  writeFileSync(join(state,'.env'),'SECRET=do-not-export');
  writeFileSync(join(skill,'SKILL.md'),
    '---\nname: summary\nmetadata:\n  openclaw:\n    requires:\n      env: [SUMMARY_TOKEN]\n---\nPrivate skill instructions\n');
  const identity=new EncryptedDeviceIdentityStore(directory).create('fixture passphrase');
  const env={...process.env,KIVRO_WORKER_STATE_DIR:directory,OPENCLAW_HOME:home,
    OPENCLAW_STATE_DIR:state,OPENCLAW_WORKSPACE_DIR:join(state,'workspace'),
    OPENCLAW_CONFIG_PATH:join(state,'openclaw.json')};
  const snapshot=()=>[join(state,'openclaw.json'),join(state,'.env'),join(skill,'SKILL.md')]
    .map((path)=>[lstatSync(path).mode,lstatSync(path).mtimeMs,readFileSync(path).toString('base64')]);
  try{
    const unpaired=spawnSync(process.execPath,[command,'import','start','summary'],
      {env,encoding:'utf8'});
    assert.equal(unpaired.status,1);
    assert.match(unpaired.stdout,/PAIRING_REQUIRED/);
    rememberPairedSeller(directory,{deviceId:identity.deviceId,
      sellerAccountId:randomUUID(),sellerProfileId:randomUUID()});
    const nonInteractive=spawnSync(process.execPath,[command,'import','guided'],
      {env,encoding:'utf8'});
    assert.equal(nonInteractive.status,2);
    assert.match(nonInteractive.stdout,/INTERACTIVE_REQUIRED/);
    const before=snapshot();
    const started=spawnSync(process.execPath,[command,'import','start','summary'],
      {env,encoding:'utf8'});
    assert.equal(started.status,0,started.stderr+started.stdout);
    const draft=JSON.parse(started.stdout);
    assert.equal(draft.selectedDependencies,0);
    assert.equal(draft.readiness,'UNKNOWN');
    assert.equal(draft.dependencies.length,2);
    assert.doesNotMatch(started.stdout,/do-not-export|Private skill instructions/);
    const initial=JSON.parse(execFileSync(process.execPath,
      [command,'import','show',draft.draftId,'--json'],{env,encoding:'utf8'}));
    assert.equal(initial.draft.revision,0);
    assert.equal(initial.draft.graph.nodes.every((node)=>!node.selected),true);
    assert.equal(initial.analysis.publishable,false);
    const selected=spawnSync(process.execPath,[command,'import','select',draft.draftId,
      initial.draft.graph.rootId,'--allow'],{env,encoding:'utf8'});
    assert.equal(selected.status,0,selected.stderr+selected.stdout);
    const after=JSON.parse(execFileSync(process.execPath,
      [command,'import','show',draft.draftId,'--json'],{env,encoding:'utf8'}));
    assert.equal(after.draft.revision,1);
    assert.equal(after.draft.graph.nodes.filter((node)=>node.selected).length,1);
    assert.equal(after.analysis.publishable,false);
    assert.ok(after.analysis.issues.some((issue)=>issue.code==='REQUIRED_NOT_SELECTED'));
    const inference=spawnSync(process.execPath,[command,'import','inference',draft.draftId,
      'remote','anthropic','claude-test','seller:anthropic'],{env,encoding:'utf8'});
    assert.equal(inference.status,0,inference.stderr+inference.stdout);
    const configured=JSON.parse(inference.stdout);
    assert.equal(configured.candidates.length,3);
    assert.ok(configured.candidates.every((node)=>node.selected===false&&node.health==='UNKNOWN'));
    assert.doesNotMatch(inference.stdout,/do-not-export|Private skill instructions/);
    const repeated=spawnSync(process.execPath,[command,'import','inference',draft.draftId,
      'remote','anthropic','claude-test','seller:anthropic'],{env,encoding:'utf8'});
    assert.equal(repeated.status,1,'Changing an already configured inference route requires a new draft');
    assert.deepEqual(snapshot(),before,'the seller personal OpenClaw files are untouched');
  }finally{rmSync(home,{recursive:true,force:true});}
});

test('paired seller can stage an unreviewed private package without touching personal OpenClaw',()=>{
  const home=mkdtempSync(join(realpathSync(tmpdir()),'kivro-worker-author-'));
  const state=join(home,'.openclaw');
  const skill=join(state,'workspace','skills','simple');
  const directory=join(home,'worker-state');
  mkdirSync(skill,{recursive:true});mkdirSync(directory,{mode:0o700});
  writeFileSync(join(state,'openclaw.json'),'{}');
  const body='---\nname: simple\n---\nSeller-authored skill body.\n';
  writeFileSync(join(skill,'SKILL.md'),body);
  const identity=new EncryptedDeviceIdentityStore(directory).create('fixture passphrase');
  const sellerAccountId=randomUUID();
  rememberPairedSeller(directory,{deviceId:identity.deviceId,sellerAccountId,
    sellerProfileId:randomUUID()});
  const env={...process.env,KIVRO_WORKER_STATE_DIR:directory,OPENCLAW_HOME:home,
    OPENCLAW_STATE_DIR:state,OPENCLAW_WORKSPACE_DIR:join(state,'workspace'),
    OPENCLAW_CONFIG_PATH:join(state,'openclaw.json')};
  const run=(...args)=>spawnSync(process.execPath,[command,...args],{env,encoding:'utf8'});
  try{
    const before=[lstatSync(join(skill,'SKILL.md')).mtimeMs,readFileSync(join(skill,'SKILL.md'))];
    const started=run('import','start','simple');
    assert.equal(started.status,0,started.stderr+started.stdout);
    const draftId=JSON.parse(started.stdout).draftId;
    const inference=run('import','inference',draftId,'remote','example','model-one',
      'seller:dedicated');
    assert.equal(inference.status,0,inference.stderr+inference.stdout);
    const draft=JSON.parse(run('import','show',draftId,'--json').stdout).draft;
    for(const node of draft.graph.nodes){
      const selected=run('import','select',draftId,node.id,'--allow');
      assert.equal(selected.status,0,selected.stderr+selected.stdout);
    }
    const versionId=randomUUID();
    const authored={capabilityId:randomUUID(),
      capabilityVersionId:versionId,supportedOpenClawVersionRange:'>=2026.8.2 <2026.9.0',
      ioContract:{contractVersion:1,
        input:{schemaVersion:1,fields:[{key:'question',label:'Question',order:0,
          required:true,type:'SHORT_TEXT'}]},
        output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
          required:true,type:'SHORT_TEXT'}]}},
      priceTier:'USD_999',providerBudget:{providerId:'example',modelId:'model-one',
        credentialRef:'seller:dedicated',maxRequestsPerJob:2,
        maxInputTokensPerRequest:8192,maxOutputTokensPerRequest:1024,
        maxEstimatedSpendMicroUsdPerJob:100_000,
        inputPriceMicroUsdPerMillionTokens:1_000_000,
        outputPriceMicroUsdPerMillionTokens:1_000_000},
      limits:{timeoutSeconds:60,memoryMb:1024,cpu:1,maxPids:128,
        maxInputBytes:1000,maxOutputBytes:65536},
      concurrencyLimit:1,pauseSupport:'FULL_RESUME'};
    const path=join(directory,'authored.json');
    writeFileSync(path,JSON.stringify(authored),{mode:0o640});
    assert.equal(run('import','package',draftId,path).status,1,
      'a group-readable authoring file cannot stage a package');
    chmodSync(path,0o600);
    const staged=run('import','package',draftId,path);
    assert.equal(staged.status,0,staged.stderr+staged.stdout);
    assert.equal(JSON.parse(staged.stdout).state,'UNREVIEWED');
    assert.doesNotMatch(staged.stdout,/Seller-authored skill body|dedicated/);
    const store=new WorkerUnreviewedPackageStore(directory);
    let loaded;
    try{
      loaded=store.load(versionId,sellerAccountId);
      assert.equal(loaded.localPackage.workerDeviceId,identity.deviceId);
      assert.equal(Buffer.from(loaded.reviewedSkills[0].files[0].bytesBase64,'base64')
        .toString(),body);
    }finally{store.close();}
    const reviewed=new WorkerCapabilityPackageStore(directory);
    try{reviewed.installReviewed(loaded.localPackage,{actorId:'test:local-only',
      approvedAt:new Date().toISOString(),
      reviewEvidenceHash:`sha256:${'a'.repeat(64)}`},loaded.reviewedSkills);}
    finally{reviewed.close();}
    const inspected=run('import','permissions',versionId);
    assert.equal(inspected.status,0,inspected.stderr+inspected.stdout);
    const policy=JSON.parse(inspected.stdout);
    assert.equal(policy.capabilityVersionId,versionId);
    assert.deepEqual(policy.permissionPolicy.sellerCredentialRefs,['seller:dedicated']);
    assert.equal(policy.selectedDependencies.length,4);
    assert.doesNotMatch(inspected.stdout,/Seller-authored skill body/);
    const unknown=run('import','permissions',randomUUID());
    assert.equal(unknown.status,1);
    assert.equal(lstatSync(join(skill,'SKILL.md')).mtimeMs,before[0]);
    assert.deepEqual(readFileSync(join(skill,'SKILL.md')),before[1]);
  }finally{rmSync(home,{recursive:true,force:true});}
});

test('device status reports local metadata without claiming credential or cloud pairing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-worker-cli-'));
  chmodSync(directory, 0o700);
  const env = { ...process.env, KIVRO_WORKER_STATE_DIR: directory };
  try {
    const missing = JSON.parse(execFileSync(process.execPath, [command, 'device', 'status', '--json'], { env, encoding: 'utf8' }));
    assert.equal(missing.status, 'MISSING');
    assert.equal(missing.pairing, 'UNKNOWN');
    const device = new EncryptedDeviceIdentityStore(directory).create('fixture passphrase for local device');
    const found = JSON.parse(execFileSync(process.execPath, [command, 'device', 'status', '--json'], { env, encoding: 'utf8' }));
    assert.equal(found.status, 'METADATA_PRESENT');
    assert.equal(found.deviceId, device.deviceId);
    assert.equal(found.storage, 'ENCRYPTED_FILE');
    assert.equal(found.pairing, 'UNKNOWN');
    assert.doesNotMatch(JSON.stringify(found), /PRIVATE KEY|passphrase/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('destructive global job stop requires an explicit confirmation flag',()=>{
  const denied=spawnSync(process.execPath,[command,'stop','--all'],{encoding:'utf8'});
  assert.equal(denied.status,2);
  assert.match(denied.stdout,/--confirm/);
});

test('pairing refuses insecure remote HTTP before creating a device identity',()=>{
  const directory=mkdtempSync(join(tmpdir(),'kivro-worker-pair-'));
  chmodSync(directory,0o700);
  try{
    const env={...process.env,KIVRO_WORKER_STATE_DIR:directory,
      KIVRO_CLOUD_URL:'http://example.com',KIVRO_ALLOW_LOCAL_HTTP:'true'};
    const result=spawnSync(process.execPath,[command,'pair',
      'AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD'],{env,encoding:'utf8'});
    assert.equal(result.status,1);
    assert.match(result.stdout,/PAIRING_REQUIRES_HTTPS/);
    assert.equal(existsSync(join(directory,'device-keychain.json')),false);
    assert.equal(existsSync(join(directory,'device-identity.json')),false);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('Worker CLI pairs using a signed device proof without sending the private key',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'kivro-worker-pair-'));
  chmodSync(directory,0o700);
  const passphrase='fixture passphrase for pairing only';
  const identity=new EncryptedDeviceIdentityStore(directory).create(passphrase);
  const passphrasePath=join(directory,'passphrase');
  writeFileSync(passphrasePath,passphrase,{mode:0o600});
  const code='AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD';
  let received=false;
  const sellerAccountId=randomUUID(),sellerProfileId=randomUUID();
  const server=createServer(async(request,response)=>{
    const parts=[];
    for await(const part of request)parts.push(part);
    const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
    received=true;
    assert.equal(request.url,'/api/seller/pairing/redeem');
    assert.equal(body.code,code);
    assert.equal(body.deviceId,identity.deviceId);
    assert.equal(body.publicKeyPem,identity.publicKeyPem);
    assert.equal('privateKeyPem' in body,false);
    assert.equal(verify(null,workerPairingProofBytes(code,body.deviceId,body.publicKeyPem),
      createPublicKey(body.publicKeyPem),Buffer.from(body.possessionSignature,'base64url')),true);
    response.writeHead(201,{'content-type':'application/json'});
    response.end(JSON.stringify({deviceId:identity.deviceId,sellerProfileId,sellerAccountId}));
  });
  try{
    await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();
    assert.ok(address&&typeof address!=='string');
    const env={...process.env,KIVRO_WORKER_STATE_DIR:directory,
      KIVRO_WORKER_PASSPHRASE_FILE:passphrasePath,
      KIVRO_CLOUD_URL:`http://127.0.0.1:${address.port}`,
      KIVRO_ALLOW_LOCAL_HTTP:'true'};
    const result=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[command,'pair',code],{env});
      let stdout='',stderr='';
      child.stdout.on('data',(part)=>{stdout+=part;});
      child.stderr.on('data',(part)=>{stderr+=part;});
      child.on('error',reject);
      child.on('close',(status)=>resolve({status,stdout,stderr}));
    });
    assert.equal(result.status,0,result.stderr+result.stdout);
    assert.match(result.stdout,/Worker paired/);
    assert.equal(received,true);
    assert.deepEqual(pairedSellerForDevice(directory,identity.deviceId),
      {deviceId:identity.deviceId,sellerProfileId,sellerAccountId});
  }finally{server.close();rmSync(directory,{recursive:true,force:true});}
});
