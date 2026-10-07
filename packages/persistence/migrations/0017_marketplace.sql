BEGIN;

CREATE TABLE capability_marketplace_metadata (
  capability_id uuid PRIMARY KEY REFERENCES capabilities(id) ON DELETE RESTRICT,
  category text NOT NULL DEFAULT 'OTHER' CHECK (category IN
    ('RESEARCH','DATA_ANALYSIS','DOCUMENTS','DEVELOPMENT','MEDIA','BUSINESS','OTHER')),
  short_description text NOT NULL DEFAULT '' CHECK (length(short_description) <= 320),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 8),
  strengths text[] NOT NULL DEFAULT '{}' CHECK (cardinality(strengths) <= 8),
  limitations text[] NOT NULL DEFAULT '{}' CHECK (cardinality(limitations) <= 8),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capability_marketplace_category_idx ON capability_marketplace_metadata(category);

CREATE TABLE buyer_favorites (
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(buyer_account_id,capability_id)
);
CREATE INDEX buyer_favorites_recent_idx ON buyer_favorites(buyer_account_id,created_at DESC);

CREATE TABLE marketplace_terms_acceptances (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version=1),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,version)
);
CREATE FUNCTION no_marketplace_terms_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Marketplace terms acceptance is append-only'; END; $$;
CREATE TRIGGER marketplace_terms_acceptances_immutable BEFORE UPDATE OR DELETE
  ON marketplace_terms_acceptances FOR EACH ROW EXECUTE FUNCTION no_marketplace_terms_rewrite();

CREATE TABLE capability_reviews (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL DEFAULT '' CHECK (length(review_text) <= 1200),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capability_reviews_capability_idx ON capability_reviews(capability_id,created_at DESC);
CREATE INDEX capability_reviews_seller_idx ON capability_reviews(seller_profile_id,created_at DESC);
CREATE TABLE capability_review_revisions (
  review_id uuid NOT NULL REFERENCES capability_reviews(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL CHECK (length(review_text) <= 1200),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(review_id,revision)
);
CREATE FUNCTION guard_review_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual_buyer uuid; actual_version uuid; actual_capability uuid; actual_seller uuid;
  actual_status text; actual_payment text; seller_account uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Review identity cannot be deleted'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.job_id,NEW.buyer_account_id,NEW.capability_id,NEW.capability_version_id,
      NEW.seller_profile_id,NEW.created_at) IS DISTINCT FROM
      (OLD.id,OLD.job_id,OLD.buyer_account_id,OLD.capability_id,OLD.capability_version_id,
      OLD.seller_profile_id,OLD.created_at) OR NEW.revision<>OLD.revision+1 THEN
      RAISE EXCEPTION 'Review identity is immutable'; END IF;
    RETURN NEW;
  END IF;
  SELECT j.buyer_account_id,j.capability_version_id,v.capability_id,c.seller_profile_id,
    j.status,p.state,s.account_id
    INTO actual_buyer,actual_version,actual_capability,actual_seller,
      actual_status,actual_payment,seller_account
    FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
    JOIN capabilities c ON c.id=v.capability_id JOIN seller_profiles s ON s.id=c.seller_profile_id
    LEFT JOIN job_payment_states p ON p.job_id=j.id WHERE j.id=NEW.job_id;
  IF (NEW.buyer_account_id,NEW.capability_version_id,NEW.capability_id,NEW.seller_profile_id)
    IS DISTINCT FROM (actual_buyer,actual_version,actual_capability,actual_seller) OR
    actual_status IS DISTINCT FROM 'COMPLETED' OR actual_payment IS DISTINCT FROM 'SETTLED' OR
    seller_account=NEW.buyer_account_id THEN
    RAISE EXCEPTION 'Review must match its paid job'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER capability_reviews_guard BEFORE INSERT OR UPDATE OR DELETE ON capability_reviews
  FOR EACH ROW EXECUTE FUNCTION guard_review_identity();
CREATE FUNCTION no_review_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Review revisions are append-only'; END; $$;
CREATE TRIGGER capability_review_revisions_immutable BEFORE UPDATE OR DELETE ON capability_review_revisions
  FOR EACH ROW EXECUTE FUNCTION no_review_revision_mutation();

CREATE TABLE capability_examples (
  id uuid PRIMARY KEY,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1200),
  input_payload jsonb NOT NULL CHECK (jsonb_typeof(input_payload)='object'),
  output_payload jsonb NOT NULL CHECK (jsonb_typeof(output_payload)='object'),
  source text NOT NULL CHECK (source IN ('REAL_EXECUTION','SELLER_CURATED')),
  publication_state text NOT NULL CHECK (publication_state IN ('DRAFT','PUBLISHED','NEEDS_REVALIDATION')),
  seller_approved_at timestamptz,
  display_order smallint NOT NULL CHECK (display_order BETWEEN 0 AND 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(capability_version_id,display_order),
  CHECK (publication_state<>'PUBLISHED' OR seller_approved_at IS NOT NULL)
);
CREATE INDEX capability_examples_public_idx ON capability_examples(capability_version_id,display_order)
  WHERE publication_state='PUBLISHED';
CREATE TABLE capability_example_assets (
  example_id uuid NOT NULL REFERENCES capability_examples(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('INPUT','OUTPUT')),
  field_key text NOT NULL CHECK (length(field_key) BETWEEN 1 AND 64),
  PRIMARY KEY(example_id,asset_id)
);
CREATE FUNCTION guard_public_example_asset() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE seller_account uuid; asset_owner uuid; asset_kind text; asset_state text; source_job uuid;
BEGIN
  SELECT s.account_id INTO seller_account FROM capability_examples e
    JOIN capabilities c ON c.id=e.capability_id JOIN seller_profiles s ON s.id=c.seller_profile_id
    WHERE e.id=NEW.example_id;
  SELECT owner_account_id,kind,state,source_job_id INTO asset_owner,asset_kind,asset_state,source_job
    FROM assets WHERE id=NEW.asset_id;
  IF asset_owner IS DISTINCT FROM seller_account OR asset_kind IS DISTINCT FROM 'EXAMPLE' OR
    asset_state IS DISTINCT FROM 'READY' OR source_job IS NOT NULL THEN
    RAISE EXCEPTION 'Only seller-owned approved example assets may be linked'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER capability_example_assets_guard BEFORE INSERT ON capability_example_assets
  FOR EACH ROW EXECUTE FUNCTION guard_public_example_asset();

CREATE TABLE buyer_job_problem_reports (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('MISSING_OUTPUT','CORRUPT_FILE','QUALITY','OTHER')),
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id,buyer_account_id,category)
);
CREATE INDEX buyer_job_problem_reports_job_idx ON buyer_job_problem_reports(job_id,created_at DESC);
CREATE FUNCTION guard_problem_report() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual_buyer uuid; actual_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Problem reports are append-only'; END IF;
  SELECT buyer_account_id,status INTO actual_buyer,actual_status FROM jobs WHERE id=NEW.job_id;
  IF actual_buyer IS DISTINCT FROM NEW.buyer_account_id OR actual_status NOT IN
    ('COMPLETED','RESULT_REJECTED','FAILED_EXECUTION','FAILED_POLICY','TIMED_OUT') THEN
    RAISE EXCEPTION 'Problem report must belong to terminal buyer job'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER buyer_job_problem_reports_guard BEFORE INSERT OR UPDATE OR DELETE
  ON buyer_job_problem_reports FOR EACH ROW EXECUTE FUNCTION guard_problem_report();

COMMIT;
