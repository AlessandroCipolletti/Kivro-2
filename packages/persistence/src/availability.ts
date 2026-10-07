import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AvailabilityPolicySchema, AvailabilityScheduleSchema, ExecutionPreferenceSchema,
  PublicAvailabilitySchema, ScheduleQuoteSchema, ScheduledJobTimingSchema,
  type AvailabilityPolicy, type AvailabilitySchedule, type PublicAvailability,
  type ScheduleQuote, type ScheduledJobTiming } from '../../contracts/src/availability.js';
import { PublishedCapabilityVersionSchema, JobContractSnapshotSchema } from
  '../../contracts/src/capability-version.js';
import { canonicalJson } from '../../contracts/src/canonical-json.js';
import { nextScheduleWindow, isInsideSchedule, type UtcWindow } from
  '../../domain/src/availability-schedule.js';
import { JobTransitionSchema } from '../../contracts/src/job-lifecycle.js';
import { applyJobTransition } from '../../domain/src/job-lifecycle.js';
import type { JobStatus } from '../../contracts/src/job-lifecycle.js';
import type { PostgresFinanceRepository } from './finance.js';
import { workerVersionStatus } from '../../domain/src/worker-version.js';

const uuid = z.uuid();
const activeStatuses = ['PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED',
  'WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING','UPLOADING_RESULT',
  'PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED','CANCEL_REQUESTED'];
const runnableStatuses = ['WAITING_FOR_AVAILABILITY','QUEUED','WAITING_FOR_WORKER'];
const preStartStatuses = [...runnableStatuses,'DISPATCHED','ACCEPTED'];
const executionEngagedStatuses = ['QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED',
  'STARTING','RUNNING','UPLOADING_RESULT','PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED',
  'SECURITY_PAUSED','CANCEL_REQUESTED'];
type CapabilityRow = { id: string; status: string; visibility: string; current_version_id: string | null;
  seller_profile_id: string; version_snapshot: unknown; version_id: string; worker_device_id: string };
type PolicyRow = { capability_id: string; schedule_override: unknown | null; concurrency_limit: number;
  queue_limit: number; future_reservation_limit: number; estimated_runtime_seconds: number | null;
  max_wait_seconds: number; seller_paused: boolean; platform_blocked: boolean; revision: number;
  maintenance_until:Date|null };
type WorkerScheduleRow = { schedule: unknown; revision: number; seller_paused: boolean;
  sync_pending:boolean;web_paused:boolean;maintenance_until:Date|null };
type JobRow = { id: string; status: JobStatus; buyer_account_id: string; capability_version_id: string;
  worker_device_id: string; contract_snapshot: unknown; payment_reservation_id: string | null };
type PlanRow = { job_id: string; quote_id: string; capability_id: string; execution_mode: string;
  scheduled_for_earliest_at: Date; planned_window_start_at: Date; next_eligible_at: Date;
  latest_start_at: Date; eligible_at: Date | null; queued_at: Date | null;
  schedule_revision: number; created_at: Date };

export class AvailabilityError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'NOT_ELIGIBLE' | 'STALE_QUOTE' | 'CAPACITY_FULL' |
    'QUEUE_FULL' | 'NO_FUTURE_WINDOW' | 'NOT_READY' | 'CONFLICT' | 'EXPIRED' |
    'SCHEDULED_OFFLINE' | 'BUYER_LIMIT', readonly nextAvailableAt: string | null = null) {
    super(code); this.name = 'AvailabilityError';
  }
}

function iso(date: Date): string { return date.toISOString(); }
function later(left: number, right: number): number { return Math.max(left, right); }
function windowCapacity(window: UtcWindow, policy: PolicyRow, after: Date): number {
  if (policy.estimated_runtime_seconds === null) return policy.concurrency_limit+policy.queue_limit;
  const duration = Math.floor((Date.parse(window.endAt) -
    later(Date.parse(window.startAt),after.getTime())) / 1000);
  return policy.concurrency_limit * Math.max(1,Math.floor(duration/policy.estimated_runtime_seconds))+
    policy.queue_limit;
}

/** Shared Core admission. The pool is the same transaction authority used by M07 and M08. */
export class PostgresAvailabilityRepository {
  constructor(private readonly pool: Pool, private readonly finance: PostgresFinanceRepository,
    private readonly clock: () => Date = () => new Date()) {}

  private async tx<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const value = await action(client);
      await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private async capability(client: PoolClient, capabilityId: string): Promise<CapabilityRow> {
      const result = await client.query<CapabilityRow>(`SELECT c.id,c.status,c.visibility,c.current_version_id,
      c.seller_profile_id,v.id AS version_id,v.version_snapshot,
      (v.version_snapshot->>'workerDeviceId') AS worker_device_id
      FROM capabilities c JOIN capability_versions v ON v.id=c.current_version_id
      WHERE c.id=$1 AND v.publication_state='PUBLISHED' FOR SHARE OF c,v`,
    [uuid.parse(capabilityId)]);
    if (!result.rows[0]) throw new AvailabilityError('NOT_FOUND');
    return result.rows[0];
  }

  /** Existing paid jobs retain their immutable published version and Worker binding. */
  private async capabilityForJob(client: PoolClient, job: JobRow): Promise<CapabilityRow> {
    const result=await client.query<CapabilityRow>(`SELECT c.id,c.status,c.visibility,c.current_version_id,
      c.seller_profile_id,v.id AS version_id,v.version_snapshot,
      (v.version_snapshot->>'workerDeviceId') AS worker_device_id
      FROM capabilities c JOIN capability_versions v ON v.capability_id=c.id
      WHERE v.id=$1 AND v.publication_state='PUBLISHED' FOR SHARE OF c,v`,
    [job.capability_version_id]);
    const cap=result.rows[0];
    if (!cap || cap.worker_device_id!==job.worker_device_id) throw new AvailabilityError('NOT_ELIGIBLE');
    return cap;
  }

  private async policy(client: PoolClient, capabilityId: string, lock: boolean): Promise<PolicyRow> {
    const result = await client.query<PolicyRow>(`SELECT p.*,
      (p.seller_paused OR EXISTS (SELECT 1 FROM worker_local_capability_pauses l
        WHERE l.capability_id=p.capability_id)) AS seller_paused
      FROM capability_availability_policies p
      WHERE p.capability_id=$1 ${lock ? 'FOR UPDATE OF p' : ''}`, [capabilityId]);
    if (!result.rows[0]) throw new AvailabilityError('NOT_READY');
    return result.rows[0];
  }

  private async workerSchedule(client: PoolClient, workerId: string): Promise<WorkerScheduleRow> {
      const result = await client.query<WorkerScheduleRow>(
      `SELECT s.schedule,s.revision,s.seller_paused AS web_paused,s.maintenance_until,
        (coalesce(r.revision,0)>coalesce(r.acknowledged_revision,0)) AS sync_pending,
        (s.seller_paused OR coalesce(l.global_paused,false) OR
          coalesce(l.security_paused,false) OR coalesce(b.blocked,false) OR
          coalesce(r.revision,0)>coalesce(r.acknowledged_revision,0)) AS seller_paused
      FROM worker_availability_schedules s
      LEFT JOIN worker_local_pause_reports l ON l.worker_device_id=s.worker_device_id
      LEFT JOIN worker_security_blocks b ON b.worker_device_id=s.worker_device_id
      LEFT JOIN worker_cloud_control_revisions r ON r.worker_device_id=s.worker_device_id
      WHERE s.worker_device_id=$1 FOR SHARE OF s`, [workerId]);
    if (!result.rows[0]) throw new AvailabilityError('NOT_READY');
    return result.rows[0];
  }

  private effective(policy: PolicyRow, worker: WorkerScheduleRow): AvailabilitySchedule {
    return AvailabilityScheduleSchema.parse(policy.schedule_override ?? worker.schedule);
  }

  private async visibleTo(client: PoolClient, capability: CapabilityRow,
    buyerAccountId: string | null): Promise<boolean> {
    if (capability.visibility==='PUBLIC'||capability.visibility==='UNLISTED') return true;
    if (capability.visibility!=='PRIVATE'||!buyerAccountId) return false;
    const seller=await client.query<{ id:string }>(`SELECT id FROM seller_profiles
      WHERE id=$1 AND account_id=$2`,[capability.seller_profile_id,uuid.parse(buyerAccountId)]);
    if(seller.rows[0])return true;
    const grant=await client.query<{ id: string }>(`SELECT id FROM capability_private_grants
      WHERE capability_id=$1 AND buyer_account_id=$2 AND revoked_at IS NULL FOR SHARE`,
    [capability.id,uuid.parse(buyerAccountId)]);
    return !!grant.rows[0];
  }

