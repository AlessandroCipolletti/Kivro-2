import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const uuid=z.uuid();
const reason=z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
export class PlatformOperationsError extends Error {
  constructor(readonly code:'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'INVALID_STATE'){
    super(code);this.name='PlatformOperationsError';
  }
}
export type OperatorSubject='ACCOUNT'|'WORKER'|'CAPABILITY';

/** Shared cloud Core authority. Only explicit, verified DB grants confer operator access. */
export class PlatformOperationsRepository {
  constructor(private readonly pool:Pool){}

  async assertOperator(client:PoolClient,accountId:string):Promise<void>{
    const found=await client.query(`SELECT 1 FROM operator_grants g JOIN accounts a ON a.id=g.account_id
      WHERE g.account_id=$1 AND g.revoked_at IS NULL AND a.status='ACTIVE'
        AND a.email_verified_at IS NOT NULL FOR SHARE OF g,a`,[uuid.parse(accountId)]);
    if(!found.rowCount)throw new PlatformOperationsError('FORBIDDEN');
  }
  private async tx<T>(actor:string,action:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await this.assertOperator(client,actor);
      const result=await action(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  private async audit(client:PoolClient,actor:string,eventCode:string,subjectKind:string,
    subjectId:string|null,reasonCode:string):Promise<void>{
    await client.query(`INSERT INTO platform_audit_events(id,actor_account_id,actor_kind,
      event_code,subject_kind,subject_id,reason_code) VALUES($1,$2,'OPERATOR',$3,$4,$5,$6)`,
    [randomUUID(),actor,eventCode,subjectKind,subjectId,reason.parse(reasonCode)]);
  }
  async dispatchState(actor:string):Promise<{halted:boolean;revision:number;changedAt:string}>{
    return this.tx(actor,async(client)=>{
      const row=await client.query<{halted:boolean;revision:string;changed_at:Date}>(
        'SELECT halted,revision,changed_at FROM platform_dispatch_control WHERE singleton=true');
      if(!row.rows[0])throw new PlatformOperationsError('INVALID_STATE');
      return {halted:row.rows[0].halted,revision:Number(row.rows[0].revision),
        changedAt:row.rows[0].changed_at.toISOString()};
    });
  }
  async setDispatchHalt(actor:string,halted:boolean,expectedRevision:number,
    reasonCode:string):Promise<{halted:boolean;revision:number}>{
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
      throw new PlatformOperationsError('CONFLICT');
    return this.tx(actor,async(client)=>{
      const row=await client.query<{halted:boolean;revision:string}>(
        'SELECT halted,revision FROM platform_dispatch_control WHERE singleton=true FOR UPDATE');
      if(!row.rows[0])throw new PlatformOperationsError('INVALID_STATE');
      if(Number(row.rows[0].revision)!==expectedRevision)
        throw new PlatformOperationsError('CONFLICT');
      if(row.rows[0].halted===halted)return {halted,revision:expectedRevision};
      await client.query(`UPDATE platform_dispatch_control SET halted=$1,
        revision=revision+1,changed_at=now(),changed_by=$2 WHERE singleton=true`,[halted,actor]);
      await this.audit(client,actor,halted?'DISPATCH_HALTED':'DISPATCH_RESUMED',
        'PLATFORM',null,reasonCode);
      return {halted,revision:expectedRevision+1};
    });
  }
  async setSuspension(actor:string,subject:OperatorSubject,id:string,
    suspended:boolean,reasonCode:string):Promise<void>{
    uuid.parse(id);
    await this.tx(actor,async(client)=>{
      const target=subject==='ACCOUNT'?{table:'accounts',active:'ACTIVE',suspended:'SUSPENDED'}:
        subject==='CAPABILITY'?{table:'capabilities',active:'PUBLISHED',suspended:'SUSPENDED'}:
        {table:'worker_devices',active:'PAUSED',suspended:'REVOKED'};
      // A revoked device cannot be unrevoked by a generic operator action: it
      // requires fresh pairing and key rotation through the device authority.
      if(subject==='WORKER'&&!suspended)throw new PlatformOperationsError('INVALID_STATE');
      const found=await client.query<{status:string}>(
        `SELECT status FROM ${target.table} WHERE id=$1 FOR UPDATE`,[id]);
      if(!found.rows[0])throw new PlatformOperationsError('NOT_FOUND');
      if(subject==='CAPABILITY'&&suspended&&found.rows[0].status!=='PUBLISHED')
        throw new PlatformOperationsError('INVALID_STATE');
      if(subject==='ACCOUNT'&&suspended&&found.rows[0].status!=='ACTIVE')
        throw new PlatformOperationsError('INVALID_STATE');
      if(subject==='CAPABILITY'&&!suspended&&found.rows[0].status!=='SUSPENDED')
        throw new PlatformOperationsError('INVALID_STATE');
      if(subject==='ACCOUNT'&&!suspended&&found.rows[0].status!=='SUSPENDED')
        throw new PlatformOperationsError('INVALID_STATE');
      if(subject==='WORKER')await client.query(`UPDATE worker_devices SET status='REVOKED',
        revoked_at=coalesce(revoked_at,now()) WHERE id=$1`,[id]);
      else await client.query(`UPDATE ${target.table} SET status=$2 WHERE id=$1`,
        [id,suspended?target.suspended:target.active]);
      await this.audit(client,actor,suspended?'SUBJECT_SUSPENDED':'SUBJECT_RESTORED',subject,id,reasonCode);
    });
  }
  async addDenyPattern(actor:string,id:string,pattern:string,reasonCode:string):Promise<void>{
    uuid.parse(id);
    const normalized=pattern.normalize('NFKC').toLocaleLowerCase('en-US').trim();
    if(normalized.length<8||normalized.length>160||
      [...normalized].some((character)=>character.charCodeAt(0)<32))
      throw new PlatformOperationsError('INVALID_STATE');
    await this.tx(actor,async(client)=>{
      await client.query('SELECT singleton FROM platform_dispatch_control WHERE singleton=true FOR UPDATE');
      const count=await client.query<{total:string}>(
        'SELECT count(*) AS total FROM abuse_content_rules WHERE active=true');
      if(Number(count.rows[0]?.total)>=200)throw new PlatformOperationsError('INVALID_STATE');
      await client.query(`INSERT INTO abuse_content_rules(id,normalized_pattern,created_by)
        VALUES($1,$2,$3) ON CONFLICT(normalized_pattern) DO UPDATE SET active=true`,
      [id,normalized,actor]);
      await this.audit(client,actor,'DENY_PATTERN_ADDED','PLATFORM',null,reasonCode);
    });
  }
  async openReports(actor:string):Promise<readonly {id:string;reporterKind:string;
    jobId:string;category:string;createdAt:string}[]>{
    return this.tx(actor,async(client)=>{
      const result=await client.query<{id:string;reporter_kind:string;job_id:string;
        category:string;created_at:Date}>(`SELECT id,reporter_kind,job_id,category,created_at
        FROM abuse_reports WHERE state='OPEN' ORDER BY created_at LIMIT 200`);
      return result.rows.map((r)=>({id:r.id,reporterKind:r.reporter_kind,jobId:r.job_id,
        category:r.category,createdAt:r.created_at.toISOString()}));
    });
  }
  async reviewReport(actor:string,reportId:string,state:'REVIEWED'|'CLOSED',
    reasonCode:string):Promise<void>{
    uuid.parse(reportId);reason.parse(reasonCode);
    await this.tx(actor,async(client)=>{
      const found=await client.query<{state:string;job_id:string}>(
        'SELECT state,job_id FROM abuse_reports WHERE id=$1 FOR UPDATE',[reportId]);
      const report=found.rows[0];
      if(!report)throw new PlatformOperationsError('NOT_FOUND');
      if(report.state===state)return;
      if(report.state==='CLOSED'||report.state==='OPEN'&&state==='CLOSED')
        throw new PlatformOperationsError('INVALID_STATE');
      await client.query(`UPDATE abuse_reports SET state=$2,reviewed_at=coalesce(reviewed_at,now()),
        reviewed_by=$3 WHERE id=$1`,[reportId,state,actor]);
      await client.query(`INSERT INTO platform_audit_events(id,actor_account_id,actor_kind,
        event_code,subject_kind,subject_id,job_id,reason_code)
        VALUES($1,$2,'OPERATOR',$3,'REPORT',$4,$5,$6)`,[randomUUID(),actor,
        state==='REVIEWED'?'REPORT_REVIEWED':'REPORT_CLOSED',reportId,report.job_id,reasonCode]);
    });
  }
  async metrics(actor:string):Promise<Record<string,number|null>>{
    return this.tx(actor,async(client)=>{
      const rows=await client.query<{online_workers:string;jobs_created:string;
        dispatched:string;accepted:string;completed:string;failed:string;
        failed_startup:string;failed_policy:string;failed_execution:string;
        timed_out:string;worker_offline:string;result_rejected:string;
        median_runtime_seconds:string|null;median_dispatch_seconds:string|null;
        credit_volume_minor:string;seller_earnings_minor:string;releases:string;
        abuse_reports:string;sandbox_failures:string}>(`WITH job_stats AS (
        SELECT count(*) AS jobs_created,
          count(*) FILTER(WHERE status='COMPLETED') AS completed,
          count(*) FILTER(WHERE status IN ('FAILED_STARTUP','FAILED_POLICY','FAILED_EXECUTION',
            'TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED')) AS failed,
          count(*) FILTER(WHERE status='FAILED_STARTUP') AS failed_startup,
          count(*) FILTER(WHERE status='FAILED_POLICY') AS failed_policy,
          count(*) FILTER(WHERE status='FAILED_EXECUTION') AS failed_execution,
          count(*) FILTER(WHERE status='TIMED_OUT') AS timed_out,
          count(*) FILTER(WHERE status='WORKER_OFFLINE') AS worker_offline,
          count(*) FILTER(WHERE status='RESULT_REJECTED') AS result_rejected,
          percentile_cont(0.5) WITHIN GROUP(ORDER BY
            extract(epoch FROM completed_at-started_at)) FILTER(WHERE started_at IS NOT NULL
              AND completed_at IS NOT NULL) AS median_runtime_seconds
        FROM jobs WHERE created_at>=now()-interval '30 days'
      ), dispatch AS (
        SELECT count(*) FILTER(WHERE to_status='DISPATCHED') AS dispatched,
          count(*) FILTER(WHERE to_status='ACCEPTED') AS accepted,
          percentile_cont(0.5) WITHIN GROUP(ORDER BY
            extract(epoch FROM t.at-plan.queued_at)) FILTER(WHERE t.to_status='DISPATCHED'
              AND plan.queued_at IS NOT NULL)
            AS median_dispatch_seconds
        FROM job_transitions t JOIN jobs j ON j.id=t.job_id
        LEFT JOIN job_schedule_plans plan ON plan.job_id=j.id
        WHERE t.at>=now()-interval '30 days'
      ) SELECT
        (SELECT count(*) FROM worker_devices d JOIN worker_heartbeats h ON h.worker_device_id=d.id
          WHERE d.status='ONLINE' AND h.reported_status='ONLINE'
            AND h.observed_at>now()-interval '30 seconds') AS online_workers,
        job_stats.*,dispatch.*,
        (SELECT coalesce(sum(s.buyer_price_minor),0) FROM financial_journals ledger
          JOIN job_financial_snapshots s ON s.job_id=ledger.job_id
          WHERE ledger.kind='SETTLE' AND ledger.created_at>=now()-interval '30 days')
          AS credit_volume_minor,
        (SELECT coalesce(sum(s.seller_earning_minor),0) FROM financial_journals ledger
          JOIN job_financial_snapshots s ON s.job_id=ledger.job_id
          WHERE ledger.kind='SETTLE' AND ledger.created_at>=now()-interval '30 days')
          AS seller_earnings_minor,
        (SELECT count(*) FROM financial_journals WHERE kind IN ('RELEASE','REFUND')
          AND created_at>=now()-interval '30 days') AS releases,
        (SELECT count(*) FROM abuse_reports WHERE created_at>=now()-interval '30 days') AS abuse_reports,
        (SELECT count(*) FROM worker_operational_events WHERE kind='SECURITY_BLOCK'
          AND code LIKE 'SANDBOX%' AND created_at>=now()-interval '30 days') AS sandbox_failures
        FROM job_stats CROSS JOIN dispatch`);
      const row=rows.rows[0];if(!row)throw new PlatformOperationsError('INVALID_STATE');
      const counts=Object.fromEntries(Object.entries(row).map(([key,value])=>[key,
        value===null?null:Number(value)]));
      const ratio=(numerator:number|null,denominator:number|null)=>
        denominator&&numerator!==null?numerator/denominator:null;
      counts.acceptance_rate=ratio(counts.accepted??null,counts.dispatched??null);
      counts.success_rate=ratio(counts.completed??null,
        (counts.completed??0)+(counts.failed??0));
      counts.refund_rate=ratio(counts.releases??null,counts.jobs_created??null);
      return counts;
    });
  }
  async jobAudit(actor:string,jobId:string):Promise<readonly {at:string;kind:string;
    code:string;actor:string;correlationId:string|null}[]>{
    uuid.parse(jobId);
    return this.tx(actor,async(client)=>{
      const exists=await client.query('SELECT 1 FROM jobs WHERE id=$1',[jobId]);
      if(!exists.rowCount)throw new PlatformOperationsError('NOT_FOUND');
      const events=await client.query<{at:Date;kind:string;code:string;actor:string;
        correlation_id:string|null}>(`SELECT at,'JOB' AS kind,to_status AS code,actor,correlation_id
        FROM job_transitions WHERE job_id=$1
        UNION ALL SELECT created_at,'FINANCE',kind,'SYSTEM',NULL::uuid
          FROM financial_journals WHERE job_id=$1
        UNION ALL SELECT occurred_at,'OPERATOR',event_code,actor_kind,correlation_id
          FROM platform_audit_events WHERE job_id=$1
        ORDER BY at LIMIT 500`,[jobId]);
      return events.rows.map((r)=>({at:r.at.toISOString(),kind:r.kind,code:r.code,
        actor:r.actor,correlationId:r.correlation_id}));
    });
  }
  async report(actor:string,id:string,jobId:string,kind:'BUYER'|'SELLER',
    category:string):Promise<void>{
    uuid.parse(id);uuid.parse(jobId);
    if(!['HARASSMENT','MALICIOUS_INPUT','UNSAFE_OUTPUT','FRAUD','PRIVACY','OTHER'].includes(category))
      throw new PlatformOperationsError('INVALID_STATE');
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const owner=await client.query(`SELECT 1 FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
        JOIN capabilities c ON c.id=v.capability_id JOIN seller_profiles s ON s.id=c.seller_profile_id
        WHERE j.id=$1 AND ${kind==='BUYER'?'j.buyer_account_id':'s.account_id'}=$2`,[jobId,uuid.parse(actor)]);
      if(!owner.rowCount)throw new PlatformOperationsError('FORBIDDEN');
      await client.query(`INSERT INTO abuse_reports(id,reporter_account_id,reporter_kind,job_id,category)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(reporter_account_id,job_id,category) DO NOTHING`,
      [id,actor,kind,jobId,category]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
