BEGIN;

CREATE TABLE buyer_api_keys (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  prefix text NOT NULL UNIQUE CHECK (length(prefix) BETWEEN 10 AND 40),
  secret_hash text NOT NULL UNIQUE CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] NOT NULL CHECK (cardinality(scopes) BETWEEN 1 AND 6 AND
    scopes <@ ARRAY['capabilities:read','jobs:create','jobs:read','assets:create',
      'assets:read','webhooks:manage']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  rotated_from uuid REFERENCES buyer_api_keys(id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE INDEX buyer_api_keys_account_idx ON buyer_api_keys(account_id,created_at DESC);
CREATE TABLE buyer_api_key_audit (
  id uuid PRIMARY KEY,
  key_id uuid NOT NULL REFERENCES buyer_api_keys(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('CREATED','USED','REVOKED','ROTATED')),
  endpoint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_api_key_audit_account_idx ON buyer_api_key_audit(account_id,created_at DESC);
CREATE TRIGGER buyer_api_key_audit_immutable BEFORE UPDATE OR DELETE ON buyer_api_key_audit
  FOR EACH ROW EXECUTE FUNCTION prevent_transition_rewrite();

CREATE TABLE buyer_api_idempotency (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  endpoint text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 160),
  key_id uuid NOT NULL REFERENCES buyer_api_keys(id) ON DELETE RESTRICT,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  quote_id uuid NOT NULL UNIQUE,
  job_id uuid NOT NULL UNIQUE,
  reservation_id uuid NOT NULL UNIQUE,
  manifest_id uuid NOT NULL UNIQUE,
  lease_token uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(account_id,endpoint,idempotency_key),
  UNIQUE(account_id,idempotency_key),
  CHECK ((response IS NULL)=(completed_at IS NULL))
);
CREATE INDEX buyer_api_idempotency_expiry_idx ON buyer_api_idempotency(expires_at);
CREATE TABLE buyer_api_rate_windows (
  subject_kind text NOT NULL CHECK (subject_kind IN ('KEY','ACCOUNT')),
  subject_id uuid NOT NULL,
  endpoint text NOT NULL,
  bucket_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count BETWEEN 1 AND 100000),
  PRIMARY KEY(subject_kind,subject_id,endpoint,bucket_start)
);

CREATE TABLE buyer_webhook_endpoints (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  url text NOT NULL CHECK (length(url) BETWEEN 12 AND 2048),
  secret_ciphertext text NOT NULL,
  events text[] NOT NULL CHECK (cardinality(events) BETWEEN 1 AND 4 AND
    events <@ ARRAY['job.completed','job.failed','job.cancelled','job.started']::text[]),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DEGRADED','DISABLED','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  deleted_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count>=0)
);
CREATE INDEX buyer_webhook_endpoints_account_idx ON buyer_webhook_endpoints(account_id,created_at DESC);
CREATE TABLE buyer_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES jobs(id) ON DELETE RESTRICT,
  transition_id uuid UNIQUE REFERENCES job_transitions(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('job.completed','job.failed','job.cancelled','job.started','test.ping')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((type='test.ping')=(job_id IS NULL))
);
CREATE INDEX buyer_webhook_events_account_idx ON buyer_webhook_events(account_id,created_at DESC);
CREATE TRIGGER buyer_webhook_events_immutable BEFORE UPDATE OR DELETE ON buyer_webhook_events
  FOR EACH ROW EXECUTE FUNCTION prevent_transition_rewrite();
CREATE TABLE buyer_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES buyer_webhook_endpoints(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES buyer_webhook_events(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','DELIVERED','EXHAUSTED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 7),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  leased_until timestamptz,
  lease_token uuid,
  last_http_status integer,
  last_error_code text,
  delivered_at timestamptz,
  UNIQUE(endpoint_id,event_id)
);
CREATE INDEX buyer_webhook_deliveries_due_idx ON buyer_webhook_deliveries(next_attempt_at,id)
  WHERE state='PENDING';
CREATE TABLE buyer_webhook_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES buyer_webhook_deliveries(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 7),
  http_status integer,
  error_code text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_id,attempt_number)
);
CREATE TRIGGER buyer_webhook_attempts_immutable BEFORE UPDATE OR DELETE ON buyer_webhook_attempts
  FOR EACH ROW EXECUTE FUNCTION prevent_transition_rewrite();

CREATE FUNCTION enqueue_buyer_webhook_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text; buyer uuid; cap uuid; version_number integer; event_id uuid;
BEGIN
  kind := CASE WHEN NEW.to_status='COMPLETED' THEN 'job.completed'
    WHEN NEW.to_status IN ('FAILED_STARTUP','FAILED_POLICY','FAILED_EXECUTION','TIMED_OUT',
      'WORKER_OFFLINE','RESULT_REJECTED','REJECTED','EXPIRED') THEN 'job.failed'
    WHEN NEW.to_status='CANCELLED' THEN 'job.cancelled'
    WHEN NEW.to_status='RUNNING' THEN 'job.started' ELSE NULL END;
  IF kind IS NULL THEN RETURN NEW; END IF;
  SELECT j.buyer_account_id,v.capability_id,v.version_number INTO buyer,cap,version_number
    FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id WHERE j.id=NEW.job_id;
  INSERT INTO buyer_webhook_events(account_id,job_id,transition_id,type,payload)
    VALUES(buyer,NEW.job_id,NEW.id,kind,jsonb_build_object('jobId',NEW.job_id,
      'capabilityId',cap,'capabilityVersion',version_number,'status',NEW.to_status))
    RETURNING id INTO event_id;
  INSERT INTO buyer_webhook_deliveries(endpoint_id,event_id)
    SELECT id,event_id FROM buyer_webhook_endpoints
    WHERE account_id=buyer AND status IN ('ACTIVE','DEGRADED') AND kind=ANY(events);
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_transition_webhook_outbox AFTER INSERT ON job_transitions
  FOR EACH ROW EXECUTE FUNCTION enqueue_buyer_webhook_event();

COMMIT;