  private async assertSeller(client: PoolClient, sellerAccountId: string,
    sellerProfileId: string): Promise<void> {
    const owner = await client.query<{ id: string }>(`SELECT id FROM seller_profiles
      WHERE id=$1 AND account_id=$2 AND status='ACTIVE'`, [sellerProfileId, uuid.parse(sellerAccountId)]);
    if (!owner.rows[0]) throw new AvailabilityError('NOT_ELIGIBLE');
  }

  private async lockAffectedWorkers(client: PoolClient, capabilityId: string,
    currentWorkerId: string): Promise<readonly string[]> {
    const historical=await client.query<{ worker_device_id: string }>(`SELECT DISTINCT
      j.worker_device_id FROM job_schedule_plans p JOIN jobs j ON j.id=p.job_id
      WHERE p.capability_id=$1 AND j.status=ANY($2::text[])`,
    [capabilityId,preStartStatuses]);
    const ids=[...new Set([currentWorkerId,...historical.rows.map((r)=>r.worker_device_id)])].sort();
    for (const id of ids) await client.query('SELECT id FROM worker_devices WHERE id=$1 FOR UPDATE',[id]);
    return ids;
  }

  async setWorkerDefault(input: { workerDeviceId: string; sellerAccountId: string;
    schedule: unknown; paused: boolean; source: 'WEB'|'LOCAL_APP'|'API';
    expectedRevision: number | null }): Promise<number> {
    const schedule = AvailabilityScheduleSchema.parse(input.schedule);
    return this.tx(async (client) => {
      const worker = await client.query<{ seller_profile_id: string }>(
        'SELECT seller_profile_id FROM worker_devices WHERE id=$1 FOR UPDATE', [uuid.parse(input.workerDeviceId)]);
      if (!worker.rows[0]) throw new AvailabilityError('NOT_FOUND');
      await this.assertSeller(client, input.sellerAccountId, worker.rows[0].seller_profile_id);
      const prior = await client.query<WorkerScheduleRow>(
        'SELECT * FROM worker_availability_schedules WHERE worker_device_id=$1 FOR UPDATE', [input.workerDeviceId]);
      const old = prior.rows[0];
      if ((old?.revision ?? null) !== input.expectedRevision) throw new AvailabilityError('CONFLICT');
      const revision = (old?.revision ?? 0) + 1;
      await client.query(`INSERT INTO worker_availability_schedules
        (worker_device_id,schedule,revision,seller_paused) VALUES($1,$2,$3,$4)
        ON CONFLICT(worker_device_id) DO UPDATE SET schedule=$2,revision=$3,
        seller_paused=$4,updated_at=now()`, [input.workerDeviceId,schedule,revision,input.paused]);
      await client.query(`INSERT INTO availability_schedule_audit(id,subject_kind,subject_id,
        actor_kind,actor_id,source,old_value,new_value,revision)
        VALUES($1,'WORKER',$2,'SELLER',$3,$4,$5,$6,$7)`,
      [randomUUID(),input.workerDeviceId,input.sellerAccountId,input.source,old ?? null,
        { schedule, sellerPaused: input.paused },revision]);
      if((old?.seller_paused??false)!==input.paused)
        await client.query(`INSERT INTO worker_cloud_control_revisions(worker_device_id,revision)
          VALUES($1,1) ON CONFLICT(worker_device_id) DO UPDATE SET revision=
          worker_cloud_control_revisions.revision+1`,[input.workerDeviceId]);
      await client.query(`UPDATE job_schedule_plans p SET last_reconciled_at=NULL
        FROM jobs j WHERE j.id=p.job_id AND j.worker_device_id=$1
          AND j.status=ANY($2::text[])`,[input.workerDeviceId,preStartStatuses]);
      return revision;
    });
  }

  async setCapabilityPolicy(input: { capabilityId: string; sellerAccountId: string;
    policy: unknown; paused: boolean; source: 'WEB'|'LOCAL_APP'|'API';
    expectedRevision: number | null }): Promise<number> {
    const value = AvailabilityPolicySchema.parse(input.policy);
    return this.tx(async (client) => {
      const capability = await this.capability(client, input.capabilityId);
      await this.assertSeller(client,input.sellerAccountId,capability.seller_profile_id);
      const version = PublishedCapabilityVersionSchema.parse(capability.version_snapshot);
      if (value.concurrencyLimit > version.concurrencyLimit) throw new AvailabilityError('NOT_ELIGIBLE');
      const old = await client.query<PolicyRow>(`SELECT * FROM capability_availability_policies
        WHERE capability_id=$1 FOR UPDATE`, [capability.id]);
      if ((old.rows[0]?.revision ?? null) !== input.expectedRevision) throw new AvailabilityError('CONFLICT');
      const revision = (old.rows[0]?.revision ?? 0) + 1;
      await client.query(`INSERT INTO capability_availability_policies(capability_id,schedule_override,
        concurrency_limit,queue_limit,future_reservation_limit,estimated_runtime_seconds,
        max_wait_seconds,seller_paused,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT(capability_id) DO UPDATE SET schedule_override=$2,concurrency_limit=$3,
        queue_limit=$4,future_reservation_limit=$5,estimated_runtime_seconds=$6,
        max_wait_seconds=$7,seller_paused=$8,revision=$9,updated_at=now()`,
      [capability.id,value.schedule,value.concurrencyLimit,value.queueLimit,
        value.futureReservationLimit,value.estimatedRuntimeSeconds,value.maxWaitSeconds,
        input.paused,revision]);
      const affectedWorkers=await this.lockAffectedWorkers(client,capability.id,
        capability.worker_device_id);
      await client.query(`UPDATE job_schedule_plans p SET last_reconciled_at=NULL
        FROM jobs j WHERE j.id=p.job_id AND
        (j.worker_device_id=ANY($1::uuid[]) OR p.capability_id=$2)
        AND j.status=ANY($3::text[])`,
      [affectedWorkers,capability.id,preStartStatuses]);
      await client.query(`INSERT INTO availability_schedule_audit(id,subject_kind,subject_id,
        actor_kind,actor_id,source,old_value,new_value,revision)
        VALUES($1,'CAPABILITY',$2,'SELLER',$3,$4,$5,$6,$7)`,
      [randomUUID(),capability.id,input.sellerAccountId,input.source,old.rows[0] ?? null,
        { policy: value, sellerPaused: input.paused },revision]);
      if((old.rows[0]?.seller_paused??false)!==input.paused)
        await client.query(`INSERT INTO worker_cloud_control_revisions(worker_device_id,revision)
          VALUES($1,1) ON CONFLICT(worker_device_id) DO UPDATE SET revision=
          worker_cloud_control_revisions.revision+1`,[capability.worker_device_id]);
      return revision;
    });
  }

  async setPlatformBlock(capabilityId: string, platformActorId: string,
    blocked: boolean): Promise<void> {
    await this.tx(async (client) => {
      const old = await this.policy(client,uuid.parse(capabilityId),true);
      const cap=await this.capability(client,capabilityId);
      const affectedWorkers=await this.lockAffectedWorkers(client,cap.id,cap.worker_device_id);
      const revision = old.revision + 1;
      await client.query(`UPDATE capability_availability_policies SET platform_blocked=$2,
        revision=$3,updated_at=now() WHERE capability_id=$1`,[capabilityId,blocked,revision]);
      await client.query(`UPDATE job_schedule_plans p SET last_reconciled_at=NULL
        FROM jobs j WHERE j.id=p.job_id AND
          (j.worker_device_id=ANY($1::uuid[]) OR p.capability_id=$2)
          AND j.status=ANY($3::text[])`,
      [affectedWorkers,cap.id,preStartStatuses]);
      await client.query(`INSERT INTO availability_schedule_audit(id,subject_kind,subject_id,
        actor_kind,actor_id,source,old_value,new_value,revision)
        VALUES($1,'CAPABILITY',$2,'PLATFORM',$3,'PLATFORM',$4,$5,$6)`,
      [randomUUID(),capabilityId,uuid.parse(platformActorId),old,
        { ...old, platform_blocked: blocked },revision]);
      await client.query(`INSERT INTO worker_cloud_control_revisions(worker_device_id,revision)
        VALUES($1,1) ON CONFLICT(worker_device_id) DO UPDATE SET revision=
        worker_cloud_control_revisions.revision+1`,[cap.worker_device_id]);
    });
  }

