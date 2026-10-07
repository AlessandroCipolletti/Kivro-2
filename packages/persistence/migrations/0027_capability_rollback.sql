BEGIN;

-- A rollback may reactivate an immutable historical published version only
-- after the owner service has atomically changed the active pointer.
CREATE OR REPLACE FUNCTION guard_capability_version_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stored_state text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Version lifecycle cannot be deleted'; END IF;
  IF NEW.version_id IS DISTINCT FROM OLD.version_id THEN RAISE EXCEPTION 'Version lifecycle identity is immutable'; END IF;
  IF NEW.state = OLD.state THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.state = 'DRAFT' AND NEW.state = 'TESTING') OR
    (OLD.state = 'TESTING' AND NEW.state IN ('DRAFT','READY_TO_PUBLISH')) OR
    (OLD.state = 'READY_TO_PUBLISH' AND NEW.state IN ('DRAFT','TESTING','PUBLISHED')) OR
    (OLD.state = 'PUBLISHED' AND NEW.state = 'RETIRED') OR
    (OLD.state = 'RETIRED' AND NEW.state = 'PUBLISHED' AND EXISTS (
      SELECT 1 FROM capabilities WHERE current_version_id = NEW.version_id
    ))
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

CREATE TABLE capability_version_activations (
  id uuid PRIMARY KEY,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  from_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  to_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  seller_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action='ROLLBACK'),
  activated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_version_id<>to_version_id)
);
CREATE TRIGGER capability_version_activations_immutable BEFORE UPDATE OR DELETE
  ON capability_version_activations FOR EACH ROW
  EXECUTE FUNCTION no_capability_permission_consent_rewrite();

COMMIT;
