\set ON_ERROR_STOP on

INSERT INTO accounts(id, primary_email, auth_name, auth_email_verified)
VALUES ('16d302e5-4f9b-4ca3-9733-397a1ef4bac5', 'seller@example.test', 'Seller', false);
INSERT INTO accounts(id, primary_email, auth_name, auth_email_verified)
VALUES ('f01b64be-8462-4cf3-af1f-185955bc7f9a', 'verified@example.test', 'Verified', true);

DO $$
BEGIN
  IF (SELECT email_verified_at IS NOT NULL FROM accounts WHERE primary_email = 'seller@example.test') THEN
    RAISE EXCEPTION 'Unverified account acquired verified timestamp';
  END IF;
  IF NOT (SELECT email_verified_at IS NOT NULL FROM accounts WHERE primary_email = 'verified@example.test') THEN
    RAISE EXCEPTION 'Verified account lacks timestamp';
  END IF;
END $$;

UPDATE accounts SET auth_email_verified = true WHERE primary_email = 'seller@example.test';
DO $$
BEGIN
  IF NOT (SELECT email_verified_at IS NOT NULL FROM accounts WHERE primary_email = 'seller@example.test') THEN
    RAISE EXCEPTION 'Better Auth verification did not synchronize to Kivro account';
  END IF;
END $$;

INSERT INTO account_identities(id, account_id, provider, provider_subject, access_token, refresh_token, id_token)
VALUES ('0c758901-bfc4-46b3-9cba-69aa4549881b', '16d302e5-4f9b-4ca3-9733-397a1ef4bac5',
  'google', 'stable-google-subject', 'sensitive-access', 'sensitive-refresh', 'sensitive-id');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM account_identities WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL) THEN
    RAISE EXCEPTION 'OAuth token persisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM account_identities WHERE provider_subject = 'stable-google-subject'
    AND email = 'seller@example.test' AND email_verified) THEN
    RAISE EXCEPTION 'Provider subject or account ownership missing';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO account_identities(id, account_id, provider, provider_subject)
    VALUES ('1e6dd57f-93ca-446f-b89b-d969716251fd', 'f01b64be-8462-4cf3-af1f-185955bc7f9a',
      'google', 'stable-google-subject');
    RAISE EXCEPTION 'Duplicate Google subject was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO account_identities(id, account_id, provider, provider_subject)
    VALUES ('22d0da67-09fb-41b6-a164-32b77696d01b', 'f01b64be-8462-4cf3-af1f-185955bc7f9a',
      'credential', 'f01b64be-8462-4cf3-af1f-185955bc7f9a');
    RAISE EXCEPTION 'Credential without password hash was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

INSERT INTO account_identities(id, account_id, provider, provider_subject, password_hash)
VALUES ('ce372d09-46cc-40e3-a341-1a0dbc737d18', 'f01b64be-8462-4cf3-af1f-185955bc7f9a',
  'credential', 'f01b64be-8462-4cf3-af1f-185955bc7f9a', '$argon2id$fixture-not-a-real-hash');
INSERT INTO auth_sessions(id, account_id, token, expires_at)
VALUES ('d72b824e-8fd9-49b0-bdd5-c50550dd52a9', 'f01b64be-8462-4cf3-af1f-185955bc7f9a',
  'fixture-token', now() + interval '1 day');
INSERT INTO auth_verifications(id, identifier, value, expires_at)
VALUES ('3173ca87-32ca-46bb-b224-ea7c69a96b99', 'fixture-hashed-identifier', 'fixture-value', now() + interval '1 hour');
INSERT INTO auth_rate_limits(id, key, count, last_request)
VALUES ('49477539-a0b7-4e88-81d4-c475a458703c', 'fixture-key', 1, 123456789);

DELETE FROM auth_sessions WHERE id = 'd72b824e-8fd9-49b0-bdd5-c50550dd52a9';
DO $$
BEGIN
  IF (SELECT count(*) FROM auth_audit_events WHERE event_type = 'ACCOUNT_CREATED') <> 2 THEN
    RAISE EXCEPTION 'Account creation was not audited';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth_audit_events WHERE event_type = 'EMAIL_VERIFIED') OR
     NOT EXISTS (SELECT 1 FROM auth_audit_events WHERE event_type = 'GOOGLE_IDENTITY_LINKED') OR
     NOT EXISTS (SELECT 1 FROM auth_audit_events WHERE event_type = 'SESSION_CREATED') OR
     NOT EXISTS (SELECT 1 FROM auth_audit_events WHERE event_type = 'SESSION_REVOKED') THEN
    RAISE EXCEPTION 'Required auth state change was not audited';
  END IF;
  BEGIN
    DELETE FROM auth_audit_events WHERE event_type = 'ACCOUNT_CREATED';
    RAISE EXCEPTION 'Auth audit deletion was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Auth audit deletion was accepted' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_audit_events'
    AND column_name IN ('email', 'password', 'token', 'ip_address', 'url')) THEN
    RAISE EXCEPTION 'Sensitive auth column in audit table';
  END IF;
END $$;

SELECT 'm02_auth_schema_constraints_passed' AS result;
