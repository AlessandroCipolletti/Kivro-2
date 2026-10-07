import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import type { ProviderUsagePort } from '../../../packages/infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../../packages/policy-engine/src/public-destination.js';
import { openPrivateWorkerSqlite } from './local-state.js';

const uuid=z.uuid();
const ref=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/);
type Call={request_id:string;job_id:string;capability_version_id:string;
  provider_id:string;model_id:string;reserved_micro_usd:number;
  reserved_input_tokens:number;reserved_output_tokens:number;
  accounted_micro_usd:number|null;input_tokens:number|null;output_tokens:number|null;
  measured_cost_micro_usd:number|null;status:string|null;completed_at:string|null};

function positive(...values:number[]):void{
  if(values.some((value)=>!Number.isSafeInteger(value)||value<=0))
    throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
}

/** The host Worker reserves worst-case seller spend before any provider call.
 * A lost acknowledgement cannot turn a duplicate request ID into another call. */
export class WorkerProviderUsage implements ProviderUsagePort {
  private readonly db:DatabaseSync;
  constructor(stateDir:string){
    this.db=openPrivateWorkerSqlite(stateDir,'worker.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS local_provider_calls(
      request_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,capability_version_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,model_id TEXT NOT NULL,
      reserved_micro_usd INTEGER NOT NULL CHECK(reserved_micro_usd>0),
      reserved_input_tokens INTEGER NOT NULL CHECK(reserved_input_tokens>0),
      reserved_output_tokens INTEGER NOT NULL CHECK(reserved_output_tokens>0),
      accounted_micro_usd INTEGER,input_tokens INTEGER,output_tokens INTEGER,
      measured_cost_micro_usd INTEGER,
      status TEXT CHECK(status IN ('SUCCEEDED','FAILED')),
      started_at TEXT NOT NULL,completed_at TEXT);
      CREATE INDEX IF NOT EXISTS local_provider_calls_job ON local_provider_calls(job_id);
      CREATE INDEX IF NOT EXISTS local_provider_calls_started ON local_provider_calls(started_at);`);
  }
  close():void{this.db.close();}

  async reserve(input:Parameters<ProviderUsagePort['reserve']>[0]):Promise<void>{
    uuid.parse(input.requestId);uuid.parse(input.jobId);uuid.parse(input.capabilityVersionId);
    ref.parse(input.providerId);ref.parse(input.modelId);
    positive(input.reserveMicroUsd,input.maxRequestsPerJob,input.maxSpendMicroUsdPerJob,
      input.reservedInputTokens,input.reservedOutputTokens,input.maxTokensPerJob,
      input.maxDailyJobs,input.maxDailySpendMicroUsd);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      if(this.db.prepare('SELECT 1 FROM local_provider_calls WHERE request_id=?')
        .get(input.requestId))throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const prior=this.db.prepare(`SELECT capability_version_id,provider_id,model_id
        FROM local_provider_calls WHERE job_id=? LIMIT 1`).get(input.jobId) as
        Pick<Call,'capability_version_id'|'provider_id'|'model_id'>|undefined;
      if(prior&&(prior.capability_version_id!==input.capabilityVersionId||
        prior.provider_id!==input.providerId||prior.model_id!==input.modelId))
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const job=this.db.prepare(`SELECT count(*) AS n,
        coalesce(sum(coalesce(accounted_micro_usd,reserved_micro_usd)),0) AS spend,
        coalesce(sum(coalesce(input_tokens,reserved_input_tokens)+
          coalesce(output_tokens,reserved_output_tokens)),0) AS tokens
        FROM local_provider_calls WHERE job_id=?`).get(input.jobId) as {
          n:number;spend:number;tokens:number};
      if(job.n>=input.maxRequestsPerJob||
        job.spend+input.reserveMicroUsd>input.maxSpendMicroUsdPerJob||
        job.tokens+input.reservedInputTokens+input.reservedOutputTokens>input.maxTokensPerJob)
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      const today=new Date().toISOString().slice(0,10);
      const daily=this.db.prepare(`SELECT count(DISTINCT job_id) AS jobs,
        coalesce(sum(coalesce(accounted_micro_usd,reserved_micro_usd)),0) AS spend,
        count(*) FILTER (WHERE job_id=?) AS same_job
        FROM local_provider_calls WHERE started_at>=?`).get(input.jobId,`${today}T00:00:00.000Z`) as {
          jobs:number;spend:number;same_job:number};
      if(daily.jobs+(daily.same_job?0:1)>input.maxDailyJobs||
        daily.spend+input.reserveMicroUsd>input.maxDailySpendMicroUsd)
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      this.db.prepare(`INSERT INTO local_provider_calls(request_id,job_id,capability_version_id,
        provider_id,model_id,reserved_micro_usd,reserved_input_tokens,
        reserved_output_tokens,started_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(input.requestId,
        input.jobId,input.capabilityVersionId,input.providerId,input.modelId,
        input.reserveMicroUsd,input.reservedInputTokens,input.reservedOutputTokens,
        new Date().toISOString());
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }

  async settle(input:Parameters<ProviderUsagePort['settle']>[0]):Promise<void>{
    uuid.parse(input.requestId);
    if([input.accountedMicroUsd,input.inputTokens,input.outputTokens].some((value)=>
      !Number.isSafeInteger(value)||value<0)||
      input.measuredCostMicroUsd!==undefined&&input.measuredCostMicroUsd!==null&&
      (!Number.isSafeInteger(input.measuredCostMicroUsd)||input.measuredCostMicroUsd<0))
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const row=this.db.prepare('SELECT * FROM local_provider_calls WHERE request_id=?')
        .get(input.requestId) as Call|undefined;
      if(!row||input.accountedMicroUsd>row.reserved_micro_usd||
        input.inputTokens>row.reserved_input_tokens||
        input.outputTokens>row.reserved_output_tokens)
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      if(row.completed_at){
        if(row.accounted_micro_usd!==input.accountedMicroUsd||
          row.input_tokens!==input.inputTokens||row.output_tokens!==input.outputTokens||
          row.status!==input.status||
          row.measured_cost_micro_usd!==(input.measuredCostMicroUsd??null))
          throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      }else{
        this.db.prepare(`UPDATE local_provider_calls SET accounted_micro_usd=?,input_tokens=?,
          output_tokens=?,measured_cost_micro_usd=?,status=?,completed_at=? WHERE request_id=?`).run(
          input.accountedMicroUsd,input.inputTokens,input.outputTokens,
          input.measuredCostMicroUsd??null,input.status,
          new Date().toISOString(),input.requestId);
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }

  summary(jobId:string):{requests:number;estimatedMicroUsd:number;
    inputTokens:number;outputTokens:number;unsettled:number}{
    const row=this.db.prepare(`SELECT count(*) AS requests,
      coalesce(sum(coalesce(accounted_micro_usd,reserved_micro_usd)),0) AS cost,
      coalesce(sum(coalesce(input_tokens,reserved_input_tokens)),0) AS input_tokens,
      coalesce(sum(coalesce(output_tokens,reserved_output_tokens)),0) AS output_tokens,
      count(*) FILTER (WHERE completed_at IS NULL) AS unsettled
      FROM local_provider_calls WHERE job_id=?`).get(uuid.parse(jobId)) as {
        requests:number;cost:number;input_tokens:number;output_tokens:number;unsettled:number};
    return {requests:row.requests,estimatedMicroUsd:row.cost,
      inputTokens:row.input_tokens,outputTokens:row.output_tokens,unsettled:row.unsettled};
  }
}
