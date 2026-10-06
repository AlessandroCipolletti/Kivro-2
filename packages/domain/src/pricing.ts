import type { PriceSnapshot, PriceTier } from '../../contracts/src/pricing.js';

/** Canonical MVP USD tier table from Master Spec §282; values are minor units. */
const tiers: Readonly<Record<PriceTier, readonly [number, number, number]>> = Object.freeze({
  USD_099: [99, 19, 80],
  USD_299: [299, 59, 240],
  USD_499: [499, 99, 400],
  USD_999: [999, 199, 800],
  USD_1499: [1499, 299, 1200],
  USD_1999: [1999, 399, 1600],
  USD_2999: [2999, 599, 2400],
  USD_4999: [4999, 999, 4000],
  USD_9999: [9999, 1999, 8000],
});

export function priceForTier(tier: PriceTier): PriceSnapshot {
  const amounts = tiers[tier];
  if (!amounts) throw new TypeError('Unsupported price tier');
  const [buyerAmountMinor, platformFeeMinor, sellerEarningMinor] = amounts;
  if (buyerAmountMinor !== platformFeeMinor + sellerEarningMinor) throw new Error('Invalid canonical price table');
  return Object.freeze({ tier, currency: 'USD', buyerAmountMinor, platformFeeMinor, sellerEarningMinor });
}
