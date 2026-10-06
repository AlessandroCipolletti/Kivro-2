import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { test } from 'node:test';
import { URL } from 'node:url';
import { Pool } from 'pg';
import { createSellerProfile, getSellerProfile } from '../dist/packages/persistence/src/seller-profiles.js';

test('verified canonical account creates exactly one seller profile under concurrency', async () => {
  assert.equal(process.env.NODE_ENV, 'development');
  const databaseUrl = process.env.DATABASE_URL ?? '';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname));
  const database = new Pool({ connectionString: databaseUrl, max: 4 });
  try {
    const accountId = randomUUID();
    await database.query(`INSERT INTO accounts(id,primary_email,status,auth_name,auth_email_verified)
      VALUES ($1,$2,'ACTIVE','Seller Fixture',true)`, [accountId, `seller-${randomUUID()}@example.test`]);
    const [first, second] = await Promise.all([
      createSellerProfile(database, accountId, 'Studio North', true),
      createSellerProfile(database, accountId, 'Other proposed name', true),
    ]);
    assert.equal(first.id, second.id);
    assert.equal(first.accountId, accountId);
    assert.equal(first.status, 'DRAFT');
    assert.equal(first.payoutStatus, 'NOT_STARTED');
    assert.equal(first.executionModelAcknowledged, true);
    assert.equal((await database.query('SELECT count(*)::integer AS count FROM seller_profiles WHERE account_id=$1',
      [accountId])).rows[0].count, 1);
    assert.deepEqual(await getSellerProfile(database, accountId), first);
    assert.equal(await getSellerProfile(database, randomUUID()), null);
    assert.equal((await createSellerProfile(database, accountId, 'Changed on retry', true)).id, first.id);
    await assert.rejects(createSellerProfile(database, accountId, 'No consent', false));

    const unverified = randomUUID();
    await database.query(`INSERT INTO accounts(id,primary_email,status,auth_name,auth_email_verified)
      VALUES ($1,$2,'ACTIVE','Unverified',false)`, [unverified, `unverified-${randomUUID()}@example.test`]);
    await assert.rejects(createSellerProfile(database, unverified, 'Should fail', true), { code: 'ACCOUNT_NOT_ELIGIBLE' });
    const suspended = randomUUID();
    await database.query(`INSERT INTO accounts(id,primary_email,status,auth_name,auth_email_verified)
      VALUES ($1,$2,'SUSPENDED','Suspended',true)`, [suspended, `suspended-${randomUUID()}@example.test`]);
    await assert.rejects(createSellerProfile(database, suspended, 'Should fail', true), { code: 'ACCOUNT_NOT_ELIGIBLE' });
    await assert.rejects(createSellerProfile(database, accountId, '\nunsafe', true), /control characters/);
    assert.equal((await database.query(`SELECT count(*)::integer AS count FROM seller_execution_model_acknowledgements
      WHERE seller_profile_id=$1 AND statement_version=1`, [first.id])).rows[0].count, 1);
  } finally { await database.end(); }
});
