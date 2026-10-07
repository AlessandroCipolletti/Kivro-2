import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { getSellerOperations } from './operations-server.js';
import { getMarketplaceService } from '../marketplace/server.js';
import { SellerOperationsError } from '../../../../packages/persistence/src/seller-operations.js';
import { AvailabilityError } from '../../../../packages/persistence/src/availability.js';
import { JobExecutionError } from '../../../../packages/persistence/src/job-execution.js';
import { JobControlCommandSchema } from '../../../../packages/contracts/src/job-control.js';
import { PlatformOperationsError,PlatformOperationsRepository } from
  '../../../../packages/persistence/src/platform-operations.js';

const id=z.uuid();
const pause=z.strictObject({paused:z.boolean(),reason:z.string().trim().max(200).nullable(),
  maintenanceUntil:z.iso.datetime({offset:true}).nullable().optional()});
const schedule=z.strictObject({policy:z.unknown(),expectedRevision:z.number().int().positive()});
const jobControl=JobControlCommandSchema.omit({source:true,actorId:true});
const abuseReport=z.strictObject({id,jobId:id,category:z.enum([
  'HARASSMENT','MALICIOUS_INPUT','UNSAFE_OUTPUT','FRAUD','PRIVACY','OTHER'])});
function json(value:unknown,status=200):Response{return Response.json(value,{status,
  headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
async function boundedJson(request:Request):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    throw new TypeError('INVALID_CONTENT_TYPE');
  const reader=request.body?.getReader();if(!reader)throw new TypeError('EMPTY_BODY');
  const parts:Uint8Array[]=[];let bytes=0;
  try{for(;;){const result=await reader.read();if(result.done)break;
    bytes+=result.value.byteLength;if(bytes>32_768)throw new TypeError('BODY_TOO_LARGE');
    parts.push(result.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
}

export async function handleSellerOperationsRequest(request:Request,path:readonly string[],
  auth:AuthService):Promise<Response>{
  if(!['GET','POST'].includes(request.method))return json({code:'METHOD_NOT_ALLOWED'},405);
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
      (status='ACTIVE' AND auth_email_verified) AS ok FROM accounts WHERE id=$1`,
      [sellerId]);
    if(!verified.rows[0]?.ok)return json({code:'ACCOUNT_NOT_VERIFIED'},403);
    const service=getSellerOperations();
    if(request.method==='GET'&&path.join('/')==='dashboard')
      return json(await service.dashboard(sellerId));
    if(request.method!=='POST')return json({code:'NOT_FOUND'},404);
    const raw=await boundedJson(request);
    if(path[0]==='worker'&&path.length===3&&path[2]==='pause'){
      const body=pause.parse(raw);await service.setWorkerPause(sellerId,id.parse(path[1]),
        body.paused,body.reason,body.maintenanceUntil??null);return json({ok:true});
    }
    if(path[0]==='capability'&&path.length===3&&path[2]==='pause'){
      const body=pause.parse(raw);await service.setCapabilityPause(sellerId,id.parse(path[1]),
        body.paused,body.reason,body.maintenanceUntil??null);return json({ok:true});
    }
    if(path[0]==='capability'&&path.length===3&&path[2]==='schedule'){
      const body=schedule.parse(raw);const revision=await service.setSchedule(sellerId,
        id.parse(path[1]),body.policy,body.expectedRevision);return json({revision});
    }
    if(path[0]==='job'&&path.length===3&&path[2]==='control'){
      const body=jobControl.parse(raw);
      if(body.jobId!==id.parse(path[1]))return json({code:'INVALID_INPUT'},400);
      const marketplace=getMarketplaceService();
      const result=await marketplace.getJobs().requestJobControl({
        ...body,source:'WEB',actorId:sellerId},sellerId);
      return json(result);
    }
    if(path.join('/')==='report-abuse'){
      const report=abuseReport.parse(raw);
      await new PlatformOperationsRepository(auth.database).report(sellerId,report.id,
        report.jobId,'SELLER',report.category);
      return json({ok:true},201);
    }
    return json({code:'NOT_FOUND'},404);
  }catch(error){
    if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError)
      return json({code:'INVALID_INPUT'},400);
    if(error instanceof SellerOperationsError||error instanceof AvailabilityError||
      error instanceof JobExecutionError){return json({code:error.code},
        error.code==='NOT_FOUND'?404:error.code==='NOT_ELIGIBLE'||
          error.code==='SECURITY_BLOCK'?403:409);}
    if(error instanceof PlatformOperationsError)return json({code:error.code},
      error.code==='FORBIDDEN'?403:error.code==='NOT_FOUND'?404:409);
    throw error;
  }
}
