import type { Pool } from 'pg';
import type { ProviderUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';

export class PostgresProviderUsage implements ProviderUsagePort {
  constructor(private readonly pool: Pool) {}

  async reserve(input: Parameters<ProviderUsagePort['reserve']>[0]): Promise<void> {
    if (![input.reserveMicroUsd,input.maxRequestsPerJob,input.maxSpendMicroUsdPerJob,
      input.reservedInputTokens,input.reservedOutputTokens,input.maxTokensPerJob,
      input.maxDailyJobs,input.maxDailySpendMicroUsd].every((value) =>
      Number.isSafeInteger(value) && value > 0)) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const job = await client.query<{ capability_version_id: string; status: string;
        seller_profile_id: string }>(`SELECT j.capability_version_id,j.status,c.seller_profile_id
        FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
        JOIN capabilities c ON c.id=v.capability_id WHERE j.id=$1 FOR UPDATE OF j`, [input.jobId]);
      if (job.rows[0]?.capability_version_id !== input.capabilityVersionId ||
        !['PAYMENT_RESERVED','QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING'].includes(job.rows[0]?.status ?? '')) {
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      }
      // Serialize different jobs for one seller before checking daily limits.
      await client.query('SELECT id FROM seller_profiles WHERE id=$1 FOR UPDATE',
        [job.rows[0].seller_profile_id]);
      const tally = await client.query<{ n: string; spent: string; tokens: string }>(`SELECT count(*)::text AS n,
        coalesce(sum(coalesce(accounted_micro_usd,reserved_micro_usd)),0)::text AS spent,
        coalesce(sum(coalesce(input_tokens,reserved_input_tokens)+
          coalesce(output_tokens,reserved_output_tokens)),0)::text AS tokens
        FROM seller_provider_calls WHERE job_id=$1`, [input.jobId]);
      if (Number(tally.rows[0]?.n ?? 0) >= input.maxRequestsPerJob ||
        Number(tally.rows[0]?.spent ?? 0) + input.reserveMicroUsd > input.maxSpendMicroUsdPerJob ||
        Number(tally.rows[0]?.tokens ?? 0) + input.reservedInputTokens +
          input.reservedOutputTokens > input.maxTokensPerJob) {
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      }
      const daily = await client.query<{ jobs: string; spent: string; includes_job: boolean }>(`
        SELECT count(DISTINCT calls.job_id)::text AS jobs,
          coalesce(sum(coalesce(calls.accounted_micro_usd,calls.reserved_micro_usd)),0)::text AS spent,
          coalesce(bool_or(calls.job_id=$2),false) AS includes_job
        FROM seller_provider_calls calls JOIN jobs j ON j.id=calls.job_id
        JOIN capability_versions v ON v.id=j.capability_version_id
        JOIN capabilities c ON c.id=v.capability_id
        WHERE c.seller_profile_id=$1 AND calls.started_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
      [job.rows[0].seller_profile_id, input.jobId]);
      if (Number(daily.rows[0]?.jobs ?? 0) + (daily.rows[0]?.includes_job ? 0 : 1) > input.maxDailyJobs ||
        Number(daily.rows[0]?.spent ?? 0) + input.reserveMicroUsd > input.maxDailySpendMicroUsd) {
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      }
      await client.query(`INSERT INTO seller_provider_calls
        (request_id,job_id,capability_version_id,provider_id,model_id,reserved_micro_usd,
        reserved_input_tokens,reserved_output_tokens)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [input.requestId, input.jobId, input.capabilityVersionId,
        input.providerId, input.modelId, input.reserveMicroUsd,
        input.reservedInputTokens, input.reservedOutputTokens]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async settle(input: Parameters<ProviderUsagePort['settle']>[0]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ reserved_micro_usd: string; reserved_input_tokens: number;
        reserved_output_tokens: number; accounted_micro_usd: string | null; input_tokens: number | null;
        output_tokens: number | null; status: string | null; completed_at: Date | null;
        measured_cost_micro_usd: string | null }>(
        'SELECT * FROM seller_provider_calls WHERE request_id=$1 FOR UPDATE', [input.requestId]);
      const row = result.rows[0];
      if (!row || ![input.accountedMicroUsd,input.inputTokens,input.outputTokens].every((value) =>
        Number.isSafeInteger(value) && value >= 0) ||
        input.accountedMicroUsd > Number(row.reserved_micro_usd) ||
        input.inputTokens > row.reserved_input_tokens || input.outputTokens > row.reserved_output_tokens ||
        input.measuredCostMicroUsd !== undefined && input.measuredCostMicroUsd !== null &&
        (!Number.isSafeInteger(input.measuredCostMicroUsd) || input.measuredCostMicroUsd < 0)) {
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      }
      if (row.completed_at) {
        if (Number(row.accounted_micro_usd) !== input.accountedMicroUsd ||
          row.input_tokens !== input.inputTokens || row.output_tokens !== input.outputTokens ||
          row.status !== input.status ||
          (row.measured_cost_micro_usd === null ? null : Number(row.measured_cost_micro_usd)) !==
            (input.measuredCostMicroUsd ?? null)) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      } else {
        await client.query(`UPDATE seller_provider_calls SET accounted_micro_usd=$2,input_tokens=$3,
          output_tokens=$4,status=$5,measured_cost_micro_usd=$6,completed_at=now()
          WHERE request_id=$1`, [input.requestId, input.accountedMicroUsd, input.inputTokens,
          input.outputTokens, input.status, input.measuredCostMicroUsd ?? null]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
