import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { PostgresSellerPublicationRepository, SellerPublicationError } from
  '../../../../packages/persistence/src/seller-publication.js';

const rollbackRequest=z.strictObject({capabilityId:z.uuid(),targetVersionId:z.uuid(),
  expectedCurrentVersionId:z.uuid(),requestId:z.uuid()});
const visibilityRequest=z.strictObject({capabilityId:z.uuid(),
  expected:z.enum(['DRAFT','PRIVATE','UNLISTED','PUBLIC']),
  desired:z.enum(['PRIVATE','UNLISTED','PUBLIC']),requestId:z.uuid()});
const grantRequest=z.strictObject({capabilityId:z.uuid(),
  buyerEmail:z.email().max(254),grantId:z.uuid()});
const revokeGrantRequest=z.strictObject({capabilityId:z.uuid(),grantId:z.uuid()});

function json(value:unknown,status=200):Response {
  return Response.json(value,{status,headers:{'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'}});
}

async function boundedJson(request:Request):Promise<unknown> {
  if(request.headers.get('content-type')?.split(';',1)[0]?.trim()!=='application/json')
    throw new TypeError('INVALID_CONTENT_TYPE');
  const reader=request.body?.getReader();
  if(!reader)throw new TypeError('EMPTY_BODY');
  let bytes=0;const chunks:Uint8Array[]=[];
  try{for(;;){const next=await reader.read();if(next.done)break;
    bytes+=next.value.byteLength;
    if(bytes>32_768){void reader.cancel().catch(()=>undefined);throw new TypeError('BODY_TOO_LARGE');}
    chunks.push(next.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

/** Browser requests never stage Worker test evidence or choose their own seller identity. */
export async function handleSellerPublicationRequest(request:Request,action:string,
  auth:AuthService):Promise<Response> {
  if(['reviews','versions'].includes(action)&&request.method!=='GET'||
    action==='grants'&&!['GET','POST'].includes(request.method)||
    ['publish','rollback','visibility','revoke-grant'].includes(action)&&request.method!=='POST')
    return json({code:'METHOD_NOT_ALLOWED'},405);
  if(!['reviews','versions','publish','rollback','visibility','grants',
    'revoke-grant'].includes(action))return json({code:'NOT_FOUND'},404);
  if(request.method==='POST'){
    const origin=process.env.APP_ORIGIN;
    if(!origin||request.headers.get('origin')!==new URL(origin).origin)
      return json({code:'ORIGIN_DENIED'},403);
  }
  const session=await auth.auth.api.getSession({headers:request.headers});
  if(!session)return json({code:'UNAUTHENTICATED'},401);
  const sellerId=session.user.id;
  try{
    const verified=await auth.database.query<{ok:boolean}>(`SELECT
      (status='ACTIVE' AND auth_email_verified) AS ok FROM accounts WHERE id=$1`,[sellerId]);
    if(!verified.rows[0]?.ok)return json({code:'ACCOUNT_NOT_VERIFIED'},403);
    const repository=new PostgresSellerPublicationRepository(auth.database);
    if(action==='reviews')return json({reviews:await repository.listForSeller(sellerId)});
    if(action==='versions')return json({capabilities:await repository.listVersionHistoryForSeller(sellerId)});
    if(action==='grants'&&request.method==='GET'){
      const capabilityId=z.uuid().parse(new URL(request.url).searchParams.get('capabilityId'));
      return json({grants:await repository.listPrivateGrants(sellerId,capabilityId)});
    }
    if(action==='rollback'){
      const input=rollbackRequest.parse(await boundedJson(request));
      return json(await repository.rollback(sellerId,input.capabilityId,input.targetVersionId,
        input.expectedCurrentVersionId,input.requestId));
    }
    if(action==='visibility'){
      const input=visibilityRequest.parse(await boundedJson(request));
      return json(await repository.changeVisibility(sellerId,input.capabilityId,
        input.expected,input.desired,input.requestId));
    }
    if(action==='grants'){
      const input=grantRequest.parse(await boundedJson(request));
      return json(await repository.grantPrivateAccess(sellerId,input.capabilityId,
        input.buyerEmail,input.grantId),201);
    }
    if(action==='revoke-grant'){
      const input=revokeGrantRequest.parse(await boundedJson(request));
      await repository.revokePrivateAccess(sellerId,input.capabilityId,input.grantId);
      return json({revoked:true});
    }
    return json(await repository.publish(sellerId,await boundedJson(request)),201);
  }catch(error){
    if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError)
      return json({code:'INVALID_INPUT'},400);
    if(error instanceof SellerPublicationError)return json({code:error.code},
      error.code==='NOT_FOUND'?404:error.code==='NOT_ELIGIBLE'?403:409);
    throw error;
  }
}
