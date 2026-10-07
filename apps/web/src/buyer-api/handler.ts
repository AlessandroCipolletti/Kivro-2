import { createHash,randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from '../../../../packages/contracts/src/canonical-json.js';
import { MarketplaceSearchSchema } from '../../../../packages/contracts/src/marketplace.js';
import { PriceSnapshotSchema } from '../../../../packages/contracts/src/pricing.js';
import { BuyerApiJobCreatedSchema } from '../../../../packages/contracts/src/buyer-api.js';
import { ContractValidationError } from '../../../../packages/contracts/src/contract-values.js';
import { BuyerApiError,BuyerApiScopeSchema } from
  '../../../../packages/persistence/src/buyer-api-keys.js';
import { BuyerWebhookError,BuyerWebhookEventSchema } from
  '../../../../packages/persistence/src/buyer-webhooks.js';
import { BuyerMarketplaceError } from '../../../../packages/persistence/src/marketplace-buyer.js';
import { MarketplaceAssetError } from '../../../../packages/persistence/src/marketplace-assets.js';
import { AvailabilityError } from '../../../../packages/persistence/src/availability.js';
import { FinanceError } from '../../../../packages/application/src/finance-policy.js';
import { JobExecutionError } from '../../../../packages/persistence/src/job-execution.js';
import { getMarketplaceService } from '../marketplace/server.js';
import { getBuyerApiKeys,getBuyerWebhooks } from './server.js';
import { readBoundedJson } from './http.js';

const uuid=z.uuid();
const jobInput=z.strictObject({inputs:z.record(z.string(),z.unknown()),
  assets:z.record(z.string(),z.array(uuid)),mode:z.enum(['IMMEDIATE_ONLY','EARLIEST_AVAILABLE'])
    .default('IMMEDIATE_ONLY'),latestAcceptableStartAt:z.iso.datetime({offset:true}).optional()});
const upload=z.strictObject({capabilityId:uuid,fieldKey:z.string().min(1).max(64),
  fileName:z.string().min(1).max(128),sizeBytes:z.number().int().nonnegative(),
  sha256:z.string(),contentType:z.string().min(3).max(120)});
const endpointCreate=z.strictObject({url:z.string().max(2048),
  events:z.array(BuyerWebhookEventSchema)});
const endpointUpdate=z.strictObject({url:z.string().max(2048).optional(),
  events:z.array(BuyerWebhookEventSchema).optional(),enabled:z.boolean().optional()});
const stored=z.object({httpStatus:z.number().int(),body:z.unknown()});

function json(body:unknown,status=200,extra:Record<string,string>={}):Response{
  return Response.json(body,{status,headers:{'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',...extra}});
}
function search(url:URL){
  const p=url.searchParams;return MarketplaceSearchSchema.parse({query:p.get('q')??'',
    ...(p.has('category')?{category:p.get('category')}:{}),
    ...(p.has('maximumPriceMinor')?{maximumPriceMinor:Number(p.get('maximumPriceMinor'))}:{}),
    ...(p.has('minimumRating')?{minimumRating:Number(p.get('minimumRating'))}:{}),
    ...(p.has('sort')?{sort:p.get('sort')}:{}),
    ...(p.has('limit')?{limit:Number(p.get('limit'))}:{}),
    ...(p.has('offset')?{offset:Number(p.get('offset'))}:{}),
    onlineNow:p.get('onlineNow')==='true'});
}
function endpointFor(path:readonly string[]):string{
  if(path[0]==='capabilities'&&path.length===3&&path[2]==='jobs')return 'jobs:create';
  if(path[0]==='capabilities')return 'capabilities:read';
  if(path[0]==='jobs')return path[2]==='cancel'?'jobs:create':'jobs:read';
  if(path[0]==='assets')return path[1]==='upload-intents'||path[2]==='finalize'?
    'assets:create':'assets:read';
  if(path[0]==='webhooks')return 'webhooks:manage';
  return 'unknown';
}
async function unavailable(capabilityId:string,buyerId:string,reason:string){
  const availability=await getMarketplaceService().availability.publicStatus(capabilityId,buyerId)
    .catch(()=>null);
  const status=availability?.status;
  const code=reason==='QUEUE_FULL'||availability?.reason==='QUEUE_FULL'?
    'CAPABILITY_QUEUE_FULL':status==='SCHEDULED_OFFLINE'?
    'CAPABILITY_SCHEDULED_OFFLINE':status==='PAUSED'?'CAPABILITY_PAUSED':
    status==='OFFLINE'?'CAPABILITY_OFFLINE':status==='BUSY'?'CAPABILITY_BUSY':
    'CAPABILITY_UNAVAILABLE';
  return json({code,availability:availability??null},409);
}

/** Public bearer API: no session cookie, Worker identity or payment shortcut is accepted. */
export async function handleBuyerV1(request:Request,path:readonly string[]):Promise<Response>{
  const url=new URL(request.url),method=request.method;
  if(process.env.NODE_ENV==='production'){
    let originIsHttps=false;
    try{originIsHttps=new URL(process.env.APP_ORIGIN??'http://invalid').protocol==='https:';}
    catch{originIsHttps=false;}
    if(url.protocol!=='https:'||!originIsHttps)return json({code:'TLS_REQUIRED'},403);
  }
  if(['api_key','access_token','token','key'].some((name)=>url.searchParams.has(name)))
    return json({code:'KEY_IN_URL_DENIED'},400);
  const authorization=request.headers.get('authorization')??'';
  if(!/^Bearer kv_(?:test|live)_[A-Za-z0-9_-]+$/.test(authorization))
    return json({code:'UNAUTHENTICATED'},401);
  const endpoint=endpointFor(path);
  if(endpoint==='unknown')return json({code:'NOT_FOUND'},404);
  try{
    const scope=BuyerApiScopeSchema.parse(endpoint);
    const actor=await getBuyerApiKeys().authenticate(authorization.slice(7),scope,endpoint);
    const app=getMarketplaceService();
    if(method==='GET'&&path.length===1&&path[0]==='capabilities')
      return json({apiVersion:'v1',items:await app.catalog.search(search(url),actor.accountId)});
    if(method==='GET'&&path.length===2&&path[0]==='capabilities'){
      const detail=await app.catalog.detailByIdentifier(path[1]!,actor.accountId);
      return detail?json({apiVersion:'v1',detail}):json({code:'NOT_FOUND'},404);
    }
    if(method==='GET'&&path.length===1&&path[0]==='jobs'){
      const limit=z.coerce.number().int().min(1).max(100).parse(url.searchParams.get('limit')??'50');
      const offset=z.coerce.number().int().nonnegative().max(1_000_000).parse(
        url.searchParams.get('offset')??'0');
      return json({apiVersion:'v1',items:await app.getBuyer().history(actor.accountId,limit,null,offset),
        total:await app.getBuyer().historyCount(actor.accountId)});
    }
    if(method==='GET'&&path.length===2&&path[0]==='jobs')
      return json({apiVersion:'v1',job:await app.getBuyer().job(actor.accountId,path[1]!)});
    if(method==='POST'&&path.length===3&&path[0]==='jobs'&&path[2]==='cancel'){
      await app.getBuyer().cancel(actor.accountId,uuid.parse(path[1]),randomUUID());
      return json({ok:true});
    }
    if(method==='POST'&&path.length===3&&path[0]==='capabilities'&&path[2]==='jobs'){
      const idempotencyKey=request.headers.get('idempotency-key');
      if(!idempotencyKey)return json({code:'IDEMPOTENCY_KEY_REQUIRED'},400);
      const parsed=jobInput.parse(await readBoundedJson(request));
      const fingerprint=createHash('sha256').update(canonicalJson({path:path[1],body:parsed}))
        .digest('hex');
      const claimed=await getBuyerApiKeys().claimJob({accountId:actor.accountId,keyId:actor.keyId,
        endpoint:`capabilities/${path[1]}/jobs`,idempotencyKey,fingerprint});
      if(claimed.kind==='COMPLETE'){
        const saved=stored.parse(claimed.response);
        return json(saved.body,saved.httpStatus);
      }
      const finish=async(response:Response)=>{
        await getBuyerApiKeys().completeJob({accountId:actor.accountId,
          endpoint:`capabilities/${path[1]}/jobs`,idempotencyKey,token:claimed.token,
          response:{httpStatus:response.status,body:await response.clone().json()}});
        return response;
      };
      const existingQuote=await app.pool.query<{accepted_job_id:string|null;
        capability_id:string;price_snapshot:unknown;version_number:number}>(`
        SELECT q.accepted_job_id,q.capability_id,q.price_snapshot,v.version_number
        FROM job_schedule_quotes q JOIN capability_versions v ON v.id=q.capability_version_id
        WHERE q.id=$1 AND q.buyer_account_id=$2`,[claimed.quoteId,actor.accountId]);
      if(existingQuote.rows[0]?.accepted_job_id===claimed.jobId){
        const payload={values:parsed.inputs,assets:parsed.assets};
        const purchased=await app.getBuyer().purchase({buyerId:actor.accountId,
          quoteId:claimed.quoteId,jobId:claimed.jobId,reservationId:claimed.reservationId,
          manifestId:claimed.manifestId,payload});
        const price=PriceSnapshotSchema.parse(existingQuote.rows[0].price_snapshot);
        const response=BuyerApiJobCreatedSchema.parse({apiVersion:'v1',jobId:purchased.jobId,status:purchased.status,
          capabilityId:existingQuote.rows[0].capability_id,
          capabilityVersion:existingQuote.rows[0].version_number,
          price:{currency:price.currency,amountMinor:price.buyerAmountMinor}});
        return finish(json(response,201));
      }
      if(existingQuote.rows[0]?.accepted_job_id)
        return finish(json({code:'IDEMPOTENCY_CONFLICT'},409));
      const detail=await app.catalog.detailByIdentifier(path[1]!,actor.accountId);
      if(!detail)return finish(json({code:'NOT_FOUND'},404));
      const payload={values:parsed.inputs,assets:parsed.assets};
      let preflight;
      try{preflight=await app.getBuyer().preflight({buyerId:actor.accountId,
        capabilityId:detail.id,mode:parsed.mode,quoteId:claimed.quoteId,
        expectedVersionId:detail.version.id,payload,
        ...(parsed.latestAcceptableStartAt?{
          latestAcceptableStartAt:parsed.latestAcceptableStartAt}:{})});}
      catch(error){
        if(error instanceof AvailabilityError)return finish(await unavailable(detail.id,
          actor.accountId,error.code));
        if(error instanceof BuyerMarketplaceError)return finish(json({code:error.code},
          error.code==='NOT_FOUND'?404:409));
        if(error instanceof ContractValidationError)return finish(json({code:'INVALID_INPUT',
          reason:error.code,field:error.field??null},400));
        if(error instanceof z.ZodError)return finish(json({code:'INVALID_INPUT'},400));
        throw error;
      }
      if(!preflight.canAfford){
        const response={code:'INSUFFICIENT_FUNDS',availableMinor:preflight.balance.availableMinor,
          requiredMinor:preflight.quote.price.buyerAmountMinor};
        return finish(json(response,402));
      }
      let purchased;
      try{purchased=await app.getBuyer().purchase({buyerId:actor.accountId,
        quoteId:claimed.quoteId,jobId:claimed.jobId,reservationId:claimed.reservationId,
        manifestId:claimed.manifestId,payload});}
      catch(error){
        if(error instanceof AvailabilityError)return finish(await unavailable(detail.id,
          actor.accountId,error.code));
        if(error instanceof FinanceError&&error.code==='INSUFFICIENT_CREDITS')
          return finish(json({code:'INSUFFICIENT_FUNDS'},402));
        if(error instanceof ContractValidationError)return finish(json({code:'INVALID_INPUT',
          reason:error.code,field:error.field??null},400));
        if(error instanceof BuyerMarketplaceError)return finish(json({code:error.code},
          error.code==='NOT_FOUND'?404:409));
        throw error;
      }
      const response=BuyerApiJobCreatedSchema.parse({apiVersion:'v1',jobId:purchased.jobId,status:purchased.status,
        capabilityId:detail.id,capabilityVersion:detail.version.number,
        price:{currency:preflight.quote.price.currency,
          amountMinor:preflight.quote.price.buyerAmountMinor}});
      return finish(json(response,201));
    }
    if(method==='POST'&&path.length===2&&path[0]==='assets'&&path[1]==='upload-intents'){
      return json({apiVersion:'v1',upload:await app.getAssets().beginDirect({buyerId:actor.accountId,
        ...upload.parse(await readBoundedJson(request))})},201);
    }
    if(method==='POST'&&path.length===3&&path[0]==='assets'&&path[2]==='finalize'){
      const input=z.strictObject({capabilityId:uuid,fieldKey:z.string().min(1).max(64)})
        .parse(await readBoundedJson(request));
      return json({apiVersion:'v1',asset:await app.getAssets().finalizeDirect({buyerId:actor.accountId,
        assetId:uuid.parse(path[1]),...input})});
    }
    if(method==='GET'&&path.length===2&&path[0]==='assets'){
      const asset=await app.getBuyer().ownedOutputAsset(actor.accountId,path[1]!);
      if(!asset)return json({code:'NOT_FOUND'},404);
      const stream=await app.getStorage().readPrivateObject(asset.objectKey);
      const iterator=stream[Symbol.asyncIterator]();
      const bytes=new ReadableStream<Uint8Array>({async pull(controller){
        const next=await iterator.next();if(next.done)controller.close();
        else controller.enqueue(next.value);},async cancel(){await iterator.return?.();}});
      return new Response(bytes,{headers:{'Content-Type':asset.mimeType,
        'Content-Length':String(asset.sizeBytes),'Content-Disposition':
          `attachment; filename="kivro-result-${uuid.parse(path[1])}"`,
        'Content-Security-Policy':"default-src 'none'; sandbox",
        'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
    }
    if(path[0]==='webhooks'){
      const hooks=getBuyerWebhooks();
      if(method==='GET'&&path.length===1)return json({apiVersion:'v1',endpoints:
        await hooks.list(actor.accountId)});
      if(method==='POST'&&path.length===1)return json({apiVersion:'v1',endpoint:
        await hooks.create(actor.accountId,endpointCreate.parse(await readBoundedJson(request)))},201);
      if(method==='PATCH'&&path.length===2)return json({apiVersion:'v1',endpoint:
        await hooks.update(actor.accountId,path[1]!,endpointUpdate.parse(await readBoundedJson(request)))});
      if(method==='DELETE'&&path.length===2){await hooks.remove(actor.accountId,path[1]!);
        return json({ok:true});}
      if(method==='GET'&&path.length===3&&path[2]==='deliveries')
        return json({apiVersion:'v1',deliveries:await hooks.deliveries(actor.accountId,path[1]!)});
      if(method==='POST'&&path.length===3&&path[2]==='test')
        return json({apiVersion:'v1',...await hooks.sendTest(actor.accountId,path[1]!)},202);
      if(method==='POST'&&path.length===3&&path[2]==='rotate-secret')
        return json({apiVersion:'v1',...await hooks.rotateSecret(actor.accountId,path[1]!)});
    }
    return json({code:'NOT_FOUND'},404);
  }catch(error){
    if(error instanceof BuyerApiError)return json({code:error.code},
      error.code==='UNAUTHENTICATED'?401:error.code==='FORBIDDEN'?403:
        error.code==='RATE_LIMITED'?429:error.code==='IN_PROGRESS'?409:
          error.code==='NOT_FOUND'?404:error.code==='CONFLICT'?409:400,
      error.retryAfterSeconds?{'Retry-After':String(error.retryAfterSeconds)}:{});
    if(error instanceof BuyerMarketplaceError||error instanceof MarketplaceAssetError||
      error instanceof BuyerWebhookError||error instanceof JobExecutionError)
      return json({code:error.code},error.code==='NOT_FOUND'?404:409);
    if(error instanceof FinanceError)return json({code:error.code==='INSUFFICIENT_CREDITS'?
      'INSUFFICIENT_FUNDS':error.code},
      error.code==='INSUFFICIENT_CREDITS'?402:409);
    if(error instanceof AvailabilityError)return json({code:error.code},409);
    if(error instanceof ContractValidationError)return json({code:'INVALID_INPUT',
      reason:error.code,field:error.field??null},400);
    if(error instanceof z.ZodError||error instanceof SyntaxError||error instanceof TypeError)
      return json({code:'INVALID_INPUT'},400);
    throw error;
  }
}