  private async health(client: PoolClient, capability: CapabilityRow): Promise<
    'ONLINE' | 'BUSY' | 'OFFLINE' | 'PAUSED' | 'READINESS_BLOCKED'> {
    const result = await client.query<{ worker_status: string; worker_version:string;
      heartbeat_status: string | null;
      readiness_state: string | null; sandbox_verified: boolean | null;
      required_secrets_ready: boolean | null; runtime_healthy: boolean | null;
      running_jobs: number | null; capacity: number | null }>(`SELECT d.status AS worker_status,
      d.worker_version,
      (SELECT reported_status FROM worker_heartbeats WHERE worker_device_id=d.id
        AND reported_at > now()-interval '30 seconds' ORDER BY reported_at DESC LIMIT 1) AS heartbeat_status,
      (SELECT running_jobs FROM worker_heartbeats WHERE worker_device_id=d.id
        AND reported_at > now()-interval '30 seconds' ORDER BY reported_at DESC LIMIT 1) AS running_jobs,
      (SELECT capacity FROM worker_heartbeats WHERE worker_device_id=d.id
        AND reported_at > now()-interval '30 seconds' ORDER BY reported_at DESC LIMIT 1) AS capacity,
      (SELECT state FROM capability_readiness WHERE capability_id=$2 AND capability_version_id=$3
        AND worker_device_id=d.id AND observed_at > now()-interval '30 seconds') AS readiness_state
      ,(SELECT sandbox_verified FROM capability_readiness WHERE capability_id=$2 AND capability_version_id=$3
        AND worker_device_id=d.id AND observed_at > now()-interval '30 seconds') AS sandbox_verified
      ,(SELECT required_secrets_ready FROM capability_readiness WHERE capability_id=$2 AND capability_version_id=$3
        AND worker_device_id=d.id AND observed_at > now()-interval '30 seconds') AS required_secrets_ready
      ,(SELECT runtime_healthy FROM capability_readiness WHERE capability_id=$2 AND capability_version_id=$3
        AND worker_device_id=d.id AND observed_at > now()-interval '30 seconds') AS runtime_healthy
      FROM worker_devices d WHERE d.id=$1`,[capability.worker_device_id,capability.id,capability.version_id]);
    const row = result.rows[0];
    if (!row || row.worker_status === 'REVOKED' || !row.heartbeat_status) return 'OFFLINE';
    if (process.env.NODE_ENV==='production'){
      const version=workerVersionStatus(row.worker_version,
        process.env.KIVRO_MIN_WORKER_RELEASE??null,
        process.env.KIVRO_LATEST_WORKER_RELEASE??null);
      if(version==='SECURITY_UPDATE_REQUIRED'||version==='UNKNOWN')return 'READINESS_BLOCKED';
    }
    if (row.worker_status === 'PAUSED' || row.heartbeat_status === 'PAUSED') return 'PAUSED';
    if (row.worker_status !== 'ONLINE' || row.heartbeat_status !== 'ONLINE') return 'OFFLINE';
    if (row.readiness_state!=='READY'||row.sandbox_verified!==true||
      row.required_secrets_ready!==true||row.runtime_healthy!==true||!row.capacity)
      return 'READINESS_BLOCKED';
    return (row.running_jobs??0)>=row.capacity?'BUSY':'ONLINE';
  }

