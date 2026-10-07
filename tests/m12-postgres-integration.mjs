import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync,randomUUID,sign } from 'node:crypto';
import test from 'node:test';
import process from 'node:process';
import pg from 'pg';
import { PostgresSellerOperations } from '../dist/packages/persistence/src/seller-operations.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';
import { workerMessageHash,workerSignatureBytes } from
  '../dist/packages/worker-protocol/src/auth.js';
import { handleWorkerPoll,handleWorkerMessage } from
  '../dist/apps/web/src/worker/control-handler.js';
import { PostgresJobExecutionRepository } from
  '../dist/packages/persistence/src/job-execution.js';
import { HmacLeaseTokenIssuer } from
  '../dist/packages/application/src/lease-token.js';
import { HttpsPollingWorkerTransport } from
  '../dist/packages/infrastructure/netsons/src/https-polling.js';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';
import { WorkerControlSync } from '../dist/apps/worker/src/control-sync.js';

if(!process.env.M12_DATABASE_URL){
  test('M12 PostgreSQL integration requires disposable PostgreSQL',{skip:true},()=>{});
}else test('web/local emergency controls survive replay, offline Worker and seller isolation',async()=>{
  const pool=new pg.Pool({connectionString:process.env.M12_DATABASE_URL,max:8});
  const finance=new PostgresFinanceRepository(pool,'test');
  const availability=new PostgresAvailabilityRepository(pool,finance);
  const operations=new PostgresSellerOperations(pool,availability,finance);
  const heartbeat=new PostgresWorkerHeartbeatRepository(pool);
  const sellerAccount=randomUUID(),otherAccount=randomUUID(),sellerProfile=randomUUID(),worker=randomUUID();
  try{
    await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
      VALUES($1,$3,'ACTIVE',now()),($2,$4,'ACTIVE',now())`,
    [sellerAccount,otherAccount,`${sellerAccount}@example.test`,`${otherAccount}@example.test`]);
    await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
      VALUES($1,$2,'M12 Seller','ACTIVE','NOT_STARTED')`,[sellerProfile,sellerAccount]);
    await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
      worker_version,status) VALUES($1,$2,'fixture-key','M12 Worker','LINUX','0.0.0-dev','OFFLINE')`,
    [worker,sellerProfile]);
    assert.equal((await operations.cloudDirective(worker)).paused,false);
    await assert.rejects(operations.setWorkerPause(otherAccount,worker,true,null),
      {code:'NOT_ELIGIBLE'});
    await operations.setWorkerPause(sellerAccount,worker,true,null);
    const paused=await operations.cloudDirective(worker);
    assert.equal(paused.paused,true);
    assert.equal(paused.revision,1);
    await operations.setWorkerPause(sellerAccount,worker,true,null);
    assert.equal((await operations.cloudDirective(worker)).revision,1,'retry is idempotent');
    assert.equal((await operations.dashboard(sellerAccount)).workers[0].status,'OFFLINE');
    const beat=(revision,localPause,sentAt=new Date().toISOString(),cloudRevision=0,
      workerRelease='0.0.0-dev')=>({
      type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),
      controlPlaneId:'m12-plane',workerDeviceId:worker,workerRelease,
      sentAt,openClawVersion:null,status:localPause.globalPaused?'PAUSED':'ONLINE',
      runningJobs:0,capacity:1,policyVersion:1,localRevision:revision,
      acknowledgedCloudRevision:cloudRevision,
      localPause,capabilityReadiness:[]});
    let sent=Date.now();
    await heartbeat.observe(beat(1,{globalPaused:true,securityPaused:false,
      capabilityPauses:[]},new Date(sent).toISOString(),1),worker,'m12-plane');
    const healthyChecks=[{code:'DOCKER_DAEMON',state:'HEALTHY'},
      {code:'APPROVED_SANDBOX_IMAGE',state:'HEALTHY'}];
    await heartbeat.observe({...beat(1,{globalPaused:true,securityPaused:false,
      capabilityPauses:[]},new Date(++sent).toISOString(),1),operationalChecks:healthyChecks},
    worker,'m12-plane');
    assert.deepEqual((await operations.dashboard(sellerAccount)).workers[0].operational_checks,
      healthyChecks);
    const local=await pool.query('SELECT global_paused FROM worker_local_pause_reports WHERE worker_device_id=$1',[worker]);
    assert.equal(local.rows[0].global_paused,true);
    await assert.rejects(heartbeat.observe(beat(0,{globalPaused:false,securityPaused:false,
      capabilityPauses:[]},new Date(++sent).toISOString()),worker,'m12-plane'),
      {code:'CONFLICT'});
    await operations.setWorkerPause(sellerAccount,worker,false,null);
    assert.equal((await operations.cloudDirective(worker)).paused,false);
    assert.equal((await operations.dashboard(sellerAccount)).workers[0].global_paused,true,
      'web resume does not clear Worker local pause');
    await heartbeat.observe(beat(2,{globalPaused:false,securityPaused:false,
      capabilityPauses:[]},new Date(++sent).toISOString(),2),worker,'m12-plane');
    assert.equal((await operations.dashboard(sellerAccount)).workers[0].global_paused,false);
    await pool.query(`UPDATE worker_heartbeats SET observed_at=now()-interval '2 minutes'
      WHERE worker_device_id=$1`,[worker]);
    await pool.query(`UPDATE worker_devices SET last_seen_at=now()-interval '2 minutes'
      WHERE id=$1`,[worker]);
    assert.equal(await heartbeat.recordStaleWorkers(),1);
    assert.equal(await heartbeat.recordStaleWorkers(),0,'stale notification is not duplicated');
    await heartbeat.observe(beat(2,{globalPaused:false,securityPaused:false,
      capabilityPauses:[]},new Date(++sent).toISOString(),2),worker,'m12-plane');
    assert.equal((await operations.dashboard(sellerAccount)).workers[0].status,'HEALTHY');
    await operations.setWorkerPause(sellerAccount,worker,true,'Planned maintenance',
      new Date(Date.now()+60_000).toISOString());
    assert.ok((await operations.dashboard(sellerAccount)).workers[0].maintenanceUntil);
    await pool.query(`UPDATE worker_availability_schedules SET maintenance_until=now()-interval '1 second'
      WHERE worker_device_id=$1`,[worker]);
    assert.equal(await operations.expireMaintenance(),1);
    assert.equal((await operations.cloudDirective(worker)).paused,false,
      'elapsed maintenance revalidates and resumes only when health is fresh');
    const history=await pool.query('SELECT kind FROM worker_operational_events WHERE worker_device_id=$1',[worker]);
    assert.ok(history.rows.some((row)=>row.kind==='LOCAL_PAUSE'));
    assert.ok(history.rows.some((row)=>row.kind==='WEB_PAUSE'));
    assert.ok(history.rows.some((row)=>row.kind==='WEB_RESUME'));
    assert.ok(history.rows.some((row)=>row.kind==='WORKER_STALE'));
    assert.ok(history.rows.some((row)=>row.kind==='WORKER_RECONNECTED'));
    assert.ok(history.rows.some((row)=>row.kind==='HEALTH_CHANGED'),
      'sanitized health changes are retained for seller diagnosis');
    const priorMinimum=process.env.KIVRO_MIN_WORKER_RELEASE;
    try{
      process.env.KIVRO_MIN_WORKER_RELEASE='1.0.0';
      await heartbeat.observe(beat(2,{globalPaused:false,securityPaused:false,
        capabilityPauses:[]},new Date(++sent).toISOString(),2,'0.0.0'),worker,'m12-plane');
      assert.equal((await operations.cloudDirective(worker)).securityPaused,true);
      assert.equal((await operations.dashboard(sellerAccount)).workers[0].status,'SECURITY_WARNING');
      await operations.setWorkerPause(sellerAccount,worker,true,null);
      await assert.rejects(operations.setWorkerPause(sellerAccount,worker,false,null),
        {code:'SECURITY_BLOCK'});
      await pool.query(`UPDATE worker_availability_schedules SET maintenance_until=now()-interval '1 second'
        WHERE worker_device_id=$1`,[worker]);
      assert.equal(await operations.expireMaintenance(),0,
        'maintenance expiry cannot override a security block');
      assert.equal((await operations.cloudDirective(worker)).paused,true);
      const securityHistory=await pool.query(`SELECT kind,code FROM worker_operational_events
        WHERE worker_device_id=$1 AND kind='SECURITY_BLOCK'`,[worker]);
      assert.equal(securityHistory.rows.length,1,'critical version block is durable and idempotent');
      await assert.rejects(operations.clearSecurityBlockByPlatform(worker,'health-policy'),
        {code:'SECURITY_BLOCK'},'the old version cannot be cleared');
      await heartbeat.observe({...beat(2,{globalPaused:false,securityPaused:false,
        capabilityPauses:[]},new Date(++sent).toISOString(),2,'1.0.0'),
        operationalChecks:[{code:'DEVICE_IDENTITY',state:'HEALTHY'},...healthyChecks]},
      worker,'m12-plane');
      await operations.clearSecurityBlockByPlatform(worker,'health-policy');
      const cleared=await operations.cloudDirective(worker);
      assert.equal(cleared.securityPaused,false);
      assert.equal(cleared.clearSecurityPause,true);
      await operations.clearSecurityBlockByPlatform(worker,'health-policy');
      const clears=await pool.query(`SELECT 1 FROM worker_operational_events WHERE
        worker_device_id=$1 AND kind='SECURITY_CLEAR'`,[worker]);
      assert.equal(clears.rowCount,1,'platform clearance is idempotent');
    }finally{
      if(priorMinimum===undefined)delete process.env.KIVRO_MIN_WORKER_RELEASE;
      else process.env.KIVRO_MIN_WORKER_RELEASE=priorMinimum;
    }
    const imageWorker=randomUUID();
    await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
      worker_version,status) VALUES($1,$2,'fixture-image-key','Image Worker','LINUX',
      '0.0.0-dev','OFFLINE')`,[imageWorker,sellerProfile]);
    await heartbeat.observe({...beat(0,{globalPaused:false,securityPaused:false,
      capabilityPauses:[]},new Date().toISOString(),0),workerDeviceId:imageWorker,
      operationalChecks:[{code:'DOCKER_DAEMON',state:'HEALTHY'},
        {code:'APPROVED_SANDBOX_IMAGE',state:'BLOCKING'}]},imageWorker,'m12-plane');
    assert.equal((await operations.cloudDirective(imageWorker)).securityPaused,true);
    await operations.setWorkerPause(sellerAccount,imageWorker,true,null);
    await assert.rejects(operations.setWorkerPause(sellerAccount,imageWorker,false,null),
      {code:'SECURITY_BLOCK'});
  }finally{await pool.end();}
});

