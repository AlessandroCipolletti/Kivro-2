BEGIN;

-- Forward-only correction after 0010 was applied locally: object keys are bound to their asset IDs.
ALTER TABLE assets ADD CONSTRAINT assets_object_key_asset_id_match
  CHECK (split_part(object_key, '/', 3) = id::text);

COMMIT;
