BEGIN;

-- Expand the common job vocabulary without rewriting historical rows.
ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN (
  'CREATED', 'PAYMENT_RESERVED', 'QUEUED', 'WAITING_FOR_WORKER', 'DISPATCHED',
  'ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT', 'CANCEL_REQUESTED',
  'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED', 'SECURITY_PAUSED',
  'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED_STARTUP',
  'FAILED_POLICY', 'FAILED_EXECUTION', 'TIMED_OUT', 'WORKER_OFFLINE', 'RESULT_REJECTED'
));
ALTER TABLE jobs DROP CONSTRAINT jobs_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_payment_required_check CHECK (status NOT IN (
  'PAYMENT_RESERVED', 'QUEUED', 'WAITING_FOR_WORKER', 'DISPATCHED', 'ACCEPTED',
  'STARTING', 'RUNNING', 'UPLOADING_RESULT', 'CANCEL_REQUESTED',
  'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED', 'SECURITY_PAUSED', 'COMPLETED'
) OR payment_reservation_id IS NOT NULL);

CREATE TABLE job_executions (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL UNIQUE,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  control_plane_id text NOT NULL CHECK (length(control_plane_id) BETWEEN 1 AND 160),
  lease_key_version text NOT NULL CHECK (length(lease_key_version) BETWEEN 1 AND 80),
  lease_token_hash text NOT NULL CHECK (lease_token_hash ~ '^sha256:[a-f0-9]{64}$'),
  lease_expires_at timestamptz NOT NULL,
  offer_expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lease_expires_at > created_at),
  CHECK (offer_expires_at > created_at)
);
CREATE UNIQUE INDEX job_executions_one_active ON job_executions(job_id) WHERE completed_at IS NULL;
CREATE INDEX job_executions_worker_lease_idx ON job_executions(worker_device_id, lease_expires_at);

CREATE TABLE job_input_manifests (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  schema_hash text NOT NULL CHECK (schema_hash ~ '^sha256:[a-f0-9]{64}$'),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  total_bytes bigint NOT NULL CHECK (total_bytes >= 0),
  file_count integer NOT NULL CHECK (file_count BETWEEN 0 AND 50),
  finalized_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION prevent_input_manifest_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Finalized input manifests are immutable';
END;
$$;
CREATE TRIGGER job_input_manifests_immutable BEFORE UPDATE OR DELETE ON job_input_manifests
  FOR EACH ROW EXECUTE FUNCTION prevent_input_manifest_rewrite();

CREATE TABLE worker_message_receipts (
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL,
  body_hash text NOT NULL CHECK (body_hash ~ '^sha256:[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_device_id, message_id)
);

CREATE TABLE worker_heartbeats (
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  control_plane_id text NOT NULL CHECK (length(control_plane_id) BETWEEN 1 AND 160),
  worker_release text NOT NULL CHECK (length(worker_release) BETWEEN 1 AND 80),
  openclaw_version text,
  reported_status text NOT NULL CHECK (reported_status IN ('ONLINE','PAUSED','NOT_READY')),
  running_jobs integer NOT NULL CHECK (running_jobs BETWEEN 0 AND 64),
  capacity integer NOT NULL CHECK (capacity BETWEEN 0 AND 64),
  policy_version integer NOT NULL CHECK (policy_version > 0),
  local_revision integer NOT NULL CHECK (local_revision >= 0),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_device_id, control_plane_id)
);
CREATE INDEX worker_heartbeats_observed_idx ON worker_heartbeats(observed_at);

CREATE TABLE worker_pairing_codes (
  id uuid PRIMARY KEY,
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^sha256:[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  paired_device_id uuid REFERENCES worker_devices(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((consumed_at IS NULL) = (paired_device_id IS NULL))
);
CREATE INDEX worker_pairing_codes_seller_idx ON worker_pairing_codes(seller_profile_id,expires_at);
CREATE UNIQUE INDEX worker_devices_public_key_unique ON worker_devices(public_key);

CREATE TABLE job_control_commands (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  execution_id uuid NOT NULL REFERENCES job_executions(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('PAUSE','RESUME','CANCEL')),
  source text NOT NULL CHECK (source IN ('WEB','LOCAL_UI','CLI','PLATFORM_SECURITY')),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 160),
  reason text CHECK (length(reason) <= 200),
  previous_state text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  resulting_state text,
  last_failure_status text CHECK (last_failure_status IN ('CONTROL_FAILED','RESUME_NOT_READY',
    'DEPENDENCY_UNAVAILABLE','INFERENCE_UNAVAILABLE','SECURITY_BLOCK')),
  last_failure_at timestamptz,
  pause_support text NOT NULL CHECK (pause_support IN ('FULL_RESUME','RESTART_STEP','NOT_SUPPORTED')),
  CHECK ((confirmed_at IS NULL) = (resulting_state IS NULL)),
  CHECK ((last_failure_status IS NULL) = (last_failure_at IS NULL))
);
CREATE INDEX job_control_commands_job_idx ON job_control_commands(job_id, requested_at);

CREATE TABLE job_result_manifests (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  execution_id uuid NOT NULL REFERENCES job_executions(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, job_id)
);
CREATE TABLE job_result_assets (
  manifest_id uuid NOT NULL REFERENCES job_result_manifests(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL UNIQUE REFERENCES assets(id) ON DELETE RESTRICT,
  field_key text NOT NULL CHECK (length(field_key) BETWEEN 1 AND 160),
  PRIMARY KEY (manifest_id, asset_id)
);
ALTER TABLE jobs ADD CONSTRAINT jobs_result_manifest_fk
  FOREIGN KEY (result_manifest_id, id) REFERENCES job_result_manifests(id, job_id) ON DELETE RESTRICT;

CREATE FUNCTION prevent_result_manifest_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Finalized result manifests are immutable';
END;
$$;
CREATE TRIGGER job_result_manifests_immutable BEFORE UPDATE OR DELETE ON job_result_manifests
  FOR EACH ROW EXECUTE FUNCTION prevent_result_manifest_rewrite();
CREATE TRIGGER job_result_assets_immutable BEFORE UPDATE OR DELETE ON job_result_assets
  FOR EACH ROW EXECUTE FUNCTION prevent_result_manifest_rewrite();

CREATE FUNCTION prevent_job_control_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR
    NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.execution_id IS DISTINCT FROM OLD.execution_id OR
    NEW.action IS DISTINCT FROM OLD.action OR NEW.source IS DISTINCT FROM OLD.source OR
    NEW.actor_id IS DISTINCT FROM OLD.actor_id OR NEW.reason IS DISTINCT FROM OLD.reason OR
    NEW.previous_state IS DISTINCT FROM OLD.previous_state OR NEW.requested_at IS DISTINCT FROM OLD.requested_at OR
    NEW.pause_support IS DISTINCT FROM OLD.pause_support OR OLD.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Job control command history is append-only';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_control_commands_immutable BEFORE UPDATE OR DELETE ON job_control_commands
  FOR EACH ROW EXECUTE FUNCTION prevent_job_control_rewrite();

COMMIT;
