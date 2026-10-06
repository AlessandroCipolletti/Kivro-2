import type { Pool } from 'pg';
import type { ProviderUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';

export class PostgresProviderUsage implements ProviderUsagePort {
  constructor(private readonly pool: Pool) {}

  async reserve(input: Parameters<ProviderUsagePort['reserve']>[0]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const job = await client.query<{ capability_version_id: string; status: string }>(
        'SELECT capability_version_id,status FROM jobs WHERE id=$1 FOR UPDATE', [input.jobId]);
      if (job.rows[0]?.capability_version_id !== input.capabilityVersionId ||
        !['PAYMENT_RESERVED','QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING'].includes(job.rows[0]?.status ?? '')) {
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      }
      const tally = await client.query<{ n: string; spent: string }>(`SELECT count(*)::text AS n,
        coalesce(sum(coalesce(accounted_micro_usd,reserved_micro_usd)),0)::text AS spent
        FROM seller_provider_calls WHERE job_id=$1`, [input.jobId]);
      if (Number(tally.rows[0]?.n ?? 0) >= input.maxRequestsPerJob ||
        Number(tally.rows[0]?.spent ?? 0) + input.reserveMicroUsd > input.maxSpendMicroUsdPerJob) {
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      }
      await client.query(`INSERT INTO seller_provider_calls
        (request_id,job_id,capability_version_id,provider_id,model_id,reserved_micro_usd)
        VALUES($1,$2,$3,$4,$5,$6)`, [input.requestId, input.jobId, input.capabilityVersionId,
        input.providerId, input.modelId, input.reserveMicroUsd]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async settle(input: Parameters<ProviderUsagePort['settle']>[0]): Promise<void> {
    const result = await this.pool.query(`UPDATE seller_provider_calls SET accounted_micro_usd=$2,input_tokens=$3,
      output_tokens=$4,status=$5,completed_at=now() WHERE request_id=$1 AND completed_at IS NULL
      AND $2<=reserved_micro_usd`, [input.requestId, input.accountedMicroUsd, input.inputTokens, input.outputTokens, input.status]);
    if (result.rowCount !== 1) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }
}
