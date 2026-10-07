import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import pg from 'pg';
import process from 'node:process';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { PostgresWorkerMessageAuthenticator } from '../dist/packages/persistence/src/worker-auth.js';
import { workerMessageHash, workerSignatureBytes } from '../dist/packages/worker-protocol/src/auth.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { PostgresWorkerPairingRepository, workerPairingProofBytes } from '../dist/packages/persistence/src/worker-pairing.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

if (!process.env.M07_DATABASE_URL) {
  test('M07 PostgreSQL requires disposable local container', { skip: true }, () => {});
} else {
  const pool = new pg.Pool({ connectionString: process.env.M07_DATABASE_URL, max: 6 });
  const buyer = randomUUID(), sellerAccount = randomUUID(), seller = randomUUID();
  const worker = randomUUID(), capability = randomUUID(), version = randomUUID();
  const job = randomUUID(), reservation = randomUUID(), plane = 'kivro-test-plane';
  let secured = false;
  const leaseIssuer = new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 7) }, 'v1');
  const repo = new PostgresJobExecutionRepository(pool, {
    async isSecured(_client, jobId, reservationId) {
      return secured && jobId === job && reservationId === reservation;
    },
  }, leaseIssuer, { async assertEligible() {} });
  const event = (from, to, actor, attemptId = null, extra = {}) => ({
    id: randomUUID(), jobId: job, from, to, actor, reason: `M07_${to}`,
    attemptId, correlationId: randomUUID(), paymentReservationId: null,
    resultManifestId: null, ...extra,
  });

  test('seed a published immutable version and queued job', async () => {
    await pool.query("INSERT INTO accounts(id,primary_email,status) VALUES($1,'m07-buyer@example.com','ACTIVE'),($2,'m07-seller@example.com','ACTIVE')", [buyer, sellerAccount]);
    await pool.query("INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status) VALUES($1,$2,'M07 Seller','ACTIVE','NOT_STARTED')", [seller, sellerAccount]);
    await pool.query("INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,worker_version,status) VALUES($1,$2,'test-only-public-key','M07 Worker','LINUX','test','ONLINE')", [worker, seller]);
    const heartbeat = new PostgresWorkerHeartbeatRepository(pool);
    await heartbeat.observe({ type: 'WORKER_HEARTBEAT', protocolVersion: WORKER_PROTOCOL_VERSION,
      messageId: randomUUID(), controlPlaneId: plane, workerDeviceId: worker,
      workerRelease: '0.0.0-dev', openClawVersion: null, status: 'ONLINE',
      runningJobs: 0, capacity: 1, policyVersion: 1, localRevision: 0 }, worker, plane);
    await pool.query("INSERT INTO capabilities(id,seller_profile_id,slug,name,status) VALUES($1,$2,'m07-test','M07 Capability','DRAFT')", [capability, seller]);
    await pool.query("INSERT INTO capability_versions(id,capability_id,version_number,publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at) VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())", [version, capability, { workerDeviceId: worker }, `sha256:${'a'.repeat(64)}`, `sha256:${'b'.repeat(64)}`]);
    await pool.query("INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,status,contract_snapshot) VALUES($1,$2,$3,$4,'CREATED','{}')", [job, buyer, version, worker]);
    await pool.query(`INSERT INTO job_input_manifests(id,job_id,schema_hash,manifest_hash,payload,total_bytes,file_count)
      VALUES($1,$2,$3,$4,'{}',0,0)`, [randomUUID(), job,
      `sha256:${'a'.repeat(64)}`, `sha256:${'b'.repeat(64)}`]);
    await assert.rejects(repo.transition(event('CREATED', 'PAYMENT_RESERVED', 'PAYMENT', null,
      { paymentReservationId: reservation })), { code: 'PAYMENT_NOT_SECURED' });
    assert.equal((await repo.load(job)).status, 'CREATED');
    secured = true; // Test-only stand-in for the future M08 ledger verifier.
    await repo.transition(event('CREATED', 'PAYMENT_RESERVED', 'PAYMENT', null,
      { paymentReservationId: reservation }));
    await repo.transition(event('PAYMENT_RESERVED', 'QUEUED', 'CLOUD'));
  });

  test('competing offers produce exactly one active execution and durable transition', async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => repo.offer(job, worker, plane, 60)));
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const offer = outcomes.find((outcome) => outcome.status === 'fulfilled').value;
    assert.equal((await repo.load(job)).status, 'DISPATCHED');
    const executions = await pool.query('SELECT id,attempt_id,control_plane_id FROM job_executions WHERE job_id=$1', [job]);
    assert.equal(executions.rowCount, 1);
    assert.equal(executions.rows[0].control_plane_id, plane);
    assert.equal(executions.rows[0].attempt_id, offer.attemptId);
    globalThis.offer = offer;
  });

  test('acceptance is worker/plane/lease scoped and idempotent', async () => {
    const offer = globalThis.offer;
    await assert.rejects(repo.accept(offer.executionId, randomUUID(), plane, offer.leaseToken, randomUUID()),
      { code: 'WRONG_WORKER' });
    await assert.rejects(repo.accept(offer.executionId, worker, 'other-plane', offer.leaseToken, randomUUID()),
      { code: 'WRONG_CONTROL_PLANE' });
    await assert.rejects(repo.accept(offer.executionId, worker, plane, 'wrong-token', randomUUID()),
      { code: 'INVALID_LEASE' });
    const messageId = randomUUID();
    const accepted = await repo.accept(offer.executionId, worker, plane, offer.leaseToken, messageId);
    assert.equal(accepted.status, 'ACCEPTED');
    const restarted = new PostgresJobExecutionRepository(pool, {
      async isSecured(_client, jobId, reservationId) {
        return secured && jobId === job && reservationId === reservation;
      },
    }, new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 7), v2: Buffer.alloc(32, 8) }, 'v2'),
    { async assertEligible() {} });
    assert.deepEqual(await restarted.reconcileWorkerExecutions(worker, plane, [offer.executionId]), [{
      executionId: offer.executionId, action: 'CONTINUE', jobId: job,
      attemptId: offer.attemptId, status: 'ACCEPTED', leaseToken: offer.leaseToken,
      leaseExpiresAt: offer.expiresAt,
    }]);
    assert.deepEqual(await restarted.reconcileWorkerExecutions(worker, 'other-plane', [offer.executionId]), [{
      executionId: offer.executionId, action: 'STOP', reason: 'UNKNOWN_OR_UNOWNED',
    }]);
    assert.equal((await repo.accept(offer.executionId, worker, plane, offer.leaseToken, messageId)).transitions.length,
      accepted.transitions.length);
    const trace = await pool.query('SELECT at,actor,reason,attempt_id,correlation_id FROM job_transitions WHERE job_id=$1 ORDER BY sequence', [job]);
    assert.equal(trace.rowCount, 4);
    for (const row of trace.rows) {
      assert.ok(row.at && row.actor && row.reason && row.correlation_id);
    }
    assert.equal(trace.rows.at(-1).attempt_id, offer.attemptId);
  });

  test('pause request is distinct from Worker-confirmed pause; duplicate command is inert', async () => {
    const attempt = globalThis.offer.attemptId;
    const workerEvent = (input) => repo.workerTransition(input, globalThis.offer.executionId,
      worker, plane, globalThis.offer.leaseToken);
    await assert.rejects(repo.transition(event('ACCEPTED', 'STARTING', 'WORKER', attempt)),
      { code: 'NOT_ELIGIBLE' });
    await workerEvent(event('ACCEPTED', 'STARTING', 'WORKER', attempt));
    await workerEvent(event('STARTING', 'RUNNING', 'WORKER', attempt));
    const request = event('RUNNING', 'PAUSE_REQUESTED', 'SELLER', attempt);
    assert.equal((await repo.transition(request)).status, 'PAUSE_REQUESTED');
    assert.equal((await repo.transition(request)).status, 'PAUSE_REQUESTED');
    await assert.rejects(repo.transition(event('PAUSE_REQUESTED', 'PAUSED', 'SELLER', attempt)),
      { code: 'FORBIDDEN_TRANSITION' });
    assert.equal((await workerEvent(event('PAUSE_REQUESTED', 'PAUSED', 'WORKER', attempt))).status, 'PAUSED');
    await assert.rejects(repo.transition(event('PAUSED', 'RESUME_REQUESTED', 'BUYER', attempt)),
      { code: 'FORBIDDEN_TRANSITION' });
    assert.equal((await repo.transition(event('PAUSED', 'RESUME_REQUESTED', 'SELLER', attempt))).status,
      'RESUME_REQUESTED');
    assert.equal((await workerEvent(event('RESUME_REQUESTED', 'RUNNING', 'WORKER', attempt))).status,
      'RUNNING');
    const rows = await pool.query('SELECT COUNT(*)::int AS count FROM job_transitions WHERE job_id=$1', [job]);
    assert.equal(rows.rows[0].count, 10);
  });

  test('signed Worker message replay is scoped and idempotent under concurrency', async () => {
    const deviceId = randomUUID();
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    await pool.query("INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,worker_version,status) VALUES($1,$2,$3,'Signed Worker','LINUX','test','ONLINE')", [deviceId, seller, publicKeyPem]);
    const body = { type: 'WORKER_HEARTBEAT', workerDeviceId: deviceId,
      controlPlaneId: plane, runningJobs: 0 };
    const unsigned = { workerDeviceId: deviceId, controlPlaneId: plane,
      messageId: randomUUID(), signedAt: new Date().toISOString(), bodyHash: workerMessageHash(body) };
    const envelope = { ...unsigned,
      signature: sign(null, workerSignatureBytes(unsigned), privateKey).toString('base64url') };
    const auth = new PostgresWorkerMessageAuthenticator(pool);
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => auth.verify(envelope, body)));
    assert.equal(outcomes.filter((outcome) => !outcome.duplicate).length, 1);
    await assert.rejects(auth.verify(envelope, { ...body, runningJobs: 1 }),
      {code:'INVALID_SIGNATURE'});
    await assert.rejects(auth.verify(envelope, { ...body, controlPlaneId: 'other' }),
      {code:'INVALID_SIGNATURE'});
    await pool.query("UPDATE worker_devices SET status='REVOKED',revoked_at=now() WHERE id=$1", [deviceId]);
    await assert.rejects(auth.verify(envelope, body), { code: 'REVOKED_DEVICE' });
  });

  test('one-time pairing binds a proved Ed25519 device key and revocation is seller-scoped', async () => {
    await pool.query('UPDATE accounts SET email_verified_at=now() WHERE id=$1', [sellerAccount]);
    const pairing = new PostgresWorkerPairingRepository(pool);
    await assert.rejects(pairing.issue(buyer, seller), { code: 'NOT_ELIGIBLE' });
    const issued = await pairing.issue(sellerAccount, seller, 120);
    assert.match(issued.code, /^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
    const deviceId = randomUUID();
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const input = { code: issued.code, deviceId, publicKeyPem, name: 'Paired M07 Worker',
      platform: 'LINUX', workerRelease: '0.0.0-dev',
      possessionSignature: sign(null, workerPairingProofBytes(issued.code, deviceId, publicKeyPem),
        privateKey).toString('base64url') };
    await assert.rejects(pairing.redeem({ ...input, possessionSignature: sign(null,
      Buffer.from('wrong challenge'), privateKey).toString('base64url') }), { code: 'INVALID_PROOF' });
    const races = await Promise.allSettled([pairing.redeem(input), pairing.redeem(input)]);
    assert.equal(races.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(races.find((entry) => entry.status === 'rejected').reason.code, 'INVALID_CODE');
    const device = await pool.query('SELECT public_key,status FROM worker_devices WHERE id=$1', [deviceId]);
    assert.equal(device.rows[0].public_key, publicKeyPem);
    assert.equal(device.rows[0].status, 'PAIRED');
    const secret = await pool.query('SELECT code_hash FROM worker_pairing_codes WHERE paired_device_id=$1', [deviceId]);
    assert.notEqual(secret.rows[0].code_hash, issued.code);
    await assert.rejects(pairing.revoke(buyer, deviceId), { code: 'NOT_ELIGIBLE' });
    await pairing.revoke(sellerAccount, deviceId);
    await pairing.revoke(sellerAccount, deviceId);
    assert.equal((await pool.query('SELECT status FROM worker_devices WHERE id=$1', [deviceId])).rows[0].status,
      'REVOKED');
  });

  test('loss of payment evidence fails closed before another state change', async () => {
    secured = false;
    assert.deepEqual(await repo.reconcileWorkerExecutions(worker, plane, [globalThis.offer.executionId]), [{
      executionId: globalThis.offer.executionId, action: 'STOP', reason: 'PAYMENT_NOT_SECURED',
    }]);
    await assert.rejects(repo.workerTransition(event('RUNNING', 'UPLOADING_RESULT', 'WORKER',
      globalThis.offer.attemptId), globalThis.offer.executionId, worker, plane, globalThis.offer.leaseToken),
      { code: 'PAYMENT_NOT_SECURED' });
    assert.equal((await repo.load(job)).status, 'RUNNING');
    await pool.end();
  });
}
