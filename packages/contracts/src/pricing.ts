import { z } from 'zod';

/** Platform-owned IDs. The nine launch tiers are seeded in the shared database. */
export const PriceTierSchema = z.string().regex(/^USD_[0-9]{2,8}$/);

export const PriceSnapshotSchema = z.strictObject({
  tier: PriceTierSchema,
  currency: z.literal('USD'),
  buyerAmountMinor: z.number().int().safe().positive(),
  platformFeeMinor: z.number().int().safe().nonnegative(),
  sellerEarningMinor: z.number().int().safe().nonnegative(),
}).refine((value) => value.buyerAmountMinor === value.platformFeeMinor + value.sellerEarningMinor,
  'Price split must balance');

export type PriceTier = z.infer<typeof PriceTierSchema>;
export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;

/** Launch catalog reference for offline Worker authoring. Cloud remains the
 * publication authority and rejects a disabled or revised tier. */
export const LAUNCH_PRICE_TIERS: readonly PriceSnapshot[] = Object.freeze([
  ['USD_099',99,19,80],['USD_299',299,59,240],['USD_499',499,99,400],
  ['USD_999',999,199,800],['USD_1499',1499,299,1200],
  ['USD_1999',1999,399,1600],['USD_2999',2999,599,2400],
  ['USD_4999',4999,999,4000],['USD_9999',9999,1999,8000],
].map(([tier,buyerAmountMinor,platformFeeMinor,sellerEarningMinor])=>
  PriceSnapshotSchema.parse({tier,currency:'USD',buyerAmountMinor,
    platformFeeMinor,sellerEarningMinor})));
