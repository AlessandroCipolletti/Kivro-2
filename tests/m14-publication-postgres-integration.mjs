import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import { fixture } from './seller-publication-contract.test.mjs';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { PostgresSellerPublicationRepository } from
  '../dist/packages/persistence/src/seller-publication.js';
import { MarketplaceCatalog } from '../dist/packages/persistence/src/marketplace-catalog.js';
import { PostgresAvailabilityRepository } from
  '../dist/packages/persistence/src/availability.js';
import { PostgresWorkerHeartbeatRepository } from
  '../dist/packages/persistence/src/worker-heartbeat.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { handleWorkerMessage } from '../dist/apps/web/src/worker/control-handler.js';
import { getAuthService } from '../dist/apps/web/src/auth/server.js';
import { workerMessageHash,workerSignatureBytes } from
  '../dist/packages/worker-protocol/src/auth.js';

if(!process.env.M14_DATABASE_URL){
  test('M14 publication integration requires disposable PostgreSQL',{skip:true},()=>{});
}else test('Worker review is staged privately; seller publication is exact, atomic and replay safe',async()=>{
  process.env.KIVRO_STRIPE_MODE='test';
  process.env.DATABASE_URL=process.env.M14_DATABASE_URL;
  process.env.APP_ORIGIN='http://127.0.0.1:9876';
  process.env.BETTER_AUTH_SECRET='m14-publication-test-secret-32-characters';
  process.env.AUTH_OUTBOX_KEY_BASE64=Buffer.alloc(32,17).toString('base64');
  process.env.KIVRO_CONTROL_PLANE_ID='test-plane';
  process.env.KIVRO_CONTROL_PLANE_STATE='ACTIVE';
  const pool=new pg.Pool({connectionString:process.env.M14_DATABASE_URL,max:4});
  const sellerAccount=randomUUID(),otherAccount=randomUUID(),sellerProfile=randomUUID();
  const review=fixture(),worker=review.workerDeviceId,candidate=review.candidate;
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const repository=new PostgresSellerPublicationRepository(pool);
  const catalog=new MarketplaceCatalog(pool,new PostgresAvailabilityRepository(pool,
    new PostgresFinanceRepository(pool,'test')));
  try{
    await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at,auth_email_verified)
      VALUES($1,$3,'ACTIVE',now(),true),($2,$4,'ACTIVE',now(),true)`,
    [sellerAccount,otherAccount,`${sellerAccount}@example.test`,`${otherAccount}@example.test`]);
    await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
      VALUES($1,$2,'Publication seller','ACTIVE','READY')`,[sellerProfile,sellerAccount]);
    await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_account_id,
      stripe_mode,onboarding_status,transfers_enabled,payouts_enabled,last_reconciled_at)
      VALUES($1,'acct_M14FIXTURE','test','READY',true,true,now())`,[sellerProfile]);
    await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
      worker_version,status) VALUES($1,$2,$3,'Review Worker','LINUX','test','PAIRED')`,
    [worker,sellerProfile,publicKey.export({type:'spki',format:'pem'})]);
    const signed=(body,forge=false)=>{
      const fields={workerDeviceId:worker,controlPlaneId:'test-plane',messageId:randomUUID(),
        signedAt:new Date().toISOString(),bodyHash:workerMessageHash(body)};
      const signature=forge?Buffer.alloc(64).toString('base64url'):
        sign(null,workerSignatureBytes(fields),privateKey).toString('base64url');
      return new globalThis.Request('http://127.0.0.1:9876/worker/messages',{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({body,envelope:{...fields,signature}})});
    };
    assert.equal((await handleWorkerMessage(signed(review,true))).status,403,
      'forged Worker test evidence cannot enter the review table');
    assert.equal((await handleWorkerMessage(signed(review))).status,204);
    await assert.rejects(repository.stageFromAuthenticatedWorker(review,randomUUID()),
      {code:'NOT_ELIGIBLE'});
    const staged=await repository.stageFromAuthenticatedWorker(review,worker);
    assert.equal((await repository.stageFromAuthenticatedWorker(review,worker)).reviewId,
      staged.reviewId,'lost Worker acknowledgement is idempotent');
    assert.equal((await repository.stageFromAuthenticatedWorker({...review,
      messageId:randomUUID(),controlPlaneId:'new-active-plane'},worker)).reviewId,
      staged.reviewId,'a transport retry or backend transition cannot change tested content');
    assert.equal((await repository.listForSeller(otherAccount)).length,0);
    assert.equal((await repository.listForSeller(sellerAccount)).length,1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM capabilities')).rows[0].n,0,
      'A signed Worker test report never publishes by itself');
    await new PostgresWorkerHeartbeatRepository(pool).observe({
      type:'WORKER_HEARTBEAT',protocolVersion:'kivro-worker/1',messageId:randomUUID(),
      controlPlaneId:'test-plane',workerDeviceId:worker,workerRelease:'m14-test',
      sentAt:new Date().toISOString(),openClawVersion:'2026.8.2',status:'ONLINE',
      runningJobs:0,capacity:1,policyVersion:1,localRevision:0,
      capabilityReadiness:[{capabilityVersionId:candidate.id,
        policyValidationHash:staged.policyValidationHash,state:'READY',
        checks:{sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true}}]},
    worker,'test-plane');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM capability_readiness
      WHERE capability_version_id=$1`,[candidate.id])).rows[0].n,0,
    'an installed but unpublished version cannot enter public readiness');
    const approval={reviewId:staged.reviewId,capabilityVersionId:candidate.id,
      candidateHash:staged.candidateHash,manifestHash:candidate.workerManifestHash,
      packageHash:candidate.localPackageHash,
      policyValidationHash:staged.policyValidationHash,
      slug:`publication-${candidate.capabilityId}`,name:'Reviewed research',
      description:'A reviewed research task with a narrow input and output contract.',
      category:'RESEARCH',shortDescription:'A reviewed research task with a narrow contract.',
      tags:['research'],strengths:['Narrow contract'],limitations:['No personal browser'],
      visibility:'PUBLIC',availability:{schedule:{mode:'ALWAYS_AVAILABLE',timezone:'UTC',
        weeklyWindows:[]},concurrencyLimit:1,queueLimit:1,futureReservationLimit:1,
        estimatedRuntimeSeconds:120,maxWaitSeconds:3600},
      consentDependencyIds:review.requiredConsents.map((item)=>item.dependencyId),
      providerCostAcknowledged:true,localPermissionReviewAcknowledged:true,
      approvedAt:new Date().toISOString()};
    await assert.rejects(repository.publish(otherAccount,approval),{code:'NOT_FOUND'});
    await assert.rejects(repository.publish(sellerAccount,{...approval,
      localPermissionReviewAcknowledged:undefined}),{code:'CONSENT_MISSING'});
    await assert.rejects(repository.publish(sellerAccount,{...approval,
      consentDependencyIds:approval.consentDependencyIds.slice(1)}),{code:'CONSENT_MISSING'});
    await assert.rejects(repository.publish(sellerAccount,{...approval,
      packageHash:`sha256:${'b'.repeat(64)}`}),{code:'REVIEW_CHANGED'});
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM capability_versions')).rows[0].n,0,
      'Rejected approvals must roll back fully');
    const result=await repository.publish(sellerAccount,approval);
    assert.deepEqual(result,{capabilityId:candidate.capabilityId,
      capabilityVersionId:candidate.id,visibility:'PUBLIC'});
    assert.deepEqual(await repository.publish(sellerAccount,approval),result,
      'seller retry after lost response cannot publish twice');
    await pool.query("UPDATE capabilities SET visibility='UNLISTED' WHERE id=$1",
      [candidate.capabilityId]);
    assert.deepEqual(await repository.publish(sellerAccount,approval),result,
      'approval replay reports the original result even after later visibility changes');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM capability_versions')).rows[0].n,1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM capability_permission_consents')).rows[0].n,
      review.requiredConsents.length);
    const version=(await pool.query('SELECT version_snapshot FROM capability_versions WHERE id=$1',
      [candidate.id])).rows[0].version_snapshot;
    assert.equal(version.price.buyerAmountMinor,999);
    assert.deepEqual(version.externalProcessors,['Synthetic provider']);
    assert.equal(version.policyValidationHash,staged.policyValidationHash);
    assert.equal((await pool.query('SELECT seller_paused FROM capability_availability_policies WHERE capability_id=$1',
      [candidate.capabilityId])).rows[0].seller_paused,true,
    'A published version remains paused until fresh Worker readiness and seller resume');
    await assert.rejects(repository.publish(sellerAccount,{...approval,name:'Altered'}),{code:'CONFLICT'});
    await assert.rejects(pool.query('DELETE FROM capability_permission_consents'),/append-only/);
    await assert.rejects(pool.query('UPDATE capability_publication_reviews SET review_hash=$2 WHERE id=$1',
      [staged.reviewId,hashCanonicalJson({changed:true})]),/immutable/);

    const next=fixture();
    const review2={...next,workerDeviceId:worker,candidate:{...next.candidate,
      workerDeviceId:worker,capabilityId:candidate.capabilityId,versionNumber:2}};
    const staged2=await repository.stageFromAuthenticatedWorker(review2,worker);
    const approval2={...approval,reviewId:staged2.reviewId,
      capabilityVersionId:review2.candidate.id,candidateHash:staged2.candidateHash,
      manifestHash:review2.candidate.workerManifestHash,
      packageHash:review2.candidate.localPackageHash,
      policyValidationHash:staged2.policyValidationHash,
      consentDependencyIds:review2.requiredConsents.map((item)=>item.dependencyId),
      versionChangeAcknowledged:true,approvedAt:new Date().toISOString()};
    await assert.rejects(repository.publish(sellerAccount,{...approval2,
      versionChangeAcknowledged:undefined}),{code:'CONSENT_MISSING'},
    'a new version requires a fresh explicit change review');
    await repository.publish(sellerAccount,approval2);
    const historical=(await pool.query('SELECT version_snapshot FROM capability_versions WHERE id=$1',
      [candidate.id])).rows[0].version_snapshot;
    assert.deepEqual(historical.externalProcessors,['Synthetic provider'],
      'later publication cannot rewrite the old buyer processor declaration');
    const rollbackId=randomUUID();
    await assert.rejects(repository.rollback(sellerAccount,candidate.capabilityId,
      candidate.id,review2.candidate.id,rollbackId),{code:'ROLLBACK_NOT_READY'});
    await pool.query(`UPDATE worker_devices SET status='ONLINE',last_seen_at=now() WHERE id=$1`,[worker]);
    await pool.query(`INSERT INTO worker_heartbeats(worker_device_id,control_plane_id,
      worker_release,reported_status,running_jobs,capacity,policy_version,local_revision)
      VALUES($1,'test-plane','2026.10.7','ONLINE',0,1,1,0)
      ON CONFLICT(worker_device_id,control_plane_id) DO UPDATE SET
      worker_release='2026.10.7',reported_status='ONLINE',capacity=1,
      observed_at=now()`,[worker]);
    await pool.query(`INSERT INTO capability_readiness(capability_id,capability_version_id,
      worker_device_id,state,sandbox_verified,required_secrets_ready,runtime_healthy)
      VALUES($1,$2,$3,'READY',true,true,true)`,[candidate.capabilityId,candidate.id,worker]);
    await pool.query(`UPDATE seller_connect_profiles SET payouts_enabled=false
      WHERE seller_profile_id=$1`,[sellerProfile]);
    await assert.rejects(repository.rollback(sellerAccount,candidate.capabilityId,
      candidate.id,review2.candidate.id,rollbackId),{code:'NOT_ELIGIBLE'},
    'fresh Worker readiness cannot override disabled seller payouts');
    assert.equal((await pool.query('SELECT current_version_id FROM capabilities WHERE id=$1',
      [candidate.capabilityId])).rows[0].current_version_id,review2.candidate.id);
    await pool.query(`UPDATE seller_connect_profiles SET payouts_enabled=true,
      last_reconciled_at=now() WHERE seller_profile_id=$1`,[sellerProfile]);
    await assert.rejects(repository.rollback(otherAccount,candidate.capabilityId,
      candidate.id,review2.candidate.id,rollbackId),{code:'NOT_ELIGIBLE'});
    const rolled=await repository.rollback(sellerAccount,candidate.capabilityId,
      candidate.id,review2.candidate.id,rollbackId);
    assert.deepEqual(rolled,{capabilityId:candidate.capabilityId,
      capabilityVersionId:candidate.id,previousVersionId:review2.candidate.id,paused:true});
    assert.deepEqual(await repository.rollback(sellerAccount,candidate.capabilityId,
      candidate.id,review2.candidate.id,rollbackId),rolled,
      'lost rollback acknowledgement must not mutate version routing twice');
    assert.equal((await pool.query('SELECT current_version_id FROM capabilities WHERE id=$1',
      [candidate.capabilityId])).rows[0].current_version_id,candidate.id);
    assert.deepEqual((await pool.query(`SELECT version_id,state FROM capability_version_lifecycle
      WHERE version_id IN ($1,$2) ORDER BY version_id`,[candidate.id,review2.candidate.id]))
      .rows.map((row)=>[row.version_id,row.state]).sort(),
    [[candidate.id,'PUBLISHED'],[review2.candidate.id,'RETIRED']].sort());
    assert.equal((await pool.query(`SELECT seller_paused FROM capability_availability_policies
      WHERE capability_id=$1`,[candidate.capabilityId])).rows[0].seller_paused,true);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM capability_version_activations
      WHERE id=$1`,[rollbackId])).rows[0].n,1);
    await assert.rejects(repository.rollback(sellerAccount,candidate.capabilityId,
      review2.candidate.id,candidate.id,randomUUID()),{code:'ROLLBACK_NOT_READY'},
    'a second rollback must recheck the target version readiness');
    await assert.rejects(pool.query('DELETE FROM capability_version_activations'),/append-only/);

    const slug=approval.slug;
    const visibilityId=randomUUID();
    const concurrentVisibility=await Promise.all([repository.changeVisibility(sellerAccount,
      candidate.capabilityId,'PUBLIC','PRIVATE',visibilityId),
    repository.changeVisibility(sellerAccount,candidate.capabilityId,
      'PUBLIC','PRIVATE',visibilityId)]);
    assert.deepEqual(concurrentVisibility,[
      {capabilityId:candidate.capabilityId,visibility:'PRIVATE'},
      {capabilityId:candidate.capabilityId,visibility:'PRIVATE'}],
    'concurrent retry must commit one visibility transition');
    assert.equal(await catalog.detail(slug,otherAccount),null,
      'private capability is inaccessible before an explicit grant');
    const grantId=randomUUID();
    const grants=await Promise.all([repository.grantPrivateAccess(sellerAccount,
      candidate.capabilityId,`${otherAccount}@example.test`,grantId),
    repository.grantPrivateAccess(sellerAccount,candidate.capabilityId,
      `${otherAccount}@example.test`,grantId)]);
    const granted=grants[0];
    assert.equal(granted.buyerAccountId,otherAccount);
    assert.deepEqual(grants,[granted,granted],
      'a concurrent grant retry creates one active buyer authorization');
    await assert.rejects(repository.grantPrivateAccess(sellerAccount,candidate.capabilityId,
      `${sellerAccount}@example.test`,randomUUID()),{code:'NOT_ELIGIBLE'},
    'a seller cannot use a self-grant as a substitute for a second buyer account');
    assert.equal((await repository.listPrivateGrants(sellerAccount,candidate.capabilityId)).length,1);
    assert.equal((await repository.listPrivateGrants(otherAccount,candidate.capabilityId)).length,0);
    assert.equal((await catalog.detail(slug,otherAccount))?.id,candidate.capabilityId);
    assert.equal(await catalog.detail(slug,null),null);
    assert.equal((await catalog.search({query:'Reviewed research'})).length,0,
      'private grants do not put capability into public discovery');
    await repository.changeVisibility(sellerAccount,candidate.capabilityId,
      'PRIVATE','UNLISTED',randomUUID());
    assert.equal((await repository.listPrivateGrants(sellerAccount,candidate.capabilityId)).length,0,
      'leaving PRIVATE revokes grants so they do not revive on a later return');
    assert.equal((await catalog.detail(slug,null))?.id,candidate.capabilityId);
    assert.equal((await catalog.search({query:'Reviewed research'})).length,0,
      'UNLISTED direct link does not enter search');
    await repository.changeVisibility(sellerAccount,candidate.capabilityId,
      'UNLISTED','PRIVATE',randomUUID());
    assert.equal(await catalog.detail(slug,otherAccount),null,
      'the former buyer grant cannot silently reactivate');
    const secondGrant=randomUUID();
    await repository.grantPrivateAccess(sellerAccount,candidate.capabilityId,
      `${otherAccount}@example.test`,secondGrant);
    await assert.rejects(repository.revokePrivateAccess(otherAccount,candidate.capabilityId,
      secondGrant),{code:'NOT_FOUND'});
    await repository.revokePrivateAccess(sellerAccount,candidate.capabilityId,secondGrant);
    await repository.revokePrivateAccess(sellerAccount,candidate.capabilityId,secondGrant);
    assert.equal(await catalog.detail(slug,otherAccount),null);
    await pool.query(`UPDATE seller_connect_profiles SET payouts_enabled=false
      WHERE seller_profile_id=$1`,[sellerProfile]);
    await assert.rejects(repository.changeVisibility(sellerAccount,candidate.capabilityId,
      'PRIVATE','PUBLIC',randomUUID()),{code:'PUBLIC_NOT_READY'},
    'Worker readiness cannot bypass disabled Connect payout');
    assert.equal((await pool.query('SELECT visibility FROM capabilities WHERE id=$1',
      [candidate.capabilityId])).rows[0].visibility,'PRIVATE');
    await pool.query(`UPDATE seller_connect_profiles SET payouts_enabled=true,
      last_reconciled_at=now() WHERE seller_profile_id=$1`,[sellerProfile]);
    await repository.changeVisibility(sellerAccount,candidate.capabilityId,
      'PRIVATE','PUBLIC',randomUUID());
    assert.equal((await catalog.search({query:'Reviewed research'})).length,1);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM capability_visibility_changes
      WHERE capability_id=$1`,[candidate.capabilityId])).rows[0].n,4);
    await assert.rejects(pool.query('DELETE FROM capability_visibility_changes'),/append-only/);
  }finally{await pool.end();await getAuthService().database.end();}
});
