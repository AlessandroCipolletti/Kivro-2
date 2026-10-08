\set ON_ERROR_STOP on

INSERT INTO accounts(id,primary_email,status,auth_name,auth_email_verified) VALUES
  ('11111111-1111-4111-8111-111111111111','seller-m05@example.test','ACTIVE','Seller',true),
  ('22222222-2222-4222-8222-222222222222','buyer-m05@example.test','ACTIVE','Buyer',true),
  ('99999999-9999-4999-8999-999999999999','stranger-m05@example.test','ACTIVE','Stranger',true);
INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
  VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Seller','ACTIVE','READY');
INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,worker_version,status)
  VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',repeat('p',64),'Worker','MACOS','1.0','PAIRED');
INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
  VALUES ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','m05-test','M05 test','DRAFT');
INSERT INTO capability_versions(id,capability_id,version_number,publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
  VALUES ('66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555',1,'PUBLISHED','{}',
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',now());
UPDATE capabilities SET current_version_id='66666666-6666-4666-8666-666666666666' WHERE id='55555555-5555-4555-8555-555555555555';
INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,status,contract_snapshot) VALUES
  ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222',
    '66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','CREATED','{}'),
  ('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999',
    '66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','CREATED','{}');

INSERT INTO assets(id,owner_account_id,kind,state,object_key,retain_until) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','BUYER_INPUT','PENDING_UPLOAD',
    'private/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now()+interval '30 days');
DO $$ BEGIN
  BEGIN
    INSERT INTO assets(id,owner_account_id,kind,state,object_key,retain_until)
      VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',
        'BUYER_INPUT','PENDING_UPLOAD',
        'private/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        now()+interval '30 days');
    RAISE EXCEPTION 'Expected key/asset mismatch rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE assets SET state='READY' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'Expected incomplete asset rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO assets(id,owner_account_id,source_job_id,kind,state,object_key,retain_until)
      VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','99999999-9999-4999-8999-999999999999',
        '77777777-7777-4777-8777-777777777777','JOB_OUTPUT','PENDING_UPLOAD',
        'private/assets/cccccccc-cccc-4ccc-8ccc-cccccccccccc/dddddddd-dddd-4ddd-8ddd-dddddddddddd',now()+interval '30 days');
    RAISE EXCEPTION 'Expected source owner mismatch';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected source owner mismatch' THEN RAISE; END IF;
  END;
END $$;
UPDATE assets SET state='READY',size_bytes=12,sha256='sha256:'||repeat('a',64),detected_mime_type='image/png',finalized_at=now()
  WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN
  BEGIN
    UPDATE assets SET object_key='private/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    RAISE EXCEPTION 'Expected immutable key rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected immutable key rejection' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE assets SET sha256='sha256:'||repeat('b',64);
    RAISE EXCEPTION 'Expected immutable hash rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected immutable hash rejection' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO asset_read_grants(id,asset_id,target_job_id,expires_at)
  VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '77777777-7777-4777-8777-777777777777',now()+interval '1 day');
DO $$ BEGIN
  IF (SELECT permission FROM asset_read_grants
    WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 'READ' THEN
    RAISE EXCEPTION 'Asset grant must persist READ-only scope';
  END IF;
  BEGIN
    UPDATE asset_read_grants SET permission='WRITE'
      WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    RAISE EXCEPTION 'Expected write-capable grant rejection';
  EXCEPTION WHEN check_violation OR raise_exception THEN
    IF SQLERRM = 'Expected write-capable grant rejection' THEN RAISE; END IF;
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE assets SET retain_until=now()+interval '1 day'
      WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'Expected retention shortening rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected retention shortening rejection' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO asset_read_grants(id,asset_id,target_job_id,expires_at)
      VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '77777777-7777-4777-8777-777777777777',now()+interval '60 days');
    RAISE EXCEPTION 'Expected grant beyond retention rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected grant beyond retention rejection' THEN RAISE; END IF;
  END;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO asset_read_grants(id,asset_id,target_job_id,expires_at)
      VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '88888888-8888-4888-8888-888888888888',now()+interval '1 day');
    RAISE EXCEPTION 'Expected cross-buyer grant rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected cross-buyer grant rejection' THEN RAISE; END IF;
  END;
END $$;
UPDATE asset_read_grants SET revoked_at=now() WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
DO $$ BEGIN
  BEGIN
    UPDATE asset_read_grants SET revoked_at=NULL WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    RAISE EXCEPTION 'Expected grant restoration rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected grant restoration rejection' THEN RAISE; END IF;
  END;
END $$;
SELECT 'm05_private_asset_constraints_passed' AS result;
