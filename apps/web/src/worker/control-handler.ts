import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PostgresWorkerMessageAuthenticator, WorkerAuthenticationError } from
  '../../../../packages/persistence/src/worker-auth.js';
import { PostgresWorkerHeartbeatRepository } from
  '../../../../packages/persistence/src/worker-heartbeat.js';
import { WorkerHelloSchema, WorkerHeartbeatSchema, WorkerJobControlAckSchema,
  JobAcceptedSchema, WorkerWelcomeSchema, WorkerJobControlCommandSchema,
  WorkerLocalJobControlReportSchema,
  WORKER_PROTOCOL_VERSION } from '../../../../packages/worker-protocol/src/messages.js';
import { getMarketplaceService } from '../marketplace/server.js';
import { getSellerOperations } from '../seller/operations-server.js';
import { JobExecutionError } from '../../../../packages/persistence/src/job-execution.js';
import { SellerOperationsError } from '../../../../packages/persistence/src/seller-operations.js';

const signedBody=z.strictObject({envelope:z.unknown(),body:z.unknown()});
function json(value:unknown,status=200):Response{return Response.json(value,{status,
  headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function boundedJson(request:Request):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    throw new TypeError('INVALID_CONTENT_TYPE');
  const reader=request.body?.getReader();if(!reader)throw new TypeError('EMPTY_BODY');
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const next=await reader.read();if(next.done)break;
    bytes+=next.value.byteLength;if(bytes>262_144)throw new TypeError('BODY_TOO_LARGE');
    chunks.push(next.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
function plane():{id:string;state:'ACTIVE'|'DRAINING'}{
  const id=process.env.KIVRO_CONTROL_PLANE_ID;
  const state=process.env.KIVRO_CONTROL_PLANE_STATE??'ACTIVE';
  if(!id||!z.string().min(1).max(160).safeParse(id).success||
    !['ACTIVE','DRAINING'].includes(state))throw new Error('CONTROL_PLANE_NOT_CONFIGURED');
  return {id,state:state as 'ACTIVE'|'DRAINING'};
}

/** Provider-neutral, signed Worker polling. Seller pause sync precedes every offer. */
export async function handleWorkerPoll(request:Request):Promise<Response>{
  if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  try{
    const input=signedBody.parse(await boundedJson(request));
    const hello=WorkerHelloSchema.parse(input.body);
    const configured=plane();
    if(!hello.supportedProtocolVersions.includes(WORKER_PROTOCOL_VERSION))
      return json({code:'PROTOCOL_MISMATCH'},409);
    if(hello.controlPlaneId!==configured.id)return json({code:'WRONG_CONTROL_PLANE'},403);
    const marketplace=getMarketplaceService();
    const identity=await new PostgresWorkerMessageAuthenticator(marketplace.pool)
      .verify(input.envelope,hello);
    if(identity.workerDeviceId!==hello.workerDeviceId)return json({code:'WRONG_WORKER'},403);
    const directive=await getSellerOperations().cloudDirective(hello.workerDeviceId);
    const welcome=WorkerWelcomeSchema.parse({type:'WORKER_WELCOME',messageId:randomUUID(),
      controlPlaneId:configured.id,selectedProtocolVersion:WORKER_PROTOCOL_VERSION,
      controlPlaneState:configured.state,serverTime:new Date().toISOString(),
      pauseDirective:directive});
    const controls=(await marketplace.getJobs().pendingJobControls(hello.workerDeviceId,
      configured.id,16)).map((entry)=>WorkerJobControlCommandSchema.parse(entry));
    const offers=configured.state==='ACTIVE'&&!directive.paused&&!directive.securityPaused?
      await marketplace.getJobs().pendingOffers(hello.workerDeviceId,configured.id,15):[];
    return json({protocolVersion:WORKER_PROTOCOL_VERSION,messages:[welcome,...controls,...offers]});
  }catch(error){return workerError(error);}
}

/** Worker messages are authenticated and persisted before 204 acknowledgement. */
export async function handleWorkerMessage(request:Request):Promise<Response>{
  if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  try{
    const input=signedBody.parse(await boundedJson(request));
    const configured=plane();
    const body=z.union([WorkerHeartbeatSchema,WorkerJobControlAckSchema,
      JobAcceptedSchema,WorkerLocalJobControlReportSchema]).parse(input.body);
    if(body.controlPlaneId!==configured.id)return json({code:'WRONG_CONTROL_PLANE'},403);
    const marketplace=getMarketplaceService();
    const identity=await new PostgresWorkerMessageAuthenticator(marketplace.pool)
      .verify(input.envelope,body);
    if(identity.workerDeviceId!==body.workerDeviceId)return json({code:'WRONG_WORKER'},403);
    if(body.type==='WORKER_HEARTBEAT'){
      await new PostgresWorkerHeartbeatRepository(marketplace.pool).observe(body,
        identity.workerDeviceId,identity.controlPlaneId);
    }else if(body.type==='LOCAL_JOB_CONTROL_REPORT'){
      await marketplace.getJobs().reconcileLocalJobControl(body,
        identity.workerDeviceId,identity.controlPlaneId);
    }else if(body.type==='JOB_ACCEPTED'){
      await marketplace.getJobs().accept(body.executionId,identity.workerDeviceId,
        identity.controlPlaneId,body.leaseToken,body.messageId);
    }else{
      await marketplace.getJobs().acknowledgeJobControl({commandId:body.commandId,
        jobId:body.jobId,executionId:body.executionId,attemptId:body.attemptId,
        workerDeviceId:body.workerDeviceId,controlPlaneId:body.controlPlaneId,
        status:body.status,localRevision:body.localRevision,confirmedAt:body.confirmedAt},
      identity.workerDeviceId,identity.controlPlaneId);
    }
    return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  }catch(error){return workerError(error);}
}

function workerError(error:unknown):Response{
  if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError)
    return json({code:'INVALID_INPUT'},400);
  if(error instanceof WorkerAuthenticationError)return json({code:error.code},403);
  if(error instanceof JobExecutionError||error instanceof SellerOperationsError)
    return json({code:error.code},['NOT_FOUND'].includes(error.code)?404:
      ['WRONG_WORKER','WRONG_CONTROL_PLANE','NOT_ELIGIBLE'].includes(error.code)?403:409);
  return json({code:'WORKER_CONTROL_UNAVAILABLE'},503);
}
