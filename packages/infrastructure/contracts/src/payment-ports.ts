export type StripeMode = 'test' | 'live';
export const STRIPE_API_VERSION = '2026-09-30.endive';

export interface StripePaymentIntent {
  readonly id: string;
  readonly status: 'requires_payment_method' | 'requires_action' | 'processing' |
    'requires_capture' | 'succeeded' | 'canceled';
  readonly amountMinor: number;
  readonly currency: 'usd';
  readonly customerId: string | null;
  readonly clientSecret: string | null;
  readonly latestChargeId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
  readonly mode: StripeMode;
}
export interface StripeConnectAccount {
  readonly id: string;
  readonly transfersEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly detailsSubmitted: boolean;
  readonly requirementsDue: readonly string[];
  readonly country: string | null;
  readonly mode: StripeMode;
}
export interface StripeTransfer {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: 'usd';
  readonly destinationAccountId: string;
  readonly reversed: boolean;
  readonly mode: StripeMode;
}
export interface StripePayout {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: 'usd';
  readonly status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';
  readonly connectedAccountId: string;
  readonly mode: StripeMode;
}
export interface StripeDispute {
  readonly id: string;
  readonly paymentIntentId: string | null;
  readonly amountMinor: number;
  readonly currency: 'usd';
  readonly status: 'OPEN' | 'WON' | 'LOST';
  readonly mode: StripeMode;
}
export interface StripeCharge {
  readonly id: string; readonly paymentIntentId: string;
  readonly amountMinor: number; readonly currency: 'usd';
  readonly balanceTransactionId: string | null; readonly mode: StripeMode;
}
export interface StripeBalanceTransaction {
  readonly id: string; readonly feeMinor: number;
  readonly currency: 'usd'; readonly sourceChargeId: string;
  readonly mode: StripeMode;
}
export interface StripeRefund {
  readonly id: string; readonly paymentIntentId: string;
  readonly chargeId: string | null; readonly amountMinor: number;
  readonly currency: 'usd'; readonly status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  readonly mode: StripeMode;
}

/** Stripe mechanics only. All decisions and ledger effects stay in shared Core. */
export interface StripeGatewayPort {
  readonly mode: StripeMode;
  createCustomer(email: string, idempotencyKey: string): Promise<{ id: string }>;
  createSetupIntent(customerId: string, idempotencyKey: string):
    Promise<{ id: string; clientSecret: string }>;
  retrievePaymentMethod(id: string): Promise<{ id: string; customerId: string | null; mode: StripeMode }>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string,
    idempotencyKey: string): Promise<void>;
  detachPaymentMethod(id: string, idempotencyKey: string): Promise<void>;
  createCreditPaymentIntent(input: { customerId: string; amountMinor: number;
    purchaseId: string; idempotencyKey: string }): Promise<StripePaymentIntent>;
  retrievePaymentIntent(id: string): Promise<StripePaymentIntent>;
  retrieveCharge(id: string): Promise<StripeCharge>;
  retrieveBalanceTransaction(id: string): Promise<StripeBalanceTransaction>;
  retrieveRefund(id: string): Promise<StripeRefund>;
  listRefunds(paymentIntentId: string, startingAfter?: string): Promise<{
    readonly refunds: readonly StripeRefund[]; readonly hasMore: boolean;
  }>;
  createConnectAccount(input: { country: string; idempotencyKey: string }): Promise<StripeConnectAccount>;
  retrieveConnectAccount(id: string): Promise<StripeConnectAccount>;
  createOnboardingLink(input: { accountId: string; refreshUrl: string; returnUrl: string }):
    Promise<{ url: string }>;
  createTransfer(input: { accountId: string; amountMinor: number; jobId: string;
    idempotencyKey: string }): Promise<StripeTransfer>;
  retrieveTransfer(id: string): Promise<StripeTransfer>;
  reverseTransfer(id: string, idempotencyKey: string): Promise<StripeTransfer>;
  retrievePayout(id: string, connectedAccountId: string): Promise<StripePayout>;
  listPayouts(connectedAccountId: string, startingAfter?: string): Promise<{
    readonly payouts: readonly StripePayout[]; readonly hasMore: boolean;
  }>;
  retrieveDispute(id: string): Promise<StripeDispute>;
}
