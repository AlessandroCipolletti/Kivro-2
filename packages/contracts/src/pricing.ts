import { z } from 'zod';

export const PriceTierSchema = z.enum([
  'USD_099', 'USD_299', 'USD_499', 'USD_999', 'USD_1499',
  'USD_1999', 'USD_2999', 'USD_4999', 'USD_9999',
]);

export const PriceSnapshotSchema = z.strictObject({
  tier: PriceTierSchema,
  currency: z.literal('USD'),
  buyerAmountMinor: z.number().int().positive(),
  platformFeeMinor: z.number().int().nonnegative(),
  sellerEarningMinor: z.number().int().nonnegative(),
});

export type PriceTier = z.infer<typeof PriceTierSchema>;
export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;
