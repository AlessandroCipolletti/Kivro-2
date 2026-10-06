BEGIN;

CREATE TABLE research_job_usage (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  private_resource_read boolean NOT NULL DEFAULT false
);

CREATE TABLE research_requests (
  request_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES research_job_usage(job_id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  operation text NOT NULL CHECK (operation IN ('SEARCH','FETCH','DOWNLOAD')),
  cost_owner text NOT NULL DEFAULT 'PLATFORM' CHECK (cost_owner = 'PLATFORM'),
  host text,
  query_hash text CHECK (query_hash IS NULL OR query_hash ~ '^sha256:[a-f0-9]{64}$'),
  reserved_bytes bigint NOT NULL CHECK (reserved_bytes >= 0),
  actual_bytes bigint CHECK (actual_bytes IS NULL OR (actual_bytes >= 0 AND actual_bytes <= reserved_bytes)),
  http_status integer,
  content_type text,
  blocked_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX research_requests_job_idx ON research_requests(job_id, started_at);
CREATE INDEX research_requests_host_idx ON research_requests(host, started_at);

CREATE TABLE research_denials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  operation text NOT NULL CHECK (operation IN ('SEARCH','FETCH','DOWNLOAD')),
  host text,
  query_hash text CHECK (query_hash IS NULL OR query_hash ~ '^sha256:[a-f0-9]{64}$'),
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE local_resource_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  resource_id text NOT NULL,
  operation_id text NOT NULL,
  row_count integer NOT NULL CHECK (row_count >= 0),
  status text NOT NULL CHECK (status IN ('ALLOWED','DENIED')),
  reason text,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE declared_api_calls (
  request_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  connector_id text NOT NULL,
  cost_owner text NOT NULL DEFAULT 'SELLER' CHECK (cost_owner = 'SELLER'),
  host text NOT NULL,
  method text NOT NULL,
  response_bytes integer CHECK (response_bytes IS NULL OR response_bytes >= 0),
  status text CHECK (status IS NULL OR status IN ('ALLOWED','DENIED')),
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX declared_api_calls_job_connector_idx ON declared_api_calls(job_id,connector_id);

CREATE TABLE declared_api_denials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  connector_id text NOT NULL,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seller_provider_calls (
  request_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  provider_id text NOT NULL,
  cost_owner text NOT NULL DEFAULT 'SELLER' CHECK (cost_owner = 'SELLER'),
  model_id text NOT NULL,
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd > 0),
  accounted_micro_usd bigint CHECK (accounted_micro_usd IS NULL OR
    (accounted_micro_usd >= 0 AND accounted_micro_usd <= reserved_micro_usd)),
  input_tokens integer,
  output_tokens integer,
  status text CHECK (status IS NULL OR status IN ('SUCCEEDED','FAILED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX seller_provider_calls_job_idx ON seller_provider_calls(job_id,started_at);

-- An audit is the request row itself: no query text, response body, full URL or credentials.
COMMIT;
