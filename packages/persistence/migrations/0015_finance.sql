BEGIN;

-- One shared financial history for both deployment profiles. Money is USD cents.
CREATE TABLE marketplace_price_tiers (
  id text PRIMARY KEY CHECK (id ~ '^USD_[0-9]{2,8}$'),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  buyer_amount_minor bigint NOT NULL CHECK (buyer_amount_minor BETWEEN 1 AND 1000000000),
  platform_fee_minor bigint NOT NULL CHECK (platform_fee_minor BETWEEN 0 AND 1000000000),
  seller_earning_minor bigint NOT NULL CHECK (seller_earning_minor BETWEEN 0 AND 1000000000),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_amount_minor = platform_fee_minor + seller_earning_minor)
);
INSERT INTO marketplace_price_tiers(id,buyer_amount_minor,platform_fee_minor,seller_earning_minor,sort_order) VALUES
  ('USD_099',99,19,80,1),('USD_299',299,59,240,2),('USD_499',499,99,400,3),
  ('USD_999',999,199,800,4),('USD_1499',1499,299,1200,5),('USD_1999',1999,399,1600,6),
  ('USD_2999',2999,599,2400,7),('USD_4999',4999,999,4000,8),('USD_9999',9999,1999,8000,9);

ALTER TABLE seller_provider_calls ADD COLUMN reserved_input_tokens integer NOT NULL DEFAULT 0
  CHECK (reserved_input_tokens >= 0);
ALTER TABLE seller_provider_calls ADD COLUMN reserved_output_tokens integer NOT NULL DEFAULT 0
  CHECK (reserved_output_tokens >= 0);
ALTER TABLE seller_provider_calls ADD COLUMN measured_cost_micro_usd bigint
  CHECK (measured_cost_micro_usd IS NULL OR measured_cost_micro_usd >= 0);
CREATE INDEX seller_provider_calls_daily_idx ON seller_provider_calls(started_at,job_id);

