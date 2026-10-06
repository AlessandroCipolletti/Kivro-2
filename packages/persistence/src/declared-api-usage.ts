import type { Pool } from 'pg';
import type { DeclaredApiUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';

export class PostgresDeclaredApiUsage implements DeclaredApiUsagePort {
  constructor(private readonly pool: Pool) {}

  async begin(input: Parameters<DeclaredApiUsagePort['begin']>[0]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const job = await client.query<{ capability_version_id: string; status: string }>(
        'SELECT capability_version_id,status FROM jobs WHERE id=$1 FOR UPDATE', [input.jobId]);
      if (job.rows[0]?.capability_version_id !== input.capabilityVersionId ||
        !['PAYMENT_RESERVED','QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING'].includes(job.rows[0]?.status ?? '')) {
        throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      }
      const count = await client.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM declared_api_calls WHERE job_id=$1 AND connector_id=$2', [input.jobId, input.connectorId]);
      if (Number(count.rows[0]?.n ?? 0) >= input.maxRequestsPerJob) throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      await client.query(`INSERT INTO declared_api_calls(request_id,job_id,capability_version_id,connector_id,host,method)
        VALUES($1,$2,$3,$4,$5,$6)`, [input.requestId, input.jobId, input.capabilityVersionId,
        input.connectorId, input.host, input.method]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async finish(input: Parameters<DeclaredApiUsagePort['finish']>[0]): Promise<void> {
    const result = await this.pool.query(`UPDATE declared_api_calls SET response_bytes=$2,status=$3,reason=$4,completed_at=now()
      WHERE request_id=$1 AND completed_at IS NULL`, [input.requestId, input.responseBytes, input.status, input.reason]);
    if (result.rowCount !== 1) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }

  async deny(input: Parameters<DeclaredApiUsagePort['deny']>[0]): Promise<void> {
    await this.pool.query(`INSERT INTO declared_api_denials(job_id,capability_version_id,connector_id,reason)
      VALUES($1,$2,$3,$4)`, [input.jobId, input.capabilityVersionId, input.connectorId, input.reason]);
  }
}
