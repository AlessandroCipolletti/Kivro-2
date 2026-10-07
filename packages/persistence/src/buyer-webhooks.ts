import { createCipheriv,createDecipheriv,randomBytes,randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { DnsResolver } from '../../infrastructure/contracts/src/research-ports.js';
import type { PinnedWebhookPostPort } from '../../infrastructure/contracts/src/ports.js';
import { parseWebhookUrl,vettedWebhookAddress,webhookSignature } from
  '../../application/src/webhook-policy.js';
import { BuyerWebhookEnvelopeSchema } from '../../contracts/src/buyer-api.js';

export const BuyerWebhookEventSchema=z.enum(['job.completed','job.failed',
  'job.cancelled','job.started']);
type EventType=z.infer<typeof BuyerWebhookEventSchema>;
const uuid=z.uuid();
const eventsSchema=z.array(BuyerWebhookEventSchema).min(1).max(4)
  .refine((items)=>new Set(items).size===items.length);
const retrySeconds=[60,300,1800,7200,28_800,86_400] as const;
type EndpointRow={id:string;account_id:string;url:string;events:EventType[];
  status:'ACTIVE'|'DEGRADED'|'DISABLED'|'DELETED';created_at:Date;disabled_at:Date|null;
  last_success_at:Date|null;last_failure_at:Date|null;failure_count:number};
export class BuyerWebhookError extends Error {
  constructor(readonly code:'NOT_FOUND'|'CONFLICT'|'NOT_ELIGIBLE'|'INVALID_DESTINATION'){
    super(code);this.name='BuyerWebhookError';
  }
}
function keyFromHex(raw:string):Buffer{
  if(!/^[a-f0-9]{64}$/i.test(raw))throw new Error('Missing 32-byte KIVRO_WEBHOOK_ENCRYPTION_KEY');
  return Buffer.from(raw,'hex');
}
function project(row:EndpointRow){return {id:row.id,url:row.url,events:row.events,
  status:row.status,createdAt:row.created_at.toISOString(),
  disabledAt:row.disabled_at?.toISOString()??null,
  lastSuccessAt:row.last_success_at?.toISOString()??null,
  lastFailureAt:row.last_failure_at?.toISOString()??null,failureCount:row.failure_count};}

export class BuyerWebhookRepository {
  private readonly key:Buffer;
  constructor(private readonly pool:Pool,private readonly dns:DnsResolver,
    encryptionKeyHex:string,private readonly blockedHosts:readonly string[]=[]){
    this.key=keyFromHex(encryptionKeyHex);
  }
  private encrypt(id:string,secret:string):string{
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);
    cipher.setAAD(Buffer.from(id));
    const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${
      ciphertext.toString('base64url')}`;
  }
  private decrypt(id:string,encrypted:string):string{
    const parts=encrypted.split('.');
    if(parts.length!==4||parts[0]!=='v1')throw new Error('Invalid encrypted webhook secret');
    const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(parts[1]!,'base64url'));
    decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(parts[2]!,'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3]!,'base64url')),
      decipher.final()]).toString('utf8');
  }
  async validateDestination(raw:string):Promise<URL>{
    try{const url=parseWebhookUrl(raw,this.blockedHosts);
      vettedWebhookAddress(url,await this.dns.lookupAll(url.hostname.replace(/^\[|\]$/g,'')));
      return url;
    }catch{throw new BuyerWebhookError('INVALID_DESTINATION');}
  }
  async create(accountId:string,raw:{url:string;events:EventType[]}){
    uuid.parse(accountId);const events=eventsSchema.parse(raw.events);
    const url=await this.validateDestination(raw.url);
    const id=randomUUID(),secret=`whsec_${randomBytes(32).toString('base64url')}`;
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const owner=await client.query<{status:string}>(`SELECT status FROM accounts
        WHERE id=$1 FOR UPDATE`,[accountId]);
      if(owner.rows[0]?.status!=='ACTIVE')throw new BuyerWebhookError('NOT_ELIGIBLE');
      const count=await client.query<{n:number}>(`SELECT count(*)::int AS n
        FROM buyer_webhook_endpoints WHERE account_id=$1 AND status<>'DELETED'`,[accountId]);
      if((count.rows[0]?.n??0)>=10)throw new BuyerWebhookError('CONFLICT');
      const result=await client.query<EndpointRow>(`INSERT INTO buyer_webhook_endpoints(
        id,account_id,url,secret_ciphertext,events) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [id,accountId,url.href,this.encrypt(id,secret),events]);
      await client.query('COMMIT');return {...project(result.rows[0]!),secret};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async list(accountId:string){
    const rows=await this.pool.query<EndpointRow>(`SELECT id,account_id,url,events,status,
      created_at,disabled_at,last_success_at,last_failure_at,failure_count
      FROM buyer_webhook_endpoints WHERE account_id=$1 AND status<>'DELETED'
      ORDER BY created_at DESC LIMIT 30`,
    [uuid.parse(accountId)]);
    return rows.rows.map(project);
  }
  async update(accountId:string,id:string,raw:{url?:string|undefined;
    events?:EventType[]|undefined;enabled?:boolean|undefined}){
    uuid.parse(accountId);uuid.parse(id);
    const url=raw.url===undefined?undefined:(await this.validateDestination(raw.url)).href;
    const events=raw.events===undefined?undefined:eventsSchema.parse(raw.events);
    const result=await this.pool.query<EndpointRow>(`UPDATE buyer_webhook_endpoints
      SET url=coalesce($3,url),events=coalesce($4,events),
      status=CASE WHEN $5::boolean IS NULL THEN status WHEN $5 THEN 'ACTIVE' ELSE 'DISABLED' END,
      disabled_at=CASE WHEN $5::boolean IS NULL THEN disabled_at WHEN $5 THEN NULL ELSE now() END,
      failure_count=CASE WHEN $5 THEN 0 ELSE failure_count END
      WHERE id=$1 AND account_id=$2 AND status<>'DELETED' RETURNING *`,[id,accountId,url??null,events??null,
      raw.enabled??null]);
    if(!result.rows[0])throw new BuyerWebhookError('NOT_FOUND');
    return project(result.rows[0]);
  }
  async remove(accountId:string,id:string){
    uuid.parse(accountId);uuid.parse(id);
    const result=await this.pool.query(`UPDATE buyer_webhook_endpoints
      SET status='DELETED',deleted_at=now(),disabled_at=coalesce(disabled_at,now())
      WHERE id=$1 AND account_id=$2 AND status<>'DELETED'`,[id,accountId]);
    if(result.rowCount!==1)throw new BuyerWebhookError('NOT_FOUND');
  }
  async rotateSecret(accountId:string,id:string){
    uuid.parse(accountId);uuid.parse(id);
    const secret=`whsec_${randomBytes(32).toString('base64url')}`;
    const result=await this.pool.query(`UPDATE buyer_webhook_endpoints
      SET secret_ciphertext=$3 WHERE id=$1 AND account_id=$2 AND status<>'DELETED'`,
    [id,accountId,this.encrypt(id,secret)]);
    if(result.rowCount!==1)throw new BuyerWebhookError('NOT_FOUND');
    return {secret};
  }
  async sendTest(accountId:string,id:string){
    uuid.parse(accountId);uuid.parse(id);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const owner=await client.query<{status:string}>(`SELECT status FROM buyer_webhook_endpoints
        WHERE id=$1 AND account_id=$2 AND status<>'DELETED' FOR UPDATE`,[id,accountId]);
      if(!owner.rows[0])throw new BuyerWebhookError('NOT_FOUND');
      if(owner.rows[0].status==='DISABLED')throw new BuyerWebhookError('NOT_ELIGIBLE');
      const eventId=randomUUID();
      await client.query(`INSERT INTO buyer_webhook_events(id,account_id,type,payload)
        VALUES($1,$2,'test.ping',$3)`,[eventId,accountId,{test:true}]);
      await client.query(`INSERT INTO buyer_webhook_deliveries(endpoint_id,event_id)
        VALUES($1,$2)`,[id,eventId]);
      await client.query('COMMIT');return {eventId:`evt_${eventId}`};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async deliveries(accountId:string,id:string){
    uuid.parse(accountId);uuid.parse(id);
    const owner=await this.pool.query(`SELECT id FROM buyer_webhook_endpoints
      WHERE id=$1 AND account_id=$2 AND status<>'DELETED'`,
      [id,accountId]);if(!owner.rows[0])throw new BuyerWebhookError('NOT_FOUND');
    const rows=await this.pool.query<{id:string;event_id:string;type:string;state:string;
      attempt_count:number;next_attempt_at:Date;last_http_status:number|null;
      last_error_code:string|null;delivered_at:Date|null}>(`SELECT d.id,d.event_id,e.type,d.state,
      d.attempt_count,d.next_attempt_at,d.last_http_status,d.last_error_code,d.delivered_at
      FROM buyer_webhook_deliveries d JOIN buyer_webhook_events e ON e.id=d.event_id
      WHERE d.endpoint_id=$1 ORDER BY e.created_at DESC,d.id DESC LIMIT 30`,[id]);
    return rows.rows.map((row)=>({id:row.id,eventId:`evt_${row.event_id}`,type:row.type,
      state:row.state,attemptCount:row.attempt_count,
      nextAttemptAt:row.next_attempt_at.toISOString(),lastHttpStatus:row.last_http_status,
      lastErrorCode:row.last_error_code,deliveredAt:row.delivered_at?.toISOString()??null}));
  }
  private async claim(){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const row=await client.query<{id:string;endpoint_id:string;event_id:string;
        attempt_count:number;url:string;secret_ciphertext:string;type:string;
        payload:unknown;created_at:Date}>(`SELECT d.id,d.endpoint_id,d.event_id,d.attempt_count,
        ep.url,ep.secret_ciphertext,e.type,e.payload,e.created_at
        FROM buyer_webhook_deliveries d
        JOIN buyer_webhook_endpoints ep ON ep.id=d.endpoint_id
        JOIN buyer_webhook_events e ON e.id=d.event_id
        WHERE d.state='PENDING' AND d.next_attempt_at<=now()
          AND (d.leased_until IS NULL OR d.leased_until<now())
          AND ep.status IN ('ACTIVE','DEGRADED')
        ORDER BY d.next_attempt_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1`);
      const found=row.rows[0];if(!found){await client.query('COMMIT');return null;}
      const token=randomUUID();
      await client.query(`UPDATE buyer_webhook_deliveries SET lease_token=$2,
        leased_until=now()+interval '30 seconds' WHERE id=$1`,
      [found.id,token]);await client.query('COMMIT');
      return {...found,attempt:found.attempt_count+1,token};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async finish(claim:NonNullable<Awaited<ReturnType<BuyerWebhookRepository['claim']>>>,
    status:number|null,errorCode:string|null){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const delivery=await client.query<{id:string}>(`SELECT id FROM buyer_webhook_deliveries
        WHERE id=$1 AND lease_token=$2 FOR UPDATE`,[claim.id,claim.token]);
      if(!delivery.rows[0]){await client.query('COMMIT');return;}
      const success=status!==null&&status>=200&&status<300;
      const exhausted=!success&&claim.attempt>=7;
      const retry=retrySeconds[Math.min(claim.attempt-1,retrySeconds.length-1)]!;
      await client.query(`UPDATE buyer_webhook_deliveries SET state=$2,
        last_http_status=$3,last_error_code=$4,leased_until=NULL,lease_token=NULL,
        attempt_count=$6,
        next_attempt_at=CASE WHEN $2='PENDING' THEN now()+($5::int*interval '1 second')
          ELSE next_attempt_at END,
        delivered_at=CASE WHEN $2='DELIVERED' THEN now() ELSE delivered_at END
        WHERE id=$1`,[claim.id,success?'DELIVERED':exhausted?'EXHAUSTED':'PENDING',
        status,errorCode,retry,claim.attempt]);
      await client.query(`INSERT INTO buyer_webhook_attempts(delivery_id,attempt_number,
        http_status,error_code) VALUES($1,$2,$3,$4)`,
      [claim.id,claim.attempt,status,errorCode]);
      await client.query(`UPDATE buyer_webhook_endpoints SET
        last_success_at=CASE WHEN $2 THEN now() ELSE last_success_at END,
        last_failure_at=CASE WHEN $2 THEN last_failure_at ELSE now() END,
        failure_count=CASE WHEN $2 THEN 0 ELSE failure_count+1 END,
        status=CASE WHEN status IN ('DISABLED','DELETED') THEN status
          WHEN $3 THEN 'DISABLED' WHEN $2 THEN 'ACTIVE' ELSE 'DEGRADED' END,
        disabled_at=CASE WHEN $3 THEN now() ELSE disabled_at END
        WHERE id=$1`,[claim.endpoint_id,success,exhausted]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  /** Cron-safe bounded dispatcher. A crash after send may repeat the same immutable event. */
  async deliverDue(transport:PinnedWebhookPostPort,limit=20):Promise<number>{
    z.number().int().min(1).max(100).parse(limit);let count=0;
    for(let n=0;n<limit;n++){
      const claim=await this.claim();if(!claim)break;
      let status:number|null=null,errorCode:string|null=null;
      try{
        const url=await this.validateDestination(claim.url);
        const address=vettedWebhookAddress(url,await this.dns.lookupAll(url.hostname));
        const body=Buffer.from(JSON.stringify(BuyerWebhookEnvelopeSchema.parse({
          id:`evt_${claim.event_id}`,type:claim.type,
          createdAt:claim.created_at.toISOString(),data:claim.payload})));
        const timestamp=String(Math.floor(Date.now()/1000));
        const secret=this.decrypt(claim.endpoint_id,claim.secret_ciphertext);
        const response=await transport.post({url,pinnedAddress:address,body,
          headers:{'Marketplace-Event-Id':`evt_${claim.event_id}`,
            'Marketplace-Timestamp':timestamp,
            'Marketplace-Signature':webhookSignature(secret,timestamp,body)},
          timeoutMs:10_000,maxResponseBytes:1024});
        status=response.status;
        if(status<200||status>=300)errorCode=status>=300&&status<400?
          'REDIRECT_DENIED':'HTTP_NON_SUCCESS';
      }catch(error){errorCode=error instanceof BuyerWebhookError?'DESTINATION_DENIED':
        error instanceof Error&&error.name==='NetworkPolicyError'?'NETWORK_DENIED':'DELIVERY_FAILED';}
      await this.finish(claim,status,errorCode);count++;
    }
    return count;
  }
}
