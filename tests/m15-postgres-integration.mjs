import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { PlatformOperationsRepository } from
  '../dist/packages/persistence/src/platform-operations.js';
import { PostgresAvailabilityRepository } from
  '../dist/packages/persistence/src/availability.js';
import { handleOperatorRequest } from '../dist/apps/web/src/operator/handler.js';

if(!process.env.M15_DATABASE_URL){test('M15 PostgreSQL requires disposable container',{skip:true},()=>{});}
else{
  const pool=new pg.Pool({connectionString:process.env.M15_DATABASE_URL,max:6});
  const operator=randomUUID(),buyer=randomUUID(),sellerAccount=randomUUID();
  const seller=randomUUID(),worker=randomUUID(),capability=randomUUID(),version=randomUUID(),job=randomUUID();
  const ops=new PlatformOperationsRepository(pool);
  test('operator grant is separate from buyer and seller identities',async()=>{
    await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at) VALUES
      ($1,'m15-operator@example.test','ACTIVE',now()),
      ($2,'m15-buyer@example.test','ACTIVE',now()),
      ($3,'m15-seller@example.test','ACTIVE',now())`,[operator,buyer,sellerAccount]);
    await assert.rejects(ops.dispatchState(operator),{code:'FORBIDDEN'});
    await pool.query(`INSERT INTO operator_grants(account_id,granted_by) VALUES($1,'DB_ADMIN')`,[operator]);
    await assert.rejects(ops.dispatchState(buyer),{code:'FORBIDDEN'});
    await assert.rejects(ops.dispatchState(sellerAccount),{code:'FORBIDDEN'});
    assert.deepEqual(await ops.dispatchState(operator),{
      halted:false,revision:1,changedAt:(await pool.query(
        'SELECT changed_at FROM platform_dispatch_control')).rows[0].changed_at.toISOString()});
  });
  test('operator HTTP boundary rejects seller role, missing session and cross-origin mutation',async()=>{
    const authFor=(accountId)=>({database:pool,auth:{api:{getSession:async()=>accountId?
      {user:{id:accountId}}:null}}});
    const get=new globalThis.Request('http://localhost/api/operator/dispatch');
    assert.equal((await handleOperatorRequest(get,['dispatch'],authFor(null))).status,401);
    assert.equal((await handleOperatorRequest(get,['dispatch'],authFor(buyer))).status,403);
    assert.equal((await handleOperatorRequest(get,['dispatch'],authFor(sellerAccount))).status,403);
    const cross=new globalThis.Request('http://localhost/api/operator/dispatch',{method:'POST',
      headers:{origin:'https://attacker.example','content-type':'application/json'},
      body:JSON.stringify({halted:true,expectedRevision:1,reasonCode:'TEST'})});
    assert.equal((await handleOperatorRequest(cross,['dispatch'],authFor(operator))).status,403);
  });
  test('global dispatch halt is revisioned, race safe and audited without free-form text',async()=>{
    const outcomes=await Promise.allSettled([
      ops.setDispatchHalt(operator,true,1,'ABUSE_RESPONSE'),
      ops.setDispatchHalt(operator,true,1,'ABUSE_RESPONSE')]);
    assert.equal(outcomes.filter((r)=>r.status==='fulfilled').length,1);
    assert.equal(outcomes.filter((r)=>r.status==='rejected').length,1);
    const state=await ops.dispatchState(operator);
    assert.equal(state.revision,2);
    await assert.rejects(ops.setDispatchHalt(operator,true,1,'ABUSE_RESPONSE'),{code:'CONFLICT'});
    const changed=await ops.setDispatchHalt(operator,true,2,'ABUSE_RESPONSE');
    assert.equal(changed.halted,true);
    assert.equal((await ops.setDispatchHalt(operator,true,changed.revision,'ABUSE_RESPONSE')).revision,
      changed.revision);
    const audit=await pool.query("SELECT * FROM platform_audit_events WHERE event_code='DISPATCH_HALTED'");
    assert.equal(audit.rowCount,1);
    await assert.rejects(pool.query('DELETE FROM platform_audit_events WHERE id=$1',[audit.rows[0].id]),
      /append-only/);
    await ops.setDispatchHalt(operator,false,changed.revision,'REMEDIATED');
    await ops.addDenyPattern(operator,randomUUID(),'  Known Abuse Phrase  ','ABUSE_RESPONSE');
    assert.equal((await pool.query('SELECT normalized_pattern FROM abuse_content_rules')).rows[0]
      .normalized_pattern,'known abuse phrase');
    assert.equal((await pool.query("SELECT count(*) AS count FROM platform_audit_events WHERE event_code='DENY_PATTERN_ADDED'"))
      .rows[0].count,'1');
  });
  test('operator suspensions and seller/buyer reports are ownership scoped',async()=>{
    await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
      VALUES($1,$2,'Seller','ACTIVE','NOT_STARTED')`,[seller,sellerAccount]);
    await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,worker_version,status)
      VALUES($1,$2,'test-key','Worker','LINUX','test','ONLINE')`,[worker,seller]);
    await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
      VALUES($1,$2,'m15-test','M15 Test','PUBLISHED')`,[capability,seller]);
    await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,publication_state,
      version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
      VALUES($1,$2,1,'PUBLISHED','{}',$3,$3,now())`,[version,capability,`sha256:${'a'.repeat(64)}`]);
    await pool.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,
      status,contract_snapshot) VALUES($1,$2,$3,$4,'CREATED','{}')`,[job,buyer,version,worker]);
    const sensitive='buyer-private-prompt-and-api-key-sentinel';
    await pool.query(`INSERT INTO job_input_manifests(id,job_id,schema_hash,manifest_hash,payload,
      total_bytes,file_count) VALUES($1,$2,$3,$3,$4,0,0)`,[randomUUID(),job,
      `sha256:${'b'.repeat(64)}`,{values:{prompt:sensitive},assets:{}}]);
    await pool.query(`INSERT INTO job_transitions(id,job_id,sequence,from_status,to_status,
      at,actor,reason,correlation_id) VALUES($1,$2,1,'CREATED','QUEUED',now(),
        'CLOUD','AUDIT_FIXTURE',$3)`,[randomUUID(),job,randomUUID()]);
    await ops.report(buyer,randomUUID(),job,'BUYER','UNSAFE_OUTPUT');
    await ops.report(sellerAccount,randomUUID(),job,'SELLER','MALICIOUS_INPUT');
    await assert.rejects(ops.report(operator,randomUUID(),job,'BUYER','FRAUD'),{code:'FORBIDDEN'});
    await ops.report(buyer,randomUUID(),job,'BUYER','UNSAFE_OUTPUT');
    assert.equal((await ops.openReports(operator)).length,2);
    const [report]=await ops.openReports(operator);
    await assert.rejects(ops.reviewReport(operator,report.id,'CLOSED','ABUSE_RESPONSE'),
      {code:'INVALID_STATE'});
    await ops.reviewReport(operator,report.id,'REVIEWED','INVESTIGATED');
    await ops.reviewReport(operator,report.id,'REVIEWED','INVESTIGATED');
    await ops.reviewReport(operator,report.id,'CLOSED','RESOLVED');
    assert.equal((await ops.openReports(operator)).length,1);
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM platform_audit_events
      WHERE job_id=$1 AND subject_kind='REPORT'`,[job])).rows[0].count,2);
    await ops.setSuspension(operator,'CAPABILITY',capability,true,'ABUSE_RESPONSE');
    assert.equal((await pool.query('SELECT status FROM capabilities WHERE id=$1',[capability])).rows[0].status,
      'SUSPENDED');
    await ops.setSuspension(operator,'ACCOUNT',buyer,true,'ABUSE_RESPONSE');
    assert.equal((await pool.query('SELECT status FROM accounts WHERE id=$1',[buyer])).rows[0].status,
      'SUSPENDED');
    await ops.setSuspension(operator,'WORKER',worker,true,'ABUSE_RESPONSE');
    assert.equal((await pool.query('SELECT status FROM worker_devices WHERE id=$1',[worker])).rows[0].status,
      'REVOKED');
    await assert.rejects(ops.setSuspension(operator,'WORKER',worker,false,'REMEDIATED'),
      {code:'INVALID_STATE'});
    await ops.setSuspension(operator,'ACCOUNT',buyer,false,'REMEDIATED');
    await ops.setSuspension(operator,'CAPABILITY',capability,false,'REMEDIATED');
    const metrics=await ops.metrics(operator);
    assert.equal(typeof metrics.jobs_created,'number');
    assert.equal(metrics.abuse_reports,2);
    const audit=await ops.jobAudit(operator,job);
    assert.deepEqual(audit.map((event)=>event.code),
      ['QUEUED','REPORT_REVIEWED','REPORT_CLOSED']);
    assert.equal(JSON.stringify(audit).includes(sensitive),false);
    assert.equal(JSON.stringify(metrics).includes(sensitive),false);
  });
  test('invalid quote attempts still consume the durable buyer rate limit',async()=>{
    await pool.query('UPDATE platform_buyer_limits SET max_quotes_per_minute=2 WHERE singleton=true');
    const availability=new PostgresAvailabilityRepository(pool,{});
    const attempt=()=>availability.quote({id:randomUUID(),buyerAccountId:buyer,
      capabilityId:randomUUID(),executionMode:'IMMEDIATE_ONLY'});
    await assert.rejects(attempt(),{code:'NOT_FOUND'});
    await assert.rejects(attempt(),{code:'NOT_FOUND'});
    await assert.rejects(attempt(),{code:'BUYER_LIMIT'});
    assert.equal((await pool.query('SELECT quote_count FROM buyer_quote_rate WHERE account_id=$1',
      [buyer])).rows[0].quote_count,3);
  });
  test.after(async()=>pool.end());
}
