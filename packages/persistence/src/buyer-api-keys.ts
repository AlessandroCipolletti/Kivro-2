import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export const BuyerApiScopeSchema=z.enum(['capabilities:read','jobs:create','jobs:read',
  'assets:create','assets:read','webhooks:manage']);
export type BuyerApiScope=z.infer<typeof BuyerApiScopeSchema>;
const scopesSchema=z.array(BuyerApiScopeSchema).min(1).max(6)
  .refine((values)=>new Set(values).size===values.length);
const uuid=z.uuid();
const nameSchema=z.string().trim().min(1).max(80);
const idempotencyKeySchema=z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/);
type KeyRow={id:string;account_id:string;name:string;prefix:string;secret_hash:string;
  scopes:BuyerApiScope[];created_at:Date;last_used_at:Date|null;expires_at:Date|null;
  revoked_at:Date|null};
export class BuyerApiError extends Error {
  constructor(readonly code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|
    'RATE_LIMITED'|'IN_PROGRESS'|'INVALID_INPUT',readonly retryAfterSeconds:number|null=null){
    super(code);this.name='BuyerApiError';
  }
}
function hash(secret:string){return createHash('sha256').update(secret).digest('hex');}
function publicKey(row:KeyRow){return {id:row.id,name:row.name,prefix:row.prefix,scopes:row.scopes,
  createdAt:row.created_at.toISOString(),lastUsedAt:row.last_used_at?.toISOString()??null,
  expiresAt:row.expires_at?.toISOString()??null,revokedAt:row.revoked_at?.toISOString()??null};}
async function activeAccount(client:PoolClient,accountId:string){
  const result=await client.query<{status:string;email_verified_at:Date|null}>(
    'SELECT status,email_verified_at FROM accounts WHERE id=$1 FOR SHARE',[accountId]);
  if(result.rows[0]?.status!=='ACTIVE'||!result.rows[0].email_verified_at)
    throw new BuyerApiError('FORBIDDEN');
}

