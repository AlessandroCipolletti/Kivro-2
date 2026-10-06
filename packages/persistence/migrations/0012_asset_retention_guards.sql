BEGIN;

-- Scheduled jobs may require an asset longer than its original retention window.
-- Extend first, then grant; never silently shorten an existing READY asset's window.
CREATE FUNCTION guard_asset_retention_extension() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.retain_until < OLD.retain_until AND OLD.state IN ('READY','QUARANTINED','EXPIRED') THEN
    RAISE EXCEPTION 'Finalized asset retention can only be extended';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assets_retention_extension_guard
  BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION guard_asset_retention_extension();

CREATE FUNCTION guard_asset_grant_retention() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE retained_until timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT retain_until INTO retained_until FROM assets WHERE id=NEW.asset_id FOR SHARE;
    IF retained_until IS NULL OR NEW.expires_at > retained_until THEN
      RAISE EXCEPTION 'Grant cannot outlive asset retention';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER asset_grants_retention_guard
  BEFORE INSERT ON asset_read_grants FOR EACH ROW EXECUTE FUNCTION guard_asset_grant_retention();

COMMIT;
