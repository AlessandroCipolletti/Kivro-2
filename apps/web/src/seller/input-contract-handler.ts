import {z} from 'zod';
import type {AuthService} from '../auth/server.js';
import {PostgresSellerInputContractDrafts,SellerInputContractDraftError} from
  '../../../../packages/persistence/src/seller-input-contract-drafts.js';

const save=z.strictObject({draftId:z.uuid(),expectedRevision:z.number().int().nonnegative(),
  contract:z.unknown()});
function json(value:unknown,status=200):Response{
  return Response.json(value,{status,headers:{'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'}});
}
export async function handleSellerInputContract(request:Request,
  auth:AuthService):Promise<Response>{
  if(request.method!=='GET'&&request.method!=='POST')
    return json({code:'METHOD_NOT_ALLOWED'},405);
  if(request.method==='POST'){
    const origin=process.env.APP_ORIGIN;
    if(!origin||request.headers.get('origin')!==new URL(origin).origin)
      return json({code:'ORIGIN_DENIED'},403);
  }
  const session=await auth.auth.api.getSession({headers:request.headers});
  if(!session)return json({code:'UNAUTHENTICATED'},401);
  const sellerId=session.user.id;
  try{
    const eligible=await auth.database.query<{ok:boolean}>(`SELECT
      (a.status='ACTIVE' AND a.auth_email_verified AND s.id IS NOT NULL) AS ok
      FROM accounts a LEFT JOIN seller_profiles s ON s.account_id=a.id
      WHERE a.id=$1`,[sellerId]);
    if(!eligible.rows[0]?.ok)return json({code:'SELLER_NOT_READY'},403);
    const repository=new PostgresSellerInputContractDrafts(auth.database);
    if(request.method==='GET'){
      const id=new URL(request.url).searchParams.get('draftId');
      return json(id?await repository.get(sellerId,id):
        {drafts:await repository.list(sellerId)});
    }
    if(request.headers.get('content-type')?.split(';',1)[0]?.trim()!==
      'application/json')return json({code:'INVALID_CONTENT_TYPE'},415);
    const reader=request.body?.getReader();
    if(!reader)return json({code:'EMPTY_BODY'},400);
    const chunks:Uint8Array[]=[];let bytes=0;
    try{for(;;){const next=await reader.read();if(next.done)break;
      bytes+=next.value.byteLength;
      if(bytes>64_000){void reader.cancel().catch(()=>undefined);
        return json({code:'BODY_TOO_LARGE'},413);}
      chunks.push(next.value);}}
    finally{reader.releaseLock();}
    const input=save.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    return json(await repository.save(sellerId,input.draftId,
      input.expectedRevision,input.contract));
  }catch(error){
    if(error instanceof SellerInputContractDraftError)return json({code:error.code},
      error.code==='NOT_FOUND'?404:409);
    if(error instanceof z.ZodError||error instanceof TypeError||
      error instanceof SyntaxError)return json({code:'INVALID_CONTRACT'},400);
    throw error;
  }
}
