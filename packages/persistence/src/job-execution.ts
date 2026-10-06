import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { JobContractSnapshotSchema, PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { JobTransitionSchema, type JobStatus, type JobTransition } from '../../contracts/src/job-lifecycle.js';
import { applyJobTransition } from '../../domain/src/job-lifecycle.js';
import { createJobContractSnapshot } from '../../domain/src/capability-version.js';
import { canonicalJson, hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { validateInputPayload, validateOutputPayload } from '../../contracts/src/contract-values.js';
import { verifyStoredObject } from '../../application/src/object-integrity.js';
import type { ObjectStoragePort } from '../../infrastructure/contracts/src/ports.js';
import { JobControlCommandSchema, type PauseSupport } from '../../contracts/src/job-control.js';
import { JobOfferSchema, WORKER_PROTOCOL_VERSION, type JobOffer } from '../../worker-protocol/src/messages.js';
import type { LeaseTokenIssuer } from '../../application/src/lease-token.js';

const uuid = z.uuid();
const controlPlane = z.string().min(1).max(160);
const executionStates = new Set<JobStatus>([
  'PAYMENT_RESERVED', 'QUEUED', 'WAITING_FOR_WORKER', 'DISPATCHED', 'ACCEPTED', 'STARTING',
  'RUNNING', 'UPLOADING_RESULT', 'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED',
  'SECURITY_PAUSED', 'CANCEL_REQUESTED', 'COMPLETED',
]);
const terminalStates = new Set<JobStatus>([
  'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED_STARTUP', 'FAILED_POLICY',
  'FAILED_EXECUTION', 'TIMED_OUT', 'WORKER_OFFLINE', 'RESULT_REJECTED',
]);

/** M08 must implement this from authoritative ledger state. No Worker message can implement it. */
export interface PaymentReservationVerifier {
  isSecured(client: PoolClient, jobId: string, reservationId: string): Promise<boolean>;
}

export class JobExecutionError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'PAYMENT_NOT_SECURED' | 'NOT_ELIGIBLE' |
    'LEASE_EXPIRED' | 'WRONG_WORKER' | 'WRONG_CONTROL_PLANE' | 'INVALID_LEASE') {
    super(code); this.name = 'JobExecutionError';
  }
}

