BEGIN;

-- Better Auth is the authentication adapter for the one Kivro account model.
-- Its user.id is accounts.id; its account rows are account_identities.
ALTER TABLE accounts
  ADD COLUMN auth_name text,
  ADD COLUMN auth_email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN auth_image text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE accounts SET auth_name = left(split_part(primary_email, '@', 1), 160),
  auth_email_verified = email_verified_at IS NOT NULL;
ALTER TABLE accounts ALTER COLUMN auth_name SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE accounts ADD CONSTRAINT accounts_auth_name_length CHECK (length(auth_name) BETWEEN 1 AND 160);

CREATE FUNCTION synchronize_account_verification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.auth_name IS NULL OR NEW.auth_name = '' THEN
    NEW.auth_name := left(split_part(NEW.primary_email, '@', 1), 160);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.email_verified_at IS NOT NULL THEN
      NEW.auth_email_verified := true;
    ELSIF NEW.auth_email_verified THEN
      NEW.email_verified_at := now();
    END IF;
  ELSIF NEW.auth_email_verified IS DISTINCT FROM OLD.auth_email_verified THEN
    NEW.email_verified_at := CASE WHEN NEW.auth_email_verified THEN now() ELSE NULL END;
  ELSIF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
    NEW.auth_email_verified := NEW.email_verified_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_verification_sync
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION synchronize_account_verification();
ALTER TABLE accounts ADD CONSTRAINT accounts_verification_consistent
  CHECK (auth_email_verified = (email_verified_at IS NOT NULL));

-- The credential and Google identity rows use Better Auth's provider IDs.
ALTER TABLE account_identities DROP CONSTRAINT account_identities_provider_check;
UPDATE account_identities SET provider = CASE provider
  WHEN 'PASSWORD' THEN 'credential'
  WHEN 'GOOGLE' THEN 'google'
  ELSE provider END;
ALTER TABLE account_identities ADD CONSTRAINT account_identities_provider_check
  CHECK (provider IN ('credential', 'google'));
ALTER TABLE account_identities
  ADD COLUMN access_token text,
  ADD COLUMN refresh_token text,
  ADD COLUMN id_token text,
  ADD COLUMN access_token_expires_at timestamptz,
  ADD COLUMN refresh_token_expires_at timestamptz,
  ADD COLUMN scope text,
  ADD COLUMN password_hash text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Identity-only login needs the stable provider subject, not reusable OAuth tokens.
CREATE FUNCTION restrict_auth_identity_storage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_email text;
DECLARE owner_verified boolean;
BEGIN
  SELECT primary_email, auth_email_verified INTO owner_email, owner_verified
    FROM accounts WHERE id = NEW.account_id;
  IF owner_email IS NULL THEN RAISE EXCEPTION 'Account identity owner missing'; END IF;
  NEW.email := owner_email;
  NEW.email_verified := owner_verified;
  NEW.access_token := NULL;
  NEW.refresh_token := NULL;
  NEW.id_token := NULL;
  NEW.access_token_expires_at := NULL;
  NEW.refresh_token_expires_at := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_identities_private_storage
  BEFORE INSERT OR UPDATE ON account_identities
  FOR EACH ROW EXECUTE FUNCTION restrict_auth_identity_storage();
ALTER TABLE account_identities ADD CONSTRAINT account_identities_no_oauth_tokens
  CHECK (access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL);
ALTER TABLE account_identities ADD CONSTRAINT account_identities_password_material
  CHECK (provider <> 'credential' OR password_hash IS NOT NULL);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_account_idx ON auth_sessions(account_id);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE TABLE auth_verifications (
  id uuid PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);
CREATE INDEX auth_verifications_expiry_idx ON auth_verifications(expires_at);

CREATE TABLE auth_rate_limits (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL CHECK (count >= 0),
  last_request bigint NOT NULL
);

-- Auth URLs contain bearer tokens. Persist only authenticated ciphertext and
-- use a lease so a crashed sender can retry without losing the message.
CREATE TABLE auth_email_outbox (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
  recipient text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 320),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[a-f0-9]{64}$'),
  nonce bytea NOT NULL CHECK (octet_length(nonce) = 12),
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 8192),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag) = 16),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  dead_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((lease_id IS NULL) = (lease_until IS NULL)),
  CHECK (sent_at IS NULL OR dead_at IS NULL)
);
CREATE INDEX auth_email_outbox_due_idx ON auth_email_outbox(next_attempt_at, created_at)
  WHERE sent_at IS NULL AND dead_at IS NULL;

COMMIT;
