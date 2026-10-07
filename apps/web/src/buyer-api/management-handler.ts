import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { BuyerApiScopeSchema,BuyerApiError } from
  '../../../../packages/persistence/src/buyer-api-keys.js';
import { BuyerWebhookEventSchema,BuyerWebhookError } from
  '../../../../packages/persistence/src/buyer-webhooks.js';
import { getBuyerApiKeys,getBuyerWebhooks } from './server.js';
import { readBoundedJson } from './http.js';

const keyCreate=z.strictObject({name:z.string().trim().min(1).max(80),
  scopes:z.array(BuyerApiScopeSchema).min(1).max(6),
  expiresAt:z.iso.datetime({offset:true}).nullable().optional()});
const hookCreate=z.strictObject({url:z.string().max(2048),
  events:z.array(BuyerWebhookEventSchema)});
const hookUpdate=z.strictObject({url:z.string().max(2048).optional(),
  events:z.array(BuyerWebhookEventSchema).optional(),enabled:z.boolean().optional()});
function json(value:unknown,status=200){return Response.json(value,{status,
  headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}

export async function handleBuyerIntegrationManagement(request:Request,path:readonly string[],
  auth:AuthService):Promise<Response>{
  const session=await auth.auth.api.getSession({headers:request.headers});
  if(!session)return json({code:'UNAUTHENTICATED'},401);
  const accountId=session.user.id;
  const account=await auth.database.query<{status:string;email_verified_at:Date|null}>(
    'SELECT status,email_verified_at FROM accounts WHERE id=$1',[accountId]);
  if(account.rows[0]?.status!=='ACTIVE'||!account.rows[0].email_verified_at)
    return json({code:'FORBIDDEN'},403);
  if(request.method!=='GET'&&request.headers.get('origin')!==
    new URL(process.env.APP_ORIGIN??'https://invalid.local').origin)
    return json({code:'ORIGIN_DENIED'},403);
  try{
    if(path[0]==='keys'){
      const repo=getBuyerApiKeys();
      if(request.method==='GET'&&path.length===1)return json({keys:await repo.list(accountId)});
      if(request.method==='POST'&&path.length===1)return json({key:
        await repo.create(accountId,keyCreate.parse(await readBoundedJson(request)))},201);
      if(request.method==='POST'&&path.length===3&&path[2]==='revoke'){
        await repo.revoke(accountId,path[1]!);return json({ok:true});}
      if(request.method==='POST'&&path.length===3&&path[2]==='rotate')
        return json({key:await repo.rotate(accountId,path[1]!)},201);
    }
    if(path[0]==='webhooks'){
      const repo=getBuyerWebhooks();
      if(request.method==='GET'&&path.length===1)
        return json({endpoints:await repo.list(accountId)});
      if(request.method==='POST'&&path.length===1)
        return json({endpoint:await repo.create(accountId,
          hookCreate.parse(await readBoundedJson(request)))},201);
      if(request.method==='PATCH'&&path.length===2)
        return json({endpoint:await repo.update(accountId,path[1]!,
          hookUpdate.parse(await readBoundedJson(request)))});
      if(request.method==='DELETE'&&path.length===2){await repo.remove(accountId,path[1]!);
        return json({ok:true});}
      if(request.method==='GET'&&path.length===3&&path[2]==='deliveries')
        return json({deliveries:await repo.deliveries(accountId,path[1]!)});
      if(request.method==='POST'&&path.length===3&&path[2]==='test')
        return json(await repo.sendTest(accountId,path[1]!),202);
      if(request.method==='POST'&&path.length===3&&path[2]==='rotate-secret')
        return json(await repo.rotateSecret(accountId,path[1]!));
    }
    return json({code:'NOT_FOUND'},404);
  }catch(error){
    if(error instanceof BuyerApiError||error instanceof BuyerWebhookError)
      return json({code:error.code},error.code==='NOT_FOUND'?404:
        error.code==='CONFLICT'?409:400);
    if(error instanceof z.ZodError||error instanceof SyntaxError||error instanceof TypeError)
      return json({code:'INVALID_INPUT'},400);
    throw error;
  }
}
