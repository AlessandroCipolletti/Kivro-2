import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { MarketplaceCategorySchema } from '../../contracts/src/marketplace.js';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { validateInputPayload, validateOutputPayload } from '../../contracts/src/contract-values.js';

const uuid=z.uuid();
const metadataSchema=z.strictObject({category:MarketplaceCategorySchema,
  shortDescription:z.string().trim().max(320),
  tags:z.array(z.string().trim().min(1).max(48)).max(8),
  strengths:z.array(z.string().trim().min(1).max(160)).max(8),
  limitations:z.array(z.string().trim().min(1).max(160)).max(8)});
const privateText=[/(?:^|[\s"'(])\/(?:Users|home|root|private|etc)\//i,
  /\b[A-Za-z]:\\(?:Users|Documents and Settings)\\/i,/file:\/\//i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,/\b(?:sk_live_|sk_test_|AKIA)[A-Za-z0-9]+\b/];
function assertPublicTextSafe(value:unknown):void{
  if(typeof value==='string'){
    if(privateText.some((pattern)=>pattern.test(value)))
      throw new MarketplaceActionError('NOT_ELIGIBLE');
  }else if(Array.isArray(value))value.forEach(assertPublicTextSafe);
  else if(value&&typeof value==='object')Object.values(value).forEach(assertPublicTextSafe);
}

export class MarketplaceActionError extends Error {
  constructor(readonly code:'NOT_FOUND'|'FORBIDDEN'|'NOT_ELIGIBLE'|'CONFLICT') {
    super(code);this.name='MarketplaceActionError';
  }
}

export class MarketplaceSocialRepository {
  constructor(private readonly pool:Pool){}

  private async tx<T>(action:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    try {await client.query('BEGIN');const value=await action(client);await client.query('COMMIT');return value;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async setFavorite(buyerId:string,capabilityId:string,favorite:boolean):Promise<void>{
    uuid.parse(buyerId);uuid.parse(capabilityId);
    const visible=await this.pool.query(`SELECT 1 FROM capabilities c
      JOIN capability_versions v ON v.id=c.current_version_id AND v.publication_state='PUBLISHED'
      WHERE c.id=$1 AND c.status='PUBLISHED' AND
      (c.visibility IN ('PUBLIC','UNLISTED') OR (c.visibility='PRIVATE' AND EXISTS(
        SELECT 1 FROM capability_private_grants g WHERE g.capability_id=c.id
        AND g.buyer_account_id=$2 AND g.revoked_at IS NULL)))`,[capabilityId,buyerId]);
    if(!visible.rows[0])throw new MarketplaceActionError('NOT_FOUND');
    if(favorite)await this.pool.query(`INSERT INTO buyer_favorites(buyer_account_id,capability_id)
      VALUES($1,$2) ON CONFLICT DO NOTHING`,[buyerId,capabilityId]);
    else await this.pool.query(`DELETE FROM buyer_favorites WHERE buyer_account_id=$1
      AND capability_id=$2`,[buyerId,capabilityId]);
  }

  async favorites(buyerId:string,limit=80,offset=0):Promise<readonly string[]>{
    z.number().int().min(1).max(200).parse(limit);
    z.number().int().nonnegative().max(1_000_000).parse(offset);
    const rows=await this.pool.query<{capability_id:string}>(`SELECT f.capability_id FROM buyer_favorites f
      JOIN capabilities c ON c.id=f.capability_id WHERE f.buyer_account_id=$1
      AND c.status='PUBLISHED' AND (c.visibility IN ('PUBLIC','UNLISTED') OR
        (c.visibility='PRIVATE' AND EXISTS(SELECT 1 FROM capability_private_grants g
          WHERE g.capability_id=c.id AND g.buyer_account_id=$1 AND g.revoked_at IS NULL)))
      ORDER BY f.created_at DESC,f.capability_id LIMIT $2 OFFSET $3`,
    [uuid.parse(buyerId),limit,offset]);
    return rows.rows.map((row)=>row.capability_id);
  }

  async favoritesCount(buyerId:string):Promise<number>{
    const row=await this.pool.query<{count:number}>(`SELECT count(*)::int AS count
      FROM buyer_favorites f JOIN capabilities c ON c.id=f.capability_id
      WHERE f.buyer_account_id=$1 AND c.status='PUBLISHED'
      AND (c.visibility IN ('PUBLIC','UNLISTED') OR
        (c.visibility='PRIVATE' AND EXISTS(SELECT 1 FROM capability_private_grants g
          WHERE g.capability_id=c.id AND g.buyer_account_id=$1 AND g.revoked_at IS NULL)))`,
    [uuid.parse(buyerId)]);
    return row.rows[0]?.count??0;
  }

  async submitReview(input:{id:string;jobId:string;buyerId:string;rating:number;text:string}):Promise<void>{
    uuid.parse(input.id);uuid.parse(input.jobId);uuid.parse(input.buyerId);
    z.number().int().min(1).max(5).parse(input.rating);
    const text=z.string().trim().max(1200).parse(input.text);
    await this.tx(async(client)=>{
      const job=await client.query<{buyer_account_id:string;status:string;capability_version_id:string;
        capability_id:string;seller_profile_id:string;seller_account_id:string;payment_state:string}>(`
        SELECT j.buyer_account_id,j.status,j.capability_version_id,v.capability_id,
        c.seller_profile_id,s.account_id AS seller_account_id,p.state AS payment_state
        FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
        JOIN capabilities c ON c.id=v.capability_id JOIN seller_profiles s ON s.id=c.seller_profile_id
        LEFT JOIN job_payment_states p ON p.job_id=j.id WHERE j.id=$1 FOR UPDATE OF j`,[input.jobId]);
      const row=job.rows[0];
      if(!row||row.buyer_account_id!==input.buyerId)throw new MarketplaceActionError('NOT_FOUND');
      if(row.status!=='COMPLETED'||row.payment_state!=='SETTLED'||
        row.seller_account_id===input.buyerId)throw new MarketplaceActionError('NOT_ELIGIBLE');
      const existing=await client.query<{id:string;rating:number;review_text:string;buyer_account_id:string}>(
        'SELECT id,rating,review_text,buyer_account_id FROM capability_reviews WHERE job_id=$1',
        [input.jobId]);
      if(existing.rows[0]){
        if(existing.rows[0].id===input.id&&existing.rows[0].rating===input.rating&&
          existing.rows[0].review_text===text&&existing.rows[0].buyer_account_id===input.buyerId)return;
        throw new MarketplaceActionError('CONFLICT');
      }
      await client.query(`INSERT INTO capability_reviews(id,job_id,buyer_account_id,capability_id,
        capability_version_id,seller_profile_id,rating,review_text)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.id,input.jobId,input.buyerId,row.capability_id,row.capability_version_id,
        row.seller_profile_id,input.rating,text]);
      await client.query(`INSERT INTO capability_review_revisions(review_id,revision,rating,review_text)
        VALUES($1,1,$2,$3)`,[input.id,input.rating,text]);
    });
  }

  /** Edit is allowed for 30 days; every published revision remains auditable. */
  async editReview(input:{reviewId:string;buyerId:string;expectedRevision:number;
    rating:number;text:string}):Promise<number>{
    uuid.parse(input.reviewId);uuid.parse(input.buyerId);
    z.number().int().min(1).max(5).parse(input.rating);
    const text=z.string().trim().max(1200).parse(input.text);
    return this.tx(async(client)=>{
      const row=await client.query<{buyer_account_id:string;revision:number;created_at:Date}>(
        'SELECT buyer_account_id,revision,created_at FROM capability_reviews WHERE id=$1 FOR UPDATE',
        [input.reviewId]);
      const current=row.rows[0];
      if(!current||current.buyer_account_id!==input.buyerId)throw new MarketplaceActionError('NOT_FOUND');
      if(current.created_at.getTime()+30*86_400_000<Date.now())throw new MarketplaceActionError('NOT_ELIGIBLE');
      if(current.revision!==input.expectedRevision)throw new MarketplaceActionError('CONFLICT');
      const next=current.revision+1;
      await client.query(`UPDATE capability_reviews SET rating=$2,review_text=$3,
        revision=$4,updated_at=now() WHERE id=$1`,[input.reviewId,input.rating,text,next]);
      await client.query(`INSERT INTO capability_review_revisions(review_id,revision,rating,review_text)
        VALUES($1,$2,$3,$4)`,[input.reviewId,next,input.rating,text]);
      return next;
    });
  }

  async setSellerMetadata(capabilityId:string,sellerAccountId:string,raw:unknown):Promise<void>{
    uuid.parse(capabilityId);uuid.parse(sellerAccountId);
    const value=metadataSchema.parse(raw);
    assertPublicTextSafe(value);
    await this.tx(async(client)=>{
      const owner=await client.query<{account_id:string}>(`SELECT s.account_id FROM capabilities c
        JOIN seller_profiles s ON s.id=c.seller_profile_id WHERE c.id=$1 FOR UPDATE OF c`,
      [capabilityId]);
      if(owner.rows[0]?.account_id!==sellerAccountId)throw new MarketplaceActionError('FORBIDDEN');
      await client.query(`INSERT INTO capability_marketplace_metadata(capability_id,category,
        short_description,tags,strengths,limitations)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(capability_id) DO UPDATE SET
        category=$2,short_description=$3,tags=$4,strengths=$5,limitations=$6,updated_at=now()`,
      [capabilityId,value.category,value.shortDescription,value.tags,value.strengths,value.limitations]);
    });
  }

  async publishSellerCuratedExample(input:{id:string;capabilityId:string;sellerAccountId:string;
    title:string;description:string;order:number;inputPayload:unknown;outputPayload:unknown}):Promise<void>{
    uuid.parse(input.id);uuid.parse(input.capabilityId);uuid.parse(input.sellerAccountId);
    const title=z.string().trim().min(1).max(160).parse(input.title);
    const description=z.string().trim().max(1200).parse(input.description);
    assertPublicTextSafe({title,description});
    const order=z.number().int().min(0).max(2).parse(input.order);
    await this.tx(async(client)=>{
      const row=await client.query<{account_id:string;version_id:string;version_snapshot:unknown}>(`
        SELECT s.account_id,v.id AS version_id,v.version_snapshot FROM capabilities c
        JOIN seller_profiles s ON s.id=c.seller_profile_id
        JOIN capability_versions v ON v.id=c.current_version_id
        WHERE c.id=$1 AND c.status='PUBLISHED' AND v.publication_state='PUBLISHED'
        FOR UPDATE OF c`,[input.capabilityId]);
      const owner=row.rows[0];
      if(!owner||owner.account_id!==input.sellerAccountId)throw new MarketplaceActionError('FORBIDDEN');
      const version=PublishedCapabilityVersionSchema.parse(owner.version_snapshot);
      const acceptedInput=validateInputPayload(version.ioContract.input,input.inputPayload);
      const acceptedOutput=validateOutputPayload(version.ioContract.output,input.outputPayload);
      assertPublicTextSafe(acceptedInput.values);
      assertPublicTextSafe(acceptedOutput.values);
      const prior=await client.query<{id:string}>(`SELECT id FROM capability_examples
        WHERE capability_version_id=$1 AND display_order=$2`,[version.id,order]);
      if(prior.rows[0])throw new MarketplaceActionError('CONFLICT');
      const count=await client.query<{n:number}>(`SELECT count(*)::int AS n FROM capability_examples
        WHERE capability_version_id=$1 AND publication_state='PUBLISHED'`,[version.id]);
      if((count.rows[0]?.n??0)>=3)throw new MarketplaceActionError('NOT_ELIGIBLE');
      await client.query(`INSERT INTO capability_examples(id,capability_id,capability_version_id,
        title,description,input_payload,output_payload,source,publication_state,
        seller_approved_at,display_order)
        VALUES($1,$2,$3,$4,$5,$6,$7,'SELLER_CURATED','PUBLISHED',now(),$8)`,
      [input.id,input.capabilityId,version.id,title,description,acceptedInput,acceptedOutput,order]);
      for(const [direction,payload] of [['INPUT',acceptedInput],['OUTPUT',acceptedOutput]] as const){
        for(const [fieldKey,ids] of Object.entries(payload.assets)){
          for(const assetId of ids){
            await client.query(`INSERT INTO capability_example_assets(example_id,asset_id,direction,field_key)
              VALUES($1,$2,$3,$4)`,[input.id,assetId,direction,fieldKey]);
          }
        }
      }
    });
  }

  async publicExampleAsset(assetId:string,buyerId:string|null=null):Promise<
    {objectKey:string;mimeType:string;sizeBytes:number;fieldKey:string}|null>{
    if(buyerId)uuid.parse(buyerId);
    const row=await this.pool.query<{object_key:string;detected_mime_type:string;size_bytes:string;
      field_key:string}>(`
      SELECT a.object_key,a.detected_mime_type,a.size_bytes,ea.field_key FROM assets a
      JOIN capability_example_assets ea ON ea.asset_id=a.id
      JOIN capability_examples e ON e.id=ea.example_id
      JOIN capabilities c ON c.id=e.capability_id
      JOIN capability_versions v ON v.id=c.current_version_id
        AND v.publication_state='PUBLISHED'
      JOIN seller_profiles s ON s.id=c.seller_profile_id AND s.status='ACTIVE'
      WHERE a.id=$1 AND a.state='READY' AND a.retain_until>now()
        AND e.publication_state='PUBLISHED' AND e.capability_version_id=c.current_version_id
        AND (c.visibility IN ('PUBLIC','UNLISTED') OR
          (c.visibility='PRIVATE' AND EXISTS(SELECT 1 FROM capability_private_grants g
            WHERE g.capability_id=c.id AND g.buyer_account_id=$2::uuid
              AND g.revoked_at IS NULL)))
        AND c.status='PUBLISHED'`,[uuid.parse(assetId),buyerId]);
    const found=row.rows[0];return found?{objectKey:found.object_key,
      mimeType:found.detected_mime_type,sizeBytes:Number(found.size_bytes),
      fieldKey:found.field_key}:null;
  }
}
