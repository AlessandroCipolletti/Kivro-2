import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AvailabilityScheduleSchema, AvailabilityPolicySchema } from
  '../../contracts/src/availability.js';
import type { PostgresAvailabilityRepository } from './availability.js';
import type { PostgresFinanceRepository } from './finance.js';
import { workerVersionStatus } from '../../domain/src/worker-version.js';
import { isInsideSchedule, nextScheduleWindow } from '../../domain/src/availability-schedule.js';
import { PostgresSellerEconomics } from './seller-economics.js';
import { PostgresAvailabilityMetrics } from './availability-metrics.js';

const uuid=z.uuid();
const pauseReason=z.string().trim().max(200).nullable();
const maintenanceTime=z.iso.datetime({offset:true}).nullable();
function maintenanceUntil(raw:unknown,paused:boolean):Date|null{
  const value=maintenanceTime.parse(raw);
  if(!paused&&value!==null)throw new SellerOperationsError('CONFLICT');
  if(value===null)return null;
  const until=new Date(value);
  if(until.getTime()<=Date.now()||until.getTime()>Date.now()+30*86_400_000)
    throw new SellerOperationsError('CONFLICT');
  return until;
}
const localPause=z.strictObject({globalPaused:z.boolean(),securityPaused:z.boolean(),
  capabilityPauses:z.array(uuid).max(64)});
export type LocalPauseReport=z.infer<typeof localPause>;

export class SellerOperationsError extends Error {
  constructor(readonly code:'NOT_FOUND'|'NOT_ELIGIBLE'|'CONFLICT'|'SECURITY_BLOCK'|'NOT_READY'){
    super(code);this.name='SellerOperationsError';
  }
}

