BEGIN;

-- A scheduled job may outlive the initial input-upload retention window.
-- Keep grant identity immutable and revocation one-way; only an active,
-- owner-matched scheduled job can extend its read deadline to the asset's
-- already authorized retention. No expired/revoked grant is revived.
CREATE OR REPLACE FUNCTION guard_asset_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_owner uuid; job_buyer uuid; asset_state text;
        asset_retention timestamptz; job_state text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT owner_account_id,state,retain_until INTO asset_owner,asset_state,asset_retention
      FROM assets WHERE id=NEW.asset_id FOR SHARE;
    SELECT buyer_account_id INTO job_buyer FROM jobs WHERE id=NEW.target_job_id FOR SHARE;
    IF asset_owner IS DISTINCT FROM job_buyer OR asset_state <> 'READY' OR
       NEW.expires_at <= now() OR NEW.expires_at > asset_retention THEN
      RAISE EXCEPTION 'Asset grant requires ready asset and same buyer';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Asset grants are not deleted; revoke them';
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.asset_id IS DISTINCT FROM OLD.asset_id OR
       NEW.target_job_id IS DISTINCT FROM OLD.target_job_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only one-way asset grant revocation or scheduled extension is allowed';
    END IF;
    IF NEW.revoked_at IS NOT NULL THEN
      IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'Grant revocation cannot change its expiry';
      END IF;
    ELSIF NEW.expires_at > OLD.expires_at AND OLD.expires_at > now() THEN
      SELECT owner_account_id,state,retain_until INTO asset_owner,asset_state,asset_retention
        FROM assets WHERE id=NEW.asset_id FOR SHARE;
      SELECT buyer_account_id,status INTO job_buyer,job_state
        FROM jobs WHERE id=NEW.target_job_id FOR SHARE;
      IF asset_owner IS DISTINCT FROM job_buyer OR asset_state <> 'READY' OR
         NEW.expires_at > asset_retention OR
         job_state NOT IN ('PAYMENT_RESERVED','WAITING_FOR_AVAILABILITY','QUEUED',
                           'WAITING_FOR_WORKER') OR
         NOT EXISTS(SELECT 1 FROM job_schedule_plans WHERE job_id=NEW.target_job_id) THEN
        RAISE EXCEPTION 'Scheduled grant extension requires active owner-matched job';
      END IF;
    ELSE
      RAISE EXCEPTION 'Only one-way asset grant revocation or scheduled extension is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