  private async activeCount(client: PoolClient, capabilityId: string): Promise<number> {
    const result = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM jobs j
      JOIN capability_versions v ON v.id=j.capability_version_id
      WHERE v.capability_id=$1 AND j.status=ANY($2::text[])`,[capabilityId,
      ['DISPATCHED','ACCEPTED','STARTING','RUNNING','UPLOADING_RESULT','PAUSE_REQUESTED',
        'PAUSED','RESUME_REQUESTED','SECURITY_PAUSED','CANCEL_REQUESTED']]);
    return result.rows[0]?.count ?? 0;
  }

  private async queueCount(client: PoolClient, capabilityId: string): Promise<number> {
    const result = await client.query<{ count: number }>(`SELECT count(*)::int AS count
      FROM job_schedule_plans p JOIN jobs j ON j.id=p.job_id WHERE p.capability_id=$1
      AND j.status IN ('QUEUED','WAITING_FOR_WORKER')`,[capabilityId]);
    return result.rows[0]?.count ?? 0;
  }

  private async needsReprojection(client: PoolClient, workerId: string): Promise<boolean> {
    const result=await client.query(`SELECT 1 FROM job_schedule_plans p
      JOIN jobs j ON j.id=p.job_id WHERE j.worker_device_id=$1
      AND p.last_reconciled_at IS NULL AND j.status=ANY($2::text[]) LIMIT 1`,
    [workerId,preStartStatuses]);
    return !!result.rows[0];
  }

  private async queueRoom(client: PoolClient, capabilityId: string,
    policy: PolicyRow): Promise<boolean> {
    const cap=await this.capability(client,capabilityId);
    const limit=await this.conservativeConcurrency(client,cap,policy);
    if (limit===0) return false;
    const active=await this.activeCount(client,capabilityId);
    const queued=await this.queueCount(client,capabilityId);
    if (queued>=Math.max(0,limit-active)+policy.queue_limit) return false;
    if (policy.queue_limit===0) {
      const engaged=await client.query<{ count: number }>(`SELECT count(*)::int AS count
        FROM jobs WHERE worker_device_id=$1 AND status=ANY($2::text[])`,
      [cap.worker_device_id,executionEngagedStatuses]);
      if ((engaged.rows[0]?.count??0)>=await this.reportedCapacity(client,cap.worker_device_id)) {
        return false;
      }
    }
    return true;
  }

  private async reportedCapacity(client: PoolClient, workerId: string): Promise<number> {
    const report=await client.query<{ capacity: number }>(`SELECT capacity FROM worker_heartbeats
      WHERE worker_device_id=$1 AND reported_at IS NOT NULL
      ORDER BY reported_at DESC LIMIT 1`,[workerId]);
    return report.rows[0]?.capacity??0;
  }

  private async conservativeConcurrency(client: PoolClient, cap: CapabilityRow,
    policy: PolicyRow): Promise<number> {
    const version=PublishedCapabilityVersionSchema.parse(cap.version_snapshot);
    return Math.min(policy.concurrency_limit,version.concurrencyLimit,
      await this.reportedCapacity(client,cap.worker_device_id));
  }

  private async slot(client: PoolClient, capabilityId: string, schedule: AvailabilitySchedule,
    policy: PolicyRow, after: Date, latest: Date, excludeJobId: string | null = null,
    pinnedCapability: CapabilityRow | null = null): Promise<UtcWindow> {
    const cap=pinnedCapability??await this.capability(client,capabilityId);
    const workerCapacity=await this.reportedCapacity(client,cap.worker_device_id);
    const concurrency=Math.min(policy.concurrency_limit,
      PublishedCapabilityVersionSchema.parse(cap.version_snapshot).concurrencyLimit,
      workerCapacity);
    if (concurrency<1) throw new AvailabilityError('NO_FUTURE_WINDOW');
    const boundedPolicy={...policy,concurrency_limit:concurrency};
    const precedence=excludeJobId?await client.query<{ created_at: Date }>(
      'SELECT created_at FROM job_schedule_plans WHERE job_id=$1',[excludeJobId]):null;
    const acceptedAt=precedence?.rows[0]?.created_at??null;
    if (excludeJobId && !acceptedAt) throw new AvailabilityError('NOT_READY');
    let cursor = after;
    for (let i=0; i<80; i++) {
      const window = nextScheduleWindow(schedule,cursor,true);
      if (!window || Date.parse(window.startAt) > latest.getTime()) break;
      const count = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM job_schedule_plans p
        JOIN jobs j ON j.id=p.job_id WHERE p.capability_id=$1 AND p.planned_window_start_at=$2
        AND j.status=ANY($3::text[]) AND
        ($4::uuid IS NULL OR (p.created_at,p.job_id)<($5::timestamptz,$4::uuid))`,
      [capabilityId,window.startAt,activeStatuses,excludeJobId,acceptedAt]);
      const future = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM job_schedule_plans p
        JOIN jobs j ON j.id=p.job_id WHERE p.capability_id=$1 AND p.next_eligible_at>now()
        AND j.status=ANY($2::text[]) AND
        ($3::uuid IS NULL OR (p.created_at,p.job_id)<($4::timestamptz,$3::uuid))`,
      [capabilityId,activeStatuses,excludeJobId,acceptedAt]);
      const duration=Math.max(1,Math.floor((Date.parse(window.endAt)-
        later(Date.parse(window.startAt),after.getTime()))/1000));
      const workerDemand=await client.query<{ used_seconds: string }>(`SELECT
        coalesce(sum(least(coalesce(ap.estimated_runtime_seconds,$5),$5)),0)::text
          AS used_seconds
        FROM job_schedule_plans x JOIN jobs j ON j.id=x.job_id
        JOIN capability_availability_policies ap ON ap.capability_id=x.capability_id
        WHERE j.worker_device_id=$1 AND x.next_eligible_at >= $2
          AND x.next_eligible_at < $3 AND j.status=ANY($4::text[])
          AND ($6::uuid IS NULL OR (x.created_at,x.job_id)<($7::timestamptz,$6::uuid))`,
      [cap.worker_device_id,window.startAt,window.endAt,activeStatuses,duration,
        excludeJobId,acceptedAt]);
      const used=Number(workerDemand.rows[0]?.used_seconds??0);
      if (!Number.isSafeInteger(used)) throw new AvailabilityError('NOT_READY');
      const demand=Math.min(policy.estimated_runtime_seconds??duration,duration);
      if ((count.rows[0]?.n ?? 0) < windowCapacity(window,boundedPolicy,after) &&
        used+demand<=workerCapacity*duration &&
        (excludeJobId!==null || Date.parse(window.startAt) <= Date.now() ||
          (future.rows[0]?.n ?? 0) < policy.future_reservation_limit)) return window;
      cursor = new Date(window.endAt);
    }
    throw new AvailabilityError('NO_FUTURE_WINDOW');
  }

  /** Public projection deliberately omits the seller's weekly schedule and Worker details. */
  async publicStatus(capabilityId: string, buyerAccountId: string | null = null): Promise<PublicAvailability> {
    return this.tx(async (client) => {
      let cap: CapabilityRow;
      try { cap = await this.capability(client,capabilityId); }
      catch { return PublicAvailabilitySchema.parse({ status:'UNAVAILABLE',acceptingImmediate:false,
        acceptingQueue:false,canSchedule:false,nextAvailableAt:null,nextScheduleWindowAt:null,
        scheduleOpen:false,workerReachable:false,readinessReady:false,reason:'NOT_PUBLISHED' }); }
      if (!await this.visibleTo(client,cap,buyerAccountId)) {
        return PublicAvailabilitySchema.parse({ status:'UNAVAILABLE',acceptingImmediate:false,
          acceptingQueue:false,canSchedule:false,nextAvailableAt:null,nextScheduleWindowAt:null,
          scheduleOpen:false,workerReachable:false,readinessReady:false,reason:'NOT_VISIBLE' });
      }
      if(PublishedCapabilityVersionSchema.parse(cap.version_snapshot).externalProcessors===null){
        return PublicAvailabilitySchema.parse({status:'READINESS_BLOCKED',
          acceptingImmediate:false,acceptingQueue:false,canSchedule:false,nextAvailableAt:null,
          nextScheduleWindowAt:null,scheduleOpen:false,workerReachable:false,readinessReady:false,
          reason:'PROCESSOR_DECLARATION_MISSING'});
      }
      const dispatch=await client.query<{halted:boolean}>(
        'SELECT halted FROM platform_dispatch_control WHERE singleton=true');
      if(dispatch.rows[0]?.halted!==false){
        return PublicAvailabilitySchema.parse({status:'READINESS_BLOCKED',
          acceptingImmediate:false,acceptingQueue:false,canSchedule:false,nextAvailableAt:null,
          nextScheduleWindowAt:null,scheduleOpen:false,workerReachable:false,readinessReady:false,
          reason:'PLATFORM_BLOCKED'});
      }
      let p: PolicyRow, w: WorkerScheduleRow;
      try { p=await this.policy(client,cap.id,false);
        w=await this.workerSchedule(client,cap.worker_device_id); }
      catch { return PublicAvailabilitySchema.parse({ status:'READINESS_BLOCKED',
        acceptingImmediate:false,acceptingQueue:false,canSchedule:false,nextAvailableAt:null,
        nextScheduleWindowAt:null,scheduleOpen:false,workerReachable:false,readinessReady:false,
        reason:'READINESS_STALE' }); }
      if (p.concurrency_limit>PublishedCapabilityVersionSchema.parse(cap.version_snapshot).concurrencyLimit) {
        return PublicAvailabilitySchema.parse({ status:'READINESS_BLOCKED',
          acceptingImmediate:false,acceptingQueue:false,canSchedule:false,nextAvailableAt:null,
          nextScheduleWindowAt:null,scheduleOpen:false,workerReachable:false,readinessReady:false,
          reason:'READINESS_STALE' });
      }
      const schedule = this.effective(p,w);
      const now = new Date();
      const open = isInsideSchedule(schedule,now);
      const next = nextScheduleWindow(schedule,now,true);
      const health = await this.health(client,cap);
      const projectionPending=await this.needsReprojection(client,cap.worker_device_id);
      const busy = await this.activeCount(client,cap.id) >= p.concurrency_limit;
      const queued = await this.queueCount(client,cap.id);
      const room = await this.queueRoom(client,cap.id,p);
      let status: PublicAvailability['status'] = 'ONLINE';
      let reason: PublicAvailability['reason'] = 'NONE';
      if (cap.status !== 'PUBLISHED') { status='UNAVAILABLE';reason='NOT_PUBLISHED'; }
      else if (p.platform_blocked) { status='READINESS_BLOCKED';reason='PLATFORM_BLOCKED'; }
      else if (p.seller_paused || w.web_paused || health === 'PAUSED') {
        status='PAUSED';reason='SELLER_PAUSED';
      } else if(w.sync_pending){status='READINESS_BLOCKED';reason='RECONCILIATION_PENDING';
      } else if (!open) { status='SCHEDULED_OFFLINE';reason='SCHEDULE_CLOSED'; }
      else if (health === 'OFFLINE') { status='OFFLINE';reason='WORKER_OFFLINE'; }
      else if (health === 'READINESS_BLOCKED') { status='READINESS_BLOCKED';reason='READINESS_STALE'; }
      else if (health==='BUSY'||busy) { status='BUSY';reason='CAPACITY_FULL'; }
      else if (!room) { status='BUSY';reason='QUEUE_FULL'; }
      if (projectionPending && ['ONLINE','BUSY','SCHEDULED_OFFLINE'].includes(status)) {
        status='READINESS_BLOCKED';reason='RECONCILIATION_PENDING';
      }
      let canSchedule=false;
      if (cap.status==='PUBLISHED'&&!p.platform_blocked&&!p.seller_paused&&
        !w.seller_paused&&p.future_reservation_limit>0&&
        ['ONLINE','BUSY'].includes(health)&&!projectionPending) {
        try { await this.slot(client,cap.id,schedule,p,now,
          new Date(now.getTime()+p.max_wait_seconds*1000)); canSchedule=true; }
        catch(error) { if (!(error instanceof AvailabilityError && error.code==='NO_FUTURE_WINDOW')) throw error; }
      }
      return PublicAvailabilitySchema.parse({ status,reason,scheduleOpen:open,
        maintenanceUntil:status==='PAUSED'&&reason==='SELLER_PAUSED'&&
          (p.maintenance_until||w.maintenance_until)?
          new Date(Math.max(p.maintenance_until?.getTime()??0,
            w.maintenance_until?.getTime()??0)).toISOString():null,
        workerReachable:!['OFFLINE'].includes(health),
        readinessReady:['ONLINE','BUSY'].includes(health),
        acceptingImmediate:status==='ONLINE'&&queued<p.concurrency_limit,
        acceptingQueue:open&&['ONLINE','BUSY'].includes(health)&&
          !p.seller_paused&&!w.seller_paused&&!p.platform_blocked&&
          room,
        canSchedule,
        nextAvailableAt:status==='SCHEDULED_OFFLINE'&&['ONLINE','BUSY'].includes(health)?
          next?.startAt??null:status==='ONLINE'?iso(now):null,
        nextScheduleWindowAt:next?.startAt??null });
    });
  }

  /** Server-authoritative, short-lived quote. No credit is reserved until booking confirms it. */
  async quote(input: { id: string; buyerAccountId: string; capabilityId: string;
    executionMode: 'IMMEDIATE_ONLY' | 'EARLIEST_AVAILABLE';
    latestAcceptableStartAt?: string }): Promise<ScheduleQuote> {
    uuid.parse(input.id);uuid.parse(input.buyerAccountId);uuid.parse(input.capabilityId);
    ExecutionPreferenceSchema.parse(input.executionMode);
    if (input.latestAcceptableStartAt) z.iso.datetime().parse(input.latestAcceptableStartAt);
    const claimed=await this.pool.query<{buyer_account_id:string}>(
      'SELECT buyer_account_id FROM job_schedule_quotes WHERE id=$1',[input.id]);
    if(claimed.rows[0]&&claimed.rows[0].buyer_account_id!==input.buyerAccountId)
      throw new AvailabilityError('CONFLICT');
    // An invalid or unavailable quote rolls back its business transaction.
    // Count the attempt separately so hostile retries cannot avoid the limit.
    const rate=await this.pool.query<{quote_count:number;max_quotes_per_minute:number}>(`
      INSERT INTO buyer_quote_rate(account_id,window_started_at,quote_count)
      VALUES($1,now(),1)
      ON CONFLICT(account_id) DO UPDATE SET
        window_started_at=CASE WHEN buyer_quote_rate.window_started_at < now()-interval '1 minute'
          THEN now() ELSE buyer_quote_rate.window_started_at END,
        quote_count=CASE WHEN buyer_quote_rate.window_started_at < now()-interval '1 minute'
          THEN 1 ELSE buyer_quote_rate.quote_count+1 END
      RETURNING quote_count,(SELECT max_quotes_per_minute FROM platform_buyer_limits
        WHERE singleton=true)`,[input.buyerAccountId]);
    if(!rate.rows[0]||rate.rows[0].quote_count>rate.rows[0].max_quotes_per_minute)
      throw new AvailabilityError('BUYER_LIMIT');
    try { return await this.tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[input.id]);
      const prior = await client.query<{ buyer_account_id: string; capability_id: string;
        capability_version_id: string; execution_mode: string; price_snapshot: unknown;
        worker_state_at_quote: 'ONLINE'|'BUSY'|'OFFLINE'|'PAUSED'|'READINESS_BLOCKED';
        earliest_eligible_at: Date; planned_window_start_at: Date; latest_start_at: Date;
        requested_deadline_at: Date | null; expires_at: Date;
        capability_schedule_revision: number; worker_schedule_revision: number }>(
        'SELECT * FROM job_schedule_quotes WHERE id=$1',[input.id]);
      if (prior.rows[0]) {
        const old=prior.rows[0];
        if (old.buyer_account_id!==input.buyerAccountId||old.capability_id!==input.capabilityId||
          old.execution_mode!==input.executionMode||
          (old.requested_deadline_at?.toISOString()??null)!==
            (input.latestAcceptableStartAt?new Date(input.latestAcceptableStartAt).toISOString():null)) {
          throw new AvailabilityError('CONFLICT');
        }
        return ScheduleQuoteSchema.parse({ id:input.id,buyerAccountId:old.buyer_account_id,
          capabilityId:old.capability_id,capabilityVersionId:old.capability_version_id,
          executionMode:old.execution_mode,price:old.price_snapshot,
          workerStateAtQuote:old.worker_state_at_quote,startIsGuaranteed:false,
          earliestEligibleAt:iso(old.earliest_eligible_at),windowStartAt:iso(old.planned_window_start_at),
          latestStartAt:iso(old.latest_start_at),quoteExpiresAt:iso(old.expires_at),
          capabilityScheduleRevision:old.capability_schedule_revision,
          workerScheduleRevision:old.worker_schedule_revision,
          estimatedStartAt:null,estimatedDeliveryAt:null });
      }
      const cap = await this.capability(client,input.capabilityId);
      const dispatch=await client.query<{halted:boolean}>(
        'SELECT halted FROM platform_dispatch_control WHERE singleton=true FOR SHARE');
      if(dispatch.rows[0]?.halted!==false)throw new AvailabilityError('NOT_ELIGIBLE');
      if (!await this.visibleTo(client,cap,input.buyerAccountId)) throw new AvailabilityError('NOT_ELIGIBLE');
      const p = await this.policy(client,cap.id,true);
      const w = await this.workerSchedule(client,cap.worker_device_id);
      if (p.concurrency_limit>PublishedCapabilityVersionSchema.parse(cap.version_snapshot).concurrencyLimit) {
        throw new AvailabilityError('NOT_READY');
      }
      if (cap.status!=='PUBLISHED'||p.seller_paused||w.seller_paused||p.platform_blocked) {
        throw new AvailabilityError('NOT_ELIGIBLE');
      }
      if (await this.needsReprojection(client,cap.worker_device_id)) throw new AvailabilityError('NOT_READY');
      const schedule = this.effective(p,w);
      const now = new Date();
      if (input.executionMode==='IMMEDIATE_ONLY'&&!isInsideSchedule(schedule,now)) {
        throw new AvailabilityError('SCHEDULED_OFFLINE',
          nextScheduleWindow(schedule,now,true)?.startAt??null);
      }
      const latest = new Date(Math.min(now.getTime()+p.max_wait_seconds*1000,
        input.latestAcceptableStartAt ? Date.parse(input.latestAcceptableStartAt) : Infinity));
      if (latest.getTime()<=now.getTime()) throw new AvailabilityError('NO_FUTURE_WINDOW');
      const workerState=await this.health(client,cap);
      if (!['ONLINE','BUSY'].includes(workerState)) throw new AvailabilityError('NOT_READY');
      const room=await this.queueRoom(client,cap.id,p);
      if (input.executionMode==='IMMEDIATE_ONLY' && !room) {
        throw new AvailabilityError('QUEUE_FULL');
      }
      const current=isInsideSchedule(schedule,now)?nextScheduleWindow(schedule,now,true):null;
      const after=input.executionMode==='EARLIEST_AVAILABLE' && current && !room?
        new Date(current.endAt):now;
      const window = await this.slot(client,cap.id,schedule,p,after,latest);
      const earliest = new Date(later(now.getTime(),Date.parse(window.startAt)));
      if (earliest.getTime()>latest.getTime()) throw new AvailabilityError('NO_FUTURE_WINDOW');
      if (input.executionMode==='IMMEDIATE_ONLY') {
        if (Date.parse(window.startAt)>now.getTime() ||
          !isInsideSchedule(schedule,now)) {
          throw new AvailabilityError('NOT_READY');
        }
      }
      const version = PublishedCapabilityVersionSchema.parse(cap.version_snapshot);
      if(version.externalProcessors===null)throw new AvailabilityError('NOT_READY');
      const expires = new Date(now.getTime()+2*60_000);
      await client.query(`INSERT INTO job_schedule_quotes(id,buyer_account_id,capability_id,
        capability_version_id,worker_device_id,execution_mode,price_snapshot,worker_state_at_quote,
        earliest_eligible_at,planned_window_start_at,latest_start_at,requested_deadline_at,expires_at,
        capability_schedule_revision,worker_schedule_revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [input.id,input.buyerAccountId,cap.id,cap.version_id,cap.worker_device_id,
        input.executionMode,version.price,workerState,earliest,window.startAt,latest,
        input.latestAcceptableStartAt??null,expires,p.revision,w.revision]);
      return ScheduleQuoteSchema.parse({ id:input.id,buyerAccountId:input.buyerAccountId,
        capabilityId:cap.id,capabilityVersionId:cap.version_id,executionMode:input.executionMode,
        price:version.price,workerStateAtQuote:workerState,startIsGuaranteed:false,
        earliestEligibleAt:iso(earliest),windowStartAt:window.startAt,
        latestStartAt:iso(latest),quoteExpiresAt:iso(expires),
        capabilityScheduleRevision:p.revision,workerScheduleRevision:w.revision,
        estimatedStartAt:null,estimatedDeliveryAt:null });
    }); }
    catch(error){
      if(error instanceof AvailabilityError&&error.code==='QUEUE_FULL'){
        await this.pool.query(`INSERT INTO capability_queue_full_rejections(quote_id,capability_id)
          VALUES($1,$2) ON CONFLICT(quote_id) DO NOTHING`,[input.id,input.capabilityId]);
      }
      throw error;
    }
  }

  private async event(client: PoolClient, jobId: string, kind: string, effectKey: string,
    details: Record<string,unknown> = {}): Promise<void> {
    await client.query(`INSERT INTO job_schedule_events(id,job_id,effect_key,kind,details)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(effect_key) DO NOTHING`,
    [randomUUID(),jobId,effectKey,kind,details]);
  }

  private async transition(client: PoolClient, job: JobRow, to: JobStatus,
    reason: string, correlationId: string): Promise<void> {
    if (job.status===to) return;
    const rows = await client.query<{ sequence: number; id: string; from_status: JobStatus;
      to_status: JobStatus; at: Date; actor: 'BUYER'|'SELLER'|'CLOUD'|'WORKER'|'PAYMENT'|'SYSTEM';
      reason: string; attempt_id: string|null; correlation_id: string;
      payment_reservation_id: string|null; result_manifest_id: string|null }>(
      'SELECT * FROM job_transitions WHERE job_id=$1 ORDER BY sequence',[job.id]);
    const previous = rows.rows.map((r)=>JobTransitionSchema.parse({ id:r.id,jobId:job.id,
      from:r.from_status,to:r.to_status,at:iso(r.at),actor:r.actor,reason:r.reason,
      attemptId:r.attempt_id,correlationId:r.correlation_id,
      paymentReservationId:r.payment_reservation_id,resultManifestId:r.result_manifest_id }));
    const entry = JobTransitionSchema.parse({ id:randomUUID(),jobId:job.id,from:job.status,to,
      at:iso(new Date()),actor:'CLOUD',reason,attemptId:null,correlationId,
      paymentReservationId:null,resultManifestId:null });
    applyJobTransition({ jobId:job.id,status:job.status,transitions:previous },entry);
    await client.query(`INSERT INTO job_transitions(id,job_id,sequence,from_status,to_status,
      at,actor,reason,correlation_id) VALUES($1,$2,$3,$4,$5,$6,'CLOUD',$7,$8)`,
    [entry.id,job.id,previous.length+1,job.status,to,entry.at,reason,correlationId]);
    await client.query('UPDATE jobs SET status=$2 WHERE id=$1',[job.id,to]);
    if (['DISPATCHED','ACCEPTED'].includes(job.status) &&
      ['WAITING_FOR_AVAILABILITY','WAITING_FOR_WORKER','EXPIRED'].includes(to)) {
      await client.query(`UPDATE job_executions SET completed_at=now()
        WHERE job_id=$1 AND completed_at IS NULL`,[job.id]);
    }
    job.status=to;
  }

  /** Booking and the M08 ledger reservation are one PostgreSQL commit. */
  async book(input: { quoteId: string; jobId: string; buyerAccountId: string;
    reservationId: string }): Promise<ScheduledJobTiming> {
    for (const value of Object.values(input)) uuid.parse(value);
    return this.tx(async (client) => {
      const first = await client.query<{ capability_id: string }>(
        'SELECT capability_id FROM job_schedule_quotes WHERE id=$1',[input.quoteId]);
      if (!first.rows[0]) throw new AvailabilityError('NOT_FOUND');
      const p = await this.policy(client,first.rows[0].capability_id,true);
      const quote = await client.query<{ id: string; buyer_account_id: string;
        capability_id: string; capability_version_id: string; worker_device_id: string;
        execution_mode: 'IMMEDIATE_ONLY'|'EARLIEST_AVAILABLE'; price_snapshot: unknown;
        worker_state_at_quote: 'ONLINE'|'BUSY'|'OFFLINE'|'PAUSED'|'READINESS_BLOCKED';
        earliest_eligible_at: Date; planned_window_start_at: Date; latest_start_at: Date;
        expires_at: Date; capability_schedule_revision: number; worker_schedule_revision: number;
        accepted_job_id: string|null }>(
        'SELECT * FROM job_schedule_quotes WHERE id=$1 FOR UPDATE',[input.quoteId]);
      const q=quote.rows[0];
      if (!q || q.buyer_account_id!==input.buyerAccountId) throw new AvailabilityError('NOT_ELIGIBLE');
      const existing = await client.query<PlanRow>(
        'SELECT * FROM job_schedule_plans WHERE job_id=$1',[input.jobId]);
      if (q.accepted_job_id) {
        if (q.accepted_job_id!==input.jobId || !existing.rows[0]) throw new AvailabilityError('CONFLICT');
        const secured=await this.finance.isSecured(client,input.jobId,input.reservationId);
        if (!secured) throw new AvailabilityError('CONFLICT');
        return this.timing(existing.rows[0]);
      }
      // Serialize different capability purchases by the same buyer before
      // applying rolling spend/frequency limits and before reserving credits.
      const buyer=await client.query<{status:string}>(
        'SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[input.buyerAccountId]);
      if(buyer.rows[0]?.status!=='ACTIVE')throw new AvailabilityError('NOT_ELIGIBLE');
      const limits=await client.query<{max_jobs_per_hour:number;
        max_spend_minor_per_day:string;max_active_jobs:number}>(
        'SELECT * FROM platform_buyer_limits WHERE singleton=true FOR SHARE');
      if(!limits.rows[0])throw new AvailabilityError('NOT_ELIGIBLE');
      const usage=await client.query<{jobs_hour:string;spend_day:string;active_jobs:string}>(`
        SELECT count(*) FILTER(WHERE r.created_at>=now()-interval '1 hour') AS jobs_hour,
          coalesce(sum(r.amount_minor) FILTER(WHERE r.created_at>=now()-interval '1 day'),0)
            AS spend_day,
          count(*) FILTER(WHERE j.status IN ('PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY',
            'QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING',
            'UPLOADING_RESULT','PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED',
            'SECURITY_PAUSED','CANCEL_REQUESTED')) AS active_jobs
        FROM payment_reservations r JOIN jobs j ON j.id=r.job_id
        WHERE r.buyer_account_id=$1`,[input.buyerAccountId]);
      const prior=usage.rows[0];
      const ceiling=limits.rows[0];
      const proposed=z.object({buyerAmountMinor:z.number().int().positive()})
        .parse(q.price_snapshot).buyerAmountMinor;
      if(!prior||Number(prior.jobs_hour)>=ceiling.max_jobs_per_hour||
        Number(prior.spend_day)+proposed>Number(ceiling.max_spend_minor_per_day)||
        Number(prior.active_jobs)>=ceiling.max_active_jobs)
        throw new AvailabilityError('BUYER_LIMIT');
      if (q.expires_at.getTime()<=Date.now()) throw new AvailabilityError('STALE_QUOTE');
      const dispatch=await client.query<{halted:boolean}>(
        'SELECT halted FROM platform_dispatch_control WHERE singleton=true FOR SHARE');
      if(dispatch.rows[0]?.halted!==false)throw new AvailabilityError('STALE_QUOTE');
      const cap=await this.capability(client,q.capability_id);
      if (!await this.visibleTo(client,cap,input.buyerAccountId)) throw new AvailabilityError('STALE_QUOTE');
      const w=await this.workerSchedule(client,cap.worker_device_id);
      if (cap.status!=='PUBLISHED'||cap.version_id!==q.capability_version_id||
        cap.worker_device_id!==q.worker_device_id||p.revision!==q.capability_schedule_revision||
        w.revision!==q.worker_schedule_revision||p.seller_paused||w.seller_paused||p.platform_blocked) {
        throw new AvailabilityError('STALE_QUOTE');
      }
      if (await this.needsReprojection(client,cap.worker_device_id)) throw new AvailabilityError('STALE_QUOTE');
      await client.query('SELECT id FROM worker_devices WHERE id=$1 FOR UPDATE',
        [cap.worker_device_id]);
      if (await this.needsReprojection(client,cap.worker_device_id)) {
        throw new AvailabilityError('STALE_QUOTE');
      }
      const version=PublishedCapabilityVersionSchema.parse(cap.version_snapshot);
      if(version.externalProcessors===null)throw new AvailabilityError('STALE_QUOTE');
      if (canonicalJson(version.price)!==canonicalJson(q.price_snapshot)) throw new AvailabilityError('STALE_QUOTE');
      const schedule=this.effective(p,w);
      const now=new Date();
      const currentWorkerState=await this.health(client,cap);
      if (!['ONLINE','BUSY'].includes(currentWorkerState)||
        currentWorkerState!==q.worker_state_at_quote) {
        throw new AvailabilityError('STALE_QUOTE');
      }
      const room=await this.queueRoom(client,cap.id,p);
      const current=isInsideSchedule(schedule,now)?nextScheduleWindow(schedule,now,true):null;
      const after=q.execution_mode==='EARLIEST_AVAILABLE' && current && !room?
        new Date(current.endAt):now;
      const window=await this.slot(client,cap.id,schedule,p,after,q.latest_start_at);
      if (window.startAt!==iso(q.planned_window_start_at)) throw new AvailabilityError('STALE_QUOTE');
      if (q.execution_mode==='IMMEDIATE_ONLY' &&
        (Date.parse(window.startAt)>now.getTime() ||
          !isInsideSchedule(schedule,now)||
          !['ONLINE','BUSY'].includes(await this.health(client,cap)))) {
        throw new AvailabilityError('STALE_QUOTE');
      }
      const jobResult=await client.query<JobRow>('SELECT * FROM jobs WHERE id=$1 FOR UPDATE',[input.jobId]);
      const job=jobResult.rows[0];
      if (!job||job.status!=='CREATED'||job.buyer_account_id!==input.buyerAccountId||
        job.capability_version_id!==q.capability_version_id||job.worker_device_id!==q.worker_device_id) {
        throw new AvailabilityError('NOT_ELIGIBLE');
      }
      const snapshot=JobContractSnapshotSchema.parse(job.contract_snapshot);
      if (canonicalJson(snapshot.priceSnapshot)!==canonicalJson(q.price_snapshot)) {
        throw new AvailabilityError('STALE_QUOTE');
      }
      // Reserving credits and a bounded future place may precede input upload.
      // M07 still requires a finalized manifest before any Worker offer.
      const immediate=Date.parse(window.startAt)<=now.getTime() &&
        isInsideSchedule(schedule,now) && room;
      if (!immediate && q.execution_mode==='IMMEDIATE_ONLY') throw new AvailabilityError('STALE_QUOTE');
      await this.finance.reserveJobInTransaction(client,job.id,input.buyerAccountId,input.reservationId);
      job.status='PAYMENT_RESERVED';
      job.payment_reservation_id=input.reservationId;
      const next= new Date(later(now.getTime(),Date.parse(window.startAt)));
      const target:JobStatus=immediate?'QUEUED':'WAITING_FOR_AVAILABILITY';
      await this.transition(client,job,target,immediate?'READY_FOR_QUEUE':'SCHEDULED_WAIT',input.quoteId);
      await client.query(`INSERT INTO job_schedule_plans(job_id,quote_id,capability_id,
        execution_mode,scheduled_for_earliest_at,planned_window_start_at,next_eligible_at,
        latest_start_at,eligible_at,queued_at,last_reconciled_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
      [job.id,q.id,cap.id,q.execution_mode,q.earliest_eligible_at,window.startAt,next,
        q.latest_start_at,immediate?now:null,immediate?now:null]);
      // An input uploaded before a future booking must remain readable through
      // the immutable latest start plus runtime. The grant guard permits only
      // one-way extension for this active scheduled job; an expired asset is
      // never revived. All changes roll back with the financial reservation.
      const manifest=await client.query<{file_count:number}>(
        'SELECT file_count FROM job_input_manifests WHERE job_id=$1',[job.id]);
      if (manifest.rows[0]?.file_count) {
        const extended=await client.query<{id:string}>(`UPDATE assets a SET retain_until=GREATEST(
          a.retain_until,$3::timestamptz+($4::numeric*interval '1 second')+interval '1 day')
          FROM asset_read_grants g WHERE g.asset_id=a.id AND g.target_job_id=$1
          AND a.owner_account_id=$2 AND a.state='READY' AND a.retain_until>now()
          RETURNING a.id`,[job.id,input.buyerAccountId,q.latest_start_at,
          version.resourceLimits.timeoutSeconds]);
        if (extended.rows.length!==manifest.rows[0].file_count)
          throw new AvailabilityError('NOT_ELIGIBLE');
        await client.query(`UPDATE asset_read_grants g SET expires_at=GREATEST(
          g.expires_at,a.retain_until) FROM assets a
          WHERE g.asset_id=a.id AND g.target_job_id=$1`,[job.id]);
      }
      await client.query('UPDATE job_schedule_quotes SET accepted_job_id=$2 WHERE id=$1',[q.id,job.id]);
      await this.event(client,job.id,'BOOKED',`job:${job.id}:book`,
        { quoteId:q.id,executionMode:q.execution_mode,nextEligibleAt:iso(next) });
      const stored=await client.query<PlanRow>('SELECT * FROM job_schedule_plans WHERE job_id=$1',[job.id]);
      if (!stored.rows[0]) throw new AvailabilityError('NOT_READY');
      return this.timing(stored.rows[0]);
    });
  }

  private timing(row: PlanRow): ScheduledJobTiming {
    return ScheduledJobTimingSchema.parse({ jobId:row.job_id,createdAt:iso(row.created_at),
      executionMode:row.execution_mode,
      scheduledForEarliestAt:iso(row.scheduled_for_earliest_at),nextEligibleAt:iso(row.next_eligible_at),
      eligibleAt:row.eligible_at?iso(row.eligible_at):null,
      queuedAt:row.queued_at?iso(row.queued_at):null,
      startedAt:null,deliveredAt:null,latestStartAt:iso(row.latest_start_at) });
  }

  async jobTiming(jobId: string, buyerAccountId: string): Promise<ScheduledJobTiming> {
    const result=await this.pool.query<PlanRow>(`SELECT p.* FROM job_schedule_plans p
      JOIN jobs j ON j.id=p.job_id WHERE p.job_id=$1 AND j.buyer_account_id=$2`,
      [uuid.parse(jobId),uuid.parse(buyerAccountId)]);
    if (!result.rows[0]) throw new AvailabilityError('NOT_FOUND');
    const times=await this.pool.query<{ started_at: Date|null; completed_at: Date|null }>(
      'SELECT started_at,completed_at FROM jobs WHERE id=$1',[jobId]);
    return ScheduledJobTimingSchema.parse({ ...this.timing(result.rows[0]),
      startedAt:times.rows[0]?.started_at?iso(times.rows[0].started_at):null,
      deliveredAt:times.rows[0]?.completed_at?iso(times.rows[0].completed_at):null });
  }

  /** Seller-private effective policy and demand used by the later setup and monitoring surfaces. */
  async sellerOverview(capabilityId: string, sellerAccountId: string): Promise<{
    schedule: AvailabilitySchedule; inheritedFromWorker: boolean; policy: AvailabilityPolicy;
    sellerPaused: boolean; workerPaused: boolean; platformBlocked: boolean;
    scheduledCount: number; queuedCount: number; nextDeadlineAt: string | null;
    windowDemand: readonly { windowStartAt: string; jobCount: number;
      estimatedWorkloadSeconds: number | null; reservedBuyerValueMinor: number;
      estimatedSellerEarningsMinor: number; currency: 'USD' }[];
    revision: number }> {
    return this.tx(async (client) => {
      const cap=await this.capability(client,capabilityId);
      await this.assertSeller(client,sellerAccountId,cap.seller_profile_id);
      const p=await this.policy(client,cap.id,false);
      const w=await this.workerSchedule(client,cap.worker_device_id);
      const counts=await client.query<{ scheduled: number; queued: number;
        next_deadline_at: Date|null }>(`SELECT
        count(*) FILTER (WHERE j.status='WAITING_FOR_AVAILABILITY')::int AS scheduled,
        count(*) FILTER (WHERE j.status IN ('QUEUED','WAITING_FOR_WORKER'))::int AS queued,
        min(p.latest_start_at) AS next_deadline_at
        FROM job_schedule_plans p JOIN jobs j ON j.id=p.job_id
        WHERE p.capability_id=$1 AND j.status=ANY($2::text[])`,
      [cap.id,preStartStatuses]);
      const row=counts.rows[0];
      const windows=await client.query<{ window_start_at: Date; job_count: number;
        reserved_buyer_minor: string; estimated_seller_minor: string }>(`SELECT
        p.planned_window_start_at AS window_start_at,count(*)::int AS job_count,
        sum(s.buyer_total_minor)::text AS reserved_buyer_minor,
        sum(s.seller_earning_minor)::text AS estimated_seller_minor
        FROM job_schedule_plans p JOIN jobs j ON j.id=p.job_id
        JOIN payment_reservations r ON r.job_id=j.id AND r.state='RESERVED'
        JOIN job_financial_snapshots s ON s.job_id=j.id
        WHERE p.capability_id=$1 AND j.status=ANY($2::text[])
        GROUP BY p.planned_window_start_at ORDER BY p.planned_window_start_at`,
      [cap.id,runnableStatuses]);
      const windowDemand=windows.rows.map((entry) => {
        const reservedBuyerValueMinor=Number(entry.reserved_buyer_minor);
        const estimatedSellerEarningsMinor=Number(entry.estimated_seller_minor);
        if (!Number.isSafeInteger(reservedBuyerValueMinor)||
          !Number.isSafeInteger(estimatedSellerEarningsMinor)) throw new AvailabilityError('NOT_READY');
        return {windowStartAt:iso(entry.window_start_at),jobCount:entry.job_count,
          estimatedWorkloadSeconds:p.estimated_runtime_seconds===null?null:
            entry.job_count*p.estimated_runtime_seconds,
          reservedBuyerValueMinor,estimatedSellerEarningsMinor,currency:'USD' as const};
      });
      return { schedule:this.effective(p,w),inheritedFromWorker:p.schedule_override===null,
        policy:AvailabilityPolicySchema.parse({ schedule:p.schedule_override,
          concurrencyLimit:p.concurrency_limit,queueLimit:p.queue_limit,
          futureReservationLimit:p.future_reservation_limit,
          estimatedRuntimeSeconds:p.estimated_runtime_seconds,maxWaitSeconds:p.max_wait_seconds }),
        sellerPaused:p.seller_paused,workerPaused:w.seller_paused,
        platformBlocked:p.platform_blocked,scheduledCount:row?.scheduled??0,
        queuedCount:row?.queued??0,nextDeadlineAt:row?.next_deadline_at?
          iso(row.next_deadline_at):null,windowDemand,revision:p.revision };
    });
  }

  /** M07 calls this under its transaction before offer/accept/STARTING. Missing M09 state fails closed. */
  async assertEligible(client: PoolClient, jobId: string,
    stage: 'OFFER'|'ACCEPT'|'START'): Promise<void> {
    const lookup=await client.query<{ capability_id: string }>(`SELECT v.capability_id
      FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id WHERE j.id=$1`,
      [uuid.parse(jobId)]);
    if (!lookup.rows[0]) throw new AvailabilityError('NOT_FOUND');
    const p=await this.policy(client,lookup.rows[0].capability_id,true);
    const job=await client.query<JobRow>('SELECT * FROM jobs WHERE id=$1',[jobId]);
    const row=job.rows[0];
    if (!row) throw new AvailabilityError('NOT_FOUND');
    const cap=await this.capabilityForJob(client,row);
    const w=await this.workerSchedule(client,row.worker_device_id);
    if (p.concurrency_limit>PublishedCapabilityVersionSchema.parse(cap.version_snapshot).concurrencyLimit) {
      throw new AvailabilityError('NOT_ELIGIBLE');
    }
    const schedule=this.effective(p,w);
    const plan=await client.query<PlanRow>('SELECT * FROM job_schedule_plans WHERE job_id=$1',[jobId]);
    const timing=plan.rows[0];
    const terms=timing?await client.query<{ buyer_account_id: string;
      capability_version_id: string; worker_device_id: string; execution_mode: string;
      price_snapshot: unknown; accepted_job_id: string|null; latest_start_at: Date }>(
      'SELECT * FROM job_schedule_quotes WHERE id=$1',[timing.quote_id]):null;
    const q=terms?.rows[0];
    const snapshot=row?JobContractSnapshotSchema.parse(row.contract_snapshot):null;
    if (!timing||cap.id!==timing.capability_id||
      !q||q.accepted_job_id!==jobId||q.buyer_account_id!==row.buyer_account_id||
      q.capability_version_id!==row.capability_version_id||
      q.worker_device_id!==row.worker_device_id||q.execution_mode!==timing.execution_mode||
      q.latest_start_at.getTime()!==timing.latest_start_at.getTime()||
      !snapshot||canonicalJson(q.price_snapshot)!==canonicalJson(snapshot.priceSnapshot)||
      !await this.visibleTo(client,cap,row.buyer_account_id)||
      !(await client.query('SELECT 1 FROM job_input_manifests WHERE job_id=$1',[jobId])).rows[0]||
      cap.status!=='PUBLISHED'||p.seller_paused||w.seller_paused||p.platform_blocked||
      Date.now()<timing.next_eligible_at.getTime()||Date.now()>timing.latest_start_at.getTime()||
      !isInsideSchedule(schedule,new Date())||
      !['ONLINE','BUSY'].includes(await this.health(client,cap))) {
      throw new AvailabilityError('NOT_ELIGIBLE');
    }
    if (stage==='OFFER') {
      if (await this.health(client,cap)!=='ONLINE') throw new AvailabilityError('NOT_ELIGIBLE');
      if (row.status!=='QUEUED'||await this.activeCount(client,cap.id)>=p.concurrency_limit) {
        throw new AvailabilityError('NOT_ELIGIBLE');
      }
      const earlier=await client.query<{ id: string }>(`SELECT j.id FROM job_schedule_plans x
        JOIN jobs j ON j.id=x.job_id WHERE j.worker_device_id=$1
        AND j.status=ANY($4::text[])
        AND EXISTS (SELECT 1 FROM job_input_manifests m WHERE m.job_id=j.id)
        AND x.latest_start_at>=now() AND
        (x.next_eligible_at<=now() OR x.last_reconciled_at IS NULL) AND
        (x.created_at,x.job_id)<($2::timestamptz,$3::uuid)
        ORDER BY x.created_at,x.job_id LIMIT 1`,
      [row.worker_device_id,timing.created_at,jobId,runnableStatuses]);
      if (earlier.rows[0]) throw new AvailabilityError('NOT_ELIGIBLE');
    } else if (stage==='ACCEPT' && row.status!=='DISPATCHED') {
      throw new AvailabilityError('NOT_ELIGIBLE');
    } else if (stage==='START' && row.status!=='ACCEPTED') {
      throw new AvailabilityError('NOT_ELIGIBLE');
    }
  }

  async cancel(jobId: string, buyerAccountId: string, requestId: string): Promise<void> {
    uuid.parse(jobId);uuid.parse(buyerAccountId);uuid.parse(requestId);
    await this.tx(async (client) => {
      const lookup=await client.query<{ capability_id: string }>(`SELECT capability_id
        FROM job_schedule_plans WHERE job_id=$1`,[jobId]);
      if (!lookup.rows[0]) throw new AvailabilityError('NOT_FOUND');
      await this.policy(client,lookup.rows[0].capability_id,true);
      await this.finance.cancelBeforeDispatchInTransaction(client,jobId,buyerAccountId,requestId);
      await this.event(client,jobId,'CANCELLED',`job:${jobId}:cancel`,{ requestId });
    });
  }

  /** Bounded restart-safe sweep; each job is reevaluated against current schedule and finance. */
  async reconcile(limit=100): Promise<{ checked: number; queued: number; waiting: number;
    expired: number }> {
    if (!Number.isSafeInteger(limit)||limit<1||limit>500) throw new AvailabilityError('NOT_ELIGIBLE');
    const candidates=await this.pool.query<{ job_id: string }>(`SELECT p.job_id FROM job_schedule_plans p
      JOIN jobs j ON j.id=p.job_id WHERE j.status=ANY($1::text[])
      ORDER BY coalesce(p.last_reconciled_at,p.created_at),p.next_eligible_at,p.job_id LIMIT $2`,
      [preStartStatuses,limit]);
    const summary={ checked:0,queued:0,waiting:0,expired:0 };
    for (const candidate of candidates.rows) {
      await this.tx(async (client) => {
        const first=await client.query<{ capability_id: string }>(
          'SELECT capability_id FROM job_schedule_plans WHERE job_id=$1',[candidate.job_id]);
        if (!first.rows[0]) return;
        const p=await this.policy(client,first.rows[0].capability_id,true);
        const workerForLock=await client.query<{ worker_device_id: string }>(
          'SELECT worker_device_id FROM jobs WHERE id=$1',[candidate.job_id]);
        if (!workerForLock.rows[0]) return;
        await client.query('SELECT id FROM worker_devices WHERE id=$1 FOR UPDATE',
          [workerForLock.rows[0].worker_device_id]);
        const jobResult=await client.query<JobRow>('SELECT * FROM jobs WHERE id=$1 FOR UPDATE',[candidate.job_id]);
        const job=jobResult.rows[0];
        if (!job||!preStartStatuses.includes(job.status)) return;
        const plans=await client.query<PlanRow>(
          'SELECT * FROM job_schedule_plans WHERE job_id=$1 FOR UPDATE',[job.id]);
        const plan=plans.rows[0];
        if (!plan) throw new AvailabilityError('NOT_READY');
        summary.checked++;
        await client.query('UPDATE job_schedule_plans SET last_reconciled_at=now() WHERE job_id=$1',[job.id]);
        if (this.clock().getTime()>plan.latest_start_at.getTime()) {
          await this.transition(client,job,'EXPIRED','MAX_WAIT_EXPIRED',plan.quote_id);
          await this.finance.releaseFailedJobInTransaction(client,job.id);
          await this.event(client,job.id,'EXPIRED',`job:${job.id}:expired`);
          summary.expired++; return;
        }
        const cap=await this.capabilityForJob(client,job);
        const w=await this.workerSchedule(client,job.worker_device_id);
        const schedule=this.effective(p,w);
        const now=new Date();
        let next=plan.next_eligible_at;
        let window:UtcWindow|null=null;
        try { window=await this.slot(client,cap.id,schedule,p,
          now,plan.latest_start_at,job.id,cap);
          next=new Date(later(now.getTime(),Date.parse(window.startAt))); }
        catch(error) { if (!(error instanceof AvailabilityError && error.code==='NO_FUTURE_WINDOW')) throw error;
          next=plan.latest_start_at; }
        if (next.getTime()!==plan.next_eligible_at.getTime() ||
          (window && window.startAt!==iso(plan.planned_window_start_at))) {
          await client.query(`UPDATE job_schedule_plans SET next_eligible_at=$2,
            planned_window_start_at=$3,schedule_revision=schedule_revision+1 WHERE job_id=$1`,[job.id,next,
            window?.startAt??plan.planned_window_start_at]);
          await this.event(client,job.id,'SCHEDULE_CHANGED',
            `job:${job.id}:schedule:${plan.schedule_revision+1}`,
            { previous:iso(plan.next_eligible_at),next:iso(next) });
        }
        const open=isInsideSchedule(schedule,now);
        const health=await this.health(client,cap);
        const claimed=['DISPATCHED','ACCEPTED'].includes(job.status);
        const hasInput=!!(await client.query('SELECT 1 FROM job_input_manifests WHERE job_id=$1',
          [job.id])).rows[0];
        const eligible=hasInput&&window!==null&&cap.status==='PUBLISHED'&&!p.seller_paused&&!w.seller_paused&&
          !p.platform_blocked&&open&&['ONLINE','BUSY'].includes(health)&&
          now.getTime()>=next.getTime()&&
          (claimed||job.status==='QUEUED'||await this.queueRoom(client,cap.id,p));
        if (claimed && eligible) return;
        const target:JobStatus=eligible?'QUEUED':
          open&&health==='OFFLINE'?'WAITING_FOR_WORKER':'WAITING_FOR_AVAILABILITY';
        if (job.status!==target) {
          await this.transition(client,job,target,eligible?'WINDOW_ELIGIBLE':
            health==='OFFLINE'?'WORKER_OFFLINE_WAIT':'WINDOW_WAIT',plan.quote_id);
        }
        if (eligible) {
          await client.query(`UPDATE job_schedule_plans SET eligible_at=coalesce(eligible_at,now()),
            queued_at=coalesce(queued_at,now()) WHERE job_id=$1`,[job.id]);
          await this.event(client,job.id,'ELIGIBLE',`job:${job.id}:eligible`);
          summary.queued++;
        } else {
          await this.event(client,job.id,health==='OFFLINE'?'WORKER_OFFLINE':'WAITING',
            `job:${job.id}:waiting:${target}:${next.toISOString()}`);
          summary.waiting++;
        }
      });
    }
    return summary;
  }
}
