BEGIN;

-- Explicit first-publication acknowledgement; a profile alone is not consent to local execution.
CREATE TABLE seller_execution_model_acknowledgements (
  seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  statement_version integer NOT NULL CHECK (statement_version > 0),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_profile_id, statement_version)
);

CREATE FUNCTION guard_seller_execution_model_acknowledgement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eligible boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Seller execution acknowledgement is append-only'; END IF;
  SELECT a.status = 'ACTIVE' AND a.auth_email_verified
    INTO eligible FROM seller_profiles s JOIN accounts a ON a.id = s.account_id
    WHERE s.id = NEW.seller_profile_id;
  IF eligible IS DISTINCT FROM true THEN RAISE EXCEPTION 'Seller acknowledgement requires an eligible account'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER seller_execution_model_ack_guard
  BEFORE INSERT OR UPDATE OR DELETE ON seller_execution_model_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION guard_seller_execution_model_acknowledgement();

COMMIT;
