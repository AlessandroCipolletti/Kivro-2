BEGIN;

ALTER TABLE worker_devices ADD COLUMN latest_heartbeat_reported_at timestamptz;
ALTER TABLE worker_devices ADD COLUMN latest_heartbeat_message_id uuid;
ALTER TABLE worker_devices ADD COLUMN latest_heartbeat_hash text
  CHECK (latest_heartbeat_hash IS NULL OR latest_heartbeat_hash ~ '^sha256:[a-f0-9]{64}$');
ALTER TABLE worker_heartbeats ADD COLUMN reported_at timestamptz;

ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN (
  'CREATED','PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED','WAITING_FOR_WORKER',
  'DISPATCHED','ACCEPTED','STARTING','RUNNING','UPLOADING_RESULT','CANCEL_REQUESTED',
  'PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED','COMPLETED',
  'REJECTED','EXPIRED','CANCELLED','FAILED_STARTUP','FAILED_POLICY','FAILED_EXECUTION',
  'TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED'
));
ALTER TABLE jobs DROP CONSTRAINT jobs_payment_required_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_payment_required_check CHECK (status NOT IN (
  'PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED','WAITING_FOR_WORKER',
  'DISPATCHED','ACCEPTED','STARTING','RUNNING','UPLOADING_RESULT','CANCEL_REQUESTED',
  'PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED','COMPLETED'
) OR payment_reservation_id IS NOT NULL);

CREATE TABLE worker_availability_schedules (
  worker_device_id uuid PRIMARY KEY REFERENCES worker_devices(id) ON DELETE RESTRICT,
  schedule jsonb NOT NULL CHECK (jsonb_typeof(schedule)='object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  seller_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE capability_availability_policies (
  capability_id uuid PRIMARY KEY REFERENCES capabilities(id) ON DELETE RESTRICT,
  schedule_override jsonb CHECK (schedule_override IS NULL OR jsonb_typeof(schedule_override)='object'),
  concurrency_limit integer NOT NULL CHECK (concurrency_limit BETWEEN 1 AND 64),
  queue_limit integer NOT NULL CHECK (queue_limit BETWEEN 0 AND 64),
  future_reservation_limit integer NOT NULL CHECK (future_reservation_limit BETWEEN 0 AND 64),
  estimated_runtime_seconds integer CHECK (estimated_runtime_seconds BETWEEN 60 AND 86400),
  max_wait_seconds integer NOT NULL CHECK (max_wait_seconds BETWEEN 60 AND 604800),
  seller_paused boolean NOT NULL DEFAULT false,
  platform_blocked boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE capability_readiness (
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid PRIMARY KEY REFERENCES capability_versions(id) ON DELETE RESTRICT,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('READY','NOT_READY','DEPENDENCY_BLOCKED')),
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capability_readiness_capability_idx ON capability_readiness(capability_id);
CREATE TABLE availability_schedule_audit (
  id uuid PRIMARY KEY,
  subject_kind text NOT NULL CHECK (subject_kind IN ('WORKER','CAPABILITY')),
  subject_id uuid NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('SELLER','PLATFORM')),
  actor_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('WEB','LOCAL_APP','API','PLATFORM')),
  old_value jsonb,
  new_value jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject_kind,subject_id,revision)
);
CREATE FUNCTION prevent_availability_audit_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Availability audit is append only'; END;
$$;
CREATE TRIGGER availability_audit_immutable BEFORE UPDATE OR DELETE ON availability_schedule_audit
  FOR EACH ROW EXECUTE FUNCTION prevent_availability_audit_rewrite();

