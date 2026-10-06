BEGIN;

-- Better Auth's database rate-limit adapter inserts key/count/time and relies
-- on a database-generated primary key for this table.
ALTER TABLE auth_rate_limits ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;
