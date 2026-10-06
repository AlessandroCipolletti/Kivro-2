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
    const objectKey = `private/assets/${assetId}/${randomUUID()}`;
    const storage = {
      async headPrivateObject(key) { return key === objectKey ? { sizeBytes: bytes.length, claimedSha256: sha256 } : null; },
      async readPrivateObject(key) {
        if (key !== objectKey) throw new Error('missing');
        return (async function* () { yield bytes; })();
      },
    };
    const repo = new PostgresJobExecutionRepository(pool, {
      async isSecured(_client, id, reservationId) { return id === jobId && reservationId === reservation; },
    }, new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 7) }, 'v1'),
    { async assertEligible() {} });
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
        type: 'WORKER_HEARTBEAT', protocolVersion: WORKER_PROTOCOL_VERSION,
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
      const resume = { ...pause, commandId: randomUUID(), action: 'RESUME', reason: null,
        requestedAt: new Date().toISOString() };
      assert.equal((await repo.requestJobControl(resume, sellerAccount)).status, 'RESUME_REQUESTED');
      assert.equal((await repo.acknowledgeJobControl({ ...pausedAck, commandId: resume.commandId,
        status: 'RESUME_NOT_READY', localRevision: 5, confirmedAt: null }, worker, 'plane-a')).status,
        'RESUME_REQUESTED');
      assert.equal((await repo.acknowledgeJobControl({ ...pausedAck, commandId: resume.commandId,
        status: 'RUNNING', localRevision: 5 }, worker, 'plane-a')).status, 'RUNNING');
      await workerEvent(event('RUNNING', 'UPLOADING_RESULT', 'WORKER', offered.attemptId));
      await assert.rejects(repo.transition(event('UPLOADING_RESULT', 'COMPLETED', 'CLOUD', offered.attemptId,
        { resultManifestId: resultId })), { code: 'NOT_ELIGIBLE' });
      const submission = { resultManifestId: resultId, jobId, executionId: offered.executionId,
        attemptId: offered.attemptId, workerDeviceId: worker, controlPlaneId: 'plane-a',
        leaseToken: offered.leaseToken,
        payload: { values: { answer: 'Done' }, assets: { report: [assetId] } },
        assets: [{ id: assetId, fieldKey: 'report', objectKey, sizeBytes: bytes.length,
          sha256, detectedMimeType: 'text/plain' }] };
      const retention = new Date(Date.now() + 86_400_000).toISOString();
      await assert.rejects(repo.finalizeResult({ ...submission,
        assets: [{ ...submission.assets[0], sha256: `sha256:${'0'.repeat(64)}` }] }, storage, retention),
      { code: 'HASH_MISMATCH' });
      assert.equal((await repo.load(jobId)).status, 'UPLOADING_RESULT');
      assert.equal((await repo.finalizeResult(submission, storage, retention)).status, 'COMPLETED');
      assert.equal((await repo.finalizeResult(submission, storage, retention)).status, 'COMPLETED');
      const row = await pool.query(`SELECT m.payload,a.state,a.sha256,j.status FROM job_result_manifests m
        JOIN jobs j ON j.id=m.job_id JOIN job_result_assets ra ON ra.manifest_id=m.id
        JOIN assets a ON a.id=ra.asset_id WHERE m.id=$1`, [resultId]);
      assert.equal(row.rowCount, 1);
      assert.equal(row.rows[0].state, 'READY');
      assert.equal(row.rows[0].sha256, sha256);
      assert.equal(row.rows[0].status, 'COMPLETED');
      assert.deepEqual(row.rows[0].payload.values, { answer: 'Done' });
    } finally { await pool.end(); }
  });
}
