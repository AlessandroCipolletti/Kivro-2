import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { PlatformOperationsError,PlatformOperationsRepository } from
  '../../../../packages/persistence/src/platform-operations.js';
import { SellerOperationsError } from '../../../../packages/persistence/src/seller-operations.js';
import { getSellerOperations } from '../seller/operations-server.js';

const id=z.uuid();
const reason=z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
const halt=z.strictObject({halted:z.boolean(),expectedRevision:z.number().int().positive(),reasonCode:reason});
const suspension=z.strictObject({suspended:z.boolean(),reasonCode:reason});
const denyPattern=z.strictObject({id,pattern:z.string().min(8).max(160),reasonCode:reason});
const reportState=z.strictObject({state:z.enum(['REVIEWED','CLOSED']),reasonCode:reason});
function json(body:unknown,status=200){return Response.json(body,{status,headers:{
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
async function body(request:Request):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    throw new TypeError('INVALID_CONTENT_TYPE');
  const reader=request.body?.getReader();if(!reader)throw new TypeError('EMPTY_BODY');
  const parts:Uint8Array[]=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;
    size+=next.value.byteLength;if(size>16_384)throw new TypeError('BODY_TOO_LARGE');
    parts.push(next.value);}}finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
}

/** DB-granted operator authority; neither buyer nor seller roles grant access. */
export async function handleOperatorRequest(request:Request,path:readonly string[],
  auth:AuthService):Promise<Response>{
  if(!['GET','POST'].includes(request.method))return json({code:'METHOD_NOT_ALLOWED'},405);
  if(request.method==='POST'){
    const origin=process.env.APP_ORIGIN;
    if(!origin||request.headers.get('origin')!==new URL(origin).origin)
      return json({code:'ORIGIN_DENIED'},403);
  }
  const session=await auth.auth.api.getSession({headers:request.headers});
  if(!session)return json({code:'UNAUTHENTICATED'},401);
  const actor=session.user.id;
  const ops=new PlatformOperationsRepository(auth.database);
  try{
    const client=await auth.database.connect();
    try{await client.query('BEGIN');await ops.assertOperator(client,actor);
      await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
    const key=path.join('/');
    if(request.method==='GET'){
      if(key==='dispatch')return json(await ops.dispatchState(actor));
      if(key==='reports')return json({reports:await ops.openReports(actor)});
      if(key==='metrics')return json({window:'30d',metrics:await ops.metrics(actor)});
      if(path[0]==='job'&&path.length===3&&path[2]==='audit')
        return json({events:await ops.jobAudit(actor,id.parse(path[1]))});
      return json({code:'NOT_FOUND'},404);
    }
    if(key==='dispatch'){
      const value=halt.parse(await body(request));
      return json(await ops.setDispatchHalt(actor,value.halted,value.expectedRevision,value.reasonCode));
    }
    if(path[0]==='suspend'&&path.length===3){
      const subject=z.enum(['ACCOUNT','WORKER','CAPABILITY']).parse(path[1]);
      const value=suspension.parse(await body(request));
      await ops.setSuspension(actor,subject,id.parse(path[2]),value.suspended,value.reasonCode);
      return json({ok:true});
    }
    if(key==='deny-pattern'){
      const value=denyPattern.parse(await body(request));
      await ops.addDenyPattern(actor,value.id,value.pattern,value.reasonCode);
      return json({ok:true},201);
    }
    if(path[0]==='report'&&path.length===3&&path[2]==='state'){
      const value=reportState.parse(await body(request));
      await ops.reviewReport(actor,id.parse(path[1]),value.state,value.reasonCode);
      return json({ok:true});
    }
    if(path[0]==='worker'&&path.length===3&&path[2]==='clear-security'){
      await getSellerOperations().clearSecurityBlockByPlatform(id.parse(path[1]),actor);
      return json({ok:true});
    }
    return json({code:'NOT_FOUND'},404);
  }catch(error){
    if(error instanceof PlatformOperationsError)return json({code:error.code},
      error.code==='FORBIDDEN'?403:error.code==='NOT_FOUND'?404:409);
    if(error instanceof SellerOperationsError)return json({code:error.code},409);
    if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError)
      return json({code:'INVALID_INPUT'},400);
    throw error;
  }
}
