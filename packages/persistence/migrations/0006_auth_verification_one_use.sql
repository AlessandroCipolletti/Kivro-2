BEGIN;

-- Better Auth's signed email-verification JWT remains cryptographically valid
-- until expiry. Kivro requires a server-side one-use gate in addition.
CREATE TABLE auth_one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose = 'VERIFY_EMAIL'),
  recipient text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 320),
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_one_time_tokens_expiry_idx ON auth_one_time_tokens(expires_at)
  WHERE consumed_at IS NULL;

COMMIT;
