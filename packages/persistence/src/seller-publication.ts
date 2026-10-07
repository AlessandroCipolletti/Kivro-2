import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { PriceSnapshotSchema } from '../../contracts/src/pricing.js';
import { describePublicationChanges } from '../../domain/src/capability-version.js';
import { SellerPublicationApprovalSchema, WorkerCapabilityReviewSchema,
  workerReviewContentHash,type WorkerCapabilityReview } from
  '../../contracts/src/seller-publication.js';

const id = z.uuid();
type ReviewRow = { id:string;seller_profile_id:string;worker_device_id:string;
  capability_id:string;capability_version_id:string;review_hash:string;
  review_json:unknown;state:'REVIEW'|'PUBLISHED';approval_hash:string|null };

export class SellerPublicationError extends Error {
  constructor(readonly code:'NOT_FOUND'|'NOT_ELIGIBLE'|'STALE_REVIEW'|'REVIEW_CHANGED'|
    'CONSENT_MISSING'|'PRICE_CHANGED'|'VERSION_CONFLICT'|'CONFLICT'|'ROLLBACK_NOT_READY'|
    'PUBLIC_NOT_READY') {
    super(code); this.name='SellerPublicationError';
  }
}

function policyHash(review:WorkerCapabilityReview):string {
  return hashCanonicalJson({candidateHash:hashCanonicalJson(review.candidate),tests:review.tests});
}

/** The signed Worker may stage a buyer-safe candidate; only a seller session can publish it. */
export class PostgresSellerPublicationRepository {
  constructor(private readonly pool:Pool) {}

