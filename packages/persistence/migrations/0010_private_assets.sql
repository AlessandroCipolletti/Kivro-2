BEGIN;

CREATE TABLE assets (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  source_job_id uuid REFERENCES jobs(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('BUYER_INPUT', 'JOB_OUTPUT', 'EXAMPLE')),
  state text NOT NULL CHECK (state IN ('PENDING_UPLOAD', 'READY', 'QUARANTINED', 'EXPIRED', 'DELETED')),
  object_key text NOT NULL UNIQUE CHECK (object_key ~ '^private/assets/[a-f0-9-]{36}/[a-f0-9-]{36}$'),
  size_bytes bigint CHECK (size_bytes >= 0),
  sha256 text CHECK (sha256 ~ '^sha256:[a-f0-9]{64}$'),
  detected_mime_type text CHECK (length(detected_mime_type) BETWEEN 3 AND 120),
  retain_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CHECK (kind <> 'JOB_OUTPUT' OR source_job_id IS NOT NULL),
  CHECK (state <> 'READY' OR (size_bytes IS NOT NULL AND sha256 IS NOT NULL AND detected_mime_type IS NOT NULL AND finalized_at IS NOT NULL))
);
CREATE INDEX assets_owner_created_idx ON assets(owner_account_id, created_at DESC);
CREATE INDEX assets_source_job_idx ON assets(source_job_id);
CREATE INDEX assets_retention_idx ON assets(retain_until) WHERE state IN ('READY', 'QUARANTINED', 'EXPIRED');

CREATE FUNCTION guard_asset_owner_and_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_buyer uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.source_job_id IS NOT NULL THEN
      SELECT buyer_account_id INTO source_buyer FROM jobs WHERE id = NEW.source_job_id FOR SHARE;
      IF source_buyer IS DISTINCT FROM NEW.owner_account_id THEN
        RAISE EXCEPTION 'Source job and asset owner mismatch';
      END IF;
    END IF;
  ELSE
    IF NEW.owner_account_id IS DISTINCT FROM OLD.owner_account_id OR
       NEW.source_job_id IS DISTINCT FROM OLD.source_job_id OR
       NEW.kind IS DISTINCT FROM OLD.kind OR NEW.object_key IS DISTINCT FROM OLD.object_key OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Asset identity and ownership are immutable';
    END IF;
    IF OLD.state = 'DELETED' OR
       (OLD.state = 'PENDING_UPLOAD' AND NEW.state NOT IN ('PENDING_UPLOAD', 'READY', 'QUARANTINED', 'DELETED')) OR
       (OLD.state = 'READY' AND NEW.state NOT IN ('READY', 'QUARANTINED', 'EXPIRED', 'DELETED')) OR
       (OLD.state = 'QUARANTINED' AND NEW.state NOT IN ('QUARANTINED', 'DELETED')) OR
       (OLD.state = 'EXPIRED' AND NEW.state NOT IN ('EXPIRED', 'DELETED')) THEN
      RAISE EXCEPTION 'Illegal asset lifecycle transition';
    END IF;
    IF OLD.state <> 'PENDING_UPLOAD' AND (NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR
       NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.detected_mime_type IS DISTINCT FROM OLD.detected_mime_type OR
       NEW.finalized_at IS DISTINCT FROM OLD.finalized_at) THEN
      RAISE EXCEPTION 'Finalized asset metadata is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assets_guard BEFORE INSERT OR UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION guard_asset_owner_and_lifecycle();

CREATE TABLE asset_read_grants (
  id uuid PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  target_job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, target_job_id),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX asset_read_grants_target_idx ON asset_read_grants(target_job_id);

CREATE FUNCTION guard_asset_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_owner uuid; job_buyer uuid; asset_state text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT owner_account_id, state INTO asset_owner, asset_state FROM assets WHERE id = NEW.asset_id FOR SHARE;
    SELECT buyer_account_id INTO job_buyer FROM jobs WHERE id = NEW.target_job_id FOR SHARE;
    IF asset_owner IS DISTINCT FROM job_buyer OR asset_state <> 'READY' OR NEW.expires_at <= now() THEN
      RAISE EXCEPTION 'Asset grant requires ready asset and same buyer';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Asset grants are not deleted; revoke them';
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.asset_id IS DISTINCT FROM OLD.asset_id OR
       NEW.target_job_id IS DISTINCT FROM OLD.target_job_id OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Only one-way asset grant revocation is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER asset_grants_guard BEFORE INSERT OR UPDATE OR DELETE ON asset_read_grants
  FOR EACH ROW EXECUTE FUNCTION guard_asset_grant();

COMMIT;