if(process.env.M12_DATABASE_URL)test('signed Worker routes synchronize web pause before offers and reject forgery',async()=>{
  const pool=new pg.Pool({connectionString:process.env.M12_DATABASE_URL});
  const sellerAccount=randomUUID(),sellerProfile=randomUUID(),worker=randomUUID();
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  Object.assign(process.env,{DATABASE_URL:process.env.M12_DATABASE_URL,
    APP_ORIGIN:'http://127.0.0.1:9876',BETTER_AUTH_SECRET:'m12-test-auth-secret-at-least-32-characters',
    AUTH_OUTBOX_KEY_BASE64:Buffer.alloc(32,2).toString('base64'),
    KIVRO_STRIPE_MODE:'test',KIVRO_CONTROL_PLANE_ID:'m12-plane',
    KIVRO_CONTROL_PLANE_STATE:'ACTIVE',KIVRO_LEASE_KEY_VERSION:'v1',
    KIVRO_LEASE_KEY_BASE64:Buffer.alloc(32,7).toString('base64')});
  const signed=(body,forged=false)=>{
    const fields={workerDeviceId:worker,controlPlaneId:'m12-plane',messageId:randomUUID(),
      signedAt:new Date().toISOString(),bodyHash:workerMessageHash(body)};
    return new globalThis.Request('http://127.0.0.1:9876/worker/poll',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({body,envelope:{...fields,
        signature:forged?Buffer.alloc(64).toString('base64url'):
          sign(null,workerSignatureBytes(fields),privateKey).toString('base64url')}})});
  };
  try{
    await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
      VALUES($1,$2,'ACTIVE',now())`,[sellerAccount,`${sellerAccount}@example.test`]);
    await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
      VALUES($1,$2,'Route seller','ACTIVE','NOT_STARTED')`,[sellerProfile,sellerAccount]);
    await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
      worker_version,status) VALUES($1,$2,$3,'Route Worker','LINUX','0.0.0-dev','OFFLINE')`,
    [worker,sellerProfile,publicKey.export({type:'spki',format:'pem'}).toString()]);
    const operations=new PostgresSellerOperations(pool,new PostgresAvailabilityRepository(pool,
      new PostgresFinanceRepository(pool,'test')),new PostgresFinanceRepository(pool,'test'));
    await operations.setWorkerPause(sellerAccount,worker,true,null);
    const hello={type:'WORKER_HELLO',messageId:randomUUID(),controlPlaneId:'m12-plane',
      workerDeviceId:worker,supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],
      workerRelease:'0.0.0-dev',localRevision:0,activeExecutionIds:[]};
    assert.equal((await handleWorkerPoll(signed(hello,true))).status,403);
    const response=await handleWorkerPoll(signed(hello));
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(payload.messages[0].pauseDirective.paused,true);
    assert.equal(payload.messages.some((item)=>item.type==='JOB_OFFER'),false);
    const heartbeat={type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
      messageId:randomUUID(),controlPlaneId:'m12-plane',workerDeviceId:worker,
      workerRelease:'0.0.0-dev',sentAt:new Date().toISOString(),openClawVersion:null,
      status:'PAUSED',runningJobs:0,capacity:1,policyVersion:1,localRevision:0,
      acknowledgedCloudRevision:payload.messages[0].pauseDirective.revision,
      localPause:{globalPaused:false,securityPaused:false,capabilityPauses:[]},
      capabilityReadiness:[]};
    const report=await handleWorkerMessage(signed(heartbeat));
    assert.equal(report.status,204);
    const ack=await pool.query(`SELECT acknowledged_revision FROM worker_cloud_control_revisions
      WHERE worker_device_id=$1`,[worker]);
    assert.equal(Number(ack.rows[0].acknowledged_revision),1);
    const directory=mkdtempSync(join(tmpdir(),'kivro-m12-sync-'));
    const local=new WorkerLocalState(directory,{async check(){return {ready:false,
      checkedAt:new Date().toISOString(),blockingReasons:['CONTROL_ONLY_MODE']};}});
    try{
      local.pauseAll('local:test','LOCAL_CLI','offline emergency');
      const transport=new HttpsPollingWorkerTransport('m12-plane','https://kivro.example.invalid/',
        {deviceId:worker,signChallenge:(bytes)=>sign(null,bytes,privateKey)},
        {fetcher:async(request,init)=>{
          const sent=new globalThis.Request(request,init);
          return sent.url.endsWith('/worker/messages')?handleWorkerMessage(sent):
            sent.url.endsWith('/worker/poll')?handleWorkerPoll(sent):
              globalThis.Response.json({code:'NOT_FOUND'},{status:404});
        }});
      const sync=new WorkerControlSync(transport,worker,local,async()=>({runningJobs:0,
        checks:[{code:'DOCKER_DAEMON',state:'HEALTHY'},
          {code:'APPROVED_SANDBOX_IMAGE',state:'HEALTHY'}]}),'0.0.0-dev');
      await sync.syncOnce();
      assert.equal(local.snapshot().cloudPaused,true);
      assert.equal(local.snapshot().cloudSyncPending,false);
      assert.equal((await pool.query(`SELECT global_paused FROM worker_local_pause_reports
        WHERE worker_device_id=$1`,[worker])).rows[0].global_paused,true);
      await sync.syncOnce();
      assert.equal(Number((await pool.query(`SELECT acknowledged_revision FROM
        worker_cloud_control_revisions WHERE worker_device_id=$1`,[worker]))
        .rows[0].acknowledged_revision),1);
    }finally{local.close();rmSync(directory,{recursive:true,force:true});}
  }finally{await pool.end();}
});

if(process.env.M12_DATABASE_URL)test('overdue paid pause terminates only after lease expiry and releases exactly once',async()=>{
  const pool=new pg.Pool({connectionString:process.env.M12_DATABASE_URL});
  const buyer=randomUUID(),sellerAccount=randomUUID(),seller=randomUUID(),worker=randomUUID();
  const cap=randomUUID(),version=randomUUID(),job=randomUUID(),activeJob=randomUUID();
  let releases=0;
  const repo=new PostgresJobExecutionRepository(pool,{
    async isSecured(){return true;},
    async releaseFailedJobInTransaction(){releases++;}
  },new HmacLeaseTokenIssuer({v1:Buffer.alloc(32,3)},'v1'),
  {async assertEligible(){}});
  try{
    await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
      VALUES($1,$3,'ACTIVE',now()),($2,$4,'ACTIVE',now())`,
    [buyer,sellerAccount,`${buyer}@example.test`,`${sellerAccount}@example.test`]);
    await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
      VALUES($1,$2,'Pause Seller','ACTIVE','NOT_STARTED')`,[seller,sellerAccount]);
    await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
      worker_version,status) VALUES($1,$2,$3,'Pause Worker','LINUX','0.0.0-dev','OFFLINE')`,
    [worker,seller,`fixture-key-${worker}`]);
    await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
      VALUES($1,$2,$3,'Pause service','PUBLISHED')`,[cap,seller,`m12-${cap}`]);
    await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
      publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
      VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,[version,cap,
      {workerDeviceId:worker},`sha256:${'a'.repeat(64)}`,`sha256:${'b'.repeat(64)}`]);
    await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',[cap,version]);
    await pool.query(`INSERT INTO capability_availability_policies(capability_id,
      concurrency_limit,queue_limit,future_reservation_limit,max_wait_seconds)
      VALUES($1,1,1,1,3600)`,[cap]);
    const operations=new PostgresSellerOperations(pool,new PostgresAvailabilityRepository(pool,
      new PostgresFinanceRepository(pool,'test')),new PostgresFinanceRepository(pool,'test'));
    await assert.rejects(operations.setCapabilityPause(buyer,cap,true,null),
      {code:'NOT_ELIGIBLE'});
    await operations.setCapabilityPause(sellerAccount,cap,true,null);
    assert.deepEqual((await operations.cloudDirective(worker)).capabilityPauses,[cap]);
    await assert.rejects(operations.setCapabilityPause(sellerAccount,cap,false,null),
      {code:'NOT_READY'});
    for(const id of [job,activeJob]){
      const attempt=randomUUID(),execution=randomUUID();
      await pool.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,
        worker_device_id,status,contract_snapshot,payment_reservation_id)
        VALUES($1,$2,$3,$4,'PAUSED','{}',$5)`,
      [id,buyer,version,worker,randomUUID()]);
      await pool.query(`INSERT INTO job_executions(id,job_id,attempt_id,worker_device_id,
        control_plane_id,lease_key_version,lease_token_hash,lease_expires_at,
        offer_expires_at,accepted_at,created_at)
        VALUES($1,$2,$3,$4,'m12-plane','v1',$5,$6,$7,now()-interval '6 hours',
          now()-interval '6 hours')`,[execution,id,attempt,worker,
        `sha256:${'c'.repeat(64)}`,id===job?new Date(Date.now()-5*3600_000):
          new Date(Date.now()+3600_000),new Date(Date.now()+3600_000)]);
      await pool.query(`INSERT INTO job_transitions(id,job_id,sequence,from_status,
        to_status,at,actor,reason,attempt_id,correlation_id)
        VALUES($1,$2,1,'PAUSE_REQUESTED','PAUSED',now()-interval '5 hours',
          'WORKER','WORKER_PAUSED',$3,$4)`,[randomUUID(),id,attempt,execution]);
    }
    assert.equal(await repo.expireOverduePausedJobs(14400),1);
    assert.equal((await repo.load(job)).status,'TIMED_OUT');
    assert.equal((await repo.load(activeJob)).status,'PAUSED');
    assert.equal(releases,1);
    assert.equal(await repo.expireOverduePausedJobs(14400),0);
    assert.equal(releases,1);
    const terminal=await pool.query('SELECT completed_at FROM jobs WHERE id=$1',[job]);
    assert.ok(terminal.rows[0].completed_at);
    const execution=(await pool.query(`SELECT id,attempt_id
      FROM job_executions WHERE job_id=$1`,[activeJob])).rows[0];
    assert.ok(execution);
    const localReport={type:'LOCAL_JOB_CONTROL_REPORT',protocolVersion:WORKER_PROTOCOL_VERSION,
      messageId:randomUUID(),commandId:randomUUID(),jobId:activeJob,
      executionId:execution.id,attemptId:execution.attempt_id,
      controlPlaneId:'m12-plane',workerDeviceId:worker,action:'CANCEL',source:'CLI',
      actorId:'local:1000',reason:'Seller emergency stop',status:'CANCELLED',
      localRevision:3,confirmedAt:new Date().toISOString()};
    const secondReport={...localReport,messageId:randomUUID(),commandId:randomUUID(),
      localRevision:4};
    await Promise.all([repo.reconcileLocalJobControl(localReport,worker,'m12-plane'),
      repo.reconcileLocalJobControl(secondReport,worker,'m12-plane')]);
    assert.equal((await repo.load(activeJob)).status,'CANCELLED');
    assert.equal(releases,2);
    const dispositions=await pool.query(`SELECT disposition FROM worker_local_job_control_reports
      WHERE job_id=$1`,[activeJob]);
    assert.deepEqual(dispositions.rows.map((row)=>row.disposition).sort(),['APPLIED','STALE']);
    await repo.reconcileLocalJobControl({...localReport,messageId:randomUUID()},worker,'m12-plane');
    assert.equal(releases,2,'lost acknowledgement cannot release twice');
    await assert.rejects(repo.reconcileLocalJobControl({...localReport,
      messageId:randomUUID(),commandId:randomUUID()},randomUUID(),'m12-plane'),
    {code:'WRONG_WORKER'});
    await assert.rejects(repo.reconcileLocalJobControl({...localReport,
      messageId:randomUUID(),commandId:randomUUID(),status:'RUNNING'},worker,'m12-plane'),
    {code:'NOT_ELIGIBLE'});
    await assert.rejects(repo.reconcileLocalJobControl({...localReport,
      messageId:randomUUID(),reason:'altered'},worker,'m12-plane'),{code:'CONFLICT'});
  }finally{await pool.end();}
});
