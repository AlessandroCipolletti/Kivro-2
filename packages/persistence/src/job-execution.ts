import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { JobContractSnapshotSchema, PublishedCapabilityVersionSchema,
  type JobContractSnapshot } from '../../contracts/src/capability-version.js';
import { JobTransitionSchema, type JobStatus, type JobTransition } from '../../contracts/src/job-lifecycle.js';
import { applyJobTransition } from '../../domain/src/job-lifecycle.js';
import { createJobContractSnapshot } from '../../domain/src/capability-version.js';
import { canonicalJson, hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { validateInputPayload, validateOutputPayload } from '../../contracts/src/contract-values.js';
import { verifyStoredObject } from '../../application/src/object-integrity.js';
import type { ObjectStoragePort } from '../../infrastructure/contracts/src/ports.js';
import { JobControlCommandSchema, type PauseSupport } from '../../contracts/src/job-control.js';
import { JobOfferSchema, WorkerLocalJobControlReportSchema, WORKER_PROTOCOL_VERSION,
  type JobOffer } from '../../worker-protocol/src/messages.js';
import type { LeaseTokenIssuer } from '../../application/src/lease-token.js';
import { SUPPORTED_FILE_TYPES, isMatchingFileType } from '../../contracts/src/file-types.js';
import { AvailabilityError } from './availability.js';
import { newPrivateAssetKey } from '../../contracts/src/assets.js';
import type { MalwareScannerPort } from '../../infrastructure/contracts/src/malware-ports.js';
import { verifyResultFileType } from '../../application/src/result-file-safety.js';

const uuid = z.uuid();
const controlPlane = z.string().min(1).max(160);
const executionStates = new Set<JobStatus>([
  'PAYMENT_RESERVED', 'WAITING_FOR_AVAILABILITY', 'QUEUED', 'WAITING_FOR_WORKER', 'DISPATCHED', 'ACCEPTED', 'STARTING',
  'RUNNING', 'UPLOADING_RESULT', 'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED',
  'SECURITY_PAUSED', 'CANCEL_REQUESTED', 'COMPLETED',
]);
const terminalStates = new Set<JobStatus>([
  'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED_STARTUP', 'FAILED_POLICY',
  'FAILED_EXECUTION', 'TIMED_OUT', 'WORKER_OFFLINE', 'RESULT_REJECTED',
]);

/** Bound to the Core financial ledger by the cloud composition root. Worker messages cannot implement it. */
export interface PaymentReservationVerifier {
  isSecured(client: PoolClient, jobId: string, reservationId: string): Promise<boolean>;
  releaseFailedJobInTransaction(client: PoolClient, jobId: string): Promise<void>;
}

/** M09 controls eligibility; M07 retains the offer, lease and Worker transition authority. */
export interface JobAvailabilityVerifier {
  assertEligible(client: PoolClient, jobId: string, stage: 'OFFER' | 'ACCEPT' | 'START'): Promise<void>;
}

export class JobExecutionError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'PAYMENT_NOT_SECURED' | 'NOT_ELIGIBLE' |
    'LEASE_EXPIRED' | 'WRONG_WORKER' | 'WRONG_CONTROL_PLANE' | 'INVALID_LEASE' |
    'SCAN_UNAVAILABLE' | 'ABUSE_DENIED') {
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

export interface AcceptedWorkerInput {
  readonly jobId: string;
  readonly executionId: string;
  readonly attemptId: string;
  readonly buyerAccountId: string;
  readonly outputRetainUntil: string;
  readonly inputManifestId: string;
  readonly inputManifestHash: string;
  readonly inputSchemaHash: string;
  readonly inputContract: JobContractSnapshot['inputContractSnapshot'];
  readonly outputContract: JobContractSnapshot['outputContractSnapshot'];
  readonly payload: ReturnType<typeof validateInputPayload>;
  readonly stagedAssets: Readonly<Record<string, readonly { assetId: string; extension: string;
    detectedMimeType: string; sizeBytes: number }[]>>;
  readonly downloads: readonly { binding: { fieldKey: string; assetId: string; path: string;
    detectedMimeType: string; sizeBytes: number }; signedGetUrl: string; expectedSha256: string }[];
}

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
const outputIntentSchema=z.strictObject({
  assetId:uuid,jobId:uuid,executionId:uuid,attemptId:uuid,workerDeviceId:uuid,
  controlPlaneId:controlPlane,leaseToken:z.string().min(32).max(512),
  fieldKey:z.string().min(1).max(160),
  extension:z.string().regex(/^[.][a-z0-9]{1,16}$/),
  sizeBytes:z.number().int().nonnegative().max(1_073_741_824),
  sha256:z.string().regex(/^sha256:[a-f0-9]{64}$/),
  detectedMimeType:z.string().min(3).max(120),
});
type StoredOutputIntent={asset_id:string;job_id:string;execution_id:string;attempt_id:string;
  worker_device_id:string;object_key:string;field_key:string;extension:string;size_bytes:string;
  sha256:string;detected_mime_type:string;expires_at:Date;consumed_at:Date|null};
function matchesOutputIntent(intent:StoredOutputIntent,asset:{id:string;fieldKey:string;
  objectKey:string;sizeBytes:number;sha256:string;detectedMimeType:string},
  binding:{jobId:string;executionId:string;attemptId:string;workerDeviceId:string}):boolean{
  return intent.asset_id===asset.id&&intent.job_id===binding.jobId&&
    intent.execution_id===binding.executionId&&intent.attempt_id===binding.attemptId&&
    intent.worker_device_id===binding.workerDeviceId&&intent.object_key===asset.objectKey&&
    intent.field_key===asset.fieldKey&&Number(intent.size_bytes)===asset.sizeBytes&&
    intent.sha256===asset.sha256&&intent.detected_mime_type===asset.detectedMimeType&&
    intent.expires_at.getTime()>Date.now()&&intent.consumed_at===null;
}

/** One shared transaction boundary for both provider composition roots. */
export class PostgresJobExecutionRepository {
  constructor(private readonly pool: Pool, private readonly payment: PaymentReservationVerifier,
    private readonly leaseIssuer: LeaseTokenIssuer,
    private readonly availability?: JobAvailabilityVerifier,
    private readonly malwareScanner?: MalwareScannerPort) {}

  private async mustBeEligible(client: PoolClient, jobId: string,
    stage: 'OFFER' | 'ACCEPT' | 'START'): Promise<void> {
    if (!this.availability) throw new JobExecutionError('NOT_ELIGIBLE');
    try { await this.availability.assertEligible(client, jobId, stage); }
    catch (error) {
      if (error instanceof AvailabilityError) throw new JobExecutionError('NOT_ELIGIBLE');
      throw error;
    }
    // The switch and actor rows are locked against operator mutations. An
    // offer created before suspension must not be accepted or started later.
    const control=await client.query<{halted:boolean}>(
      'SELECT halted FROM platform_dispatch_control WHERE singleton=true FOR SHARE');
    if(control.rows[0]?.halted!==false)throw new JobExecutionError('NOT_ELIGIBLE');
    const actors=await client.query(`SELECT 1 FROM jobs j
      JOIN accounts buyer ON buyer.id=j.buyer_account_id
      JOIN capability_versions v ON v.id=j.capability_version_id
      JOIN capabilities c ON c.id=v.capability_id
      JOIN seller_profiles seller ON seller.id=c.seller_profile_id
      JOIN accounts seller_account ON seller_account.id=seller.account_id
      JOIN worker_devices worker ON worker.id=j.worker_device_id
      WHERE j.id=$1 AND buyer.status='ACTIVE' AND seller_account.status='ACTIVE'
        AND seller.status='ACTIVE' AND c.status='PUBLISHED' AND worker.status='ONLINE'
        AND jsonb_typeof(v.version_snapshot->'externalProcessors')='array'
      FOR SHARE OF buyer,seller_account,seller,c,worker`,[jobId]);
    if(!actors.rowCount)throw new JobExecutionError('NOT_ELIGIBLE');
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>,
    beforeCommit?: () => void): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      beforeCommit?.();
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
      const version = await client.query<{ id: string; version_snapshot: unknown; version_number: number;
        seller_profile_id: string }>(
        `SELECT v.id,v.version_snapshot,v.version_number,c.seller_profile_id
         FROM capability_versions v JOIN capabilities c ON c.id=v.capability_id
         WHERE v.id=$1 AND v.publication_state='PUBLISHED' FOR SHARE OF v,c`,
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
      const price = snapshot.priceSnapshot;
      await client.query(`INSERT INTO job_financial_snapshots(job_id,seller_profile_id,price_tier_id,
        currency,buyer_price_minor,platform_fee_minor,seller_earning_minor,
        tax_minor,buyer_total_minor) VALUES($1,$2,$3,'USD',$4,$5,$6,0,$4)`,
      [snapshot.jobId, row.seller_profile_id, price.tier,
        price.buyerAmountMinor, price.platformFeeMinor, price.sellerEarningMinor]);
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
      // Buyers may secure a scheduled job before its inputs finish uploading. The
      // manifest is immutable once an offer can leave the control plane.
      if (!['CREATED', 'PAYMENT_RESERVED', 'WAITING_FOR_AVAILABILITY', 'QUEUED',
        'WAITING_FOR_WORKER'].includes(job.status)) throw new JobExecutionError('NOT_ELIGIBLE');
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const payload = validateInputPayload(snapshot.inputContractSnapshot, rawPayload);
      const schemaHash = hashCanonicalJson(snapshot.inputContractSnapshot);
      const existing = await client.query<{ id:string;schema_hash:string;manifest_hash:string;
        total_bytes:string;file_count:number;payload:unknown }>(
        'SELECT * FROM job_input_manifests WHERE job_id=$1',[jobId]);
      if(existing.rows[0]){
        const prior=existing.rows[0];
        if(prior.id!==manifestId||prior.schema_hash!==schemaHash||
          canonicalJson(prior.payload)!==canonicalJson(payload))throw new JobExecutionError('CONFLICT');
        return {id:prior.id,schemaHash,manifestHash:prior.manifest_hash,
          totalBytes:Number(prior.total_bytes),fileCount:prior.file_count};
      }
      const rules=await client.query<{normalized_pattern:string}>(
        'SELECT normalized_pattern FROM abuse_content_rules WHERE active=true LIMIT 201');
      if(rules.rows.length>200)throw new JobExecutionError('ABUSE_DENIED');
      const normalizedValues=canonicalJson(payload.values).normalize('NFKC')
        .toLocaleLowerCase('en-US');
      if(rules.rows.some((rule)=>normalizedValues.includes(rule.normalized_pattern)))
        throw new JobExecutionError('ABUSE_DENIED');
      const ids = Object.values(payload.assets).flat();
      if (new Set(ids).size !== ids.length || ids.length > 50) throw new JobExecutionError('NOT_ELIGIBLE');
      const versionResult = await client.query<{ version_snapshot: unknown }>(
        'SELECT version_snapshot FROM capability_versions WHERE id=$1 FOR SHARE', [job.capability_version_id]);
      const version = PublishedCapabilityVersionSchema.parse(versionResult.rows[0]?.version_snapshot);
      const schedulePlan = await client.query<{latest_start_at:Date}>(
        'SELECT latest_start_at FROM job_schedule_plans WHERE job_id=$1',[jobId]);
      const latestStart = schedulePlan.rows[0]?.latest_start_at;
      const minimumRetention = latestStart ?
        new Date(latestStart.getTime()+version.resourceLimits.timeoutSeconds*1000+86_400_000) : null;
      if (minimumRetention && !Number.isFinite(minimumRetention.getTime()))
        throw new JobExecutionError('NOT_ELIGIBLE');
      let totalBytes = Buffer.byteLength(canonicalJson(payload), 'utf8');
      const assetEvidence: { id: string; sizeBytes: number; sha256: string }[] = [];
      for (const id of ids) {
        const result = await client.query<{ id: string; owner_account_id: string; state: string;
          kind:string;source_job_id:string|null;size_bytes: string; sha256: string; retain_until: Date }>(
          'SELECT id,owner_account_id,state,kind,source_job_id,size_bytes,sha256,retain_until FROM assets WHERE id=$1 FOR UPDATE', [id]);
        const asset = result.rows[0];
        if (!asset || asset.owner_account_id !== job.buyer_account_id || asset.state !== 'READY' ||
          asset.retain_until.getTime() <= Date.now()) throw new JobExecutionError('NOT_ELIGIBLE');
        if(asset.kind==='JOB_OUTPUT'){
          const delivered=await client.query(`SELECT 1 FROM jobs source
            JOIN job_payment_states payment ON payment.job_id=source.id AND payment.state='SETTLED'
            JOIN job_result_manifests manifest ON manifest.job_id=source.id
            JOIN job_result_assets result ON result.manifest_id=manifest.id AND result.asset_id=$2
            WHERE source.id=$1 AND source.buyer_account_id=$3 AND source.status='COMPLETED'`,
          [asset.source_job_id,id,job.buyer_account_id]);
          if(!delivered.rows[0])throw new JobExecutionError('NOT_ELIGIBLE');
        }
        const sizeBytes = Number(asset.size_bytes);
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new JobExecutionError('NOT_ELIGIBLE');
        totalBytes += sizeBytes;
        assetEvidence.push({ id, sizeBytes, sha256: asset.sha256 });
        if (totalBytes > version.resourceLimits.maxInputBytes) throw new JobExecutionError('NOT_ELIGIBLE');
        if (minimumRetention && asset.retain_until < minimumRetention) {
          await client.query('UPDATE assets SET retain_until=$2 WHERE id=$1',
            [id,minimumRetention]);
        }
        const grantExpiresAt=minimumRetention && minimumRetention>asset.retain_until?
          minimumRetention:asset.retain_until;
        await client.query(`INSERT INTO asset_read_grants(id,asset_id,target_job_id,expires_at)
          VALUES($1,$2,$3,$4) ON CONFLICT(asset_id,target_job_id) DO UPDATE
          SET expires_at=GREATEST(asset_read_grants.expires_at,EXCLUDED.expires_at)`,
        [randomUUID(), id, jobId, grantExpiresAt]);
      }
      if (totalBytes > version.resourceLimits.maxInputBytes) throw new JobExecutionError('NOT_ELIGIBLE');
      const manifestHash = hashCanonicalJson({ jobId, payload, assets: assetEvidence.sort((a, b) =>
        a.id.localeCompare(b.id)) });
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
    if (['DISPATCHED','ACCEPTED','STARTING','RUNNING','UPLOADING_RESULT','COMPLETED'].includes(event.to) ||
      event.actor === 'WORKER') throw new JobExecutionError('NOT_ELIGIBLE');
    return this.transaction(async (client) => this.transitionLocked(client, event));
  }

  /** Caller first authenticates the device signature; the lease scopes the transition to one attempt. */
  async workerTransition(input: JobEventInput, executionId: string, workerDeviceId: string,
    planeId: string, leaseToken: string): Promise<DurableJobView> {
    const event = JobTransitionSchema.parse({ ...input, at: new Date().toISOString() });
    uuid.parse(executionId); uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (event.actor !== 'WORKER' || event.to === 'COMPLETED') throw new JobExecutionError('NOT_ELIGIBLE');
    return this.transaction(async (client) => {
      if (event.to === 'STARTING') {
        const prior = await client.query('SELECT id FROM job_transitions WHERE id=$1 AND job_id=$2',
          [event.id, event.jobId]);
        if (!prior.rows[0]) await this.mustBeEligible(client, event.jobId, 'START');
      }
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
      completed_at=CASE WHEN $5 THEN now() ELSE completed_at END WHERE id=$1`,
    [job.id, event.to, event.paymentReservationId, event.resultManifestId,
      terminalStates.has(event.to)]);
    if (terminalStates.has(event.to) || (event.from === 'DISPATCHED' && event.to === 'QUEUED')) {
      await client.query('UPDATE job_executions SET completed_at=now() WHERE job_id=$1 AND completed_at IS NULL', [job.id]);
    }
    if(terminalStates.has(event.to)&&event.to!=='COMPLETED'&&resolvedReservation)
      await this.payment.releaseFailedJobInTransaction(client,job.id);
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
      await this.mustBeEligible(client, jobId, 'OFFER');
      const job = await this.lockJob(client, jobId);
      if (job.status !== 'QUEUED' || job.worker_device_id !== workerDeviceId) throw new JobExecutionError('NOT_ELIGIBLE');
      // Serialize every offer against the operator's global dispatch switch.
      // Missing control state is a denial, never an implicit "on" state.
      const control = await client.query<{ halted: boolean }>(
        'SELECT halted FROM platform_dispatch_control WHERE singleton=true FOR SHARE');
      if (control.rows[0]?.halted !== false) throw new JobExecutionError('NOT_ELIGIBLE');
      const actors = await client.query(`SELECT 1 FROM jobs j
        JOIN accounts buyer ON buyer.id=j.buyer_account_id
        JOIN capability_versions v ON v.id=j.capability_version_id
        JOIN capabilities c ON c.id=v.capability_id
        JOIN seller_profiles seller ON seller.id=c.seller_profile_id
        JOIN accounts seller_account ON seller_account.id=seller.account_id
        WHERE j.id=$1 AND buyer.status='ACTIVE' AND seller_account.status='ACTIVE'
          AND seller.status='ACTIVE' AND c.status='PUBLISHED'
          AND jsonb_typeof(v.version_snapshot->'externalProcessors')='array'`,[jobId]);
      if (!actors.rowCount) throw new JobExecutionError('NOT_ELIGIBLE');
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
      await this.mustBeEligible(client, execution.job_id, 'ACCEPT');
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
      if (!candidate.rows[0].accepted_at) {
        await this.mustBeEligible(client, candidate.rows[0].job_id, 'ACCEPT');
      }
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

  /** Values and one-use file URLs are released only to the accepted, leased Worker. */
  async acceptedInputForWorker(executionId: string, workerDeviceId: string, planeId: string,
    leaseToken: string, storage: ObjectStoragePort, outputRetentionSeconds: number): Promise<AcceptedWorkerInput> {
    uuid.parse(executionId); uuid.parse(workerDeviceId); controlPlane.parse(planeId);
    if (!Number.isSafeInteger(outputRetentionSeconds) || outputRetentionSeconds < 86400 ||
      outputRetentionSeconds > 365 * 86400) throw new JobExecutionError('NOT_ELIGIBLE');
    const selected = await this.transaction(async (client) => {
      const executionResult = await client.query<ExecutionRow>(
        'SELECT * FROM job_executions WHERE id=$1 FOR SHARE', [executionId]);
      const execution = executionResult.rows[0];
      if (!execution || !execution.accepted_at || execution.completed_at ||
        execution.worker_device_id !== workerDeviceId || execution.control_plane_id !== planeId ||
        execution.lease_expires_at.getTime() <= Date.now() ||
        !equalDigest(execution.lease_token_hash, digest(leaseToken))) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const job = await this.lockJob(client, execution.job_id, false);
      if (job.status === 'ACCEPTED') await this.mustBeEligible(client, job.id, 'START');
      if (!['ACCEPTED', 'STARTING', 'RUNNING'].includes(job.status) ||
        !job.payment_reservation_id ||
        !await this.payment.isSecured(client, job.id, job.payment_reservation_id)) {
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      }
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const manifest = await client.query<{ id: string; payload: unknown; manifest_hash: string;
        schema_hash: string; total_bytes: string; file_count: number }>(
        'SELECT * FROM job_input_manifests WHERE job_id=$1 FOR SHARE', [job.id]);
      const row = manifest.rows[0];
      if (!row || row.schema_hash !== hashCanonicalJson(snapshot.inputContractSnapshot)) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const payload = validateInputPayload(snapshot.inputContractSnapshot, row.payload);
      const ids = Object.values(payload.assets).flat();
      if (new Set(ids).size !== ids.length || ids.length !== row.file_count) {
        throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const stagedAssets: Record<string, { assetId: string; extension: string;
        detectedMimeType: string; sizeBytes: number }[]> = Object.create(null);
      const files: { binding: { fieldKey: string; assetId: string; path: string;
        detectedMimeType: string; sizeBytes: number }; objectKey: string; sha256: string }[] = [];
      const hashAssets: { id: string; sizeBytes: number; sha256: string }[] = [];
      let totalBytes = Buffer.byteLength(canonicalJson(payload));
      for (const [fieldKey, references] of Object.entries(payload.assets)) {
        const field = snapshot.inputContractSnapshot.fields.find((candidate) => candidate.key === fieldKey);
        if (!field || (field.type !== 'FILE' && field.type !== 'FILES')) throw new JobExecutionError('NOT_ELIGIBLE');
        stagedAssets[fieldKey] = [];
        for (const id of references) {
          const assetResult = await client.query<{ owner_account_id: string; state: string;
            object_key: string; size_bytes: string; sha256: string;
            detected_mime_type: string; retain_until: Date }>(
            'SELECT owner_account_id,state,object_key,size_bytes,sha256,detected_mime_type,retain_until FROM assets WHERE id=$1 FOR SHARE',
            [id]);
          const asset = assetResult.rows[0];
          const grant = await client.query<{ expires_at: Date }>(
            'SELECT expires_at FROM asset_read_grants WHERE asset_id=$1 AND target_job_id=$2', [id, job.id]);
          const sizeBytes = Number(asset?.size_bytes);
          const type = SUPPORTED_FILE_TYPES.find((item) => item.mime === asset?.detected_mime_type);
          const extension = type?.extensions.find((candidate) => field.constraints.allowedExtensions.includes(candidate));
          if (!asset || asset.owner_account_id !== job.buyer_account_id || asset.state !== 'READY' ||
            asset.retain_until.getTime() <= Date.now() || !grant.rows[0] ||
            grant.rows[0].expires_at.getTime() <= Date.now() ||
            !Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || !extension ||
            !field.constraints.allowedMimeTypes.includes(asset.detected_mime_type)) {
            throw new JobExecutionError('NOT_ELIGIBLE');
          }
          totalBytes += sizeBytes;
          const binding = { fieldKey, assetId: id, path: `/job/input/${fieldKey}/${id}${extension}`,
            detectedMimeType: asset.detected_mime_type, sizeBytes };
          stagedAssets[fieldKey]!.push({ assetId: id, extension,
            detectedMimeType: asset.detected_mime_type, sizeBytes });
          files.push({ binding, objectKey: asset.object_key, sha256: asset.sha256 });
          hashAssets.push({ id, sizeBytes, sha256: asset.sha256 });
        }
      }
      if (totalBytes !== Number(row.total_bytes) ||
        hashCanonicalJson({ jobId: job.id, payload, assets: hashAssets.sort((a, b) =>
          a.id.localeCompare(b.id)) }) !== row.manifest_hash) throw new JobExecutionError('NOT_ELIGIBLE');
      return { jobId: job.id, executionId, attemptId: execution.attempt_id,
        buyerAccountId: job.buyer_account_id, inputManifestId: row.id,
        inputManifestHash: row.manifest_hash, inputSchemaHash: row.schema_hash,
        inputContract: snapshot.inputContractSnapshot, outputContract: snapshot.outputContractSnapshot,
        payload, stagedAssets, files };
    });
    const downloads = await Promise.all(selected.files.map(async (file) => ({
      binding: file.binding, signedGetUrl: await storage.presignPrivateDownload(file.objectKey, 300),
      expectedSha256: file.sha256,
    })));
    return { ...selected, downloads,
      outputRetainUntil: new Date(Date.now() + outputRetentionSeconds * 1000).toISOString() };
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
  async prepareResultAsset(raw:unknown,storage:ObjectStoragePort):Promise<{
    assetId:string;objectKey:string;uploadUrl:string;uploadHeaders:Readonly<Record<string,string>>}>{
    const input=outputIntentSchema.parse(raw);
    const objectKey=await this.transaction(async(client)=>{
      const job=await this.lockJob(client,input.jobId);
      if(job.status!=='UPLOADING_RESULT'||job.worker_device_id!==input.workerDeviceId)
        throw new JobExecutionError('NOT_ELIGIBLE');
      const found=await client.query<ExecutionRow>(
        'SELECT * FROM job_executions WHERE id=$1 FOR UPDATE',[input.executionId]);
      const execution=found.rows[0];
      if(!execution||execution.job_id!==job.id||execution.attempt_id!==input.attemptId||
        execution.worker_device_id!==input.workerDeviceId||
        execution.control_plane_id!==input.controlPlaneId||execution.completed_at||
        execution.lease_expires_at.getTime()<=Date.now()||
        !equalDigest(execution.lease_token_hash,digest(input.leaseToken)))
        throw new JobExecutionError('INVALID_LEASE');
      if(!job.payment_reservation_id||
        !await this.payment.isSecured(client,job.id,job.payment_reservation_id))
        throw new JobExecutionError('PAYMENT_NOT_SECURED');
      const snapshot=JobContractSnapshotSchema.parse(job.contract_snapshot);
      const field=snapshot.outputContractSnapshot.fields.find((item)=>item.key===input.fieldKey);
      if(!field||(field.type!=='FILE'&&field.type!=='FILES')||
        input.sizeBytes>field.constraints.maxFileSizeBytes||
        !isMatchingFileType(`result${input.extension}`,input.detectedMimeType,
          field.constraints.allowedMimeTypes,field.constraints.allowedExtensions))
        throw new JobExecutionError('NOT_ELIGIBLE');
      const prior=await client.query<StoredOutputIntent>(
        'SELECT * FROM job_result_upload_intents WHERE asset_id=$1 FOR UPDATE',[input.assetId]);
      if(prior.rows[0]){
        const existing=prior.rows[0];
        if(!matchesOutputIntent(existing,{id:input.assetId,fieldKey:input.fieldKey,
          objectKey:existing.object_key,sizeBytes:input.sizeBytes,sha256:input.sha256,
          detectedMimeType:input.detectedMimeType},input)||existing.extension!==input.extension)
          throw new JobExecutionError('CONFLICT');
        await client.query(`UPDATE job_result_upload_intents SET last_signed_at=now()
          WHERE asset_id=$1`,[input.assetId]);
        return existing.object_key;
      }
      const count=await client.query<{n:number}>(`SELECT count(*)::int AS n
        FROM job_result_upload_intents WHERE job_id=$1`,[job.id]);
      if((count.rows[0]?.n??50)>=50)throw new JobExecutionError('NOT_ELIGIBLE');
      const key=newPrivateAssetKey(input.assetId);
      await client.query(`INSERT INTO job_result_upload_intents(asset_id,job_id,execution_id,
        attempt_id,worker_device_id,object_key,field_key,size_bytes,sha256,
        detected_mime_type,extension,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '1 hour')`,
      [input.assetId,job.id,input.executionId,input.attemptId,input.workerDeviceId,key,
        input.fieldKey,input.sizeBytes,input.sha256,input.detectedMimeType,input.extension]);
      return key;
    });
    const signed=await storage.presignPrivateUpload(objectKey,{contentType:input.detectedMimeType,
      sizeBytes:input.sizeBytes,sha256:input.sha256 as `sha256:${string}`,expiresSeconds:600});
    return {assetId:input.assetId,objectKey,uploadUrl:signed.url,uploadHeaders:signed.headers};
  }

  /** Remove private staging objects only after every issued signed PUT has
   * expired. A restart can repeat deletion; the delivered cloud copy stays. */
  async reconcileOutputStaging(storage:ObjectStoragePort,limit=100):Promise<number>{
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new RangeError('Invalid cleanup limit');
    const rows=await this.pool.query<{asset_id:string;object_key:string}>(`
      SELECT i.asset_id,i.object_key FROM job_result_upload_intents i
      JOIN jobs j ON j.id=i.job_id
      WHERE i.source_deleted_at IS NULL AND
        i.last_signed_at<now()-interval '11 minutes' AND
        (i.consumed_at IS NOT NULL OR i.expires_at<now() OR
          j.status IN ('COMPLETED','REJECTED','EXPIRED','CANCELLED','FAILED_STARTUP',
            'FAILED_POLICY','FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'))
      ORDER BY i.created_at LIMIT $1`,[limit]);
    let removed=0;
    for(const row of rows.rows){
      const client=await this.pool.connect();
      try{
        await client.query('BEGIN');
        const current=await client.query<{object_key:string}>(`
          SELECT i.object_key FROM job_result_upload_intents i JOIN jobs j ON j.id=i.job_id
          WHERE i.asset_id=$1 AND i.source_deleted_at IS NULL AND
            i.last_signed_at<now()-interval '11 minutes' AND
            (i.consumed_at IS NOT NULL OR i.expires_at<now() OR
              j.status IN ('COMPLETED','REJECTED','EXPIRED','CANCELLED','FAILED_STARTUP',
                'FAILED_POLICY','FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'))
          FOR UPDATE OF i`,[row.asset_id]);
        if(current.rows[0]){
          await storage.deletePrivateObject(current.rows[0].object_key);
          await client.query(`UPDATE job_result_upload_intents SET source_deleted_at=now()
            WHERE asset_id=$1`,[row.asset_id]);
          removed++;
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}
      finally{client.release();}
    }
    return removed;
  }

  /** Only validated, private, durable deliverables can make a buyer-visible COMPLETED state. */
  async finalizeResult(raw: unknown, storage: ObjectStoragePort, retainUntil: string): Promise<DurableJobView> {
    const submitted = submittedResultSchema.parse(raw);
    const retention = z.iso.datetime({ offset: true }).parse(retainUntil);
    if (Date.parse(retention) <= Date.now()) throw new JobExecutionError('NOT_ELIGIBLE');
    // Authenticate the exact leased attempt before any cloud-side object read
    // or copy. Terminal retries may use an expired lease, but never a foreign one.
    const owned=await this.pool.query<ExecutionRow>(
      'SELECT * FROM job_executions WHERE id=$1',[submitted.executionId]);
    const candidate=owned.rows[0];
    if(!candidate||candidate.job_id!==submitted.jobId||
      candidate.attempt_id!==submitted.attemptId||
      candidate.worker_device_id!==submitted.workerDeviceId||
      candidate.control_plane_id!==submitted.controlPlaneId||
      !equalDigest(candidate.lease_token_hash,digest(submitted.leaseToken)))
      throw new JobExecutionError('INVALID_LEASE');
    const preliminary = await this.pool.query<{ version_snapshot: unknown }>(
      'SELECT v.version_snapshot FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id WHERE j.id=$1',
      [submitted.jobId]);
    const version = PublishedCapabilityVersionSchema.parse(preliminary.rows[0]?.version_snapshot);
    const prior=await this.pool.query<{status:JobStatus;result_manifest_id:string|null;
      payload:unknown}>(`SELECT j.status,j.result_manifest_id,m.payload FROM jobs j
      LEFT JOIN job_result_manifests m ON m.id=j.result_manifest_id WHERE j.id=$1`,[submitted.jobId]);
    if(prior.rows[0]?.status==='COMPLETED'&&
      prior.rows[0].result_manifest_id===submitted.resultManifestId){
      if(canonicalJson(prior.rows[0].payload)!==canonicalJson(submitted.payload))
        throw new JobExecutionError('CONFLICT');
      return this.load(submitted.jobId);
    }
    if(candidate.completed_at||candidate.lease_expires_at.getTime()<=Date.now())
      throw new JobExecutionError('NOT_ELIGIBLE');
    if(new Set(submitted.assets.map((asset)=>asset.id)).size!==submitted.assets.length)
      throw new JobExecutionError('CONFLICT');
    if(submitted.assets.length){
      const intents=await this.pool.query<StoredOutputIntent>(
        'SELECT * FROM job_result_upload_intents WHERE asset_id=ANY($1::uuid[])',
        [submitted.assets.map((asset)=>asset.id)]);
      const byId=new Map(intents.rows.map((row)=>[row.asset_id,row]));
      if(submitted.assets.some((asset)=>!byId.get(asset.id)||
        !matchesOutputIntent(byId.get(asset.id)!,asset,submitted)))
        throw new JobExecutionError('NOT_ELIGIBLE');
    }
    let total = 0;
    const trustedKeys=new Map<string,string>();
    const copiedKeys:string[]=[];
    let reused=false;
    let commitAttempted=false;
    try {
    for (const asset of submitted.assets) {
      if (asset.objectKey.split('/')[2] !== asset.id) throw new JobExecutionError('NOT_ELIGIBLE');
      total += asset.sizeBytes;
      if (total > version.resourceLimits.maxOutputBytes) throw new JobExecutionError('NOT_ELIGIBLE');
      // A Worker-held signed PUT may be replayed. Copy first to a fresh key
      // never disclosed to the Worker, then verify and scan those exact bytes.
      if(!this.malwareScanner)throw new JobExecutionError('SCAN_UNAVAILABLE');
      const trustedKey=newPrivateAssetKey(asset.id);
      await storage.copyPrivateObject(asset.objectKey,trustedKey);
      copiedKeys.push(trustedKey);trustedKeys.set(asset.id,trustedKey);
      await verifyStoredObject(storage, { key: trustedKey, sizeBytes: asset.sizeBytes,
        sha256: asset.sha256, maxAllowedBytes: version.resourceLimits.maxOutputBytes });
      await verifyResultFileType(storage,trustedKey,asset.detectedMimeType);
      await this.malwareScanner.scan(await storage.readPrivateObject(trustedKey),asset.sizeBytes);
    }
    const result=await this.transaction(async (client) => {
      const job = await this.lockJob(client, submitted.jobId);
      if (job.status === 'COMPLETED' && job.result_manifest_id === submitted.resultManifestId) {
        const existing = await client.query<{ payload: unknown }>('SELECT payload FROM job_result_manifests WHERE id=$1',
          [submitted.resultManifestId]);
        if (canonicalJson(existing.rows[0]?.payload) !== canonicalJson(submitted.payload)) {
          throw new JobExecutionError('CONFLICT');
        }
        reused=true;
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
        const format=SUPPORTED_FILE_TYPES.find((item)=>item.mime===asset.detectedMimeType);
        if (!field || (field.type !== 'FILE' && field.type !== 'FILES') ||
          !field.constraints.allowedMimeTypes.includes(asset.detectedMimeType) ||
          !format || !format.extensions.some((extension)=>
            field.constraints.allowedExtensions.includes(extension)) ||
          asset.sizeBytes > field.constraints.maxFileSizeBytes) throw new JobExecutionError('NOT_ELIGIBLE');
        const intent=await client.query<StoredOutputIntent>(
          'SELECT * FROM job_result_upload_intents WHERE asset_id=$1 FOR UPDATE',[asset.id]);
        if(!intent.rows[0]||!matchesOutputIntent(intent.rows[0],asset,submitted))
          throw new JobExecutionError('NOT_ELIGIBLE');
      }
      const suppliedIds = submitted.assets.map((asset) => asset.id).sort();
      const referencedIds = Object.values(payload.assets).flat().sort();
      if (canonicalJson(suppliedIds) !== canonicalJson(referencedIds) ||
        new Set(suppliedIds).size !== suppliedIds.length) throw new JobExecutionError('CONFLICT');
      await client.query(`INSERT INTO job_result_manifests(id,job_id,execution_id,attempt_id,schema_version,payload)
        VALUES($1,$2,$3,$4,1,$5)`, [submitted.resultManifestId, job.id, execution.id, execution.attempt_id, payload]);
      for (const asset of submitted.assets) {
        await client.query(`UPDATE job_result_upload_intents SET consumed_at=now()
          WHERE asset_id=$1 AND consumed_at IS NULL`,[asset.id]);
        await client.query(`INSERT INTO assets(id,owner_account_id,source_job_id,kind,state,object_key,
          size_bytes,sha256,detected_mime_type,retain_until,finalized_at)
          VALUES($1,$2,$3,'JOB_OUTPUT','READY',$4,$5,$6,$7,$8,now())`,
        [asset.id, job.buyer_account_id, job.id, trustedKeys.get(asset.id), asset.sizeBytes,
          asset.sha256, asset.detectedMimeType, retention]);
        await client.query('INSERT INTO job_result_assets(manifest_id,asset_id,field_key) VALUES($1,$2,$3)',
          [submitted.resultManifestId, asset.id, asset.fieldKey]);
      }
      return this.transitionLocked(client, JobTransitionSchema.parse({ id: randomUUID(), jobId: job.id,
        from: 'UPLOADING_RESULT', to: 'COMPLETED', at: new Date().toISOString(), actor: 'CLOUD',
        reason: 'RESULT_DURABLY_FINALIZED', attemptId: execution.attempt_id,
        correlationId: execution.id, paymentReservationId: null,
        resultManifestId: submitted.resultManifestId }));
    }, () => { commitAttempted=true; });
    if(reused)await Promise.allSettled(copiedKeys.map((key)=>storage.deletePrivateObject(key)));
    return result;
    } catch(error){
      // A lost COMMIT acknowledgement is ambiguous: PostgreSQL may already
      // reference these exact copied objects. Preserve them for a safe replay
      // rather than turning a committed COMPLETED job into missing output.
      if(!commitAttempted)
        await Promise.allSettled(copiedKeys.map((key)=>storage.deletePrivateObject(key)));
      throw error;
    }
  }

  /** A cloud validator may terminally reject only an owned, live result lease. */
  async rejectInvalidResult(input:{jobId:string;executionId:string;attemptId:string;
    workerDeviceId:string;controlPlaneId:string;leaseToken:string}):Promise<DurableJobView>{
    uuid.parse(input.jobId);uuid.parse(input.executionId);uuid.parse(input.attemptId);
    uuid.parse(input.workerDeviceId);controlPlane.parse(input.controlPlaneId);
    return this.transaction(async(client)=>{
      const job=await this.lockJob(client,input.jobId);
      if(job.worker_device_id!==input.workerDeviceId)
        throw new JobExecutionError('NOT_ELIGIBLE');
      const found=await client.query<ExecutionRow>(
        'SELECT * FROM job_executions WHERE id=$1 FOR UPDATE',[input.executionId]);
      const execution=found.rows[0];
      if(!execution||execution.job_id!==job.id||execution.attempt_id!==input.attemptId||
        execution.worker_device_id!==input.workerDeviceId||
        execution.control_plane_id!==input.controlPlaneId||
        !equalDigest(execution.lease_token_hash,digest(input.leaseToken)))
        throw new JobExecutionError('INVALID_LEASE');
      if(job.status==='RESULT_REJECTED')return {jobId:job.id,status:job.status,
        paymentReservationId:job.payment_reservation_id,
        transitions:await this.loadTransitions(client,job.id)};
      if(job.status!=='UPLOADING_RESULT'||execution.completed_at||
        execution.lease_expires_at.getTime()<=Date.now())
        throw new JobExecutionError('NOT_ELIGIBLE');
      return this.transitionLocked(client,JobTransitionSchema.parse({id:randomUUID(),jobId:job.id,
        from:'UPLOADING_RESULT',to:'RESULT_REJECTED',at:new Date().toISOString(),actor:'CLOUD',
        reason:'OUTPUT_VALIDATION_FAILED',attemptId:execution.attempt_id,
        correlationId:execution.id,paymentReservationId:null,resultManifestId:null}));
    });
  }

  /** Seller authorization is re-read under the job lock; buyer profile/prompt data never grants control. */
  async requestJobControl(raw: unknown, sellerAccountId: string): Promise<DurableJobView> {
    const command = JobControlCommandSchema.parse(raw);
    uuid.parse(sellerAccountId);
    if (command.source !== 'WEB' || command.actorId !== sellerAccountId) {
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
        execution_id: string; reason: string | null; requested_at: Date;override_global_pause:boolean }>(
        'SELECT action,actor_id,source,job_id,execution_id,reason,requested_at,override_global_pause FROM job_control_commands WHERE id=$1',
        [command.commandId]);
      if (prior.rows[0]) {
        if (prior.rows[0].action !== command.action || prior.rows[0].actor_id !== sellerAccountId ||
          prior.rows[0].source !== 'WEB' || prior.rows[0].job_id !== job.id ||
          prior.rows[0].execution_id !== active.id || prior.rows[0].reason !== command.reason ||
          prior.rows[0].requested_at.getTime() !== Date.parse(command.requestedAt) ||
          prior.rows[0].override_global_pause !== (command.overrideGlobalPause??false)) {
          throw new JobExecutionError('CONFLICT');
        }
        return { jobId: job.id, status: job.status, paymentReservationId: job.payment_reservation_id,
          transitions: await this.loadTransitions(client, job.id) };
      }
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      const support: PauseSupport = snapshot.pauseSupportSnapshot;
      if (command.action !== 'CANCEL' && support !== 'FULL_RESUME')
        throw new JobExecutionError('NOT_ELIGIBLE');
      const target = command.action === 'PAUSE' ? 'PAUSE_REQUESTED' :
        command.action === 'RESUME'?'RESUME_REQUESTED':'CANCEL_REQUESTED';
      // A newly created container has no running process tree for Docker to freeze.
      // The seller pause contract begins at RUNNING; STARTING may be cancelled.
      if (command.action === 'PAUSE' && job.status !== 'RUNNING' ||
        command.action === 'RESUME' && job.status !== 'PAUSED' ||
        command.action === 'CANCEL' && !['STARTING','RUNNING','UPLOADING_RESULT',
          'PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED'].includes(job.status))
        throw new JobExecutionError('NOT_ELIGIBLE');
      if(command.action==='RESUME'){
        const security=await client.query(`SELECT 1 FROM worker_devices d
          LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
          LEFT JOIN worker_local_pause_reports l ON l.worker_device_id=d.id
          JOIN capability_readiness r ON r.capability_version_id=$2
          JOIN worker_heartbeats h ON h.worker_device_id=d.id
          WHERE d.id=$1 AND d.status<>'REVOKED' AND d.revoked_at IS NULL
          AND coalesce(b.blocked,false)=false AND coalesce(l.security_paused,false)=false
          AND h.observed_at>=now()-interval '30 seconds'
          AND r.observed_at>=now()-interval '30 seconds'
          AND r.worker_device_id=d.id AND r.sandbox_verified
          AND r.required_secrets_ready AND r.runtime_healthy LIMIT 1`,
        [job.worker_device_id,job.capability_version_id]);
        if(!security.rowCount)throw new JobExecutionError('NOT_ELIGIBLE');
        const pause=await client.query<{seller_paused:boolean;global_paused:boolean|null}>(`SELECT
          s.seller_paused,l.global_paused FROM worker_availability_schedules s
          LEFT JOIN worker_local_pause_reports l ON l.worker_device_id=s.worker_device_id
          WHERE s.worker_device_id=$1`,[job.worker_device_id]);
        const globallyPaused=Boolean(pause.rows[0]?.seller_paused||pause.rows[0]?.global_paused);
        if(globallyPaused&&!command.overrideGlobalPause)throw new JobExecutionError('NOT_ELIGIBLE');
      }
      await client.query(`INSERT INTO job_control_commands(id,job_id,execution_id,action,source,
        actor_id,reason,previous_state,requested_at,pause_support,override_global_pause)
        VALUES($1,$2,$3,$4,'WEB',$5,$6,$7,$8,$9,$10)`,
      [command.commandId, job.id, active.id, command.action, sellerAccountId, command.reason,
        job.status, command.requestedAt, support,command.overrideGlobalPause??false]);
      return this.transitionLocked(client, JobTransitionSchema.parse({ id: command.commandId,
        jobId: job.id, from: job.status, to: target, at: new Date().toISOString(),
        actor: 'SELLER', reason: command.action === 'PAUSE' ? 'SELLER_PAUSE_REQUEST' :
          command.action === 'RESUME'?'SELLER_RESUME_REQUEST':'SELLER_CANCEL_REQUEST',
        attemptId: active.attempt_id, correlationId: active.id,
        paymentReservationId: null, resultManifestId: null }));
    });
  }

  /** Pending seller control is pulled by the owning Worker, never by a buyer session. */
  async pendingJobControls(workerDeviceId:string,planeId:string,limit=16):Promise<readonly unknown[]>{
    uuid.parse(workerDeviceId);controlPlane.parse(planeId);
    if(!Number.isSafeInteger(limit)||limit<1||limit>64)throw new JobExecutionError('NOT_ELIGIBLE');
    const commands=await this.pool.query<{id:string;job_id:string;execution_id:string;
      attempt_id:string;action:'PAUSE'|'RESUME'|'CANCEL';source:'WEB'|'LOCAL_UI'|'CLI'|'PLATFORM_SECURITY';
      actor_id:string;reason:string|null;requested_at:Date;override_global_pause:boolean}>(
      `SELECT c.id,c.job_id,c.execution_id,e.attempt_id,c.action,c.source,c.actor_id,
        c.reason,c.requested_at,c.override_global_pause FROM job_control_commands c
        JOIN job_executions e ON e.id=c.execution_id
        JOIN jobs j ON j.id=c.job_id
        WHERE e.worker_device_id=$1 AND e.control_plane_id=$2 AND e.completed_at IS NULL
        AND e.lease_expires_at>now() AND c.confirmed_at IS NULL
        AND j.status IN ('PAUSE_REQUESTED','RESUME_REQUESTED','CANCEL_REQUESTED')
        ORDER BY c.requested_at,c.id LIMIT $3`,[workerDeviceId,planeId,limit]);
    return commands.rows.map((row)=>({type:'JOB_CONTROL',protocolVersion:WORKER_PROTOCOL_VERSION,
      messageId:randomUUID(),commandId:row.id,jobId:row.job_id,
      executionId:row.execution_id,attemptId:row.attempt_id,controlPlaneId:planeId,
      action:row.action,source:row.source,actorId:row.actor_id,reason:row.reason,
      requestedAt:row.requested_at.toISOString(),overrideGlobalPause:row.override_global_pause}));
  }

  /** Caller must pass identity from signed Worker authentication, not the untrusted ack body. */
  async acknowledgeJobControl(raw: unknown, authenticatedWorkerDeviceId: string,
    authenticatedControlPlaneId: string): Promise<DurableJobView> {
    const ack = z.strictObject({
      commandId: uuid, jobId: uuid, executionId: uuid, attemptId: uuid,
      workerDeviceId: uuid, controlPlaneId: controlPlane,
      status: z.enum(['PAUSED', 'RUNNING', 'SECURITY_PAUSED', 'CANCELLED',
        'CONTROL_FAILED', 'RESUME_NOT_READY',
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
        'SELECT * FROM job_executions WHERE id=$1 AND job_id=$2 FOR UPDATE',
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
      const expected = command.action === 'PAUSE' ? 'PAUSE_REQUESTED' :
        command.action==='RESUME'?'RESUME_REQUESTED':'CANCEL_REQUESTED';
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
        command.action === 'RESUME' && !['RUNNING', 'PAUSED'].includes(result) ||
        command.action === 'CANCEL' && result!=='CANCELLED')
        throw new JobExecutionError('NOT_ELIGIBLE');
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
      const view=await this.transitionLocked(client, JobTransitionSchema.parse({ id: randomUUID(),
        jobId: job.id, from: expected, to: result, at: new Date().toISOString(),
        actor: 'WORKER', reason: ack.status, attemptId: active.attempt_id,
        correlationId: active.id, paymentReservationId: null, resultManifestId: null }));
      return view;
    });
  }

  /** Replay-safe reconciliation of a confirmed seller-local CLI/UI action after cloud loss.
   * The signed Worker report never authorizes payment or a new execution. */
  async reconcileLocalJobControl(raw:unknown,authenticatedWorkerDeviceId:string,
    authenticatedControlPlaneId:string):Promise<void>{
    const report=WorkerLocalJobControlReportSchema.parse(raw);
    if(report.workerDeviceId!==uuid.parse(authenticatedWorkerDeviceId))
      throw new JobExecutionError('WRONG_WORKER');
    if(report.controlPlaneId!==controlPlane.parse(authenticatedControlPlaneId))
      throw new JobExecutionError('WRONG_CONTROL_PLANE');
    const hash=hashCanonicalJson({commandId:report.commandId,jobId:report.jobId,
      executionId:report.executionId,attemptId:report.attemptId,
      controlPlaneId:report.controlPlaneId,workerDeviceId:report.workerDeviceId,
      action:report.action,source:report.source,actorId:report.actorId,
      reason:report.reason,status:report.status,localRevision:report.localRevision,
      confirmedAt:report.confirmedAt});
    await this.transaction(async(client)=>{
      const previous=await client.query<{body_hash:string}>(`SELECT body_hash FROM
        worker_local_job_control_reports WHERE command_id=$1 FOR UPDATE`,[report.commandId]);
      if(previous.rows[0]){
        if(previous.rows[0].body_hash!==hash)throw new JobExecutionError('CONFLICT');
        return;
      }
      const job=await this.lockJob(client,report.jobId);
      if(job.worker_device_id!==report.workerDeviceId)throw new JobExecutionError('WRONG_WORKER');
      const selected=await client.query<ExecutionRow>(`SELECT * FROM job_executions
        WHERE id=$1 AND job_id=$2 FOR UPDATE`,[report.executionId,report.jobId]);
      const execution=selected.rows[0];
      if(!execution||execution.attempt_id!==report.attemptId||
        execution.control_plane_id!==report.controlPlaneId)
        throw new JobExecutionError('NOT_ELIGIBLE');
      const validResult=report.action==='PAUSE'&&
        (report.status==='PAUSED'||report.status==='SECURITY_PAUSED')||
        report.action==='RESUME'&&report.status==='RUNNING'||
        report.action==='CANCEL'&&
        (report.status==='CANCELLED'||report.status==='TIMED_OUT');
      if(!validResult)throw new JobExecutionError('NOT_ELIGIBLE');
      let eligible=!execution.completed_at&&execution.lease_expires_at.getTime()>Date.now()&&
        (report.action==='PAUSE'&&job.status==='RUNNING'||
          report.action==='RESUME'&&job.status==='PAUSED'||
          report.action==='CANCEL'&&['STARTING','RUNNING','PAUSED','PAUSE_REQUESTED',
            'RESUME_REQUESTED','SECURITY_PAUSED'].includes(job.status));
      if(report.action==='RESUME'&&eligible){
        const blocked=await client.query(`SELECT 1 FROM worker_devices d
          LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
          LEFT JOIN worker_availability_schedules s ON s.worker_device_id=d.id
          WHERE d.id=$1 AND (d.status='REVOKED' OR coalesce(b.blocked,false)
            OR coalesce(s.seller_paused,false))`,[report.workerDeviceId]);
        if(blocked.rowCount)eligible=false;
      }
      if(eligible){
        const requested=report.action==='PAUSE'?'PAUSE_REQUESTED':
          report.action==='RESUME'?'RESUME_REQUESTED':'CANCEL_REQUESTED';
        await this.transitionLocked(client,JobTransitionSchema.parse({id:report.commandId,
          jobId:job.id,from:job.status,to:requested,at:new Date().toISOString(),
          actor:report.source==='PLATFORM_SECURITY'?'SYSTEM':'SELLER',
          reason:`LOCAL_${report.action}_REQUEST`,attemptId:execution.attempt_id,
          correlationId:execution.id,paymentReservationId:null,resultManifestId:null}));
        await this.transitionLocked(client,JobTransitionSchema.parse({id:randomUUID(),
          jobId:job.id,from:requested,to:report.status,at:new Date().toISOString(),
          actor:'WORKER',reason:`LOCAL_${report.action}_CONFIRMED`,
          attemptId:execution.attempt_id,correlationId:execution.id,
          paymentReservationId:null,resultManifestId:null}));
      }
      await client.query(`INSERT INTO worker_local_job_control_reports(command_id,job_id,
        execution_id,worker_device_id,control_plane_id,body_hash,disposition)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[report.commandId,job.id,execution.id,
        report.workerDeviceId,report.controlPlaneId,hash,eligible?'APPLIED':'STALE']);
    });
  }

  /** Cloud restart-safe timeout for a paid pause. A live lease prevents premature release. */
  async expireOverduePausedJobs(maxPauseSeconds:number,limit=100):Promise<number>{
    if(!Number.isSafeInteger(maxPauseSeconds)||maxPauseSeconds<60||
      maxPauseSeconds>604800||!Number.isSafeInteger(limit)||limit<1||limit>500)
      throw new JobExecutionError('NOT_ELIGIBLE');
    return this.transaction(async(client)=>{
      const due=await client.query<{id:string;status:JobStatus;attempt_id:string;
        execution_id:string}>(`SELECT j.id,j.status,e.attempt_id,e.id AS execution_id
        FROM jobs j JOIN job_executions e ON e.job_id=j.id AND e.completed_at IS NULL
        WHERE j.status IN ('PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED')
        AND e.lease_expires_at<=now()
        AND (SELECT t.at FROM job_transitions t WHERE t.job_id=j.id
          AND t.to_status IN ('PAUSE_REQUESTED','PAUSED','SECURITY_PAUSED')
          ORDER BY t.sequence DESC LIMIT 1)
          <=now()-($1::integer * interval '1 second')
        ORDER BY j.created_at,j.id LIMIT $2 FOR UPDATE OF j SKIP LOCKED`,
      [maxPauseSeconds,limit]);
      for(const row of due.rows){
        await this.transitionLocked(client,JobTransitionSchema.parse({id:randomUUID(),
          jobId:row.id,from:row.status,to:'TIMED_OUT',at:new Date().toISOString(),
          actor:'CLOUD',reason:'PAUSE_DURATION_EXCEEDED',attemptId:row.attempt_id,
          correlationId:row.execution_id,paymentReservationId:null,resultManifestId:null}));
      }
      return due.rows.length;
    });
  }
}
