import type { Pool } from 'pg';
import { z } from 'zod';
import { JobContractSnapshotSchema } from '../../contracts/src/capability-version.js';
import { sellerJobEconomics } from '../../application/src/seller-economics.js';

/** Seller-visible figures are snapshots plus ledger-backed settlement and broker usage. */
export class PostgresSellerEconomics {
  constructor(private readonly pool: Pool) {}

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
