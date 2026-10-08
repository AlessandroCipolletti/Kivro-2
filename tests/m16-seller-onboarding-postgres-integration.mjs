import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import {createSellerProfile} from '../dist/packages/persistence/src/seller-profiles.js';
import {handleSellerProfileRequest} from '../dist/apps/web/src/seller/profile-handler.js';

if(!process.env.M14_DATABASE_URL){
  test('private-alpha seller onboarding needs disposable PostgreSQL',{skip:true},()=>{});
}else test('production seller enrollment is invitation-only, expiry-bound and audited',async()=>{
  const database=new pg.Pool({connectionString:process.env.M14_DATABASE_URL,max:5});
  const previousMode=process.env.NODE_ENV,previousOrigin=process.env.APP_ORIGIN;
  process.env.NODE_ENV='production';
  process.env.APP_ORIGIN='https://kivro.example.test';
  const [ordinary,expired,concurrent,revoked,web]=Array.from({length:5},()=>randomUUID());
  try{
    for(const id of [ordinary,expired,concurrent,revoked,web])
      await database.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at,
        auth_email_verified) VALUES($1,$2,'ACTIVE',now(),true)`,[id,`${id}@example.test`]);
    const service=(id)=>({database,auth:{api:{async getSession(){return {user:{id}};}}}});
    const request=()=>new globalThis.Request('https://kivro.example.test/api/seller/profile',{
      method:'POST',headers:{origin:'https://kivro.example.test',
        'content-type':'application/json'},body:JSON.stringify({
          displayName:'Private seller',executionModelConfirmed:true})});
    const denied=await handleSellerProfileRequest(request(),service(ordinary));
    assert.equal(denied.status,403);
    assert.equal((await denied.json()).code,'SELLER_INVITE_REQUIRED');
    assert.equal((await database.query(`SELECT count(*)::int AS n FROM seller_profiles
      WHERE account_id=$1`,[ordinary])).rows[0].n,0);
    await database.query(`INSERT INTO seller_onboarding_invites(account_id,granted_at,
      expires_at,granted_by) VALUES($1,now()-interval '2 days',
      now()-interval '1 day','DB_ADMIN_CLI')`,[expired]);
    await assert.rejects(createSellerProfile(database,expired,'Expired',true),
      {code:'SELLER_INVITE_REQUIRED'});
    const cli=(action,id)=>execFileSync(process.execPath,
      ['tools/kivro-seller-invite.mjs',action,id],{cwd:process.cwd(),
        env:{...process.env,DATABASE_URL:process.env.M14_DATABASE_URL},encoding:'utf8'});
    assert.match(cli('grant',concurrent),/Granted private-alpha/);
    const [first,retry]=await Promise.all([
      createSellerProfile(database,concurrent,'Concurrent',true),
      createSellerProfile(database,concurrent,'Concurrent retry',true)]);
    assert.equal(first.id,retry.id);
    assert.ok((await database.query(`SELECT consumed_at FROM seller_onboarding_invites
      WHERE account_id=$1`,[concurrent])).rows[0].consumed_at);
    assert.equal((await database.query(`SELECT count(*)::int AS n FROM platform_audit_events
      WHERE subject_id=$1 AND event_code='SELLER_INVITE_CONSUMED'`,
    [concurrent])).rows[0].n,1);
    cli('grant',revoked);cli('revoke',revoked);
    await assert.rejects(createSellerProfile(database,revoked,'Revoked',true),
      {code:'SELLER_INVITE_REQUIRED'});
    cli('grant',web);
    const accepted=await handleSellerProfileRequest(request(),service(web));
    assert.equal(accepted.status,201,JSON.stringify(await accepted.clone().json()));
    const profile=(await accepted.json()).profile;
    const replay=await handleSellerProfileRequest(request(),service(web));
    assert.equal(replay.status,200);
    assert.equal((await replay.json()).profile.id,profile.id);
    assert.equal((await database.query(`SELECT count(*)::int AS n FROM seller_profiles
      WHERE account_id=$1`,[web])).rows[0].n,1);
  }finally{
    if(previousMode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=previousMode;
    if(previousOrigin===undefined)delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN=previousOrigin;
    await database.end();
  }
});
