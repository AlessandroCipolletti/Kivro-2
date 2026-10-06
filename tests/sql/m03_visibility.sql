\set ON_ERROR_STOP on

INSERT INTO accounts(id,primary_email,status,auth_name,auth_email_verified) VALUES
  ('11111111-1111-4111-8111-111111111111','seller-m03@example.test','ACTIVE','Seller',true),
  ('22222222-2222-4222-8222-222222222222','buyer-m03@example.test','ACTIVE','Buyer',true);
INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
  VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Seller','ACTIVE','NOT_STARTED');
INSERT INTO seller_execution_model_acknowledgements(seller_profile_id,statement_version)
  VALUES ('33333333-3333-4333-8333-333333333333',1);
DO $$ BEGIN
  BEGIN
    UPDATE seller_execution_model_acknowledgements SET acknowledged_at=now()
      WHERE seller_profile_id='33333333-3333-4333-8333-333333333333';
    RAISE EXCEPTION 'Expected acknowledgement rewrite denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected acknowledgement rewrite denial' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM seller_execution_model_acknowledgements
      WHERE seller_profile_id='33333333-3333-4333-8333-333333333333';
    RAISE EXCEPTION 'Expected acknowledgement deletion denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected acknowledgement deletion denial' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
  VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',
    'm03-private','M03 private fixture','','DRAFT');
INSERT INTO capability_versions(id,capability_id,version_number,publication_state,version_snapshot,
  worker_manifest_hash,policy_validation_hash,published_at)
  VALUES ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444',1,
    'PUBLISHED','{}','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',now());

DO $$ BEGIN
  BEGIN
    UPDATE capabilities SET visibility='PRIVATE' WHERE id='44444444-4444-4444-8444-444444444444';
    RAISE EXCEPTION 'Expected no-active-version denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected no-active-version denial' THEN RAISE; END IF;
  END;
END $$;
UPDATE capabilities SET current_version_id='55555555-5555-4555-8555-555555555555',visibility='PRIVATE'
  WHERE id='44444444-4444-4444-8444-444444444444';

DO $$ BEGIN
  BEGIN
    UPDATE capabilities SET visibility='PUBLIC' WHERE id='44444444-4444-4444-8444-444444444444';
    RAISE EXCEPTION 'Expected payout denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected payout denial' THEN RAISE; END IF;
  END;
END $$;
UPDATE seller_profiles SET payout_status='READY' WHERE id='33333333-3333-4333-8333-333333333333';
UPDATE capabilities SET visibility='PUBLIC' WHERE id='44444444-4444-4444-8444-444444444444';
UPDATE capabilities SET visibility='PRIVATE' WHERE id='44444444-4444-4444-8444-444444444444';

DO $$ BEGIN
  BEGIN
    INSERT INTO capability_private_grants(id,capability_id,buyer_account_id,granted_by_account_id)
      VALUES ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444',
        '22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
    RAISE EXCEPTION 'Expected owner denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected owner denial' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO capability_private_grants(id,capability_id,buyer_account_id,granted_by_account_id)
  VALUES ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
DO $$ BEGIN
  BEGIN
    DELETE FROM capability_private_grants WHERE id='66666666-6666-4666-8666-666666666666';
    RAISE EXCEPTION 'Expected append-only grant denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected append-only grant denial' THEN RAISE; END IF;
  END;
END $$;
UPDATE capability_private_grants SET revoked_at=now()
  WHERE id='66666666-6666-4666-8666-666666666666';
INSERT INTO capability_private_grants(id,capability_id,buyer_account_id,granted_by_account_id)
  VALUES ('77777777-7777-4777-8777-777777777777','44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');

INSERT INTO capability_versions(id,capability_id,version_number,publication_state,version_snapshot,worker_manifest_hash)
  VALUES ('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444',2,
    'DRAFT','{}','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
DO $$ BEGIN
  BEGIN
    UPDATE capability_version_lifecycle SET state='PUBLISHED'
      WHERE version_id='88888888-8888-4888-8888-888888888888';
    RAISE EXCEPTION 'Expected lifecycle skip denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected lifecycle skip denial' THEN RAISE; END IF;
  END;
END $$;
UPDATE capability_version_lifecycle SET state='TESTING' WHERE version_id='88888888-8888-4888-8888-888888888888';
UPDATE capability_version_lifecycle SET state='READY_TO_PUBLISH' WHERE version_id='88888888-8888-4888-8888-888888888888';
UPDATE capability_versions SET publication_state='PUBLISHED',published_at=now(),
  policy_validation_hash='sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
  WHERE id='88888888-8888-4888-8888-888888888888';
UPDATE capability_version_lifecycle SET state='PUBLISHED' WHERE version_id='88888888-8888-4888-8888-888888888888';
DO $$ BEGIN
  BEGIN
    UPDATE capability_version_lifecycle SET state='RETIRED'
      WHERE version_id='55555555-5555-4555-8555-555555555555';
    RAISE EXCEPTION 'Expected active-version retirement denial';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected active-version retirement denial' THEN RAISE; END IF;
  END;
END $$;
UPDATE capabilities SET current_version_id='88888888-8888-4888-8888-888888888888'
  WHERE id='44444444-4444-4444-8444-444444444444';
UPDATE capability_version_lifecycle SET state='RETIRED'
  WHERE version_id='55555555-5555-4555-8555-555555555555';
DO $$ BEGIN
  IF (SELECT publication_state FROM capability_versions WHERE id='55555555-5555-4555-8555-555555555555') <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'Retirement mutated the immutable published snapshot';
  END IF;
  IF (SELECT count(*) FROM capability_private_grants WHERE revoked_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'Unexpected active private grant count';
  END IF;
END $$;
SELECT 'm03_visibility_constraints_passed' AS result;
