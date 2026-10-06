\set ON_ERROR_STOP on

INSERT INTO accounts(id, primary_email, status) VALUES
  ('b3451661-a538-4907-8acc-b1cf00e04899', 'seller@example.test', 'ACTIVE'),
  ('48ed805a-d11a-4f3a-a601-35014a39e810', 'buyer@example.test', 'ACTIVE');
INSERT INTO account_identities(id, account_id, provider, provider_subject, email, email_verified)
  VALUES ('76a985b7-5132-4f9e-ae97-64018021d7b1', 'b3451661-a538-4907-8acc-b1cf00e04899', 'GOOGLE', 'seller-sub', 'seller@example.test', true);
INSERT INTO seller_profiles(id, account_id, display_name, status, payout_status)
  VALUES ('12e59250-8afc-4ab9-9189-f41c4cfdc8c9', 'b3451661-a538-4907-8acc-b1cf00e04899', 'Seller', 'ACTIVE', 'READY');
INSERT INTO worker_devices(id, seller_profile_id, public_key, name, platform, worker_version, status)
  VALUES ('38512236-0583-4a24-93e0-0ef0249e9ab8', '12e59250-8afc-4ab9-9189-f41c4cfdc8c9', repeat('p', 64), 'Device', 'MACOS', '1.0', 'PAIRED');
INSERT INTO capabilities(id, seller_profile_id, slug, name, status)
  VALUES ('1793f95e-091c-45bf-8c75-0887df5d6a39', '12e59250-8afc-4ab9-9189-f41c4cfdc8c9', 'seller-capability', 'Capability', 'DRAFT');
INSERT INTO capability_versions(id, capability_id, version_number, publication_state, version_snapshot, worker_manifest_hash)
  VALUES ('57887a53-0350-4f8f-9c88-b58518f5028e', '1793f95e-091c-45bf-8c75-0887df5d6a39', 1, 'DRAFT', '{}', 'sha256:' || repeat('a', 64));

DO $$
BEGIN
  BEGIN
    INSERT INTO jobs(id, buyer_account_id, capability_version_id, worker_device_id, status, contract_snapshot)
      VALUES ('d9af2ae9-0f02-43f4-8062-ae5c2f542177', '48ed805a-d11a-4f3a-a601-35014a39e810', '57887a53-0350-4f8f-9c88-b58518f5028e', '38512236-0583-4a24-93e0-0ef0249e9ab8', 'CREATED', '{}');
    RAISE EXCEPTION 'Expected unpublished version rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected unpublished version rejection' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Jobs require a published capability version%' THEN RAISE; END IF;
  END;
END $$;

-- This fixture proves database constraints only. M03/M04 must verify real policy proof before publication.
UPDATE capability_versions SET publication_state = 'PUBLISHED',
  policy_validation_hash = 'sha256:' || repeat('b', 64), published_at = now()
  WHERE id = '57887a53-0350-4f8f-9c88-b58518f5028e';
UPDATE capabilities SET current_version_id = '57887a53-0350-4f8f-9c88-b58518f5028e', status = 'PUBLISHED'
  WHERE id = '1793f95e-091c-45bf-8c75-0887df5d6a39';
INSERT INTO jobs(id, buyer_account_id, capability_version_id, worker_device_id, status, contract_snapshot)
  VALUES ('d9af2ae9-0f02-43f4-8062-ae5c2f542177', '48ed805a-d11a-4f3a-a601-35014a39e810', '57887a53-0350-4f8f-9c88-b58518f5028e', '38512236-0583-4a24-93e0-0ef0249e9ab8', 'CREATED', '{}');

DO $$
BEGIN
  BEGIN
    UPDATE jobs SET status = 'QUEUED' WHERE id = 'd9af2ae9-0f02-43f4-8062-ae5c2f542177';
    RAISE EXCEPTION 'Expected unpaid queue rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected unpaid queue rejection' THEN RAISE; END IF;
    IF SQLSTATE <> '23514' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE capability_versions SET version_number = 2 WHERE id = '57887a53-0350-4f8f-9c88-b58518f5028e';
    RAISE EXCEPTION 'Expected published mutation rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected published mutation rejection' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Published capability versions are immutable%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE jobs SET contract_snapshot = '{"changed":true}' WHERE id = 'd9af2ae9-0f02-43f4-8062-ae5c2f542177';
    RAISE EXCEPTION 'Expected job snapshot rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected job snapshot rejection' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Historical job contract and ownership are immutable%' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO job_transitions(id, job_id, sequence, from_status, to_status, at, actor, reason, correlation_id, payment_reservation_id)
  VALUES ('62939296-d665-40c0-a364-ab250cbf9312', 'd9af2ae9-0f02-43f4-8062-ae5c2f542177', 1, 'CREATED', 'PAYMENT_RESERVED', now(), 'PAYMENT', 'fixture', 'd9af2ae9-0f02-43f4-8062-ae5c2f542177', '76a985b7-5132-4f9e-ae97-64018021d7b1');
DO $$
BEGIN
  BEGIN
    UPDATE job_transitions SET reason = 'rewritten' WHERE id = '62939296-d665-40c0-a364-ab250cbf9312';
    RAISE EXCEPTION 'Expected append-only rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected append-only rejection' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Job transitions are append-only%' THEN RAISE; END IF;
  END;
END $$;

SELECT 'm01_foundation_constraints_passed' AS result;
