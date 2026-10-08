import { healthyWorkerChecks } from './fixtures/healthy-worker-checks.mjs';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash,randomUUID } from 'node:crypto';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import test from 'node:test';
import pg from 'pg';
import { BuyerApiKeyRepository } from '../dist/packages/persistence/src/buyer-api-keys.js';
import { BuyerWebhookRepository } from '../dist/packages/persistence/src/buyer-webhooks.js';
import { verifyWebhookSignature } from '../dist/packages/application/src/webhook-policy.js';
import { buildVersionCandidate } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from
  '../dist/packages/contracts/src/capability-version.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { createSellerProfile } from '../dist/packages/persistence/src/seller-profiles.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { PostgresAvailabilityMetrics } from
  '../dist/packages/persistence/src/availability-metrics.js';
import { PostgresWorkerHeartbeatRepository } from
  '../dist/packages/persistence/src/worker-heartbeat.js';
import { MarketplaceBuyerRepository } from
  '../dist/packages/persistence/src/marketplace-buyer.js';
import { PostgresJobExecutionRepository } from
  '../dist/packages/persistence/src/job-execution.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';
import { workerMessageHash,workerSignatureBytes } from '../dist/packages/worker-protocol/src/auth.js';
import { handleBuyerV1 } from '../dist/apps/web/src/buyer-api/handler.js';
import { handleWorkerJobRpc } from '../dist/apps/web/src/worker/control-handler.js';
import {startWorkerWebSocketServer} from
  '../dist/apps/web/src/worker/websocket-server.js';
import {WebSocketWorkerTransport} from
  '../dist/packages/infrastructure/adapters/src/websocket-worker.js';
import {EncryptedDeviceIdentityStore} from
  '../dist/apps/worker/src/device-identity.js';
import {rememberPairedSeller} from '../dist/apps/worker/src/paired-seller.js';
import { runM16CoreWorkerSlice } from './m16-core-worker-integration.mjs';

