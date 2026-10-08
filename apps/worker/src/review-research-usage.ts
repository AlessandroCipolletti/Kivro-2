import {randomUUID} from 'node:crypto';
import type {ResearchUsagePort} from '../../../packages/infrastructure/contracts/src/research-ports.js';
import {NetworkPolicyError} from '../../../packages/policy-engine/src/public-destination.js';
import {openPrivateWorkerSqlite} from './local-state.js';

/** A seller's pre-publication Docker test has no paid cloud job. Its public
 * research budget is durable and shares the private-read barrier with local
 * file/database brokers. The paid path uses cloud PostgreSQL instead. */
export class WorkerReviewResearchUsage implements ResearchUsagePort{
  private readonly db;
  constructor(stateDir:string){
    this.db=openPrivateWorkerSqlite(stateDir,'resource-usage.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS private_resource_reads (
      job_id TEXT NOT NULL,capability_version_id TEXT NOT NULL,
      first_read_at TEXT NOT NULL,PRIMARY KEY(job_id,capability_version_id));
      CREATE TABLE IF NOT EXISTS review_research_jobs (
        job_id TEXT PRIMARY KEY,capability_version_id TEXT NOT NULL,
        started_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS review_research_requests (
        request_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,
        capability_version_id TEXT NOT NULL,operation TEXT NOT NULL,
        host TEXT,query_hash TEXT,reserved_bytes INTEGER NOT NULL,
        actual_bytes INTEGER,content_type TEXT,http_status INTEGER,
        blocked_reason TEXT,started_at INTEGER NOT NULL,completed_at INTEGER);
      CREATE TABLE IF NOT EXISTS review_research_denials (
        id TEXT PRIMARY KEY,job_id TEXT NOT NULL,capability_version_id TEXT NOT NULL,
        operation TEXT NOT NULL,host TEXT,query_hash TEXT,reason TEXT NOT NULL,
        occurred_at INTEGER NOT NULL);`);
  }
  close():void{this.db.close();}
  async begin(input:Parameters<ResearchUsagePort['begin']>[0]):Promise<void>{
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const now=Date.now();
      this.db.prepare(`INSERT OR IGNORE INTO review_research_jobs
        (job_id,capability_version_id,started_at) VALUES(?,?,?)`)
        .run(input.jobId,input.capabilityVersionId,now);
      const job=this.db.prepare(`SELECT capability_version_id AS version,started_at AS started
        FROM review_research_jobs WHERE job_id=?`).get(input.jobId) as
        {version:string;started:number}|undefined;
      const privateRead=this.db.prepare(`SELECT 1 FROM private_resource_reads
        WHERE job_id=? AND capability_version_id=?`).get(input.jobId,input.capabilityVersionId);
      if(!job||job.version!==input.capabilityVersionId||privateRead||
        now-job.started>input.maxDurationMs)
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const existing=this.db.prepare('SELECT 1 FROM review_research_requests WHERE request_id=?')
        .get(input.requestId);
      if(existing)throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const rows=this.db.prepare(`SELECT operation,host,reserved_bytes AS reserved,
        actual_bytes AS actual,started_at AS started,completed_at AS completed
        FROM review_research_requests WHERE job_id=?`).all(input.jobId) as
        {operation:string;host:string|null;reserved:number;actual:number|null;
          started:number;completed:number|null}[];
      const count=rows.filter((row)=>row.operation===input.operation).length;
      const max=input.operation==='SEARCH'?input.maxQueries:
        input.operation==='FETCH'?input.maxPages:input.maxDownloads;
      const active=rows.filter((row)=>row.completed===null&&
        now-row.started<300_000).length;
      const bytes=rows.reduce((sum,row)=>sum+(row.completed===null&&
        now-row.started<300_000?row.reserved:row.actual??0),0);
      const downloads=rows.filter((row)=>row.operation==='DOWNLOAD')
        .reduce((sum,row)=>sum+(row.completed===null&&
          now-row.started<300_000?row.reserved:row.actual??0),0);
      if(count>=max||active>=input.maxConcurrent||
        (input.host!==null&&rows.filter((row)=>row.host===input.host).length>=
          input.maxPerHost)||bytes+input.byteReservation>input.maxTotalBytes||
        (input.operation==='DOWNLOAD'&&
          downloads+input.byteReservation>input.maxDownloadsBytes))
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      this.db.prepare(`INSERT INTO review_research_requests(request_id,job_id,
        capability_version_id,operation,host,query_hash,reserved_bytes,started_at)
        VALUES(?,?,?,?,?,?,?,?)`).run(input.requestId,input.jobId,
          input.capabilityVersionId,input.operation,input.host,input.queryHash,
          input.byteReservation,now);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  async finish(input:Parameters<ResearchUsagePort['finish']>[0]):Promise<void>{
    const result=this.db.prepare(`UPDATE review_research_requests
      SET actual_bytes=?,content_type=?,http_status=?,blocked_reason=?,completed_at=?
      WHERE request_id=? AND completed_at IS NULL AND reserved_bytes>=?`)
      .run(input.bytes,input.contentType,input.status,input.blockedReason,
        Date.now(),input.requestId,input.bytes);
    if(result.changes!==1)throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }
  async markPrivateResourceRead(jobId:string,capabilityVersionId:string):Promise<void>{
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const active=this.db.prepare(`SELECT count(*) AS n FROM review_research_requests
        WHERE job_id=? AND completed_at IS NULL AND started_at>?`)
        .get(jobId,Date.now()-300_000) as {n:number};
      if(active.n!==0)throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      this.db.prepare(`INSERT OR IGNORE INTO private_resource_reads
        (job_id,capability_version_id,first_read_at) VALUES(?,?,?)`)
        .run(jobId,capabilityVersionId,new Date().toISOString());
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  async deny(input:Parameters<ResearchUsagePort['deny']>[0]):Promise<void>{
    this.db.prepare(`INSERT INTO review_research_denials(id,job_id,
      capability_version_id,operation,host,query_hash,reason,occurred_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(randomUUID(),input.jobId,
      input.capabilityVersionId,input.operation,input.host,input.queryHash,
      input.reason,Date.now());
  }
}
