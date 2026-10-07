import type { Pool } from 'pg';
import { z } from 'zod';
import { PublishedCapabilityVersionSchema, JobContractSnapshotSchema } from
  '../../contracts/src/capability-version.js';
import { createJobContractSnapshot } from '../../domain/src/capability-version.js';
import { validateInputPayload } from '../../contracts/src/contract-values.js';
import type { PostgresAvailabilityRepository } from './availability.js';
import type { PostgresFinanceRepository } from './finance.js';
import type { PostgresJobExecutionRepository } from './job-execution.js';

const uuid=z.uuid();
export class BuyerMarketplaceError extends Error {
  constructor(readonly code:'NOT_FOUND'|'NOT_ELIGIBLE'|'CONFLICT'|'INVALID_INPUT'){
    super(code);this.name='BuyerMarketplaceError';
  }
}

export interface BuyerJobSummary {
  readonly id:string;readonly status:string;readonly capabilityId:string;readonly capabilitySlug:string;
  readonly capabilityName:string;readonly sellerName:string;readonly versionId:string;
  readonly versionNumber:number;readonly createdAt:string;readonly startedAt:string|null;
  readonly completedAt:string|null;readonly priceMinor:number;readonly currency:'USD';
  readonly financialState:string|null;readonly nextEligibleAt:string|null;
  readonly latestStartAt:string|null;readonly reviewed:boolean;
}

export class MarketplaceBuyerRepository {
  constructor(private readonly pool:Pool,private readonly availability:PostgresAvailabilityRepository,
    private readonly finance:PostgresFinanceRepository,
    private readonly execution:PostgresJobExecutionRepository){}

  async termsStatus(buyerId:string):Promise<boolean>{
    const row=await this.pool.query<{accepted:boolean}>(`SELECT EXISTS(
      SELECT 1 FROM marketplace_terms_acceptances WHERE account_id=$1 AND version=1
    ) AS accepted`,[uuid.parse(buyerId)]);
    return row.rows[0]?.accepted??false;
  }