if(!process.env.M13_DATABASE_URL){
  test('M13 requires disposable PostgreSQL',{skip:true},()=>{});
}else test('M13 buyer API keys, idempotency, outbox and webhook delivery survive adversarial replay',
  async()=>{
    const pool=new pg.Pool({connectionString:process.env.M13_DATABASE_URL,max:20});
    const buyer=randomUUID(),other=randomUUID();
    const keys=new BuyerApiKeyRepository(pool,'test');
    const dns={async lookupAll(host){return host==='hooks.example.com'?['8.8.8.8']:['10.0.0.1'];}};
    const encryptionKey=Buffer.alloc(32,13).toString('hex');
    const hooks=new BuyerWebhookRepository(pool,dns,encryptionKey);
    try{
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$3,'ACTIVE',now()),($2,$4,'ACTIVE',now())`,
      [buyer,other,`${buyer}@example.test`,`${other}@example.test`]);
      const unverified=randomUUID();
      await pool.query(`INSERT INTO accounts(id,primary_email,status)
        VALUES($1,$2,'ACTIVE')`,[unverified,`${unverified}@example.test`]);
      await assert.rejects(keys.create(unverified,{name:'blocked-unverified',
        scopes:['jobs:create','assets:create']}),{code:'FORBIDDEN'});
      await assert.rejects(createSellerProfile(pool,unverified,
        'Unverified seller',true),{code:'ACCOUNT_NOT_ELIGIBLE'});
      const financial=new PostgresFinanceRepository(pool,'test');
      const blockedPurchase=randomUUID();
      await assert.rejects(financial.beginCreditPurchase({purchaseId:blockedPurchase,
        buyerId:unverified,amountMinor:999}),{code:'NOT_ELIGIBLE'});
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM credit_purchases
        WHERE id=$1`,[blockedPurchase])).rows[0].n,0,
      'unverified identity cannot produce a billable credit purchase');
      await pool.query(`UPDATE accounts SET email_verified_at=now(),auth_email_verified=true
        WHERE id=$1`,[unverified]);
      const verifiedKey=await keys.create(unverified,{name:'verified-after-email',
        scopes:['jobs:create']});
      assert.match(verifiedKey.secret,/^kv_test_/);
      const eligibleSeller=await createSellerProfile(pool,unverified,'Verified seller',true);
      await pool.query(`UPDATE accounts SET email_verified_at=NULL,
        auth_email_verified=false WHERE id=$1`,[unverified]);
      await assert.rejects(keys.authenticate(verifiedKey.secret,'jobs:create','jobs:create'),
        {code:'FORBIDDEN'},'an existing API key cannot bypass later identity unverification');
      await assert.rejects(financial.beginSellerConnect(eligibleSeller.id,
        unverified,'US'),{code:'NOT_ELIGIBLE'},
      'a seller cannot start payout onboarding after losing email verification');
      await pool.query(`UPDATE accounts SET email_verified_at=now(),
        auth_email_verified=true WHERE id=$1`,[unverified]);
      const created=await keys.create(buyer,{name:'automation',
        scopes:['capabilities:read','jobs:create','jobs:read']});
      assert.match(created.secret,/^kv_test_[a-f0-9]{12}_[A-Za-z0-9_-]{43}$/);
      assert.equal(JSON.stringify(await keys.list(buyer)).includes(created.secret),false);
      assert.equal((await pool.query('SELECT secret_hash FROM buyer_api_keys WHERE id=$1',
        [created.id])).rows[0].secret_hash,
      createHash('sha256').update(created.secret).digest('hex'));
      assert.equal((await keys.authenticate(created.secret,'jobs:create','jobs:create')).accountId,
        buyer);
      await assert.rejects(keys.authenticate(created.secret,'assets:read','assets:read'),
        {code:'FORBIDDEN'});
      await assert.rejects(new BuyerApiKeyRepository(pool,'live').authenticate(created.secret,
        'jobs:create','jobs:create'),{code:'UNAUTHENTICATED'});
      await assert.rejects(keys.authenticate(`kv_test_${created.secret.split('_')[2]}_${
        'A'.repeat(43)}`,'jobs:create','jobs:create'),{code:'UNAUTHENTICATED'});
      const expiring=await keys.create(buyer,{name:'expiring',scopes:['jobs:read'],
        expiresAt:new Date(Date.now()+60_000).toISOString()});
      await pool.query(`UPDATE buyer_api_keys SET created_at=now()-interval '2 days',
        expires_at=now()-interval '1 second'
        WHERE id=$1`,[expiring.id]);
      await assert.rejects(keys.authenticate(expiring.secret,'jobs:read','jobs:read'),
        {code:'UNAUTHENTICATED'});
      const renewed=await keys.rotate(buyer,expiring.id);
      assert.equal((await keys.authenticate(renewed.secret,'jobs:read','jobs:read')).keyId,
        renewed.id);
      const rotated=await keys.rotate(buyer,created.id);
      await assert.rejects(keys.authenticate(created.secret,'jobs:create','jobs:create'),
        {code:'UNAUTHENTICATED'});
      assert.equal((await keys.authenticate(rotated.secret,'jobs:create','jobs:create')).keyId,
        rotated.id);
      await keys.revoke(buyer,rotated.id);await keys.revoke(buyer,rotated.id);
      await assert.rejects(keys.authenticate(rotated.secret,'jobs:create','jobs:create'),
        {code:'UNAUTHENTICATED'});
      assert.ok((await pool.query(`SELECT count(*)::int AS n FROM buyer_api_key_audit
        WHERE key_id=$1 AND action='REVOKED'`,[rotated.id])).rows[0].n===1);
      await assert.rejects(pool.query(`UPDATE buyer_api_key_audit SET action='CREATED'
        WHERE key_id=$1`,[rotated.id]),/append-only/i);

      const active=await keys.create(buyer,{name:'concurrent',scopes:['jobs:create']});
      const fingerprint='a'.repeat(64),args={accountId:buyer,keyId:active.id,
        endpoint:'capabilities/abc/jobs',idempotencyKey:'order-12345',fingerprint};
      const claims=await Promise.allSettled(Array.from({length:12},()=>keys.claimJob(args)));
      assert.equal(claims.filter((item)=>item.status==='fulfilled').length,1);
      assert.equal(claims.filter((item)=>item.status==='rejected'&&
        item.reason.code==='IN_PROGRESS').length,11);
      const claim=claims.find((item)=>item.status==='fulfilled').value;
      await assert.rejects(keys.claimJob({...args,fingerprint:'b'.repeat(64)}),
        {code:'CONFLICT'});
      await assert.rejects(keys.claimJob({...args,endpoint:'capabilities/alias/jobs'}),
        {code:'CONFLICT'});
      const response={httpStatus:201,body:{jobId:claim.jobId}};
      await keys.completeJob({...args,token:claim.token,response});
      assert.deepEqual((await keys.claimJob(args)).response,response);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM buyer_api_idempotency
        WHERE account_id=$1`,[buyer])).rows[0].n,1);
      const abandoned=await keys.claimJob({...args,idempotencyKey:'order-abandoned'});
      await pool.query(`UPDATE buyer_api_idempotency SET lease_until=now()-interval '1 second'
        WHERE account_id=$1 AND idempotency_key='order-abandoned'`,[buyer]);
      const recovered=await keys.claimJob({...args,idempotencyKey:'order-abandoned'});
      assert.equal(recovered.jobId,abandoned.jobId);
      assert.equal(recovered.reservationId,abandoned.reservationId);
      await keys.completeJob({...args,idempotencyKey:'order-abandoned',token:recovered.token,
        response:{httpStatus:402,body:{code:'INSUFFICIENT_FUNDS'}}});
      assert.equal((await keys.claimJob({...args,idempotencyKey:'order-abandoned'}))
        .response.httpStatus,402);
      for(let n=0;n<12;n++)await keys.authenticate(active.secret,'jobs:create','jobs:create');
      await assert.rejects(keys.authenticate(active.secret,'jobs:create','jobs:create'),
        {code:'RATE_LIMITED'});
      assert.equal((await pool.query(`SELECT count FROM buyer_api_rate_windows
        WHERE subject_kind='KEY' AND subject_id=$1 AND endpoint='jobs:create'`,[active.id]))
        .rows[0].count,12,'rejected rate increment rolls back');
      const currentAccountCount=(await pool.query(`SELECT count FROM buyer_api_rate_windows
        WHERE subject_kind='ACCOUNT' AND subject_id=$1 AND endpoint='jobs:create'`,
      [buyer])).rows[0].count;
      const accountKeys=await Promise.all([0,1].map((n)=>keys.create(buyer,
        {name:`account-rate-${n}`,scopes:['jobs:create']})));
      for(let n=currentAccountCount;n<30;n++)await keys.authenticate(
        accountKeys[Math.floor((n-currentAccountCount)/12)].secret,'jobs:create','jobs:create');
      const overflowKey=await keys.create(buyer,{name:'account-overflow',
        scopes:['jobs:create','capabilities:read']});
      await assert.rejects(keys.authenticate(overflowKey.secret,'jobs:create','jobs:create'),
        {code:'RATE_LIMITED'});
      assert.equal((await pool.query(`SELECT count FROM buyer_api_rate_windows WHERE
        subject_kind='ACCOUNT' AND subject_id=$1 AND endpoint='jobs:create'`,
      [buyer])).rows[0].count,30,'account ceiling is shared across keys');
      assert.equal((await keys.authenticate(overflowKey.secret,'capabilities:read',
        'capabilities:read')).accountId,buyer,'endpoint ceilings are independent');

      await assert.rejects(hooks.create(buyer,{url:'https://metadata.internal/secret',
        events:['job.completed']}),{code:'INVALID_DESTINATION'});
      await assert.rejects(hooks.create(buyer,{url:'https://hooks.example.com/hook',
        events:['job.completed','job.completed']}));
      const endpoint=await hooks.create(buyer,{url:'https://hooks.example.com/hook',
        events:['job.completed','job.failed']});
      assert.match(endpoint.secret,/^whsec_/);
      assert.equal(JSON.stringify(await hooks.list(buyer)).includes(endpoint.secret),false);
      assert.equal((await pool.query(`SELECT secret_ciphertext FROM buyer_webhook_endpoints
        WHERE id=$1`,[endpoint.id])).rows[0].secret_ciphertext.includes(endpoint.secret),false);
      await assert.rejects(hooks.deliveries(other,endpoint.id),{code:'NOT_FOUND'});
      await assert.rejects(hooks.update(other,endpoint.id,{enabled:false}),{code:'NOT_FOUND'});
      const ping=await hooks.sendTest(buyer,endpoint.id);
      const crashedClaim=await hooks.claim();
      assert.equal(crashedClaim.event_id,ping.eventId.slice(4));
      assert.equal((await hooks.deliveries(buyer,endpoint.id))[0].attemptCount,0,
        'leasing before an HTTP attempt must not consume retry budget');
      await pool.query(`UPDATE buyer_webhook_deliveries
        SET leased_until=now()-interval '1 second' WHERE id=$1`,[crashedClaim.id]);
      const sent=[];let fail=true;
      const transport={async post(input){
        sent.push(input);
        assert.equal(input.pinnedAddress,'8.8.8.8');
        return {status:fail?503:204};
      }};
      assert.equal(await hooks.deliverDue(transport),1);
      const delivery=(await hooks.deliveries(buyer,endpoint.id))[0];
      assert.equal(delivery.state,'PENDING');assert.equal(delivery.attemptCount,1);
      assert.equal(delivery.lastHttpStatus,503);
      assert.equal(JSON.stringify(delivery).includes(endpoint.secret),false);
      assert.equal(verifyWebhookSignature(endpoint.secret,
        sent[0].headers['Marketplace-Timestamp'],sent[0].body,
        sent[0].headers['Marketplace-Signature'],ping.eventId,new Set()),true);
      assert.equal(JSON.parse(sent[0].body).id,ping.eventId);
      fail=false;
      await pool.query(`UPDATE buyer_webhook_deliveries SET next_attempt_at=now()-interval '1 second'
        WHERE event_id=$1`,[ping.eventId.slice(4)]);
      const restarted=new BuyerWebhookRepository(pool,dns,encryptionKey);
      assert.equal(await restarted.deliverDue(transport),1);
      assert.equal((await hooks.deliveries(buyer,endpoint.id))[0].state,'DELIVERED');
      assert.equal(JSON.parse(sent[0].body).id,JSON.parse(sent[1].body).id,
        'retry retains immutable event ID');
      assert.equal(await hooks.deliverDue(transport),0);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM buyer_webhook_attempts
        WHERE delivery_id=$1`,[delivery.id])).rows[0].n,2);
      const lostAck=await hooks.sendTest(buyer,endpoint.id);
      const sentWithoutAck=await hooks.claim();
      assert.equal(`evt_${sentWithoutAck.event_id}`,lostAck.eventId);
      await pool.query(`UPDATE buyer_webhook_deliveries
        SET leased_until=now()-interval '1 second' WHERE id=$1`,[sentWithoutAck.id]);
      assert.equal(await restarted.deliverDue(transport),1,
        'a process crash after remote receipt but before local acknowledgement replays the event');
      assert.equal(JSON.parse(sent.at(-1).body).id,lostAck.eventId);
      await assert.rejects(pool.query(`DELETE FROM buyer_webhook_attempts WHERE delivery_id=$1`,
        [delivery.id]),/append-only/i);
      await hooks.update(buyer,endpoint.id,{enabled:false});
      await assert.rejects(hooks.sendTest(buyer,endpoint.id),{code:'NOT_ELIGIBLE'});
      assert.equal((await hooks.list(buyer))[0].status,'DISABLED');
      const newSecret=await hooks.rotateSecret(buyer,endpoint.id);
      assert.notEqual(newSecret.secret,endpoint.secret);
      await hooks.update(buyer,endpoint.id,{enabled:true});
      const doomed=await hooks.sendTest(buyer,endpoint.id);
      const redirect={async post(){return {status:302};}};
      for(let attempt=1;attempt<=7;attempt++){
        assert.equal(await restarted.deliverDue(redirect),1);
        const current=(await hooks.deliveries(buyer,endpoint.id)).find((item)=>
          item.eventId===doomed.eventId);
        assert.equal(current.attemptCount,attempt);
        assert.equal(current.lastErrorCode,'REDIRECT_DENIED');
        if(attempt<7)await pool.query(`UPDATE buyer_webhook_deliveries
          SET next_attempt_at=now()-interval '1 second' WHERE event_id=$1`,
        [doomed.eventId.slice(4)]);
      }
      assert.equal((await hooks.deliveries(buyer,endpoint.id)).find((item)=>
        item.eventId===doomed.eventId).state,'EXHAUSTED');
      assert.equal((await hooks.list(buyer))[0].status,'DISABLED');
      assert.equal(await restarted.deliverDue(redirect),0);
      const rebinding=await hooks.create(buyer,{url:'https://hooks.example.com/rebind',
        events:['job.completed']});
      await hooks.sendTest(buyer,rebinding.id);
      const hostile=new BuyerWebhookRepository(pool,{async lookupAll(){return ['8.8.8.8',
        '169.254.169.254'];}},encryptionKey);
      let outbound=0;
      assert.equal(await hostile.deliverDue({async post(){outbound++;return {status:200};}}),1);
      assert.equal(outbound,0,'mixed public/private DNS answer fails before an outbound request');
      assert.equal((await hostile.deliveries(buyer,rebinding.id))[0].lastErrorCode,
        'DESTINATION_DENIED');
      for(let n=0;n<8;n++)await hooks.create(buyer,{url:`https://hooks.example.com/hook-${n}`,
        events:['job.completed']});
      await assert.rejects(hooks.create(buyer,{url:'https://hooks.example.com/eleventh',
        events:['job.completed']}),{code:'CONFLICT'});
      await hooks.remove(buyer,rebinding.id);
      assert.equal((await hooks.list(buyer)).some((item)=>item.id===rebinding.id),false);
      await assert.rejects(hooks.update(buyer,rebinding.id,{enabled:true}),{code:'NOT_FOUND'});
      await hooks.create(buyer,{url:'https://hooks.example.com/replacement',
        events:['job.completed']});
    }finally{await pool.end();}
  });

