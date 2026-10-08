import {randomUUID} from 'node:crypto';
import pg from 'pg';
import process from 'node:process';

const [action,accountId,rawHours]=process.argv.slice(2);
const hours=rawHours===undefined?168:Number(rawHours);
if(!['grant','revoke'].includes(action)||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId??'')||
  action==='grant'&&(!Number.isSafeInteger(hours)||hours<1||hours>720)||
  action==='revoke'&&rawHours!==undefined)
  throw new Error('Usage: kivro-seller-invite.mjs grant ACCOUNT_UUID [HOURS 1..720] | revoke ACCOUNT_UUID');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const client=await pool.connect();
try{
  await client.query('BEGIN');
  const account=await client.query(`SELECT 1 FROM accounts WHERE id=$1
    AND status='ACTIVE' AND auth_email_verified=true
    AND email_verified_at IS NOT NULL FOR UPDATE`,[accountId]);
  if(!account.rowCount)throw new Error('Seller invitation requires an active verified account');
  const profile=await client.query('SELECT 1 FROM seller_profiles WHERE account_id=$1',
    [accountId]);
  if(profile.rowCount)throw new Error('Seller already has a profile');
  if(action==='grant')await client.query(`INSERT INTO seller_onboarding_invites
    (account_id,expires_at,granted_by) VALUES($1,now()+$2::int*interval '1 hour',
    'DB_ADMIN_CLI') ON CONFLICT(account_id) DO UPDATE SET granted_at=now(),
    expires_at=excluded.expires_at,granted_by='DB_ADMIN_CLI',revoked_at=NULL,
    consumed_at=NULL`,[accountId,hours]);
  else{
    const revoked=await client.query(`UPDATE seller_onboarding_invites
      SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL
      AND consumed_at IS NULL`,[accountId]);
    if(!revoked.rowCount)throw new Error('No active unconsumed seller invitation');
  }
  await client.query(`INSERT INTO platform_audit_events(id,actor_kind,event_code,
    subject_kind,subject_id,reason_code) VALUES($1,'SYSTEM',$2,'ACCOUNT',$3,
    'DB_ADMIN_CLI')`,[randomUUID(),action==='grant'?'SELLER_INVITE_GRANTED':
      'SELLER_INVITE_REVOKED',accountId]);
  await client.query('COMMIT');
  process.stdout.write(`${action==='grant'?'Granted':'Revoked'} private-alpha seller invitation for ${accountId}\n`);
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
