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
