BEGIN;

-- Better Auth checks required columns before it writes. The account trigger
-- fills this normalized copy from accounts, but the column must be nullable
-- in the inspected schema so the adapter can insert its account row.
ALTER TABLE account_identities ALTER COLUMN email DROP NOT NULL;
ALTER TABLE account_identities ADD CONSTRAINT account_identities_email_present CHECK (email IS NOT NULL);

COMMIT;