if(process.env.M13_DATABASE_URL)test('M13 REST buyer jobs share Core payment and availability authorities',
  async()=>{
    const pool=new pg.Pool({connectionString:process.env.M13_DATABASE_URL,max:12});
    const buyer=randomUUID(),other=randomUUID(),sellerAccount=randomUUID(),seller=randomUUID();
    const capability=randomUUID(),versionId=randomUUID();
    const workerRoot=mkdtempSync(join(tmpdir(),'kivro-m16-worker-'));
    const workerStateDir=join(workerRoot,'state');mkdirSync(workerStateDir,{mode:0o700});
    const workerPassphrase=`m16-${randomUUID()}-${randomUUID()}`;
    const workerPassphrasePath=join(workerRoot,'passphrase');
    writeFileSync(workerPassphrasePath,workerPassphrase,{mode:0o600});
    const identity=new EncryptedDeviceIdentityStore(workerStateDir)
      .create(workerPassphrase);
    const worker=identity.deviceId;
    const deviceSigner=await new EncryptedDeviceIdentityStore(workerStateDir)
      .unlock(workerPassphrase);
    const hash=`sha256:${'a'.repeat(64)}`,plane='m13-test-plane';
    // This M13 API regression exercises the scanner port with a local clamd
    // protocol fixture. M15 malware-detection and live-service gates are
    // separately tested; this fixture is not their acceptance evidence.
    let scannerMode='CLEAN';
    const scannerServer=createServer((socket)=>{
      let received=Buffer.alloc(0);
      socket.on('data',(part)=>{
        received=Buffer.concat([received,part]);
        if(received.subarray(0,10).toString('binary')!=='zINSTREAM\0')return;
        let offset=10;
        while(offset+4<=received.length){
          const length=received.readUInt32BE(offset);offset+=4;
          if(length===0){
            if(scannerMode==='UNAVAILABLE')socket.destroy();
            else socket.end(scannerMode==='INFECTED'?
              'stream: Eicar-Test-Signature FOUND\0':'stream: OK\0');
            return;
          }
          if(offset+length>received.length)return;
          offset+=length;
        }
      });
    });
    await new Promise((resolve,reject)=>{scannerServer.once('error',reject);
      scannerServer.listen(0,'127.0.0.1',resolve);});
    const scannerAddress=scannerServer.address();
    if(!scannerAddress||typeof scannerAddress==='string')throw new Error('SCANNER_FIXTURE');
    Object.assign(process.env,{DATABASE_URL:process.env.M13_DATABASE_URL,
      APP_ORIGIN:'http://127.0.0.1:9876',
      BETTER_AUTH_SECRET:'m13-test-auth-secret-at-least-32-characters',
      AUTH_OUTBOX_KEY_BASE64:Buffer.alloc(32,2).toString('base64'),
      KIVRO_STRIPE_MODE:'test',KIVRO_LEASE_KEY_VERSION:'v1',
      KIVRO_CONTROL_PLANE_ID:plane,KIVRO_CONTROL_PLANE_STATE:'ACTIVE',
      KIVRO_LEASE_KEY_BASE64:Buffer.alloc(32,17).toString('base64'),
      KIVRO_CLAMAV_SOCKET:process.env.KIVRO_M16_LIVE_CLAMAV_SOCKET??
        `tcp://127.0.0.1:${scannerAddress.port}`,
      KIVRO_WEBHOOK_ENCRYPTION_KEY:Buffer.alloc(32,13).toString('hex'),
      OBJECT_STORAGE_BUCKET:process.env.OBJECT_STORAGE_BUCKET,
      OBJECT_STORAGE_REGION:process.env.OBJECT_STORAGE_REGION,
      OBJECT_STORAGE_ENDPOINT:process.env.OBJECT_STORAGE_ENDPOINT,
      OBJECT_STORAGE_ACCESS_KEY_ID:process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
      OBJECT_STORAGE_SECRET_ACCESS_KEY:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY});
    const finance=new PostgresFinanceRepository(pool,'test');
    const availability=new PostgresAvailabilityRepository(pool,finance);
    const availabilityMetrics=new PostgresAvailabilityMetrics(pool,availability);
    const execution=new PostgresJobExecutionRepository(pool,finance,
      new HmacLeaseTokenIssuer({v1:Buffer.alloc(32,17)},'v1'),availability);
    const buyerRepo=new MarketplaceBuyerRepository(pool,availability,finance,execution);
    let m16WssServer=null,m16WssTransport=null;
    try{
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$4,'ACTIVE',now()),($2,$5,'ACTIVE',now()),($3,$6,'ACTIVE',now())`,
      [buyer,other,sellerAccount,`${buyer}@example.test`,`${other}@example.test`,
        `${sellerAccount}@example.test`]);
      await buyerRepo.acceptTerms(buyer,randomUUID());
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
        VALUES($1,$2,'M13 Seller','ACTIVE','READY')`,[seller,sellerAccount]);
      await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_account_id,
        stripe_mode,onboarding_status,transfers_enabled,payouts_enabled,country,last_reconciled_at)
        VALUES($1,'acct_M13TEST','test','READY',true,true,'US',now())`,[seller]);
      await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
        worker_version,status) VALUES($1,$2,$3,'M13 Worker','LINUX','test','ONLINE')`,
      [worker,seller,identity.publicKeyPem]);
      rememberPairedSeller(workerStateDir,{deviceId:worker,
        sellerAccountId:sellerAccount,sellerProfileId:seller});
      const slug=`m13-${capability}`;
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
        VALUES($1,$2,$3,'Research brief','A focused research brief','PUBLISHED')`,
      [capability,seller,slug]);
      const localPackage={packageVersion:1,capabilityId:capability,capabilityVersionId:versionId,
        workerDeviceId:worker,workerManifest:{manifestVersion:1,workerId:randomUUID(),
          capabilityVersionId:versionId,runtime:{type:'openclaw',
            supportedVersionRange:'>=2026.8.2 <2026.9.0'},
          skills:[],tools:{allow:[],deny:['browser','exec','gateway']},resources:[],
          network:{default:'deny',allow:[]},limits:{timeoutSeconds:120,memoryMb:128,cpu:1,
            maxPids:32,maxInputBytes:1000,maxOutputBytes:1000}},
        dependencyGraph:{graphVersion:1,rootId:'skill',inference:null,alternatives:[],nodes:[
          {id:'skill',type:'SKILL',name:'Skill',requirement:'REQUIRED',sensitivity:'LOW',
            discoveredFrom:['SKILL_METADATA'],dependsOn:[],marketplaceSupport:'UNDETERMINED',
            confidence:'CONFIRMED',selected:false,health:'UNKNOWN'}]},
        permissionPolicy:{policyVersion:1,aiInference:'NONE',publicInternet:'DENY',browser:false,
          proprietaryDatabase:'NONE',privateApi:'NONE',selectedFileResourceIds:[],
          selectedDirectoryResourceIds:[],localSoftware:false,shell:false,
          externalSideEffects:false,buyerFileAccess:false,sellerCredentialRefs:[]},
        sellerInferenceConfigHash:null,ioContract:{contractVersion:1,
          input:{schemaVersion:1,fields:[{key:'question',label:'Question',order:0,
            group:'PROJECT',required:true,type:'SHORT_TEXT'},
            {key:'supportingFile',label:'Supporting file',order:1,group:'SOURCE',
              required:false,type:'FILE',constraints:{minFiles:0,maxFiles:1,
                maxFileSizeBytes:1000,maxTotalSizeBytes:1000,
                allowedMimeTypes:['text/plain'],allowedExtensions:['.txt']}}]},
          output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
            required:true,type:'LONG_TEXT'},
            {key:'report',label:'Report',order:1,required:false,type:'FILE',
              constraints:{minFiles:0,maxFiles:1,maxFileSizeBytes:1000,
                maxTotalSizeBytes:1000,allowedMimeTypes:['text/plain'],
                allowedExtensions:['.txt']}}]}},priceTier:'USD_999',dependencySnapshot:[],
        concurrencyLimit:1,exampleRefs:[],testRefs:[],pauseSupport:'NOT_SUPPORTED'};
      const candidate=buildVersionCandidate({id:versionId,capabilityId:capability,
        versionNumber:1,workerDeviceId:worker,requestedAt:new Date().toISOString(),localPackage,
        selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_999')});
      const fields={...candidate};delete fields.requestedAt;
      const published=PublishedCapabilityVersionSchema.parse({...fields,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:hash});
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [versionId,capability,published,published.workerManifestHash,hash]);
      await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC' WHERE id=$1`,
        [capability,versionId]);
      await availability.setWorkerDefault({workerDeviceId:worker,sellerAccountId:sellerAccount,
        schedule:{mode:'ALWAYS_AVAILABLE',timezone:'UTC',weeklyWindows:[]},paused:false,
        source:'WEB',expectedRevision:null});
      let policyRevision=await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:{schedule:null,concurrencyLimit:1,
          queueLimit:2,futureReservationLimit:2,estimatedRuntimeSeconds:60,
          maxWaitSeconds:604800},paused:false,source:'WEB',expectedRevision:null});
      const heartbeat=new PostgresWorkerHeartbeatRepository(pool);
      await heartbeat.observe({type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',sentAt:new Date().toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,capabilityReadiness:[{capabilityVersionId:versionId,
          policyValidationHash:hash,state:'READY',checks:{sandboxVerified:true,
            requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
      const ackCloud=async()=>{
        const revision=(await pool.query(`SELECT revision
          FROM worker_cloud_control_revisions WHERE worker_device_id=$1`,[worker])).rows[0];
        const prior=(await pool.query(`SELECT latest_heartbeat_reported_at AS at
          FROM worker_devices WHERE id=$1`,[worker])).rows[0].at;
        await heartbeat.observe({type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,
          protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
          workerDeviceId:worker,workerRelease:'test',
          sentAt:new Date(Math.max(Date.now(),prior.getTime()+1000)).toISOString(),
          openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
          localRevision:0,acknowledgedCloudRevision:Number(revision?.revision??0),
          capabilityReadiness:[{capabilityVersionId:versionId,policyValidationHash:hash,
            state:'READY',checks:{sandboxVerified:true,requiredSecretsReady:true,
              runtimeHealthy:true}}]},worker,plane);
      };
      const healthEventCount=async()=>(await pool.query(`SELECT count(*)::int AS n
        FROM worker_operational_events WHERE worker_device_id=$1 AND
        capability_id=$2 AND kind='HEALTH_CHANGED'`,[worker,capability])).rows[0].n;
      const initialHealthEvents=await healthEventCount();
      await ackCloud();
      assert.equal(await healthEventCount(),initialHealthEvents,
        'unchanged healthy heartbeats cannot create false health-history transitions');
      const reportedAt=(await pool.query(`SELECT latest_heartbeat_reported_at AS at
        FROM worker_devices WHERE id=$1`,[worker])).rows[0].at;
      await heartbeat.observe({type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',
        sentAt:new Date(reportedAt.getTime()+1000).toISOString(),openClawVersion:null,
        status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,localRevision:0,
        capabilityReadiness:[]},worker,plane);
      assert.equal((await pool.query(`SELECT state FROM capability_readiness WHERE
        capability_version_id=$1`,[versionId])).rows[0].state,'NOT_READY');
      assert.equal(await healthEventCount(),initialHealthEvents+1);
      assert.equal((await pool.query(`SELECT code FROM worker_operational_events WHERE
        worker_device_id=$1 AND capability_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,
      [worker,capability])).rows[0].code,'READINESS_REPORT_MISSING');
      await ackCloud();
      assert.equal((await pool.query(`SELECT state FROM capability_readiness WHERE
        capability_version_id=$1`,[versionId])).rows[0].state,'READY');
      const keys=new BuyerApiKeyRepository(pool,'test');
      const key=await keys.create(buyer,{name:'REST client',scopes:['capabilities:read',
        'jobs:create','jobs:read','assets:read']});
      const otherKey=await keys.create(other,{name:'Other client',
        scopes:['capabilities:read','jobs:read','assets:create','assets:read']});
      const assetKey=await keys.create(buyer,{name:'Asset client',scopes:['assets:create']});
      const hooks=new BuyerWebhookRepository(pool,{async lookupAll(){return ['8.8.8.8'];}},
        Buffer.alloc(32,13).toString('hex'));
      const endpoint=await hooks.create(buyer,{url:'https://hooks.example.com/kivro',
        events:['job.completed','job.failed','job.cancelled','job.started']});
      const req=(method,path,body=null,idem=null,token=key.secret)=>new globalThis.Request(
        `http://127.0.0.1:9876/v1/${path}`,{method,headers:{authorization:`Bearer ${token}`,
          ...(body?{'content-type':'application/json'}:{}),
          ...(idem?{'Idempotency-Key':idem}:{})},...(body?{body:JSON.stringify(body)}:{})});
      const call=(method,path,body=null,idem=null,token=key.secret)=>
        handleBuyerV1(req(method,path,body,idem,token),path.split('/'));
      if(process.env.M16_REAL_OPENCLAW==='1'){
        m16WssServer=await startWorkerWebSocketServer({host:'127.0.0.1',port:0,
          allowLocalWs:true});
        m16WssTransport=new WebSocketWorkerTransport(plane,
          `ws://127.0.0.1:${m16WssServer.port}/worker/socket`,{
            deviceId:worker,signChallenge(bytes){return deviceSigner.signChallenge(bytes);}},
        {allowLocalHttp:true});
        const welcome=await m16WssTransport.poll({type:'WORKER_HELLO',
          messageId:randomUUID(),workerDeviceId:worker,controlPlaneId:plane,
          supportedProtocolVersions:[WORKER_PROTOCOL_VERSION],workerRelease:'m16-wss',
          localRevision:0,activeExecutionIds:[]});
        assert.equal(welcome[0].type,'WORKER_WELCOME');
        assert.equal(welcome[0].controlPlaneId,plane);
      }
      const rpc=async(kind,body,forged=false)=>{
        if(m16WssTransport&&!forged){
          try{return globalThis.Response.json(await m16WssTransport.postJobRpc(kind,body));}
          catch(error){return globalThis.Response.json({code:error?.code??'TRANSPORT_FAILED'},
            {status:error?.code==='PAYMENT_NOT_SECURED'?409:403});}
        }
        const fields={workerDeviceId:worker,controlPlaneId:plane,messageId:randomUUID(),
          signedAt:new Date().toISOString(),bodyHash:workerMessageHash(body)};
        const signature=forged?Buffer.alloc(64).toString('base64url'):
          deviceSigner.signChallenge(workerSignatureBytes(fields)).toString('base64url');
        const request=new globalThis.Request('http://127.0.0.1:9876/worker/jobs/rpc',{method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({body,envelope:{...fields,signature}})});
        return handleWorkerJobRpc(request,kind);
      };
      assert.equal((await call('GET','capabilities')).status,200);
      assert.equal((await call('GET',`capabilities/${slug}`)).status,200);
      await pool.query(`UPDATE capabilities SET visibility='PRIVATE' WHERE id=$1`,[capability]);
      assert.equal(await availabilityMetrics.sample(),1,
        'seller-owned private capability is sampled without exposing it to buyers');
      assert.equal(await availabilityMetrics.sample(),0,'same minute cannot be counted twice');
      assert.equal((await availabilityMetrics.sellerCapability(capability,sellerAccount))
        .observedMinutes,1);
      await pool.query(`UPDATE capabilities SET created_at=now()-interval '5 minutes'
        WHERE id=$1`,[capability]);
      await pool.query(`INSERT INTO capability_availability_observations
        (capability_id,minute_at,observed_at,status)
        VALUES($1,date_trunc('minute',now()-interval '3 minutes'),
          date_trunc('minute',now()-interval '3 minutes')+interval '30 seconds','BUSY')`,
      [capability]);
      const gapMetrics=await availabilityMetrics.sellerCapability(capability,sellerAccount);
      assert.equal(gapMetrics.observedMinutes,2);
      assert.equal(gapMetrics.busyMinutesObserved,1);
      assert.ok(gapMetrics.unobservedMinutes>=2,
        'missing scheduler samples remain unknown rather than invented uptime');
      await assert.rejects(pool.query(`UPDATE capability_availability_observations
        SET status='ONLINE' WHERE capability_id=$1`,[capability]),/append.only/i);
      assert.equal(await availabilityMetrics.sellerCapability(capability,other),null,
        'other accounts cannot read seller availability metrics');
      assert.equal((await (await call('GET','capabilities')).json()).items.length,0);
      assert.equal((await call('GET',`capabilities/${slug}`)).status,404);
      assert.equal((await call('POST',`capabilities/${slug}/jobs`,
        {inputs:{question:'Denied'},assets:{}},'private-denied-0001')).status,404);
      await pool.query(`INSERT INTO capability_private_grants(id,capability_id,
        buyer_account_id,granted_by_account_id) VALUES($1,$2,$3,$4)`,
      [randomUUID(),capability,buyer,sellerAccount]);
      assert.equal((await call('GET',`capabilities/${slug}`)).status,200);
      assert.equal((await call('GET',`capabilities/${slug}`,null,null,
        otherKey.secret)).status,404);
      await pool.query(`UPDATE capability_private_grants SET revoked_at=now()
        WHERE capability_id=$1 AND buyer_account_id=$2`,[capability,buyer]);
      assert.equal((await call('GET',`capabilities/${slug}`)).status,404);
      await pool.query(`UPDATE capabilities SET visibility='UNLISTED' WHERE id=$1`,[capability]);
      assert.equal((await call('GET',`capabilities/${slug}`)).status,200);
      assert.equal((await (await call('GET','capabilities')).json()).items.length,0);
      await pool.query(`UPDATE capabilities SET visibility='PUBLIC' WHERE id=$1`,[capability]);
      const fileBytes=readFileSync(new URL('./fixtures/m16-document-analyzer/source.txt',
        import.meta.url));
      const digest=`sha256:${createHash('sha256').update(fileBytes).digest('hex')}`;
      const intentResponse=await call('POST','assets/upload-intents',{
        capabilityId:capability,fieldKey:'supportingFile',fileName:'input.txt',
        sizeBytes:fileBytes.length,sha256:digest,contentType:'text/plain'},null,
      assetKey.secret);
      assert.equal(intentResponse.status,201);
      const intent=(await intentResponse.json()).upload;
      const uploadResult=await globalThis.fetch(intent.url,{method:'PUT',headers:intent.headers,
        body:fileBytes});
      assert.ok(uploadResult.ok,`private staging upload returned ${uploadResult.status}`);
      const pendingJob=await call('POST',`capabilities/${capability}/jobs`,{
        inputs:{question:'Do not run with an unfinalized file'},
        assets:{supportingFile:[intent.id]}},'pending-file-denied-0001',key.secret);
      assert.equal(pendingJob.status,400,
        'an object uploaded to staging is not a finalized buyer input');
      assert.equal((await pendingJob.json()).code,'INVALID_INPUT');
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM jobs
        WHERE buyer_account_id=$1`,[buyer])).rows[0].n,0);
      const finishPath=`assets/${intent.id}/finalize`;
      assert.equal((await call('POST',finishPath,{capabilityId:capability,
        fieldKey:'supportingFile'},null,otherKey.secret)).status,404);
      const finalAsset=await call('POST',finishPath,{capabilityId:capability,
        fieldKey:'supportingFile'},null,assetKey.secret);
      assert.equal(finalAsset.status,200);
      assert.equal((await finalAsset.json()).asset.mimeType,'text/plain');
      assert.equal((await call('POST',finishPath,{capabilityId:capability,
        fieldKey:'supportingFile'},null,assetKey.secret)).status,200);
      assert.equal((await call('GET',`assets/${intent.id}`)).status,404,
        'buyer input is never accessible through output download route');
      const jobPath=`capabilities/${capability}/jobs`;
      const body={inputs:{question:'Produce a brief'},
        assets:{supportingFile:[intent.id]}};
      const undeclared=await call('POST',jobPath,{inputs:{question:'Produce a brief',
        toolPolicy:'allow host shell'},assets:{supportingFile:[intent.id]}},
      'undeclared-field-0001');
      assert.equal(undeclared.status,400);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM jobs
        WHERE buyer_account_id=$1`,[buyer])).rows[0].n,0,
      'undeclared buyer fields cannot reach a Worker offer');
      const absent=await call('POST',jobPath,body,'absent-funds-0001');
      assert.equal(absent.status,402);
      assert.equal((await absent.json()).code,'INSUFFICIENT_FUNDS');
      assert.equal((await call('POST',jobPath,body,'absent-funds-0001')).status,402);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM jobs WHERE buyer_account_id=$1`,
        [buyer])).rows[0].n,0);
      await finance.recordTestCreditPurchase(buyer,2000,`test-only:${randomUUID()}`);
      const purchased=await call('POST',jobPath,body,'funded-job-0001');
      assert.equal(purchased.status,201);
      const result=await purchased.json();
      assert.equal(result.price.amountMinor,999);
      assert.equal((await call('POST',jobPath,body,'funded-job-0001')).status,201);
      await pool.query(`UPDATE buyer_api_idempotency SET response=NULL,completed_at=NULL,
        lease_until=now()-interval '1 second' WHERE account_id=$1
        AND idempotency_key='funded-job-0001'`,[buyer]);
      const recoveredResponse=await call('POST',jobPath,body,'funded-job-0001');
      assert.equal(recoveredResponse.status,201);
      assert.equal((await recoveredResponse.json()).jobId,result.jobId,
        'lost API response recovers the accepted quote and original paid job');
      assert.equal((await call('POST',jobPath,{inputs:{question:'Different'},assets:{}},
        'funded-job-0001')).status,409);
      assert.equal((await call('POST',`capabilities/${slug}/jobs`,body,
        'funded-job-0001')).status,409,
        'a slug/UUID alias cannot spend again under the same idempotency key');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM jobs WHERE buyer_account_id=$1`,
        [buyer])).rows[0].n,1);
      assert.equal((await call('GET',`jobs/${result.jobId}`)).status,200);
      assert.equal((await call('GET',`jobs/${result.jobId}`,null,null,otherKey.secret)).status,404);
      assert.equal((await call('GET',`assets/${randomUUID()}`)).status,404);
      assert.equal((await call('POST',`jobs/${result.jobId}/cancel`)).status,200);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      const transition=await pool.query(`SELECT count(*)::int AS n FROM buyer_webhook_events
        WHERE job_id=$1 AND type='job.cancelled'`,[result.jobId]);
      assert.equal(transition.rows[0].n,1);
      const events=[];
      assert.equal(await hooks.deliverDue({async post(input){events.push(input);
        return {status:204};}}),1);
      const delivered=JSON.parse(events[0].body);
      assert.equal(delivered.type,'job.cancelled');
      assert.equal(delivered.data.jobId,result.jobId);
      assert.equal(delivered.data.capabilityId,capability);
      assert.equal(JSON.stringify(delivered).includes('question'),false,
        'buyer inputs and result files are absent from webhook metadata');
      assert.equal(verifyWebhookSignature(endpoint.secret,
        events[0].headers['Marketplace-Timestamp'],events[0].body,
        events[0].headers['Marketplace-Signature'],delivered.id,new Set()),true);
      const policy={schedule:null,concurrencyLimit:1,queueLimit:0,
        futureReservationLimit:2,estimatedRuntimeSeconds:60,maxWaitSeconds:604800};
      policyRevision=await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:true,source:'WEB',
        expectedRevision:policyRevision});
      const paused=await call('POST',jobPath,body,'paused-job-0001');
      assert.equal(paused.status,409);
      assert.equal((await paused.json()).code,'CAPABILITY_PAUSED');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      policyRevision=await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:false,source:'WEB',
        expectedRevision:policyRevision});
      await ackCloud();
      const raceKey=await keys.create(buyer,{name:'capacity-race',scopes:['jobs:create']});
      const competing=await Promise.all([call('POST',jobPath,body,'final-slot-job-A',
        raceKey.secret),call('POST',jobPath,body,'final-slot-job-B',raceKey.secret)]);
      const outcomes=await Promise.all(competing.map(async(response)=>({status:response.status,
        body:await response.clone().json()})));
      assert.deepEqual(competing.map((response)=>response.status).sort(),[201,409],
        JSON.stringify(outcomes));
      const winner=await competing.find((response)=>response.status===201).json();
      const rejectedQuoteId=randomUUID();
      await assert.rejects(availability.quote({id:rejectedQuoteId,buyerAccountId:buyer,
        capabilityId:capability,executionMode:'IMMEDIATE_ONLY'}),{code:'QUEUE_FULL'});
      await assert.rejects(availability.quote({id:rejectedQuoteId,buyerAccountId:buyer,
        capabilityId:capability,executionMode:'IMMEDIATE_ONLY'}),{code:'QUEUE_FULL'});
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM
        capability_queue_full_rejections WHERE quote_id=$1`,[rejectedQuoteId])).rows[0].n,1);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999,
        'competing requests cannot reserve the same immediate slot or overspend');
      const offer=await execution.offer(winner.jobId,worker,plane,120);
      const binding={jobId:winner.jobId,executionId:offer.executionId,
        attemptId:offer.attemptId,workerDeviceId:worker,controlPlaneId:plane,
        leaseToken:offer.leaseToken};
      assert.equal((await rpc('ACCEPT',{...binding,messageId:randomUUID()},true)).status,403,
        'forged Worker signatures never authorize a paid claim');
      const wrongBinding={...binding,workerDeviceId:other};
      assert.equal((await rpc('ACCEPT',{...wrongBinding,messageId:randomUUID()})).status,403,
        'a signed request cannot impersonate another device ID');
      assert.equal((await rpc('ACCEPT',{...binding,messageId:randomUUID()})).status,200);
      const acceptedInput=await rpc('ACCEPTED_INPUT',binding);
      assert.equal(acceptedInput.status,200);
      const released=await acceptedInput.json();
      assert.equal(released.jobId,winner.jobId);
      assert.equal(released.downloads.length,1);
      assert.equal(released.payload.values.question,body.inputs.question);
      assert.deepEqual(Object.keys(released.payload.values),['question']);
      const workerTransition=async(from,to)=>rpc('TRANSITION',{...binding,event:{id:randomUUID(),
        jobId:winner.jobId,from,to,actor:'WORKER',reason:`M13_${to}`,
        attemptId:offer.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null}});
      assert.equal((await rpc('RENEW_LEASE',{...binding,ttlSeconds:120})).status,200);
      assert.equal((await workerTransition('ACCEPTED','STARTING')).status,403,
        'event correlation cannot escape the leased attempt');
      const sendTransition=async(from,to)=>rpc('TRANSITION',{...binding,event:{id:randomUUID(),
        jobId:winner.jobId,from,to,actor:'WORKER',reason:`M13_${to}`,
        attemptId:offer.attemptId,correlationId:offer.executionId,
        paymentReservationId:null,resultManifestId:null}});
      assert.equal((await sendTransition('ACCEPTED','STARTING')).status,200);
      assert.equal((await sendTransition('STARTING','RUNNING')).status,200);
      assert.equal((await sendTransition('RUNNING','UPLOADING_RESULT')).status,200);
      const resultFile=Buffer.from('Durable M13 report\n');
      const resultAssetId=randomUUID();
      const resultDigest=`sha256:${createHash('sha256').update(resultFile).digest('hex')}`;
      const preparedResponse=await rpc('PREPARE_RESULT_ASSET',{...binding,assetId:resultAssetId,
        fieldKey:'report',extension:'.txt',sizeBytes:resultFile.length,sha256:resultDigest,
        detectedMimeType:'text/plain'});
      assert.equal(preparedResponse.status,200);
      const prepared=await preparedResponse.json();
      const objectKey=prepared.objectKey;
      assert.equal(prepared.assetId,resultAssetId);
      const uploaded=await globalThis.fetch(prepared.uploadUrl,{method:'PUT',headers:prepared.uploadHeaders,
        body:resultFile,redirect:'manual'});
      assert.equal(uploaded.status,200);
      const resultManifestId=randomUUID();
      const resultSubmission={...binding,resultManifestId,
        retainUntil:new Date(Date.now()+365*86_400_000).toISOString(),
        payload:{values:{answer:'Durable answer'},assets:{report:[resultAssetId]}},
        assets:[{id:resultAssetId,fieldKey:'report',objectKey,sizeBytes:resultFile.length,
          sha256:resultDigest,detectedMimeType:'text/plain'}]};
      const finalizedRpc=await rpc('FINALIZE_RESULT',resultSubmission);
      assert.equal(finalizedRpc.status,200,JSON.stringify(await finalizedRpc.clone().json()));
      assert.equal((await rpc('FINALIZE_RESULT',resultSubmission)).status,200,
        'a duplicate signed completion cannot settle or enqueue a second time');
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM buyer_webhook_events
        WHERE job_id=$1 AND type='job.completed'`,[winner.jobId])).rows[0].n,1);
      const measured=await availabilityMetrics.sellerCapability(capability,sellerAccount);
      assert.ok(measured.jobsAccepted>=1);
      assert.ok(measured.queueFullRejects>=1);
      assert.ok(measured.medianQueueWaitSeconds!==null);
      assert.ok(measured.medianExecutionSeconds!==null);
      assert.equal(measured.source,'MINUTE_OBSERVATIONS');
      assert.ok((await pool.query(`SELECT retain_until FROM assets WHERE id=$1`,
        [resultAssetId])).rows[0].retain_until.getTime()<Date.now()+31*86_400_000,
      'Worker cannot extend result retention beyond cloud policy');
      const paidOperation=(await pool.query(`SELECT quote_id,reservation_id,manifest_id
        FROM buyer_api_idempotency WHERE job_id=$1`,[winner.jobId])).rows[0];
      const lateReplay=await buyerRepo.purchase({buyerId:buyer,
        quoteId:paidOperation.quote_id,jobId:winner.jobId,
        reservationId:paidOperation.reservation_id,manifestId:paidOperation.manifest_id,
        payload:{values:body.inputs,assets:body.assets}});
      assert.equal(lateReplay.status,'COMPLETED',
        'a late retry reads the immutable completed job without re-finalizing input grants');
      const downloaded=await call('GET',`assets/${resultAssetId}`);
      assert.equal(downloaded.status,200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),resultFile);
      assert.equal((await call('GET',`assets/${resultAssetId}`,null,null,
        otherKey.secret)).status,404);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      if(process.env.M16_REAL_OPENCLAW==='1'){
        await runM16CoreWorkerSlice({pool,buyer,otherToken:otherKey.secret,seller,
          sellerAccount,worker,
          capability,originalPackage:localPackage,policyValidationHash:hash,plane,
          inputAssetId:intent.id,call,rpc,execution,finance,
          workerStateDir,workerPassphrasePath,
          scannerControl:{setMode(value){scannerMode=value;}}});
        policyRevision=Number((await pool.query(`SELECT revision FROM
          capability_availability_policies WHERE capability_id=$1`,
        [capability])).rows[0].revision);
      }
      const availabilityKey=await keys.create(buyer,{name:'Availability checks',
        scopes:['jobs:create']});
      const failedResponse=await call('POST',jobPath,body,'failed-job-0001',
        availabilityKey.secret);
      assert.equal(failedResponse.status,201,
        JSON.stringify(await failedResponse.clone().json()));
      const failedJob=(await failedResponse.json()).jobId;
      const failedOffer=await execution.offer(failedJob,worker,plane,120);
      const failedBinding={jobId:failedJob,executionId:failedOffer.executionId,
        attemptId:failedOffer.attemptId,workerDeviceId:worker,controlPlaneId:plane,
        leaseToken:failedOffer.leaseToken};
      assert.equal((await rpc('ACCEPT',{...failedBinding,messageId:randomUUID()})).status,200);
      assert.equal((await rpc('TRANSITION',{...failedBinding,event:{id:randomUUID(),jobId:failedJob,
        from:'ACCEPTED',to:'STARTING',actor:'WORKER',reason:'M13_STARTING',
        attemptId:failedOffer.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null}})).status,403);
      assert.equal((await rpc('TRANSITION',{...failedBinding,event:{id:randomUUID(),jobId:failedJob,
        from:'ACCEPTED',to:'STARTING',actor:'WORKER',reason:'M13_STARTING',
        attemptId:failedOffer.attemptId,correlationId:failedOffer.executionId,
        paymentReservationId:null,resultManifestId:null}})).status,200);
      assert.equal((await rpc('TRANSITION',{...failedBinding,event:{id:randomUUID(),jobId:failedJob,
        from:'STARTING',to:'FAILED_STARTUP',actor:'WORKER',reason:'M13_FAILED_STARTUP',
        attemptId:failedOffer.attemptId,correlationId:failedOffer.executionId,
        paymentReservationId:null,resultManifestId:null}})).status,200);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      const observed=[];
      const webhookTransport={async post(input){observed.push(JSON.parse(input.body));
        return {status:204};}};
      // The real Worker slice creates more events than the default dispatcher batch.
      // Drain bounded pages so this assertion tests delivery, not queue position.
      for(let page=0;page<5;page++){
        if(await hooks.deliverDue(webhookTransport,100)<100)break;
      }
      assert.ok(observed.some((event)=>event.type==='job.started'&&
        event.data.jobId===winner.jobId));
      assert.ok(observed.some((event)=>event.type==='job.completed'&&
        event.data.jobId===winner.jobId));
      assert.ok(observed.some((event)=>event.type==='job.failed'&&
        event.data.jobId===failedJob));
      const tomorrow=new Date(Date.now()+86_400_000),day=tomorrow.getUTCDay()||7;
      const future={mode:'CUSTOM_SCHEDULE',timezone:'UTC',weeklyWindows:[
        {dayOfWeek:day,startLocalTime:'00:00',endLocalTime:'23:59'}]};
      policyRevision=await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:{...policy,schedule:future},paused:false,
        source:'WEB',expectedRevision:policyRevision});
      await ackCloud();
      const closed=await call('POST',jobPath,body,'schedule-closed-0001',
        availabilityKey.secret);
      assert.equal(closed.status,409);
      const closedBody=await closed.json();
      assert.equal(closedBody.code,'CAPABILITY_SCHEDULED_OFFLINE');
      assert.equal(closedBody.availability.status,'SCHEDULED_OFFLINE');
      assert.ok(Date.parse(closedBody.availability.nextAvailableAt)>Date.now(),
        JSON.stringify(closedBody.availability));
      const publicClosed=await (await call('GET',`capabilities/${slug}`)).json();
      assert.equal(publicClosed.detail.availability.status,'SCHEDULED_OFFLINE');
      assert.equal(JSON.stringify(publicClosed).includes('weeklyWindows'),false,
        'buyer REST projection must not disclose the seller personal recurring schedule');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:false,source:'WEB',
        expectedRevision:policyRevision});
      await ackCloud();
      await pool.query(`UPDATE worker_devices SET status='OFFLINE',
        last_seen_at=now()-interval '2 minutes' WHERE id=$1`,[worker]);
      const unavailable=await call('POST',jobPath,body,'offline-job-0001',
        availabilityKey.secret);
      assert.equal(unavailable.status,409);
      assert.equal((await unavailable.json()).code,'CAPABILITY_OFFLINE');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      const fresh=await keys.create(buyer,{name:'Input check',scopes:['jobs:create']});
      assert.equal((await call('POST',jobPath,body,null,fresh.secret)).status,400);
      assert.equal((await call('GET','capabilities?api_key=secret')).status,400);
      const priorNodeEnv=process.env.NODE_ENV;
      try{process.env.NODE_ENV='production';
        assert.equal((await call('GET','capabilities')).status,403,
          'production buyer API refuses plaintext transport');
        assert.equal((await rpc('ACCEPT',{...binding,messageId:randomUUID()})).status,403,
          'production Worker RPC refuses plaintext input release and job control');
      }finally{if(priorNodeEnv===undefined)delete process.env.NODE_ENV;
        else process.env.NODE_ENV=priorNodeEnv;}
      const limited=await keys.create(other,{name:'rate test',scopes:['jobs:create']});
      for(let n=0;n<12;n++)assert.equal((await call('GET',jobPath,null,null,
        limited.secret)).status,404);
      const tooMany=await call('GET',jobPath,null,null,limited.secret);
      assert.equal(tooMany.status,429);
      assert.equal((await tooMany.json()).code,'RATE_LIMITED');
      assert.equal(tooMany.headers.get('retry-after'),'60');
    }finally{await m16WssTransport?.close();await m16WssServer?.close();
      await pool.end();await new Promise((resolve)=>scannerServer.close(resolve));
      rmSync(workerRoot,{recursive:true,force:true});}
  });
