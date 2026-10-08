BEGIN;

-- Public seller enrollment remains closed until the security release gate
-- passes. A DB administrator may explicitly admit a verified private-alpha
-- account; the ordinary signup flow cannot grant itself this capability.
CREATE TABLE seller_onboarding_invites (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  granted_by text NOT NULL CHECK (length(granted_by) BETWEEN 3 AND 160),
  revoked_at timestamptz,
  consumed_at timestamptz,
  CHECK (expires_at > granted_at),
  CHECK (revoked_at IS NULL OR consumed_at IS NULL)
);
CREATE INDEX seller_onboarding_invites_live
  ON seller_onboarding_invites(expires_at)
  WHERE revoked_at IS NULL AND consumed_at IS NULL;

COMMIT;
