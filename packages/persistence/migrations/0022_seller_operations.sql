BEGIN;

ALTER TABLE capability_readiness ADD COLUMN sandbox_verified boolean;
ALTER TABLE capability_readiness ADD COLUMN required_secrets_ready boolean;
ALTER TABLE capability_readiness ADD COLUMN runtime_healthy boolean;
ALTER TABLE worker_heartbeats ADD COLUMN operational_checks jsonb;
ALTER TABLE worker_heartbeats ADD COLUMN openclaw_compatibility text
  CHECK (openclaw_compatibility IN ('APPROVED_PINNED','UNAVAILABLE'));
ALTER TABLE job_control_commands ADD COLUMN override_global_pause boolean NOT NULL DEFAULT false;
ALTER TABLE worker_availability_schedules ADD COLUMN maintenance_until timestamptz;
ALTER TABLE capability_availability_policies ADD COLUMN maintenance_until timestamptz;

-- Web and local controls are separate authorities. A web resume cannot clear a
-- local emergency stop and a local resume cannot clear the cloud stop.
CREATE TABLE worker_cloud_control_revisions (
  worker_device_id uuid PRIMARY KEY REFERENCES worker_devices(id) ON DELETE RESTRICT,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  acknowledged_revision bigint NOT NULL DEFAULT 0 CHECK (acknowledged_revision >= 0 AND
    acknowledged_revision <= revision)
);
CREATE TABLE worker_local_pause_reports (
  worker_device_id uuid PRIMARY KEY REFERENCES worker_devices(id) ON DELETE RESTRICT,
  local_revision bigint NOT NULL CHECK (local_revision >= 0),
  global_paused boolean NOT NULL,
  security_paused boolean NOT NULL,
  capability_ids jsonb NOT NULL CHECK (jsonb_typeof(capability_ids)='array'),
  reported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE worker_local_capability_pauses (
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  PRIMARY KEY(worker_device_id,capability_id)
);
CREATE TABLE worker_security_blocks (
  worker_device_id uuid PRIMARY KEY REFERENCES worker_devices(id) ON DELETE RESTRICT,
  blocked boolean NOT NULL DEFAULT false,
  code text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (blocked OR resolved_at IS NOT NULL)
);
CREATE TABLE worker_operational_events (
  id uuid PRIMARY KEY,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  capability_id uuid REFERENCES capabilities(id) ON DELETE RESTRICT,
  actor_kind text NOT NULL CHECK (actor_kind IN ('SELLER','WORKER','PLATFORM')),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 160),
  kind text NOT NULL CHECK (kind IN ('LOCAL_PAUSE','LOCAL_RESUME','WEB_PAUSE','WEB_RESUME',
    'CAPABILITY_PAUSE','CAPABILITY_RESUME','SECURITY_BLOCK','SECURITY_CLEAR',
    'HEALTH_CHANGED','WORKER_RECONNECTED','WORKER_STALE')),
  code text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worker_operational_events_recent ON worker_operational_events(worker_device_id,created_at DESC);
CREATE TRIGGER worker_operational_events_immutable BEFORE UPDATE OR DELETE ON worker_operational_events
  FOR EACH ROW EXECUTE FUNCTION prevent_availability_audit_rewrite();

CREATE TABLE worker_local_job_control_reports (
  command_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  execution_id uuid NOT NULL REFERENCES job_executions(id) ON DELETE RESTRICT,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  control_plane_id text NOT NULL,
  body_hash text NOT NULL CHECK (body_hash ~ '^sha256:[a-f0-9]{64}$'),
  disposition text NOT NULL CHECK (disposition IN ('APPLIED','STALE')),
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER worker_local_job_control_reports_immutable BEFORE UPDATE OR DELETE
  ON worker_local_job_control_reports FOR EACH ROW
  EXECUTE FUNCTION prevent_availability_audit_rewrite();

COMMIT;
