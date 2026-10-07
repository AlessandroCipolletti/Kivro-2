import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import { buildVersionCandidate, createJobContractSnapshot } from
  '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

const always = { mode: 'ALWAYS_AVAILABLE', timezone: 'UTC', weeklyWindows: [] };
const policy = (schedule = null, extra = {}) => ({ schedule, concurrencyLimit: 1,
  queueLimit: 1, futureReservationLimit: 2, estimatedRuntimeSeconds: 60,
  maxWaitSeconds: 172800, ...extra });

if (!process.env.M09_DATABASE_URL) {
  test('M09 PostgreSQL integration requires disposable PostgreSQL', { skip: true }, () => {});
} else {
  test('real M09 quote, credits, queue fairness, Worker eligibility and schedule changes', async () => {
    const pool = new pg.Pool({ connectionString: process.env.M09_DATABASE_URL, max: 16 });
    // This fixture deliberately creates many jobs to exercise queue fairness,
    // independent of M15's conservative private-alpha buyer ceilings.
    await pool.query(`UPDATE platform_buyer_limits SET max_jobs_per_hour=1000,
      max_spend_minor_per_day=100000000,max_active_jobs=1000,
      max_quotes_per_minute=10000 WHERE singleton=true`);
    const finance = new PostgresFinanceRepository(pool, 'test');
    const availability = new PostgresAvailabilityRepository(pool, finance);
    const repo = new PostgresJobExecutionRepository(pool, finance,
      new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 9) }, 'v1'), availability);
    const heartbeat = new PostgresWorkerHeartbeatRepository(pool);
    const buyer = randomUUID(), sellerAccount = randomUUID(), seller = randomUUID();
    const worker = randomUUID(), capability = randomUUID(), versionId = randomUUID();
    const hash = `sha256:${'a'.repeat(64)}`, plane = 'm09-test-plane';
    let lastBeatSent=0;
    const beat = async (ready=false,runningJobs=0) => {
      const controls=await pool.query('SELECT revision FROM worker_cloud_control_revisions WHERE worker_device_id=$1',[worker]);
      return heartbeat.observe({ type: 'WORKER_HEARTBEAT',
      protocolVersion: WORKER_PROTOCOL_VERSION, messageId: randomUUID(), controlPlaneId: plane,
      workerDeviceId: worker, workerRelease: 'test',
      sentAt:new Date(lastBeatSent=Math.max(Date.now(),lastBeatSent+1)).toISOString(),
      openClawVersion: null,
      status: 'ONLINE', runningJobs, capacity: 1, policyVersion: 1, localRevision: 0,
      acknowledgedCloudRevision:Number(controls.rows[0]?.revision??0),
      capabilityReadiness:ready?[{capabilityVersionId:versionId,
        policyValidationHash:hash,state:'READY',checks:{sandboxVerified:true,
          requiredSecretsReady:true,runtimeHealthy:true}}]:[] },
    worker, plane);};
    try {
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$3,'ACTIVE',now()),($2,$4,'ACTIVE',now())`,
      [buyer,sellerAccount,`${buyer}@example.test`,`${sellerAccount}@example.test`]);
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
        VALUES($1,$2,'M09 Seller','ACTIVE','READY')`,[seller,sellerAccount]);
      await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_account_id,
        stripe_mode,onboarding_status,transfers_enabled,payouts_enabled,country,last_reconciled_at)
        VALUES($1,'acct_M09TEST','test','READY',true,true,'US',now())`,[seller]);
      await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
        worker_version,status) VALUES($1,$2,'m09-test-key','M09 Worker','LINUX','test','ONLINE')`,
      [worker,seller]);
      await beat();
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
        VALUES($1,$2,$3,'M09 Capability','PUBLISHED')`,[capability,seller,`m09-${capability}`]);
      const localPackage = {
        packageVersion: 1, capabilityId: capability, capabilityVersionId: versionId,
        workerDeviceId: worker, workerManifest: {
          manifestVersion: 1, workerId: randomUUID(), capabilityVersionId: versionId,
          runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
          skills: [], tools: { allow: [], deny: ['browser','exec','gateway'] }, resources: [],
          network: { default: 'deny', allow: [] }, limits: { timeoutSeconds: 120,
            memoryMb: 128, cpu: 1, maxPids: 32, maxInputBytes: 1000, maxOutputBytes: 1000 },
        }, dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null,
          alternatives: [], nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill',
            requirement: 'REQUIRED', sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'],
            dependsOn: [], marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED',
            selected: false, health: 'UNKNOWN' }] },
        permissionPolicy: { policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY',
          browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
          selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
          shell: false, externalSideEffects: false, buyerFileAccess: false,
          sellerCredentialRefs: [] },
        sellerInferenceConfigHash: null,
        ioContract: { contractVersion: 1,
          input: { schemaVersion: 1, fields: [{ key: 'question', label: 'Question', order: 0,
            required: true, type: 'SHORT_TEXT' }] },
          output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer', order: 0,
            required: true, type: 'LONG_TEXT' }] } },
        priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
        exampleRefs: [], testRefs: [], pauseSupport: 'NOT_SUPPORTED',
      };
      const candidate = buildVersionCandidate({ id: versionId, capabilityId: capability,
        versionNumber: 1, workerDeviceId: worker, requestedAt: new Date().toISOString(),
        localPackage, selectedPrice: await new PostgresPriceTierCatalog(pool).selected('USD_999') });
      const fields={...candidate};delete fields.requestedAt;
      const published=PublishedCapabilityVersionSchema.parse({ ...fields,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:hash });
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [versionId,capability,published,published.workerManifestHash,hash]);
      await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
        [capability,versionId]);
      await pool.query("UPDATE capabilities SET visibility='PUBLIC' WHERE id=$1",[capability]);
      await finance.recordTestCreditPurchase(buyer,10000,`test-only:${randomUUID()}`);
      const job = async () => {
        const id=randomUUID();
        await repo.createJob(createJobContractSnapshot(published,id,buyer,new Date().toISOString()));
        await repo.finalizeInputManifest(id,randomUUID(),
          { values:{question:'Work'},assets:{} });
        return id;
      };
      const quote = (mode, id=randomUUID()) => availability.quote({id,buyerAccountId:buyer,
        capabilityId:capability,executionMode:mode});
      const book = (q,id,reservationId=randomUUID()) => availability.book({quoteId:q.id,
        jobId:id,buyerAccountId:buyer,reservationId});
      await assert.rejects(quote('IMMEDIATE_ONLY'),{code:'NOT_READY'});
      await availability.setWorkerDefault({workerDeviceId:worker,sellerAccountId:sellerAccount,
        schedule:always,paused:false,source:'WEB',expectedRevision:null});
      await availability.setCapabilityPolicy({capabilityId:capability,sellerAccountId:sellerAccount,
        policy:policy(),paused:false,source:'WEB',expectedRevision:null});
      await assert.rejects(quote('IMMEDIATE_ONLY'),{code:'NOT_READY'});
      await assert.rejects(quote('EARLIEST_AVAILABLE'),{code:'NOT_READY'});
      await beat(true);
      assert.equal((await availability.publicStatus(capability)).status,'ONLINE');
      assert.equal(JSON.stringify(await availability.publicStatus(capability)).includes('weeklyWindows'),false);
      await assert.rejects(availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:randomUUID(),policy:policy(),paused:false,source:'API',expectedRevision:1}),
      {code:'NOT_ELIGIBLE'});
      await pool.query("UPDATE capabilities SET visibility='PRIVATE' WHERE id=$1",[capability]);
      assert.equal((await availability.publicStatus(capability)).reason,'NOT_VISIBLE');
      await assert.rejects(quote('IMMEDIATE_ONLY'),{code:'NOT_ELIGIBLE'});
      const grant=randomUUID();
      await pool.query(`INSERT INTO capability_private_grants(id,capability_id,
        buyer_account_id,granted_by_account_id) VALUES($1,$2,$3,$4)`,
      [grant,capability,buyer,sellerAccount]);
      assert.equal((await availability.publicStatus(capability,buyer)).status,'ONLINE');
      await pool.query('UPDATE capability_private_grants SET revoked_at=now() WHERE id=$1',[grant]);
      assert.equal((await availability.publicStatus(capability,buyer)).reason,'NOT_VISIBLE');
      await pool.query("UPDATE capabilities SET visibility='PUBLIC' WHERE id=$1",[capability]);
      const latestBeat=await pool.query(`SELECT latest_heartbeat_reported_at AS at
        FROM worker_devices WHERE id=$1`,[worker]);
      const staleBody={ type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
        messageId:randomUUID(),controlPlaneId:plane,workerDeviceId:worker,
        workerRelease:'test',sentAt:new Date(latestBeat.rows[0].at.getTime()-1000).toISOString(),
        openClawVersion:null,status:'PAUSED',runningJobs:0,capacity:1,
        policyVersion:1,localRevision:0,capabilityReadiness:[] };
      await heartbeat.observe(staleBody,worker,plane);
      assert.equal((await availability.publicStatus(capability)).status,'ONLINE');
      await assert.rejects(heartbeat.observe({...staleBody,messageId:randomUUID(),
        sentAt:new Date(latestBeat.rows[0].at.getTime()+1).toISOString(),status:'ONLINE',
        capabilityReadiness:[{capabilityVersionId:versionId,
          policyValidationHash:`sha256:${'f'.repeat(64)}`,state:'READY',checks:{sandboxVerified:true,
            requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane),
      /READINESS_VERSION_MISMATCH/);
      assert.equal((await availability.publicStatus(capability)).status,'ONLINE');
      // Purchase can precede input upload. A paid job without a finalized
      // manifest cannot be offered and cannot starve a ready later buyer.
      const missingInputJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,missingInputJob,buyer,
        new Date().toISOString()));
      const missingInputQuote=await quote('IMMEDIATE_ONLY');
      await book(missingInputQuote,missingInputJob);
      await assert.rejects(repo.offer(missingInputJob,worker,plane,120),
        {code:'NOT_ELIGIBLE'});
      await availability.reconcile();
      assert.equal((await repo.load(missingInputJob)).status,'WAITING_FOR_AVAILABILITY');
      const readyBehindQuote=await quote('IMMEDIATE_ONLY');
      const readyBehindJob=await job();
      await book(readyBehindQuote,readyBehindJob);
      await repo.offer(readyBehindJob,worker,plane,120);
      await assert.rejects(repo.offer(missingInputJob,worker,plane,120),
        {code:'NOT_ELIGIBLE'});
      await availability.cancel(readyBehindJob,buyer,randomUUID());
      await repo.finalizeInputManifest(missingInputJob,randomUUID(),
        {values:{question:'Uploaded after purchase'},assets:{}});
      await availability.reconcile();
      assert.equal((await repo.load(missingInputJob)).status,'QUEUED');
      await repo.offer(missingInputJob,worker,plane,120);
      await assert.rejects(repo.finalizeInputManifest(missingInputJob,randomUUID(),
        {values:{question:'Changed after offer'},assets:{}}),{code:'NOT_ELIGIBLE'});
      await availability.cancel(missingInputJob,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      const neverUploadedJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,neverUploadedJob,buyer,
        new Date().toISOString()));
      await book(await quote('IMMEDIATE_ONLY'),neverUploadedJob);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      const afterDeadline=new PostgresAvailabilityRepository(pool,finance,
        ()=>new Date(Date.now()+3*86_400_000));
      await afterDeadline.reconcile();
      assert.equal((await repo.load(neverUploadedJob)).status,'EXPIRED');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);

      const q1=await quote('IMMEDIATE_ONLY'), q2=await quote('IMMEDIATE_ONLY');
      assert.deepEqual(await quote('IMMEDIATE_ONLY',q1.id),q1);
      await assert.rejects(availability.quote({id:q1.id,buyerAccountId:randomUUID(),
        capabilityId:capability,executionMode:'IMMEDIATE_ONLY'}),{code:'CONFLICT'});
      await assert.rejects(availability.quote({id:randomUUID(),buyerAccountId:buyer,
        capabilityId:capability,executionMode:'EARLIEST_AVAILABLE',
        latestAcceptableStartAt:new Date(Date.now()-1000).toISOString()}),
      {code:'NO_FUTURE_WINDOW'});
      const j1=await job(),j2=await job();
      const r1=randomUUID(),r2=randomUUID();
      const race=await Promise.allSettled([book(q1,j1,r1),book(q2,j2,r2)]);
      assert.equal(race.filter((result)=>result.status==='fulfilled').length,2);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,1998);
      const first=await repo.offer(j1,worker,plane,120);
      await assert.rejects(repo.offer(j2,worker,plane,120),{code:'NOT_ELIGIBLE'});
      await repo.accept(first.executionId,worker,plane,first.leaseToken,randomUUID());
      await repo.workerTransition({id:randomUUID(),jobId:j1,from:'ACCEPTED',to:'STARTING',
        actor:'WORKER',reason:'START',attemptId:first.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null},first.executionId,worker,plane,first.leaseToken);
      await availability.cancel(j2,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      await beat(true,1);
      assert.equal((await availability.publicStatus(capability)).status,'BUSY');
      assert.equal((await availability.publicStatus(capability)).acceptingQueue,true);
      const busyQuote=await quote('IMMEDIATE_ONLY');
      const busyJob=await job();
      await book(busyQuote,busyJob);
      assert.equal((await repo.load(busyJob)).status,'QUEUED');
      await assert.rejects(repo.offer(busyJob,worker,plane,120),{code:'NOT_ELIGIBLE'});
      await availability.cancel(busyJob,buyer,randomUUID());
      await repo.workerTransition({id:randomUUID(),jobId:j1,from:'STARTING',to:'FAILED_STARTUP',
        actor:'WORKER',reason:'TEST_FAILURE',attemptId:first.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null},first.executionId,worker,plane,first.leaseToken);
      await finance.releaseFailedJob(j1);
      await beat(true,0);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);

      const tomorrow=new Date(Date.now()+86400000), weekday=tomorrow.getUTCDay()||7;
      const future={ mode:'CUSTOM_SCHEDULE',timezone:'UTC',weeklyWindows:[
        {dayOfWeek:weekday,startLocalTime:'00:00',endLocalTime:'23:59'}] };
      await availability.setCapabilityPolicy({capabilityId:capability,sellerAccountId:sellerAccount,
        policy:policy(future,{estimatedRuntimeSeconds:null,futureReservationLimit:1}),
        paused:false,source:'WEB',expectedRevision:1});
      const scheduledStatus=await availability.publicStatus(capability);
      assert.equal(scheduledStatus.status,'SCHEDULED_OFFLINE');
      assert.ok(Date.parse(scheduledStatus.nextAvailableAt)>Date.now());
      const scheduled=await quote('EARLIEST_AVAILABLE');
      assert.equal(scheduled.startIsGuaranteed,false);
      await assert.rejects(quote('IMMEDIATE_ONLY'),(error)=>
        error.code==='SCHEDULED_OFFLINE'&&Date.parse(error.nextAvailableAt)>Date.now());
      const j3=await job();
      const timing=await book(scheduled,j3);
      assert.equal((await repo.load(j3)).status,'WAITING_FOR_AVAILABILITY');
      assert.ok(Date.parse(timing.nextEligibleAt)>Date.now());
      await assert.rejects(quote('EARLIEST_AVAILABLE'),{code:'NO_FUTURE_WINDOW'});
      assert.equal((await availability.jobTiming(j3,buyer)).jobId,j3);
      await assert.rejects(availability.jobTiming(j3,randomUUID()),{code:'NOT_FOUND'});
      const demand=await availability.sellerOverview(capability,sellerAccount);
      assert.equal(demand.scheduledCount,1);
      assert.deepEqual(demand.windowDemand.map((window)=>[
        window.jobCount,window.reservedBuyerValueMinor,window.estimatedSellerEarningsMinor]),
      [[1,999,800]]);
      await assert.rejects(availability.sellerOverview(capability,randomUUID()),
        {code:'NOT_ELIGIBLE'});
      await assert.rejects(repo.offer(j3,worker,plane,120),{code:'NOT_ELIGIBLE'});
      const changed=await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,source:'WEB',expectedRevision:2});
      assert.equal(changed,3);
      assert.equal((await new PostgresAvailabilityRepository(pool,finance).reconcile()).queued,1);
      assert.equal((await repo.load(j3)).status,'QUEUED');
      await pool.query(`UPDATE worker_heartbeats SET observed_at=now()-interval '2 minutes',
        reported_at=now()-interval '2 minutes'
        WHERE worker_device_id=$1`,[worker]);
      assert.equal((await availability.publicStatus(capability)).status,'OFFLINE');
      assert.equal((await availability.publicStatus(capability)).nextAvailableAt,null);
      assert.equal((await availability.publicStatus(capability)).canSchedule,false);
      await assert.rejects(quote('EARLIEST_AVAILABLE'),{code:'NOT_READY'});
      assert.equal((await availability.reconcile()).waiting,1);
      assert.equal((await repo.load(j3)).status,'WAITING_FOR_WORKER');
      await beat(true);
      assert.equal((await availability.reconcile()).queued,1);
      const request=randomUUID();
      await availability.cancel(j3,buyer,request);
      await availability.cancel(j3,buyer,request);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE job_id=$1 AND kind='RELEASE'`,[j3])).rows[0].n,1);
      await assert.rejects(pool.query(`UPDATE job_schedule_plans SET latest_start_at=now()+interval '10 days'
        WHERE job_id=$1`,[j3]),/immutable/);

      const stale=await quote('EARLIEST_AVAILABLE');
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:true,source:'WEB',expectedRevision:3});
      assert.equal((await availability.publicStatus(capability)).status,'PAUSED');
      const staleJob=await job();
      await assert.rejects(book(stale,staleJob),{code:'STALE_QUOTE'});
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,source:'WEB',expectedRevision:4});
      await beat(true);

      const expiring=await quote('EARLIEST_AVAILABLE');
      const j4=await job();
      await book(expiring,j4);
      const futureClock=()=>new Date(Date.parse(expiring.latestStartAt)+1000);
      const restarted=new PostgresAvailabilityRepository(pool,finance,futureClock);
      assert.equal((await restarted.reconcile()).expired,1);
      assert.equal((await repo.load(j4)).status,'EXPIRED');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      assert.equal((await restarted.reconcile()).expired,0);

      const racing=await quote('IMMEDIATE_ONLY');
      const j5=await job();
      await book(racing,j5);
      const raceResult=await Promise.allSettled([
        repo.offer(j5,worker,plane,120),availability.cancel(j5,buyer,randomUUID())]);
      assert.equal(raceResult[1].status,'fulfilled');
      if (raceResult[0].status==='fulfilled') {
        await assert.rejects(repo.accept(raceResult[0].value.executionId,worker,plane,
          raceResult[0].value.leaseToken,randomUUID()),{code:'NOT_ELIGIBLE'});
      }
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);

      const beforeClose=await quote('IMMEDIATE_ONLY');
      const j6=await job();
      await book(beforeClose,j6);
      const offered=await repo.offer(j6,worker,plane,120);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(future),paused:false,source:'WEB',expectedRevision:5});
      assert.deepEqual(await repo.pendingOffers(worker,plane),[]);
      assert.equal((await availability.reconcile()).waiting,1);
      assert.equal((await repo.load(j6)).status,'WAITING_FOR_AVAILABILITY');
      await assert.rejects(repo.accept(offered.executionId,worker,plane,
        offered.leaseToken,randomUUID()),{code:'NOT_ELIGIBLE'});
      await availability.cancel(j6,buyer,randomUUID());
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,source:'WEB',expectedRevision:6});

      const afterClaimQuote=await quote('IMMEDIATE_ONLY');
      const j7=await job();
      await book(afterClaimQuote,j7);
      const claimed=await repo.offer(j7,worker,plane,120);
      await repo.accept(claimed.executionId,worker,plane,claimed.leaseToken,randomUUID());
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(future),paused:false,source:'WEB',expectedRevision:7});
      await availability.reconcile();
      assert.equal((await repo.load(j7)).status,'WAITING_FOR_AVAILABILITY');
      await assert.rejects(repo.workerTransition({id:randomUUID(),jobId:j7,
        from:'ACCEPTED',to:'STARTING',actor:'WORKER',reason:'LATE_START',
        attemptId:claimed.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null},claimed.executionId,
      worker,plane,claimed.leaseToken),{code:'NOT_ELIGIBLE'});
      await availability.cancel(j7,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);
      await availability.setPlatformBlock(capability,sellerAccount,true);
      assert.equal((await availability.publicStatus(capability)).reason,'PLATFORM_BLOCKED');
      await assert.rejects(quote('EARLIEST_AVAILABLE'),{code:'NOT_ELIGIBLE'});
      await availability.setPlatformBlock(capability,sellerAccount,false);
      const history=await pool.query(`SELECT revision,subject_kind,source FROM availability_schedule_audit
        WHERE subject_id=$1 ORDER BY revision`,[capability]);
      assert.equal(history.rows.length,10);
      assert.equal(history.rows[0].source,'WEB');
      assert.equal(history.rows.at(-1).source,'PLATFORM');
      await assert.rejects(pool.query(`DELETE FROM availability_schedule_audit
        WHERE subject_id=$1`,[capability]),/append only/);

      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,source:'WEB',expectedRevision:10});
      await beat(true);
      const racingStartQuote=await quote('IMMEDIATE_ONLY');
      const j8=await job();
      await book(racingStartQuote,j8);
      const startOffer=await repo.offer(j8,worker,plane,120);
      await repo.accept(startOffer.executionId,worker,plane,startOffer.leaseToken,randomUUID());
      const startEvent={id:randomUUID(),jobId:j8,from:'ACCEPTED',to:'STARTING',
        actor:'WORKER',reason:'RACING_START',attemptId:startOffer.attemptId,
        correlationId:randomUUID(),paymentReservationId:null,resultManifestId:null};
      const expiryClock=()=>new Date(Date.parse(racingStartQuote.latestStartAt)+1000);
      const expiryRepo=new PostgresAvailabilityRepository(pool,finance,expiryClock);
      const competing=await Promise.allSettled([
        repo.workerTransition(startEvent,startOffer.executionId,worker,plane,startOffer.leaseToken),
        expiryRepo.reconcile()]);
      const finalStatus=(await repo.load(j8)).status;
      assert.ok(['STARTING','EXPIRED'].includes(finalStatus));
      assert.equal(competing.filter((result)=>result.status==='fulfilled').length>=1,true);
      if (finalStatus==='STARTING') {
        await repo.workerTransition({...startEvent,id:randomUUID(),from:'STARTING',
          to:'FAILED_STARTUP',reason:'TEST_FAILURE'},startOffer.executionId,
        worker,plane,startOffer.leaseToken);
        await finance.releaseFailedJob(j8);
      }
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE job_id=$1 AND kind='RELEASE'`,[j8])).rows[0].n,1);

      const runningQuote=await quote('IMMEDIATE_ONLY');
      const j9=await job();
      await book(runningQuote,j9);
      const live=await repo.offer(j9,worker,plane,120);
      await repo.accept(live.executionId,worker,plane,live.leaseToken,randomUUID());
      const workerEvent=(from,to,id=randomUUID())=>({id,jobId:j9,from,to,
        actor:'WORKER',reason:`TEST_${to}`,attemptId:live.attemptId,
        correlationId:randomUUID(),paymentReservationId:null,resultManifestId:null});
      await repo.workerTransition(workerEvent('ACCEPTED','STARTING'),
        live.executionId,worker,plane,live.leaseToken);
      const runningEvent=workerEvent('STARTING','RUNNING');
      await repo.workerTransition(runningEvent,live.executionId,worker,plane,live.leaseToken);
      await repo.workerTransition(runningEvent,live.executionId,worker,plane,live.leaseToken);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(future),paused:false,
        source:'WEB',expectedRevision:11});
      await availability.reconcile();
      assert.equal((await repo.load(j9)).status,'RUNNING');
      await repo.workerTransition(workerEvent('RUNNING','FAILED_EXECUTION'),
        live.executionId,worker,plane,live.leaseToken);
      await finance.releaseFailedJob(j9);
      const lifecycleEvents=await pool.query(`SELECT kind,count(*)::int AS n
        FROM job_schedule_events WHERE job_id=$1 GROUP BY kind`,[j9]);
      assert.equal(lifecycleEvents.rows.find((row)=>row.kind==='STARTED').n,1);
      assert.equal(lifecycleEvents.rows.find((row)=>row.kind==='FAILED').n,1);
      await assert.rejects(pool.query(`DELETE FROM job_schedule_events WHERE job_id=$1`,[j9]),
        /append only/);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);

      const olderScheduled=await quote('EARLIEST_AVAILABLE');
      const j10=await job();
      await book(olderScheduled,j10);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,
        source:'WEB',expectedRevision:12});
      assert.equal((await availability.publicStatus(capability)).reason,
        'RECONCILIATION_PENDING');
      await assert.rejects(quote('IMMEDIATE_ONLY'),{code:'NOT_READY'});
      await availability.reconcile();
      const newerImmediate=await quote('IMMEDIATE_ONLY');
      const j11=await job();
      await book(newerImmediate,j11);
      await assert.rejects(repo.offer(j11,worker,plane,120),{code:'NOT_ELIGIBLE'});
      const earlierOffer=await repo.offer(j10,worker,plane,120);
      await assert.rejects(repo.offer(j11,worker,plane,120),{code:'NOT_ELIGIBLE'});
      await availability.cancel(j10,buyer,randomUUID());
      await assert.rejects(repo.accept(earlierOffer.executionId,worker,plane,
        earlierOffer.leaseToken,randomUUID()),{code:'NOT_ELIGIBLE'});
      await availability.cancel(j11,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);

      const overflowQuote=await quote('IMMEDIATE_ONLY');
      const j12=await job();
      await book(overflowQuote,j12);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(future),paused:false,
        source:'WEB',expectedRevision:13});
      await availability.reconcile();
      assert.equal((await repo.load(j12)).status,'WAITING_FOR_AVAILABILITY');
      assert.ok(Date.parse((await availability.jobTiming(j12,buyer)).nextEligibleAt)>Date.now());
      await assert.rejects(repo.offer(j12,worker,plane,120),{code:'NOT_ELIGIBLE'});
      await availability.cancel(j12,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);

      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,
        source:'WEB',expectedRevision:14});
      const pinnedQuote=await quote('IMMEDIATE_ONLY');
      const pinnedJob=await job();
      await book(pinnedQuote,pinnedJob);
      const nextVersionId=randomUUID();
      const nextVersion=PublishedCapabilityVersionSchema.parse({ ...published,
        id:nextVersionId,versionNumber:2,publishedAt:new Date().toISOString() });
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,2,'PUBLISHED',$3,$4,$5,now())`,
      [nextVersionId,capability,nextVersion,nextVersion.workerManifestHash,hash]);
      await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
        [capability,nextVersionId]);
      assert.equal((await availability.publicStatus(capability)).status,'READINESS_BLOCKED');
      const oldVersionOffer=await repo.offer(pinnedJob,worker,plane,120);
      await repo.accept(oldVersionOffer.executionId,worker,plane,
        oldVersionOffer.leaseToken,randomUUID());
      await availability.cancel(pinnedJob,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);

      await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
        [capability,versionId]);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,
        policy:policy(future,{estimatedRuntimeSeconds:43000,futureReservationLimit:2}),
        paused:false,source:'WEB',expectedRevision:15});
      const firstFutureQuote=await quote('EARLIEST_AVAILABLE');
      const firstFutureJob=await job();
      const firstFutureTiming=await book(firstFutureQuote,firstFutureJob);
      const secondFutureQuote=await quote('EARLIEST_AVAILABLE');
      const secondFutureJob=await job();
      await book(secondFutureQuote,secondFutureJob);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,
        policy:policy(future,{queueLimit:0,estimatedRuntimeSeconds:86400,futureReservationLimit:1}),
        paused:false,source:'WEB',expectedRevision:16});
      await availability.reconcile();
      assert.equal((await availability.jobTiming(firstFutureJob,buyer)).nextEligibleAt,
        firstFutureTiming.nextEligibleAt);
      assert.ok(Date.parse((await availability.jobTiming(secondFutureJob,buyer)).nextEligibleAt)>
        Date.parse(firstFutureTiming.nextEligibleAt));
      await availability.cancel(firstFutureJob,buyer,randomUUID());
      await availability.cancel(secondFutureJob,buyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,10000);

      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,
        policy:policy(always,{queueLimit:0,futureReservationLimit:0}),
        paused:false,source:'WEB',expectedRevision:17});
      const rivalBuyer=randomUUID();
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$2,'ACTIVE',now())`,[rivalBuyer,`${rivalBuyer}@example.test`]);
      await finance.recordTestCreditPurchase(rivalBuyer,10000,`test-only:${randomUUID()}`);
      const finalSlotA=await quote('IMMEDIATE_ONLY');
      const finalSlotB=await availability.quote({id:randomUUID(),buyerAccountId:rivalBuyer,
        capabilityId:capability,executionMode:'IMMEDIATE_ONLY'});
      const finalJobA=await job(),finalJobB=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,finalJobB,rivalBuyer,
        new Date().toISOString()));
      await repo.finalizeInputManifest(finalJobB,randomUUID(),
        {values:{question:'Rival work'},assets:{}});
      const lastSlotRace=await Promise.allSettled([
        book(finalSlotA,finalJobA),
        availability.book({quoteId:finalSlotB.id,jobId:finalJobB,
          buyerAccountId:rivalBuyer,reservationId:randomUUID()})]);
      assert.equal(lastSlotRace.filter((result)=>result.status==='fulfilled').length,1);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor+
        (await finance.buyerBalance(rivalBuyer)).reservedMinor,999);
      await assert.rejects(quote('EARLIEST_AVAILABLE'),{code:'NO_FUTURE_WINDOW'});
      const winner=lastSlotRace[0].status==='fulfilled'?finalJobA:finalJobB;
      const winnerBuyer=lastSlotRace[0].status==='fulfilled'?buyer:rivalBuyer;
      await availability.cancel(winner,winnerBuyer,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      assert.equal((await finance.buyerBalance(rivalBuyer)).reservedMinor,0);

      const secondCapability=randomUUID(),secondVersionId=randomUUID();
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
        VALUES($1,$2,$3,'M09 Second Capability','PUBLISHED')`,
      [secondCapability,seller,`m09-${secondCapability}`]);
      const secondPublished=PublishedCapabilityVersionSchema.parse({ ...published,
        id:secondVersionId,capabilityId:secondCapability,versionNumber:1,
        publishedAt:new Date().toISOString() });
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [secondVersionId,secondCapability,secondPublished,
        secondPublished.workerManifestHash,hash]);
      await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
        [secondCapability,secondVersionId]);
      await pool.query("UPDATE capabilities SET visibility='PUBLIC' WHERE id=$1",
        [secondCapability]);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,
        policy:policy(future,{queueLimit:0,estimatedRuntimeSeconds:86400,futureReservationLimit:1}),
        paused:false,source:'WEB',expectedRevision:18});
      await availability.setCapabilityPolicy({capabilityId:secondCapability,
        sellerAccountId:sellerAccount,
        policy:policy(future,{queueLimit:0,estimatedRuntimeSeconds:86400,futureReservationLimit:1}),
        paused:false,source:'WEB',expectedRevision:null});
      await heartbeat.observe({type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
        messageId:randomUUID(),controlPlaneId:plane,workerDeviceId:worker,
        workerRelease:'test',sentAt:new Date(Date.now()+10).toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,
        policyVersion:1,localRevision:0,capabilityReadiness:[
          {capabilityVersionId:versionId,policyValidationHash:hash,state:'READY',checks:{
            sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true}},
          {capabilityVersionId:secondVersionId,policyValidationHash:hash,state:'READY',checks:{
            sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true}}]},
      worker,plane);
      const firstSharedQuote=await quote('EARLIEST_AVAILABLE');
      const firstSharedJob=await job();
      await book(firstSharedQuote,firstSharedJob);
      await assert.rejects(availability.quote({id:randomUUID(),buyerAccountId:rivalBuyer,
        capabilityId:secondCapability,executionMode:'EARLIEST_AVAILABLE'}),
      {code:'NO_FUTURE_WINDOW'});
      await availability.cancel(firstSharedJob,buyer,randomUUID());
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,
        policy:policy(always,{queueLimit:0,futureReservationLimit:0}),
        paused:false,source:'WEB',expectedRevision:19});
      await availability.setCapabilityPolicy({capabilityId:secondCapability,
        sellerAccountId:sellerAccount,
        policy:policy(always,{queueLimit:0,futureReservationLimit:0}),
        paused:false,source:'WEB',expectedRevision:1});
      const sharedNowQuote=await quote('IMMEDIATE_ONLY');
      const sharedNowJob=await job();
      await book(sharedNowQuote,sharedNowJob);
      assert.equal((await availability.publicStatus(secondCapability)).acceptingImmediate,false);
      await assert.rejects(availability.quote({id:randomUUID(),buyerAccountId:rivalBuyer,
        capabilityId:secondCapability,executionMode:'IMMEDIATE_ONLY'}),{code:'QUEUE_FULL'});
      await availability.cancel(sharedNowJob,buyer,randomUUID());

      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(future),paused:false,
        source:'WEB',expectedRevision:20});
      const olderCrossQuote=await quote('EARLIEST_AVAILABLE');
      const olderCrossJob=await job();
      await book(olderCrossQuote,olderCrossJob);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,
        source:'WEB',expectedRevision:21});
      await availability.setCapabilityPolicy({capabilityId:secondCapability,
        sellerAccountId:sellerAccount,policy:policy(always,{queueLimit:1}),paused:false,
        source:'WEB',expectedRevision:2});
      await availability.reconcile();
      const newerCrossQuote=await availability.quote({id:randomUUID(),
        buyerAccountId:rivalBuyer,capabilityId:secondCapability,
        executionMode:'IMMEDIATE_ONLY'});
      const newerCrossJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(secondPublished,newerCrossJob,
        rivalBuyer,new Date().toISOString()));
      await repo.finalizeInputManifest(newerCrossJob,randomUUID(),
        {values:{question:'Newer cross-capability work'},assets:{}});
      await availability.book({quoteId:newerCrossQuote.id,jobId:newerCrossJob,
        buyerAccountId:rivalBuyer,reservationId:randomUUID()});
      await assert.rejects(repo.offer(newerCrossJob,worker,plane,120),
        {code:'NOT_ELIGIBLE'});
      await availability.cancel(olderCrossJob,buyer,randomUUID());
      await availability.cancel(newerCrossJob,rivalBuyer,randomUUID());
      const eligibleNowQuote=await quote('EARLIEST_AVAILABLE');
      const eligibleNowJob=await job();
      await book(eligibleNowQuote,eligibleNowJob);
      assert.equal((await repo.load(eligibleNowJob)).status,'QUEUED');
      await availability.cancel(eligibleNowJob,buyer,randomUUID());

      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(future),paused:false,
        source:'WEB',expectedRevision:22});
      const scheduledSuccessQuote=await quote('EARLIEST_AVAILABLE');
      const scheduledSuccessJob=await job();
      const bookedTiming=await book(scheduledSuccessQuote,scheduledSuccessJob);
      assert.equal((await repo.load(scheduledSuccessJob)).status,'WAITING_FOR_AVAILABILITY');
      assert.equal(bookedTiming.startedAt,null);
      await assert.rejects(finance.settleDeliveredJob(scheduledSuccessJob),
        {code:'NOT_ELIGIBLE'});
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy:policy(always),paused:false,
        source:'WEB',expectedRevision:23});
      await availability.reconcile();
      const scheduledOffer=await repo.offer(scheduledSuccessJob,worker,plane,120);
      await repo.accept(scheduledOffer.executionId,worker,plane,
        scheduledOffer.leaseToken,randomUUID());
      const scheduledEvent=(from,to)=>({id:randomUUID(),jobId:scheduledSuccessJob,
        from,to,actor:'WORKER',reason:`M09_${to}`,
        attemptId:scheduledOffer.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null});
      for (const [from,to] of [['ACCEPTED','STARTING'],['STARTING','RUNNING'],
        ['RUNNING','UPLOADING_RESULT']]) {
        await repo.workerTransition(scheduledEvent(from,to),scheduledOffer.executionId,
          worker,plane,scheduledOffer.leaseToken);
      }
      assert.ok((await availability.jobTiming(scheduledSuccessJob,buyer)).startedAt);
      await assert.rejects(finance.settleDeliveredJob(scheduledSuccessJob),
        {code:'NOT_ELIGIBLE'});
      const resultId=randomUUID();
      const scheduledResult={resultManifestId:resultId,jobId:scheduledSuccessJob,
        executionId:scheduledOffer.executionId,attemptId:scheduledOffer.attemptId,
        workerDeviceId:worker,controlPlaneId:plane,leaseToken:scheduledOffer.leaseToken,
        payload:{values:{answer:'Scheduled result'},assets:{}},assets:[]};
      const noAssetStorage={async headPrivateObject(){throw new Error('unexpected asset');},
        async readPrivateObject(){throw new Error('unexpected asset');}};
      await repo.finalizeResult(scheduledResult,noAssetStorage,
        new Date(Date.now()+86_400_000).toISOString());
      await repo.finalizeResult(scheduledResult,noAssetStorage,
        new Date(Date.now()+86_400_000).toISOString());
      await Promise.all([finance.settleDeliveredJob(scheduledSuccessJob),
        finance.settleDeliveredJob(scheduledSuccessJob)]);
      const deliveredTiming=await availability.jobTiming(scheduledSuccessJob,buyer);
      assert.ok(deliveredTiming.createdAt&&deliveredTiming.scheduledForEarliestAt&&
        deliveredTiming.nextEligibleAt&&deliveredTiming.eligibleAt&&
        deliveredTiming.queuedAt&&deliveredTiming.startedAt&&deliveredTiming.deliveredAt);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      assert.equal((await finance.sellerEarnings(seller)).pendingMinor,800);
      const successfulEvents=await pool.query(`SELECT kind,count(*)::int AS n
        FROM job_schedule_events WHERE job_id=$1 GROUP BY kind`,[scheduledSuccessJob]);
      assert.equal(successfulEvents.rows.find((entry)=>entry.kind==='STARTED').n,1);
      assert.equal(successfulEvents.rows.find((entry)=>entry.kind==='DELIVERED').n,1);
    } finally { await pool.end(); }
  });
}