  async stageFromAuthenticatedWorker(raw:unknown, authenticatedWorkerId:string):Promise<{
    reviewId:string;candidateHash:string;policyValidationHash:string }> {
    const review=WorkerCapabilityReviewSchema.parse(raw);
    if(review.workerDeviceId!==id.parse(authenticatedWorkerId))
      throw new SellerPublicationError('NOT_ELIGIBLE');
    const now=Date.now(), tested=Date.parse(review.tests.testedAt);
    if(!Number.isFinite(tested)||tested>now+30_000||now-tested>86_400_000)
      throw new SellerPublicationError('STALE_REVIEW');
    const reviewHash=workerReviewContentHash(review);
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const device=await client.query<{seller_profile_id:string;status:string;account_id:string}>(
        `SELECT d.seller_profile_id,d.status,s.account_id FROM worker_devices d
         JOIN seller_profiles s ON s.id=d.seller_profile_id
         JOIN accounts a ON a.id=s.account_id
         WHERE d.id=$1 AND d.revoked_at IS NULL AND s.status<>'SUSPENDED'
           AND a.status='ACTIVE' AND a.auth_email_verified=true FOR SHARE OF d,s,a`,
        [review.workerDeviceId]);
      const owner=device.rows[0];
      if(!owner||owner.status==='REVOKED')throw new SellerPublicationError('NOT_ELIGIBLE');
      const prior=await client.query<ReviewRow>(`SELECT * FROM capability_publication_reviews
        WHERE capability_version_id=$1 FOR UPDATE`,[review.candidate.id]);
      if(prior.rows[0]){
        if((prior.rows[0].review_hash!==reviewHash&&
          workerReviewContentHash(prior.rows[0].review_json)!==reviewHash)||
          prior.rows[0].worker_device_id!==review.workerDeviceId)
          throw new SellerPublicationError('REVIEW_CHANGED');
        await client.query('COMMIT');
        return {reviewId:prior.rows[0].id,candidateHash:hashCanonicalJson(review.candidate),
          policyValidationHash:policyHash(review)};
      }
      const reviewId=randomUUID();
      await client.query(`INSERT INTO capability_publication_reviews(id,seller_profile_id,
        worker_device_id,capability_id,capability_version_id,review_hash,review_json)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,[reviewId,owner.seller_profile_id,
        review.workerDeviceId,review.candidate.capabilityId,review.candidate.id,
        reviewHash,review]);
      await client.query('COMMIT');
      return {reviewId,candidateHash:hashCanonicalJson(review.candidate),
        policyValidationHash:policyHash(review)};
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }

  async listForSeller(sellerAccountId:string):Promise<readonly {
    reviewId:string;state:'REVIEW'|'PUBLISHED';candidate:WorkerCapabilityReview['candidate'];
    requiredConsents:WorkerCapabilityReview['requiredConsents'];
    providerCost:WorkerCapabilityReview['providerCost'];
    candidateHash:string;policyValidationHash:string;testedAt:string;
    previousVersionId:string|null;previousVersionNumber:number|null;
    changesFromCurrent:readonly string[] }[]> {
    const rows=await this.pool.query<ReviewRow & {current_version_snapshot:unknown}>(
      `SELECT r.*,v.version_snapshot AS current_version_snapshot
      FROM capability_publication_reviews r
      JOIN seller_profiles s ON s.id=r.seller_profile_id
      LEFT JOIN capabilities c ON c.id=r.capability_id AND c.seller_profile_id=r.seller_profile_id
      LEFT JOIN capability_versions v ON v.id=c.current_version_id
      WHERE s.account_id=$1 ORDER BY r.created_at DESC LIMIT 50`,[id.parse(sellerAccountId)]);
    return rows.rows.map((row)=>{
      const review=WorkerCapabilityReviewSchema.parse(row.review_json);
      const previous=row.current_version_snapshot===null?null:
        PublishedCapabilityVersionSchema.parse(row.current_version_snapshot);
      return {reviewId:row.id,state:row.state,candidate:review.candidate,
        requiredConsents:review.requiredConsents,providerCost:review.providerCost,
        candidateHash:hashCanonicalJson(review.candidate),
        policyValidationHash:policyHash(review),testedAt:review.tests.testedAt,
        previousVersionId:previous?.id??null,
        previousVersionNumber:previous?.versionNumber??null,
        changesFromCurrent:previous&&row.state==='REVIEW'?
          review.candidate.versionNumber>previous.versionNumber?
            describePublicationChanges(previous,review.candidate):
            ['This review is older than the active version; start a new draft']:[]};
    });
  }

  async listVersionHistoryForSeller(sellerAccountId:string):Promise<readonly {
    capabilityId:string;slug:string;name:string;visibility:string;currentVersionId:string|null;
    versions:readonly {id:string;versionNumber:number;lifecycle:string;
      price:ReturnType<typeof PriceSnapshotSchema.parse>;
      workerManifestHash:string;permissionPolicyHash:string;
      publicPermissionManifest:unknown;ioContract:unknown;dependencySnapshot:unknown}[] }[]> {
    const rows=await this.pool.query<{capability_id:string;slug:string;name:string;visibility:string;
      current_version_id:string|null;version_snapshot:unknown;lifecycle:string}>(
      `SELECT c.id AS capability_id,c.slug,c.name,c.visibility,c.current_version_id,
        v.version_snapshot,l.state AS lifecycle FROM capabilities c
       JOIN seller_profiles s ON s.id=c.seller_profile_id
       JOIN capability_versions v ON v.capability_id=c.id
       JOIN capability_version_lifecycle l ON l.version_id=v.id
       WHERE s.account_id=$1 AND v.publication_state='PUBLISHED'
       ORDER BY c.id,v.version_number DESC LIMIT 100`,[id.parse(sellerAccountId)]);
    const grouped=new Map<string,{capabilityId:string;slug:string;name:string;visibility:string;
      currentVersionId:string|null;versions:{id:string;versionNumber:number;
        lifecycle:string;price:ReturnType<typeof PriceSnapshotSchema.parse>;
        workerManifestHash:string;permissionPolicyHash:string;
        publicPermissionManifest:unknown;ioContract:unknown;dependencySnapshot:unknown}[]}>();
    for(const row of rows.rows){
      const version=PublishedCapabilityVersionSchema.parse(row.version_snapshot);
      let item=grouped.get(row.capability_id);
      if(!item){item={capabilityId:row.capability_id,slug:row.slug,name:row.name,
        visibility:row.visibility,currentVersionId:row.current_version_id,versions:[]};
        grouped.set(row.capability_id,item);}
      item.versions.push({id:version.id,versionNumber:version.versionNumber,
        lifecycle:row.lifecycle,price:version.price,
        workerManifestHash:version.workerManifestHash,
        permissionPolicyHash:version.permissionPolicyHash,
        publicPermissionManifest:version.publicPermissionManifest,
        ioContract:version.ioContract,dependencySnapshot:version.dependencySnapshot});
    }
    return [...grouped.values()];
  }

  async publish(sellerAccountId:string,rawApproval:unknown):Promise<{
    capabilityId:string;capabilityVersionId:string;visibility:string }> {
    const sellerId=id.parse(sellerAccountId), approval=SellerPublicationApprovalSchema.parse(rawApproval);
    const stripeMode=process.env.KIVRO_STRIPE_MODE;
    if((stripeMode!=='test'&&stripeMode!=='live')||
      (process.env.NODE_ENV==='production'&&stripeMode!=='live'))
      throw new SellerPublicationError('NOT_ELIGIBLE');
    const approvalHash=hashCanonicalJson(approval);
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const row=await client.query<ReviewRow>(`SELECT r.* FROM capability_publication_reviews r
        JOIN seller_profiles s ON s.id=r.seller_profile_id
        WHERE r.id=$1 AND s.account_id=$2 FOR UPDATE OF r`,[approval.reviewId,sellerId]);
      const staged=row.rows[0];
      if(!staged)throw new SellerPublicationError('NOT_FOUND');
      if(staged.state==='PUBLISHED'){
        if(staged.approval_hash!==approvalHash)throw new SellerPublicationError('CONFLICT');
        await client.query('COMMIT');
        return {capabilityId:staged.capability_id,
          capabilityVersionId:staged.capability_version_id,
          visibility:approval.visibility};
      }
      if(approval.localPermissionReviewAcknowledged!==true)
        throw new SellerPublicationError('CONSENT_MISSING');
      const review=WorkerCapabilityReviewSchema.parse(staged.review_json);
      const candidate=review.candidate;
      if(candidate.id!==approval.capabilityVersionId||
        candidate.id!==staged.capability_version_id||
        candidate.capabilityId!==staged.capability_id||
        candidate.workerDeviceId!==staged.worker_device_id||
        hashCanonicalJson(candidate)!==approval.candidateHash||
        candidate.workerManifestHash!==approval.manifestHash||
        candidate.localPackageHash!==approval.packageHash||
        policyHash(review)!==approval.policyValidationHash)
        throw new SellerPublicationError('REVIEW_CHANGED');
      const expected=new Set(review.requiredConsents.map((entry)=>entry.dependencyId));
      if(expected.size!==approval.consentDependencyIds.length||
        approval.consentDependencyIds.some((entry)=>!expected.has(entry)))
        throw new SellerPublicationError('CONSENT_MISSING');
      if(approval.availability.concurrencyLimit>candidate.concurrencyLimit)
        throw new SellerPublicationError('NOT_ELIGIBLE');
      if(Date.now()-Date.parse(review.tests.testedAt)>86_400_000||
        Date.parse(approval.approvedAt)<Date.parse(review.tests.testedAt)||
        Date.parse(approval.approvedAt)>Date.now()+30_000)
        throw new SellerPublicationError('STALE_REVIEW');
      const seller=await client.query<{id:string;payout_status:string;status:string;
        account_status:string;auth_email_verified:boolean;onboarding_status:string|null;
        stripe_mode:string|null;stripe_account_id:string|null;transfers_enabled:boolean|null;
        payouts_enabled:boolean|null;payout_fresh:boolean}>(`SELECT s.id,s.payout_status,s.status,
        a.status AS account_status,a.auth_email_verified,connect.onboarding_status,
        connect.stripe_mode,connect.stripe_account_id,connect.transfers_enabled,
        connect.payouts_enabled,
        COALESCE(connect.last_reconciled_at>now()-interval '24 hours',false) AS payout_fresh
        FROM seller_profiles s JOIN accounts a ON a.id=s.account_id
        LEFT JOIN seller_connect_profiles connect ON connect.seller_profile_id=s.id
        WHERE s.id=$1 AND s.account_id=$2 FOR UPDATE OF s,a`,
      [staged.seller_profile_id,sellerId]);
      const owner=seller.rows[0];
      if(!owner||owner.status==='SUSPENDED'||owner.account_status!=='ACTIVE'||
        !owner.auth_email_verified||owner.payout_status!=='READY'||
        owner.onboarding_status!=='READY'||!owner.stripe_account_id||
        !owner.transfers_enabled||!owner.payouts_enabled||!owner.payout_fresh||
        owner.stripe_mode!==stripeMode)
        throw new SellerPublicationError('NOT_ELIGIBLE');
      const device=await client.query<{status:string;revoked_at:Date|null}>(
        `SELECT status,revoked_at FROM worker_devices WHERE id=$1 AND seller_profile_id=$2
         FOR SHARE`,[staged.worker_device_id,staged.seller_profile_id]);
      if(!device.rows[0]||device.rows[0].status==='REVOKED'||device.rows[0].revoked_at)
        throw new SellerPublicationError('NOT_ELIGIBLE');
      await this.assertPrice(client,candidate.price);
      const existing=await client.query<{seller_profile_id:string;current_version_id:string|null;
        slug:string}>(`SELECT seller_profile_id,current_version_id,slug FROM capabilities
        WHERE id=$1 FOR UPDATE`,[staged.capability_id]);
      if(existing.rows[0]){
        if(existing.rows[0].seller_profile_id!==staged.seller_profile_id||
          existing.rows[0].slug!==approval.slug)throw new SellerPublicationError('NOT_ELIGIBLE');
        if(approval.versionChangeAcknowledged!==true)
          throw new SellerPublicationError('CONSENT_MISSING');
        const max=await client.query<{n:number}>(`SELECT COALESCE(max(version_number),0)::int AS n
          FROM capability_versions WHERE capability_id=$1`,[candidate.capabilityId]);
        if(candidate.versionNumber!==max.rows[0]!.n+1)
          throw new SellerPublicationError('VERSION_CONFLICT');
      }else{
        if(candidate.versionNumber!==1)throw new SellerPublicationError('VERSION_CONFLICT');
        await client.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,
          status,visibility) VALUES($1,$2,$3,$4,$5,'DRAFT','DRAFT')`,
        [candidate.capabilityId,staged.seller_profile_id,approval.slug,
          approval.name,approval.description]);
      }
      const fields=Object.fromEntries(Object.entries(candidate)
        .filter(([key])=>key!=='requestedAt'));
      const published=PublishedCapabilityVersionSchema.parse({...fields,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:approval.policyValidationHash});
      await client.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,$3,'PUBLISHED',$4,$5,$6,$7)`,
      [candidate.id,candidate.capabilityId,candidate.versionNumber,published,
        candidate.workerManifestHash,approval.policyValidationHash,published.publishedAt]);
      for(const permission of review.requiredConsents){
        await client.query(`INSERT INTO capability_permission_consents(id,capability_version_id,
          seller_account_id,worker_device_id,dependency_id,permission_type,
          permission_value_ref,manifest_hash,approved_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [randomUUID(),candidate.id,sellerId,staged.worker_device_id,
          permission.dependencyId,permission.permissionType,permission.permissionValueRef,
          approval.manifestHash,approval.approvedAt]);
      }
      await client.query(`INSERT INTO capability_availability_policies(capability_id,
        schedule_override,concurrency_limit,queue_limit,future_reservation_limit,
        estimated_runtime_seconds,max_wait_seconds,seller_paused)
        VALUES($1,$2,$3,$4,$5,$6,$7,true)
        ON CONFLICT(capability_id) DO UPDATE SET
          schedule_override=$2,concurrency_limit=$3,queue_limit=$4,
          future_reservation_limit=$5,estimated_runtime_seconds=$6,max_wait_seconds=$7,
          seller_paused=true,revision=capability_availability_policies.revision+1,
          updated_at=now()`,[candidate.capabilityId,approval.availability.schedule,
        approval.availability.concurrencyLimit,approval.availability.queueLimit,
        approval.availability.futureReservationLimit,
        approval.availability.estimatedRuntimeSeconds,approval.availability.maxWaitSeconds]);
      await client.query(`INSERT INTO capability_marketplace_metadata(capability_id,category,
        short_description,tags,strengths,limitations)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(capability_id) DO UPDATE SET
          category=$2,short_description=$3,tags=$4,strengths=$5,limitations=$6,updated_at=now()`,
      [candidate.capabilityId,approval.category,approval.shortDescription,approval.tags,
        approval.strengths,approval.limitations]);
      await client.query(`UPDATE capabilities SET current_version_id=$2,name=$3,description=$4,
        status='PUBLISHED',visibility=$5 WHERE id=$1`,[candidate.capabilityId,candidate.id,
        approval.name,approval.description,approval.visibility]);
      if(existing.rows[0]?.current_version_id){
        await client.query(`UPDATE capability_version_lifecycle SET state='RETIRED'
          WHERE version_id=$1 AND state='PUBLISHED'`,[existing.rows[0].current_version_id]);
      }
      await client.query(`UPDATE capability_publication_reviews SET state='PUBLISHED',
        approval_hash=$2,published_at=now() WHERE id=$1`,[approval.reviewId,approvalHash]);
      await client.query('COMMIT');
      return {capabilityId:candidate.capabilityId,capabilityVersionId:candidate.id,
        visibility:approval.visibility};
    }catch(error){await client.query('ROLLBACK');
      if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')
        throw new SellerPublicationError('VERSION_CONFLICT');
      throw error;}
    finally{client.release();}
  }

  /** Switches only the active pointer. Historical version and job snapshots remain immutable. */
  async rollback(sellerAccountId:string,capabilityId:string,targetVersionId:string,
    expectedCurrentVersionId:string,requestId:string):Promise<{capabilityId:string;
      capabilityVersionId:string;previousVersionId:string;paused:true}> {
    const sellerId=id.parse(sellerAccountId), capability=id.parse(capabilityId);
    const target=id.parse(targetVersionId), expected=id.parse(expectedCurrentVersionId);
    const request=id.parse(requestId);
    if(target===expected)throw new SellerPublicationError('CONFLICT');
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const row=await client.query<{current_version_id:string;visibility:string;status:string}>(
        `SELECT c.current_version_id,c.visibility,c.status FROM capabilities c
         JOIN seller_profiles s ON s.id=c.seller_profile_id
         JOIN accounts a ON a.id=s.account_id
         WHERE c.id=$1 AND s.account_id=$2 AND s.status='ACTIVE'
           AND a.status='ACTIVE' AND a.auth_email_verified=true
         FOR UPDATE OF c,s,a`,[capability,sellerId]);
      const current=row.rows[0];
      if(!current)throw new SellerPublicationError('NOT_ELIGIBLE');
      // Lock the capability first. An identical concurrent request then sees
      // the first transaction's audit row after the lock is released.
      const prior=await client.query<{capability_id:string;from_version_id:string;
        to_version_id:string;seller_account_id:string}>(
        `SELECT capability_id,from_version_id,to_version_id,seller_account_id
         FROM capability_version_activations WHERE id=$1 FOR UPDATE`,[request]);
      if(prior.rows[0]){
        const previous=prior.rows[0];
        if(previous.capability_id!==capability||previous.from_version_id!==expected||
          previous.to_version_id!==target||previous.seller_account_id!==sellerId)
          throw new SellerPublicationError('CONFLICT');
        await client.query('COMMIT');
        return {capabilityId:capability,capabilityVersionId:target,
          previousVersionId:expected,paused:true};
      }
      if(current.status!=='PUBLISHED')throw new SellerPublicationError('NOT_ELIGIBLE');
      if(current.current_version_id!==expected)throw new SellerPublicationError('CONFLICT');
      const stripeMode=process.env.KIVRO_STRIPE_MODE;
      if((stripeMode!=='test'&&stripeMode!=='live')||
        (process.env.NODE_ENV==='production'&&stripeMode!=='live'))
        throw new SellerPublicationError('NOT_ELIGIBLE');
      const payout=await client.query<{payout_status:string;onboarding_status:string|null;
        stripe_mode:string|null;stripe_account_id:string|null;transfers_enabled:boolean|null;
        payouts_enabled:boolean|null;payout_fresh:boolean}>(`SELECT s.payout_status,
        connect.onboarding_status,connect.stripe_mode,connect.stripe_account_id,
        connect.transfers_enabled,connect.payouts_enabled,
        COALESCE(connect.last_reconciled_at>now()-interval '24 hours',false) AS payout_fresh
        FROM seller_profiles s LEFT JOIN seller_connect_profiles connect
          ON connect.seller_profile_id=s.id
        WHERE s.account_id=$1 FOR SHARE OF s`,[sellerId]);
      const financial=payout.rows[0];
      if(!financial||financial.payout_status!=='READY'||
        financial.onboarding_status!=='READY'||!financial.stripe_account_id||
        !financial.transfers_enabled||!financial.payouts_enabled||
        !financial.payout_fresh||financial.stripe_mode!==stripeMode)
        throw new SellerPublicationError('NOT_ELIGIBLE');
      const version=await client.query<{version_snapshot:unknown;state:string}>(
        `SELECT v.version_snapshot,l.state FROM capability_versions v
         JOIN capability_version_lifecycle l ON l.version_id=v.id
         WHERE v.id=$1 AND v.capability_id=$2 AND v.publication_state='PUBLISHED'
         FOR UPDATE OF l`,[target,capability]);
      if(version.rows[0]?.state!=='RETIRED')throw new SellerPublicationError('NOT_ELIGIBLE');
      const snapshot=PublishedCapabilityVersionSchema.parse(version.rows[0].version_snapshot);
      if(snapshot.id!==target||snapshot.capabilityId!==capability)
        throw new SellerPublicationError('NOT_ELIGIBLE');
      const ready=await client.query(`SELECT 1 FROM worker_devices d
        JOIN capability_readiness r ON r.worker_device_id=d.id
        JOIN worker_heartbeats h ON h.worker_device_id=d.id
        LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
        LEFT JOIN worker_local_pause_reports p ON p.worker_device_id=d.id
        WHERE d.id=$1 AND d.status='ONLINE' AND d.revoked_at IS NULL
          AND r.capability_id=$2 AND r.capability_version_id=$3
          AND r.state='READY' AND r.sandbox_verified=true
          AND r.required_secrets_ready=true AND r.runtime_healthy=true
          AND r.observed_at>=now()-interval '30 seconds'
          AND h.reported_status='ONLINE' AND h.capacity>0
          AND h.observed_at>=now()-interval '30 seconds'
          AND coalesce(b.blocked,false)=false
          AND coalesce(p.security_paused,false)=false LIMIT 1`,
      [snapshot.workerDeviceId,capability,target]);
      if(!ready.rowCount)throw new SellerPublicationError('ROLLBACK_NOT_READY');
      // The temporary DRAFT visibility is transaction-local. Other sessions
      // only observe the old or new published pointer, never the intermediate state.
      await client.query(`UPDATE capabilities SET visibility='DRAFT',current_version_id=$2
        WHERE id=$1`,[capability,target]);
      await client.query(`UPDATE capability_version_lifecycle SET state='RETIRED'
        WHERE version_id=$1 AND state='PUBLISHED'`,[expected]);
      await client.query(`UPDATE capability_version_lifecycle SET state='PUBLISHED'
        WHERE version_id=$1 AND state='RETIRED'`,[target]);
      const availability=await client.query(`UPDATE capability_availability_policies
        SET seller_paused=true,revision=revision+1,updated_at=now()
        WHERE capability_id=$1`,[capability]);
      if(availability.rowCount!==1)throw new SellerPublicationError('NOT_ELIGIBLE');
      await client.query(`UPDATE capabilities SET visibility=$2 WHERE id=$1`,
      [capability,current.visibility]);
      await client.query(`INSERT INTO capability_version_activations(id,capability_id,
        from_version_id,to_version_id,seller_account_id,action)
        VALUES($1,$2,$3,$4,$5,'ROLLBACK')`,
      [request,capability,expected,target,sellerId]);
      await client.query('COMMIT');
      return {capabilityId:capability,capabilityVersionId:target,
        previousVersionId:expected,paused:true};
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }

  /** Visibility changes affect only new discovery and purchases, never job snapshots. */
  async changeVisibility(sellerAccountId:string,capabilityId:string,
    expected:'DRAFT'|'PRIVATE'|'UNLISTED'|'PUBLIC',
    desired:'PRIVATE'|'UNLISTED'|'PUBLIC',requestId:string):
    Promise<{capabilityId:string;visibility:string}> {
    const sellerId=id.parse(sellerAccountId),capability=id.parse(capabilityId);
    const request=id.parse(requestId);
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const row=await client.query<{visibility:string;current_version_id:string|null}>(
        `SELECT c.visibility,c.current_version_id FROM capabilities c
         JOIN seller_profiles s ON s.id=c.seller_profile_id
         JOIN accounts a ON a.id=s.account_id
         WHERE c.id=$1 AND s.account_id=$2 AND s.status='ACTIVE'
           AND a.status='ACTIVE' AND a.auth_email_verified=true
         FOR UPDATE OF c,s,a`,[capability,sellerId]);
      const current=row.rows[0];
      if(!current)throw new SellerPublicationError('NOT_ELIGIBLE');
      const prior=await client.query<{capability_id:string;seller_account_id:string;
        from_visibility:string;to_visibility:string}>(
        `SELECT capability_id,seller_account_id,from_visibility,to_visibility
         FROM capability_visibility_changes WHERE id=$1`,[request]);
      if(prior.rows[0]){
        const event=prior.rows[0];
        if(event.capability_id!==capability||event.seller_account_id!==sellerId||
          event.from_visibility!==expected||event.to_visibility!==desired)
          throw new SellerPublicationError('CONFLICT');
        await client.query('COMMIT');
        return {capabilityId:capability,visibility:desired};
      }
      if(current.visibility!==expected||expected===desired)
        throw new SellerPublicationError('CONFLICT');
      if(!current.current_version_id)
        throw new SellerPublicationError('NOT_ELIGIBLE');
      const published=await client.query(`SELECT 1 FROM capability_versions v
        JOIN capability_version_lifecycle l ON l.version_id=v.id
        JOIN capability_availability_policies p ON p.capability_id=v.capability_id
        JOIN capability_marketplace_metadata m ON m.capability_id=v.capability_id
        WHERE v.id=$1 AND v.capability_id=$2 AND v.publication_state='PUBLISHED'
          AND l.state='PUBLISHED'`,[current.current_version_id,capability]);
      if(!published.rowCount)throw new SellerPublicationError('NOT_ELIGIBLE');
      if(desired==='PUBLIC'){
        const stripeMode=process.env.KIVRO_STRIPE_MODE;
        if((stripeMode!=='test'&&stripeMode!=='live')||
          (process.env.NODE_ENV==='production'&&stripeMode!=='live'))
          throw new SellerPublicationError('PUBLIC_NOT_READY');
        const eligible=await client.query(`SELECT 1 FROM seller_profiles s
          JOIN seller_connect_profiles connect ON connect.seller_profile_id=s.id
          JOIN capability_versions v ON v.id=$2 AND v.capability_id=$3
          JOIN worker_devices d ON d.id=(v.version_snapshot->>'workerDeviceId')::uuid
          JOIN capability_readiness r ON r.worker_device_id=d.id
            AND r.capability_id=$3 AND r.capability_version_id=$2
          JOIN worker_heartbeats h ON h.worker_device_id=d.id
          LEFT JOIN worker_security_blocks b ON b.worker_device_id=d.id
          LEFT JOIN worker_local_pause_reports p ON p.worker_device_id=d.id
          WHERE s.account_id=$1 AND s.payout_status='READY'
            AND connect.onboarding_status='READY' AND connect.stripe_mode=$4
            AND connect.stripe_account_id IS NOT NULL
            AND connect.transfers_enabled=true AND connect.payouts_enabled=true
            AND connect.last_reconciled_at>now()-interval '24 hours'
            AND d.seller_profile_id=s.id AND d.status='ONLINE' AND d.revoked_at IS NULL
            AND h.reported_status='ONLINE' AND h.capacity>0
            AND h.observed_at>=now()-interval '30 seconds'
            AND r.state='READY' AND r.sandbox_verified=true
            AND r.required_secrets_ready=true AND r.runtime_healthy=true
            AND r.observed_at>=now()-interval '30 seconds'
            AND coalesce(b.blocked,false)=false
            AND coalesce(p.security_paused,false)=false LIMIT 1`,
        [sellerId,current.current_version_id,capability,stripeMode]);
        if(!eligible.rowCount)throw new SellerPublicationError('PUBLIC_NOT_READY');
      }
      if(expected==='PRIVATE')await client.query(`UPDATE capability_private_grants
        SET revoked_at=now() WHERE capability_id=$1 AND revoked_at IS NULL`,[capability]);
      await client.query(`UPDATE capabilities SET visibility=$2 WHERE id=$1`,
        [capability,desired]);
      await client.query(`INSERT INTO capability_visibility_changes(id,capability_id,
        seller_account_id,from_visibility,to_visibility) VALUES($1,$2,$3,$4,$5)`,
      [request,capability,sellerId,expected,desired]);
      await client.query('COMMIT');
      return {capabilityId:capability,visibility:desired};
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }

  async listPrivateGrants(sellerAccountId:string,capabilityId:string):
    Promise<readonly {id:string;buyerAccountId:string;buyerEmail:string}[]> {
    const rows=await this.pool.query<{id:string;buyer_account_id:string;primary_email:string}>(
      `SELECT g.id,g.buyer_account_id,a.primary_email FROM capability_private_grants g
       JOIN capabilities c ON c.id=g.capability_id
       JOIN seller_profiles s ON s.id=c.seller_profile_id
       JOIN accounts a ON a.id=g.buyer_account_id
       WHERE s.account_id=$1 AND c.id=$2 AND c.visibility='PRIVATE'
         AND g.revoked_at IS NULL ORDER BY g.granted_at,g.id`,
      [id.parse(sellerAccountId),id.parse(capabilityId)]);
    return rows.rows.map((row)=>({id:row.id,buyerAccountId:row.buyer_account_id,
      buyerEmail:row.primary_email}));
  }

  async grantPrivateAccess(sellerAccountId:string,capabilityId:string,
    buyerEmail:string,grantId:string):Promise<{id:string;buyerAccountId:string}> {
    const sellerId=id.parse(sellerAccountId),capability=id.parse(capabilityId);
    const request=id.parse(grantId),email=z.email().max(254).parse(buyerEmail).toLowerCase();
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const owner=await client.query(`SELECT 1 FROM capabilities c
        JOIN seller_profiles s ON s.id=c.seller_profile_id
        JOIN accounts a ON a.id=s.account_id
        WHERE c.id=$1 AND c.visibility='PRIVATE' AND c.status='PUBLISHED'
          AND s.account_id=$2 AND s.status='ACTIVE' AND a.status='ACTIVE'
          AND a.auth_email_verified=true FOR UPDATE OF c,s,a`,[capability,sellerId]);
      if(!owner.rowCount)throw new SellerPublicationError('NOT_ELIGIBLE');
      const buyer=await client.query<{id:string}>(`SELECT id FROM accounts
        WHERE lower(primary_email)=$1 AND status='ACTIVE'
          AND auth_email_verified=true AND id<>$2 FOR SHARE`,[email,sellerId]);
      if(!buyer.rows[0])throw new SellerPublicationError('NOT_ELIGIBLE');
      const existing=await client.query<{id:string;buyer_account_id:string;capability_id:string;
        granted_by_account_id:string;revoked_at:Date|null}>(
        `SELECT * FROM capability_private_grants WHERE id=$1`,[request]);
      if(existing.rows[0]){
        const grant=existing.rows[0];
        if(grant.buyer_account_id!==buyer.rows[0].id||grant.capability_id!==capability||
          grant.granted_by_account_id!==sellerId||grant.revoked_at)
          throw new SellerPublicationError('CONFLICT');
        await client.query('COMMIT');
        return {id:request,buyerAccountId:buyer.rows[0].id};
      }
      const duplicate=await client.query(`SELECT 1 FROM capability_private_grants
        WHERE capability_id=$1 AND buyer_account_id=$2 AND revoked_at IS NULL`,
      [capability,buyer.rows[0].id]);
      if(duplicate.rowCount)throw new SellerPublicationError('CONFLICT');
      await client.query(`INSERT INTO capability_private_grants(id,capability_id,
        buyer_account_id,granted_by_account_id) VALUES($1,$2,$3,$4)`,
      [request,capability,buyer.rows[0].id,sellerId]);
      await client.query('COMMIT');
      return {id:request,buyerAccountId:buyer.rows[0].id};
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }

  async revokePrivateAccess(sellerAccountId:string,capabilityId:string,grantId:string):
    Promise<void> {
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const result=await client.query<{id:string}>(`SELECT g.id FROM capability_private_grants g
        JOIN capabilities c ON c.id=g.capability_id
        JOIN seller_profiles s ON s.id=c.seller_profile_id
        WHERE g.id=$1 AND c.id=$2 AND s.account_id=$3
        FOR UPDATE OF c,g`,[id.parse(grantId),id.parse(capabilityId),
        id.parse(sellerAccountId)]);
      if(!result.rows[0])throw new SellerPublicationError('NOT_FOUND');
      await client.query(`UPDATE capability_private_grants SET revoked_at=now()
        WHERE id=$1 AND revoked_at IS NULL`,[grantId]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }

  private async assertPrice(client:PoolClient,raw:unknown):Promise<void>{
    const price=PriceSnapshotSchema.parse(raw);
    const selected=await client.query<{buyer_amount_minor:string;platform_fee_minor:string;
      seller_earning_minor:string;currency:string;enabled:boolean}>(
      `SELECT buyer_amount_minor,platform_fee_minor,seller_earning_minor,currency,enabled
       FROM marketplace_price_tiers WHERE id=$1 FOR SHARE`,[price.tier]);
    const tier=selected.rows[0];
    if(!tier||!tier.enabled||tier.currency!==price.currency||
      Number(tier.buyer_amount_minor)!==price.buyerAmountMinor||
      Number(tier.platform_fee_minor)!==price.platformFeeMinor||
      Number(tier.seller_earning_minor)!==price.sellerEarningMinor)
      throw new SellerPublicationError('PRICE_CHANGED');
  }
}
