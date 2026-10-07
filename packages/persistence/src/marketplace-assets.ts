import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { Sha256DigestSchema, newPrivateAssetKey } from '../../contracts/src/assets.js';
import { PLATFORM_FILE_LIMITS } from '../../contracts/src/file-limits.js';
import { validateUploadedInputObject } from '../../application/src/input-object-validation.js';
import type { ObjectStoragePort } from '../../infrastructure/contracts/src/ports.js';

const uuid=z.uuid();
export class MarketplaceAssetError extends Error {
  constructor(readonly code:'NOT_FOUND'|'NOT_ELIGIBLE'|'CONFLICT') { super(code);this.name='MarketplaceAssetError'; }
}

/** Same-origin streamed upload; no buyer can overwrite a READY object through an outstanding signed URL. */
export class MarketplaceAssetRepository {
  constructor(private readonly pool:Pool,private readonly storage:ObjectStoragePort){}

  private async field(buyerId:string,capabilityId:string,fieldKey:string){
    const row=await this.pool.query<{version_snapshot:unknown}>(`SELECT v.version_snapshot FROM capabilities c
      JOIN capability_versions v ON v.id=c.current_version_id AND v.publication_state='PUBLISHED'
      WHERE c.id=$1 AND c.status='PUBLISHED' AND
      (c.visibility IN ('PUBLIC','UNLISTED') OR (c.visibility='PRIVATE' AND EXISTS(
        SELECT 1 FROM capability_private_grants g WHERE g.capability_id=c.id
        AND g.buyer_account_id=$2 AND g.revoked_at IS NULL)))`,[uuid.parse(capabilityId),uuid.parse(buyerId)]);
    if(!row.rows[0])throw new MarketplaceAssetError('NOT_FOUND');
    const version=PublishedCapabilityVersionSchema.parse(row.rows[0].version_snapshot);
    const field=version.ioContract.input.fields.find((item)=>item.key===fieldKey);
    if(!field||(field.type!=='FILE'&&field.type!=='FILES'))throw new MarketplaceAssetError('NOT_ELIGIBLE');
    return {field,versionId:version.id};
  }

  async begin(input:{buyerId:string;capabilityId:string;fieldKey:string;sizeBytes:number}){
    const {field}=await this.field(input.buyerId,input.capabilityId,input.fieldKey);
    z.number().int().nonnegative().max(Math.min(field.constraints.maxFileSizeBytes,
      PLATFORM_FILE_LIMITS.maxSingleFileBytes)).parse(input.sizeBytes);
    const id=randomUUID(),objectKey=newPrivateAssetKey(id);
    const retainUntil=new Date(Date.now()+7*86_400_000);
    await this.pool.query(`INSERT INTO assets(id,owner_account_id,kind,state,object_key,retain_until)
      VALUES($1,$2,'BUYER_INPUT','PENDING_UPLOAD',$3,$4)`,[id,input.buyerId,objectKey,retainUntil]);
    return {id,uploadPath:`/api/marketplace/upload/${id}`,retainUntil:retainUntil.toISOString()};
  }

