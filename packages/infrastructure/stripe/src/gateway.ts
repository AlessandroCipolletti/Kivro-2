import { z } from 'zod';
import { STRIPE_API_VERSION, type StripeGatewayPort, type StripeMode,
  type StripePaymentIntent, type StripeConnectAccount, type StripeTransfer,
  type StripePayout, type StripeDispute, type StripeCharge,
  type StripeBalanceTransaction, type StripeRefund } from '../../contracts/src/payment-ports.js';

const objectId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`));
const positiveMoney = z.number().int().safe().positive().max(1_000_000_000);
const httpError = (code: string) => new Error(`STRIPE_${code}`);

export class StripeHttpGateway implements StripeGatewayPort {
  readonly mode: StripeMode;
  constructor(private readonly secretKey: string, mode: StripeMode,
    private readonly requestFetch: typeof fetch = fetch) {
    if (!secretKey.startsWith(mode === 'test' ? 'sk_test_' : 'sk_live_') ||
      process.env.NODE_ENV === 'production' && mode === 'test') throw httpError('MODE_MISMATCH');
    this.mode = mode;
  }

  private async call(method: 'GET' | 'POST', path: string,
    params?: Readonly<Record<string, string>>, idempotencyKey?: string,
    connectedAccount?: string): Promise<unknown> {
    if (!/^\/[A-Za-z0-9_/-]+$/.test(path) || path.includes('//') || path.includes('..')) {
      throw httpError('INVALID_PATH');
    }
    if (method === 'POST' && !idempotencyKey) throw httpError('IDEMPOTENCY_REQUIRED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const query = method === 'GET' && params ? `?${new URLSearchParams(params)}` : '';
      const response = await this.requestFetch(`https://api.stripe.com/v1${path}${query}`, {
        method, signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
          'Stripe-Version': STRIPE_API_VERSION,
          ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': idempotencyKey! } : {}),
          ...(connectedAccount ? { 'Stripe-Account': objectId('acct').parse(connectedAccount) } : {}),
        },
        ...(method === 'POST' ? { body: new URLSearchParams(params ?? {}).toString() } : {}),
      });
      const body = await response.text();
      if (body.length > 1_000_000) throw httpError('OVERSIZE_RESPONSE');
      if (!response.ok) throw httpError(`HTTP_${response.status}`);
      return JSON.parse(body) as unknown;
    } finally { clearTimeout(timer); }
  }

  private paymentIntent(raw: unknown): StripePaymentIntent {
    const row = z.object({ id: objectId('pi'), status: z.enum(['requires_payment_method',
      'requires_action','processing','requires_capture','succeeded','canceled']),
    amount: positiveMoney, currency: z.literal('usd'), customer: z.union([objectId('cus'), z.null()]),
    client_secret: z.string().nullable().optional(),
    latest_charge: z.union([objectId('ch'), z.null()]).optional(),
    metadata: z.record(z.string(), z.string()), livemode: z.boolean() }).parse(raw);
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, status: row.status, amountMinor: row.amount, currency: row.currency,
      customerId: row.customer, clientSecret: row.client_secret ?? null,
      latestChargeId: row.latest_charge ?? null,
      metadata: row.metadata, mode: this.mode };
  }

  async createCustomer(email: string, idempotencyKey: string): Promise<{ id: string }> {
    const row = z.object({ id: objectId('cus'), livemode: z.boolean() }).parse(await this.call('POST',
      '/customers', { email: z.email().parse(email) }, idempotencyKey));
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id };
  }

  async createSetupIntent(customerId: string, idempotencyKey: string):
    Promise<{ id: string; clientSecret: string }> {
    const row = z.object({ id: objectId('seti'), client_secret: z.string().min(20),
      livemode: z.boolean() }).parse(await this.call('POST', '/setup_intents', {
      customer: objectId('cus').parse(customerId), usage: 'off_session',
      'automatic_payment_methods[enabled]': 'true',
    }, idempotencyKey));
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, clientSecret: row.client_secret };
  }

  async retrievePaymentMethod(id: string): Promise<{ id: string; customerId: string | null;
    mode: StripeMode }> {
    const row = z.object({ id: objectId('pm'), customer: z.union([objectId('cus'),z.null()]),
      livemode: z.boolean() }).parse(await this.call('GET',
      `/payment_methods/${objectId('pm').parse(id)}`));
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, customerId: row.customer, mode: this.mode };
  }
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string,
    idempotencyKey: string): Promise<void> {
    await this.call('POST', `/customers/${objectId('cus').parse(customerId)}`, {
      'invoice_settings[default_payment_method]': objectId('pm').parse(paymentMethodId),
    }, idempotencyKey);
  }
  async detachPaymentMethod(id: string, idempotencyKey: string): Promise<void> {
    await this.call('POST', `/payment_methods/${objectId('pm').parse(id)}/detach`, {}, idempotencyKey);
  }

  async createCreditPaymentIntent(input: { customerId: string; amountMinor: number;
    purchaseId: string; idempotencyKey: string }): Promise<StripePaymentIntent> {
    const raw = await this.call('POST', '/payment_intents', {
      customer: objectId('cus').parse(input.customerId),
      amount: String(positiveMoney.parse(input.amountMinor)), currency: 'usd',
      'metadata[kivro_purchase_id]': z.uuid().parse(input.purchaseId),
      'automatic_payment_methods[enabled]': 'true',
    }, input.idempotencyKey);
    return this.paymentIntent(raw);
  }
  async retrievePaymentIntent(id: string): Promise<StripePaymentIntent> {
    return this.paymentIntent(await this.call('GET', `/payment_intents/${objectId('pi').parse(id)}`));
  }
  async retrieveCharge(id: string): Promise<StripeCharge> {
    const row = z.object({ id: objectId('ch'), payment_intent: objectId('pi'),
      amount: positiveMoney, currency: z.literal('usd'),
      balance_transaction: z.union([objectId('txn'), z.null()]),
      livemode: z.boolean() }).parse(await this.call('GET', `/charges/${objectId('ch').parse(id)}`));
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, paymentIntentId: row.payment_intent, amountMinor: row.amount,
      currency: row.currency, balanceTransactionId: row.balance_transaction, mode: this.mode };
  }
  async retrieveBalanceTransaction(id: string): Promise<StripeBalanceTransaction> {
    const row = z.object({ id: objectId('txn'), fee: z.number().int().safe().nonnegative(),
      currency: z.literal('usd'), source: objectId('ch') }).parse(await this.call('GET',
      `/balance_transactions/${objectId('txn').parse(id)}`));
    return { id: row.id, feeMinor: row.fee, currency: row.currency,
      sourceChargeId: row.source, mode: this.mode };
  }
  private refund(raw: unknown): StripeRefund {
    const row = z.object({ id: objectId('re'), payment_intent: objectId('pi'),
      charge: z.union([objectId('ch'),z.null()]), amount: positiveMoney,
      currency: z.literal('usd'), status: z.enum(['pending','succeeded','failed','canceled',
        'requires_action']) }).parse(raw);
    return { id: row.id, paymentIntentId: row.payment_intent, chargeId: row.charge,
      amountMinor: row.amount, currency: row.currency,
      status: row.status === 'requires_action' ? 'pending' : row.status, mode: this.mode };
  }
  async retrieveRefund(id: string): Promise<StripeRefund> {
    return this.refund(await this.call('GET', `/refunds/${objectId('re').parse(id)}`));
  }
  async listRefunds(paymentIntentId: string, startingAfter?: string): Promise<{
    readonly refunds: readonly StripeRefund[]; readonly hasMore: boolean }> {
    const intent = objectId('pi').parse(paymentIntentId);
    const cursor = startingAfter ? objectId('re').parse(startingAfter) : undefined;
    const row = z.object({ object: z.literal('list'), has_more: z.boolean(),
      data: z.array(z.unknown()).max(100) }).parse(await this.call('GET', '/refunds', {
      payment_intent: intent, limit: '100', ...(cursor ? { starting_after: cursor } : {}),
    }));
    const refunds = row.data.map((raw) => this.refund(raw));
    if (refunds.some((refund) => refund.paymentIntentId !== intent) ||
      row.has_more && !refunds.length) throw httpError('INVALID_REFUND_PAGE');
    return { refunds, hasMore: row.has_more };
  }

  private connectAccount(raw: unknown): StripeConnectAccount {
    const row = z.object({ id: objectId('acct'),
      transfers_enabled: z.boolean(), payouts_enabled: z.boolean(),
      details_submitted: z.boolean(), country: z.string().nullable(),
      requirements: z.object({ currently_due: z.array(z.string()) }).nullable() }).parse(raw);
    return { id: row.id, transfersEnabled: row.transfers_enabled,
      payoutsEnabled: row.payouts_enabled, detailsSubmitted: row.details_submitted,
      requirementsDue: row.requirements?.currently_due ?? [], country: row.country, mode: this.mode };
  }
  async createConnectAccount(input: { country: string; idempotencyKey: string }):
    Promise<StripeConnectAccount> {
    const country = z.string().regex(/^[A-Z]{2}$/).parse(input.country);
    return this.connectAccount(await this.call('POST', '/accounts', {
      type: 'express', country, 'capabilities[transfers][requested]': 'true',
    }, input.idempotencyKey));
  }
  async retrieveConnectAccount(id: string): Promise<StripeConnectAccount> {
    return this.connectAccount(await this.call('GET', `/accounts/${objectId('acct').parse(id)}`));
  }
  async createOnboardingLink(input: { accountId: string; refreshUrl: string; returnUrl: string }):
    Promise<{ url: string }> {
    const refresh = new URL(input.refreshUrl), done = new URL(input.returnUrl);
    if (refresh.protocol !== 'https:' || done.protocol !== 'https:' || refresh.origin !== done.origin) {
      throw httpError('INVALID_RETURN_URL');
    }
    const row = z.object({ url: z.url() }).parse(await this.call('POST', '/account_links', {
      account: objectId('acct').parse(input.accountId), refresh_url: refresh.href,
      return_url: done.href, type: 'account_onboarding',
    }, `connect-link:${input.accountId}:${crypto.randomUUID()}`));
    return { url: row.url };
  }

  private transfer(raw: unknown): StripeTransfer {
    const row = z.object({ id: objectId('tr'), amount: positiveMoney,
      currency: z.literal('usd'), destination: objectId('acct'), reversed: z.boolean(),
      livemode: z.boolean() }).parse(raw);
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, amountMinor: row.amount, currency: row.currency,
      destinationAccountId: row.destination, reversed: row.reversed, mode: this.mode };
  }
  async createTransfer(input: { accountId: string; amountMinor: number; jobId: string;
    idempotencyKey: string }): Promise<StripeTransfer> {
    return this.transfer(await this.call('POST', '/transfers', {
      destination: objectId('acct').parse(input.accountId),
      amount: String(positiveMoney.parse(input.amountMinor)), currency: 'usd',
      transfer_group: `job:${z.uuid().parse(input.jobId)}`,
      'metadata[kivro_job_id]': input.jobId,
    }, input.idempotencyKey));
  }
  async retrieveTransfer(id: string): Promise<StripeTransfer> {
    return this.transfer(await this.call('GET', `/transfers/${objectId('tr').parse(id)}`));
  }
  async reverseTransfer(id: string, idempotencyKey: string): Promise<StripeTransfer> {
    const transferId = objectId('tr').parse(id);
    await this.call('POST', `/transfers/${transferId}/reversals`, {}, idempotencyKey);
    return this.retrieveTransfer(transferId);
  }
  private payout(raw: unknown, connectedAccountId: string): StripePayout {
    const row = z.object({ id: objectId('po'), amount: positiveMoney,
      currency: z.literal('usd'), status: z.enum(['pending','in_transit','paid','failed','canceled']),
      livemode: z.boolean() }).parse(raw);
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, amountMinor: row.amount, currency: row.currency,
      status: row.status, connectedAccountId, mode: this.mode };
  }
  async retrievePayout(id: string, connectedAccountId: string): Promise<StripePayout> {
    return this.payout(await this.call('GET', `/payouts/${objectId('po').parse(id)}`,
      undefined, undefined, connectedAccountId), connectedAccountId);
  }
  async listPayouts(connectedAccountId: string, startingAfter?: string): Promise<{
    readonly payouts: readonly StripePayout[]; readonly hasMore: boolean }> {
    const account = objectId('acct').parse(connectedAccountId);
    const cursor = startingAfter ? objectId('po').parse(startingAfter) : undefined;
    const row = z.object({ object: z.literal('list'), has_more: z.boolean(),
      data: z.array(z.unknown()).max(100) }).parse(await this.call('GET', '/payouts', {
      limit: '100', ...(cursor ? { starting_after: cursor } : {}),
    }, undefined, account));
    const payouts = row.data.map((raw) => this.payout(raw, account));
    if (row.has_more && !payouts.length) throw httpError('INVALID_PAYOUT_PAGE');
    return { payouts, hasMore: row.has_more };
  }

  async retrieveDispute(id: string): Promise<StripeDispute> {
    const row = z.object({ id: objectId('du'), payment_intent: z.union([objectId('pi'),z.null()]),
      amount: positiveMoney, currency: z.literal('usd'),
      status: z.enum(['warning_needs_response','warning_under_review','warning_closed',
        'needs_response','under_review','won','lost','prevented']),
      livemode: z.boolean() }).parse(await this.call('GET', `/disputes/${objectId('du').parse(id)}`));
    if (row.livemode !== (this.mode === 'live')) throw httpError('MODE_MISMATCH');
    return { id: row.id, paymentIntentId: row.payment_intent, amountMinor: row.amount,
      currency: row.currency, mode: this.mode, status: row.status === 'won' ? 'WON' :
        row.status === 'lost' ? 'LOST' : 'OPEN' };
  }
}