CREATE TABLE job_schedule_quotes (
  id uuid PRIMARY KEY,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  execution_mode text NOT NULL CHECK (execution_mode IN ('IMMEDIATE_ONLY','EARLIEST_AVAILABLE')),
  price_snapshot jsonb NOT NULL CHECK (jsonb_typeof(price_snapshot)='object'),
  worker_state_at_quote text NOT NULL CHECK (worker_state_at_quote IN
    ('ONLINE','BUSY','OFFLINE','PAUSED','READINESS_BLOCKED')),
  earliest_eligible_at timestamptz NOT NULL,
  planned_window_start_at timestamptz NOT NULL,
  latest_start_at timestamptz NOT NULL,
  requested_deadline_at timestamptz,
  expires_at timestamptz NOT NULL,
  capability_schedule_revision integer NOT NULL,
  worker_schedule_revision integer NOT NULL,
  accepted_job_id uuid UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latest_start_at >= earliest_eligible_at),
  CHECK (expires_at > created_at)
);
CREATE INDEX job_schedule_quotes_expiry_idx ON job_schedule_quotes(expires_at);
CREATE FUNCTION protect_schedule_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR
    NEW.buyer_account_id IS DISTINCT FROM OLD.buyer_account_id OR
    NEW.capability_id IS DISTINCT FROM OLD.capability_id OR
    NEW.capability_version_id IS DISTINCT FROM OLD.capability_version_id OR
    NEW.worker_device_id IS DISTINCT FROM OLD.worker_device_id OR
    NEW.execution_mode IS DISTINCT FROM OLD.execution_mode OR
    NEW.price_snapshot IS DISTINCT FROM OLD.price_snapshot OR
    NEW.worker_state_at_quote IS DISTINCT FROM OLD.worker_state_at_quote OR
    NEW.earliest_eligible_at IS DISTINCT FROM OLD.earliest_eligible_at OR
    NEW.planned_window_start_at IS DISTINCT FROM OLD.planned_window_start_at OR
    NEW.latest_start_at IS DISTINCT FROM OLD.latest_start_at OR
    NEW.requested_deadline_at IS DISTINCT FROM OLD.requested_deadline_at OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.capability_schedule_revision IS DISTINCT FROM OLD.capability_schedule_revision OR
    NEW.worker_schedule_revision IS DISTINCT FROM OLD.worker_schedule_revision OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.accepted_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Schedule quote is immutable after booking';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_schedule_quotes_protected BEFORE UPDATE OR DELETE ON job_schedule_quotes
  FOR EACH ROW EXECUTE FUNCTION protect_schedule_quote();
CREATE TABLE job_schedule_plans (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL UNIQUE REFERENCES job_schedule_quotes(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  execution_mode text NOT NULL CHECK (execution_mode IN ('IMMEDIATE_ONLY','EARLIEST_AVAILABLE')),
  scheduled_for_earliest_at timestamptz NOT NULL,
  planned_window_start_at timestamptz NOT NULL,
  next_eligible_at timestamptz NOT NULL,
  schedule_revision integer NOT NULL DEFAULT 1 CHECK (schedule_revision > 0),
  latest_start_at timestamptz NOT NULL,
  eligible_at timestamptz,
  queued_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latest_start_at >= scheduled_for_earliest_at)
);
CREATE INDEX job_schedule_plans_due_idx ON job_schedule_plans
  ((coalesce(last_reconciled_at,created_at)),next_eligible_at,job_id);
CREATE INDEX job_schedule_plans_capacity_idx ON job_schedule_plans(capability_id,planned_window_start_at);
CREATE FUNCTION protect_schedule_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.job_id IS DISTINCT FROM OLD.job_id OR
    NEW.quote_id IS DISTINCT FROM OLD.quote_id OR
    NEW.capability_id IS DISTINCT FROM OLD.capability_id OR
    NEW.execution_mode IS DISTINCT FROM OLD.execution_mode OR
    NEW.scheduled_for_earliest_at IS DISTINCT FROM OLD.scheduled_for_earliest_at OR
    NEW.latest_start_at IS DISTINCT FROM OLD.latest_start_at OR
    NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Original job schedule promise is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_schedule_plans_protected BEFORE UPDATE OR DELETE ON job_schedule_plans
  FOR EACH ROW EXECUTE FUNCTION protect_schedule_plan();
CREATE TABLE job_schedule_events (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  effect_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('BOOKED','ELIGIBLE','WAITING','SCHEDULE_CHANGED',
    'WORKER_OFFLINE','EXPIRED','CANCELLED','STARTED','DELIVERED','FAILED')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_schedule_events_job_idx ON job_schedule_events(job_id,created_at);
CREATE TRIGGER job_schedule_events_immutable BEFORE UPDATE OR DELETE ON job_schedule_events
  FOR EACH ROW EXECUTE FUNCTION prevent_availability_audit_rewrite();
CREATE FUNCTION scheduled_lifecycle_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_kind text;
BEGIN
  IF NEW.to_status='RUNNING' THEN event_kind:='STARTED';
  ELSIF NEW.to_status='COMPLETED' THEN event_kind:='DELIVERED';
  ELSIF NEW.to_status IN ('REJECTED','FAILED_STARTUP','FAILED_POLICY',
    'FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED') THEN event_kind:='FAILED';
  ELSE RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM job_schedule_plans WHERE job_id=NEW.job_id) THEN
    INSERT INTO job_schedule_events(id,job_id,effect_key,kind,details)
      VALUES(gen_random_uuid(),NEW.job_id,
        'job:'||NEW.job_id||':transition:'||NEW.id,event_kind,
        jsonb_build_object('status',NEW.to_status,'transitionId',NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scheduled_lifecycle_event_insert AFTER INSERT ON job_transitions
  FOR EACH ROW EXECUTE FUNCTION scheduled_lifecycle_event();

COMMIT;
