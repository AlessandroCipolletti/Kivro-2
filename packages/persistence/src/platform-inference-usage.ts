import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { PlatformInferenceError, type PlatformInferenceUsageSink } from
  '../../infrastructure/contracts/src/platform-inference-ports.js';
import { canonicalJson } from '../../contracts/src/canonical-json.js';

const uuid=z.uuid();
export interface PlatformInferenceLimits {
  readonly requestsPerMinute: number;
  readonly turnsPerDay: number;
  readonly reservedTokensPerDay: number;
}
const defaults:PlatformInferenceLimits={requestsPerMinute:6,turnsPerDay:50,
  reservedTokensPerDay:100_000};

/** DB counters persist across process restart and serialize concurrent calls per buyer. */
export class PostgresPlatformInferenceUsage implements PlatformInferenceUsageSink {
  constructor(private readonly pool:Pool,private readonly limits:PlatformInferenceLimits=defaults) {
    if (!Number.isInteger(limits.requestsPerMinute)||limits.requestsPerMinute<1||
      !Number.isInteger(limits.turnsPerDay)||limits.turnsPerDay<1||
      !Number.isInteger(limits.reservedTokensPerDay)||limits.reservedTokensPerDay<1)
      throw new TypeError('Invalid platform inference limits');
  }
  async recordRoutingConfiguration(profiles:Readonly<Record<string,unknown>>):Promise<void>{
    const json=canonicalJson(profiles);
    const hash=`sha256:${createHash('sha256').update(json).digest('hex')}`;
    await this.pool.query(`INSERT INTO platform_ai_profile_audit(configuration_hash,configuration_json)
      VALUES($1,$2) ON CONFLICT(configuration_hash) DO NOTHING`,[hash,json]);
  }
  async reserveRequest(input:Parameters<PlatformInferenceUsageSink['reserveRequest']>[0]):Promise<string>{
    uuid.parse(input.userId);
    if(!Number.isInteger(input.maxTokens)||input.maxTokens<1||input.maxTokens>4096)
      throw new PlatformInferenceError('INVALID_REQUEST');
    const client=await this.pool.connect();
    try { await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
        [`platform-ai:${input.userId}`]);
      const account=await client.query<{status:string;email_verified_at:Date|null}>(
        'SELECT status,email_verified_at FROM accounts WHERE id=$1',[input.userId]);
      if(account.rows[0]?.status!=='ACTIVE'||!account.rows[0].email_verified_at)
        throw new PlatformInferenceError('BUDGET_EXCEEDED');
      const counts=await client.query<{minute_count:number;day_count:number;day_tokens:string}>(`
        SELECT count(*) FILTER(WHERE created_at>now()-interval '1 minute')::int AS minute_count,
          count(*) FILTER(WHERE created_at>now()-interval '1 day')::int AS day_count,
          coalesce(sum(reserved_max_tokens) FILTER(WHERE created_at>now()-interval '1 day'),0)::text
            AS day_tokens FROM platform_ai_request_guard WHERE buyer_account_id=$1`,[input.userId]);
      const row=counts.rows[0];
      if(!row||row.minute_count>=this.limits.requestsPerMinute||
        row.day_count>=this.limits.turnsPerDay||
        Number(row.day_tokens)+input.maxTokens>this.limits.reservedTokensPerDay)
        throw new PlatformInferenceError('BUDGET_EXCEEDED');
      const id=randomUUID();
      await client.query(`INSERT INTO platform_ai_request_guard(id,buyer_account_id,task,reserved_max_tokens)
        VALUES($1,$2,$3,$4)`,[id,input.userId,input.task,input.maxTokens]);
      await client.query('COMMIT');return id;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async recordUsage(input:Parameters<PlatformInferenceUsageSink['recordUsage']>[0]):Promise<void>{
    uuid.parse(input.requestId);uuid.parse(input.userId);
    if(input.conversationId)uuid.parse(input.conversationId);
    if(input.orchestrationId)uuid.parse(input.orchestrationId);
    const prior=await this.pool.query<{buyer_account_id:string}>(
      'SELECT buyer_account_id FROM platform_ai_request_guard WHERE id=$1',[input.requestId]);
    if(prior.rows[0]?.buyer_account_id!==input.userId)
      throw new PlatformInferenceError('INVALID_REQUEST');
    const inserted=await this.pool.query(`INSERT INTO platform_inference_usage(request_id,buyer_account_id,
      conversation_id,orchestration_id,task,provider,model,input_tokens,output_tokens,
      cached_input_tokens,estimated_cost_microusd,latency_ms,outcome,error_code,tool_call_count)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT(request_id) DO NOTHING RETURNING request_id`,[input.requestId,input.userId,
        input.conversationId??null,input.orchestrationId??null,input.task,input.provider,
        input.model,input.inputTokens,input.outputTokens,input.cachedInputTokens,
        input.estimatedCostMicrousd,input.latencyMs,input.outcome,input.errorCode??null,
        input.toolCallCount]);
    if(!inserted.rows[0]){
      const existing=await this.pool.query<{buyer_account_id:string;conversation_id:string|null;
        orchestration_id:string|null;task:string;provider:string;model:string;
        input_tokens:number;output_tokens:number;cached_input_tokens:number;
        estimated_cost_microusd:string|null;latency_ms:number;outcome:string;
        error_code:string|null;tool_call_count:number}>(`SELECT * FROM platform_inference_usage
        WHERE request_id=$1`,[input.requestId]);
      const row=existing.rows[0];
      if(!row||row.buyer_account_id!==input.userId||
        row.conversation_id!==(input.conversationId??null)||
        row.orchestration_id!==(input.orchestrationId??null)||row.task!==input.task||
        row.provider!==input.provider||row.model!==input.model||
        row.input_tokens!==input.inputTokens||row.output_tokens!==input.outputTokens||
        row.cached_input_tokens!==input.cachedInputTokens||
        (row.estimated_cost_microusd===null?null:Number(row.estimated_cost_microusd))!==
          input.estimatedCostMicrousd||row.latency_ms!==input.latencyMs||
        row.outcome!==input.outcome||row.error_code!==(input.errorCode??null)||
        row.tool_call_count!==input.toolCallCount)
        throw new PlatformInferenceError('INVALID_REQUEST');
    }
  }
  async summary(buyerId:string):Promise<{requests:number;estimatedCostMicrousd:number|null}>{
    const row=await this.pool.query<{requests:number;cost:string|null;unknown:number}>(`
      SELECT count(*)::int AS requests,sum(estimated_cost_microusd)::text AS cost,
        count(*) FILTER(WHERE estimated_cost_microusd IS NULL)::int AS unknown
      FROM platform_inference_usage WHERE buyer_account_id=$1`,[uuid.parse(buyerId)]);
    return {requests:row.rows[0]?.requests??0,
      estimatedCostMicrousd:row.rows[0]?.unknown?null:Number(row.rows[0]?.cost??0)};
  }
  /** Safe aggregate metrics: no prompt, response, key or seller billing data. */
  async metrics(from:Date,to:Date):Promise<{days:readonly {day:string;
    requests:number;knownCostMicrousd:number;unknownCostRequests:number}[];
    users:readonly {buyerId:string;knownCostMicrousd:number;unknownCostRequests:number}[];
    conversations:readonly {conversationId:string;knownCostMicrousd:number}[];
    orchestrations:readonly {planId:string;knownCostMicrousd:number}[];
    marketplaceRevenueMinor:number;unresolvedRequests:number}>{
    if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||
      to.getTime()<=from.getTime()||to.getTime()-from.getTime()>90*86_400_000)
      throw new PlatformInferenceError('INVALID_REQUEST');
    const args=[from.toISOString(),to.toISOString()];
    const [days,users,conversations,orchestrations,revenue,unresolved]=await Promise.all([
      this.pool.query<{day:string;requests:number;cost:string;unknown:number}>(`
        SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
          count(*)::int AS requests,coalesce(sum(estimated_cost_microusd),0)::text AS cost,
          count(*) FILTER(WHERE estimated_cost_microusd IS NULL)::int AS unknown
        FROM platform_inference_usage WHERE created_at>=$1 AND created_at<$2
        GROUP BY 1 ORDER BY 1`,args),
      this.pool.query<{buyer_account_id:string;cost:string;unknown:number}>(`
        SELECT buyer_account_id,coalesce(sum(estimated_cost_microusd),0)::text AS cost,
          count(*) FILTER(WHERE estimated_cost_microusd IS NULL)::int AS unknown
        FROM platform_inference_usage WHERE created_at>=$1 AND created_at<$2
        GROUP BY buyer_account_id ORDER BY cost DESC LIMIT 100`,args),
      this.pool.query<{conversation_id:string;cost:string}>(`
        SELECT conversation_id,coalesce(sum(estimated_cost_microusd),0)::text AS cost
        FROM platform_inference_usage WHERE created_at>=$1 AND created_at<$2
          AND conversation_id IS NOT NULL GROUP BY conversation_id
        ORDER BY cost DESC LIMIT 100`,args),
      this.pool.query<{orchestration_id:string;cost:string}>(`
        SELECT orchestration_id,coalesce(sum(estimated_cost_microusd),0)::text AS cost
        FROM platform_inference_usage WHERE created_at>=$1 AND created_at<$2
          AND orchestration_id IS NOT NULL GROUP BY orchestration_id
        ORDER BY cost DESC LIMIT 100`,args),
      this.pool.query<{fee:string}>(`SELECT coalesce(sum(f.platform_fee_minor),0)::text AS fee
        FROM financial_journals j JOIN job_financial_snapshots f ON f.job_id=j.job_id
        WHERE j.kind='SETTLE' AND j.created_at>=$1 AND j.created_at<$2`,args),
      this.pool.query<{count:number}>(`SELECT count(*)::int AS count
        FROM platform_ai_request_guard g LEFT JOIN platform_inference_usage u
          ON u.request_id=g.id WHERE g.created_at>=$1 AND g.created_at<$2
          AND g.created_at<now()-interval '2 minutes' AND u.request_id IS NULL`,args),
    ]);
    return {days:days.rows.map((row)=>({day:row.day,requests:row.requests,
      knownCostMicrousd:Number(row.cost),unknownCostRequests:row.unknown})),
      users:users.rows.map((row)=>({buyerId:row.buyer_account_id,
        knownCostMicrousd:Number(row.cost),unknownCostRequests:row.unknown})),
      conversations:conversations.rows.map((row)=>({conversationId:row.conversation_id,
        knownCostMicrousd:Number(row.cost)})),
      orchestrations:orchestrations.rows.map((row)=>({planId:row.orchestration_id,
        knownCostMicrousd:Number(row.cost)})),
      marketplaceRevenueMinor:Number(revenue.rows[0]?.fee??0),
      unresolvedRequests:unresolved.rows[0]?.count??0};
  }
}