type JobRow = {
  id: string; status: JobStatus; buyer_account_id: string; capability_version_id: string;
  worker_device_id: string; payment_reservation_id: string | null; result_manifest_id: string | null;
  contract_snapshot: unknown;
};
type TransitionRow = {
  id: string; job_id: string; from_status: JobStatus; to_status: JobStatus; at: Date;
  actor: JobTransition['actor']; reason: string; attempt_id: string | null;
  correlation_id: string; payment_reservation_id: string | null; result_manifest_id: string | null;
};
type ExecutionRow = {
  id: string; job_id: string; attempt_id: string; worker_device_id: string;
  control_plane_id: string; lease_key_version: string; lease_token_hash: string; lease_expires_at: Date;
  offer_expires_at: Date; accepted_at: Date | null; completed_at: Date | null;
};

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function equalDigest(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function rowToTransition(row: TransitionRow): JobTransition {
  return JobTransitionSchema.parse({
    id: row.id, jobId: row.job_id, from: row.from_status, to: row.to_status,
    at: row.at.toISOString(), actor: row.actor, reason: row.reason, attemptId: row.attempt_id,
    correlationId: row.correlation_id, paymentReservationId: row.payment_reservation_id,
    resultManifestId: row.result_manifest_id,
  });
}

export interface JobEventInput {
  readonly id: string;
  readonly jobId: string;
  readonly from: JobStatus;
  readonly to: JobStatus;
  readonly actor: JobTransition['actor'];
  readonly reason: string;
  readonly attemptId: string | null;
  readonly correlationId: string;
  readonly paymentReservationId: string | null;
  readonly resultManifestId: string | null;
}

export interface DurableJobView {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly paymentReservationId: string | null;
  readonly transitions: readonly JobTransition[];
}

export type WorkerExecutionRecovery = {
  readonly executionId: string;
  readonly action: 'CONTINUE';
  readonly jobId: string;
  readonly attemptId: string;
  readonly status: JobStatus;
  readonly leaseToken: string;
  readonly leaseExpiresAt: string;
} | {
  readonly executionId: string;
  readonly action: 'STOP';
  readonly reason: 'UNKNOWN_OR_UNOWNED' | 'LEASE_EXPIRED' | 'JOB_NOT_ACTIVE' | 'PAYMENT_NOT_SECURED';
};

const submittedResultSchema = z.strictObject({
  resultManifestId: uuid,
  jobId: uuid,
  executionId: uuid,
  attemptId: uuid,
  workerDeviceId: uuid,
  controlPlaneId: controlPlane,
  leaseToken: z.string().min(32).max(512),
  payload: z.strictObject({ values: z.record(z.string(), z.unknown()),
    assets: z.record(z.string(), z.array(uuid).max(50)) }),
  assets: z.array(z.strictObject({
    id: uuid, fieldKey: z.string().min(1).max(160),
    objectKey: z.string().regex(/^private\/assets\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
    sizeBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    detectedMimeType: z.string().min(3).max(120),
  })).max(50),
});

/** One shared transaction boundary for both provider composition roots. */
export class PostgresJobExecutionRepository {
  constructor(private readonly pool: Pool, private readonly payment: PaymentReservationVerifier,
    private readonly leaseIssuer: LeaseTokenIssuer) {}

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async createJob(snapshotInput: unknown): Promise<DurableJobView> {
    const snapshot = JobContractSnapshotSchema.parse(snapshotInput);
    return this.transaction(async (client) => {
      const version = await client.query<{ id: string; version_snapshot: unknown; version_number: number }>(
        "SELECT id, version_snapshot, version_number FROM capability_versions WHERE id=$1 AND publication_state='PUBLISHED' FOR SHARE",
        [snapshot.capabilityVersionId]);
      const row = version.rows[0];
      if (!row) throw new JobExecutionError('NOT_ELIGIBLE');
      const published = PublishedCapabilityVersionSchema.parse(row.version_snapshot);
      const expected = createJobContractSnapshot(published, snapshot.jobId, snapshot.buyerAccountId, snapshot.createdAt);
      if (row.version_number !== snapshot.versionNumber || canonicalJson(expected) !== canonicalJson(snapshot)) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      await client.query('INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,status,contract_snapshot) VALUES($1,$2,$3,$4,\'CREATED\',$5)',
        [snapshot.jobId, snapshot.buyerAccountId, snapshot.capabilityVersionId, snapshot.workerDeviceId, snapshot]);
      return { jobId: snapshot.jobId, status: 'CREATED', paymentReservationId: null, transitions: [] };
    });
  }

  /** Finalized buyer inputs remain private; the offer exposes only this opaque identity/hash. */
  async finalizeInputManifest(jobId: string, manifestId: string, rawPayload: unknown): Promise<{
    id: string; schemaHash: string; manifestHash: string; totalBytes: number; fileCount: number;
  }> {
    uuid.parse(jobId); uuid.parse(manifestId);
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, jobId);
      if (!['CREATED', 'PAYMENT_RESERVED'].includes(job.status)) throw new JobExecutionError('NOT_ELIGIBLE');
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const payload = validateInputPayload(snapshot.inputContractSnapshot, rawPayload);
      const ids = Object.values(payload.assets).flat();
      if (new Set(ids).size !== ids.length || ids.length > 50) throw new JobExecutionError('NOT_ELIGIBLE');
      const versionResult = await client.query<{ version_snapshot: unknown }>(
        'SELECT version_snapshot FROM capability_versions WHERE id=$1 FOR SHARE', [job.capability_version_id]);
      const version = PublishedCapabilityVersionSchema.parse(versionResult.rows[0]?.version_snapshot);
      let totalBytes = Buffer.byteLength(canonicalJson(payload), 'utf8');
      const assetEvidence: { id: string; sizeBytes: number; sha256: string }[] = [];
      for (const id of ids) {
        const result = await client.query<{ id: string; owner_account_id: string; state: string;
          size_bytes: string; sha256: string; retain_until: Date }>(
          'SELECT id,owner_account_id,state,size_bytes,sha256,retain_until FROM assets WHERE id=$1 FOR SHARE', [id]);
        const asset = result.rows[0];
        if (!asset || asset.owner_account_id !== job.buyer_account_id || asset.state !== 'READY' ||
          asset.retain_until.getTime() <= Date.now()) throw new JobExecutionError('NOT_ELIGIBLE');
        const sizeBytes = Number(asset.size_bytes);
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new JobExecutionError('NOT_ELIGIBLE');
        totalBytes += sizeBytes;
        assetEvidence.push({ id, sizeBytes, sha256: asset.sha256 });
        if (totalBytes > version.resourceLimits.maxInputBytes) throw new JobExecutionError('NOT_ELIGIBLE');
        await client.query(`INSERT INTO asset_read_grants(id,asset_id,target_job_id,expires_at)
          VALUES($1,$2,$3,$4) ON CONFLICT(asset_id,target_job_id) DO NOTHING`,
        [randomUUID(), id, jobId, asset.retain_until]);
      }
      if (totalBytes > version.resourceLimits.maxInputBytes) throw new JobExecutionError('NOT_ELIGIBLE');
      const schemaHash = hashCanonicalJson(snapshot.inputContractSnapshot);
      const manifestHash = hashCanonicalJson({ jobId, payload, assets: assetEvidence.sort((a, b) =>
        a.id.localeCompare(b.id)) });
      const existing = await client.query<{ id: string; schema_hash: string; manifest_hash: string;
        total_bytes: string; file_count: number }>('SELECT * FROM job_input_manifests WHERE job_id=$1', [jobId]);
      if (existing.rows[0]) {
        const prior = existing.rows[0];
        if (prior.id !== manifestId || prior.schema_hash !== schemaHash || prior.manifest_hash !== manifestHash) {
          throw new JobExecutionError('CONFLICT');
        }
        return { id: prior.id, schemaHash, manifestHash,
          totalBytes: Number(prior.total_bytes), fileCount: prior.file_count };
      }
      await client.query(`INSERT INTO job_input_manifests(id,job_id,schema_hash,manifest_hash,payload,total_bytes,file_count)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [manifestId, jobId, schemaHash, manifestHash, payload, totalBytes, ids.length]);
      return { id: manifestId, schemaHash, manifestHash, totalBytes, fileCount: ids.length };
    });
  }

  async load(jobId: string): Promise<DurableJobView> {
    uuid.parse(jobId);
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, jobId, false);
      const transitions = await this.loadTransitions(client, jobId);
      return { jobId, status: job.status, paymentReservationId: job.payment_reservation_id, transitions };
    });
  }

  async transition(input: JobEventInput): Promise<DurableJobView> {
    const event = JobTransitionSchema.parse({ ...input, at: new Date().toISOString() });
    if (event.to === 'COMPLETED' || event.actor === 'WORKER') throw new JobExecutionError('NOT_ELIGIBLE');
    return this.transaction(async (client) => this.transitionLocked(client, event));
  }

  /** Caller first authenticates the device signature; the lease scopes the transition to one attempt. */
  async workerTransition(input: JobEventInput, executionId: string, workerDeviceId: string,
    planeId: string, leaseToken: string): Promise<DurableJobView> {
    const event = JobTransitionSchema.parse({ ...input, at: new Date().toISOString() });
    uuid.parse(executionId); uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (event.actor !== 'WORKER' || event.to === 'COMPLETED') throw new JobExecutionError('NOT_ELIGIBLE');
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, event.jobId);
      if (job.worker_device_id !== workerDeviceId) throw new JobExecutionError('WRONG_WORKER');
      const result = await client.query<ExecutionRow>(
        'SELECT * FROM job_executions WHERE id=$1 AND job_id=$2 AND completed_at IS NULL FOR UPDATE',
        [executionId, job.id]);
      const execution = result.rows[0];
      if (!execution || execution.attempt_id !== event.attemptId || !execution.accepted_at) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      if (execution.control_plane_id !== planeId) throw new JobExecutionError('WRONG_CONTROL_PLANE');
      if (!equalDigest(execution.lease_token_hash, digest(leaseToken))) throw new JobExecutionError('INVALID_LEASE');
      if (execution.lease_expires_at.getTime() <= Date.now()) throw new JobExecutionError('LEASE_EXPIRED');
      return this.transitionLocked(client, event);
    });
  }

  private async lockJob(client: PoolClient, jobId: string, lock = true): Promise<JobRow> {
    const result = await client.query<JobRow>(`SELECT * FROM jobs WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [jobId]);
    const row = result.rows[0];
    if (!row) throw new JobExecutionError('NOT_FOUND');
    return row;
  }

  private async loadTransitions(client: PoolClient, jobId: string): Promise<JobTransition[]> {
    const result = await client.query<TransitionRow>('SELECT * FROM job_transitions WHERE job_id=$1 ORDER BY sequence', [jobId]);
    return result.rows.map(rowToTransition);
  }

  private async transitionLocked(client: PoolClient, event: JobTransition): Promise<DurableJobView> {
    const job = await this.lockJob(client, event.jobId);
    const transitions = await this.loadTransitions(client, event.jobId);
    const duplicate = transitions.find((entry) => entry.id === event.id);
    if (duplicate) {
      const comparable = { ...event, at: duplicate.at };
      if (JSON.stringify(duplicate) !== JSON.stringify(comparable)) throw new JobExecutionError('CONFLICT');
      return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id, transitions };
    }
    const resolvedReservation = event.paymentReservationId ?? job.payment_reservation_id;
    if (executionStates.has(event.to) &&
      (!resolvedReservation || !await this.payment.isSecured(client, job.id, resolvedReservation))) {
      throw new JobExecutionError('PAYMENT_NOT_SECURED');
    }
    if (job.payment_reservation_id && event.paymentReservationId &&
      event.paymentReservationId !== job.payment_reservation_id) throw new JobExecutionError('CONFLICT');
    const next = applyJobTransition({ jobId: job.id, status: job.status, transitions }, event);
    await client.query(`INSERT INTO job_transitions(id,job_id,sequence,from_status,to_status,at,actor,reason,
      attempt_id,correlation_id,payment_reservation_id,result_manifest_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [event.id, job.id, transitions.length + 1, event.from, event.to, event.at, event.actor,
      event.reason, event.attemptId, event.correlationId, event.paymentReservationId, event.resultManifestId]);
    await client.query(`UPDATE jobs SET status=$2,
      payment_reservation_id=COALESCE(payment_reservation_id,$3),
      result_manifest_id=COALESCE(result_manifest_id,$4),
      started_at=CASE WHEN $2='RUNNING' THEN COALESCE(started_at,now()) ELSE started_at END,
      completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE completed_at END WHERE id=$1`,
    [job.id, event.to, event.paymentReservationId, event.resultManifestId]);
    if (terminalStates.has(event.to) || (event.from === 'DISPATCHED' && event.to === 'QUEUED')) {
      await client.query('UPDATE job_executions SET completed_at=now() WHERE job_id=$1 AND completed_at IS NULL', [job.id]);
    }
    return { jobId: job.id, status: next.status, paymentReservationId: resolvedReservation, transitions: next.transitions };
  }

  async offer(jobId: string, workerDeviceId: string, planeId: string, ttlSeconds: number): Promise<{
    executionId: string; attemptId: string; leaseToken: string; expiresAt: string;
    inputManifestId: string; inputManifestHash: string; inputSchemaHash: string;
    inputTotalBytes: number; inputFileCount: number;
  }> {
    uuid.parse(jobId); uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 5 || ttlSeconds > 3600) throw new RangeError('Invalid offer TTL');
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, jobId);
      if (job.status !== 'QUEUED' || job.worker_device_id !== workerDeviceId) throw new JobExecutionError('NOT_ELIGIBLE');
      if (!job.payment_reservation_id || !await this.payment.isSecured(client, jobId, job.payment_reservation_id)) {
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      }
      const input = await client.query<{ id: string; schema_hash: string; manifest_hash: string;
        total_bytes: string; file_count: number }>(
          'SELECT id,schema_hash,manifest_hash,total_bytes,file_count FROM job_input_manifests WHERE job_id=$1 FOR SHARE',
          [jobId]);
      const manifest = input.rows[0];
      if (!manifest) throw new JobExecutionError('NOT_ELIGIBLE');
      const worker = await client.query<{ status: string }>('SELECT status FROM worker_devices WHERE id=$1 FOR UPDATE', [workerDeviceId]);
      if (worker.rows[0]?.status !== 'ONLINE') throw new JobExecutionError('NOT_ELIGIBLE');
      const heartbeat = await client.query<{ reported_status: string; running_jobs: number; capacity: number }>(
        `SELECT reported_status,running_jobs,capacity FROM worker_heartbeats
         WHERE worker_device_id=$1 AND control_plane_id=$2 AND observed_at > now()-interval '30 seconds'`,
        [workerDeviceId, planeId]);
      const health = heartbeat.rows[0];
      if (!health || health.reported_status !== 'ONLINE' || health.capacity < 1) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const assigned = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count FROM job_executions
         WHERE worker_device_id=$1 AND completed_at IS NULL AND lease_expires_at > now()`,
        [workerDeviceId]);
      if (Math.max(assigned.rows[0]?.count ?? 0, health.running_jobs) >= health.capacity) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const active = await client.query('SELECT id FROM job_executions WHERE job_id=$1 AND completed_at IS NULL', [jobId]);
      if (active.rowCount) throw new JobExecutionError('CONFLICT');
      const executionId = randomUUID(); const attemptId = randomUUID();
      const keyVersion = this.leaseIssuer.currentKeyVersion;
      const leaseToken = this.leaseIssuer.derive({ executionId, jobId, attemptId,
        workerDeviceId, controlPlaneId: planeId, keyVersion });
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      await client.query(`INSERT INTO job_executions(id,job_id,attempt_id,worker_device_id,control_plane_id,
        lease_key_version,lease_token_hash,lease_expires_at,offer_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [executionId, jobId, attemptId, workerDeviceId, planeId, keyVersion, digest(leaseToken), expiresAt]);
      await this.transitionLocked(client, JobTransitionSchema.parse({ id: randomUUID(), jobId, from: 'QUEUED',
        to: 'DISPATCHED', at: new Date().toISOString(), actor: 'CLOUD', reason: 'JOB_OFFER',
        attemptId, correlationId: randomUUID(), paymentReservationId: null, resultManifestId: null }));
      return { executionId, attemptId, leaseToken, expiresAt,
        inputManifestId: manifest.id, inputManifestHash: manifest.manifest_hash,
        inputSchemaHash: manifest.schema_hash, inputTotalBytes: Number(manifest.total_bytes),
        inputFileCount: manifest.file_count };
    });
  }

  /** No buyer values/files are serialized in an offer. The payload unlocks only after ACCEPTED. */
  async materializeOffer(executionId: string): Promise<JobOffer> {
    uuid.parse(executionId);
    return this.transaction(async (client) => {
      const result = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1', [executionId]);
      const execution = result.rows[0];
      if (!execution) throw new JobExecutionError('NOT_FOUND');
      const job = await this.lockJob(client, execution.job_id);
      if (job.status !== 'DISPATCHED' || execution.accepted_at || execution.completed_at ||
        execution.offer_expires_at.getTime() <= Date.now()) throw new JobExecutionError('NOT_ELIGIBLE');
      const leaseToken = this.leaseIssuer.derive({ executionId: execution.id,
        jobId: execution.job_id, attemptId: execution.attempt_id,
        workerDeviceId: execution.worker_device_id,
        controlPlaneId: execution.control_plane_id, keyVersion: execution.lease_key_version });
      if (!equalDigest(execution.lease_token_hash, digest(leaseToken))) throw new JobExecutionError('INVALID_LEASE');
      if (!job.payment_reservation_id || !await this.payment.isSecured(client, job.id, job.payment_reservation_id)) {
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      }
      const versionResult = await client.query<{ version_snapshot: unknown }>(
        'SELECT version_snapshot FROM capability_versions WHERE id=$1 FOR SHARE', [job.capability_version_id]);
      const version = PublishedCapabilityVersionSchema.parse(versionResult.rows[0]?.version_snapshot);
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const inputResult = await client.query<{ id: string; schema_hash: string; manifest_hash: string;
        total_bytes: string; file_count: number }>(
          'SELECT * FROM job_input_manifests WHERE job_id=$1 FOR SHARE', [job.id]);
      const input = inputResult.rows[0];
      if (!input || input.schema_hash !== hashCanonicalJson(snapshot.inputContractSnapshot) ||
        version.id !== snapshot.capabilityVersionId || version.workerDeviceId !== job.worker_device_id) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      return JobOfferSchema.parse({ type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
        messageId: randomUUID(), controlPlaneId: execution.control_plane_id,
        jobId: job.id, executionId: execution.id, attemptId: execution.attempt_id,
        workerDeviceId: job.worker_device_id, capabilityId: version.capabilityId,
        capabilityVersionId: version.id, inputManifestId: input.id,
        paymentReservationId: job.payment_reservation_id,
        workerManifestHash: version.workerManifestHash, localPackageHash: version.localPackageHash,
        permissionPolicyHash: version.permissionPolicyHash,
        policyValidationHash: version.policyValidationHash,
        inputSchemaHash: input.schema_hash, inputManifestHash: input.manifest_hash,
        inputTotalBytes: Number(input.total_bytes), inputFileCount: input.file_count,
        pauseSupport: snapshot.pauseSupportSnapshot,
        expiresAt: execution.offer_expires_at.toISOString(), leaseToken,
        paymentSecured: true });
    });
  }

  async pendingOffers(workerDeviceId: string, planeId: string, limit = 16): Promise<readonly JobOffer[]> {
    uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64) throw new RangeError('Invalid poll limit');
    const pending = await this.pool.query<{ id: string }>(`SELECT e.id FROM job_executions e
      JOIN jobs j ON j.id=e.job_id WHERE e.worker_device_id=$1 AND e.control_plane_id=$2
      AND e.accepted_at IS NULL AND e.completed_at IS NULL AND e.offer_expires_at > now()
      AND j.status='DISPATCHED' ORDER BY e.created_at LIMIT $3`, [workerDeviceId, planeId, limit]);
    const offers: JobOffer[] = [];
    for (const row of pending.rows) {
      try { offers.push(await this.materializeOffer(row.id)); }
      catch (error) {
        if (!(error instanceof JobExecutionError && ['NOT_ELIGIBLE', 'PAYMENT_NOT_SECURED'].includes(error.code))) {
          throw error;
        }
      }
    }
    return offers;
  }

  /** A reconnect never trusts the Worker's claimed active list or changes its execution owner. */
  async reconcileWorkerExecutions(workerDeviceId: string, planeId: string,
    rawExecutionIds: readonly string[]): Promise<readonly WorkerExecutionRecovery[]> {
    uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (rawExecutionIds.length > 64 || new Set(rawExecutionIds).size !== rawExecutionIds.length) {
      throw new JobExecutionError('NOT_ELIGIBLE');
    }
    const executionIds = rawExecutionIds.map((id) => uuid.parse(id)).sort();
    return this.transaction(async (client) => {
      const decisions: WorkerExecutionRecovery[] = [];
      for (const executionId of executionIds) {
        const row = await client.query<ExecutionRow & { job_status: JobStatus;
          payment_reservation_id: string | null }>(`SELECT e.*,j.status AS job_status,
          j.payment_reservation_id FROM job_executions e JOIN jobs j ON j.id=e.job_id
          WHERE e.id=$1 FOR SHARE OF e,j`, [executionId]);
        const execution = row.rows[0];
        if (!execution || execution.worker_device_id !== workerDeviceId ||
          execution.control_plane_id !== planeId) {
          decisions.push({ executionId, action: 'STOP', reason: 'UNKNOWN_OR_UNOWNED' });
          continue;
        }
        if (execution.lease_expires_at.getTime() <= Date.now()) {
          decisions.push({ executionId, action: 'STOP', reason: 'LEASE_EXPIRED' });
          continue;
        }
        if (!execution.accepted_at || execution.completed_at ||
          !['ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT', 'PAUSE_REQUESTED',
            'PAUSED', 'RESUME_REQUESTED', 'SECURITY_PAUSED', 'CANCEL_REQUESTED'].includes(execution.job_status)) {
          decisions.push({ executionId, action: 'STOP', reason: 'JOB_NOT_ACTIVE' });
          continue;
        }
        if (!execution.payment_reservation_id ||
          !await this.payment.isSecured(client, execution.job_id, execution.payment_reservation_id)) {
          decisions.push({ executionId, action: 'STOP', reason: 'PAYMENT_NOT_SECURED' });
          continue;
        }
        const leaseToken = this.leaseIssuer.derive({ executionId, jobId: execution.job_id,
          attemptId: execution.attempt_id, workerDeviceId,
          controlPlaneId: planeId, keyVersion: execution.lease_key_version });
        if (!equalDigest(execution.lease_token_hash, digest(leaseToken))) {
          throw new JobExecutionError('INVALID_LEASE');
        }
        decisions.push({ executionId, action: 'CONTINUE', jobId: execution.job_id,
          attemptId: execution.attempt_id, status: execution.job_status, leaseToken,
          leaseExpiresAt: execution.lease_expires_at.toISOString() });
      }
      return decisions;
    });
  }

  async accept(executionId: string, workerDeviceId: string, planeId: string, leaseToken: string,
    messageId: string): Promise<DurableJobView> {
    uuid.parse(executionId); uuid.parse(workerDeviceId); uuid.parse(messageId); controlPlane.parse(planeId);
    return this.transaction(async (client) => {
      const candidate = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1', [executionId]);
      if (!candidate.rows[0]) throw new JobExecutionError('NOT_FOUND');
      const job = await this.lockJob(client, candidate.rows[0].job_id);
      const result = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1 FOR UPDATE', [executionId]);
      const execution = result.rows[0];
      if (!execution) throw new JobExecutionError('NOT_FOUND');
      if (execution.worker_device_id !== workerDeviceId) throw new JobExecutionError('WRONG_WORKER');
      if (execution.control_plane_id !== planeId) throw new JobExecutionError('WRONG_CONTROL_PLANE');
      if (!equalDigest(execution.lease_token_hash, digest(leaseToken))) throw new JobExecutionError('INVALID_LEASE');
      const transitions = await this.loadTransitions(client, job.id);
      if (execution.accepted_at !== null) {
        return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id, transitions };
      }
      if (execution.offer_expires_at.getTime() <= Date.now() || execution.lease_expires_at.getTime() <= Date.now()) {
        throw new JobExecutionError('LEASE_EXPIRED');
      }
      if (job.status !== 'DISPATCHED') throw new JobExecutionError('NOT_ELIGIBLE');
      if (!job.payment_reservation_id || !await this.payment.isSecured(client, job.id, job.payment_reservation_id)) {
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      }
      const next = await this.transitionLocked(client, JobTransitionSchema.parse({ id: messageId,
        jobId: job.id, from: 'DISPATCHED', to: 'ACCEPTED', at: new Date().toISOString(),
        actor: 'WORKER', reason: 'JOB_ACCEPTED', attemptId: execution.attempt_id,
        correlationId: execution.id, paymentReservationId: null, resultManifestId: null }));
      await client.query('UPDATE job_executions SET accepted_at=now() WHERE id=$1', [executionId]);
      return next;
    });
  }

  async renewLease(executionId: string, workerDeviceId: string, planeId: string,
    leaseToken: string, ttlSeconds: number): Promise<string> {
    uuid.parse(executionId); uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 5 || ttlSeconds > 3600) throw new RangeError('Invalid lease TTL');
    return this.transaction(async (client) => {
      const candidate = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1', [executionId]);
      if (!candidate.rows[0]) throw new JobExecutionError('NOT_FOUND');
      const job = await this.lockJob(client, candidate.rows[0].job_id);
      const result = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1 FOR UPDATE', [executionId]);
      const execution = result.rows[0];
      if (!execution || execution.completed_at) throw new JobExecutionError('NOT_FOUND');
      if (execution.worker_device_id !== workerDeviceId) throw new JobExecutionError('WRONG_WORKER');
      if (execution.control_plane_id !== planeId) throw new JobExecutionError('WRONG_CONTROL_PLANE');
      if (!equalDigest(execution.lease_token_hash, digest(leaseToken))) throw new JobExecutionError('INVALID_LEASE');
      if (execution.lease_expires_at.getTime() <= Date.now()) throw new JobExecutionError('LEASE_EXPIRED');
      if (!['ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT', 'PAUSE_REQUESTED',
        'PAUSED', 'RESUME_REQUESTED', 'SECURITY_PAUSED'].includes(job.status)) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      if (!job.payment_reservation_id || !await this.payment.isSecured(client, job.id, job.payment_reservation_id)) {
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      }
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      await client.query('UPDATE job_executions SET lease_expires_at=$2 WHERE id=$1', [executionId, expiresAt]);
      return expiresAt;
    });
  }

  /** Bounded cron may reoffer only never-accepted expired offers; accepted work needs reconciliation. */
  async requeueExpiredOffers(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new RangeError('Invalid reconciliation limit');
    const result = await this.pool.query<{ id: string; job_id: string; attempt_id: string }>(
      `SELECT id,job_id,attempt_id FROM job_executions
       WHERE accepted_at IS NULL AND completed_at IS NULL AND offer_expires_at < now()
       ORDER BY offer_expires_at LIMIT $1`, [limit]);
    let changed = 0;
    for (const candidate of result.rows) {
      const didChange = await this.transaction(async (client) => {
        const job = await this.lockJob(client, candidate.job_id);
        const locked = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1 FOR UPDATE', [candidate.id]);
        const execution = locked.rows[0];
        if (!execution || execution.accepted_at || execution.completed_at ||
          execution.offer_expires_at.getTime() > Date.now() || job.status !== 'DISPATCHED') return false;
        await this.transitionLocked(client, JobTransitionSchema.parse({ id: randomUUID(), jobId: job.id,
          from: 'DISPATCHED', to: 'QUEUED', at: new Date().toISOString(), actor: 'CLOUD',
          reason: 'OFFER_EXPIRED', attemptId: execution.attempt_id, correlationId: execution.id,
          paymentReservationId: null, resultManifestId: null }));
        return true;
      });
      if (didChange) changed++;
    }
    return changed;
  }

  /** Only validated, private, durable deliverables can make a buyer-visible COMPLETED state. */
  async finalizeResult(raw: unknown, storage: ObjectStoragePort, retainUntil: string): Promise<DurableJobView> {
    const submitted = submittedResultSchema.parse(raw);
    const retention = z.iso.datetime({ offset: true }).parse(retainUntil);
    if (Date.parse(retention) <= Date.now()) throw new JobExecutionError('NOT_ELIGIBLE');
    const preliminary = await this.pool.query<{ version_snapshot: unknown }>(
      'SELECT v.version_snapshot FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id WHERE j.id=$1',
      [submitted.jobId]);
    const version = PublishedCapabilityVersionSchema.parse(preliminary.rows[0]?.version_snapshot);
    let total = 0;
    for (const asset of submitted.assets) {
      if (asset.objectKey.split('/')[2] !== asset.id) throw new JobExecutionError('NOT_ELIGIBLE');
      total += asset.sizeBytes;
      if (total > version.resourceLimits.maxOutputBytes) throw new JobExecutionError('NOT_ELIGIBLE');
      await verifyStoredObject(storage, { key: asset.objectKey, sizeBytes: asset.sizeBytes,
        sha256: asset.sha256, maxAllowedBytes: version.resourceLimits.maxOutputBytes });
    }
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, submitted.jobId);
      if (job.status === 'COMPLETED' && job.result_manifest_id === submitted.resultManifestId) {
        const existing = await client.query<{ payload: unknown }>('SELECT payload FROM job_result_manifests WHERE id=$1',
          [submitted.resultManifestId]);
        if (canonicalJson(existing.rows[0]?.payload) !== canonicalJson(submitted.payload)) {
          throw new JobExecutionError('CONFLICT');
        }
        return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id,
          transitions: await this.loadTransitions(client, job.id) };
      }
      if (job.status !== 'UPLOADING_RESULT' || job.worker_device_id !== submitted.workerDeviceId) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const executionResult = await client.query<ExecutionRow>('SELECT * FROM job_executions WHERE id=$1 FOR UPDATE',
        [submitted.executionId]);
      const execution = executionResult.rows[0];
      if (!execution || execution.job_id !== job.id || execution.attempt_id !== submitted.attemptId ||
        execution.worker_device_id !== submitted.workerDeviceId || execution.completed_at ||
        execution.lease_expires_at.getTime() <= Date.now()) throw new JobExecutionError('NOT_ELIGIBLE');
      if (execution.control_plane_id !== submitted.controlPlaneId) throw new JobExecutionError('WRONG_CONTROL_PLANE');
      if (!equalDigest(execution.lease_token_hash, digest(submitted.leaseToken))) {
        throw new JobExecutionError('INVALID_LEASE');
      }
      if (!job.payment_reservation_id || !await this.payment.isSecured(client, job.id, job.payment_reservation_id)) {
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      }
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const payload = validateOutputPayload(snapshot.outputContractSnapshot, submitted.payload);
      for (const asset of submitted.assets) {
        const field = snapshot.outputContractSnapshot.fields.find((item) => item.key === asset.fieldKey);
        if (!field || (field.type !== 'FILE' && field.type !== 'FILES') ||
          !field.constraints.allowedMimeTypes.includes(asset.detectedMimeType) ||
          asset.sizeBytes > field.constraints.maxFileSizeBytes) throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const suppliedIds = submitted.assets.map((asset) => asset.id).sort();
      const referencedIds = Object.values(payload.assets).flat().sort();
      if (canonicalJson(suppliedIds) !== canonicalJson(referencedIds) ||
        new Set(suppliedIds).size !== suppliedIds.length) throw new JobExecutionError('CONFLICT');
      await client.query(`INSERT INTO job_result_manifests(id,job_id,execution_id,attempt_id,schema_version,payload)
        VALUES($1,$2,$3,$4,1,$5)`, [submitted.resultManifestId, job.id, execution.id, execution.attempt_id, payload]);
      for (const asset of submitted.assets) {
        await client.query(`INSERT INTO assets(id,owner_account_id,source_job_id,kind,state,object_key,
          size_bytes,sha256,detected_mime_type,retain_until,finalized_at)
          VALUES($1,$2,$3,'JOB_OUTPUT','READY',$4,$5,$6,$7,$8,now())`,
        [asset.id, job.buyer_account_id, job.id, asset.objectKey, asset.sizeBytes,
          asset.sha256, asset.detectedMimeType, retention]);
        await client.query('INSERT INTO job_result_assets(manifest_id,asset_id,field_key) VALUES($1,$2,$3)',
          [submitted.resultManifestId, asset.id, asset.fieldKey]);
      }
      return this.transitionLocked(client, JobTransitionSchema.parse({ id: randomUUID(), jobId: job.id,
        from: 'UPLOADING_RESULT', to: 'COMPLETED', at: new Date().toISOString(), actor: 'CLOUD',
        reason: 'RESULT_DURABLY_FINALIZED', attemptId: execution.attempt_id,
        correlationId: execution.id, paymentReservationId: null,
        resultManifestId: submitted.resultManifestId }));
    });
  }

  /** Seller authorization is re-read under the job lock; buyer profile/prompt data never grants control. */
  async requestJobControl(raw: unknown, sellerAccountId: string): Promise<DurableJobView> {
    const command = JobControlCommandSchema.parse(raw);
    uuid.parse(sellerAccountId);
    if (command.action === 'CANCEL' || command.source !== 'WEB' || command.actorId !== sellerAccountId) {
      throw new JobExecutionError('NOT_ELIGIBLE');
    }
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, command.jobId);
      const owner = await client.query<{ account_id: string }>(`SELECT s.account_id
        FROM capability_versions v JOIN capabilities c ON c.id=v.capability_id
        JOIN seller_profiles s ON s.id=c.seller_profile_id WHERE v.id=$1`, [job.capability_version_id]);
      if (owner.rows[0]?.account_id !== sellerAccountId) throw new JobExecutionError('NOT_ELIGIBLE');
      const execution = await client.query<ExecutionRow>(
        'SELECT * FROM job_executions WHERE id=$1 AND job_id=$2 AND completed_at IS NULL FOR UPDATE',
        [command.executionId, job.id]);
      const active = execution.rows[0];
      if (!active || active.attempt_id !== command.attemptId ||
        active.control_plane_id !== command.controlPlaneId) throw new JobExecutionError('NOT_ELIGIBLE');
      const prior = await client.query<{ action: string; actor_id: string; source: string; job_id: string;
        execution_id: string; reason: string | null; requested_at: Date }>(
        'SELECT action,actor_id,source,job_id,execution_id,reason,requested_at FROM job_control_commands WHERE id=$1',
        [command.commandId]);
      if (prior.rows[0]) {
        if (prior.rows[0].action !== command.action || prior.rows[0].actor_id !== sellerAccountId ||
          prior.rows[0].source !== 'WEB' || prior.rows[0].job_id !== job.id ||
          prior.rows[0].execution_id !== active.id || prior.rows[0].reason !== command.reason ||
          prior.rows[0].requested_at.getTime() !== Date.parse(command.requestedAt)) {
          throw new JobExecutionError('CONFLICT');
        }
        return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id,
          transitions: await this.loadTransitions(client, job.id) };
      }
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const support: PauseSupport = snapshot.pauseSupportSnapshot;
      if (support !== 'FULL_RESUME') throw new JobExecutionError('NOT_ELIGIBLE');
      const target = command.action === 'PAUSE' ? 'PAUSE_REQUESTED' : 'RESUME_REQUESTED';
      if (command.action === 'PAUSE' && !['RUNNING', 'STARTING'].includes(job.status) ||
        command.action === 'RESUME' && job.status !== 'PAUSED') throw new JobExecutionError('NOT_ELIGIBLE');
      await client.query(`INSERT INTO job_control_commands(id,job_id,execution_id,action,source,
        actor_id,reason,previous_state,requested_at,pause_support)
        VALUES($1,$2,$3,$4,'WEB',$5,$6,$7,$8,$9)`,
      [command.commandId, job.id, active.id, command.action, sellerAccountId, command.reason,
        job.status, command.requestedAt, support]);
      return this.transitionLocked(client, JobTransitionSchema.parse({ id: command.commandId,
        jobId: job.id, from: job.status, to: target, at: new Date().toISOString(),
        actor: 'SELLER', reason: command.action === 'PAUSE' ? 'SELLER_PAUSE_REQUEST' : 'SELLER_RESUME_REQUEST',
        attemptId: active.attempt_id, correlationId: active.id,
        paymentReservationId: null, resultManifestId: null }));
    });
  }

  /** Caller must pass identity from signed Worker authentication, not the untrusted ack body. */
  async acknowledgeJobControl(raw: unknown, authenticatedWorkerDeviceId: string,
    authenticatedControlPlaneId: string): Promise<DurableJobView> {
    const ack = z.strictObject({
      commandId: uuid, jobId: uuid, executionId: uuid, attemptId: uuid,
      workerDeviceId: uuid, controlPlaneId: controlPlane,
      status: z.enum(['PAUSED', 'RUNNING', 'SECURITY_PAUSED', 'CONTROL_FAILED', 'RESUME_NOT_READY',
        'DEPENDENCY_UNAVAILABLE', 'INFERENCE_UNAVAILABLE', 'SECURITY_BLOCK']),
      localRevision: z.number().int().nonnegative(),
      confirmedAt: z.iso.datetime().nullable(),
    }).parse(raw);
    if (ack.workerDeviceId !== uuid.parse(authenticatedWorkerDeviceId)) throw new JobExecutionError('WRONG_WORKER');
    if (ack.controlPlaneId !== controlPlane.parse(authenticatedControlPlaneId)) {
      throw new JobExecutionError('WRONG_CONTROL_PLANE');
    }
    return this.transaction(async (client) => {
      const job = await this.lockJob(client, ack.jobId);
      if (job.worker_device_id !== ack.workerDeviceId) throw new JobExecutionError('WRONG_WORKER');
      const execution = await client.query<ExecutionRow>(
        'SELECT * FROM job_executions WHERE id=$1 AND job_id=$2 AND completed_at IS NULL FOR UPDATE',
        [ack.executionId, job.id]);
      const active = execution.rows[0];
      if (!active || active.attempt_id !== ack.attemptId) throw new JobExecutionError('NOT_ELIGIBLE');
      if (active.control_plane_id !== ack.controlPlaneId) throw new JobExecutionError('WRONG_CONTROL_PLANE');
      if (active.lease_expires_at.getTime() <= Date.now()) throw new JobExecutionError('LEASE_EXPIRED');
      const commands = await client.query<{ action: string; confirmed_at: Date | null; resulting_state: string | null }>(
        'SELECT action,confirmed_at,resulting_state FROM job_control_commands WHERE id=$1 AND job_id=$2 AND execution_id=$3 FOR UPDATE',
        [ack.commandId, job.id, active.id]);
      const command = commands.rows[0];
      if (!command) throw new JobExecutionError('NOT_FOUND');
      const expected = command.action === 'PAUSE' ? 'PAUSE_REQUESTED' : 'RESUME_REQUESTED';
      const failure = ['CONTROL_FAILED', 'RESUME_NOT_READY', 'DEPENDENCY_UNAVAILABLE',
        'INFERENCE_UNAVAILABLE', 'SECURITY_BLOCK'].includes(ack.status);
      if (failure) {
        if (command.confirmed_at || job.status !== expected || ack.confirmedAt !== null ||
          command.action === 'PAUSE' && ack.status !== 'CONTROL_FAILED') {
          throw new JobExecutionError('NOT_ELIGIBLE');
        }
        // An error reports uncertainty, not a verified local execution state. Keep the
        // request visible until the Worker confirms actual state or reconciliation stops it.
        await client.query(`UPDATE job_control_commands SET last_failure_status=$2,
          last_failure_at=COALESCE(last_failure_at,now()) WHERE id=$1`, [ack.commandId, ack.status]);
        return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id,
          transitions: await this.loadTransitions(client, job.id) };
      }
      const result = ack.status;
      if (command.action === 'PAUSE' && !['PAUSED', 'SECURITY_PAUSED', 'RUNNING'].includes(result) ||
        command.action === 'RESUME' && !['RUNNING', 'PAUSED'].includes(result)) throw new JobExecutionError('NOT_ELIGIBLE');
      if (command.confirmed_at) {
        if (command.resulting_state !== result) throw new JobExecutionError('CONFLICT');
        return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id,
          transitions: await this.loadTransitions(client, job.id) };
      }
      if (job.status !== expected || ack.confirmedAt === null) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      await client.query('UPDATE job_control_commands SET confirmed_at=now(),resulting_state=$2 WHERE id=$1',
        [ack.commandId, result]);
      return this.transitionLocked(client, JobTransitionSchema.parse({ id: randomUUID(),
        jobId: job.id, from: expected, to: result, at: new Date().toISOString(),
        actor: 'WORKER', reason: ack.status, attemptId: active.attempt_id,
        correlationId: active.id, paymentReservationId: null, resultManifestId: null }));
    });
  }
}
