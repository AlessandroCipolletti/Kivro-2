import { z } from 'zod';
import { PriceTierSchema } from '../../contracts/src/pricing.js';

export const MinorAmountSchema = z.number().int().safe().min(0).max(1_000_000_000);
export const FinancialSnapshotSchema = z.strictObject({
  tier: PriceTierSchema,
  currency: z.literal('USD'),
  buyerAmountMinor: MinorAmountSchema.positive(),
  platformFeeMinor: MinorAmountSchema,
  sellerEarningMinor: MinorAmountSchema,
  taxMinor: MinorAmountSchema,
  buyerTotalMinor: MinorAmountSchema,
}).refine((value) => value.buyerAmountMinor === value.platformFeeMinor + value.sellerEarningMinor &&
  value.buyerTotalMinor === value.buyerAmountMinor + value.taxMinor,
  'Buyer total must equal retail price plus tax');
export type FinancialSnapshot = z.infer<typeof FinancialSnapshotSchema>;
export type ReservationState = 'RESERVED' | 'RELEASED' | 'SETTLED' | 'REFUNDED';
export type JournalMovement = Readonly<{ account: string; amountMinor: number }>;

export class FinanceError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INSUFFICIENT_CREDITS' |
    'NOT_ELIGIBLE' | 'PAYMENT_NOT_SECURED' | 'INVALID_MONEY' | 'STRIPE_NOT_READY') {
    super(code); this.name = 'FinanceError';
  }
}

export function buyerAccountKey(buyerId: string, kind: 'available' | 'reserved'): string {
  return `buyer:${z.uuid().parse(buyerId)}:${kind}`;
}
export function sellerAccountKey(sellerId: string,
  kind: 'pending' | 'available' | 'transferred' | 'paid_out'): string {
  return `seller:${z.uuid().parse(sellerId)}:${kind}`;
}
export const platformAccountKey = (kind: 'clearing' | 'revenue' | 'tax_liability' |
  'dispute_loss' | 'processing_expense' | 'refund_loss'): string =>
  `platform:usd:${kind}`;

export function balanced(movements: readonly JournalMovement[]): readonly JournalMovement[] {
  if (!movements.length || movements.some((m) => !Number.isSafeInteger(m.amountMinor) ||
    m.amountMinor === 0 || Math.abs(m.amountMinor) > 1_000_000_000) ||
    new Set(movements.map((m) => m.account)).size !== movements.length ||
    movements.reduce((sum, m) => sum + m.amountMinor, 0) !== 0) {
    throw new FinanceError('INVALID_MONEY');
  }
  return movements;
}

export function purchaseMovements(buyerId: string, amount: number): readonly JournalMovement[] {
  MinorAmountSchema.positive().parse(amount);
  return balanced([{ account: platformAccountKey('clearing'), amountMinor: -amount },
    { account: buyerAccountKey(buyerId, 'available'), amountMinor: amount }]);
}
export function reserveMovements(buyerId: string, amount: number): readonly JournalMovement[] {
  MinorAmountSchema.positive().parse(amount);
  return balanced([{ account: buyerAccountKey(buyerId, 'available'), amountMinor: -amount },
    { account: buyerAccountKey(buyerId, 'reserved'), amountMinor: amount }]);
}
export function releaseMovements(buyerId: string, amount: number): readonly JournalMovement[] {
  return reserveMovements(buyerId, amount).map((m) => ({ ...m, amountMinor: -m.amountMinor }));
}
export function settleMovements(buyerId: string, sellerId: string,
  snapshotInput: unknown): readonly JournalMovement[] {
  const p = FinancialSnapshotSchema.parse(snapshotInput);
  // A nonzero tax is separately journalled as a platform liability, never as commission.
  return balanced([
    { account: buyerAccountKey(buyerId, 'reserved'), amountMinor: -p.buyerTotalMinor },
    { account: sellerAccountKey(sellerId, 'pending'), amountMinor: p.sellerEarningMinor },
    { account: platformAccountKey('revenue'), amountMinor: p.platformFeeMinor },
    ...(p.taxMinor ? [{ account: platformAccountKey('tax_liability'), amountMinor: p.taxMinor }] : []),
  ]);
}
export function refundMovements(buyerId: string, sellerId: string,
  snapshotInput: unknown, sellerSource: 'pending' | 'available'): readonly JournalMovement[] {
  return settleMovements(buyerId, sellerId, snapshotInput).map((m) => {
    const account = m.account === sellerAccountKey(sellerId, 'pending') && sellerSource === 'available' ?
      sellerAccountKey(sellerId, 'available') : m.account;
    return { account: account === buyerAccountKey(buyerId, 'reserved') ?
      buyerAccountKey(buyerId, 'available') : account, amountMinor: -m.amountMinor };
  });
}

export function assertFinancialTransition(current: ReservationState, next: ReservationState): void {
  if (!(current === 'RESERVED' && (next === 'RELEASED' || next === 'SETTLED') ||
    current === 'SETTLED' && next === 'REFUNDED')) throw new FinanceError('NOT_ELIGIBLE');
}
