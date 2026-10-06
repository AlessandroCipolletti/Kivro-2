import { z } from 'zod';
import { PriceSnapshotSchema } from '../../contracts/src/pricing.js';
import { ProviderBudgetPolicySchema } from '../../contracts/src/provider-budget-policy.js';

const microPerCent = 10_000;
export type CostEvidence = 'UNKNOWN' | 'ESTIMATED_FROM_RATE' |
  'ESTIMATED_FROM_USAGE' | 'MEASURED_PROVIDER' | 'NO_EXTERNAL_AI_COST';

export interface SellerEconomics {
  readonly buyerPriceMinor: number;
  readonly marketplaceFeeMinor: number;
  readonly sellerProceedsMinor: number;
  readonly providerCostMicroUsd: number | null;
  readonly providerCostEvidence: CostEvidence;
  readonly estimatedNetProceedsMinor: number | null;
  readonly possibleLoss: boolean | null;
  readonly currency: 'USD';
}

function project(priceInput: unknown, costMicroUsd: number | null,
  evidence: CostEvidence): SellerEconomics {
  const price = PriceSnapshotSchema.parse(priceInput);
  if (costMicroUsd !== null && (!Number.isSafeInteger(costMicroUsd) || costMicroUsd < 0)) {
    throw new TypeError('Invalid provider cost');
  }
  const costCents = costMicroUsd === null ? null : Math.ceil(costMicroUsd / microPerCent);
  return Object.freeze({ buyerPriceMinor: price.buyerAmountMinor,
    marketplaceFeeMinor: price.platformFeeMinor, sellerProceedsMinor: price.sellerEarningMinor,
    providerCostMicroUsd: costMicroUsd, providerCostEvidence: evidence,
    estimatedNetProceedsMinor: costCents === null ? null : price.sellerEarningMinor - costCents,
    possibleLoss: costCents === null ? null : costCents > price.sellerEarningMinor,
    currency: 'USD' });
}

/** Prepublication display: max spend is a risk ceiling, never described as typical measured cost. */
export function sellerPricePreview(price: unknown, providerBudget: unknown | null,
  aiInference: 'NONE' | 'SELLER'): SellerEconomics & { readonly maxProviderCostMicroUsd: number | null;
  readonly worstCaseNetMinor: number | null } {
  if (aiInference === 'NONE') return { ...project(price, 0, 'NO_EXTERNAL_AI_COST'),
    maxProviderCostMicroUsd: 0, worstCaseNetMinor: PriceSnapshotSchema.parse(price).sellerEarningMinor };
  if (providerBudget === null) return { ...project(price, null, 'UNKNOWN'),
    maxProviderCostMicroUsd: null, worstCaseNetMinor: null };
  const policy = ProviderBudgetPolicySchema.parse(providerBudget);
  const maximum = policy.maxEstimatedSpendMicroUsdPerJob;
  const view = project(price, null, 'UNKNOWN');
  return { ...view, maxProviderCostMicroUsd: maximum,
    worstCaseNetMinor: view.sellerProceedsMinor - Math.ceil(maximum / microPerCent),
    possibleLoss: Math.ceil(maximum / microPerCent) > view.sellerProceedsMinor };
}

export function sellerJobEconomics(price: unknown, providerUsage: readonly {
  readonly accountedMicroUsd: number | null; readonly reservedMicroUsd: number;
  readonly measuredCostMicroUsd: number | null; readonly completed: boolean;
}[], aiInference: 'NONE' | 'SELLER'): SellerEconomics {
  z.enum(['NONE','SELLER']).parse(aiInference);
  if (aiInference === 'NONE') return project(price, 0, 'NO_EXTERNAL_AI_COST');
  if (!providerUsage.length) return project(price, null, 'UNKNOWN');
  let cost = 0;
  let measured = true, complete = true;
  for (const row of providerUsage) {
    const value = row.measuredCostMicroUsd ?? row.accountedMicroUsd ?? row.reservedMicroUsd;
    if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(row.reservedMicroUsd) ||
      row.reservedMicroUsd < 0 || cost + value > Number.MAX_SAFE_INTEGER) throw new TypeError('Invalid cost');
    cost += value;
    measured &&= row.measuredCostMicroUsd !== null;
    complete &&= row.completed;
  }
  return project(price, cost, measured ? 'MEASURED_PROVIDER' :
    complete ? 'ESTIMATED_FROM_USAGE' : 'ESTIMATED_FROM_RATE');
}
