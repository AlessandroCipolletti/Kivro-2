import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import type {LocalInferenceUsagePort} from
  '../../../packages/application/src/completion-broker.js';
import {NetworkPolicyError} from
  '../../../packages/policy-engine/src/public-destination.js';
import {openPrivateWorkerSqlite} from './local-state.js';

type Call={job_id:string;capability_version_id:string;provider_id:string;
  model_id:string;reserved_input_tokens:number;reserved_output_tokens:number;
  input_tokens:number|null;output_tokens:number|null;status:string|null;
  completed_at:string|null};

function denied():never{throw new NetworkPolicyError('NETWORK_POLICY_DENIED');}

/** Local model calls consume durable request/token capacity, never a fabricated
 * external-money amount. A replayed call ID cannot invoke the service twice. */
export class WorkerLocalInferenceUsage implements LocalInferenceUsagePort{
  private readonly db:DatabaseSync;
  constructor(stateDir:string){
    this.db=openPrivateWorkerSqlite(stateDir,'worker.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS local_inference_calls(
      request_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,
      capability_version_id TEXT NOT NULL,provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,reserved_input_tokens INTEGER NOT NULL CHECK(reserved_input_tokens>0),
      reserved_output_tokens INTEGER NOT NULL CHECK(reserved_output_tokens>0),
      input_tokens INTEGER,output_tokens INTEGER,
      status TEXT CHECK(status IN ('SUCCEEDED','FAILED')),
      started_at TEXT NOT NULL,completed_at TEXT);
      CREATE INDEX IF NOT EXISTS local_inference_calls_job ON local_inference_calls(job_id);
      CREATE INDEX IF NOT EXISTS local_inference_calls_started ON local_inference_calls(started_at);`);
  }
  close():void{this.db.close();}

  async begin(input:Parameters<LocalInferenceUsagePort['begin']>[0]):Promise<void>{
    z.uuid().parse(input.requestId);z.uuid().parse(input.jobId);
    z.uuid().parse(input.capabilityVersionId);
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(input.providerId)||
      !input.modelId||input.modelId.length>160||
      [input.reservedInputTokens,input.reservedOutputTokens,input.maxRequestsPerJob,
        input.maxTokensPerJob,input.maxDailyJobs].some((value)=>
        !Number.isSafeInteger(value)||value<1))denied();
    this.db.exec('BEGIN IMMEDIATE');
    try{
      if(this.db.prepare('SELECT 1 FROM local_inference_calls WHERE request_id=?')
        .get(input.requestId))denied();
      const existing=this.db.prepare(`SELECT capability_version_id,provider_id,model_id
        FROM local_inference_calls WHERE job_id=? LIMIT 1`).get(input.jobId) as
        Pick<Call,'capability_version_id'|'provider_id'|'model_id'>|undefined;
      if(existing&&(existing.capability_version_id!==input.capabilityVersionId||
        existing.provider_id!==input.providerId||existing.model_id!==input.modelId))denied();
      const job=this.db.prepare(`SELECT count(*) AS requests,
        coalesce(sum(coalesce(input_tokens,reserved_input_tokens)+
          coalesce(output_tokens,reserved_output_tokens)),0) AS tokens
        FROM local_inference_calls WHERE job_id=?`).get(input.jobId) as
        {requests:number;tokens:number};
      if(job.requests>=input.maxRequestsPerJob||
        job.tokens+input.reservedInputTokens+input.reservedOutputTokens>
          input.maxTokensPerJob)
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      const today=new Date().toISOString().slice(0,10);
      const daily=this.db.prepare(`SELECT count(DISTINCT job_id) AS jobs,
        count(*) FILTER (WHERE job_id=?) AS same_job FROM local_inference_calls
        WHERE started_at>=?`).get(input.jobId,`${today}T00:00:00.000Z`) as
        {jobs:number;same_job:number};
      if(daily.jobs+(daily.same_job?0:1)>input.maxDailyJobs)
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      this.db.prepare(`INSERT INTO local_inference_calls(request_id,job_id,
        capability_version_id,provider_id,model_id,reserved_input_tokens,
        reserved_output_tokens,started_at) VALUES(?,?,?,?,?,?,?,?)`).run(input.requestId,
        input.jobId,input.capabilityVersionId,input.providerId,input.modelId,
        input.reservedInputTokens,input.reservedOutputTokens,new Date().toISOString());
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }

  async finish(input:Parameters<LocalInferenceUsagePort['finish']>[0]):Promise<void>{
    z.uuid().parse(input.requestId);
    if([input.inputTokens,input.outputTokens].some((value)=>
      !Number.isSafeInteger(value)||value<0)||
      !['SUCCEEDED','FAILED'].includes(input.status))denied();
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const call=this.db.prepare('SELECT * FROM local_inference_calls WHERE request_id=?')
        .get(input.requestId) as Call|undefined;
      if(!call||input.inputTokens>call.reserved_input_tokens||
        input.outputTokens>call.reserved_output_tokens)denied();
      if(call.completed_at){
        if(call.input_tokens!==input.inputTokens||call.output_tokens!==input.outputTokens||
          call.status!==input.status)denied();
      }else this.db.prepare(`UPDATE local_inference_calls SET input_tokens=?,
        output_tokens=?,status=?,completed_at=? WHERE request_id=?`).run(
          input.inputTokens,input.outputTokens,input.status,new Date().toISOString(),
          input.requestId);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }

  summary(jobId:string):{requests:number;inputTokens:number;
    outputTokens:number;unsettled:number}{
    const row=this.db.prepare(`SELECT count(*) AS requests,
      coalesce(sum(coalesce(input_tokens,reserved_input_tokens)),0) AS input_tokens,
      coalesce(sum(coalesce(output_tokens,reserved_output_tokens)),0) AS output_tokens,
      count(*) FILTER (WHERE completed_at IS NULL) AS unsettled
      FROM local_inference_calls WHERE job_id=?`).get(z.uuid().parse(jobId)) as
      {requests:number;input_tokens:number;output_tokens:number;unsettled:number};
    return {requests:row.requests,inputTokens:row.input_tokens,
      outputTokens:row.output_tokens,unsettled:row.unsettled};
  }
}
