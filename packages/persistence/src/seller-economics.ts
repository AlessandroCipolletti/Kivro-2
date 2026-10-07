import type { Pool } from 'pg';
import { z } from 'zod';
import { JobContractSnapshotSchema } from '../../contracts/src/capability-version.js';
import { sellerJobEconomics } from '../../application/src/seller-economics.js';

/** Seller-visible figures are snapshots plus ledger-backed settlement and broker usage. */
export class PostgresSellerEconomics {
  constructor(private readonly pool: Pool) {}

  /** Lifetime operational counts and provider usage are derived from immutable jobs and
   * broker requests. Currency totals remain the finance repository's ledger projection. */
  async summary(sellerProfileId: string) {
    const id = z.uuid().parse(sellerProfileId);
    const jobs = await this.pool.query<{jobs_today:number;jobs_total:number;
      completed:number;failed:number;average_runtime_seconds:number|null}>(`
      SELECT count(*) FILTER (WHERE j.created_at>=date_trunc('day',now() AT TIME ZONE 'UTC')
        AT TIME ZONE 'UTC')::int AS jobs_today,
        count(*)::int AS jobs_total,
        count(*) FILTER (WHERE j.status='COMPLETED')::int AS completed,
        count(*) FILTER (WHERE j.status IN ('FAILED_STARTUP','FAILED_POLICY',
          'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'))::int AS failed,
        avg(extract(epoch FROM j.completed_at-j.started_at)) FILTER (
          WHERE j.started_at IS NOT NULL AND j.completed_at IS NOT NULL
          AND j.status IN ('COMPLETED','FAILED_STARTUP','FAILED_POLICY',
            'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'))::float8
          AS average_runtime_seconds
      FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
      JOIN capabilities c ON c.id=v.capability_id WHERE c.seller_profile_id=$1`,[id]);
    const costs = await this.pool.query<{measured:string;estimated:string;
      measured_calls:number;estimated_calls:number;unknown_jobs:number}>(`
      SELECT coalesce(sum(calls.measured_cost_micro_usd),0)::text AS measured,
        coalesce(sum(coalesce(calls.accounted_micro_usd,calls.reserved_micro_usd))
          FILTER (WHERE calls.measured_cost_micro_usd IS NULL),0)::text AS estimated,
        count(*) FILTER (WHERE calls.measured_cost_micro_usd IS NOT NULL)::int AS measured_calls,
        count(*) FILTER (WHERE calls.measured_cost_micro_usd IS NULL)::int AS estimated_calls,
        (SELECT count(*)::int FROM jobs j JOIN job_financial_snapshots s ON s.job_id=j.id
          WHERE s.seller_profile_id=$1 AND j.contract_snapshot->'permissionManifestSnapshot'
            @> '{"entries":[{"category":"AI_INFERENCE","state":"USED"}]}'::jsonb
            AND NOT EXISTS (SELECT 1 FROM seller_provider_calls x WHERE x.job_id=j.id))
          AS unknown_jobs
      FROM seller_provider_calls calls JOIN job_financial_snapshots s ON s.job_id=calls.job_id
      WHERE s.seller_profile_id=$1`,[id]);
    const j=jobs.rows[0]!;const c=costs.rows[0]!;
    const measuredMicroUsd=Number(c.measured),estimatedMicroUsd=Number(c.estimated);
    if(!Number.isSafeInteger(measuredMicroUsd)||!Number.isSafeInteger(estimatedMicroUsd)||
      measuredMicroUsd+estimatedMicroUsd>Number.MAX_SAFE_INTEGER)
      throw new RangeError('PROVIDER_COST_OVERFLOW');
    return {jobsToday:j.jobs_today,jobsTotal:j.jobs_total,completedJobs:j.completed,
      failedJobs:j.failed,failureRate:j.completed+j.failed===0?null:j.failed/(j.completed+j.failed),
      averageRuntimeSeconds:j.average_runtime_seconds,
      providerCosts:{measuredMicroUsd,estimatedMicroUsd,
        measuredCalls:c.measured_calls,estimatedCalls:c.estimated_calls,
        unknownJobs:c.unknown_jobs,currency:'USD' as const}};
  }

  async job(jobId: string, sellerAccountId: string) {
    const row = await this.pool.query<{ contract_snapshot: unknown; seller_profile_id: string;
      payment_state: string | null; provider_id: string | null; model_id: string | null;
      cost: string | null; reserved: string | null; measured: string | null;
      completed_at: Date | null }>(`SELECT j.contract_snapshot,s.id AS seller_profile_id,
      p.state AS payment_state,calls.provider_id,calls.model_id,
      calls.accounted_micro_usd AS cost,calls.reserved_micro_usd AS reserved,
      calls.measured_cost_micro_usd AS measured,calls.completed_at
      FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
      JOIN capabilities c ON c.id=v.capability_id
      JOIN seller_profiles s ON s.id=c.seller_profile_id
      LEFT JOIN job_payment_states p ON p.job_id=j.id
      LEFT JOIN seller_provider_calls calls ON calls.job_id=j.id
      WHERE j.id=$1 AND s.account_id=$2`, [z.uuid().parse(jobId), z.uuid().parse(sellerAccountId)]);
    if (!row.rows[0]) throw new Error('SELLER_ECONOMICS_NOT_FOUND');
    const snapshot = JobContractSnapshotSchema.parse(row.rows[0].contract_snapshot);
    const inference = snapshot.permissionManifestSnapshot.entries.find((entry) =>
      entry.category === 'AI_INFERENCE')?.state === 'USED' ? 'SELLER' : 'NONE';
    const usage = row.rows.filter((entry) => entry.provider_id !== null).map((entry) => ({
      accountedMicroUsd: entry.cost === null ? null : Number(entry.cost),
      reservedMicroUsd: Number(entry.reserved),
      measuredCostMicroUsd: entry.measured === null ? null : Number(entry.measured),
      completed: entry.completed_at !== null,
    }));
    return { ...sellerJobEconomics(snapshot.priceSnapshot, usage, inference),
      paymentState: row.rows[0].payment_state ?? 'UNFUNDED',
      providerModels: [...new Set(row.rows.filter((entry) => entry.provider_id && entry.model_id)
        .map((entry) => `${entry.provider_id}/${entry.model_id}`))] };
  }
}
