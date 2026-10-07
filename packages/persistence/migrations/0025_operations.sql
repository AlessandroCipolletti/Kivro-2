BEGIN;

-- A single row is locked by every dispatch offer. Operator changes and offers
-- therefore have a defined order even when several cloud processes race.
CREATE TABLE platform_dispatch_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  halted boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES accounts(id) ON DELETE RESTRICT
);
INSERT INTO platform_dispatch_control(singleton,halted) VALUES(true,false);

CREATE TABLE platform_buyer_limits (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  max_jobs_per_hour integer NOT NULL CHECK(max_jobs_per_hour BETWEEN 1 AND 1000),
  max_spend_minor_per_day bigint NOT NULL CHECK(max_spend_minor_per_day BETWEEN 99 AND 100000000),
  max_active_jobs integer NOT NULL CHECK(max_active_jobs BETWEEN 1 AND 1000)
);
INSERT INTO platform_buyer_limits VALUES(true,20,50000,10);

ALTER TABLE platform_buyer_limits ADD COLUMN max_quotes_per_minute integer NOT NULL DEFAULT 60
  CHECK(max_quotes_per_minute BETWEEN 1 AND 10000);

CREATE TABLE buyer_quote_rate (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE RESTRICT,
  window_started_at timestamptz NOT NULL,
  quote_count integer NOT NULL CHECK(quote_count BETWEEN 1 AND 1000000)
);

CREATE TABLE operator_grants (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text NOT NULL CHECK(length(granted_by) BETWEEN 3 AND 160),
  revoked_at timestamptz
);

CREATE TABLE platform_audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_kind text NOT NULL CHECK(actor_kind IN ('OPERATOR','BUYER','SELLER','SYSTEM')),
  event_code text NOT NULL CHECK(event_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  subject_kind text NOT NULL CHECK(subject_kind IN ('PLATFORM','ACCOUNT','WORKER','CAPABILITY','JOB','REPORT')),
  subject_id uuid,
  job_id uuid REFERENCES jobs(id) ON DELETE RESTRICT,
  correlation_id uuid,
  reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$')
);
CREATE INDEX platform_audit_events_subject ON platform_audit_events(subject_kind,subject_id,occurred_at DESC);
CREATE INDEX platform_audit_events_job ON platform_audit_events(job_id,occurred_at DESC);
CREATE TRIGGER platform_audit_immutable BEFORE UPDATE OR DELETE ON platform_audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_transition_rewrite();

CREATE TABLE abuse_reports (
  id uuid PRIMARY KEY,
  reporter_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reporter_kind text NOT NULL CHECK(reporter_kind IN ('BUYER','SELLER')),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK(category IN ('HARASSMENT','MALICIOUS_INPUT','UNSAFE_OUTPUT','FRAUD','PRIVACY','OTHER')),
  state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','REVIEWED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  UNIQUE(reporter_account_id,job_id,category)
);
CREATE INDEX abuse_reports_open ON abuse_reports(created_at) WHERE state='OPEN';

CREATE TABLE abuse_content_rules (
  id uuid PRIMARY KEY,
  normalized_pattern text NOT NULL UNIQUE CHECK(length(normalized_pattern) BETWEEN 8 AND 160),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT
);

-- The cloud chooses each output staging key for one leased execution. A
-- Worker-supplied key from another job can never become a buyer deliverable.
CREATE TABLE job_result_upload_intents (
  asset_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  execution_id uuid NOT NULL REFERENCES job_executions(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  object_key text NOT NULL UNIQUE CHECK(object_key ~ '^private/assets/[a-f0-9-]{36}/[a-f0-9-]{36}$'),
  field_key text NOT NULL CHECK(length(field_key) BETWEEN 1 AND 160),
  size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 0 AND 1073741824),
  sha256 text NOT NULL CHECK(sha256 ~ '^sha256:[a-f0-9]{64}$'),
  detected_mime_type text NOT NULL CHECK(length(detected_mime_type) BETWEEN 3 AND 120),
  extension text NOT NULL CHECK(extension ~ '^[.][a-z0-9]{1,16}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  last_signed_at timestamptz NOT NULL DEFAULT now(),
  source_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_result_upload_intents_job ON job_result_upload_intents(job_id,execution_id);

COMMIT;
