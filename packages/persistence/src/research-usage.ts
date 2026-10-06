import type { Pool, PoolClient } from 'pg';
import type { ResearchUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';

type Begin = Parameters<ResearchUsagePort['begin']>[0];
type Finish = Parameters<ResearchUsagePort['finish']>[0];

async function tx<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Per-job row locks make concurrent budget reservations and private-read barriers atomic. */
export class PostgresResearchUsage implements ResearchUsagePort {
  constructor(private readonly pool: Pool) {}

  async begin(input: Begin): Promise<void> {
    await tx(this.pool, async (client) => {
      await client.query(`INSERT INTO research_job_usage(job_id, capability_version_id)
        SELECT id, capability_version_id FROM jobs WHERE id=$1 AND capability_version_id=$2
          AND status IN ('PAYMENT_RESERVED','QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING')
        ON CONFLICT (job_id) DO NOTHING`, [input.jobId, input.capabilityVersionId]);
      const usage = await client.query<{ capability_version_id: string; private_resource_read: boolean; age_ms: number }>(
        `SELECT capability_version_id, private_resource_read,
          extract(epoch from (now()-started_at))*1000 AS age_ms FROM research_job_usage WHERE job_id=$1 FOR UPDATE`, [input.jobId]);
      const row = usage.rows[0];
      if (!row || row.capability_version_id !== input.capabilityVersionId || row.private_resource_read ||
        Number(row.age_ms) > input.maxDurationMs) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const owner = await client.query<{ buyer_account_id: string; worker_device_id: string; status: string }>(
        'SELECT buyer_account_id,worker_device_id,status FROM jobs WHERE id=$1', [input.jobId]);
      if (!owner.rows[0] || !['PAYMENT_RESERVED','QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING']
        .includes(owner.rows[0].status)) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      // Sorted advisory locks prevent cross-job races on platform rate ceilings.
      const scopes = [`buyer:${owner.rows[0].buyer_account_id}`, `worker:${owner.rows[0].worker_device_id}`,
        `version:${input.capabilityVersionId}`, ...(input.host ? [`host:${input.host}`] : [])].sort();
      for (const scope of scopes) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [scope]);
      const rate = await client.query<{ buyer: string; worker: string; version: string; host: string }>(
        `SELECT count(*) FILTER (WHERE j.buyer_account_id=$1)::text AS buyer,
          count(*) FILTER (WHERE j.worker_device_id=$2)::text AS worker,
          count(*) FILTER (WHERE r.capability_version_id=$3)::text AS version,
          count(*) FILTER (WHERE r.host=$4)::text AS host
        FROM research_requests r JOIN jobs j ON j.id=r.job_id
        WHERE r.started_at > now() - interval '1 minute'`,
        [owner.rows[0].buyer_account_id, owner.rows[0].worker_device_id, input.capabilityVersionId, input.host]);
      const rateRow = rate.rows[0]!;
      if (Number(rateRow.buyer) >= 120 || Number(rateRow.worker) >= 120 || Number(rateRow.version) >= 120 ||
        (input.host && Number(rateRow.host) >= 60)) throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      const current = await client.query<{ count_search: string; count_fetch: string; count_download: string;
        count_active: string; count_host: string; bytes_total: string; bytes_download: string }>(
        `SELECT count(*) FILTER (WHERE operation='SEARCH')::text AS count_search,
          count(*) FILTER (WHERE operation='FETCH')::text AS count_fetch,
          count(*) FILTER (WHERE operation='DOWNLOAD')::text AS count_download,
          count(*) FILTER (WHERE completed_at IS NULL AND started_at > now() - interval '5 minutes')::text AS count_active,
          count(*) FILTER (WHERE host=$2)::text AS count_host,
          coalesce(sum(CASE WHEN completed_at IS NULL AND started_at > now() - interval '5 minutes' THEN reserved_bytes ELSE coalesce(actual_bytes,0) END),0)::text AS bytes_total,
          coalesce(sum(CASE WHEN operation='DOWNLOAD' THEN
            CASE WHEN completed_at IS NULL AND started_at > now() - interval '5 minutes' THEN reserved_bytes ELSE coalesce(actual_bytes,0) END
            ELSE 0 END),0)::text AS bytes_download
        FROM research_requests WHERE job_id=$1`, [input.jobId, input.host]);
      const c = current.rows[0]!;
      const count = input.operation === 'SEARCH' ? Number(c.count_search) : input.operation === 'FETCH' ? Number(c.count_fetch) : Number(c.count_download);
      const max = input.operation === 'SEARCH' ? input.maxQueries : input.operation === 'FETCH' ? input.maxPages : input.maxDownloads;
      if (count >= max || Number(c.count_active) >= input.maxConcurrent ||
        (input.host && Number(c.count_host) >= input.maxPerHost) ||
        Number(c.bytes_total) + input.byteReservation > input.maxTotalBytes ||
        (input.operation === 'DOWNLOAD' && Number(c.bytes_download) + input.byteReservation > input.maxDownloadsBytes)) {
        throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      }
      await client.query(`INSERT INTO research_requests(request_id,job_id,capability_version_id,operation,host,query_hash,reserved_bytes)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [input.requestId, input.jobId, input.capabilityVersionId,
        input.operation, input.host, input.queryHash, input.byteReservation]);
    });
  }

  async finish(input: Finish): Promise<void> {
    await tx(this.pool, async (client) => {
      const request = await client.query<{ job_id: string }>('SELECT job_id FROM research_requests WHERE request_id=$1', [input.requestId]);
      if (!request.rows[0]) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      await client.query('SELECT job_id FROM research_job_usage WHERE job_id=$1 FOR UPDATE', [request.rows[0].job_id]);
      const updated = await client.query(`UPDATE research_requests SET actual_bytes=$2, content_type=$3, http_status=$4,
        blocked_reason=$5, completed_at=now() WHERE request_id=$1 AND completed_at IS NULL AND $2<=reserved_bytes`,
      [input.requestId, input.bytes, input.contentType, input.status, input.blockedReason]);
      if (updated.rowCount !== 1) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    });
  }

  async markPrivateResourceRead(jobId: string, capabilityVersionId: string): Promise<void> {
    const result = await this.pool.query(`INSERT INTO research_job_usage(job_id,capability_version_id,private_resource_read)
      SELECT id,capability_version_id,true FROM jobs WHERE id=$1 AND capability_version_id=$2
        AND status IN ('PAYMENT_RESERVED','QUEUED','WAITING_FOR_WORKER','DISPATCHED','ACCEPTED','STARTING','RUNNING')
      ON CONFLICT (job_id) DO UPDATE SET private_resource_read=true
        WHERE research_job_usage.capability_version_id=EXCLUDED.capability_version_id`, [jobId, capabilityVersionId]);
    if (result.rowCount !== 1) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
  }

  async deny(input: Parameters<ResearchUsagePort['deny']>[0]): Promise<void> {
    await this.pool.query(`INSERT INTO research_denials(job_id,capability_version_id,operation,host,query_hash,reason)
      VALUES($1,$2,$3,$4,$5,$6)`, [input.jobId, input.capabilityVersionId, input.operation, input.host,
      input.queryHash, input.reason]);
  }
}
