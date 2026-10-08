import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { JobContractSnapshotSchema } from '../../contracts/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { canonicalJson } from '../../contracts/src/canonical-json.js';
import { applyJobTransition } from '../../domain/src/job-lifecycle.js';
import {
  FinancialSnapshotSchema, FinanceError, MinorAmountSchema, assertFinancialTransition,
  balanced, buyerAccountKey, platformAccountKey, purchaseMovements, refundMovements,
  releaseMovements, reserveMovements, sellerAccountKey, settleMovements,
  type FinancialSnapshot, type JournalMovement, type ReservationState,
} from '../../application/src/finance-policy.js';
import type { PaymentReservationVerifier } from './job-execution.js';
import type { StripeGatewayPort, StripePaymentIntent, StripeConnectAccount,
  StripeTransfer, StripePayout, StripeDispute, StripeRefund } from '../../infrastructure/contracts/src/payment-ports.js';
import { verifyStripeWebhook } from '../../application/src/stripe-webhook.js';

const uuid = z.uuid();
const terminalFailure = new Set(['REJECTED','EXPIRED','CANCELLED','FAILED_STARTUP',
  'FAILED_POLICY','FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED']);
type LockedJob = { id: string; buyer_account_id: string; capability_version_id: string;
  status: string; contract_snapshot: unknown; payment_reservation_id: string | null;
  result_manifest_id: string | null; started_at: Date | null };
type ReservationRow = { id: string; job_id: string; buyer_account_id: string;
  amount_minor: string; state: ReservationState; reserve_journal_id: string;
  terminal_journal_id: string | null };
type SnapshotRow = { seller_profile_id: string; price_tier_id: string;
  currency: string; buyer_price_minor: string; platform_fee_minor: string;
  seller_earning_minor: string; tax_minor: string; buyer_total_minor: string };

function safeMinor(value: string | number): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) {
    throw new FinanceError('INVALID_MONEY');
  }
  return amount;
}

export interface FinancialBalance {
  readonly availableMinor: number;
  readonly reservedMinor: number;
  readonly currency: 'USD';
}

/** Shared PostgreSQL financial state machine; provider roots supply the same Pool and adapters. */
export class PostgresFinanceRepository implements PaymentReservationVerifier {
  constructor(private readonly pool: Pool, private readonly stripeMode: 'test' | 'live') {}

  private async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  private async job(client: PoolClient, jobId: string): Promise<LockedJob> {
    const result = await client.query<LockedJob>('SELECT * FROM jobs WHERE id=$1 FOR UPDATE', [uuid.parse(jobId)]);
    if (!result.rows[0]) throw new FinanceError('NOT_FOUND');
    return result.rows[0];
  }

  private static accountMetadata(key: string): { ownerKind: string; ownerId: string | null; kind: string } {
    const [subject, id, kind] = key.split(':');
    if (subject === 'buyer' && kind && ['available','reserved'].includes(kind) && id) {
      return { ownerKind: 'BUYER', ownerId: uuid.parse(id), kind: `BUYER_${kind.toUpperCase()}` };
    }
    if (subject === 'seller' && kind && ['pending','available','transferred','paid_out'].includes(kind) && id) {
      return { ownerKind: 'SELLER', ownerId: uuid.parse(id), kind: `SELLER_${kind.toUpperCase()}` };
    }
    if (subject === 'platform' && id === 'usd' && kind &&
      ['clearing','revenue','tax_liability','dispute_loss','processing_expense',
        'refund_loss'].includes(kind)) {
      return { ownerKind: 'PLATFORM', ownerId: null, kind: `PLATFORM_${kind.toUpperCase()}` };
    }
    throw new FinanceError('INVALID_MONEY');
  }