  /** Browser bytes go directly to an isolated staging object. The final job
   * key remains unknown to the signed URL and is promoted only after scanning. */
  async beginDirect(input:{buyerId:string;capabilityId:string;fieldKey:string;
    fileName:string;sizeBytes:number;sha256:string;contentType:string}){
    const {field,versionId}=await this.field(input.buyerId,input.capabilityId,input.fieldKey);
    z.number().int().nonnegative().max(Math.min(field.constraints.maxFileSizeBytes,
      PLATFORM_FILE_LIMITS.maxSingleFileBytes)).parse(input.sizeBytes);
    const sha256=Sha256DigestSchema.parse(input.sha256) as `sha256:${string}`;
    const fileName=z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .parse(input.fileName);
    const contentType=z.string().min(3).max(120).parse(input.contentType);
    const id=randomUUID(),finalKey=newPrivateAssetKey(id),stagingKey=newPrivateAssetKey(id);
    const retainUntil=new Date(Date.now()+7*86_400_000);
    const signedUntil=new Date(Date.now()+10*60_000);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      await client.query(`INSERT INTO assets(id,owner_account_id,kind,state,object_key,retain_until)
        VALUES($1,$2,'BUYER_INPUT','PENDING_UPLOAD',$3,$4)`,
      [id,input.buyerId,finalKey,retainUntil]);
      await client.query(`INSERT INTO buyer_direct_uploads(asset_id,capability_id,
        capability_version_id,field_key,staging_key,file_name,declared_size_bytes,
        declared_sha256,declared_content_type,signed_until)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id,input.capabilityId,versionId,input.fieldKey,stagingKey,fileName,
        input.sizeBytes,sha256,contentType,signedUntil]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const signed=await this.storage.presignPrivateUpload(stagingKey,
      {contentType,sizeBytes:input.sizeBytes,sha256,expiresSeconds:600});
    return {id,url:signed.url,headers:signed.headers,retainUntil:retainUntil.toISOString(),
      signedUntil:signedUntil.toISOString()};
  }

  async finalizeDirect(input:{buyerId:string;assetId:string;capabilityId:string;
    fieldKey:string}):Promise<{id:string;mimeType:string;sizeBytes:number}>{
    const {field,versionId}=await this.field(input.buyerId,input.capabilityId,input.fieldKey);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const row=await client.query<{owner_account_id:string;kind:string;state:string;
        object_key:string;retain_until:Date;detected_mime_type:string|null;
        size_bytes:string|null;session_version_id:string;session_capability_id:string;
        field_key:string;staging_key:string;file_name:string;declared_size_bytes:string;
        declared_sha256:string;declared_content_type:string;signed_until:Date}>(`
        SELECT a.owner_account_id,a.kind,a.state,a.object_key,a.retain_until,
          a.detected_mime_type,a.size_bytes,u.capability_version_id AS session_version_id,
          u.capability_id AS session_capability_id,u.field_key,u.staging_key,u.file_name,
          u.declared_size_bytes,u.declared_sha256,u.declared_content_type,u.signed_until
        FROM assets a JOIN buyer_direct_uploads u ON u.asset_id=a.id
        WHERE a.id=$1 FOR UPDATE OF a,u`,[uuid.parse(input.assetId)]);
      const asset=row.rows[0];
      if(!asset||asset.owner_account_id!==uuid.parse(input.buyerId)||
        asset.kind!=='BUYER_INPUT'||asset.session_capability_id!==input.capabilityId||
        asset.session_version_id!==versionId||asset.field_key!==input.fieldKey||
        asset.retain_until.getTime()<=Date.now())throw new MarketplaceAssetError('NOT_FOUND');
      if(asset.state==='READY'){
        await client.query('COMMIT');
        return {id:input.assetId,mimeType:asset.detected_mime_type!,
          sizeBytes:Number(asset.size_bytes)};
      }
      if(asset.state!=='PENDING_UPLOAD'||
        asset.signed_until.getTime()+15*60_000<Date.now())
        throw new MarketplaceAssetError('NOT_ELIGIBLE');
      await validateUploadedInputObject(this.storage,{objectKey:asset.staging_key,
        fileName:asset.file_name,expectedSizeBytes:Number(asset.declared_size_bytes),
        expectedSha256:asset.declared_sha256,
        maxPlatformFileBytes:PLATFORM_FILE_LIMITS.maxSingleFileBytes,field});
      await this.storage.copyPrivateObject(asset.staging_key,asset.object_key);
      const verified=await validateUploadedInputObject(this.storage,{objectKey:asset.object_key,
        fileName:asset.file_name,expectedSizeBytes:Number(asset.declared_size_bytes),
        expectedSha256:asset.declared_sha256,
        maxPlatformFileBytes:PLATFORM_FILE_LIMITS.maxSingleFileBytes,field});
      await client.query(`UPDATE assets SET state='READY',size_bytes=$2,sha256=$3,
        detected_mime_type=$4,finalized_at=now() WHERE id=$1`,
      [input.assetId,verified.sizeBytes,verified.sha256,verified.detectedMimeType]);
      await client.query('UPDATE buyer_direct_uploads SET finalized_at=now() WHERE asset_id=$1',
        [input.assetId]);
      await client.query('COMMIT');
      await this.storage.deletePrivateObject(asset.staging_key).catch(()=>{});
      return {id:input.assetId,mimeType:verified.detectedMimeType,sizeBytes:verified.sizeBytes};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async upload(input:{buyerId:string;capabilityId:string;assetId:string;fieldKey:string;
    fileName:string;sizeBytes:number;sha256:string;contentType:string;
    body:AsyncIterable<Uint8Array>}){
    const {field}=await this.field(input.buyerId,input.capabilityId,input.fieldKey);
    const size=z.number().int().nonnegative().max(Math.min(field.constraints.maxFileSizeBytes,
      PLATFORM_FILE_LIMITS.maxSingleFileBytes)).parse(input.sizeBytes);
    const sha256=Sha256DigestSchema.parse(input.sha256) as `sha256:${string}`;
    const fileName=z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).parse(input.fileName);
    const contentType=z.string().min(3).max(120).parse(input.contentType);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const row=await client.query<{owner_account_id:string;kind:string;state:string;object_key:string;
        size_bytes:string|null;sha256:string|null;detected_mime_type:string|null;retain_until:Date}>(
        `SELECT owner_account_id,kind,state,object_key,size_bytes,sha256,
        detected_mime_type,retain_until FROM assets WHERE id=$1 FOR UPDATE`,[uuid.parse(input.assetId)]);
      const asset=row.rows[0];
      if(!asset||asset.owner_account_id!==uuid.parse(input.buyerId)||asset.kind!=='BUYER_INPUT'||
        asset.retain_until.getTime()<=Date.now())throw new MarketplaceAssetError('NOT_FOUND');
      if(asset.state==='READY'){
        if(Number(asset.size_bytes)!==size||asset.sha256!==sha256)
          throw new MarketplaceAssetError('CONFLICT');
        await client.query('COMMIT');
        return {id:input.assetId,mimeType:asset.detected_mime_type,sizeBytes:size};
      }
      if(asset.state!=='PENDING_UPLOAD')throw new MarketplaceAssetError('NOT_ELIGIBLE');
      let received=0;
      const bounded=async function*(){for await(const bytes of input.body){
        received+=bytes.byteLength;if(received>size)throw new MarketplaceAssetError('CONFLICT');
        yield bytes;}};
      await this.storage.putPrivateObject(asset.object_key,bounded(),{
        contentType,sizeBytes:size,sha256});
      if(received!==size)throw new MarketplaceAssetError('CONFLICT');
      const verified=await validateUploadedInputObject(this.storage,{objectKey:asset.object_key,
        fileName,expectedSizeBytes:size,expectedSha256:sha256,
        maxPlatformFileBytes:PLATFORM_FILE_LIMITS.maxSingleFileBytes,field});
      await client.query(`UPDATE assets SET state='READY',size_bytes=$2,sha256=$3,
        detected_mime_type=$4,finalized_at=now() WHERE id=$1`,
      [input.assetId,verified.sizeBytes,verified.sha256,verified.detectedMimeType]);
      await client.query('COMMIT');
      return {id:input.assetId,mimeType:verified.detectedMimeType,sizeBytes:verified.sizeBytes};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
