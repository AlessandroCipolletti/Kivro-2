BEGIN;

-- The signed URL targets a staging key, never the immutable final asset key.
-- A still-valid browser URL therefore cannot overwrite a READY job input.
CREATE TABLE buyer_direct_uploads (
  asset_id uuid PRIMARY KEY REFERENCES assets(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  field_key text NOT NULL CHECK (length(field_key) BETWEEN 1 AND 64),
  staging_key text NOT NULL UNIQUE CHECK (staging_key ~ '^private/assets/[a-f0-9-]{36}/[a-f0-9-]{36}$'),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 128),
  declared_size_bytes bigint NOT NULL CHECK (declared_size_bytes >= 0),
  declared_sha256 text NOT NULL CHECK (declared_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  declared_content_type text NOT NULL CHECK (length(declared_content_type) BETWEEN 3 AND 120),
  signed_until timestamptz NOT NULL,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_direct_uploads_expiry_idx ON buyer_direct_uploads(signed_until)
  WHERE finalized_at IS NULL;

COMMIT;
