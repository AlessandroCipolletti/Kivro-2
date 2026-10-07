import type { Pool } from 'pg';
import { z } from 'zod';
import type { PostgresAvailabilityRepository } from './availability.js';

const uuid=z.uuid();
const daysSchema=z.number().int().min(1).max(90);
type CountRow={online:number;busy:number;offline:number;scheduled_offline:number;
  paused:number;readiness_blocked:number;unavailable:number;total:number};
type JobRow={accepted:number;queue_wait_seconds:number|null;
  execution_seconds:number|null;disconnect_failures:number};

/** Availability metrics use one observed state per minute. Missing observations stay unknown. */
export class PostgresAvailabilityMetrics {
  constructor(private readonly pool:Pool,
    private readonly availability:PostgresAvailabilityRepository){}

  async sample(limit=100):Promise<number>{
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new RangeError('INVALID_SAMPLE_LIMIT');
    const due=await this.pool.query<{id:string;account_id:string}>(`SELECT c.id,s.account_id
      FROM capabilities c JOIN seller_profiles s ON s.id=c.seller_profile_id
      LEFT JOIN capability_availability_observations o ON o.capability_id=c.id
        AND o.minute_at=date_trunc('minute',now())
      WHERE c.status='PUBLISHED' AND o.capability_id IS NULL
      ORDER BY c.id LIMIT $1`,[limit]);
    let inserted=0;
    for(const cap of due.rows){
      const state=await this.availability.publicStatus(cap.id,cap.account_id);
      const result=await this.pool.query(`INSERT INTO capability_availability_observations
        (capability_id,minute_at,status) VALUES($1,date_trunc('minute',now()),$2)
        ON CONFLICT(capability_id,minute_at) DO NOTHING`,[cap.id,state.status]);
      inserted+=result.rowCount??0;
    }
    return inserted;
  }

  async sellerCapability(capabilityId:string,sellerAccountId:string,days=30){
    uuid.parse(capabilityId);uuid.parse(sellerAccountId);daysSchema.parse(days);
    const cap=await this.pool.query<{created_at:Date}>(`SELECT c.created_at
      FROM capabilities c JOIN seller_profiles s ON s.id=c.seller_profile_id
      WHERE c.id=$1 AND s.account_id=$2`,[capabilityId,sellerAccountId]);
    if(!cap.rows[0])return null;
    const since=new Date(Math.max(Date.now()-days*86_400_000,cap.rows[0].created_at.getTime()));
    const [samples,jobs,rejections]=await Promise.all([
      this.pool.query<CountRow>(`SELECT
        count(*) FILTER(WHERE status='ONLINE')::int AS online,
        count(*) FILTER(WHERE status='BUSY')::int AS busy,
        count(*) FILTER(WHERE status='OFFLINE')::int AS offline,
        count(*) FILTER(WHERE status='SCHEDULED_OFFLINE')::int AS scheduled_offline,
        count(*) FILTER(WHERE status='PAUSED')::int AS paused,
        count(*) FILTER(WHERE status='READINESS_BLOCKED')::int AS readiness_blocked,
        count(*) FILTER(WHERE status='UNAVAILABLE')::int AS unavailable,
        count(*)::int AS total FROM capability_availability_observations
        WHERE capability_id=$1 AND observed_at>=$2`,[capabilityId,since]),
      this.pool.query<JobRow>(`SELECT
        (SELECT count(DISTINCT t.job_id)::int FROM job_transitions t
          JOIN job_schedule_plans p ON p.job_id=t.job_id
          WHERE p.capability_id=$1 AND t.to_status='ACCEPTED' AND t.at>=$2) AS accepted,
        percentile_cont(0.5) WITHIN GROUP(ORDER BY
          extract(epoch FROM (j.started_at-p.queued_at))) FILTER(WHERE
          j.started_at IS NOT NULL AND p.queued_at IS NOT NULL AND
          j.started_at>=p.queued_at AND j.started_at>=$2) AS queue_wait_seconds,
        percentile_cont(0.5) WITHIN GROUP(ORDER BY
          extract(epoch FROM (j.completed_at-j.started_at))) FILTER(WHERE
          j.completed_at IS NOT NULL AND j.started_at IS NOT NULL AND
          j.completed_at>=j.started_at AND j.completed_at>=$2) AS execution_seconds,
        count(*) FILTER(WHERE j.status='WORKER_OFFLINE' AND j.completed_at>=$2)::int
          AS disconnect_failures
        FROM job_schedule_plans p JOIN jobs j ON j.id=p.job_id
        WHERE p.capability_id=$1`,[capabilityId,since]),
      this.pool.query<{total:number}>(`SELECT count(*)::int AS total
        FROM capability_queue_full_rejections WHERE capability_id=$1 AND rejected_at>=$2`,
      [capabilityId,since])]);
    const count=samples.rows[0]!,job=jobs.rows[0]!;
    const periodMinutes=Math.max(0,Math.floor((Date.now()-since.getTime())/60_000));
    return {periodDays:days,observedMinutes:count.total,
      unobservedMinutes:Math.max(0,periodMinutes-count.total),
      onlineMinutesObserved:count.online,busyMinutesObserved:count.busy,
      offlineMinutesObserved:count.offline,
      scheduledOfflineMinutesObserved:count.scheduled_offline,
      pausedMinutesObserved:count.paused,
      readinessBlockedMinutesObserved:count.readiness_blocked,
      unavailableMinutesObserved:count.unavailable,
      jobsAccepted:job.accepted,queueFullRejects:rejections.rows[0]!.total,
      medianQueueWaitSeconds:job.queue_wait_seconds,
      medianExecutionSeconds:job.execution_seconds,
      disconnectFailures:job.disconnect_failures,
      source:'MINUTE_OBSERVATIONS' as const};
  }
}
