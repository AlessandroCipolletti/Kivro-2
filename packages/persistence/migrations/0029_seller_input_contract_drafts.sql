CREATE TABLE seller_input_contract_drafts (
  id uuid PRIMARY KEY,
  seller_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  input_contract jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,seller_account_id)
);
CREATE INDEX seller_input_contract_drafts_owner_updated
  ON seller_input_contract_drafts(seller_account_id,updated_at DESC);
