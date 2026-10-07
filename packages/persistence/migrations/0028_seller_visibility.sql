BEGIN;

CREATE TABLE capability_visibility_changes (
  id uuid PRIMARY KEY,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  seller_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  from_visibility text NOT NULL CHECK (from_visibility IN ('DRAFT','PRIVATE','UNLISTED','PUBLIC')),
  to_visibility text NOT NULL CHECK (to_visibility IN ('PRIVATE','UNLISTED','PUBLIC')),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION guard_capability_visibility_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Capability visibility history is append-only';
END;
$$;
CREATE TRIGGER capability_visibility_change_immutable
  BEFORE UPDATE OR DELETE ON capability_visibility_changes FOR EACH ROW
  EXECUTE FUNCTION guard_capability_visibility_change();

COMMIT;
