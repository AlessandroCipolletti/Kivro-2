import type { Pool } from 'pg';
import { z } from 'zod';
import { PriceSnapshotSchema, PriceTierSchema, type PriceSnapshot } from '../../contracts/src/pricing.js';
import { FinanceError } from '../../application/src/finance-policy.js';

type TierRow = { id: string; currency: string; buyer_amount_minor: string;
  platform_fee_minor: string; seller_earning_minor: string; enabled: boolean;
  revision: number; sort_order: number };

/** One mutable platform tier catalog; every job retains its own immutable snapshot. */
export class PostgresPriceTierCatalog {
  constructor(private readonly pool: Pool) {}

  async listEnabled(): Promise<readonly (PriceSnapshot & { readonly revision: number })[]> {
    const rows = await this.pool.query<TierRow>(`SELECT * FROM marketplace_price_tiers
      WHERE enabled=true ORDER BY sort_order,id`);
    return rows.rows.map((row) => this.snapshot(row));
  }

  async selected(tierId: string): Promise<PriceSnapshot & { readonly revision: number }> {
    const row = await this.pool.query<TierRow>(
      'SELECT * FROM marketplace_price_tiers WHERE id=$1 AND enabled=true',
      [PriceTierSchema.parse(tierId)]);
    if (!row.rows[0]) throw new FinanceError('NOT_ELIGIBLE');
    return this.snapshot(row.rows[0]);
  }

  /** Internal platform operation. Seller publication calls selected(); no seller price write port exists. */
  async revise(input: { price: unknown; enabled: boolean; sortOrder: number;
    expectedRevision: number }): Promise<number> {
    const price = PriceSnapshotSchema.parse(input.price);
    const order = z.number().int().min(1).max(10_000).parse(input.sortOrder);
    const expected = z.number().int().min(0).parse(input.expectedRevision);
    if (expected === 0) {
      const row = await this.pool.query<{ revision: number }>(`INSERT INTO marketplace_price_tiers
        (id,currency,buyer_amount_minor,platform_fee_minor,seller_earning_minor,enabled,sort_order)
        VALUES($1,'USD',$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING revision`,
      [price.tier,price.buyerAmountMinor,price.platformFeeMinor,
        price.sellerEarningMinor,input.enabled,order]);
      if (!row.rows[0]) throw new FinanceError('CONFLICT');
      return row.rows[0].revision;
    }
    const row = await this.pool.query<{ revision: number }>(`UPDATE marketplace_price_tiers SET
      buyer_amount_minor=$3,platform_fee_minor=$4,seller_earning_minor=$5,
      enabled=$6,sort_order=$7,revision=revision+1,updated_at=now()
      WHERE id=$1 AND revision=$2 RETURNING revision`,
    [price.tier,expected,price.buyerAmountMinor,price.platformFeeMinor,
      price.sellerEarningMinor,input.enabled,order]);
    if (!row.rows[0]) throw new FinanceError('CONFLICT');
    return row.rows[0].revision;
  }

  private snapshot(row: TierRow): PriceSnapshot & { readonly revision: number } {
    const price = PriceSnapshotSchema.parse({ tier: row.id, currency: row.currency,
      buyerAmountMinor: Number(row.buyer_amount_minor),
      platformFeeMinor: Number(row.platform_fee_minor),
      sellerEarningMinor: Number(row.seller_earning_minor) });
    return Object.freeze({ ...price, revision: z.number().int().positive().parse(row.revision) });
  }

  /** Quote projection intentionally omits the seller/platform split. */
  async buyerQuote(capabilityVersionId: string, expiresAt: string): Promise<{
    capabilityId: string; capabilityVersionId: string; priceTierId: string;
    currency: 'USD'; buyerPriceMinor: number; quoteExpiresAt: string;
  }> {
    z.uuid().parse(capabilityVersionId);
    z.iso.datetime().parse(expiresAt);
    if (Date.parse(expiresAt) <= Date.now()) throw new FinanceError('NOT_ELIGIBLE');
    const row = await this.pool.query<{ capability_id: string; price: unknown }>(`
      SELECT v.capability_id,v.version_snapshot->'price' AS price FROM capability_versions v
      WHERE v.id=$1 AND v.publication_state='PUBLISHED'`, [capabilityVersionId]);
    if (!row.rows[0]) throw new FinanceError('NOT_FOUND');
    const price = PriceSnapshotSchema.parse(row.rows[0].price);
    return { capabilityId: row.rows[0].capability_id, capabilityVersionId,
      priceTierId: price.tier, currency: 'USD', buyerPriceMinor: price.buyerAmountMinor,
      quoteExpiresAt: expiresAt };
  }
}
