import { randomUUID } from 'node:crypto';
import pg from 'pg';
import process from 'node:process';

const [action,accountId]=process.argv.slice(2);
if(!['grant','revoke'].includes(action)||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId??'')){
  throw new Error('Usage: kivro-operator-grant.mjs grant|revoke ACCOUNT_UUID');
}
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const client=await pool.connect();
try{
  await client.query('BEGIN');
  const account=await client.query(`SELECT 1 FROM accounts WHERE id=$1 AND status='ACTIVE'
    AND email_verified_at IS NOT NULL FOR UPDATE`,[accountId]);
  if(!account.rowCount)throw new Error('Operator account must be active and verified');
  if(action==='grant')await client.query(`INSERT INTO operator_grants(account_id,granted_by)
    VALUES($1,'DB_ADMIN_CLI') ON CONFLICT(account_id) DO UPDATE SET revoked_at=NULL,
    granted_at=now(),granted_by='DB_ADMIN_CLI'`,[accountId]);
  else{
    const revoked=await client.query(`UPDATE operator_grants SET revoked_at=now()
      WHERE account_id=$1 AND revoked_at IS NULL`,[accountId]);
    if(!revoked.rowCount)throw new Error('No active operator grant');
  }
  await client.query(`INSERT INTO platform_audit_events(id,actor_kind,event_code,
    subject_kind,subject_id,reason_code) VALUES($1,'SYSTEM',$2,'ACCOUNT',$3,'DB_ADMIN_CLI')`,
  [randomUUID(),action==='grant'?'OPERATOR_GRANTED':'OPERATOR_REVOKED',accountId]);
  await client.query('COMMIT');
  process.stdout.write(`${action==='grant'?'Granted':'Revoked'} operator authority for ${accountId}\n`);
}catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