  async acceptTerms(buyerId:string,acceptanceId:string):Promise<void>{
    uuid.parse(buyerId);uuid.parse(acceptanceId);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const account=await client.query<{status:string;email_verified_at:Date|null}>(
        'SELECT status,email_verified_at FROM accounts WHERE id=$1 FOR UPDATE',[buyerId]);
      if(account.rows[0]?.status!=='ACTIVE'||!account.rows[0].email_verified_at)
        throw new BuyerMarketplaceError('NOT_ELIGIBLE');
      await client.query(`INSERT INTO marketplace_terms_acceptances(id,account_id,version)
        VALUES($1,$2,1) ON CONFLICT(account_id,version) DO NOTHING`,[acceptanceId,buyerId]);
      await client.query('UPDATE accounts SET terms_accepted_at=coalesce(terms_accepted_at,now()) WHERE id=$1',
        [buyerId]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  private async account(buyerId:string):Promise<void>{
    const result=await this.pool.query<{status:string;email_verified_at:Date|null;
      accepted:boolean}>(`SELECT status,email_verified_at,EXISTS(
        SELECT 1 FROM marketplace_terms_acceptances t WHERE t.account_id=a.id AND t.version=1
      ) AS accepted FROM accounts a WHERE id=$1`,[uuid.parse(buyerId)]);
    const row=result.rows[0];
    if(!row||row.status!=='ACTIVE'||!row.email_verified_at||!row.accepted){
      throw new BuyerMarketplaceError('NOT_ELIGIBLE');
    }
  }

  async preflight(input:{buyerId:string;capabilityId:string;
    mode:'IMMEDIATE_ONLY'|'EARLIEST_AVAILABLE';quoteId:string;
    latestAcceptableStartAt?:string;payload:unknown;expectedVersionId:string}){
    await this.account(input.buyerId);
    const quote=await this.availability.quote({id:input.quoteId,buyerAccountId:input.buyerId,
      capabilityId:input.capabilityId,executionMode:input.mode,
      ...(input.latestAcceptableStartAt?{latestAcceptableStartAt:input.latestAcceptableStartAt}:{})});
    if(quote.capabilityVersionId!==uuid.parse(input.expectedVersionId))
      throw new BuyerMarketplaceError('CONFLICT');
    const versionRow=await this.pool.query<{version_snapshot:unknown}>(
      'SELECT version_snapshot FROM capability_versions WHERE id=$1',[quote.capabilityVersionId]);
    const version=PublishedCapabilityVersionSchema.parse(versionRow.rows[0]?.version_snapshot);
    const payload=validateInputPayload(version.ioContract.input,input.payload);
    for(const assetId of Object.values(payload.assets).flat()){
      const asset=await this.pool.query<{id:string}>(`SELECT id FROM assets WHERE id=$1
        AND owner_account_id=$2 AND state='READY' AND retain_until>now()`,
      [assetId,input.buyerId]);
      if(!asset.rows[0])throw new BuyerMarketplaceError('INVALID_INPUT');
    }
    const balance=await this.finance.buyerBalance(input.buyerId);
    return {quote,balance,canAfford:balance.availableMinor>=quote.price.buyerAmountMinor};
  }

  /** Server session supplies buyerId. M07 snapshot is immutable; M09 booking revalidates exact quote and atomically reserves M08 credits. */
  async purchase(input:{buyerId:string;quoteId:string;jobId:string;reservationId:string;
    manifestId:string;payload:unknown}):Promise<{jobId:string;status:string}>{
    for(const key of ['buyerId','quoteId','jobId','reservationId','manifestId'] as const)uuid.parse(input[key]);
    await this.account(input.buyerId);
    const quote=await this.pool.query<{buyer_account_id:string;capability_version_id:string;
      accepted_job_id:string|null}>(`SELECT buyer_account_id,capability_version_id,accepted_job_id
      FROM job_schedule_quotes WHERE id=$1`,[input.quoteId]);
    const q=quote.rows[0];
    if(!q||q.buyer_account_id!==input.buyerId)throw new BuyerMarketplaceError('NOT_FOUND');
    if(q.accepted_job_id&&q.accepted_job_id!==input.jobId)throw new BuyerMarketplaceError('CONFLICT');
    const found=await this.pool.query<{version_snapshot:unknown}>(`SELECT v.version_snapshot
      FROM capability_versions v WHERE v.id=$1 AND v.publication_state='PUBLISHED'`,
    [q.capability_version_id]);
    const version=PublishedCapabilityVersionSchema.parse(found.rows[0]?.version_snapshot);
    validateInputPayload(version.ioContract.input,input.payload);
    const existing=await this.pool.query<{buyer_account_id:string;contract_snapshot:unknown}>(
      'SELECT buyer_account_id,contract_snapshot FROM jobs WHERE id=$1',[input.jobId]);
    if(!existing.rows[0]){
      const snapshot=createJobContractSnapshot(version,input.jobId,input.buyerId,new Date().toISOString());
      await this.execution.createJob(snapshot);
    }else{
      const snapshot=JobContractSnapshotSchema.parse(existing.rows[0].contract_snapshot);
      if(existing.rows[0].buyer_account_id!==input.buyerId||
        snapshot.capabilityVersionId!==q.capability_version_id)throw new BuyerMarketplaceError('CONFLICT');
    }
    await this.execution.finalizeInputManifest(input.jobId,input.manifestId,input.payload);
    const timing=await this.availability.book({quoteId:input.quoteId,jobId:input.jobId,
      buyerAccountId:input.buyerId,reservationId:input.reservationId});
    const view=await this.execution.load(input.jobId);
    return {jobId:timing.jobId,status:view.status};
  }

  async cancel(buyerId:string,jobId:string,requestId:string):Promise<void>{
    await this.availability.cancel(uuid.parse(jobId),uuid.parse(buyerId),uuid.parse(requestId));
  }

  async history(buyerId:string,limit=80,jobId:string|null=null,offset=0):Promise<readonly BuyerJobSummary[]>{
    uuid.parse(buyerId);z.number().int().min(1).max(200).parse(limit);
    if(jobId)uuid.parse(jobId);
    z.number().int().nonnegative().max(1_000_000).parse(offset);
    const rows=await this.pool.query<{id:string;status:string;capability_id:string;slug:string;
      name:string;seller_name:string;capability_version_id:string;version_number:number;
      created_at:Date;started_at:Date|null;completed_at:Date|null;
      buyer_total_minor:string;financial_state:string|null;next_eligible_at:Date|null;
      latest_start_at:Date|null;reviewed:boolean}>(`SELECT j.id,j.status,c.id AS capability_id,c.slug,c.name,
      s.display_name AS seller_name,j.capability_version_id,v.version_number,
      j.created_at,j.started_at,j.completed_at,f.buyer_total_minor,p.state AS financial_state,
      plan.next_eligible_at,plan.latest_start_at,
      EXISTS(SELECT 1 FROM capability_reviews r WHERE r.job_id=j.id) AS reviewed
      FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
      JOIN capabilities c ON c.id=v.capability_id JOIN seller_profiles s ON s.id=c.seller_profile_id
      JOIN job_financial_snapshots f ON f.job_id=j.id
      LEFT JOIN job_payment_states p ON p.job_id=j.id
      LEFT JOIN job_schedule_plans plan ON plan.job_id=j.id
      WHERE j.buyer_account_id=$1 AND j.status<>'CREATED'
        AND ($3::uuid IS NULL OR j.id=$3)
      ORDER BY j.created_at DESC,j.id DESC LIMIT $2 OFFSET $4`,[buyerId,limit,jobId,offset]);
    return rows.rows.map((row)=>({id:row.id,status:row.status,capabilityId:row.capability_id,
      capabilitySlug:row.slug,capabilityName:row.name,sellerName:row.seller_name,
      versionId:row.capability_version_id,versionNumber:row.version_number,
      createdAt:row.created_at.toISOString(),startedAt:row.started_at?.toISOString()??null,
      completedAt:row.completed_at?.toISOString()??null,priceMinor:Number(row.buyer_total_minor),
      currency:'USD',financialState:row.financial_state,
      nextEligibleAt:row.next_eligible_at?.toISOString()??null,
      latestStartAt:row.latest_start_at?.toISOString()??null,reviewed:row.reviewed}));
  }

  async historyCount(buyerId:string):Promise<number>{
    const row=await this.pool.query<{count:number}>(`SELECT count(*)::int AS count FROM jobs
      WHERE buyer_account_id=$1 AND status<>'CREATED'`,[uuid.parse(buyerId)]);
    return row.rows[0]?.count??0;
  }

  async recentlyUsed(buyerId:string):Promise<readonly string[]>{
    const rows=await this.pool.query<{capability_id:string}>(`SELECT v.capability_id
      FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
      WHERE j.buyer_account_id=$1 AND j.status<>'CREATED'
      GROUP BY v.capability_id ORDER BY max(j.created_at) DESC,v.capability_id LIMIT 20`,
    [uuid.parse(buyerId)]);
    return rows.rows.map((row)=>row.capability_id);
  }

  async creditPurchases(buyerId:string):Promise<readonly {id:string;amountMinor:number;
    state:string;createdAt:string}[]>{
    const rows=await this.pool.query<{id:string;amount_minor:string;state:string;created_at:Date}>(
      `SELECT id,amount_minor,state,created_at FROM credit_purchases
      WHERE buyer_account_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30`,
    [uuid.parse(buyerId)]);
    return rows.rows.map((row)=>({id:row.id,amountMinor:Number(row.amount_minor),
      state:row.state,createdAt:row.created_at.toISOString()}));
  }

  async job(buyerId:string,jobId:string):Promise<{
    summary:BuyerJobSummary;input:{values:Record<string,unknown>;assets:Record<string,string[]>}|null;
    result:{values:Record<string,unknown>;assets:Record<string,string[]>}|null;
    outputFiles:readonly {id:string;fieldKey:string;mimeType:string;sizeBytes:number;
      retainUntil:string}[];inputContract:unknown;outputContract:unknown;permissionManifest:unknown;
    inputRetainUntil:string|null;resultRetainUntil:string|null;
    events:readonly {status:string;at:string}[];
    problemReports:readonly {category:string;createdAt:string}[];
  }>{
    const id=uuid.parse(jobId);uuid.parse(buyerId);
    const summary=(await this.history(buyerId,1,id))[0];
    if(!summary)throw new BuyerMarketplaceError('NOT_FOUND');
    const rows=await this.pool.query<{contract_snapshot:unknown;input_payload:unknown|null;
      result_payload:unknown|null}>(`SELECT j.contract_snapshot,i.payload AS input_payload,
      CASE WHEN j.status='COMPLETED' THEN r.payload ELSE NULL END AS result_payload
      FROM jobs j LEFT JOIN job_input_manifests i ON i.job_id=j.id
      LEFT JOIN job_result_manifests r ON r.job_id=j.id
      WHERE j.id=$1 AND j.buyer_account_id=$2`,[id,buyerId]);
    const row=rows.rows[0];if(!row)throw new BuyerMarketplaceError('NOT_FOUND');
    const snapshot=JobContractSnapshotSchema.parse(row.contract_snapshot);
    const payload=z.strictObject({values:z.record(z.string(),z.unknown()),
      assets:z.record(z.string(),z.array(z.uuid()))});
    const files=await this.pool.query<{id:string;field_key:string;detected_mime_type:string;
      size_bytes:string;retain_until:Date}>(`SELECT a.id,ra.field_key,a.detected_mime_type,
      a.size_bytes,a.retain_until FROM job_result_assets ra
      JOIN job_result_manifests m ON m.id=ra.manifest_id
      JOIN assets a ON a.id=ra.asset_id
      WHERE m.job_id=$1 AND m.job_id IN(SELECT id FROM jobs WHERE buyer_account_id=$2)
        AND a.state='READY' AND a.retain_until>now() ORDER BY ra.field_key,a.id`,[id,buyerId]);
    const [events,reports,inputRetention]=await Promise.all([
      this.pool.query<{to_status:string;at:Date}>(`SELECT to_status,at FROM job_transitions
        WHERE job_id=$1 ORDER BY sequence`,[id]),
      this.pool.query<{category:string;created_at:Date}>(`SELECT category,created_at
        FROM buyer_job_problem_reports WHERE job_id=$1 AND buyer_account_id=$2
        ORDER BY created_at DESC`,[id,buyerId]),
      this.pool.query<{retain_until:Date|null}>(`SELECT min(a.retain_until) AS retain_until
        FROM asset_read_grants g JOIN assets a ON a.id=g.asset_id
        JOIN jobs j ON j.id=g.target_job_id
        WHERE g.target_job_id=$1 AND j.buyer_account_id=$2`,[id,buyerId]),
    ]);
    return {summary,input:row.input_payload?payload.parse(row.input_payload):null,
      result:row.result_payload?payload.parse(row.result_payload):null,
      outputFiles:files.rows.map((file)=>({id:file.id,fieldKey:file.field_key,
        mimeType:file.detected_mime_type,sizeBytes:Number(file.size_bytes),
        retainUntil:file.retain_until.toISOString()})),
      inputContract:snapshot.inputContractSnapshot,outputContract:snapshot.outputContractSnapshot,
      permissionManifest:snapshot.permissionManifestSnapshot,
      inputRetainUntil:inputRetention.rows[0]?.retain_until?.toISOString()??null,
      resultRetainUntil:files.rows.length?
        new Date(Math.min(...files.rows.map((file)=>file.retain_until.getTime()))).toISOString():null,
      events:events.rows.map((event)=>({status:event.to_status,at:event.at.toISOString()})),
      problemReports:reports.rows.map((report)=>({category:report.category,
        createdAt:report.created_at.toISOString()}))};
  }

  async reportProblem(input:{id:string;buyerId:string;jobId:string;
    category:'MISSING_OUTPUT'|'CORRUPT_FILE'|'QUALITY'|'OTHER';description:string}):Promise<void>{
    uuid.parse(input.id);uuid.parse(input.buyerId);uuid.parse(input.jobId);
    const description=z.string().trim().min(10).max(2000).parse(input.description);
    const category=z.enum(['MISSING_OUTPUT','CORRUPT_FILE','QUALITY','OTHER']).parse(input.category);
    const row=await this.pool.query<{buyer_account_id:string;status:string}>(
      'SELECT buyer_account_id,status FROM jobs WHERE id=$1',[input.jobId]);
    if(row.rows[0]?.buyer_account_id!==input.buyerId)throw new BuyerMarketplaceError('NOT_FOUND');
    if(!['COMPLETED','RESULT_REJECTED','FAILED_EXECUTION','FAILED_POLICY','TIMED_OUT']
      .includes(row.rows[0].status))throw new BuyerMarketplaceError('NOT_ELIGIBLE');
    await this.pool.query(`INSERT INTO buyer_job_problem_reports(id,job_id,buyer_account_id,
      category,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_id,buyer_account_id,category)
      DO NOTHING`,[input.id,input.jobId,input.buyerId,category,description]);
  }

  async ownedOutputAsset(buyerId:string,assetId:string):Promise<{
    objectKey:string;mimeType:string;sizeBytes:number;retainUntil:Date}|null>{
    const row=await this.pool.query<{object_key:string;detected_mime_type:string;
      size_bytes:string;retain_until:Date}>(`SELECT a.object_key,a.detected_mime_type,
      a.size_bytes,a.retain_until FROM assets a
      JOIN job_result_assets ra ON ra.asset_id=a.id
      JOIN job_result_manifests m ON m.id=ra.manifest_id
      JOIN jobs j ON j.id=m.job_id
      WHERE a.id=$1 AND j.buyer_account_id=$2 AND j.status='COMPLETED'
        AND a.owner_account_id=$2 AND a.state='READY' AND a.retain_until>now()`,
    [uuid.parse(assetId),uuid.parse(buyerId)]);
    const found=row.rows[0];return found?{objectKey:found.object_key,
      mimeType:found.detected_mime_type,sizeBytes:Number(found.size_bytes),
      retainUntil:found.retain_until}:null;
  }
}
