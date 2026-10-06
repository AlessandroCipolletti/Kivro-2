BEGIN;

-- Discovery/visibility is distinct from Worker availability and version state.
ALTER TABLE capabilities ADD COLUMN visibility text NOT NULL DEFAULT 'DRAFT'
  CHECK (visibility IN ('DRAFT','PRIVATE','UNLISTED','PUBLIC'));

-- A published version_snapshot remains immutable. Lifecycle routing is separate.
CREATE TABLE capability_version_lifecycle (
  version_id uuid PRIMARY KEY REFERENCES capability_versions(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('DRAFT','TESTING','READY_TO_PUBLISH','PUBLISHED','RETIRED')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO capability_version_lifecycle(version_id,state)
  SELECT id, publication_state FROM capability_versions;

CREATE FUNCTION initialize_capability_version_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO capability_version_lifecycle(version_id,state) VALUES (NEW.id,NEW.publication_state);
  RETURN NEW;
END;
$$;
CREATE TRIGGER capability_version_lifecycle_insert
  AFTER INSERT ON capability_versions FOR EACH ROW
  EXECUTE FUNCTION initialize_capability_version_lifecycle();

CREATE FUNCTION guard_capability_version_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stored_state text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Version lifecycle cannot be deleted'; END IF;
  IF NEW.version_id IS DISTINCT FROM OLD.version_id THEN RAISE EXCEPTION 'Version lifecycle identity is immutable'; END IF;
  IF NEW.state = OLD.state THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.state = 'DRAFT' AND NEW.state = 'TESTING') OR
    (OLD.state = 'TESTING' AND NEW.state IN ('DRAFT','READY_TO_PUBLISH')) OR
    (OLD.state = 'READY_TO_PUBLISH' AND NEW.state IN ('DRAFT','TESTING','PUBLISHED')) OR
    (OLD.state = 'PUBLISHED' AND NEW.state = 'RETIRED')
  ) THEN RAISE EXCEPTION 'Illegal capability version lifecycle transition'; END IF;
  SELECT publication_state INTO stored_state FROM capability_versions WHERE id = NEW.version_id;
  IF NEW.state IN ('PUBLISHED','RETIRED') AND stored_state <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published lifecycle requires immutable published version';
  END IF;
  IF NEW.state = 'RETIRED' AND EXISTS (
    SELECT 1 FROM capabilities WHERE current_version_id = NEW.version_id
  ) THEN RAISE EXCEPTION 'Active version cannot be retired'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER capability_version_lifecycle_guard
  BEFORE UPDATE OR DELETE ON capability_version_lifecycle FOR EACH ROW
  EXECUTE FUNCTION guard_capability_version_lifecycle();

CREATE FUNCTION guard_capability_visibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_state text;
DECLARE payout text;
BEGIN
  IF NEW.visibility = 'DRAFT' THEN RETURN NEW; END IF;
  SELECT lifecycle.state INTO active_state
    FROM capability_version_lifecycle lifecycle
    WHERE lifecycle.version_id = NEW.current_version_id;
  IF active_state IS DISTINCT FROM 'PUBLISHED' THEN
    RAISE EXCEPTION 'Non-draft visibility requires an active published version';
  END IF;
  IF NEW.visibility = 'PUBLIC' THEN
    SELECT payout_status INTO payout FROM seller_profiles WHERE id = NEW.seller_profile_id;
    IF payout IS DISTINCT FROM 'READY' THEN RAISE EXCEPTION 'Public visibility requires ready seller payout'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER capability_visibility_guard
  BEFORE INSERT OR UPDATE ON capabilities FOR EACH ROW
  EXECUTE FUNCTION guard_capability_visibility();

CREATE TABLE capability_private_grants (
  id uuid PRIMARY KEY,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  granted_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX capability_private_grants_active_unique
  ON capability_private_grants(capability_id,buyer_account_id) WHERE revoked_at IS NULL;

CREATE FUNCTION guard_capability_private_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid;
DECLARE current_visibility text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Private grant history is append-only'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
      (NEW.id,NEW.capability_id,NEW.buyer_account_id,NEW.granted_by_account_id,NEW.granted_at)
      IS DISTINCT FROM
      (OLD.id,OLD.capability_id,OLD.buyer_account_id,OLD.granted_by_account_id,OLD.granted_at)
    THEN RAISE EXCEPTION 'Private grant can only be revoked once'; END IF;
    RETURN NEW;
  END IF;
  SELECT sp.account_id,c.visibility INTO owner_id,current_visibility
    FROM capabilities c JOIN seller_profiles sp ON sp.id = c.seller_profile_id
    WHERE c.id = NEW.capability_id;
  IF owner_id IS DISTINCT FROM NEW.granted_by_account_id OR current_visibility <> 'PRIVATE' THEN
    RAISE EXCEPTION 'Private grant requires seller ownership and private visibility';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER capability_private_grant_guard
  BEFORE INSERT OR UPDATE OR DELETE ON capability_private_grants FOR EACH ROW
  EXECUTE FUNCTION guard_capability_private_grant();

COMMIT;
