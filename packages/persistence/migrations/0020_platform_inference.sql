BEGIN;

CREATE TABLE platform_ai_request_guard (
  id uuid PRIMARY KEY,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  task text NOT NULL CHECK (task IN ('INTENT_EXTRACTION','DISCOVERY_RERANK','RECOMMENDATION',
    'ORCHESTRATION_PLANNING','INPUT_PREPARATION','RESULT_SYNTHESIS')),
  reserved_max_tokens integer NOT NULL CHECK (reserved_max_tokens BETWEEN 1 AND 4096),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_ai_guard_buyer_time_idx ON platform_ai_request_guard(buyer_account_id,created_at DESC);

CREATE TABLE platform_ai_profile_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  configuration_hash text NOT NULL UNIQUE CHECK (configuration_hash ~ '^sha256:[0-9a-f]{64}$'),
  configuration_json jsonb NOT NULL CHECK (jsonb_typeof(configuration_json)='object'),
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION platform_ai_profile_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Platform routing audit is append-only'; END; $$;
CREATE TRIGGER platform_ai_profile_audit_no_rewrite BEFORE UPDATE OR DELETE ON platform_ai_profile_audit
  FOR EACH ROW EXECUTE FUNCTION platform_ai_profile_audit_immutable();

CREATE TABLE platform_inference_usage (
  request_id uuid PRIMARY KEY REFERENCES platform_ai_request_guard(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  conversation_id uuid,
  orchestration_id uuid,
  task text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai','anthropic')),
  model text NOT NULL CHECK (length(model) BETWEEN 1 AND 160),
  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  cached_input_tokens integer NOT NULL CHECK (cached_input_tokens >= 0),
  estimated_cost_microusd bigint CHECK (estimated_cost_microusd >= 0),
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS','FAILURE')),
  error_code text,
  tool_call_count integer NOT NULL CHECK (tool_call_count BETWEEN 0 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cached_input_tokens <= input_tokens),
  CHECK ((outcome='SUCCESS' AND error_code IS NULL) OR (outcome='FAILURE' AND error_code IS NOT NULL))
);
CREATE INDEX platform_inference_usage_buyer_idx ON platform_inference_usage(buyer_account_id,created_at DESC);
CREATE INDEX platform_inference_usage_conversation_idx ON platform_inference_usage(conversation_id,created_at DESC);
CREATE FUNCTION platform_inference_usage_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Platform inference usage is append-only'; END; $$;
CREATE TRIGGER platform_inference_usage_no_rewrite BEFORE UPDATE OR DELETE ON platform_inference_usage
  FOR EACH ROW EXECUTE FUNCTION platform_inference_usage_immutable();

COMMIT;