CREATE TABLE job_financial_snapshots (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE RESTRICT,
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  price_tier_id text NOT NULL,
  currency text NOT NULL CHECK (currency='USD'),
  buyer_price_minor bigint NOT NULL CHECK (buyer_price_minor > 0),
  platform_fee_minor bigint NOT NULL CHECK (platform_fee_minor >= 0),
  seller_earning_minor bigint NOT NULL CHECK (seller_earning_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  buyer_total_minor bigint NOT NULL CHECK (buyer_total_minor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_price_minor=platform_fee_minor+seller_earning_minor),
  CHECK (buyer_total_minor=buyer_price_minor+tax_minor)
);

CREATE TABLE financial_accounts (
  account_key text PRIMARY KEY CHECK (length(account_key) BETWEEN 5 AND 180),
  currency text NOT NULL CHECK (currency='USD'),
  owner_kind text NOT NULL CHECK (owner_kind IN ('BUYER','SELLER','PLATFORM')),
  owner_id uuid,
  kind text NOT NULL CHECK (kind IN ('BUYER_AVAILABLE','BUYER_RESERVED','SELLER_PENDING',
    'SELLER_AVAILABLE','SELLER_TRANSFERRED','SELLER_PAID_OUT','PLATFORM_CLEARING',
    'PLATFORM_REVENUE','PLATFORM_TAX_LIABILITY','PLATFORM_DISPUTE_LOSS',
    'PLATFORM_PROCESSING_EXPENSE','PLATFORM_REFUND_LOSS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_kind='PLATFORM' AND owner_id IS NULL) OR
    (owner_kind<>'PLATFORM' AND owner_id IS NOT NULL))
);
CREATE TABLE financial_journals (
  id uuid PRIMARY KEY,
  effect_key text NOT NULL UNIQUE CHECK (length(effect_key) BETWEEN 8 AND 200),
  kind text NOT NULL CHECK (kind IN ('CREDIT_PURCHASE','RESERVE','RELEASE','SETTLE',
    'REFUND','EARNING_AVAILABLE','TRANSFER','PAYOUT','TRANSFER_REVERSAL',
    'DISPUTE_LOSS','DISPUTE_RECOVERY','ADMIN_REFUND_PLATFORM_FUNDED','PROCESSING_FEE',
    'STRIPE_CREDIT_REFUND','PAYOUT_FAILURE_REVERSAL')),
  job_id uuid REFERENCES jobs(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency='USD'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE financial_entries (
  id uuid PRIMARY KEY,
  journal_id uuid NOT NULL REFERENCES financial_journals(id) ON DELETE RESTRICT,
  account_key text NOT NULL REFERENCES financial_accounts(account_key) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency='USD'),
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0 AND amount_minor BETWEEN -1000000000 AND 1000000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(journal_id,account_key)
);
CREATE INDEX financial_entries_account_idx ON financial_entries(account_key,created_at);
CREATE FUNCTION guard_financial_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial history is append-only';
END; $$;
CREATE TRIGGER financial_journals_append_only BEFORE UPDATE OR DELETE ON financial_journals
  FOR EACH ROW EXECUTE FUNCTION guard_financial_immutability();
CREATE TRIGGER financial_entries_append_only BEFORE UPDATE OR DELETE ON financial_entries
  FOR EACH ROW EXECUTE FUNCTION guard_financial_immutability();
CREATE TRIGGER financial_accounts_immutable BEFORE UPDATE OR DELETE ON financial_accounts
  FOR EACH ROW EXECUTE FUNCTION guard_financial_immutability();
CREATE TRIGGER job_financial_snapshots_immutable BEFORE UPDATE OR DELETE ON job_financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION guard_financial_immutability();
CREATE FUNCTION assert_balanced_financial_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_id_to_check uuid; total bigint; mismatched integer; entry_count integer;
BEGIN
  IF TG_TABLE_NAME='financial_journals' THEN
    journal_id_to_check := NEW.id;
  ELSE
    journal_id_to_check := NEW.journal_id;
  END IF;
  SELECT coalesce(sum(amount_minor),0),
    count(*) FILTER (WHERE currency <> (SELECT currency FROM financial_journals WHERE id=journal_id_to_check)),
    count(*) INTO total,mismatched,entry_count
    FROM financial_entries WHERE journal_id=journal_id_to_check;
  IF entry_count < 2 OR total <> 0 OR mismatched <> 0 THEN
    RAISE EXCEPTION 'Unbalanced financial journal %',journal_id_to_check;
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER financial_journal_balanced_on_create AFTER INSERT ON financial_journals
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_balanced_financial_journal();
CREATE CONSTRAINT TRIGGER financial_journal_balanced AFTER INSERT ON financial_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_balanced_financial_journal();

CREATE TABLE payment_reservations (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency='USD'),
  state text NOT NULL CHECK (state IN ('RESERVED','RELEASED','SETTLED','REFUNDED')),
  reserve_journal_id uuid NOT NULL UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  terminal_journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE job_payment_states (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE RESTRICT,
  reservation_id uuid NOT NULL UNIQUE REFERENCES payment_reservations(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('RESERVED','RELEASED','SETTLED','REFUNDED')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION guard_payment_reservation_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR
    NEW.buyer_account_id IS DISTINCT FROM OLD.buyer_account_id OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.reserve_journal_id IS DISTINCT FROM OLD.reserve_journal_id OR
    NOT ((OLD.state='RESERVED' AND NEW.state IN ('RELEASED','SETTLED')) OR
      (OLD.state='SETTLED' AND NEW.state='REFUNDED')) OR
    NEW.terminal_journal_id IS NULL THEN
    RAISE EXCEPTION 'Invalid financial reservation mutation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER payment_reservations_state_guard BEFORE UPDATE OR DELETE ON payment_reservations
  FOR EACH ROW EXECUTE FUNCTION guard_payment_reservation_state();

CREATE TABLE buyer_billing_profiles (
  buyer_account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE RESTRICT,
  stripe_customer_id text UNIQUE,
  default_payment_method_id text,
  billing_country text,
  billing_status text NOT NULL DEFAULT 'NOT_STARTED',
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE seller_connect_profiles (
  seller_profile_id uuid PRIMARY KEY REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  stripe_account_id text UNIQUE,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  onboarding_status text NOT NULL CHECK (onboarding_status IN
    ('NOT_STARTED','IN_PROGRESS','RESTRICTED','ACTION_REQUIRED','READY','DISABLED')),
  transfers_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  country text,
  default_currency text NOT NULL DEFAULT 'USD',
  last_reconciled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(requirements_due)='array')
);
CREATE TABLE credit_purchases (
  id uuid PRIMARY KEY,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text UNIQUE,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 1000000000),
  currency text NOT NULL CHECK (currency='USD'),
  state text NOT NULL CHECK (state IN ('REQUESTED','PROCESSING','SUCCEEDED','FAILED','CANCELED',
    'DISPUTED','PARTIALLY_REFUNDED','REFUNDED')),
  journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION guard_credit_purchase_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR
    NEW.buyer_account_id IS DISTINCT FROM OLD.buyer_account_id OR
    NEW.stripe_mode IS DISTINCT FROM OLD.stripe_mode OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR NEW.currency IS DISTINCT FROM OLD.currency OR
    (OLD.stripe_payment_intent_id IS NOT NULL AND
      NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id) OR
    (OLD.stripe_charge_id IS NOT NULL AND
      NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id) OR
    (OLD.journal_id IS NOT NULL AND NEW.journal_id IS DISTINCT FROM OLD.journal_id) THEN
    RAISE EXCEPTION 'Credit purchase identity is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER credit_purchase_identity_guard BEFORE UPDATE OR DELETE ON credit_purchases
  FOR EACH ROW EXECUTE FUNCTION guard_credit_purchase_identity();
CREATE TABLE stripe_processing_fees (
  stripe_charge_id text PRIMARY KEY,
  credit_purchase_id uuid NOT NULL UNIQUE REFERENCES credit_purchases(id) ON DELETE RESTRICT,
  stripe_balance_transaction_id text NOT NULL UNIQUE,
  fee_minor bigint NOT NULL CHECK (fee_minor >= 0),
  currency text NOT NULL CHECK (currency='USD'),
  journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stripe_credit_refunds (
  stripe_refund_id text PRIMARY KEY,
  credit_purchase_id uuid NOT NULL REFERENCES credit_purchases(id) ON DELETE RESTRICT,
  stripe_charge_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 1000000000),
  currency text NOT NULL CHECK (currency='USD'),
  status text NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED','CANCELED')),
  journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stripe_credit_refunds_purchase_idx ON stripe_credit_refunds(credit_purchase_id);
CREATE TABLE stripe_disputes (
  id text PRIMARY KEY,
  credit_purchase_id uuid NOT NULL REFERENCES credit_purchases(id) ON DELETE RESTRICT,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency='USD'),
  state text NOT NULL CHECK (state IN ('OPEN','LOST','WON')),
  loss_journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  recovery_journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stripe_inbox (
  event_id text PRIMARY KEY,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  event_type text NOT NULL,
  object_id text NOT NULL,
  object_type text NOT NULL,
  connected_account_id text,
  provider_created_at timestamptz NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^sha256:[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);
CREATE INDEX stripe_inbox_pending_idx ON stripe_inbox(received_at) WHERE processed_at IS NULL;
CREATE TABLE financial_outbox (
  id uuid PRIMARY KEY,
  effect_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('CREATE_CREDIT_INTENT','CREATE_CUSTOMER',
    'CREATE_CONNECT_ACCOUNT','CREATE_TRANSFER','REVERSE_TRANSFER','RECONCILE_STRIPE')),
  subject_id uuid NOT NULL,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','PROCESSING','DONE','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE seller_transfers (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency='USD'),
  stripe_transfer_id text UNIQUE,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  state text NOT NULL CHECK (state IN ('REQUESTED','CONFIRMED','FAILED','REVERSED')),
  journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  reversal_journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION guard_seller_transfer_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR
    NEW.seller_profile_id IS DISTINCT FROM OLD.seller_profile_id OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.stripe_mode IS DISTINCT FROM OLD.stripe_mode OR
    (OLD.stripe_transfer_id IS NOT NULL AND
      NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id) OR
    (OLD.journal_id IS NOT NULL AND NEW.journal_id IS DISTINCT FROM OLD.journal_id) OR
    (OLD.reversal_journal_id IS NOT NULL AND
      NEW.reversal_journal_id IS DISTINCT FROM OLD.reversal_journal_id) THEN
    RAISE EXCEPTION 'Seller transfer identity is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER seller_transfer_identity_guard BEFORE UPDATE OR DELETE ON seller_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_seller_transfer_identity();
CREATE TABLE seller_payouts (
  id uuid PRIMARY KEY,
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  stripe_payout_id text NOT NULL UNIQUE,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test','live')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency='USD'),
  state text NOT NULL CHECK (state IN ('PENDING','PAID','FAILED','CANCELED')),
  journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  reversal_journal_id uuid UNIQUE REFERENCES financial_journals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

COMMIT;
