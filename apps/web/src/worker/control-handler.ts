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
import { JobStatusSchema } from '../../../../packages/contracts/src/job-lifecycle.js';
import { FinanceError } from '../../../../packages/application/src/finance-policy.js';
import { ObjectIntegrityError } from '../../../../packages/application/src/object-integrity.js';
import { ResultFileSafetyError } from '../../../../packages/application/src/result-file-safety.js';
import { MalwareScanError } from '../../../../packages/infrastructure/adapters/src/clamav-scanner.js';
import { WorkerCapabilityReviewSchema } from '../../../../packages/contracts/src/seller-publication.js';
import { PostgresSellerPublicationRepository, SellerPublicationError } from
  '../../../../packages/persistence/src/seller-publication.js';
import { ResearchBroker } from '../../../../packages/application/src/research-broker.js';
import { NetworkPolicyError } from '../../../../packages/policy-engine/src/public-destination.js';
import { PostgresResearchUsage } from '../../../../packages/persistence/src/research-usage.js';
import { BraveWebSearchProvider } from '../../../../packages/infrastructure/http/src/brave-search.js';
import { NodePinnedPublicHttpTransport, SystemDnsResolver } from
  '../../../../packages/infrastructure/http/src/pinned-http.js';

const signedBody=z.strictObject({envelope:z.unknown(),body:z.unknown()});
function json(value:unknown,status=200):Response{return Response.json(value,{status,
  headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function transportAllowed(request:Request):boolean{
  if(process.env.NODE_ENV!=='production')return true;
  try{return new URL(request.url).protocol==='https:'&&
      new URL(process.env.APP_ORIGIN??'http://invalid').protocol==='https:';}
  catch{return false;}
}
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
  const state=process.env.KIVRO_CONTROL_PLANE_STATE;
  if(!id||!z.string().min(1).max(160).safeParse(id).success||
    (state!=='ACTIVE'&&state!=='DRAINING'))
    throw new Error('CONTROL_PLANE_NOT_CONFIGURED');
  return {id,state:state as 'ACTIVE'|'DRAINING'};
}

/** Provider-neutral, signed Worker polling. Seller pause sync precedes every offer. */
export async function handleWorkerPoll(request:Request):Promise<Response>{
  if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  if(!transportAllowed(request))return json({code:'TLS_REQUIRED'},403);
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
  if(!transportAllowed(request))return json({code:'TLS_REQUIRED'},403);
  try{
    const input=signedBody.parse(await boundedJson(request));
    const configured=plane();
    const body=z.union([WorkerHeartbeatSchema,WorkerJobControlAckSchema,
      JobAcceptedSchema,WorkerLocalJobControlReportSchema,WorkerCapabilityReviewSchema]).parse(input.body);
    if(body.controlPlaneId!==configured.id)return json({code:'WRONG_CONTROL_PLANE'},403);
    const marketplace=getMarketplaceService();
    const identity=await new PostgresWorkerMessageAuthenticator(marketplace.pool)
      .verify(input.envelope,body);
    if(identity.workerDeviceId!==body.workerDeviceId)return json({code:'WRONG_WORKER'},403);
    if(body.type==='CAPABILITY_REVIEW'){
      await new PostgresSellerPublicationRepository(marketplace.pool)
        .stageFromAuthenticatedWorker(body,identity.workerDeviceId);
    }else if(body.type==='WORKER_HEARTBEAT'){
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

const uuid=z.uuid();
const binding=z.strictObject({jobId:uuid,executionId:uuid,attemptId:uuid,
  workerDeviceId:uuid,controlPlaneId:z.string().min(1).max(160),
  leaseToken:z.string().min(32).max(512)});
const transition=z.strictObject({id:uuid,jobId:uuid,from:JobStatusSchema,to:JobStatusSchema,
  actor:z.literal('WORKER'),reason:z.string().min(1).max(200),
  attemptId:uuid,correlationId:uuid,paymentReservationId:z.null(),resultManifestId:z.null()});
const resultAsset=z.strictObject({id:uuid,fieldKey:z.string().min(1).max(160),
  objectKey:z.string().regex(/^private\/assets\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  sizeBytes:z.number().int().nonnegative(),sha256:z.string().regex(/^sha256:[a-f0-9]{64}$/),
  detectedMimeType:z.string().min(3).max(120)});
const outputIntent=binding.extend({assetId:uuid,fieldKey:z.string().min(1).max(160),
  extension:z.string().regex(/^[.][a-z0-9]{1,16}$/),
  sizeBytes:z.number().int().nonnegative().max(1_073_741_824),
  sha256:z.string().regex(/^sha256:[a-f0-9]{64}$/),
  detectedMimeType:z.string().min(3).max(120)});
export type WorkerJobRpcKind='ACCEPT'|'ACCEPTED_INPUT'|'TRANSITION'|'RENEW_LEASE'|
  'PREPARE_RESULT_ASSET'|'FINALIZE_RESULT'|'RESEARCH_SEARCH'|'RESEARCH_FETCH'|
  'RESEARCH_DOWNLOAD'|'PRIVATE_RESOURCE_READ';
const researchSearch=z.strictObject({requestId:uuid,query:z.string().min(2).max(256),
  maxResults:z.number().int().min(1).max(20)});
const researchUrl=z.strictObject({requestId:uuid,url:z.url().max(2048)});
const privateRead=z.strictObject({requestId:uuid});

function cloudResearchBroker(pool:ReturnType<typeof getMarketplaceService>['pool']){
  const resolver=new SystemDnsResolver();
  const transport=new NodePinnedPublicHttpTransport();
  const token=process.env.KIVRO_BRAVE_SEARCH_TOKEN;
  const search=token?new BraveWebSearchProvider(token,resolver,transport):{
    async search():Promise<never>{throw new Error('RESEARCH_PROVIDER_UNAVAILABLE');}
  };
  return new ResearchBroker(search,resolver,transport,new PostgresResearchUsage(pool));
}

/** Fixed signed Worker RPCs call the same paid execution and ledger state machines as UI/API. */
export async function handleWorkerJobRpc(request:Request,kind:WorkerJobRpcKind):Promise<Response>{
  if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  if(!transportAllowed(request))return json({code:'TLS_REQUIRED'},403);
  try{
    const input=signedBody.parse(await boundedJson(request));
    const configured=plane();
    const schema=kind==='ACCEPT'?binding.extend({messageId:uuid}):
      kind==='TRANSITION'?binding.extend({event:transition}):
      kind==='RENEW_LEASE'?binding.extend({ttlSeconds:z.number().int().min(5).max(3600)}):
      kind==='RESEARCH_SEARCH'?binding.extend({research:researchSearch}):
      kind==='RESEARCH_FETCH'||kind==='RESEARCH_DOWNLOAD'?
        binding.extend({research:researchUrl}):
      kind==='PRIVATE_RESOURCE_READ'?binding.extend({read:privateRead}):
      kind==='PREPARE_RESULT_ASSET'?outputIntent:
      kind==='FINALIZE_RESULT'?binding.extend({resultManifestId:uuid,
        retainUntil:z.iso.datetime({offset:true}),payload:z.unknown(),
        assets:z.array(resultAsset).max(50)}):binding;
    const body=schema.parse(input.body);
    if(body.controlPlaneId!==configured.id)return json({code:'WRONG_CONTROL_PLANE'},403);
    const app=getMarketplaceService();
    const identity=await new PostgresWorkerMessageAuthenticator(app.pool)
      .verify(input.envelope,body);
    if(identity.workerDeviceId!==body.workerDeviceId)return json({code:'WRONG_WORKER'},403);
    const jobs=app.getJobs();
    if(kind==='RESEARCH_SEARCH'||kind==='RESEARCH_FETCH'||
      kind==='RESEARCH_DOWNLOAD'||kind==='PRIVATE_RESOURCE_READ'){
      const authorized=await jobs.authorizeResearchOperation(body);
      if(!authorized.policy)return json({code:'NOT_ELIGIBLE'},403);
      const usage=new PostgresResearchUsage(app.pool);
      if(kind==='PRIVATE_RESOURCE_READ'){
        const data=binding.extend({read:privateRead}).parse(body);
        await usage.markPrivateResourceRead(data.jobId,authorized.capabilityVersionId);
        return json({ok:true});
      }
      const broker=cloudResearchBroker(app.pool);
      const researchBinding={jobId:body.jobId,
        capabilityVersionId:authorized.capabilityVersionId,
        internetPolicy:authorized.policy};
      if(kind==='RESEARCH_SEARCH'){
        const data=binding.extend({research:researchSearch}).parse(body);
        return json({results:await broker.search(researchBinding,data.research)});
      }
      if(kind==='RESEARCH_FETCH'){
        const data=binding.extend({research:researchUrl}).parse(body);
        return json(await broker.fetch(researchBinding,data.research));
      }
      const data=binding.extend({research:researchUrl}).parse(body);
      const downloaded=await broker.download(researchBinding,data.research);
      if(downloaded.bytes.byteLength>1_000_000)
        return json({code:'NETWORK_BUDGET_EXCEEDED'},413);
      return json({...downloaded,bytesBase64:Buffer.from(downloaded.bytes).toString('base64'),
        bytes:undefined});
    }
    if(kind==='ACCEPT'){
      const data=binding.extend({messageId:uuid}).parse(body);
      await jobs.accept(data.executionId,identity.workerDeviceId,identity.controlPlaneId,
        data.leaseToken,data.messageId);
      return json({ok:true});
    }
    if(kind==='ACCEPTED_INPUT')return json(await jobs.acceptedInputForWorker(body.executionId,
      identity.workerDeviceId,identity.controlPlaneId,body.leaseToken,app.getStorage(),30*86_400));
    if(kind==='TRANSITION'){
      const data=binding.extend({event:transition}).parse(body);
      if(data.event.jobId!==data.jobId||data.event.attemptId!==data.attemptId||
        data.event.correlationId!==data.executionId)return json({code:'WRONG_WORKER'},403);
      const state=await jobs.workerTransition(data.event,data.executionId,
        identity.workerDeviceId,identity.controlPlaneId,data.leaseToken);
      if(['FAILED_POLICY','FAILED_STARTUP','FAILED_EXECUTION','RESULT_REJECTED']
        .includes(state.status))await app.finance.releaseFailedJob(data.jobId);
      return json({ok:true});
    }
    if(kind==='RENEW_LEASE'){
      const data=binding.extend({ttlSeconds:z.number().int().min(5).max(3600)}).parse(body);
      return json({leaseExpiresAt:await jobs.renewLease(data.executionId,
        identity.workerDeviceId,identity.controlPlaneId,data.leaseToken,data.ttlSeconds)});
    }
    if(kind==='PREPARE_RESULT_ASSET'){
      const data=outputIntent.parse(body);
      return json(await jobs.prepareResultAsset({...data,
        workerDeviceId:identity.workerDeviceId,controlPlaneId:identity.controlPlaneId},
      app.getStorage()));
    }
    const data=binding.extend({resultManifestId:uuid,retainUntil:z.iso.datetime({offset:true}),
      payload:z.unknown(),assets:z.array(resultAsset).max(50)}).parse(body);
    // Worker-provided retention is ignored. Cloud owns the buyer privacy deadline.
    try{
      await jobs.finalizeResult({resultManifestId:data.resultManifestId,jobId:data.jobId,
        executionId:data.executionId,attemptId:data.attemptId,leaseToken:data.leaseToken,
        payload:data.payload,assets:data.assets,workerDeviceId:identity.workerDeviceId,
        controlPlaneId:identity.controlPlaneId},app.getStorage(),
      new Date(Date.now()+30*86_400_000).toISOString());
    }catch(error){
      const invalid=error instanceof ResultFileSafetyError||
        error instanceof ObjectIntegrityError&&error.code!=='MISSING'||
        error instanceof MalwareScanError&&error.code==='INFECTED';
      if(!invalid)throw error;
      await jobs.rejectInvalidResult({jobId:data.jobId,executionId:data.executionId,
        attemptId:data.attemptId,workerDeviceId:identity.workerDeviceId,
        controlPlaneId:identity.controlPlaneId,leaseToken:data.leaseToken});
      // A terminal rejection is acknowledged so the Worker outbox does not
      // retry the same unsafe artifact indefinitely. Credit release is atomic.
      return json({ok:false,code:'RESULT_REJECTED'});
    }
    await app.finance.settleDeliveredJob(data.jobId);
    return json({ok:true});
  }catch(error){
    if(error instanceof FinanceError)return json({code:error.code},409);
    return workerError(error);
  }
}

function workerError(error:unknown):Response{
  if(error instanceof NetworkPolicyError)return json({code:error.code},
    error.code==='SOURCE_UNAVAILABLE'?502:
      error.code==='BROKER_UNAVAILABLE'?503:
        error.code==='NETWORK_BUDGET_EXCEEDED'?429:403);
  if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError)
    return json({code:'INVALID_INPUT'},400);
  if(error instanceof WorkerAuthenticationError)return json({code:error.code},403);
  if(error instanceof SellerPublicationError)return json({code:error.code},
    error.code==='NOT_FOUND'?404:error.code==='NOT_ELIGIBLE'?403:409);
  if(error instanceof JobExecutionError||error instanceof SellerOperationsError)
    return json({code:error.code},error.code==='SCAN_UNAVAILABLE'?503:
      ['NOT_FOUND'].includes(error.code)?404:
      ['WRONG_WORKER','WRONG_CONTROL_PLANE','NOT_ELIGIBLE'].includes(error.code)?403:409);
  return json({code:'WORKER_CONTROL_UNAVAILABLE'},503);
}
