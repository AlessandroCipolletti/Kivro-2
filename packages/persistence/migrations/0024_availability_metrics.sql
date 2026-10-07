BEGIN;

-- Samples are deliberately bounded observations, not invented continuous uptime.
CREATE TABLE capability_availability_observations (
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  minute_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ONLINE','BUSY','SCHEDULED_OFFLINE',
    'OFFLINE','PAUSED','READINESS_BLOCKED','UNAVAILABLE')),
  PRIMARY KEY (capability_id,minute_at),
  CHECK (minute_at=date_trunc('minute',minute_at)),
  CHECK (observed_at>=minute_at AND observed_at<minute_at+interval '1 minute')
);
CREATE INDEX capability_availability_observations_period_idx
  ON capability_availability_observations(minute_at,capability_id);

CREATE TABLE capability_queue_full_rejections (
  quote_id uuid PRIMARY KEY,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  rejected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capability_queue_full_rejections_period_idx
  ON capability_queue_full_rejections(capability_id,rejected_at);

CREATE TRIGGER availability_observations_immutable BEFORE UPDATE OR DELETE
  ON capability_availability_observations FOR EACH ROW
  EXECUTE FUNCTION prevent_availability_audit_rewrite();
CREATE TRIGGER queue_full_rejections_immutable BEFORE UPDATE OR DELETE
  ON capability_queue_full_rejections FOR EACH ROW
  EXECUTE FUNCTION prevent_availability_audit_rewrite();

COMMIT;
