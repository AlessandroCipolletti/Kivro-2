BEGIN;

CREATE TABLE marketplace_conversations (
  id uuid PRIMARY KEY,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_conversations_buyer_idx ON marketplace_conversations(buyer_account_id,updated_at DESC);

CREATE TABLE marketplace_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES marketplace_conversations(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('BUYER','AGENT','SYSTEM_NOTICE')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  references_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(references_json)='array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_messages_conversation_idx ON marketplace_messages(conversation_id,created_at,id);
CREATE TABLE marketplace_agent_drafts (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES marketplace_conversations(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  values_json jsonb NOT NULL CHECK (jsonb_typeof(values_json)='object'),
  assets_json jsonb NOT NULL CHECK (jsonb_typeof(assets_json)='object'),
  missing_field_keys text[] NOT NULL DEFAULT '{}',
  warnings text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days')
);
CREATE INDEX marketplace_agent_drafts_buyer_idx ON marketplace_agent_drafts(buyer_account_id,created_at DESC);
CREATE FUNCTION marketplace_agent_draft_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Agent drafts are immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM marketplace_conversations c WHERE c.id=NEW.conversation_id
    AND c.buyer_account_id=NEW.buyer_account_id) THEN
    RAISE EXCEPTION 'Draft owner must own conversation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_agent_drafts_guard BEFORE INSERT OR UPDATE OR DELETE ON marketplace_agent_drafts
  FOR EACH ROW EXECUTE FUNCTION marketplace_agent_draft_guard();
CREATE FUNCTION marketplace_message_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Marketplace messages are append-only'; END IF;
  SELECT buyer_account_id INTO owner FROM marketplace_conversations WHERE id=NEW.conversation_id;
  IF owner IS DISTINCT FROM NEW.buyer_account_id THEN RAISE EXCEPTION 'Conversation ownership mismatch'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_messages_guard BEFORE INSERT OR UPDATE OR DELETE ON marketplace_messages
  FOR EACH ROW EXECUTE FUNCTION marketplace_message_guard();

CREATE TABLE orchestration_plans (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES marketplace_conversations(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  goal text NOT NULL CHECK (length(goal) BETWEEN 1 AND 2000),
  constraints_json jsonb NOT NULL CHECK (jsonb_typeof(constraints_json)='object'),
  approval_mode text NOT NULL CHECK (approval_mode='APPROVE_PLAN'),
  max_budget_minor bigint NOT NULL CHECK (max_budget_minor BETWEEN 1 AND 1000000),
  quoted_total_minor bigint NOT NULL CHECK (quoted_total_minor BETWEEN 0 AND 1000000),
  status text NOT NULL CHECK (status IN ('DRAFT','AWAITING_APPROVAL','RUNNING','CANCELLING',
    'AWAITING_REAPPROVAL','COMPLETED','FAILED','CANCELLED')),
  final_result jsonb CHECK (final_result IS NULL OR jsonb_typeof(final_result)='object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quoted_total_minor<=max_budget_minor)
);
CREATE INDEX orchestration_plans_buyer_idx ON orchestration_plans(buyer_account_id,created_at DESC);
CREATE INDEX orchestration_plans_active_idx ON orchestration_plans(updated_at,id)
  WHERE status IN ('RUNNING','AWAITING_REAPPROVAL');

CREATE TABLE orchestration_steps (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES orchestration_plans(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 15),
  capability_id uuid NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
  capability_version_id uuid NOT NULL REFERENCES capability_versions(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL CHECK (length(name_snapshot) BETWEEN 1 AND 200),
  slug_snapshot text NOT NULL CHECK (length(slug_snapshot) BETWEEN 1 AND 200),
  availability_status_at_quote text NOT NULL,
  earliest_eligible_at timestamptz NOT NULL,
  planning_quote_id uuid NOT NULL REFERENCES job_schedule_quotes(id) ON DELETE RESTRICT,
  execution_quote_id uuid REFERENCES job_schedule_quotes(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL UNIQUE,
  reservation_id uuid NOT NULL UNIQUE,
  manifest_id uuid NOT NULL UNIQUE,
  quoted_price_minor bigint NOT NULL CHECK (quoted_price_minor BETWEEN 1 AND 1000000),
  quote_expires_at timestamptz NOT NULL,
  depends_on uuid[] NOT NULL DEFAULT '{}',
  input_values jsonb NOT NULL CHECK (jsonb_typeof(input_values)='object'),
  input_assets jsonb NOT NULL CHECK (jsonb_typeof(input_assets)='object'),
  mappings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(mappings)='array'),
  document_snapshot jsonb NOT NULL CHECK (jsonb_typeof(document_snapshot)='object'),
  status text NOT NULL CHECK (status IN ('PLANNED','READY','PURCHASING','PAYMENT_RESERVED',
    'RUNNING','COMPLETED','FAILED','SKIPPED','AWAITING_REAPPROVAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX orchestration_steps_plan_position_idx ON orchestration_steps(plan_id,position);

CREATE TABLE orchestration_revision_snapshots (
  plan_id uuid NOT NULL REFERENCES orchestration_plans(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0),
  plan_snapshot jsonb NOT NULL CHECK (jsonb_typeof(plan_snapshot)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(plan_id,revision)
);
CREATE FUNCTION orchestration_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Plan revision snapshots are append-only'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orchestration_revision_snapshots_guard BEFORE UPDATE OR DELETE
  ON orchestration_revision_snapshots FOR EACH ROW EXECUTE FUNCTION orchestration_revision_guard();

CREATE TABLE orchestration_approvals (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES orchestration_plans(id) ON DELETE RESTRICT,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  plan_revision integer NOT NULL CHECK (plan_revision>0),
  maximum_authorized_minor bigint NOT NULL CHECK (maximum_authorized_minor BETWEEN 1 AND 1000000),
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id,plan_revision)
);
CREATE FUNCTION orchestration_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Orchestration approvals are append-only'; END IF;
  IF NOT EXISTS(SELECT 1 FROM orchestration_plans p WHERE p.id=NEW.plan_id
    AND p.buyer_account_id=NEW.buyer_account_id AND p.revision=NEW.plan_revision
    AND p.max_budget_minor=NEW.maximum_authorized_minor) THEN
    RAISE EXCEPTION 'Approval does not match plan terms';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orchestration_approvals_guard BEFORE INSERT OR UPDATE OR DELETE ON orchestration_approvals
  FOR EACH ROW EXECUTE FUNCTION orchestration_approval_guard();

CREATE TABLE orchestration_asset_links (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES orchestration_plans(id) ON DELETE RESTRICT,
  source_step_id uuid NOT NULL REFERENCES orchestration_steps(id) ON DELETE RESTRICT,
  target_step_id uuid NOT NULL REFERENCES orchestration_steps(id) ON DELETE RESTRICT,
  source_job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  target_job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  grant_id uuid NOT NULL REFERENCES asset_read_grants(id) ON DELETE RESTRICT,
  source_output_key text NOT NULL,
  target_input_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id,source_step_id,target_step_id,asset_id,target_input_key)
);
CREATE FUNCTION orchestration_asset_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE buyer uuid; source_owner uuid; target_owner uuid; asset_owner uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Orchestration asset links are append-only'; END IF;
  SELECT buyer_account_id INTO buyer FROM orchestration_plans WHERE id=NEW.plan_id;
  SELECT buyer_account_id INTO source_owner FROM jobs WHERE id=NEW.source_job_id AND status='COMPLETED';
  SELECT buyer_account_id INTO target_owner FROM jobs WHERE id=NEW.target_job_id;
  SELECT owner_account_id INTO asset_owner FROM assets WHERE id=NEW.asset_id AND state='READY'
    AND source_job_id=NEW.source_job_id AND retain_until>now();
  IF buyer IS NULL OR buyer IS DISTINCT FROM source_owner OR buyer IS DISTINCT FROM target_owner OR
    buyer IS DISTINCT FROM asset_owner OR NOT EXISTS(SELECT 1 FROM job_result_assets ra
      JOIN job_result_manifests m ON m.id=ra.manifest_id WHERE m.job_id=NEW.source_job_id
      AND ra.asset_id=NEW.asset_id AND ra.field_key=NEW.source_output_key) OR
    NOT EXISTS(SELECT 1 FROM asset_read_grants g WHERE g.id=NEW.grant_id
      AND g.asset_id=NEW.asset_id AND g.target_job_id=NEW.target_job_id AND g.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Cross-job asset link must be buyer-owned, delivered and scoped';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orchestration_asset_links_guard BEFORE INSERT OR UPDATE OR DELETE ON orchestration_asset_links
  FOR EACH ROW EXECUTE FUNCTION orchestration_asset_link_guard();

COMMIT;
