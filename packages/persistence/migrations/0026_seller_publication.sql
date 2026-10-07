BEGIN;

-- Worker-signed, seller-private review projections. No personal OpenClaw data or secret values.
CREATE TABLE capability_publication_reviews (
  id uuid PRIMARY KEY,
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL,
  capability_version_id uuid NOT NULL UNIQUE,
  review_hash text NOT NULL CHECK (review_hash ~ '^sha256:[a-f0-9]{64}$'),
  review_json jsonb NOT NULL CHECK (jsonb_typeof(review_json)='object'),
  state text NOT NULL DEFAULT 'REVIEW' CHECK (state IN ('REVIEW','PUBLISHED')),
  approval_hash text CHECK (approval_hash ~ '^sha256:[a-f0-9]{64}$'),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state='PUBLISHED')=(approval_hash IS NOT NULL AND published_at IS NOT NULL))
);
CREATE INDEX capability_publication_reviews_seller_idx
  ON capability_publication_reviews(seller_profile_id,created_at DESC);

CREATE FUNCTION guard_capability_publication_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Publication review cannot be deleted'; END IF;
  IF OLD.state='PUBLISHED' OR NEW.state<>'PUBLISHED' OR
    (NEW.id,NEW.seller_profile_id,NEW.worker_device_id,NEW.capability_id,
      NEW.capability_version_id,NEW.review_hash,NEW.review_json,NEW.created_at)
    IS DISTINCT FROM
    (OLD.id,OLD.seller_profile_id,OLD.worker_device_id,OLD.capability_id,
      OLD.capability_version_id,OLD.review_hash,OLD.review_json,OLD.created_at)
  THEN RAISE EXCEPTION 'Publication review is immutable except final publication'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER capability_publication_review_guard BEFORE UPDATE OR DELETE
  ON capability_publication_reviews FOR EACH ROW EXECUTE FUNCTION guard_capability_publication_review();

CREATE TABLE capability_permission_consents (
  id uuid PRIMARY KEY,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  seller_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  worker_device_id uuid NOT NULL REFERENCES worker_devices(id) ON DELETE RESTRICT,
  dependency_id text NOT NULL,
  permission_type text NOT NULL,
  permission_value_ref text NOT NULL,
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^sha256:[a-f0-9]{64}$'),
  approved_at timestamptz NOT NULL,
  UNIQUE(capability_version_id,dependency_id)
);
CREATE FUNCTION no_capability_permission_consent_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Capability permission consents are append-only'; END; $$;
CREATE TRIGGER capability_permission_consents_immutable BEFORE UPDATE OR DELETE
  ON capability_permission_consents FOR EACH ROW
  EXECUTE FUNCTION no_capability_permission_consent_rewrite();

COMMIT;