export class BuyerApiKeyRepository {
  constructor(private readonly pool:Pool,private readonly mode:'test'|'live'){}
  private async audit(client:PoolClient,keyId:string,accountId:string,action:
    'CREATED'|'USED'|'REVOKED'|'ROTATED',endpoint:string|null=null){
    await client.query(`INSERT INTO buyer_api_key_audit(id,key_id,account_id,action,endpoint)
      VALUES($1,$2,$3,$4,$5)`,[randomUUID(),keyId,accountId,action,endpoint]);
  }
  private secret(){
    const prefix=`kv_${this.mode}_${randomBytes(6).toString('hex')}`;
    return {prefix,value:`${prefix}_${randomBytes(32).toString('base64url')}`};
  }
  async create(accountId:string,raw:{name:string;scopes:BuyerApiScope[];
    expiresAt?:string|null|undefined},rotatedFrom:string|null=null){
    uuid.parse(accountId);const name=nameSchema.parse(raw.name),scopes=scopesSchema.parse(raw.scopes);
    const expires=raw.expiresAt?new Date(z.iso.datetime({offset:true}).parse(raw.expiresAt)):null;
    if(expires&&(expires.getTime()<=Date.now()||expires.getTime()>Date.now()+2*365*86_400_000))
      throw new BuyerApiError('INVALID_INPUT');
    const {prefix,value}=this.secret(),id=randomUUID();
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await activeAccount(client,accountId);
      if(rotatedFrom){
        const old=await client.query<{id:string;revoked_at:Date|null}>(`SELECT id,revoked_at
          FROM buyer_api_keys WHERE id=$1 AND account_id=$2 FOR UPDATE`,[uuid.parse(rotatedFrom),accountId]);
        if(!old.rows[0])throw new BuyerApiError('NOT_FOUND');
        if(old.rows[0].revoked_at)throw new BuyerApiError('CONFLICT');
        await client.query('UPDATE buyer_api_keys SET revoked_at=now() WHERE id=$1',[rotatedFrom]);
        await this.audit(client,rotatedFrom,accountId,'ROTATED');
      }
      const created=await client.query<KeyRow>(`INSERT INTO buyer_api_keys(id,account_id,name,prefix,
        secret_hash,scopes,expires_at,rotated_from) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,[id,accountId,name,prefix,hash(value),scopes,expires,rotatedFrom]);
      await this.audit(client,id,accountId,'CREATED');await client.query('COMMIT');
      return {...publicKey(created.rows[0]!),secret:value};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async rotate(accountId:string,keyId:string){
    const old=await this.pool.query<KeyRow>('SELECT * FROM buyer_api_keys WHERE id=$1 AND account_id=$2',
      [uuid.parse(keyId),uuid.parse(accountId)]);
    if(!old.rows[0])throw new BuyerApiError('NOT_FOUND');
    const expiresAt=old.rows[0].expires_at?new Date(Date.now()+
      old.rows[0].expires_at.getTime()-old.rows[0].created_at.getTime()).toISOString():null;
    return this.create(accountId,{name:old.rows[0].name,scopes:old.rows[0].scopes,
      expiresAt},keyId);
  }
  async list(accountId:string){
    const result=await this.pool.query<KeyRow>(`SELECT * FROM buyer_api_keys WHERE account_id=$1
      ORDER BY created_at DESC LIMIT 100`,[uuid.parse(accountId)]);
    return result.rows.map(publicKey);
  }
  async revoke(accountId:string,keyId:string){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await activeAccount(client,uuid.parse(accountId));
      const row=await client.query<KeyRow>(`SELECT * FROM buyer_api_keys WHERE id=$1 AND account_id=$2
        FOR UPDATE`,[uuid.parse(keyId),accountId]);
      if(!row.rows[0])throw new BuyerApiError('NOT_FOUND');
      if(!row.rows[0].revoked_at){
        await client.query('UPDATE buyer_api_keys SET revoked_at=now() WHERE id=$1',[keyId]);
        await this.audit(client,keyId,accountId,'REVOKED');
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async authenticate(token:string,scope:BuyerApiScope,endpoint:string){
    const match=/^(kv_(?:live|test)_[a-f0-9]{12})_([A-Za-z0-9_-]{43})$/.exec(token);
    if(!match||!endpoint||endpoint.length>100)throw new BuyerApiError('UNAUTHENTICATED');
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const result=await client.query<KeyRow>('SELECT * FROM buyer_api_keys WHERE prefix=$1 FOR UPDATE',
        [match[1]]);
      const row=result.rows[0];
      const expected=Buffer.from(row?.secret_hash??'0'.repeat(64),'hex');
      const supplied=Buffer.from(hash(token),'hex');
      if(!timingSafeEqual(expected,supplied)||!row||
        !row.prefix.startsWith(`kv_${this.mode}_`)||row.revoked_at||
        (row.expires_at&&row.expires_at.getTime()<=Date.now()))throw new BuyerApiError('UNAUTHENTICATED');
      await activeAccount(client,row.account_id);
      if(!row.scopes.includes(scope))throw new BuyerApiError('FORBIDDEN');
      await this.rate(client,'KEY',row.id,endpoint,endpoint==='jobs:create'?12:120);
      await this.rate(client,'ACCOUNT',row.account_id,endpoint,endpoint==='jobs:create'?30:300);
      await client.query('UPDATE buyer_api_keys SET last_used_at=now() WHERE id=$1',[row.id]);
      await this.audit(client,row.id,row.account_id,'USED',endpoint);
      await client.query('COMMIT');
      return {keyId:row.id,accountId:row.account_id,scopes:row.scopes};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async rate(client:PoolClient,kind:'KEY'|'ACCOUNT',subjectId:string,endpoint:string,limit:number){
    const row=await client.query<{count:number}>(`INSERT INTO buyer_api_rate_windows(
      subject_kind,subject_id,endpoint,bucket_start,count)
      VALUES($1,$2,$3,date_trunc('minute',now()),1)
      ON CONFLICT(subject_kind,subject_id,endpoint,bucket_start)
      DO UPDATE SET count=buyer_api_rate_windows.count+1 RETURNING count`,
    [kind,subjectId,endpoint]);
    if((row.rows[0]?.count??0)>limit)throw new BuyerApiError('RATE_LIMITED',60);
  }
  async claimJob(input:{accountId:string;keyId:string;endpoint:string;idempotencyKey:string;
    fingerprint:string}){
    uuid.parse(input.accountId);uuid.parse(input.keyId);
    const key=idempotencyKeySchema.parse(input.idempotencyKey);
    if(!/^[a-f0-9]{64}$/.test(input.fingerprint))throw new BuyerApiError('INVALID_INPUT');
    const token=randomUUID(),ids={quoteId:randomUUID(),jobId:randomUUID(),
      reservationId:randomUUID(),manifestId:randomUUID()};
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      await client.query(`INSERT INTO buyer_api_idempotency(account_id,endpoint,idempotency_key,
        key_id,request_fingerprint,quote_id,job_id,reservation_id,manifest_id,
        lease_token,lease_until,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '2 minutes',
          now()+interval '30 days') ON CONFLICT DO NOTHING`,
      [input.accountId,input.endpoint,key,input.keyId,input.fingerprint,
        ids.quoteId,ids.jobId,ids.reservationId,ids.manifestId,token]);
      const row=await client.query<{endpoint:string;key_id:string;request_fingerprint:string;quote_id:string;
        job_id:string;reservation_id:string;manifest_id:string;lease_token:string;
        lease_until:Date;response:unknown|null}>(`SELECT * FROM buyer_api_idempotency
        WHERE account_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [input.accountId,key]);
      const found=row.rows[0];if(!found)throw new BuyerApiError('CONFLICT');
      if(found.endpoint!==input.endpoint||found.request_fingerprint!==input.fingerprint)
        throw new BuyerApiError('CONFLICT');
      if(found.response!==null){await client.query('COMMIT');return {kind:'COMPLETE' as const,
        response:found.response};}
      if(found.lease_token!==token&&found.lease_until.getTime()>Date.now())
        throw new BuyerApiError('IN_PROGRESS',3);
      if(found.lease_token!==token)await client.query(`UPDATE buyer_api_idempotency
        SET lease_token=$4,lease_until=now()+interval '2 minutes'
        WHERE account_id=$1 AND endpoint=$2 AND idempotency_key=$3`,
      [input.accountId,input.endpoint,key,token]);
      await client.query('COMMIT');
      return {kind:'CLAIMED' as const,token,quoteId:found.quote_id,jobId:found.job_id,
        reservationId:found.reservation_id,manifestId:found.manifest_id};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async completeJob(input:{accountId:string;endpoint:string;idempotencyKey:string;
    token:string;response:unknown}){
    const result=await this.pool.query(`UPDATE buyer_api_idempotency SET response=$5,
      completed_at=now(),lease_until=now() WHERE account_id=$1 AND endpoint=$2
      AND idempotency_key=$3 AND lease_token=$4 AND response IS NULL`,
    [uuid.parse(input.accountId),input.endpoint,idempotencyKeySchema.parse(input.idempotencyKey),
      uuid.parse(input.token),input.response]);
    if(result.rowCount!==1)throw new BuyerApiError('IN_PROGRESS',3);
  }
}
