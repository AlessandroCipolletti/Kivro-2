BEGIN;

-- With generateId='uuid', Better Auth's PostgreSQL adapter expects database
-- defaults. Kivro services may still supply explicit UUIDs for domain writes.
ALTER TABLE accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE account_identities ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE auth_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE auth_verifications ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;
