BEGIN;

-- Security audit rows contain event classification only. No email, IP,
-- credential, session token, callback URL, or OAuth material is copied here.
CREATE TABLE auth_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (event_type IN (
    'ACCOUNT_CREATED', 'EMAIL_VERIFIED', 'CREDENTIAL_CREATED',
    'GOOGLE_IDENTITY_LINKED', 'PASSWORD_UPDATED', 'SESSION_CREATED',
    'SESSION_REVOKED', 'SIGN_UP_EMAIL_REQUEST', 'SIGN_IN_EMAIL_REQUEST',
    'SEND_VERIFICATION_REQUEST', 'VERIFY_EMAIL_REQUEST',
    'RESET_REQUEST', 'RESET_PASSWORD_REQUEST', 'GOOGLE_SIGN_IN_REQUEST',
    'GOOGLE_CALLBACK_REQUEST'
  )),
  account_id uuid,
  http_status smallint CHECK (http_status BETWEEN 100 AND 599),
  CHECK ((event_type LIKE '%_REQUEST') = (http_status IS NOT NULL))
);
CREATE INDEX auth_audit_events_account_idx ON auth_audit_events(account_id, occurred_at DESC)
  WHERE account_id IS NOT NULL;
CREATE INDEX auth_audit_events_type_time_idx ON auth_audit_events(event_type, occurred_at DESC);

CREATE FUNCTION auth_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Auth audit is append-only';
END;
$$;
CREATE TRIGGER auth_audit_no_update BEFORE UPDATE ON auth_audit_events
  FOR EACH ROW EXECUTE FUNCTION auth_audit_immutable();
CREATE TRIGGER auth_audit_no_delete BEFORE DELETE ON auth_audit_events
  FOR EACH ROW EXECUTE FUNCTION auth_audit_immutable();

CREATE FUNCTION audit_account_auth_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auth_audit_events(event_type, account_id) VALUES ('ACCOUNT_CREATED', NEW.id);
  ELSIF NEW.auth_email_verified AND NOT OLD.auth_email_verified THEN
    INSERT INTO auth_audit_events(event_type, account_id) VALUES ('EMAIL_VERIFIED', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_auth_audit AFTER INSERT OR UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION audit_account_auth_change();

CREATE FUNCTION audit_identity_auth_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auth_audit_events(event_type, account_id)
      VALUES (CASE WHEN NEW.provider = 'google' THEN 'GOOGLE_IDENTITY_LINKED' ELSE 'CREDENTIAL_CREATED' END,
        NEW.account_id);
  ELSIF NEW.provider = 'credential' AND NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    INSERT INTO auth_audit_events(event_type, account_id) VALUES ('PASSWORD_UPDATED', NEW.account_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_identities_auth_audit AFTER INSERT OR UPDATE ON account_identities
  FOR EACH ROW EXECUTE FUNCTION audit_identity_auth_change();

CREATE FUNCTION audit_session_auth_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth_audit_events(event_type, account_id)
    VALUES (CASE WHEN TG_OP = 'INSERT' THEN 'SESSION_CREATED' ELSE 'SESSION_REVOKED' END,
      CASE WHEN TG_OP = 'INSERT' THEN NEW.account_id ELSE OLD.account_id END);
  RETURN CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END;
END;
$$;
CREATE TRIGGER auth_sessions_insert_audit AFTER INSERT ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_session_auth_change();
CREATE TRIGGER auth_sessions_delete_audit AFTER DELETE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_session_auth_change();

COMMIT;