async function event(client:PoolClient,workerId:string,capabilityId:string|null,
  actorKind:'SELLER'|'WORKER'|'PLATFORM',actorId:string,kind:string,code:string):Promise<void>{
  await client.query(`INSERT INTO worker_operational_events(id,worker_device_id,capability_id,
    actor_kind,actor_id,kind,code) VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [randomUUID(),workerId,capabilityId,actorKind,actorId,kind,code]);
}

/** Signed heartbeat state is durable cloud-side; a replay or older local revision cannot clear a pause. */
export async function recordLocalPauseReport(client:PoolClient,workerId:string,
  revision:number,raw:unknown):Promise<void>{
  const report=localPause.parse(raw);
  const prior=await client.query<{local_revision:string;global_paused:boolean;
    security_paused:boolean;capability_ids:string[]}>(`SELECT * FROM worker_local_pause_reports
    WHERE worker_device_id=$1 FOR UPDATE`,[uuid.parse(workerId)]);
  const old=prior.rows[0];
  if(old&&revision<Number(old.local_revision))throw new SellerOperationsError('CONFLICT');
  if(old&&revision===Number(old.local_revision)){
    if(old.global_paused!==report.globalPaused||old.security_paused!==report.securityPaused||
      JSON.stringify([...old.capability_ids].sort())!==JSON.stringify([...report.capabilityPauses].sort()))
      throw new SellerOperationsError('CONFLICT');
    return;
  }
  if(report.capabilityPauses.length){
    const owned=await client.query<{id:string}>(`SELECT c.id FROM capabilities c
      JOIN worker_devices d ON d.seller_profile_id=c.seller_profile_id
      WHERE d.id=$1 AND c.id=ANY($2::uuid[])`,[workerId,report.capabilityPauses]);
    if(owned.rowCount!==new Set(report.capabilityPauses).size)
      throw new SellerOperationsError('NOT_ELIGIBLE');
  }
  await client.query(`INSERT INTO worker_local_pause_reports(worker_device_id,local_revision,
    global_paused,security_paused,capability_ids,reported_at) VALUES($1,$2,$3,$4,$5,now())
    ON CONFLICT(worker_device_id) DO UPDATE SET local_revision=$2,global_paused=$3,
      security_paused=$4,capability_ids=$5,reported_at=now()`,
  [workerId,revision,report.globalPaused,report.securityPaused,JSON.stringify(report.capabilityPauses)]);
  await client.query('DELETE FROM worker_local_capability_pauses WHERE worker_device_id=$1',[workerId]);
  for(const capabilityId of report.capabilityPauses){
    await client.query(`INSERT INTO worker_local_capability_pauses(worker_device_id,capability_id)
      VALUES($1,$2)`,[workerId,capabilityId]);
  }
  if(!old||old.global_paused!==report.globalPaused){
    await event(client,workerId,null,'WORKER',workerId,report.globalPaused?'LOCAL_PAUSE':'LOCAL_RESUME',
      report.globalPaused?'LOCAL_EMERGENCY_PAUSE':'LOCAL_RESUME');
  }
  if(!old||old.security_paused!==report.securityPaused){
    if(report.securityPaused)await event(client,workerId,null,'WORKER',workerId,
      'SECURITY_BLOCK','WORKER_SECURITY_PAUSE');
    // A Worker cannot authoritatively clear a platform security block.
  }
  await client.query(`UPDATE job_schedule_plans p SET last_reconciled_at=NULL FROM jobs j
    WHERE j.id=p.job_id AND j.worker_device_id=$1 AND j.status IN
    ('QUEUED','WAITING_FOR_AVAILABILITY','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED')`,[workerId]);
}

/** Shared Core seller control and operational projection; no Worker finance claims are accepted. */
export class PostgresSellerOperations {
  constructor(private readonly pool:Pool,private readonly availability:PostgresAvailabilityRepository,
    private readonly finance:PostgresFinanceRepository){}

  private async tx<T>(run:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();try{await client.query('BEGIN');const value=await run(client);
      await client.query('COMMIT');return value;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  /** Called for every authenticated poll before offers are materialized. */
  async cloudDirective(workerId:string):Promise<{revision:number;paused:boolean;
    securityPaused:boolean;clearSecurityPause:boolean;capabilityPauses:string[]}>{
    const result=await this.pool.query<{revision:string;paused:boolean;security_paused:boolean;
      security_cleared:boolean;capability_ids:string[]}>(`SELECT coalesce(r.revision,0)::text AS revision,
      coalesce(s.seller_paused,false) AS paused,coalesce(b.blocked,false) AS security_paused,
      (b.blocked=false AND b.resolved_at IS NOT NULL) AS security_cleared,
      ARRAY(SELECT p.capability_id::text FROM capability_availability_policies p
        JOIN capabilities c ON c.id=p.capability_id
        JOIN capability_versions v ON v.id=c.current_version_id
        WHERE c.seller_profile_id=d.seller_profile_id
        AND v.version_snapshot->>'workerDeviceId'=d.id::text
        AND (p.seller_paused OR p.platform_blocked) ORDER BY p.capability_id) AS capability_ids
      FROM worker_devices d LEFT JOIN worker_cloud_control_revisions r ON r.worker_device_id=d.id
      LEFT JOIN worker_availability_schedules s ON s.worker_device_id=d.id
      LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
      WHERE d.id=$1 AND d.status<>'REVOKED'`,[uuid.parse(workerId)]);
    const row=result.rows[0];if(!row)throw new SellerOperationsError('NOT_FOUND');
    return {revision:Number(row.revision),paused:row.paused,
      securityPaused:row.security_paused,clearSecurityPause:row.security_cleared??false,
      capabilityPauses:row.capability_ids};
  }

  /** Platform-only policy path. No seller HTTP route exposes this operation. A
   * signed fresh Worker observation must prove the original blocker resolved. */
  async clearSecurityBlockByPlatform(workerId:string,actorId:string):Promise<void>{
    uuid.parse(workerId);
    if(!/^[A-Za-z0-9:_-]{3,160}$/.test(actorId))throw new SellerOperationsError('NOT_ELIGIBLE');
    await this.tx(async(client)=>{
      const worker=await client.query<{status:string;worker_version:string}>(
        'SELECT status,worker_version FROM worker_devices WHERE id=$1 FOR UPDATE',[workerId]);
      if(!worker.rows[0]||worker.rows[0].status==='REVOKED')
        throw new SellerOperationsError('SECURITY_BLOCK');
      const block=await client.query<{blocked:boolean;code:string}>(
        'SELECT blocked,code FROM worker_security_blocks WHERE worker_device_id=$1 FOR UPDATE',
        [workerId]);
      if(!block.rows[0]?.blocked)return;
      if(!['WORKER_SECURITY_UPDATE_REQUIRED','SANDBOX_ISOLATION_FAILED',
        'SANDBOX_IMAGE_NOT_APPROVED'].includes(block.rows[0].code))
        throw new SellerOperationsError('SECURITY_BLOCK');
      const beat=await client.query<{observed_at:Date;worker_release:string;
        operational_checks:{code:string;state:string}[]|null}>(`SELECT observed_at,
        worker_release,operational_checks FROM worker_heartbeats WHERE worker_device_id=$1
        ORDER BY observed_at DESC LIMIT 1`,[workerId]);
      const current=beat.rows[0];
      if(!current||Date.now()-current.observed_at.getTime()>30_000)
        throw new SellerOperationsError('NOT_READY');
      const version=workerVersionStatus(current.worker_release,
        process.env.KIVRO_MIN_WORKER_RELEASE??null,
        process.env.KIVRO_LATEST_WORKER_RELEASE??null);
      if(version==='SECURITY_UPDATE_REQUIRED'||process.env.NODE_ENV==='production'&&
        version==='UNKNOWN')throw new SellerOperationsError('SECURITY_BLOCK');
      for(const code of ['DEVICE_IDENTITY','DOCKER_DAEMON','APPROVED_SANDBOX_IMAGE']){
        if(!current.operational_checks?.some((item)=>item.code===code&&item.state==='HEALTHY'))
          throw new SellerOperationsError('NOT_READY');
      }
      const unsafe=await client.query(`SELECT 1 FROM capabilities c
        JOIN capability_versions v ON v.id=c.current_version_id
        LEFT JOIN capability_readiness r ON r.capability_version_id=v.id
        WHERE c.status='PUBLISHED' AND v.version_snapshot->>'workerDeviceId'=$1
        AND (r.observed_at IS NULL OR r.observed_at<now()-interval '30 seconds' OR
          r.sandbox_verified IS DISTINCT FROM true OR r.required_secrets_ready IS DISTINCT FROM true OR
          r.runtime_healthy IS DISTINCT FROM true) LIMIT 1`,[workerId]);
      if(unsafe.rowCount)throw new SellerOperationsError('NOT_READY');
      await client.query(`UPDATE worker_security_blocks SET blocked=false,resolved_at=now()
        WHERE worker_device_id=$1`,[workerId]);
      await this.bump(client,workerId);
      await event(client,workerId,null,'PLATFORM',actorId,'SECURITY_CLEAR',block.rows[0].code);
    });
  }

  async setWorkerPause(sellerId:string,workerId:string,paused:boolean,rawReason:unknown,
    rawUntil:unknown=null):Promise<void>{
    const reason=pauseReason.parse(rawReason);uuid.parse(sellerId);uuid.parse(workerId);
    const until=maintenanceUntil(rawUntil,paused);
    await this.tx(async(client)=>{
      const owner=await client.query<{seller_profile_id:string}>(`SELECT d.seller_profile_id
        FROM worker_devices d JOIN seller_profiles s ON s.id=d.seller_profile_id
        WHERE d.id=$1 AND s.account_id=$2 AND s.status='ACTIVE' FOR UPDATE OF d`,
      [workerId,sellerId]);if(!owner.rows[0])throw new SellerOperationsError('NOT_ELIGIBLE');
      const prior=await client.query<{schedule:unknown;revision:number;seller_paused:boolean;
        maintenance_until:Date|null}>(
        'SELECT * FROM worker_availability_schedules WHERE worker_device_id=$1 FOR UPDATE',[workerId]);
      const old=prior.rows[0];
      if(old?.seller_paused===paused&&
        (old.maintenance_until?.getTime()??null)===(until?.getTime()??null))return;
      if(!paused)await this.assertWorkerResumeReady(client,workerId);
      const schedule=old?.schedule??AvailabilityScheduleSchema.parse({mode:'ALWAYS_AVAILABLE',
        timezone:'UTC',weeklyWindows:[]});
      const revision=(old?.revision??0)+1;
      await client.query(`INSERT INTO worker_availability_schedules(worker_device_id,schedule,
        seller_paused,revision,maintenance_until) VALUES($1,$2,$3,$4,$5) ON CONFLICT(worker_device_id)
        DO UPDATE SET seller_paused=$3,revision=$4,maintenance_until=$5,updated_at=now()`,
      [workerId,schedule,paused,revision,until]);
      await client.query(`INSERT INTO availability_schedule_audit(id,subject_kind,subject_id,
        actor_kind,actor_id,source,old_value,new_value,revision)
        VALUES($1,'WORKER',$2,'SELLER',$3,'WEB',$4,$5,$6)`,
      [randomUUID(),workerId,sellerId,old??null,{schedule,sellerPaused:paused,reason,
        maintenanceUntil:until?.toISOString()??null},revision]);
      await this.bump(client,workerId);
      await client.query(`UPDATE job_schedule_plans p SET last_reconciled_at=NULL FROM jobs j
        WHERE j.id=p.job_id AND j.worker_device_id=$1 AND j.status IN
        ('QUEUED','WAITING_FOR_AVAILABILITY','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED')`,[workerId]);
      await event(client,workerId,null,'SELLER',sellerId,paused?'WEB_PAUSE':'WEB_RESUME',
        paused?'SELLER_EMERGENCY_PAUSE':'SELLER_RESUME');
    });
  }

  private async assertWorkerResumeReady(client:PoolClient,workerId:string):Promise<void>{
    const snapshot=await client.query<{worker_version:string;revoked_at:Date|null;
      blocked:boolean|null;local_security:boolean|null;reported_status:string|null;
      observed_at:Date|null;capacity:number|null}>(`SELECT d.worker_version,d.revoked_at,
      b.blocked,l.security_paused AS local_security,h.reported_status,h.observed_at,h.capacity
      FROM worker_devices d
      LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
      LEFT JOIN worker_local_pause_reports l ON l.worker_device_id=d.id
      LEFT JOIN LATERAL (SELECT * FROM worker_heartbeats WHERE worker_device_id=d.id
        ORDER BY observed_at DESC LIMIT 1) h ON true WHERE d.id=$1`,[workerId]);
    const row=snapshot.rows[0];
    if(!row||row.revoked_at||row.blocked||row.local_security)
      throw new SellerOperationsError('SECURITY_BLOCK');
    if(!row.observed_at||Date.now()-row.observed_at.getTime()>30_000||
      !['ONLINE','PAUSED'].includes(row.reported_status??'')||!row.capacity)
      throw new SellerOperationsError('NOT_READY');
    if(process.env.NODE_ENV==='production'){
      const status=workerVersionStatus(row.worker_version,
        process.env.KIVRO_MIN_WORKER_RELEASE??null,
        process.env.KIVRO_LATEST_WORKER_RELEASE??null);
      if(status==='SECURITY_UPDATE_REQUIRED'||status==='UNKNOWN')
        throw new SellerOperationsError('SECURITY_BLOCK');
    }
    const unready=await client.query(`SELECT 1 FROM capabilities c
      JOIN capability_versions v ON v.id=c.current_version_id
      LEFT JOIN capability_readiness r ON r.capability_version_id=v.id
      WHERE c.status='PUBLISHED' AND v.version_snapshot->>'workerDeviceId'=$1
      AND (r.observed_at IS NULL OR r.observed_at<now()-interval '30 seconds' OR
        r.sandbox_verified IS DISTINCT FROM true OR
        r.required_secrets_ready IS DISTINCT FROM true OR
        r.runtime_healthy IS DISTINCT FROM true OR
        r.worker_device_id IS DISTINCT FROM $1::uuid)
      LIMIT 1`,[workerId]);
    if(unready.rowCount)throw new SellerOperationsError('NOT_READY');
  }

  async setCapabilityPause(sellerId:string,capabilityId:string,paused:boolean,
    rawReason:unknown,rawUntil:unknown=null):Promise<void>{
    const reason=pauseReason.parse(rawReason);uuid.parse(sellerId);uuid.parse(capabilityId);
    const until=maintenanceUntil(rawUntil,paused);
    await this.tx(async(client)=>{
      const found=await client.query<{worker_device_id:string;policy:unknown;revision:number;
        seller_paused:boolean;maintenance_until:Date|null}>(`SELECT v.version_snapshot->>'workerDeviceId' AS worker_device_id,
        to_jsonb(p.*) AS policy,p.revision,p.seller_paused,p.maintenance_until FROM capabilities c
        JOIN seller_profiles s ON s.id=c.seller_profile_id
        JOIN capability_versions v ON v.id=c.current_version_id
        JOIN capability_availability_policies p ON p.capability_id=c.id
        WHERE c.id=$1 AND s.account_id=$2 AND s.status='ACTIVE' FOR UPDATE OF c,p`,
      [capabilityId,sellerId]);
      const row=found.rows[0];if(!row)throw new SellerOperationsError('NOT_ELIGIBLE');
      if(row.seller_paused===paused&&
        (row.maintenance_until?.getTime()??null)===(until?.getTime()??null))return;
      if(!paused){
        await this.assertWorkerResumeReady(client,row.worker_device_id);
        const check=await client.query(`SELECT 1 FROM capabilities c
          JOIN capability_versions v ON v.id=c.current_version_id
          JOIN capability_readiness r ON r.capability_version_id=v.id
          WHERE c.id=$1 AND r.worker_device_id=$2 AND r.state='READY'
          AND r.observed_at>=now()-interval '30 seconds'
          AND r.sandbox_verified AND r.required_secrets_ready AND r.runtime_healthy`,
        [capabilityId,row.worker_device_id]);
        if(!check.rowCount)throw new SellerOperationsError('NOT_READY');
      }
      await client.query(`UPDATE capability_availability_policies SET seller_paused=$2,
        maintenance_until=$3,revision=revision+1,updated_at=now() WHERE capability_id=$1`,
      [capabilityId,paused,until]);
      await client.query(`INSERT INTO availability_schedule_audit(id,subject_kind,subject_id,
        actor_kind,actor_id,source,old_value,new_value,revision)
        VALUES($1,'CAPABILITY',$2,'SELLER',$3,'WEB',$4,$5,$6)`,
      [randomUUID(),capabilityId,sellerId,row.policy,
        {...(row.policy as object),seller_paused:paused,reason,
          maintenance_until:until?.toISOString()??null},row.revision+1]);
      await this.bump(client,row.worker_device_id);
      await client.query(`UPDATE job_schedule_plans p SET last_reconciled_at=NULL
        WHERE p.capability_id=$1 AND p.job_id IN (SELECT id FROM jobs WHERE status IN
        ('QUEUED','WAITING_FOR_AVAILABILITY','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED'))`,
      [capabilityId]);
      await event(client,row.worker_device_id,capabilityId,'SELLER',sellerId,
        paused?'CAPABILITY_PAUSE':'CAPABILITY_RESUME',paused?'SELLER_PAUSE':'SELLER_RESUME');
    });
  }

  async setSchedule(sellerId:string,capabilityId:string,rawPolicy:unknown,
    expectedRevision:number):Promise<number>{
    const policy=AvailabilityPolicySchema.parse(rawPolicy);
    const overview=await this.availability.sellerOverview(capabilityId,sellerId);
    return this.availability.setCapabilityPolicy({capabilityId,sellerAccountId:sellerId,
      policy,paused:overview.sellerPaused,source:'WEB',expectedRevision});
  }

  private async bump(client:PoolClient,workerId:string):Promise<void>{
    await client.query(`INSERT INTO worker_cloud_control_revisions(worker_device_id,revision)
      VALUES($1,1) ON CONFLICT(worker_device_id) DO UPDATE SET revision=
      worker_cloud_control_revisions.revision+1`,[workerId]);
  }

  /** Expiration is only an opportunity to revalidate, never permission to go online blindly. */
  async expireMaintenance(limit=100):Promise<number>{
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new RangeError('INVALID_LIMIT');
    const due=await this.pool.query<{account_id:string;worker_id:string|null;
      capability_id:string|null}>(`SELECT s.account_id,d.id AS worker_id,NULL::uuid AS capability_id,
      w.maintenance_until AS due_at FROM worker_availability_schedules w
      JOIN worker_devices d ON d.id=w.worker_device_id
      JOIN seller_profiles s ON s.id=d.seller_profile_id
      WHERE w.seller_paused AND w.maintenance_until<=now()
      UNION ALL SELECT s.account_id,NULL::uuid,c.id,p.maintenance_until
      FROM capability_availability_policies p JOIN capabilities c ON c.id=p.capability_id
      JOIN seller_profiles s ON s.id=c.seller_profile_id
      WHERE p.seller_paused AND p.maintenance_until<=now()
      ORDER BY due_at LIMIT $1`,[limit]);
    let released=0;
    for(const row of due.rows){
      try{
        if(row.worker_id)await this.setWorkerPause(row.account_id,row.worker_id,false,
          'MAINTENANCE_WINDOW_ENDED');
        else if(row.capability_id)await this.setCapabilityPause(row.account_id,
          row.capability_id,false,'MAINTENANCE_WINDOW_ENDED');
        released++;
      }catch(error){if(!(error instanceof SellerOperationsError&&
        ['NOT_READY','SECURITY_BLOCK','NOT_ELIGIBLE'].includes(error.code)))throw error;}
    }
    return released;
  }

  async dashboard(sellerId:string):Promise<unknown>{
    const seller=await this.pool.query<{id:string;display_name:string;status:string;payout_status:string}>(
      'SELECT id,display_name,status,payout_status FROM seller_profiles WHERE account_id=$1',
      [uuid.parse(sellerId)]);
    const profile=seller.rows[0];if(!profile)throw new SellerOperationsError('NOT_FOUND');
    const workers=await this.pool.query<{id:string;name:string;platform:string;worker_version:string;
      openclaw_version:string|null;status:string;last_seen_at:Date|null;reported_status:string|null;
      observed_at:Date|null;running_jobs:number|null;capacity:number|null;global_paused:boolean|null;
      security_paused:boolean|null;web_paused:boolean|null;security_blocked:boolean|null;
      security_code:string|null;cloud_revision:string|null;acknowledged_revision:string|null;
      security_detected_at:Date|null;maintenance_until:Date|null;
      operational_checks:{code:string;state:'HEALTHY'|'BLOCKING'|'UNKNOWN'}[]|null;
      openclaw_compatibility:string|null;
      pending_jobs:number;last_success_at:Date|null;last_failure_at:Date|null;
      average_runtime_seconds:number|null;failure_rate:number|null}>(`SELECT d.id,d.name,d.platform,d.worker_version,d.openclaw_version,d.status,
      d.last_seen_at,h.reported_status,h.observed_at,h.running_jobs,h.capacity,
      h.operational_checks,h.openclaw_compatibility,
      l.global_paused,l.security_paused,s.seller_paused AS web_paused,
      s.maintenance_until,
      b.blocked AS security_blocked,b.code AS security_code,
      b.detected_at AS security_detected_at,
      coalesce(cr.revision,0)::text AS cloud_revision,
      coalesce(cr.acknowledged_revision,0)::text AS acknowledged_revision,
      coalesce(m.pending_jobs,0)::integer AS pending_jobs,m.last_success_at,
      m.last_failure_at,m.average_runtime_seconds,m.failure_rate
      FROM worker_devices d LEFT JOIN LATERAL (SELECT * FROM worker_heartbeats
        WHERE worker_device_id=d.id ORDER BY observed_at DESC LIMIT 1) h ON true
      LEFT JOIN worker_local_pause_reports l ON l.worker_device_id=d.id
      LEFT JOIN worker_availability_schedules s ON s.worker_device_id=d.id
      LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
      LEFT JOIN worker_cloud_control_revisions cr ON cr.worker_device_id=d.id
      LEFT JOIN LATERAL (SELECT
        count(*) FILTER(WHERE j.status IN ('QUEUED','WAITING_FOR_AVAILABILITY',
          'WAITING_FOR_WORKER','DISPATCHED','ACCEPTED'))::integer AS pending_jobs,
        max(j.completed_at) FILTER(WHERE j.status='COMPLETED') AS last_success_at,
        max(j.completed_at) FILTER(WHERE j.status IN ('FAILED_STARTUP','FAILED_POLICY',
          'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED')) AS last_failure_at,
        avg(extract(epoch from (j.completed_at-j.started_at))) FILTER(
          WHERE j.completed_at>=now()-interval '7 days' AND j.started_at IS NOT NULL
          AND j.status IN ('COMPLETED','FAILED_STARTUP','FAILED_POLICY',
          'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'))::float8
          AS average_runtime_seconds,
        (count(*) FILTER(WHERE j.completed_at>=now()-interval '7 days' AND
          j.status IN ('FAILED_STARTUP','FAILED_POLICY','FAILED_EXECUTION',
            'TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'))::float8 /
          nullif(count(*) FILTER(WHERE j.completed_at>=now()-interval '7 days' AND
            j.status IN ('COMPLETED','FAILED_STARTUP','FAILED_POLICY',
              'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED')),0))
          AS failure_rate FROM jobs j WHERE j.worker_device_id=d.id) m ON true
      WHERE d.seller_profile_id=$1 ORDER BY d.created_at,d.id`,[profile.id]);
    const capabilities=await this.pool.query<{id:string;slug:string;name:string;status:string;
      current_version_id:string|null;worker_device_id:string|null;
      price:unknown|null;permission_manifest:unknown|null;
      readiness_state:string|null;readiness_at:Date|null;sandbox_verified:boolean|null;
      required_secrets_ready:boolean|null;runtime_healthy:boolean|null;
      maintenance_until:Date|null}>(`SELECT c.id,c.slug,c.name,c.status,
      c.current_version_id,v.version_snapshot->>'workerDeviceId' AS worker_device_id,
      v.version_snapshot->'price' AS price,
      v.version_snapshot->'publicPermissionManifest' AS permission_manifest,
      p.maintenance_until,r.state AS readiness_state,r.observed_at AS readiness_at,r.sandbox_verified,
      r.required_secrets_ready,r.runtime_healthy
      FROM capabilities c LEFT JOIN capability_versions v ON v.id=c.current_version_id
      LEFT JOIN capability_availability_policies p ON p.capability_id=c.id
      LEFT JOIN capability_readiness r ON r.capability_version_id=v.id
      WHERE c.seller_profile_id=$1 ORDER BY c.name,c.id`,[profile.id]);
    const jobs=await this.pool.query<{id:string;status:string;created_at:Date;started_at:Date|null;
      completed_at:Date|null;capability_id:string;capability_name:string;payment_state:string|null;
      worker_device_id:string;
      pause_support:string|null;execution_id:string|null;attempt_id:string|null;
      control_plane_id:string|null}>(`SELECT j.id,j.status,j.created_at,j.started_at,j.completed_at,
      j.worker_device_id,
      c.id AS capability_id,c.name AS capability_name,p.state AS payment_state,
      j.contract_snapshot->>'pauseSupportSnapshot' AS pause_support,
      e.id AS execution_id,e.attempt_id,e.control_plane_id
      FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
      JOIN capabilities c ON c.id=v.capability_id
      LEFT JOIN job_payment_states p ON p.job_id=j.id
      LEFT JOIN job_executions e ON e.job_id=j.id AND e.completed_at IS NULL
      WHERE c.seller_profile_id=$1 ORDER BY CASE WHEN j.status IN
      ('STARTING','RUNNING','UPLOADING_RESULT','PAUSE_REQUESTED','PAUSED',
       'RESUME_REQUESTED','SECURITY_PAUSED','CANCEL_REQUESTED') THEN 0 ELSE 1 END,
      j.created_at DESC LIMIT 100`,[profile.id]);
    const capMetrics=await this.pool.query<{capability_id:string;running_count:number;
      last_success_at:Date|null;last_failure_at:Date|null}>(`SELECT c.id AS capability_id,
      count(*) FILTER(WHERE j.status IN ('STARTING','RUNNING','UPLOADING_RESULT',
        'PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED',
        'CANCEL_REQUESTED'))::integer AS running_count,
      max(j.completed_at) FILTER(WHERE j.status='COMPLETED') AS last_success_at,
      max(j.completed_at) FILTER(WHERE j.status IN ('FAILED_STARTUP','FAILED_POLICY',
        'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED')) AS last_failure_at
      FROM capabilities c JOIN capability_versions v ON v.capability_id=c.id
      LEFT JOIN jobs j ON j.capability_version_id=v.id
      WHERE c.seller_profile_id=$1 GROUP BY c.id`,[profile.id]);
    const metricsByCap=new Map(capMetrics.rows.map((row)=>[row.capability_id,row]));
    const earnings=await this.finance.sellerEarnings(profile.id);
    const settledSales=await this.finance.sellerSettledSales(profile.id);
    const economics=new PostgresSellerEconomics(this.pool);
    const availabilityMetrics=new PostgresAvailabilityMetrics(this.pool,this.availability);
    const audit=await this.pool.query<{job_id:string;at:Date;kind:string;code:string;
      correlation_id:string|null}>(`SELECT job_id,at,'JOB' AS kind,to_status AS code,correlation_id
      FROM job_transitions WHERE job_id=ANY($1::uuid[])
      UNION ALL SELECT job_id,created_at,'FINANCE',kind,NULL::uuid
      FROM financial_journals WHERE job_id=ANY($1::uuid[])
      ORDER BY at LIMIT 2000`,[jobs.rows.map((row)=>row.id)]);
    const auditByJob=new Map<string,{at:string;kind:string;code:string;
      correlationId:string|null}[]>();
    for(const item of audit.rows){const list=auditByJob.get(item.job_id)??[];
      list.push({at:item.at.toISOString(),kind:item.kind,code:item.code,
        correlationId:item.correlation_id});auditByJob.set(item.job_id,list);}
    const jobViews=await Promise.all(jobs.rows.map(async(row)=>({...row,
      created_at:row.created_at.toISOString(),started_at:row.started_at?.toISOString()??null,
      completed_at:row.completed_at?.toISOString()??null,
      economics:await economics.job(row.id,sellerId),audit:auditByJob.get(row.id)??[]})));
    const capabilityViews=await Promise.all(capabilities.rows.map(async(item)=>{
      let operations:Awaited<ReturnType<PostgresAvailabilityRepository['sellerOverview']>>|null=null;
      if(item.current_version_id){
        try{operations=await this.availability.sellerOverview(item.id,sellerId);}
        catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='NOT_READY'))throw error;}
      }
      const scheduleView=operations?{...operations,
        insideServiceHours:isInsideSchedule(operations.schedule,new Date()),
        nextWindow:nextScheduleWindow(operations.schedule,new Date(),false)}:null;
      const metrics=metricsByCap.get(item.id);
      return {...item,readinessAt:item.readiness_at?.toISOString()??null,
        maintenanceUntil:item.maintenance_until?.toISOString()??null,
        runningCount:metrics?.running_count??0,
        lastSuccessAt:metrics?.last_success_at?.toISOString()??null,
        lastFailureAt:metrics?.last_failure_at?.toISOString()??null,
        readinessFresh:item.readiness_at!==null&&Date.now()-item.readiness_at.getTime()<=30_000,
        availability:item.current_version_id?
        await this.availability.publicStatus(item.id):null,operations:scheduleView,
        availabilityMetrics:await availabilityMetrics.sellerCapability(item.id,sellerId)};
    }));
    const history=await this.pool.query<{worker_device_id:string;capability_id:string|null;
      kind:string;code:string;created_at:Date}>(`SELECT worker_device_id,capability_id,kind,code,created_at
      FROM worker_operational_events WHERE worker_device_id IN
      (SELECT id FROM worker_devices WHERE seller_profile_id=$1)
      ORDER BY created_at DESC LIMIT 100`,[profile.id]);
    return {profile,workers:workers.rows.map((row)=>{
      const fresh=!!row.observed_at&&Date.now()-row.observed_at.getTime()<=30_000;
      const versionStatus=workerVersionStatus(row.worker_version,
        process.env.KIVRO_MIN_WORKER_RELEASE??null,
        process.env.KIVRO_LATEST_WORKER_RELEASE??null);
      const security=row.status==='REVOKED'||!!row.security_blocked||!!row.security_paused||
        process.env.NODE_ENV==='production'&&
          ['SECURITY_UPDATE_REQUIRED','UNKNOWN'].includes(versionStatus);
      const cloudSyncPending=Number(row.cloud_revision)>Number(row.acknowledged_revision);
      const paused=!!row.web_paused||!!row.global_paused||cloudSyncPending;
      const ownCaps=capabilityViews.filter((item)=>item.worker_device_id===row.id&&
        item.status==='PUBLISHED');
      const unready=ownCaps.some((item)=>!item.readinessFresh||
        item.sandbox_verified!==true||item.required_secrets_ready!==true||
        item.runtime_healthy!==true);
      const healthStatus=security?'SECURITY_WARNING':
        !fresh||row.reported_status==='OFFLINE'?'OFFLINE':paused?'PAUSED':
        !row.capacity||unready||row.operational_checks?.some((check)=>
          ['DOCKER_DAEMON','APPROVED_SANDBOX_IMAGE','DEVICE_IDENTITY'].includes(check.code)&&
          check.state!=='HEALTHY')?'NOT_READY':row.reported_status==='PAUSED'?'PAUSED':
        row.failure_rate!==null&&row.failure_rate>=0.1?'DEGRADED':'HEALTHY';
      const warnings=[...(security?[{severity:'CRITICAL',code:row.security_code??
        (versionStatus==='SECURITY_UPDATE_REQUIRED'?'WORKER_SECURITY_UPDATE_REQUIRED':
          'SECURITY_PAUSE'),scope:'WORKER',blocking:true,
        title:'Worker security block',description:'New work is blocked by a critical security condition.',
        detectedAt:row.security_detected_at?.toISOString()??row.observed_at?.toISOString()??null,
        action:'Resolve the security condition before accepting jobs'}]:[]),
        ...(unready?[{severity:'WARNING',code:'CAPABILITY_NOT_READY',scope:'CAPABILITY',
          blocking:true,title:'Capability needs attention',
          description:'At least one published capability has stale or failing readiness.',
          detectedAt:row.observed_at?.toISOString()??null,
          action:'Inspect sandbox, secrets and runtime readiness for each capability'}]:[]),
        ...(row.operational_checks??[]).filter((check)=>check.state!=='HEALTHY'&&
          !['CLOUD_CONNECTION','SELLER_PAUSE'].includes(check.code)).map((check)=>({
          severity:check.code==='APPROVED_SANDBOX_IMAGE'&&check.state==='BLOCKING'?
            'CRITICAL':check.state==='BLOCKING'?'WARNING':'INFO',code:check.code,
          scope:'WORKER',blocking:check.state==='BLOCKING',
          title:check.code.replaceAll('_',' ').toLowerCase(),
          description:check.state==='BLOCKING'?'This local prerequisite is blocking new jobs.':
            'The Worker could not verify this prerequisite.',
          detectedAt:row.observed_at?.toISOString()??null,
          action:'Run kivro-worker doctor locally and resolve this prerequisite'}))];
      return {...row,status:healthStatus,lastHeartbeatAt:row.observed_at?.toISOString()??null,
        maintenanceUntil:row.maintenance_until?.toISOString()??null,
        lastSuccessAt:row.last_success_at?.toISOString()??null,
        lastFailureAt:row.last_failure_at?.toISOString()??null,
        latestWorkerRelease:process.env.KIVRO_LATEST_WORKER_RELEASE??null,
        minimumWorkerRelease:process.env.KIVRO_MIN_WORKER_RELEASE??null,
        versionStatus,cloudSyncPending,warnings};
    }),capabilities:capabilityViews,
      jobs:jobViews,
      earnings,settledSales,
      history:history.rows.map((row)=>({...row,created_at:row.created_at.toISOString()}))};
  }
}