  private async lockAccounts(client: PoolClient, keys: readonly string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      const metadata = PostgresFinanceRepository.accountMetadata(key);
      await client.query(`INSERT INTO financial_accounts(account_key,currency,owner_kind,owner_id,kind)
        VALUES($1,'USD',$2,$3,$4) ON CONFLICT(account_key) DO NOTHING`,
      [key, metadata.ownerKind, metadata.ownerId, metadata.kind]);
      const row = await client.query<{ owner_kind: string; owner_id: string | null; kind: string; currency: string }>(
        'SELECT owner_kind,owner_id,kind,currency FROM financial_accounts WHERE account_key=$1 FOR UPDATE', [key]);
      if (row.rows[0]?.owner_kind !== metadata.ownerKind || row.rows[0]?.owner_id !== metadata.ownerId ||
        row.rows[0]?.kind !== metadata.kind || row.rows[0]?.currency !== 'USD') throw new FinanceError('CONFLICT');
    }
  }

  private async balance(client: PoolClient, key: string): Promise<number> {
    const row = await client.query<{ balance: string }>(
      `SELECT coalesce(sum(amount_minor),0)::text AS balance FROM financial_entries WHERE account_key=$1`, [key]);
    const result = Number(row.rows[0]?.balance ?? 0);
    if (!Number.isSafeInteger(result)) throw new FinanceError('INVALID_MONEY');
    return result;
  }

  private async journal(client: PoolClient, input: { effectKey: string; kind: string; jobId: string | null;
    movements: readonly JournalMovement[] }): Promise<string> {
    const movements = balanced(input.movements);
    await this.lockAccounts(client, movements.map((movement) => movement.account));
    for (const movement of movements) {
      if ((movement.account.startsWith('buyer:') || movement.account.startsWith('seller:')) &&
        await this.balance(client, movement.account) + movement.amountMinor < 0) {
        throw new FinanceError('INSUFFICIENT_CREDITS');
      }
    }
    const id = randomUUID();
    await client.query(`INSERT INTO financial_journals(id,effect_key,kind,job_id,currency)
      VALUES($1,$2,$3,$4,'USD')`, [id, input.effectKey, input.kind, input.jobId]);
    for (const movement of movements) {
      await client.query(`INSERT INTO financial_entries(id,journal_id,account_key,currency,amount_minor)
        VALUES($1,$2,$3,'USD',$4)`, [randomUUID(), id, movement.account, movement.amountMinor]);
    }
    return id;
  }

  async buyerBalance(buyerId: string): Promise<FinancialBalance> {
    uuid.parse(buyerId);
    const result = await this.pool.query<{ kind: string; balance: string }>(`SELECT a.kind,
      coalesce(sum(e.amount_minor),0)::text AS balance FROM financial_accounts a
      LEFT JOIN financial_entries e ON e.account_key=a.account_key
      WHERE a.owner_kind='BUYER' AND a.owner_id=$1 GROUP BY a.kind`, [buyerId]);
    const found = Object.fromEntries(result.rows.map((row) => [row.kind, safeMinor(row.balance)]));
    return { availableMinor: found.BUYER_AVAILABLE ?? 0, reservedMinor: found.BUYER_RESERVED ?? 0,
      currency: 'USD' };
  }

  /** Only a trusted Stripe reconciliation path may call this; Stripe object state is verified upstream. */
  async confirmCreditPurchase(input: { purchaseId: string; paymentIntentId: string;
    amountMinor: number; currency: 'USD'; stripeMode: 'test' | 'live'; customerId: string }): Promise<void> {
    uuid.parse(input.purchaseId); MinorAmountSchema.positive().parse(input.amountMinor);
    if (input.stripeMode !== this.stripeMode || !/^pi_[A-Za-z0-9]+$/.test(input.paymentIntentId)) {
      throw new FinanceError('CONFLICT');
    }
    await this.transaction(async (client) => {
      const result = await client.query<{ buyer_account_id: string; amount_minor: string;
        stripe_payment_intent_id: string | null; state: string; stripe_mode: string;
        journal_id: string | null }>(
        'SELECT * FROM credit_purchases WHERE id=$1 FOR UPDATE', [input.purchaseId]);
      const purchase = result.rows[0];
      if (!purchase || purchase.stripe_mode !== this.stripeMode ||
        safeMinor(purchase.amount_minor) !== input.amountMinor ||
        purchase.stripe_payment_intent_id !== input.paymentIntentId) throw new FinanceError('CONFLICT');
      const billing = await client.query<{ stripe_customer_id: string | null }>(
        'SELECT stripe_customer_id FROM buyer_billing_profiles WHERE buyer_account_id=$1',
        [purchase.buyer_account_id]);
      if (billing.rows[0]?.stripe_customer_id !== input.customerId) throw new FinanceError('CONFLICT');
      if (['SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED'].includes(purchase.state) &&
        purchase.journal_id) return;
      if (!['REQUESTED','PROCESSING'].includes(purchase.state)) throw new FinanceError('NOT_ELIGIBLE');
      const journalId = await this.journal(client, { effectKey: `purchase:${input.purchaseId}:credit`,
        kind: 'CREDIT_PURCHASE', jobId: null,
        movements: purchaseMovements(purchase.buyer_account_id, input.amountMinor) });
      await client.query(`UPDATE credit_purchases SET state='SUCCEEDED',journal_id=$2,
        updated_at=now() WHERE id=$1`, [input.purchaseId, journalId]);
    });
  }

  async beginCreditPurchase(input: { purchaseId: string; buyerId: string; amountMinor: number }):
    Promise<void> {
    uuid.parse(input.purchaseId); uuid.parse(input.buyerId);
    MinorAmountSchema.positive().parse(input.amountMinor);
    await this.transaction(async (client) => {
      const buyer = await client.query<{ primary_email: string; status: string;
        email_verified_at: Date | null }>('SELECT * FROM accounts WHERE id=$1 FOR SHARE', [input.buyerId]);
      if (buyer.rows[0]?.status !== 'ACTIVE' || !buyer.rows[0].email_verified_at) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      const prior = await client.query<{ buyer_account_id: string; amount_minor: string;
        stripe_mode: string }>('SELECT * FROM credit_purchases WHERE id=$1', [input.purchaseId]);
      if (prior.rows[0]) {
        if (prior.rows[0].buyer_account_id !== input.buyerId ||
          safeMinor(prior.rows[0].amount_minor) !== input.amountMinor ||
          prior.rows[0].stripe_mode !== this.stripeMode) throw new FinanceError('CONFLICT');
        return;
      }
      await client.query(`INSERT INTO buyer_billing_profiles(buyer_account_id,stripe_mode)
        VALUES($1,$2) ON CONFLICT(buyer_account_id) DO NOTHING`, [input.buyerId, this.stripeMode]);
      const profile = await client.query<{ stripe_mode: string }>(
        'SELECT stripe_mode FROM buyer_billing_profiles WHERE buyer_account_id=$1', [input.buyerId]);
      if (profile.rows[0]?.stripe_mode !== this.stripeMode) throw new FinanceError('CONFLICT');
      await client.query(`INSERT INTO credit_purchases(id,buyer_account_id,stripe_mode,
        amount_minor,currency,state) VALUES($1,$2,$3,$4,'USD','REQUESTED')`,
      [input.purchaseId, input.buyerId, this.stripeMode, input.amountMinor]);
      await client.query(`INSERT INTO financial_outbox(id,effect_key,kind,subject_id,stripe_mode)
        VALUES($1,$2,'CREATE_CREDIT_INTENT',$3,$4)`,
      [randomUUID(), `purchase:${input.purchaseId}:intent`, input.purchaseId, this.stripeMode]);
    });
  }

  async beginBuyerBilling(buyerId: string): Promise<void> {
    uuid.parse(buyerId);
    await this.transaction(async (client) => {
      const account = await client.query<{ status: string; email_verified_at: Date | null }>(
        'SELECT status,email_verified_at FROM accounts WHERE id=$1 FOR SHARE', [buyerId]);
      if (account.rows[0]?.status !== 'ACTIVE' || !account.rows[0].email_verified_at) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      await client.query(`INSERT INTO buyer_billing_profiles(buyer_account_id,stripe_mode)
        VALUES($1,$2) ON CONFLICT(buyer_account_id) DO NOTHING`, [buyerId, this.stripeMode]);
      const row = await client.query<{ stripe_mode: string }>(
        'SELECT stripe_mode FROM buyer_billing_profiles WHERE buyer_account_id=$1', [buyerId]);
      if (row.rows[0]?.stripe_mode !== this.stripeMode) throw new FinanceError('CONFLICT');
      await client.query(`INSERT INTO financial_outbox(id,effect_key,kind,subject_id,stripe_mode)
        VALUES($1,$2,'CREATE_CUSTOMER',$3,$4) ON CONFLICT(effect_key) DO NOTHING`,
      [randomUUID(), `buyer:${buyerId}:customer`, buyerId, this.stripeMode]);
    });
  }

  private async buyerCustomer(buyerId: string): Promise<string> {
    const row = await this.pool.query<{ stripe_customer_id: string | null;
      stripe_mode: string }>('SELECT * FROM buyer_billing_profiles WHERE buyer_account_id=$1',
      [uuid.parse(buyerId)]);
    if (!row.rows[0]?.stripe_customer_id || row.rows[0].stripe_mode !== this.stripeMode) {
      throw new FinanceError('STRIPE_NOT_READY');
    }
    return row.rows[0].stripe_customer_id;
  }

  async createBuyerSetupIntent(buyerId: string, requestId: string,
    gateway: StripeGatewayPort): Promise<{ id: string; clientSecret: string }> {
    if (gateway.mode !== this.stripeMode) throw new FinanceError('CONFLICT');
    uuid.parse(requestId);
    const customer = await this.buyerCustomer(buyerId);
    return gateway.createSetupIntent(customer, `buyer:${buyerId}:setup:${requestId}`);
  }

  async creditPurchaseClientSecret(buyerId: string, purchaseId: string,
    gateway: StripeGatewayPort): Promise<string> {
    if (gateway.mode !== this.stripeMode) throw new FinanceError('CONFLICT');
    const purchase = await this.pool.query<{ buyer_account_id: string;
      stripe_payment_intent_id: string | null; state: string }>(
      'SELECT * FROM credit_purchases WHERE id=$1', [uuid.parse(purchaseId)]);
    if (purchase.rows[0]?.buyer_account_id !== uuid.parse(buyerId) ||
      !purchase.rows[0].stripe_payment_intent_id ||
      !['REQUESTED','PROCESSING'].includes(purchase.rows[0].state)) throw new FinanceError('NOT_ELIGIBLE');
    const intent = await gateway.retrievePaymentIntent(purchase.rows[0].stripe_payment_intent_id);
    if (intent.customerId !== await this.buyerCustomer(buyerId) ||
      intent.metadata.kivro_purchase_id !== purchaseId || !intent.clientSecret) {
      throw new FinanceError('CONFLICT');
    }
    return intent.clientSecret;
  }

  async setBuyerDefaultPaymentMethod(buyerId: string, paymentMethodId: string,
    requestId: string, gateway: StripeGatewayPort): Promise<void> {
    if (gateway.mode !== this.stripeMode) throw new FinanceError('CONFLICT');
    uuid.parse(requestId);
    const customer = await this.buyerCustomer(buyerId);
    const method = await gateway.retrievePaymentMethod(paymentMethodId);
    if (method.customerId !== customer || method.mode !== this.stripeMode) {
      throw new FinanceError('NOT_ELIGIBLE');
    }
    await gateway.setDefaultPaymentMethod(customer, method.id,
      `buyer:${buyerId}:default:${requestId}`);
    await this.pool.query(`UPDATE buyer_billing_profiles SET default_payment_method_id=$2,
      updated_at=now() WHERE buyer_account_id=$1 AND stripe_customer_id=$3`,
    [buyerId, method.id, customer]);
  }

  async detachBuyerPaymentMethod(buyerId: string, paymentMethodId: string,
    requestId: string, gateway: StripeGatewayPort): Promise<void> {
    if (gateway.mode !== this.stripeMode) throw new FinanceError('CONFLICT');
    uuid.parse(requestId);
    const customer = await this.buyerCustomer(buyerId);
    const method = await gateway.retrievePaymentMethod(paymentMethodId);
    if (method.customerId !== customer || method.mode !== this.stripeMode) {
      throw new FinanceError('NOT_ELIGIBLE');
    }
    await gateway.detachPaymentMethod(method.id, `buyer:${buyerId}:detach:${requestId}`);
    await this.pool.query(`UPDATE buyer_billing_profiles SET default_payment_method_id=NULL,
      updated_at=now() WHERE buyer_account_id=$1 AND default_payment_method_id=$2`,
    [buyerId, method.id]);
  }

  async beginSellerConnect(sellerId: string, sellerAccountId: string, country: string): Promise<void> {
    uuid.parse(sellerId); uuid.parse(sellerAccountId);
    z.string().regex(/^[A-Z]{2}$/).parse(country);
    await this.transaction(async (client) => {
      const seller = await client.query<{ account_id: string; status: string;
        email_verified_at: Date | null }>(`SELECT s.account_id,s.status,a.email_verified_at
        FROM seller_profiles s JOIN accounts a ON a.id=s.account_id WHERE s.id=$1 FOR UPDATE OF s`, [sellerId]);
      if (seller.rows[0]?.account_id !== sellerAccountId || seller.rows[0]?.status === 'SUSPENDED' ||
        !seller.rows[0].email_verified_at) throw new FinanceError('NOT_ELIGIBLE');
      const existing = await client.query<{ stripe_mode: string; country: string | null }>(
        'SELECT stripe_mode,country FROM seller_connect_profiles WHERE seller_profile_id=$1', [sellerId]);
      if (existing.rows[0]) {
        if (existing.rows[0].stripe_mode !== this.stripeMode || existing.rows[0].country !== country) {
          throw new FinanceError('CONFLICT');
        }
        return;
      }
      await client.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_mode,
        onboarding_status,country) VALUES($1,$2,'NOT_STARTED',$3)`, [sellerId, this.stripeMode, country]);
      await client.query(`INSERT INTO financial_outbox(id,effect_key,kind,subject_id,stripe_mode)
        VALUES($1,$2,'CREATE_CONNECT_ACCOUNT',$3,$4)`,
      [randomUUID(), `seller:${sellerId}:connect`, sellerId, this.stripeMode]);
    });
  }

  async sellerOnboardingLink(sellerId: string, sellerAccountId: string,
    gateway: StripeGatewayPort, refreshUrl: string, returnUrl: string): Promise<string> {
    if (gateway.mode !== this.stripeMode) throw new FinanceError('CONFLICT');
    const row = await this.pool.query<{ account_id: string; stripe_account_id: string | null;
      stripe_mode: string }>(`SELECT s.account_id,c.stripe_account_id,c.stripe_mode
      FROM seller_profiles s JOIN seller_connect_profiles c ON c.seller_profile_id=s.id
      WHERE s.id=$1`, [uuid.parse(sellerId)]);
    if (row.rows[0]?.account_id !== uuid.parse(sellerAccountId) ||
      row.rows[0].stripe_mode !== this.stripeMode || !row.rows[0].stripe_account_id) {
      throw new FinanceError('NOT_ELIGIBLE');
    }
    return (await gateway.createOnboardingLink({ accountId: row.rows[0].stripe_account_id,
      refreshUrl, returnUrl })).url;
  }

  /** Signature is checked on raw bytes before the normalized event is durably inserted. */
  async receiveStripeWebhook(raw: Buffer, header: string, secret: string): Promise<string> {
    const event = verifyStripeWebhook(raw, header, secret, this.stripeMode);
    await this.pool.query(`INSERT INTO stripe_inbox(event_id,stripe_mode,event_type,object_id,
      object_type,connected_account_id,provider_created_at,payload_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(event_id) DO NOTHING`,
    [event.id, event.mode, event.type, event.objectId, event.objectType,
      event.connectedAccountId, event.createdAt, event.payloadHash]);
    const stored = await this.pool.query<{ payload_hash: string; stripe_mode: string }>(
      'SELECT payload_hash,stripe_mode FROM stripe_inbox WHERE event_id=$1', [event.id]);
    if (stored.rows[0]?.payload_hash !== event.payloadHash || stored.rows[0]?.stripe_mode !== event.mode) {
      throw new FinanceError('CONFLICT');
    }
    return event.id;
  }

  /** Bounded cron process. Retry-safe Stripe keys survive a crash after the remote call. */
  async processFinancialOutbox(gateway: StripeGatewayPort, limit = 20): Promise<number> {
    if (gateway.mode !== this.stripeMode || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new FinanceError('CONFLICT');
    }
    const rows = await this.pool.query<{ id: string; effect_key: string; kind: string;
      subject_id: string }>(`SELECT id,effect_key,kind,subject_id FROM financial_outbox
      WHERE state IN ('PENDING','FAILED') AND next_attempt_at<=now()
      ORDER BY created_at LIMIT $1`, [limit]);
    let done = 0;
    for (const row of rows.rows) {
      try {
        if (row.kind === 'CREATE_CREDIT_INTENT') await this.executeCreditIntent(gateway, row.subject_id);
        else if (row.kind === 'CREATE_CUSTOMER') await this.executeCustomer(gateway, row.subject_id);
        else if (row.kind === 'CREATE_CONNECT_ACCOUNT') await this.executeConnectAccount(gateway, row.subject_id);
        else if (row.kind === 'CREATE_TRANSFER') await this.executeTransfer(gateway, row.subject_id);
        else if (row.kind === 'REVERSE_TRANSFER') await this.executeTransferReversal(gateway, row.subject_id);
        else throw new FinanceError('NOT_ELIGIBLE');
        await this.pool.query(`UPDATE financial_outbox SET state='DONE',completed_at=now(),
          attempts=attempts+1,last_error_code=NULL WHERE id=$1`, [row.id]);
        done++;
      } catch (error) {
        await this.pool.query(`UPDATE financial_outbox SET state='FAILED',attempts=attempts+1,
          next_attempt_at=now()+make_interval(secs=>least(3600,30*(attempts+1))),
          last_error_code=$2 WHERE id=$1`, [row.id,
          error instanceof FinanceError ? error.code : 'STRIPE_RETRYABLE']);
      }
    }
    return done;
  }

  private async executeCreditIntent(gateway: StripeGatewayPort, purchaseId: string): Promise<void> {
    const result = await this.pool.query<{ buyer_account_id: string; amount_minor: string;
      state: string; stripe_payment_intent_id: string | null; primary_email: string;
      stripe_customer_id: string | null }>(`SELECT p.*,a.primary_email,b.stripe_customer_id
      FROM credit_purchases p JOIN accounts a ON a.id=p.buyer_account_id
      JOIN buyer_billing_profiles b ON b.buyer_account_id=p.buyer_account_id
      WHERE p.id=$1`, [purchaseId]);
    const purchase = result.rows[0];
    if (!purchase) throw new FinanceError('NOT_FOUND');
    if (purchase.stripe_payment_intent_id || purchase.state === 'SUCCEEDED') return;
    const customer = purchase.stripe_customer_id ?? (await gateway.createCustomer(
      purchase.primary_email, `buyer:${purchase.buyer_account_id}:customer`)).id;
    await this.pool.query(`UPDATE buyer_billing_profiles SET stripe_customer_id=$2,
      billing_status='ACTIVE',updated_at=now() WHERE buyer_account_id=$1
      AND (stripe_customer_id IS NULL OR stripe_customer_id=$2)`, [purchase.buyer_account_id, customer]);
    const intent = await gateway.createCreditPaymentIntent({ customerId: customer,
      amountMinor: safeMinor(purchase.amount_minor), purchaseId,
      idempotencyKey: `purchase:${purchaseId}:payment-intent` });
    if (intent.customerId !== customer || intent.amountMinor !== safeMinor(purchase.amount_minor) ||
      intent.metadata.kivro_purchase_id !== purchaseId || intent.mode !== this.stripeMode) {
      throw new FinanceError('CONFLICT');
    }
    await this.pool.query(`UPDATE credit_purchases SET stripe_payment_intent_id=$2,
      state='PROCESSING',updated_at=now() WHERE id=$1 AND
      (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id=$2)`, [purchaseId, intent.id]);
    if (intent.status === 'succeeded') await this.confirmCreditPurchase({ purchaseId,
      paymentIntentId: intent.id, amountMinor: intent.amountMinor, currency: 'USD',
      stripeMode: intent.mode, customerId: customer });
  }

  private async executeCustomer(gateway: StripeGatewayPort, buyerId: string): Promise<void> {
    const row = await this.pool.query<{ primary_email: string; stripe_customer_id: string | null }>(`
      SELECT a.primary_email,b.stripe_customer_id FROM accounts a
      JOIN buyer_billing_profiles b ON b.buyer_account_id=a.id WHERE a.id=$1`, [buyerId]);
    if (!row.rows[0]) throw new FinanceError('NOT_FOUND');
    if (row.rows[0].stripe_customer_id) return;
    const customer = await gateway.createCustomer(row.rows[0].primary_email,
      `buyer:${buyerId}:customer`);
    await this.pool.query(`UPDATE buyer_billing_profiles SET stripe_customer_id=$2,
      billing_status='ACTIVE',updated_at=now() WHERE buyer_account_id=$1
      AND (stripe_customer_id IS NULL OR stripe_customer_id=$2)`, [buyerId, customer.id]);
  }

  private async executeConnectAccount(gateway: StripeGatewayPort, sellerId: string): Promise<void> {
    const row = await this.pool.query<{ stripe_account_id: string | null; country: string }>(
      'SELECT stripe_account_id,country FROM seller_connect_profiles WHERE seller_profile_id=$1', [sellerId]);
    if (!row.rows[0]) throw new FinanceError('NOT_FOUND');
    if (row.rows[0].stripe_account_id) return;
    const account = await gateway.createConnectAccount({ country: row.rows[0].country,
      idempotencyKey: `seller:${sellerId}:connect-account` });
    await this.pool.query(`UPDATE seller_connect_profiles SET stripe_account_id=$2,
      onboarding_status='IN_PROGRESS',updated_at=now() WHERE seller_profile_id=$1
      AND (stripe_account_id IS NULL OR stripe_account_id=$2)`, [sellerId, account.id]);
  }

  private async reconcilePaymentIntent(gateway: StripeGatewayPort, intent: StripePaymentIntent):
    Promise<void> {
    if (intent.mode !== this.stripeMode || intent.currency !== 'usd') throw new FinanceError('CONFLICT');
    const purchaseId = uuid.parse(intent.metadata.kivro_purchase_id);
    const result = await this.pool.query<{ amount_minor: string; state: string;
      stripe_payment_intent_id: string | null; stripe_mode: string }>(
      'SELECT * FROM credit_purchases WHERE id=$1', [purchaseId]);
    const purchase = result.rows[0];
    if (!purchase || purchase.stripe_mode !== this.stripeMode ||
      safeMinor(purchase.amount_minor) !== intent.amountMinor) throw new FinanceError('CONFLICT');
    if (purchase.stripe_payment_intent_id === null) {
      await this.pool.query(`UPDATE credit_purchases SET stripe_payment_intent_id=$2,
        state='PROCESSING' WHERE id=$1 AND stripe_payment_intent_id IS NULL`, [purchaseId, intent.id]);
    } else if (purchase.stripe_payment_intent_id !== intent.id) throw new FinanceError('CONFLICT');
    if (intent.status === 'succeeded') await this.confirmCreditPurchase({ purchaseId,
      paymentIntentId: intent.id, amountMinor: intent.amountMinor,
      currency: 'USD', stripeMode: intent.mode, customerId: intent.customerId ?? '' });
    else if (intent.status === 'canceled') {
      await this.pool.query(`UPDATE credit_purchases SET state=$2,updated_at=now()
        WHERE id=$1 AND state IN ('REQUESTED','PROCESSING')`,
      [purchaseId, 'CANCELED']);
    }
    if (intent.status === 'succeeded' && intent.latestChargeId) {
      await this.reconcileStripeProcessingFee(gateway, purchaseId, intent);
    }
  }

  private async reconcilePurchaseWithStripe(gateway: StripeGatewayPort,
    intent: StripePaymentIntent): Promise<void> {
    await this.reconcilePaymentIntent(gateway, intent);
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await gateway.listRefunds(intent.id, cursor);
      for (const refund of result.refunds) await this.reconcileCreditRefund(refund);
      if (!result.hasMore) {
        await this.pool.query(`UPDATE credit_purchases SET last_reconciled_at=now()
          WHERE id=$1`, [uuid.parse(intent.metadata.kivro_purchase_id)]);
        return;
      }
      cursor = result.refunds.at(-1)!.id;
    }
    throw new FinanceError('CONFLICT');
  }

  /** Processor fees are platform expense, not a deduction from a seller's fixed tier share. */
  private async reconcileStripeProcessingFee(gateway: StripeGatewayPort, purchaseId: string,
    intent: StripePaymentIntent): Promise<boolean> {
    if (!intent.latestChargeId) return false;
    const charge = await gateway.retrieveCharge(intent.latestChargeId);
    if (charge.mode !== this.stripeMode || charge.paymentIntentId !== intent.id ||
      charge.amountMinor !== intent.amountMinor || charge.currency !== 'usd') {
      throw new FinanceError('CONFLICT');
    }
    if (!charge.balanceTransactionId) return false;
    const balanceTransaction = await gateway.retrieveBalanceTransaction(charge.balanceTransactionId);
    if (balanceTransaction.mode !== this.stripeMode || balanceTransaction.currency !== 'usd' ||
      balanceTransaction.sourceChargeId !== charge.id ||
      !Number.isSafeInteger(balanceTransaction.feeMinor) ||
      balanceTransaction.feeMinor < 0 || balanceTransaction.feeMinor > 1_000_000_000) {
      throw new FinanceError('CONFLICT');
    }
    return this.transaction(async (client) => {
      const purchase = await client.query<{ state: string; stripe_payment_intent_id: string;
        stripe_charge_id: string | null; amount_minor: string }>(
        'SELECT * FROM credit_purchases WHERE id=$1 FOR UPDATE', [purchaseId]);
      const row = purchase.rows[0];
      if (!row || !['SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED'].includes(row.state) ||
        row.stripe_payment_intent_id !== intent.id ||
        safeMinor(row.amount_minor) !== charge.amountMinor ||
        row.stripe_charge_id && row.stripe_charge_id !== charge.id) throw new FinanceError('CONFLICT');
      const existing = await client.query<{ stripe_balance_transaction_id: string;
        fee_minor: string }>('SELECT * FROM stripe_processing_fees WHERE credit_purchase_id=$1',
        [purchaseId]);
      if (existing.rows[0]) {
        if (existing.rows[0].stripe_balance_transaction_id !== balanceTransaction.id ||
          safeMinor(existing.rows[0].fee_minor) !== balanceTransaction.feeMinor) {
          throw new FinanceError('CONFLICT');
        }
        return false;
      }
      const journalId = balanceTransaction.feeMinor > 0 ? await this.journal(client, {
        effectKey: `stripe:charge:${charge.id}:processing-fee`, kind: 'PROCESSING_FEE', jobId: null,
        movements: balanced([
          { account: platformAccountKey('processing_expense'),
            amountMinor: -balanceTransaction.feeMinor },
          { account: platformAccountKey('clearing'), amountMinor: balanceTransaction.feeMinor },
        ]),
      }) : null;
      await client.query(`INSERT INTO stripe_processing_fees(stripe_charge_id,credit_purchase_id,
        stripe_balance_transaction_id,fee_minor,currency,journal_id)
        VALUES($1,$2,$3,$4,'USD',$5)`, [charge.id,purchaseId,balanceTransaction.id,
        balanceTransaction.feeMinor,journalId]);
      await client.query(`UPDATE credit_purchases SET stripe_charge_id=$2,updated_at=now()
        WHERE id=$1`, [purchaseId,charge.id]);
      return true;
    });
  }

  /** A late Stripe balance transaction is revisited even after its webhook is acknowledged. */
  async reconcileStripeProcessingFees(gateway: StripeGatewayPort, limit = 20): Promise<number> {
    if (gateway.mode !== this.stripeMode || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new FinanceError('CONFLICT');
    }
    const purchases = await this.pool.query<{ id: string; stripe_payment_intent_id: string }>(`
      SELECT p.id,p.stripe_payment_intent_id FROM credit_purchases p
      LEFT JOIN stripe_processing_fees f ON f.credit_purchase_id=p.id
      WHERE p.state IN ('SUCCEEDED','DISPUTED') AND f.credit_purchase_id IS NULL
        AND p.stripe_payment_intent_id IS NOT NULL ORDER BY p.created_at LIMIT $1`, [limit]);
    let recorded = 0;
    for (const purchase of purchases.rows) {
      const intent = await gateway.retrievePaymentIntent(purchase.stripe_payment_intent_id);
      if (intent.mode !== this.stripeMode || intent.status !== 'succeeded' ||
        intent.metadata.kivro_purchase_id !== purchase.id) throw new FinanceError('CONFLICT');
      if (await this.reconcileStripeProcessingFee(gateway, purchase.id, intent)) recorded++;
    }
    return recorded;
  }

  private async reconcileConnectAccount(account: StripeConnectAccount): Promise<void> {
    if (account.mode !== this.stripeMode) throw new FinanceError('CONFLICT');
    const row = await this.pool.query<{ seller_profile_id: string }>(
      'SELECT seller_profile_id FROM seller_connect_profiles WHERE stripe_account_id=$1 AND stripe_mode=$2',
      [account.id, this.stripeMode]);
    if (!row.rows[0]) throw new FinanceError('NOT_FOUND');
    const status = account.transfersEnabled && account.payoutsEnabled && account.detailsSubmitted &&
      account.requirementsDue.length === 0 ? 'READY' :
      account.requirementsDue.length ? 'ACTION_REQUIRED' : 'IN_PROGRESS';
    await this.transaction(async (client) => {
      await client.query(`UPDATE seller_connect_profiles SET onboarding_status=$2,
        transfers_enabled=$3,payouts_enabled=$4,requirements_due=$5,
        country=$6,last_reconciled_at=now(),updated_at=now() WHERE seller_profile_id=$1`,
      [row.rows[0]!.seller_profile_id, status, account.transfersEnabled,
        account.payoutsEnabled, JSON.stringify(account.requirementsDue), account.country]);
      await client.query('UPDATE seller_profiles SET payout_status=$2 WHERE id=$1',
        [row.rows[0]!.seller_profile_id, status]);
    });
  }

  /** Periodic provider comparison also detects webhooks lost outside Stripe's retry window. */
  async reconcileStripeProviderState(gateway: StripeGatewayPort, limit = 20):
    Promise<{ purchases: number; sellers: number }> {
    if (gateway.mode !== this.stripeMode || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new FinanceError('CONFLICT');
    }
    const purchases = await this.pool.query<{ id: string; stripe_payment_intent_id: string }>(`
      SELECT id,stripe_payment_intent_id FROM credit_purchases
      WHERE stripe_mode=$1 AND stripe_payment_intent_id IS NOT NULL
        AND state IN ('PROCESSING','SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED')
      ORDER BY last_reconciled_at NULLS FIRST,created_at LIMIT $2`, [this.stripeMode,limit]);
    let purchaseCount = 0;
    for (const row of purchases.rows) {
      const intent = await gateway.retrievePaymentIntent(row.stripe_payment_intent_id);
      await this.reconcilePurchaseWithStripe(gateway, intent);
      purchaseCount++;
    }
    const sellers = await this.pool.query<{ stripe_account_id: string }>(`
      SELECT stripe_account_id FROM seller_connect_profiles
      WHERE stripe_mode=$1 AND stripe_account_id IS NOT NULL
      ORDER BY last_reconciled_at NULLS FIRST,updated_at LIMIT $2`, [this.stripeMode,limit]);
    for (const row of sellers.rows) {
      await this.reconcileConnectAccount(await gateway.retrieveConnectAccount(row.stripe_account_id));
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const result = await gateway.listPayouts(row.stripe_account_id, cursor);
        for (const payout of result.payouts) await this.confirmSellerPayout(payout);
        if (!result.hasMore) break;
        if (page === 9) throw new FinanceError('CONFLICT');
        cursor = result.payouts.at(-1)!.id;
      }
    }
    return { purchases: purchaseCount, sellers: sellers.rows.length };
  }

  /** A disputed credit purchase freezes further paid reservation; buyer credits are not
   * silently erased after they may already have funded delivered jobs. Platform loss is journalled. */
  private async reconcileDispute(dispute: StripeDispute): Promise<void> {
    if (dispute.mode !== this.stripeMode || dispute.currency !== 'usd' ||
      !dispute.paymentIntentId) throw new FinanceError('CONFLICT');
    await this.transaction(async (client) => {
      const purchase = await client.query<{ id: string; buyer_account_id: string;
        amount_minor: string; state: string }>(
        'SELECT * FROM credit_purchases WHERE stripe_payment_intent_id=$1 FOR UPDATE',
        [dispute.paymentIntentId]);
      const row = purchase.rows[0];
      if (!row || !['SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED'].includes(row.state) ||
        dispute.amountMinor > safeMinor(row.amount_minor)) throw new FinanceError('CONFLICT');
      const prior = await client.query<{ state: string; amount_minor: string;
        credit_purchase_id: string; loss_journal_id: string | null;
        recovery_journal_id: string | null }>(
        'SELECT * FROM stripe_disputes WHERE id=$1 FOR UPDATE', [dispute.id]);
      if (prior.rows[0] && (prior.rows[0].credit_purchase_id !== row.id ||
        safeMinor(prior.rows[0].amount_minor) !== dispute.amountMinor)) {
        throw new FinanceError('CONFLICT');
      }
      if (!prior.rows[0]) {
        await client.query(`INSERT INTO stripe_disputes(id,credit_purchase_id,stripe_mode,
          amount_minor,currency,state) VALUES($1,$2,$3,$4,'USD','OPEN')`,
        [dispute.id, row.id, this.stripeMode, dispute.amountMinor]);
      }
      if (dispute.status === 'LOST' && !prior.rows[0]?.loss_journal_id) {
        const id = await this.journal(client, { effectKey: `stripe:dispute:${dispute.id}:loss`,
          kind: 'DISPUTE_LOSS', jobId: null, movements: balanced([
            { account: platformAccountKey('clearing'), amountMinor: dispute.amountMinor },
            { account: platformAccountKey('dispute_loss'), amountMinor: -dispute.amountMinor },
          ]) });
        await client.query(`UPDATE stripe_disputes SET loss_journal_id=$2 WHERE id=$1`,
          [dispute.id, id]);
      }
      if (dispute.status === 'WON' && prior.rows[0]?.loss_journal_id &&
        !prior.rows[0].recovery_journal_id) {
        const id = await this.journal(client, { effectKey: `stripe:dispute:${dispute.id}:recovery`,
          kind: 'DISPUTE_RECOVERY', jobId: null, movements: balanced([
            { account: platformAccountKey('clearing'), amountMinor: -dispute.amountMinor },
            { account: platformAccountKey('dispute_loss'), amountMinor: dispute.amountMinor },
          ]) });
        await client.query(`UPDATE stripe_disputes SET recovery_journal_id=$2 WHERE id=$1`,
          [dispute.id, id]);
      }
      await client.query(`UPDATE stripe_disputes SET state=$2,updated_at=now() WHERE id=$1`,
        [dispute.id, dispute.status]);
      // A later dispute event must not erase the independently reconciled card-refund state.
      if (row.state !== 'PARTIALLY_REFUNDED' && row.state !== 'REFUNDED') {
        await client.query(`UPDATE credit_purchases SET state=$2,updated_at=now() WHERE id=$1`,
          [row.id, dispute.status === 'WON' ? 'SUCCEEDED' : 'DISPUTED']);
      }
      const open = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM stripe_disputes d
        JOIN credit_purchases p ON p.id=d.credit_purchase_id
        WHERE p.buyer_account_id=$1 AND d.state IN ('OPEN','LOST')`, [row.buyer_account_id]);
      const refunds = await client.query<{ n: number }>(`SELECT count(*)::int AS n
        FROM stripe_credit_refunds r JOIN credit_purchases p ON p.id=r.credit_purchase_id
        WHERE p.buyer_account_id=$1 AND r.status IN ('PENDING','SUCCEEDED')`,
      [row.buyer_account_id]);
      await client.query(`UPDATE buyer_billing_profiles SET billing_status=$2,updated_at=now()
      WHERE buyer_account_id=$1`, [row.buyer_account_id,
        (open.rows[0]?.n ?? 0) > 0 ? 'DISPUTED' :
        (refunds.rows[0]?.n ?? 0) > 0 ? 'REFUND_REVIEW' : 'ACTIVE']);
    });
  }

  /** An external card refund cannot silently leave refundable credits spendable. If credits
   * were already spent, the platform records the shortfall and freezes further paid jobs. */
  private async reconcileCreditRefund(refund: StripeRefund): Promise<void> {
    if (refund.mode !== this.stripeMode || refund.currency !== 'usd') throw new FinanceError('CONFLICT');
    await this.transaction(async (client) => {
      const purchases = await client.query<{ id: string; buyer_account_id: string;
        stripe_charge_id: string | null; amount_minor: string; state: string }>(
        'SELECT * FROM credit_purchases WHERE stripe_payment_intent_id=$1 FOR UPDATE',
        [refund.paymentIntentId]);
      const purchase = purchases.rows[0];
      if (!purchase || !['SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED'].includes(purchase.state) ||
        refund.amountMinor > safeMinor(purchase.amount_minor) ||
        purchase.stripe_charge_id && refund.chargeId !== purchase.stripe_charge_id) {
        throw new FinanceError('CONFLICT');
      }
      const prior = await client.query<{ credit_purchase_id: string; amount_minor: string;
        status: string; stripe_charge_id: string | null; journal_id: string | null }>(
        'SELECT * FROM stripe_credit_refunds WHERE stripe_refund_id=$1 FOR UPDATE', [refund.id]);
      if (prior.rows[0] && (prior.rows[0].credit_purchase_id !== purchase.id ||
        safeMinor(prior.rows[0].amount_minor) !== refund.amountMinor ||
        prior.rows[0].stripe_charge_id !== refund.chargeId)) throw new FinanceError('CONFLICT');
      if (!prior.rows[0]) await client.query(`INSERT INTO stripe_credit_refunds
        (stripe_refund_id,credit_purchase_id,stripe_charge_id,amount_minor,currency,status)
        VALUES($1,$2,$3,$4,'USD','PENDING')`,
      [refund.id,purchase.id,refund.chargeId,refund.amountMinor]);
      if (refund.status === 'succeeded' && !prior.rows[0]?.journal_id) {
        const refunded = await client.query<{ amount: string }>(`SELECT
          coalesce(sum(amount_minor),0)::text AS amount FROM stripe_credit_refunds
          WHERE credit_purchase_id=$1 AND journal_id IS NOT NULL`, [purchase.id]);
        const total = safeMinor(refunded.rows[0]?.amount ?? '0') + refund.amountMinor;
        if (total > safeMinor(purchase.amount_minor)) throw new FinanceError('CONFLICT');
        const availableKey = buyerAccountKey(purchase.buyer_account_id, 'available');
        await this.lockAccounts(client, [availableKey]);
        const debit = Math.min(await this.balance(client, availableKey), refund.amountMinor);
        const shortfall = refund.amountMinor - debit;
        const journalId = await this.journal(client, {
          effectKey: `stripe:refund:${refund.id}`, kind: 'STRIPE_CREDIT_REFUND', jobId: null,
          movements: balanced([
            ...(debit ? [{ account: availableKey, amountMinor: -debit }] : []),
            ...(shortfall ? [{ account: platformAccountKey('refund_loss'),
              amountMinor: -shortfall }] : []),
            { account: platformAccountKey('clearing'), amountMinor: refund.amountMinor },
          ]),
        });
        await client.query(`UPDATE stripe_credit_refunds SET status='SUCCEEDED',
          journal_id=$2,updated_at=now() WHERE stripe_refund_id=$1`, [refund.id,journalId]);
        await client.query(`UPDATE credit_purchases SET state=$2,updated_at=now() WHERE id=$1`,
          [purchase.id,total === safeMinor(purchase.amount_minor) ? 'REFUNDED' : 'PARTIALLY_REFUNDED']);
      } else if (!prior.rows[0]?.journal_id) {
        await client.query(`UPDATE stripe_credit_refunds SET status=$2,updated_at=now()
          WHERE stripe_refund_id=$1`, [refund.id, refund.status.toUpperCase()]);
      } else if (refund.status !== 'succeeded') throw new FinanceError('CONFLICT');
      const unresolved = await client.query<{ n: number }>(`SELECT count(*)::int AS n
        FROM stripe_credit_refunds WHERE credit_purchase_id=$1 AND status IN ('PENDING','SUCCEEDED')`,
      [purchase.id]);
      const disputed = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM stripe_disputes d
        JOIN credit_purchases p ON p.id=d.credit_purchase_id
        WHERE p.buyer_account_id=$1 AND d.state IN ('OPEN','LOST')`, [purchase.buyer_account_id]);
      await client.query(`UPDATE buyer_billing_profiles SET billing_status=$2,updated_at=now()
        WHERE buyer_account_id=$1`, [purchase.buyer_account_id,
        (disputed.rows[0]?.n ?? 0) > 0 ? 'DISPUTED' :
        (unresolved.rows[0]?.n ?? 0) > 0 ? 'REFUND_REVIEW' : 'ACTIVE']);
    });
  }

  /** Inbox order is irrelevant: each item fetches the provider's current object state. */
  async reconcileStripeInbox(gateway: StripeGatewayPort, limit = 20): Promise<number> {
    if (gateway.mode !== this.stripeMode || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new FinanceError('CONFLICT');
    }
    const events = await this.pool.query<{ event_id: string; object_type: string;
      object_id: string; connected_account_id: string | null }>(`SELECT * FROM stripe_inbox
      WHERE processed_at IS NULL ORDER BY received_at LIMIT $1`, [limit]);
    let done = 0;
    for (const event of events.rows) {
      try {
        if (event.object_type === 'payment_intent') {
          await this.reconcilePurchaseWithStripe(gateway,
            await gateway.retrievePaymentIntent(event.object_id));
        } else if (event.object_type === 'account') {
          await this.reconcileConnectAccount(await gateway.retrieveConnectAccount(event.object_id));
        } else if (event.object_type === 'transfer') {
          await this.confirmSellerTransfer(await gateway.retrieveTransfer(event.object_id));
        } else if (event.object_type === 'payout' && event.connected_account_id) {
          await this.confirmSellerPayout(await gateway.retrievePayout(event.object_id,
            event.connected_account_id));
        } else if (event.object_type === 'dispute') {
          const dispute = await gateway.retrieveDispute(event.object_id);
          if (dispute.paymentIntentId) {
            await this.reconcilePurchaseWithStripe(gateway,
              await gateway.retrievePaymentIntent(dispute.paymentIntentId));
          }
          await this.reconcileDispute(dispute);
        } else if (event.object_type === 'refund') {
          const refund = await gateway.retrieveRefund(event.object_id);
          await this.reconcilePurchaseWithStripe(gateway,
            await gateway.retrievePaymentIntent(refund.paymentIntentId));
          await this.reconcileCreditRefund(refund);
        } else throw new FinanceError('NOT_ELIGIBLE');
        await this.pool.query(`UPDATE stripe_inbox SET processed_at=now(),processing_error=NULL
          WHERE event_id=$1`, [event.event_id]);
        done++;
      } catch (error) {
        await this.pool.query('UPDATE stripe_inbox SET processing_error=$2 WHERE event_id=$1',
          [event.event_id, error instanceof FinanceError ? error.code : 'STRIPE_RETRYABLE']);
      }
    }
    return done;
  }

  /** Test-only funding still goes through the same journal, never through a balance field. */
  async recordTestCreditPurchase(buyerId: string, amountMinor: number, testReference: string): Promise<void> {
    if (this.stripeMode !== 'test' || process.env.NODE_ENV === 'production' ||
      !testReference.startsWith('test-only:')) throw new FinanceError('NOT_ELIGIBLE');
    uuid.parse(buyerId); MinorAmountSchema.positive().parse(amountMinor);
    await this.transaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM financial_journals WHERE effect_key=$1', [testReference]);
      if (existing.rows[0]) {
        const rows = await client.query<{ account_key: string; amount_minor: string }>(
          'SELECT account_key,amount_minor FROM financial_entries WHERE journal_id=$1',
          [existing.rows[0].id]);
        if (rows.rowCount !== 2 || !rows.rows.some((row) =>
          row.account_key === buyerAccountKey(buyerId, 'available') &&
          Number(row.amount_minor) === amountMinor)) throw new FinanceError('CONFLICT');
        return;
      }
      const buyer = await client.query<{ status: string; email_verified_at: Date | null }>(
        'SELECT status,email_verified_at FROM accounts WHERE id=$1 FOR SHARE', [buyerId]);
      if (buyer.rows[0]?.status !== 'ACTIVE' || !buyer.rows[0].email_verified_at) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      await client.query(`INSERT INTO buyer_billing_profiles(buyer_account_id,stripe_mode,billing_status)
        VALUES($1,'test','ACTIVE') ON CONFLICT(buyer_account_id) DO NOTHING`, [buyerId]);
      await this.journal(client, { effectKey: testReference, kind: 'CREDIT_PURCHASE', jobId: null,
        movements: purchaseMovements(buyerId, amountMinor) });
    });
  }

  /** M07 invokes this inside its job-locked transaction; the Worker cannot implement it. */
  async isSecured(client: PoolClient, jobId: string, reservationId: string): Promise<boolean> {
    const result = await client.query<ReservationRow & { buyer_price_minor: string; buyer_total_minor: string;
      job_buyer: string; job_reservation: string | null; payment_state: string;
      billing_status: string; stripe_mode: string; journal_kind: string;
      journal_effect_key: string; journal_job_id: string | null;
      seller_status: string; payout_status: string; connect_status: string;
      connect_mode: string; transfers_enabled: boolean; payouts_enabled: boolean;
      connect_reconciled_at: Date | null }>(`
      SELECT r.*,s.buyer_price_minor,s.buyer_total_minor,j.buyer_account_id AS job_buyer,
        j.payment_reservation_id AS job_reservation,p.state AS payment_state,
        b.billing_status,b.stripe_mode,f.kind AS journal_kind,
        f.effect_key AS journal_effect_key,f.job_id AS journal_job_id,
        seller.status AS seller_status,seller.payout_status,
        c.onboarding_status AS connect_status,c.stripe_mode AS connect_mode,
        c.transfers_enabled,c.payouts_enabled,c.last_reconciled_at AS connect_reconciled_at
      FROM payment_reservations r JOIN job_financial_snapshots s ON s.job_id=r.job_id
      JOIN jobs j ON j.id=r.job_id JOIN job_payment_states p ON p.job_id=r.job_id
      JOIN buyer_billing_profiles b ON b.buyer_account_id=r.buyer_account_id
      JOIN financial_journals f ON f.id=r.reserve_journal_id
      JOIN seller_profiles seller ON seller.id=s.seller_profile_id
      JOIN seller_connect_profiles c ON c.seller_profile_id=s.seller_profile_id
      WHERE r.id=$1 AND r.job_id=$2 FOR SHARE OF r,p,b,seller,c`,
    [uuid.parse(reservationId), uuid.parse(jobId)]);
    const row = result.rows[0];
    if (!row || row.state !== 'RESERVED' || row.payment_state !== 'RESERVED' ||
      row.job_buyer !== row.buyer_account_id || row.job_reservation !== row.id ||
      row.billing_status !== 'ACTIVE' || row.stripe_mode !== this.stripeMode ||
      row.journal_kind !== 'RESERVE' || row.journal_job_id !== jobId ||
      row.journal_effect_key !== `job:${jobId}:reserve` ||
      row.seller_status !== 'ACTIVE' || row.payout_status !== 'READY' ||
      row.connect_status !== 'READY' || row.connect_mode !== this.stripeMode ||
      !row.transfers_enabled || !row.payouts_enabled ||
      !row.connect_reconciled_at ||
      row.connect_reconciled_at.getTime() < Date.now()-3_600_000 ||
      safeMinor(row.amount_minor) !== safeMinor(row.buyer_total_minor)) return false;
    const stalePurchases = await client.query<{ n: number }>(`SELECT count(*)::int AS n
      FROM credit_purchases WHERE buyer_account_id=$1 AND stripe_mode=$2
        AND state IN ('SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED')
        AND (last_reconciled_at IS NULL OR last_reconciled_at < now()-interval '24 hours')`,
    [row.buyer_account_id,this.stripeMode]);
    if ((stalePurchases.rows[0]?.n ?? 0) > 0) return false;
    const entries = await client.query<{ account_key: string; amount_minor: string }>(
      'SELECT account_key,amount_minor FROM financial_entries WHERE journal_id=$1', [row.reserve_journal_id]);
    return entries.rowCount === 2 && entries.rows.some((entry) =>
      entry.account_key === buyerAccountKey(row.buyer_account_id, 'reserved') &&
      Number(entry.amount_minor) === safeMinor(row.amount_minor)) && entries.rows.some((entry) =>
      entry.account_key === buyerAccountKey(row.buyer_account_id, 'available') &&
      Number(entry.amount_minor) === -safeMinor(row.amount_minor));
  }

  async reserveJob(jobId: string, buyerId: string, reservationId: string): Promise<string> {
    uuid.parse(jobId); uuid.parse(buyerId); uuid.parse(reservationId);
    return this.transaction((client) => this.reserveJobInTransaction(client, jobId, buyerId, reservationId));
  }

  /** Availability owns admission; finance owns this ledger mutation in the same database transaction. */
  async reserveJobInTransaction(client: PoolClient, jobId: string, buyerId: string,
    reservationId: string): Promise<string> {
      uuid.parse(jobId); uuid.parse(buyerId); uuid.parse(reservationId);
      const job = await this.job(client, jobId);
      if (job.buyer_account_id !== buyerId) throw new FinanceError('NOT_ELIGIBLE');
      const buyer = await client.query<{ status: string; email_verified_at: Date | null;
        billing_status: string | null; stripe_mode: string | null }>(`SELECT a.status,
        a.email_verified_at,b.billing_status,b.stripe_mode FROM accounts a
        LEFT JOIN buyer_billing_profiles b ON b.buyer_account_id=a.id WHERE a.id=$1`, [buyerId]);
      if (buyer.rows[0]?.status !== 'ACTIVE' || !buyer.rows[0].email_verified_at ||
        buyer.rows[0].billing_status !== 'ACTIVE' || buyer.rows[0].stripe_mode !== this.stripeMode) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      const stalePurchases = await client.query<{ n: number }>(`SELECT count(*)::int AS n
        FROM credit_purchases WHERE buyer_account_id=$1 AND stripe_mode=$2
          AND state IN ('SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED')
          AND (last_reconciled_at IS NULL OR last_reconciled_at < now()-interval '24 hours')`,
      [buyerId,this.stripeMode]);
      if ((stalePurchases.rows[0]?.n ?? 0) > 0) throw new FinanceError('STRIPE_NOT_READY');
      const existing = await client.query<ReservationRow>(
        'SELECT * FROM payment_reservations WHERE job_id=$1 FOR UPDATE', [jobId]);
      if (existing.rows[0]) {
        if (existing.rows[0].id !== reservationId || existing.rows[0].state !== 'RESERVED') {
          throw new FinanceError('CONFLICT');
        }
        return existing.rows[0].id;
      }
      if (job.status !== 'CREATED' || job.payment_reservation_id) throw new FinanceError('NOT_ELIGIBLE');
      const snapshot = JobContractSnapshotSchema.parse(job.contract_snapshot);
      if (snapshot.buyerAccountId !== buyerId || snapshot.jobId !== jobId ||
        snapshot.capabilityVersionId !== job.capability_version_id) throw new FinanceError('CONFLICT');
      const versionResult = await client.query<{ version_snapshot: unknown; seller_profile_id: string }>(`
        SELECT v.version_snapshot,c.seller_profile_id FROM capability_versions v
        JOIN capabilities c ON c.id=v.capability_id WHERE v.id=$1 AND v.publication_state='PUBLISHED'
        FOR SHARE OF v,c`, [job.capability_version_id]);
      const versionRow = versionResult.rows[0];
      if (!versionRow) throw new FinanceError('NOT_ELIGIBLE');
      const version = PublishedCapabilityVersionSchema.parse(versionRow.version_snapshot);
      if (canonicalJson(version.price) !== canonicalJson(snapshot.priceSnapshot)) throw new FinanceError('CONFLICT');
      const seller = await client.query<{ status: string; payout_status: string; stripe_account_id: string | null;
        stripe_mode: string | null; onboarding_status: string | null; transfers_enabled: boolean | null;
        payouts_enabled: boolean | null; last_reconciled_at: Date | null }>(`SELECT s.status,s.payout_status,c.stripe_account_id,
        c.stripe_mode,c.onboarding_status,c.transfers_enabled,c.payouts_enabled,c.last_reconciled_at
        FROM seller_profiles s LEFT JOIN seller_connect_profiles c ON c.seller_profile_id=s.id
        WHERE s.id=$1 FOR SHARE OF s`, [versionRow.seller_profile_id]);
      const ready = seller.rows[0];
      if (!ready || ready.status !== 'ACTIVE' || ready.payout_status !== 'READY' ||
        ready.stripe_mode !== this.stripeMode || ready.onboarding_status !== 'READY' ||
        !ready.transfers_enabled || !ready.payouts_enabled || !ready.stripe_account_id) {
        throw new FinanceError('STRIPE_NOT_READY');
      }
      if (!ready.last_reconciled_at || ready.last_reconciled_at.getTime() < Date.now()-3_600_000) {
        throw new FinanceError('STRIPE_NOT_READY');
      }
      const { sellerId, price: p } = await this.snapshot(client, jobId);
      if (sellerId !== versionRow.seller_profile_id ||
        canonicalJson(snapshot.priceSnapshot) !== canonicalJson({ tier: p.tier, currency: p.currency,
          buyerAmountMinor: p.buyerAmountMinor, platformFeeMinor: p.platformFeeMinor,
          sellerEarningMinor: p.sellerEarningMinor })) throw new FinanceError('CONFLICT');
      const reserveJournalId = await this.journal(client, { effectKey: `job:${jobId}:reserve`,
        kind: 'RESERVE', jobId, movements: reserveMovements(buyerId, p.buyerTotalMinor) });
      await client.query(`INSERT INTO payment_reservations(id,job_id,buyer_account_id,amount_minor,
        currency,state,reserve_journal_id) VALUES($1,$2,$3,$4,'USD','RESERVED',$5)`,
      [reservationId, jobId, buyerId, p.buyerTotalMinor, reserveJournalId]);
      await client.query(`INSERT INTO job_payment_states(job_id,reservation_id,state)
        VALUES($1,$2,'RESERVED')`, [jobId, reservationId]);
      const transition = { id: randomUUID(), jobId, from: 'CREATED', to: 'PAYMENT_RESERVED',
        at: new Date().toISOString(), actor: 'PAYMENT', reason: 'CREDITS_RESERVED', attemptId: null,
        correlationId: reservationId, paymentReservationId: reservationId, resultManifestId: null } as const;
      applyJobTransition({ jobId, status: 'CREATED', transitions: [] }, transition);
      await client.query(`INSERT INTO job_transitions(id,job_id,sequence,from_status,to_status,at,
        actor,reason,attempt_id,correlation_id,payment_reservation_id,result_manifest_id)
        VALUES($1,$2,1,'CREATED','PAYMENT_RESERVED',$3,'PAYMENT','CREDITS_RESERVED',NULL,$4,$4,NULL)`,
      [transition.id, jobId, transition.at, reservationId]);
      await client.query(`UPDATE jobs SET status='PAYMENT_RESERVED',payment_reservation_id=$2
        WHERE id=$1`, [jobId, reservationId]);
      return reservationId;
  }

  private async loadReservation(client: PoolClient, jobId: string): Promise<ReservationRow> {
    const result = await client.query<ReservationRow>('SELECT * FROM payment_reservations WHERE job_id=$1 FOR UPDATE',
      [jobId]);
    if (!result.rows[0]) throw new FinanceError('PAYMENT_NOT_SECURED');
    return result.rows[0];
  }

  private async snapshot(client: PoolClient, jobId: string): Promise<{ sellerId: string; price: FinancialSnapshot }> {
    const row = await client.query<SnapshotRow>('SELECT * FROM job_financial_snapshots WHERE job_id=$1', [jobId]);
    const value = row.rows[0];
    if (!value) throw new FinanceError('NOT_FOUND');
    return { sellerId: value.seller_profile_id, price: FinancialSnapshotSchema.parse({
      tier: value.price_tier_id, currency: value.currency,
      buyerAmountMinor: safeMinor(value.buyer_price_minor),
      platformFeeMinor: safeMinor(value.platform_fee_minor),
      sellerEarningMinor: safeMinor(value.seller_earning_minor),
      taxMinor: safeMinor(value.tax_minor), buyerTotalMinor: safeMinor(value.buyer_total_minor),
    }) };
  }

  /** Release only after a trusted terminal failure, never from a browser or Worker claim. */
  async releaseFailedJob(jobId: string): Promise<void> {
    await this.transaction(async (client) => {
      const job = await this.job(client, jobId);
      if (!terminalFailure.has(job.status)) throw new FinanceError('NOT_ELIGIBLE');
      await this.releaseLocked(client, jobId);
    });
  }

  async releaseFailedJobInTransaction(client: PoolClient, jobId: string): Promise<void> {
    const job = await this.job(client, jobId);
    if (!terminalFailure.has(job.status)) throw new FinanceError('NOT_ELIGIBLE');
    await this.releaseLocked(client, jobId);
  }

  private async releaseLocked(client: PoolClient, jobId: string): Promise<void> {
    const reservation = await this.loadReservation(client, jobId);
    if (reservation.state === 'RELEASED') return;
    assertFinancialTransition(reservation.state, 'RELEASED');
    const id = await this.journal(client, { effectKey: `job:${jobId}:release`, kind: 'RELEASE', jobId,
      movements: releaseMovements(reservation.buyer_account_id, safeMinor(reservation.amount_minor)) });
    await client.query(`UPDATE payment_reservations SET state='RELEASED',terminal_journal_id=$2,
      updated_at=now() WHERE id=$1`, [reservation.id, id]);
    await client.query(`UPDATE job_payment_states SET state='RELEASED',updated_at=now()
      WHERE job_id=$1`, [jobId]);
  }

  /** Buyer identity is authenticated by the API boundary; cancel/claim/start serialize on the job row. */
  async cancelBeforeDispatch(jobId: string, buyerId: string, requestId: string): Promise<void> {
    uuid.parse(buyerId); uuid.parse(requestId);
    await this.transaction((client) => this.cancelBeforeDispatchInTransaction(client, jobId, buyerId, requestId));
  }

  async cancelBeforeDispatchInTransaction(client: PoolClient, jobId: string,
    buyerId: string, requestId: string): Promise<void> {
    uuid.parse(buyerId); uuid.parse(requestId);
      const job = await this.job(client, jobId);
      if (job.buyer_account_id !== buyerId) throw new FinanceError('NOT_ELIGIBLE');
      if (job.status === 'CANCELLED') {
        const prior = await client.query<{ correlation_id: string }>(`SELECT correlation_id
          FROM job_transitions WHERE job_id=$1 AND to_status='CANCELLED' ORDER BY sequence DESC LIMIT 1`,
        [jobId]);
        if (prior.rows[0]?.correlation_id !== requestId) throw new FinanceError('CONFLICT');
        await this.releaseLocked(client, jobId);
        return;
      }
      if (!['PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED','WAITING_FOR_WORKER',
        'DISPATCHED','ACCEPTED'].includes(job.status) || job.started_at) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      const active = await client.query('SELECT id FROM job_executions WHERE job_id=$1 AND completed_at IS NULL FOR UPDATE',
        [jobId]);
      if (active.rowCount && !['DISPATCHED','ACCEPTED'].includes(job.status)) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      if (active.rowCount) {
        await client.query(`UPDATE job_executions SET completed_at=now()
          WHERE job_id=$1 AND completed_at IS NULL`,[jobId]);
      }
      const sequence = await client.query<{ next: number }>(
        'SELECT coalesce(max(sequence),0)::int+1 AS next FROM job_transitions WHERE job_id=$1', [jobId]);
      await client.query(`INSERT INTO job_transitions(id,job_id,sequence,from_status,to_status,at,
        actor,reason,correlation_id) VALUES($1,$2,$3,$4,'CANCELLED',now(),
        'BUYER','BUYER_CANCEL_BEFORE_DISPATCH',$5)`,
      [randomUUID(), jobId, sequence.rows[0]?.next, job.status, requestId]);
      await client.query("UPDATE jobs SET status='CANCELLED' WHERE id=$1", [jobId]);
      await this.releaseLocked(client, jobId);
  }

  /** Bounded repair after process restart: persisted terminal job state drives finance. */
  async reconcileTerminalJobs(limit = 100): Promise<{ released: number; settled: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new FinanceError('NOT_ELIGIBLE');
    const rows = await this.pool.query<{ job_id: string; status: string }>(`SELECT p.job_id,j.status
      FROM job_payment_states p JOIN jobs j ON j.id=p.job_id
      WHERE p.state='RESERVED' AND j.status=ANY($1::text[])
      ORDER BY j.created_at LIMIT $2`, [[...terminalFailure, 'COMPLETED'], limit]);
    let released = 0, settled = 0;
    for (const row of rows.rows) {
      if (row.status === 'COMPLETED') {
        await this.settleDeliveredJob(row.job_id); settled++;
      } else {
        await this.releaseFailedJob(row.job_id); released++;
      }
    }
    return { released, settled };
  }

  /** The cloud must have completed M07 output validation and durable private finalization. */
  async settleDeliveredJob(jobId: string): Promise<void> {
    await this.transaction(async (client) => {
      const job = await this.job(client, jobId);
      if (job.status !== 'COMPLETED' || !job.result_manifest_id) throw new FinanceError('NOT_ELIGIBLE');
      const result = await client.query<{ id: string }>(`SELECT m.id FROM job_result_manifests m
        WHERE m.id=$1 AND m.job_id=$2 AND EXISTS
          (SELECT 1 FROM job_transitions t WHERE t.job_id=m.job_id AND t.to_status='COMPLETED'
            AND t.actor='CLOUD' AND t.result_manifest_id=m.id)`, [job.result_manifest_id, jobId]);
      if (!result.rows[0]) throw new FinanceError('NOT_ELIGIBLE');
      const reservation = await this.loadReservation(client, jobId);
      if (reservation.state === 'SETTLED') return;
      assertFinancialTransition(reservation.state, 'SETTLED');
      const { sellerId, price } = await this.snapshot(client, jobId);
      if (safeMinor(reservation.amount_minor) !== price.buyerTotalMinor) throw new FinanceError('CONFLICT');
      const id = await this.journal(client, { effectKey: `job:${jobId}:settle`, kind: 'SETTLE', jobId,
        movements: settleMovements(job.buyer_account_id, sellerId, price) });
      await client.query(`UPDATE payment_reservations SET state='SETTLED',terminal_journal_id=$2,
        updated_at=now() WHERE id=$1`, [reservation.id, id]);
      await client.query(`UPDATE job_payment_states SET state='SETTLED',updated_at=now()
        WHERE job_id=$1`, [jobId]);
    });
  }

  /** Full credit refund is a compensating journal. Transferred earnings require reversal first. */
  async refundSettledJob(jobId: string): Promise<void> {
    await this.transaction(async (client) => {
      const job = await this.job(client, jobId);
      const reservation = await this.loadReservation(client, jobId);
      if (reservation.state === 'REFUNDED') return;
      assertFinancialTransition(reservation.state, 'REFUNDED');
      const transfer = await client.query<{ state: string }>('SELECT state FROM seller_transfers WHERE job_id=$1', [jobId]);
      if (transfer.rows[0] && transfer.rows[0].state !== 'REVERSED') throw new FinanceError('NOT_ELIGIBLE');
      const { sellerId, price } = await this.snapshot(client, jobId);
      const matured = await client.query('SELECT id FROM financial_journals WHERE effect_key=$1',
        [`job:${jobId}:earning-available`]);
      const source = matured.rowCount ? 'available' : 'pending';
      const id = await this.journal(client, { effectKey: `job:${jobId}:refund`, kind: 'REFUND', jobId,
        movements: refundMovements(job.buyer_account_id, sellerId, price, source) });
      await client.query(`UPDATE payment_reservations SET state='REFUNDED',terminal_journal_id=$2,
        updated_at=now() WHERE id=$1`, [reservation.id, id]);
      await client.query(`UPDATE job_payment_states SET state='REFUNDED',updated_at=now()
        WHERE job_id=$1`, [jobId]);
    });
  }

  /** Seven-day risk hold; a bounded cloud cron may call this after settlement. */
  async matureSellerEarning(jobId: string): Promise<void> {
    await this.transaction(async (client) => {
      const job = await this.job(client, jobId);
      const reservation = await this.loadReservation(client, jobId);
      if (reservation.state !== 'SETTLED' || job.status !== 'COMPLETED') {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      const existing = await client.query('SELECT id FROM financial_journals WHERE effect_key=$1',
        [`job:${jobId}:earning-available`]);
      if (existing.rowCount) return;
      const completed = await client.query<{ mature: boolean }>(
        `SELECT completed_at <= now()-interval '7 days' AS mature FROM jobs WHERE id=$1`, [jobId]);
      if (!completed.rows[0]?.mature) throw new FinanceError('NOT_ELIGIBLE');
      const { sellerId, price } = await this.snapshot(client, jobId);
      await this.journal(client, { effectKey: `job:${jobId}:earning-available`,
        kind: 'EARNING_AVAILABLE', jobId, movements: balanced([
          { account: sellerAccountKey(sellerId, 'pending'), amountMinor: -price.sellerEarningMinor },
          { account: sellerAccountKey(sellerId, 'available'), amountMinor: price.sellerEarningMinor },
        ]) });
    });
  }

  async matureEligibleEarnings(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new FinanceError('NOT_ELIGIBLE');
    const rows = await this.pool.query<{ job_id: string }>(`SELECT p.job_id FROM job_payment_states p
      JOIN jobs j ON j.id=p.job_id WHERE p.state='SETTLED' AND
      j.completed_at <= now()-interval '7 days' AND NOT EXISTS
      (SELECT 1 FROM financial_journals f WHERE f.effect_key='job:'||p.job_id||':earning-available')
      ORDER BY j.completed_at LIMIT $1`, [limit]);
    let changed = 0;
    for (const row of rows.rows) { await this.matureSellerEarning(row.job_id); changed++; }
    return changed;
  }

  /** Seller share and destination are read from immutable snapshot and reconciled Connect state. */
  async queueSellerTransfer(jobId: string): Promise<string> {
    return this.transaction(async (client) => {
      const job = await this.job(client, jobId);
      const reservation = await this.loadReservation(client, jobId);
      if (reservation.state !== 'SETTLED' || job.status !== 'COMPLETED') {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      const prior = await client.query<{ id: string; state: string }>(
        'SELECT id,state FROM seller_transfers WHERE job_id=$1 FOR UPDATE', [jobId]);
      if (prior.rows[0]) {
        if (prior.rows[0].state === 'REVERSED') throw new FinanceError('NOT_ELIGIBLE');
        return prior.rows[0].id;
      }
      const mature = await client.query('SELECT id FROM financial_journals WHERE effect_key=$1',
        [`job:${jobId}:earning-available`]);
      if (!mature.rowCount) throw new FinanceError('NOT_ELIGIBLE');
      const { sellerId, price } = await this.snapshot(client, jobId);
      const connect = await client.query<{ stripe_account_id: string | null;
        onboarding_status: string; transfers_enabled: boolean; payouts_enabled: boolean;
        stripe_mode: string }>(`SELECT * FROM seller_connect_profiles
        WHERE seller_profile_id=$1 FOR SHARE`, [sellerId]);
      const state = connect.rows[0];
      if (!state || state.stripe_mode !== this.stripeMode || state.onboarding_status !== 'READY' ||
        !state.transfers_enabled || !state.payouts_enabled || !state.stripe_account_id) {
        throw new FinanceError('STRIPE_NOT_READY');
      }
      const id = randomUUID();
      await client.query(`INSERT INTO seller_transfers(id,job_id,seller_profile_id,
        amount_minor,currency,stripe_mode,state) VALUES($1,$2,$3,$4,'USD',$5,'REQUESTED')`,
      [id, jobId, sellerId, price.sellerEarningMinor, this.stripeMode]);
      await client.query(`INSERT INTO financial_outbox(id,effect_key,kind,subject_id,stripe_mode)
        VALUES($1,$2,'CREATE_TRANSFER',$3,$4)`,
      [randomUUID(), `job:${jobId}:seller-transfer`, id, this.stripeMode]);
      return id;
    });
  }

  async queueEligibleTransfers(limit = 100): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new FinanceError('NOT_ELIGIBLE');
    const rows = await this.pool.query<{ job_id: string }>(`SELECT p.job_id FROM job_payment_states p
      JOIN financial_journals f ON f.effect_key='job:'||p.job_id||':earning-available'
      WHERE p.state='SETTLED' AND NOT EXISTS
      (SELECT 1 FROM seller_transfers t WHERE t.job_id=p.job_id)
      ORDER BY f.created_at LIMIT $1`, [limit]);
    let changed = 0;
    for (const row of rows.rows) {
      try { await this.queueSellerTransfer(row.job_id); changed++; }
      catch (error) { if (!(error instanceof FinanceError && error.code === 'STRIPE_NOT_READY')) throw error; }
    }
    return changed;
  }

  private async executeTransfer(gateway: StripeGatewayPort, transferId: string): Promise<void> {
    const result = await this.pool.query<{ job_id: string; amount_minor: string; state: string;
      stripe_transfer_id: string | null; stripe_account_id: string | null }>(`
      SELECT t.*,c.stripe_account_id FROM seller_transfers t JOIN seller_connect_profiles c
      ON c.seller_profile_id=t.seller_profile_id WHERE t.id=$1`, [transferId]);
    const row = result.rows[0];
    if (!row || !row.stripe_account_id) throw new FinanceError('NOT_FOUND');
    if (row.state === 'CONFIRMED' || row.state === 'REVERSED') return;
    const transfer = row.stripe_transfer_id ? await gateway.retrieveTransfer(row.stripe_transfer_id) :
      await gateway.createTransfer({ accountId: row.stripe_account_id,
        amountMinor: safeMinor(row.amount_minor), jobId: row.job_id,
        idempotencyKey: `job:${row.job_id}:seller-transfer` });
    if (transfer.destinationAccountId !== row.stripe_account_id ||
      transfer.amountMinor !== safeMinor(row.amount_minor) || transfer.mode !== this.stripeMode) {
      throw new FinanceError('CONFLICT');
    }
    await this.pool.query(`UPDATE seller_transfers SET stripe_transfer_id=$2,updated_at=now()
      WHERE id=$1 AND (stripe_transfer_id IS NULL OR stripe_transfer_id=$2)`, [transferId, transfer.id]);
    await this.confirmSellerTransfer(transfer);
  }

  private async confirmSellerTransfer(transfer: StripeTransfer): Promise<void> {
    if (transfer.mode !== this.stripeMode || transfer.currency !== 'usd') throw new FinanceError('CONFLICT');
    const candidate = await this.pool.query<{ job_id: string }>(
      'SELECT job_id FROM seller_transfers WHERE stripe_transfer_id=$1', [transfer.id]);
    if (!candidate.rows[0]) throw new FinanceError('NOT_FOUND');
    await this.transaction(async (client) => {
      await this.job(client, candidate.rows[0]!.job_id);
      const result = await client.query<{ id: string; state: string; amount_minor: string;
        seller_profile_id: string; stripe_account_id: string | null }>(`
        SELECT t.*,c.stripe_account_id FROM seller_transfers t JOIN seller_connect_profiles c
        ON c.seller_profile_id=t.seller_profile_id WHERE t.stripe_transfer_id=$1 FOR UPDATE OF t`,
      [transfer.id]);
      const row = result.rows[0];
      if (!row || row.stripe_account_id !== transfer.destinationAccountId ||
        safeMinor(row.amount_minor) !== transfer.amountMinor) throw new FinanceError('CONFLICT');
      if (row.state === 'CONFIRMED') return;
      if (row.state !== 'REQUESTED' || transfer.reversed) throw new FinanceError('NOT_ELIGIBLE');
      const id = await this.journal(client, { effectKey: `job:${candidate.rows[0]!.job_id}:transfer`,
        kind: 'TRANSFER', jobId: candidate.rows[0]!.job_id, movements: balanced([
          { account: sellerAccountKey(row.seller_profile_id, 'available'), amountMinor: -transfer.amountMinor },
          { account: sellerAccountKey(row.seller_profile_id, 'transferred'), amountMinor: transfer.amountMinor },
        ]) });
      await client.query(`UPDATE seller_transfers SET state='CONFIRMED',journal_id=$2,
        updated_at=now() WHERE id=$1`, [row.id, id]);
    });
  }

  async requestFullRefund(jobId: string): Promise<void> {
    let readyToRefund = false;
    let platformFunded = false;
    await this.transaction(async (client) => {
      await this.job(client, jobId);
      const reservation = await this.loadReservation(client, jobId);
      if (reservation.state === 'REFUNDED') return;
      if (reservation.state !== 'SETTLED') throw new FinanceError('NOT_ELIGIBLE');
      const transfer = await client.query<{ id: string; state: string }>(
        'SELECT id,state FROM seller_transfers WHERE job_id=$1 FOR UPDATE', [jobId]);
      if (!transfer.rows[0] || transfer.rows[0].state === 'REVERSED') {
        readyToRefund = true; return;
      }
      if (transfer.rows[0].state !== 'CONFIRMED') throw new FinanceError('NOT_ELIGIBLE');
      const { sellerId } = await this.snapshot(client, jobId);
      const paid = await client.query('SELECT id FROM seller_payouts WHERE seller_profile_id=$1 AND state=\'PAID\' LIMIT 1',
        [sellerId]);
      if (paid.rowCount) { platformFunded = true; return; }
      await client.query(`INSERT INTO financial_outbox(id,effect_key,kind,subject_id,stripe_mode)
        VALUES($1,$2,'REVERSE_TRANSFER',$3,$4) ON CONFLICT(effect_key) DO NOTHING`,
      [randomUUID(), `job:${jobId}:transfer-reversal`, transfer.rows[0].id, this.stripeMode]);
    });
    if (readyToRefund) await this.refundSettledJob(jobId);
    if (platformFunded) await this.platformFundedAdminRefund(jobId);
  }

  /** After bank payout, a full administrative credit refund is borne by platform loss.
   * It never rewrites the seller's already paid historical earning. */
  private async platformFundedAdminRefund(jobId: string): Promise<void> {
    await this.transaction(async (client) => {
      const job = await this.job(client, jobId);
      const reservation = await this.loadReservation(client, jobId);
      if (reservation.state === 'REFUNDED') return;
      assertFinancialTransition(reservation.state, 'REFUNDED');
      const { sellerId, price } = await this.snapshot(client, jobId);
      const transfer = await client.query<{ state: string }>(
        'SELECT state FROM seller_transfers WHERE job_id=$1 FOR UPDATE', [jobId]);
      const payout = await client.query('SELECT id FROM seller_payouts WHERE seller_profile_id=$1 AND state=\'PAID\' LIMIT 1',
        [sellerId]);
      if (transfer.rows[0]?.state !== 'CONFIRMED' || !payout.rowCount) {
        throw new FinanceError('NOT_ELIGIBLE');
      }
      const id = await this.journal(client, { effectKey: `job:${jobId}:platform-funded-refund`,
        kind: 'ADMIN_REFUND_PLATFORM_FUNDED', jobId, movements: balanced([
          { account: buyerAccountKey(job.buyer_account_id, 'available'), amountMinor: price.buyerTotalMinor },
          { account: platformAccountKey('revenue'), amountMinor: -price.platformFeeMinor },
          { account: platformAccountKey('dispute_loss'), amountMinor: -price.sellerEarningMinor },
          ...(price.taxMinor ? [{ account: platformAccountKey('tax_liability'),
            amountMinor: -price.taxMinor }] : []),
        ]) });
      await client.query(`UPDATE payment_reservations SET state='REFUNDED',terminal_journal_id=$2,
        updated_at=now() WHERE id=$1`, [reservation.id, id]);
      await client.query(`UPDATE job_payment_states SET state='REFUNDED',updated_at=now()
        WHERE job_id=$1`, [jobId]);
    });
  }

  private async executeTransferReversal(gateway: StripeGatewayPort, transferId: string): Promise<void> {
    const result = await this.pool.query<{ job_id: string; state: string;
      stripe_transfer_id: string | null }>('SELECT * FROM seller_transfers WHERE id=$1', [transferId]);
    const row = result.rows[0];
    if (!row || !row.stripe_transfer_id) throw new FinanceError('NOT_FOUND');
    if (row.state === 'REVERSED') return;
    if (row.state !== 'CONFIRMED') throw new FinanceError('NOT_ELIGIBLE');
    const transfer = await gateway.reverseTransfer(row.stripe_transfer_id,
      `job:${row.job_id}:transfer-reversal`);
    if (!transfer.reversed) throw new FinanceError('NOT_ELIGIBLE');
    await this.transaction(async (client) => {
      await this.job(client, row.job_id);
      const current = await client.query<{ state: string; amount_minor: string;
        seller_profile_id: string; stripe_transfer_id: string }>(
        'SELECT * FROM seller_transfers WHERE id=$1 FOR UPDATE', [transferId]);
      const item = current.rows[0];
      if (!item || item.stripe_transfer_id !== transfer.id ||
        safeMinor(item.amount_minor) !== transfer.amountMinor) throw new FinanceError('CONFLICT');
      if (item.state === 'REVERSED') return;
      const id = await this.journal(client, { effectKey: `job:${row.job_id}:transfer-reversal`,
        kind: 'TRANSFER_REVERSAL', jobId: row.job_id, movements: balanced([
          { account: sellerAccountKey(item.seller_profile_id, 'transferred'),
            amountMinor: -transfer.amountMinor },
          { account: sellerAccountKey(item.seller_profile_id, 'available'),
            amountMinor: transfer.amountMinor },
        ]) });
      await client.query(`UPDATE seller_transfers SET state='REVERSED',reversal_journal_id=$2,
        updated_at=now() WHERE id=$1`, [transferId, id]);
    });
    await this.refundSettledJob(row.job_id);
  }

  private async confirmSellerPayout(payout: StripePayout): Promise<void> {
    if (payout.mode !== this.stripeMode || payout.currency !== 'usd') throw new FinanceError('CONFLICT');
    const seller = await this.pool.query<{ seller_profile_id: string }>(
      'SELECT seller_profile_id FROM seller_connect_profiles WHERE stripe_account_id=$1',
      [payout.connectedAccountId]);
    if (!seller.rows[0]) throw new FinanceError('NOT_FOUND');
    await this.transaction(async (client) => {
      const sellerId = seller.rows[0]!.seller_profile_id;
      const current = await client.query<{ state: string; amount_minor: string;
        seller_profile_id: string; journal_id: string | null;
        reversal_journal_id: string | null }>(
        'SELECT * FROM seller_payouts WHERE stripe_payout_id=$1 FOR UPDATE', [payout.id]);
      if (current.rows[0] && safeMinor(current.rows[0].amount_minor) !== payout.amountMinor) {
        throw new FinanceError('CONFLICT');
      }
      if (current.rows[0] && current.rows[0].seller_profile_id !== sellerId) {
        throw new FinanceError('CONFLICT');
      }
      if (!current.rows[0]) {
        await client.query(`INSERT INTO seller_payouts(id,seller_profile_id,stripe_payout_id,
          stripe_mode,amount_minor,currency,state) VALUES($1,$2,$3,$4,$5,'USD','PENDING')`,
        [randomUUID(), sellerId, payout.id, this.stripeMode, payout.amountMinor]);
      }
      if (payout.status === 'paid') {
        if (current.rows[0]?.state === 'PAID') return;
        if (current.rows[0]?.reversal_journal_id) throw new FinanceError('CONFLICT');
        const id = await this.journal(client, { effectKey: `stripe:payout:${payout.id}`,
          kind: 'PAYOUT', jobId: null, movements: balanced([
            { account: sellerAccountKey(sellerId, 'transferred'),
              amountMinor: -payout.amountMinor },
            { account: sellerAccountKey(sellerId, 'paid_out'), amountMinor: payout.amountMinor },
          ]) });
        await client.query(`UPDATE seller_payouts SET state='PAID',journal_id=$2,
          paid_at=now() WHERE stripe_payout_id=$1`, [payout.id, id]);
      } else if (payout.status === 'failed' || payout.status === 'canceled') {
        if (current.rows[0]?.state === 'PAID') {
          const id = await this.journal(client, {
            effectKey: `stripe:payout:${payout.id}:failure-reversal`,
            kind: 'PAYOUT_FAILURE_REVERSAL', jobId: null, movements: balanced([
              { account: sellerAccountKey(sellerId, 'paid_out'),
                amountMinor: -payout.amountMinor },
              { account: sellerAccountKey(sellerId, 'transferred'),
                amountMinor: payout.amountMinor },
            ]) });
          await client.query(`UPDATE seller_payouts SET reversal_journal_id=$2 WHERE stripe_payout_id=$1`,
            [payout.id, id]);
        }
        await client.query(`UPDATE seller_payouts SET state=$2 WHERE stripe_payout_id=$1`,
          [payout.id, payout.status.toUpperCase()]);
      }
    });
  }

  async sellerEarnings(sellerId: string): Promise<{ pendingMinor: number; availableMinor: number;
    transferredMinor: number; paidOutMinor: number; currency: 'USD' }> {
    uuid.parse(sellerId);
    const result = await this.pool.query<{ kind: string; balance: string }>(`SELECT a.kind,
      coalesce(sum(e.amount_minor),0)::text AS balance FROM financial_accounts a
      LEFT JOIN financial_entries e ON e.account_key=a.account_key
      WHERE a.owner_kind='SELLER' AND a.owner_id=$1 GROUP BY a.kind`, [sellerId]);
    const found = Object.fromEntries(result.rows.map((row) => [row.kind, safeMinor(row.balance)]));
    return { pendingMinor: found.SELLER_PENDING ?? 0, availableMinor: found.SELLER_AVAILABLE ?? 0,
      transferredMinor: found.SELLER_TRANSFERRED ?? 0, paidOutMinor: found.SELLER_PAID_OUT ?? 0,
      currency: 'USD' };
  }

  async sellerSettledSales(sellerId: string): Promise<{ buyerSalesMinor: number;
    marketplaceFeesMinor: number; currency: 'USD' }> {
    uuid.parse(sellerId);
    const result = await this.pool.query<{ buyer_sales: string; marketplace_fees: string }>(
      `SELECT coalesce(sum(s.buyer_price_minor),0)::text AS buyer_sales,
        coalesce(sum(s.platform_fee_minor),0)::text AS marketplace_fees
       FROM job_financial_snapshots s
       JOIN financial_journals j ON j.job_id=s.job_id AND j.kind='SETTLE'
       JOIN job_payment_states p ON p.job_id=s.job_id AND p.state='SETTLED'
       WHERE s.seller_profile_id=$1`, [sellerId]);
    return { buyerSalesMinor: safeMinor(result.rows[0]?.buyer_sales ?? '0'),
      marketplaceFeesMinor: safeMinor(result.rows[0]?.marketplace_fees ?? '0'),
      currency: 'USD' };
  }

  async reconcileLedger(): Promise<{ unbalancedJournals: number; negativeProtectedAccounts: number;
    reservationMismatches: number }> {
    const [journals, balances, reservations, purchases, providerEffects] = await Promise.all([
      this.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM financial_journals j
        LEFT JOIN financial_entries e ON e.journal_id=j.id GROUP BY j.id
        HAVING count(e.id)<2 OR coalesce(sum(e.amount_minor),0)<>0 OR
          count(*) FILTER (WHERE e.currency IS DISTINCT FROM j.currency)>0`),
      this.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM (
        SELECT a.account_key FROM financial_accounts a JOIN financial_entries e USING(account_key)
        WHERE a.owner_kind IN ('BUYER','SELLER') GROUP BY a.account_key HAVING sum(e.amount_minor)<0) bad`),
      this.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM payment_reservations r
        JOIN jobs j ON j.id=r.job_id
        JOIN job_financial_snapshots s ON s.job_id=r.job_id
        LEFT JOIN job_payment_states p ON p.job_id=r.job_id
        WHERE j.payment_reservation_id IS DISTINCT FROM r.id OR
          p.reservation_id IS DISTINCT FROM r.id OR p.state IS DISTINCT FROM r.state OR
          r.amount_minor IS DISTINCT FROM s.buyer_total_minor OR
          (r.state='RESERVED' AND r.terminal_journal_id IS NOT NULL) OR
          (r.state<>'RESERVED' AND r.terminal_journal_id IS NULL)`),
      this.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM credit_purchases
        WHERE state IN ('SUCCEEDED','DISPUTED','PARTIALLY_REFUNDED','REFUNDED')
          AND journal_id IS NULL`),
      this.pool.query<{ n: number }>(`SELECT (
        (SELECT count(*) FROM stripe_processing_fees f JOIN credit_purchases p
          ON p.id=f.credit_purchase_id WHERE p.stripe_charge_id IS DISTINCT FROM f.stripe_charge_id
          OR (f.fee_minor>0 AND f.journal_id IS NULL) OR
          (f.fee_minor=0 AND f.journal_id IS NOT NULL)) +
        (SELECT count(*) FROM stripe_credit_refunds WHERE
          (status='SUCCEEDED' AND journal_id IS NULL) OR
          (status<>'SUCCEEDED' AND journal_id IS NOT NULL)) +
        (SELECT count(*) FROM seller_transfers WHERE
          (state IN ('CONFIRMED','REVERSED') AND journal_id IS NULL) OR
          (state='REVERSED' AND reversal_journal_id IS NULL)) +
        (SELECT count(*) FROM seller_payouts WHERE state='PAID' AND journal_id IS NULL)
      )::int AS n`),
    ]);
    return { unbalancedJournals: journals.rows.length, negativeProtectedAccounts: balances.rows[0]?.n ?? 0,
      reservationMismatches: (reservations.rows[0]?.n ?? 0) + (purchases.rows[0]?.n ?? 0) +
        (providerEffects.rows[0]?.n ?? 0) };
  }
}
