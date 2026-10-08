import { healthyWorkerChecks } from './fixtures/healthy-worker-checks.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import { buildVersionCandidate, createJobContractSnapshot } from '../dist/packages/domain/src/capability-version.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

if (!process.env.M07_DATABASE_URL) {
  test('M07 result finalization requires disposable PostgreSQL', { skip: true }, () => {});
} else {
  test('a validated private result and immutable manifest atomically precede COMPLETED', async () => {
    const pool = new pg.Pool({ connectionString: process.env.M07_DATABASE_URL });
    const buyer = randomUUID(), sellerAccount = randomUUID(), seller = randomUUID();
    const worker = randomUUID(), capability = randomUUID(), versionId = randomUUID();
    const jobId = randomUUID(), reservation = randomUUID(), resultId = randomUUID();
    const assetId = randomUUID();
    const bytes = Buffer.from('Kivro durable result\n');
    const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const securedJobs=new Map([[jobId,reservation]]);
    let releases=0;
    let objectKey;
    const objects=new Map();
    const storage = {
      async presignPrivateUpload(){return {url:'https://storage.example.test/put',headers:{}};},
      async headPrivateObject(key) { const value=objects.get(key);return value ?
        { sizeBytes: value.length, claimedSha256: sha256 } : null; },
      async readPrivateObject(key) {
        const value=objects.get(key);if(!value)throw new Error('missing');
        return (async function* () { yield value; })();
      },
      async copyPrivateObject(source,target){const value=objects.get(source);
        if(!value)throw new Error('missing');objects.set(target,Buffer.from(value));},
      async deletePrivateObject(key){objects.delete(key);},
    };
    const repo = new PostgresJobExecutionRepository(pool, {
      async isSecured(_client, id, reservationId) {return securedJobs.get(id)===reservationId;},
      async releaseFailedJobInTransaction(){releases++;},
    }, new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 7) }, 'v1'),
    { async assertEligible() {} },{async scan(){return 'CLEAN';}});
    const event = (from, to, actor, attemptId = null, extra = {}) => ({
      id: randomUUID(), jobId, from, to, actor, reason: to, attemptId,
      correlationId: randomUUID(), paymentReservationId: null, resultManifestId: null, ...extra,
    });
    try {
      const hash = `sha256:${'a'.repeat(64)}`;
      const manifest = {
        manifestVersion: 1, workerId: randomUUID(), capabilityVersionId: versionId,
        runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
        skills: [], tools: { allow: [], deny: ['browser', 'exec', 'gateway'] }, resources: [],
        network: { default: 'deny', allow: [] },
        limits: { timeoutSeconds: 120, memoryMb: 128, cpu: 1, maxPids: 32,
          maxInputBytes: 1000, maxOutputBytes: 1000 },
      };
      const localPackage = {
        packageVersion: 1, capabilityId: capability, capabilityVersionId: versionId, workerDeviceId: worker,
        workerManifest: manifest,
        dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null, alternatives: [],
          nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill', requirement: 'REQUIRED',
            sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
            marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false, health: 'UNKNOWN' }] },
        permissionPolicy: { policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY',
          browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
          selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
          shell: false, externalSideEffects: false, buyerFileAccess: true, sellerCredentialRefs: [] },
        sellerInferenceConfigHash: null,
        ioContract: { contractVersion: 1,
          input: { schemaVersion: 1, fields: [{ key: 'question', label: 'Question', order: 0,
            required: true, type: 'SHORT_TEXT' }] },
          output: { schemaVersion: 1, fields: [
            { key: 'answer', label: 'Answer', order: 0, required: true, type: 'LONG_TEXT' },
            { key: 'report', label: 'Report', order: 1, required: true, type: 'FILE',
              constraints: { maxFiles: 1, maxFileSizeBytes: 1000, maxTotalSizeBytes: 1000,
                allowedMimeTypes: ['text/plain'], allowedExtensions: ['.txt'] } },
          ] } },
        priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
        exampleRefs: [], testRefs: [], pauseSupport: 'FULL_RESUME',
      };
      const candidate = buildVersionCandidate({ id: versionId, capabilityId: capability,
        versionNumber: 1, workerDeviceId: worker, requestedAt: new Date().toISOString(), localPackage,
        selectedPrice: await new PostgresPriceTierCatalog(pool).selected(localPackage.priceTier) });
      const fields = { ...candidate }; delete fields.requestedAt;
      const published = PublishedCapabilityVersionSchema.parse({ ...fields,
        publicationState: 'PUBLISHED', publishedAt: new Date().toISOString(), policyValidationHash: hash });
      const snapshot = createJobContractSnapshot(published, jobId, buyer, new Date().toISOString());
      await pool.query("INSERT INTO accounts(id,primary_email,status) VALUES($1,'m07-result-buyer@example.com','ACTIVE'),($2,'m07-result-seller@example.com','ACTIVE')", [buyer, sellerAccount]);
      await pool.query("INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status) VALUES($1,$2,'Seller','ACTIVE','NOT_STARTED')", [seller, sellerAccount]);
      await pool.query("INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,worker_version,status) VALUES($1,$2,'test-key','Worker','LINUX','test','ONLINE')", [worker, seller]);
      await new PostgresWorkerHeartbeatRepository(pool).observe({
        type: 'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks, protocolVersion: WORKER_PROTOCOL_VERSION,
        messageId: randomUUID(), controlPlaneId: 'plane-a', workerDeviceId: worker,
        workerRelease: '0.0.0-dev', openClawVersion: null, status: 'ONLINE',
        runningJobs: 0, capacity: 1, policyVersion: 1, localRevision: 0,
      }, worker, 'plane-a');
      await pool.query("INSERT INTO capabilities(id,seller_profile_id,slug,name,status) VALUES($1,$2,'m07-result-test','Result Test','PUBLISHED')", [capability, seller]);
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,publication_state,
        version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [versionId, capability, published, published.workerManifestHash, hash]);
      assert.equal((await repo.createJob(snapshot)).status, 'CREATED');
      await pool.query(`INSERT INTO abuse_content_rules(id,normalized_pattern,created_by)
        VALUES($1,'please create a report',$2)`,[randomUUID(),sellerAccount]);
      await assert.rejects(repo.finalizeInputManifest(jobId,randomUUID(),
        {values:{question:'Please Create A Report'},assets:{}}),{code:'ABUSE_DENIED'});
      await pool.query('UPDATE abuse_content_rules SET active=false');
      const input = await repo.finalizeInputManifest(jobId, randomUUID(),
        { values: { question: 'Please create a report' }, assets: {} });
      assert.match(input.manifestHash, /^sha256:/);
      assert.equal((await repo.finalizeInputManifest(jobId, input.id,
        { values: { question: 'Please create a report' }, assets: {} })).manifestHash, input.manifestHash);
      await repo.transition(event('CREATED', 'PAYMENT_RESERVED', 'PAYMENT', null,
        { paymentReservationId: reservation }));
      await repo.transition(event('PAYMENT_RESERVED', 'QUEUED', 'CLOUD'));
      const offered = await repo.offer(jobId, worker, 'plane-a', 60);
      const offerMessage = await repo.materializeOffer(offered.executionId);
      const restarted = new PostgresJobExecutionRepository(pool, {
        async isSecured(_client, id, reservationId) { return id === jobId && reservationId === reservation; },
      }, new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 7), v2: Buffer.alloc(32, 8) }, 'v2'),
      { async assertEligible() {} });
      const pending = await restarted.pendingOffers(worker, 'plane-a');
      assert.equal(pending.length, 1);
      assert.equal(pending[0].leaseToken, offered.leaseToken);
      assert.deepEqual(await restarted.pendingOffers(worker, 'other-plane'), []);
      const missingOldKey = new PostgresJobExecutionRepository(pool, {
        async isSecured() { return true; },
      }, new HmacLeaseTokenIssuer({ v2: Buffer.alloc(32, 8) }, 'v2'),
      { async assertEligible() {} });
      await assert.rejects(missingOldKey.pendingOffers(worker, 'plane-a'), /LEASE_KEY_UNAVAILABLE/);
      assert.equal(offerMessage.inputManifestId, input.id);
      assert.equal(offerMessage.paymentReservationId, reservation);
      assert.equal(JSON.stringify(offerMessage).includes('Please create a report'), false);
      await repo.accept(offered.executionId, worker, 'plane-a', offered.leaseToken, randomUUID());
      const acceptedInput = await repo.acceptedInputForWorker(offered.executionId,
        worker, 'plane-a', offered.leaseToken, storage, 86_400);
      assert.equal(acceptedInput.inputManifestHash, input.manifestHash);
      assert.equal(acceptedInput.payload.values.question, 'Please create a report');
      assert.deepEqual(acceptedInput.downloads, []);
      await assert.rejects(repo.acceptedInputForWorker(offered.executionId,
        randomUUID(), 'plane-a', offered.leaseToken, storage, 86_400), { code: 'NOT_ELIGIBLE' });
      await assert.rejects(repo.acceptedInputForWorker(offered.executionId,
        worker, 'wrong-plane', offered.leaseToken, storage, 86_400), { code: 'NOT_ELIGIBLE' });
      await assert.rejects(repo.acceptedInputForWorker(offered.executionId,
        worker, 'plane-a', 'x'.repeat(32), storage, 86_400), { code: 'NOT_ELIGIBLE' });
      const workerEvent = (input) => repo.workerTransition(input, offered.executionId,
        worker, 'plane-a', offered.leaseToken);
      await workerEvent(event('ACCEPTED', 'STARTING', 'WORKER', offered.attemptId));
      const pause = { commandId: randomUUID(), jobId, executionId: offered.executionId,
        attemptId: offered.attemptId, controlPlaneId: 'plane-a', action: 'PAUSE',
        source: 'WEB', actorId: sellerAccount, reason: 'seller safety',
        requestedAt: new Date().toISOString() };
      await assert.rejects(repo.requestJobControl(pause, sellerAccount), { code: 'NOT_ELIGIBLE' });
      await workerEvent(event('STARTING', 'RUNNING', 'WORKER', offered.attemptId));
      await assert.rejects(repo.requestJobControl({ ...pause, actorId: buyer }, buyer),
        { code: 'NOT_ELIGIBLE' });
      assert.equal((await repo.requestJobControl(pause, sellerAccount)).status, 'PAUSE_REQUESTED');
      assert.equal((await repo.requestJobControl(pause, sellerAccount)).status, 'PAUSE_REQUESTED');
      await assert.rejects(repo.requestJobControl({ ...pause, reason: 'changed after retry' }, sellerAccount),
        { code: 'CONFLICT' });
      const pausedAck = { commandId: pause.commandId, jobId, executionId: offered.executionId,
        attemptId: offered.attemptId, workerDeviceId: worker, controlPlaneId: 'plane-a',
        status: 'PAUSED', localRevision: 4, confirmedAt: new Date().toISOString() };
      const failedPause = { ...pausedAck, status: 'CONTROL_FAILED', confirmedAt: null };
      assert.equal((await repo.acknowledgeJobControl(failedPause, worker, 'plane-a')).status,
        'PAUSE_REQUESTED');
      assert.equal((await repo.acknowledgeJobControl(failedPause, worker, 'plane-a')).status,
        'PAUSE_REQUESTED');
      const failureAudit = await pool.query(`SELECT last_failure_status,last_failure_at,confirmed_at
        FROM job_control_commands WHERE id=$1`, [pause.commandId]);
      assert.equal(failureAudit.rows[0].last_failure_status, 'CONTROL_FAILED');
      assert.ok(failureAudit.rows[0].last_failure_at);
      assert.equal(failureAudit.rows[0].confirmed_at, null);
      await assert.rejects(repo.acknowledgeJobControl({ ...pausedAck, workerDeviceId: randomUUID() }, worker, 'plane-a'),
        { code: 'WRONG_WORKER' });
      await assert.rejects(repo.acknowledgeJobControl(pausedAck, worker, 'other-plane'),
        { code: 'WRONG_CONTROL_PLANE' });
      assert.equal((await repo.acknowledgeJobControl(pausedAck, worker, 'plane-a')).status, 'PAUSED');
      assert.equal((await repo.acknowledgeJobControl(pausedAck, worker, 'plane-a')).status, 'PAUSED');
      await new PostgresWorkerHeartbeatRepository(pool).observe({
        type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,protocolVersion:WORKER_PROTOCOL_VERSION,
        messageId:randomUUID(),controlPlaneId:'plane-a',workerDeviceId:worker,
        workerRelease:'0.0.0-dev',openClawVersion:null,status:'ONLINE',
        sentAt:new Date().toISOString(),runningJobs:1,capacity:1,
        policyVersion:1,localRevision:0,capabilityReadiness:[{
          capabilityVersionId:versionId,policyValidationHash:hash,state:'READY',
          checks:{sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true}}]},
      worker,'plane-a');
      const resume = { ...pause, commandId: randomUUID(), action: 'RESUME', reason: null,
        requestedAt: new Date().toISOString() };
      await pool.query(`UPDATE worker_heartbeats SET operational_checks='[]'::jsonb
        WHERE worker_device_id=$1`,[worker]);
      await assert.rejects(repo.requestJobControl(resume,sellerAccount),
        {code:'NOT_ELIGIBLE'},'Cloud cannot resume paid execution with missing Docker proof');
      await pool.query(`UPDATE worker_heartbeats SET operational_checks=$2::jsonb
        WHERE worker_device_id=$1`,[worker,JSON.stringify(healthyWorkerChecks)]);
      assert.equal((await repo.requestJobControl(resume, sellerAccount)).status, 'RESUME_REQUESTED');
      assert.equal((await repo.acknowledgeJobControl({ ...pausedAck, commandId: resume.commandId,
        status: 'RESUME_NOT_READY', localRevision: 5, confirmedAt: null }, worker, 'plane-a')).status,
        'RESUME_REQUESTED');
      assert.equal((await repo.acknowledgeJobControl({ ...pausedAck, commandId: resume.commandId,
        status: 'RUNNING', localRevision: 5 }, worker, 'plane-a')).status, 'RUNNING');
      await workerEvent(event('RUNNING', 'UPLOADING_RESULT', 'WORKER', offered.attemptId));
      await assert.rejects(repo.prepareResultAsset({assetId,jobId,
        executionId:offered.executionId,attemptId:offered.attemptId,
        workerDeviceId:worker,controlPlaneId:'plane-a',leaseToken:'x'.repeat(32),
        fieldKey:'report',extension:'.txt',sizeBytes:bytes.length,sha256,
        detectedMimeType:'text/plain'},storage),{code:'INVALID_LEASE'});
      const prepared=await repo.prepareResultAsset({assetId,jobId,
        executionId:offered.executionId,attemptId:offered.attemptId,
        workerDeviceId:worker,controlPlaneId:'plane-a',leaseToken:offered.leaseToken,
        fieldKey:'report',extension:'.txt',sizeBytes:bytes.length,sha256,
        detectedMimeType:'text/plain'},storage);
      objectKey=prepared.objectKey;
      objects.set(objectKey,bytes);
      assert.equal((await repo.prepareResultAsset({assetId,jobId,
        executionId:offered.executionId,attemptId:offered.attemptId,
        workerDeviceId:worker,controlPlaneId:'plane-a',leaseToken:offered.leaseToken,
        fieldKey:'report',extension:'.txt',sizeBytes:bytes.length,sha256,
        detectedMimeType:'text/plain'},storage)).objectKey,objectKey);
      await assert.rejects(repo.transition(event('UPLOADING_RESULT', 'COMPLETED', 'CLOUD', offered.attemptId,
        { resultManifestId: resultId })), { code: 'NOT_ELIGIBLE' });
      const submission = { resultManifestId: resultId, jobId, executionId: offered.executionId,
        attemptId: offered.attemptId, workerDeviceId: worker, controlPlaneId: 'plane-a',
        leaseToken: offered.leaseToken,
        payload: { values: { answer: 'Done' }, assets: { report: [assetId] } },
        assets: [{ id: assetId, fieldKey: 'report', objectKey, sizeBytes: bytes.length,
          sha256, detectedMimeType: 'text/plain' }] };
      const retention = new Date(Date.now() + 86_400_000).toISOString();
      await assert.rejects(repo.finalizeResult({...submission,assets:[{
        ...submission.assets[0],objectKey:`private/assets/${assetId}/${randomUUID()}`}]},storage,retention),
      {code:'NOT_ELIGIBLE'});
      await assert.rejects(repo.finalizeResult({...submission,leaseToken:'x'.repeat(32)},
        storage,retention),{code:'INVALID_LEASE'});
      objects.set(objectKey,Buffer.from('Xivro durable result\n'));
      await assert.rejects(repo.finalizeResult(submission,storage,retention),
        {code:'HASH_MISMATCH'});
      objects.set(objectKey,bytes);
      const unsafeRepo=new PostgresJobExecutionRepository(pool,{
        async isSecured(_client,id,reservationId){return id===jobId&&reservationId===reservation;},
      },new HmacLeaseTokenIssuer({v1:Buffer.alloc(32,7)},'v1'),
      {async assertEligible(){} });
      await assert.rejects(unsafeRepo.finalizeResult(submission,storage,retention),
        {code:'SCAN_UNAVAILABLE'});
      await assert.rejects(repo.finalizeResult({...submission,assets:[
        {...submission.assets[0],detectedMimeType:'image/jpeg'}]},storage,retention),
        {code:'NOT_ELIGIBLE'});
      const infectedRepo=new PostgresJobExecutionRepository(pool,{
        async isSecured(_client,id,reservationId){return id===jobId&&reservationId===reservation;},
      },new HmacLeaseTokenIssuer({v1:Buffer.alloc(32,7)},'v1'),
      {async assertEligible(){} },{async scan(){throw new Error('INFECTED');}});
      await assert.rejects(infectedRepo.finalizeResult(submission,storage,retention),/INFECTED/);
      assert.equal((await repo.load(jobId)).status, 'UPLOADING_RESULT');
      // Simulate PostgreSQL committing the manifest and losing the COMMIT
      // acknowledgement. The cloud must retain the copied private output.
      let loseCommitAck = true;
      const ambiguousPool = {
        query: (...args) => pool.query(...args),
        async connect() {
          const client = await pool.connect();
          return {
            query: async (...args) => {
              const result = await client.query(...args);
              if (args[0] === 'COMMIT' && loseCommitAck) {
                loseCommitAck = false;
                throw new Error('COMMIT_ACK_LOST');
              }
              return result;
            },
            release: () => client.release(),
          };
        },
      };
      const ambiguousRepo = new PostgresJobExecutionRepository(ambiguousPool, {
        async isSecured(_client, id, reservationId) {
          return id === jobId && reservationId === reservation;
        },
      }, new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 7) }, 'v1'),
      { async assertEligible() {} }, { async scan() { return 'CLEAN'; } });
      await assert.rejects(ambiguousRepo.finalizeResult(submission, storage, retention),
        /COMMIT_ACK_LOST/);
      const committed = await pool.query(`SELECT a.object_key FROM jobs j
        JOIN job_result_assets ra ON ra.manifest_id=j.result_manifest_id
        JOIN assets a ON a.id=ra.asset_id WHERE j.id=$1 AND j.status='COMPLETED'`, [jobId]);
      assert.equal(committed.rowCount, 1);
      assert.deepEqual(objects.get(committed.rows[0].object_key), bytes);
      assert.equal((await repo.finalizeResult(submission, storage, retention)).status, 'COMPLETED');
      assert.equal((await repo.finalizeResult(submission, storage, retention)).status, 'COMPLETED');
      const row = await pool.query(`SELECT m.payload,a.state,a.sha256,a.object_key,j.status FROM job_result_manifests m
        JOIN jobs j ON j.id=m.job_id JOIN job_result_assets ra ON ra.manifest_id=m.id
        JOIN assets a ON a.id=ra.asset_id WHERE m.id=$1`, [resultId]);
      assert.equal(row.rowCount, 1);
      assert.equal(row.rows[0].state, 'READY');
      assert.equal(row.rows[0].sha256, sha256);
      assert.equal(row.rows[0].status, 'COMPLETED');
      assert.notEqual(row.rows[0].object_key,objectKey);
      objects.set(objectKey,Buffer.from('rewritten by Worker after signed upload'));
      assert.deepEqual(objects.get(row.rows[0].object_key),bytes);
      assert.deepEqual(row.rows[0].payload.values, { answer: 'Done' });
      await pool.query(`UPDATE job_result_upload_intents
        SET last_signed_at=now()-interval '12 minutes' WHERE asset_id=$1`,[assetId]);
      assert.equal(await repo.reconcileOutputStaging(storage,10),1);
      assert.equal(objects.has(objectKey),false);
      assert.deepEqual(objects.get(row.rows[0].object_key),bytes);
      assert.equal(await repo.reconcileOutputStaging(storage,10),0);
      const rejectedJob=randomUUID(),rejectedReservation=randomUUID();
      securedJobs.set(rejectedJob,rejectedReservation);
      await new PostgresWorkerHeartbeatRepository(pool).observe({
        type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,protocolVersion:WORKER_PROTOCOL_VERSION,
        messageId:randomUUID(),controlPlaneId:'plane-a',workerDeviceId:worker,
        workerRelease:'0.0.0-dev',openClawVersion:null,status:'ONLINE',
        sentAt:new Date(Date.now()+1000).toISOString(),runningJobs:0,capacity:1,
        policyVersion:1,localRevision:0},worker,'plane-a');
      await repo.createJob(createJobContractSnapshot(published,rejectedJob,buyer,
        new Date().toISOString()));
      await repo.finalizeInputManifest(rejectedJob,randomUUID(),
        {values:{question:'Second job'},assets:{}});
      const rejectedEvent=(from,to,actor,attemptId=null,extra={})=>({
        ...event(from,to,actor,attemptId,extra),jobId:rejectedJob});
      await repo.transition(rejectedEvent('CREATED','PAYMENT_RESERVED','PAYMENT',null,
        {paymentReservationId:rejectedReservation}));
      await repo.transition(rejectedEvent('PAYMENT_RESERVED','QUEUED','CLOUD'));
      const secondOffer=await repo.offer(rejectedJob,worker,'plane-a',60);
      await repo.accept(secondOffer.executionId,worker,'plane-a',secondOffer.leaseToken,randomUUID());
      for(const [from,to] of [['ACCEPTED','STARTING'],['STARTING','RUNNING'],
        ['RUNNING','UPLOADING_RESULT']])await repo.workerTransition(
        rejectedEvent(from,to,'WORKER',secondOffer.attemptId),secondOffer.executionId,
        worker,'plane-a',secondOffer.leaseToken);
      const rejection={jobId:rejectedJob,executionId:secondOffer.executionId,
        attemptId:secondOffer.attemptId,workerDeviceId:worker,controlPlaneId:'plane-a',
        leaseToken:secondOffer.leaseToken};
      await assert.rejects(repo.rejectInvalidResult({...rejection,
        workerDeviceId:randomUUID()}),{code:'NOT_ELIGIBLE'});
      assert.equal((await repo.rejectInvalidResult(rejection)).status,'RESULT_REJECTED');
      assert.equal((await repo.rejectInvalidResult(rejection)).status,'RESULT_REJECTED');
      assert.equal(releases,1);
    } finally { await pool.end(); }
  });
}
