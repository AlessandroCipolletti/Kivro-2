BEGIN;

-- The grant already authorizes only private reads. Persist that permission
-- explicitly so orchestration/audit can prove the scope without inferring it
-- from the table name. The CHECK prevents later write-capable expansion.
ALTER TABLE asset_read_grants
  ADD COLUMN permission text NOT NULL DEFAULT 'READ'
  CHECK (permission = 'READ');

COMMIT;
