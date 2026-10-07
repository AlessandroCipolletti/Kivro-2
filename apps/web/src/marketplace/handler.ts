import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { getFinanceService } from '../payments/server.js';
import { getMarketplaceService } from './server.js';
import { MarketplaceSearchSchema } from '../../../../packages/contracts/src/marketplace.js';
import { AvailabilityError } from '../../../../packages/persistence/src/availability.js';
import { FinanceError } from '../../../../packages/application/src/finance-policy.js';
import { JobExecutionError } from '../../../../packages/persistence/src/job-execution.js';
import { BuyerMarketplaceError } from '../../../../packages/persistence/src/marketplace-buyer.js';
import { MarketplaceActionError } from '../../../../packages/persistence/src/marketplace-social.js';
import { MarketplaceAssetError } from '../../../../packages/persistence/src/marketplace-assets.js';
import { ContractValidationError } from '../../../../packages/contracts/src/contract-values.js';
import { InputObjectValidationError } from '../../../../packages/application/src/input-object-validation.js';

const id=z.uuid();
const preflight=z.strictObject({capabilityId:id,mode:z.enum(['IMMEDIATE_ONLY','EARLIEST_AVAILABLE']),
  quoteId:id,expectedVersionId:id,latestAcceptableStartAt:z.iso.datetime().optional(),payload:z.unknown()});
const purchase=z.strictObject({quoteId:id,jobId:id,reservationId:id,manifestId:id,
  payload:z.unknown()});
const favorite=z.strictObject({capabilityId:id,favorite:z.boolean()});
const review=z.strictObject({id,jobId:id,rating:z.number().int().min(1).max(5),
  text:z.string().max(1200)});
const reviewEdit=z.strictObject({reviewId:id,expectedRevision:z.number().int().positive(),
  rating:z.number().int().min(1).max(5),text:z.string().max(1200)});
const cancel=z.strictObject({jobId:id,requestId:id});
const problem=z.strictObject({id,jobId:id,category:z.enum([
  'MISSING_OUTPUT','CORRUPT_FILE','QUALITY','OTHER']),description:z.string().min(10).max(2000)});
const uploadBegin=z.strictObject({capabilityId:id,fieldKey:z.string().min(1).max(64),
  fileName:z.string().min(1).max(128),sizeBytes:z.number().int().nonnegative(),
  sha256:z.string(),contentType:z.string().min(3).max(120)});
const uploadFinalize=z.strictObject({assetId:id,capabilityId:id,
  fieldKey:z.string().min(1).max(64)});
const credit=z.strictObject({purchaseId:id,amountMinor:z.number().int().min(100).max(100_000)});
const terms=z.strictObject({acceptanceId:id,version:z.literal(1),accepted:z.literal(true)});

function json(value:unknown,status=200):Response{
  return Response.json(value,{status,headers:{'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'}});
}
async function boundedJson(request:Request):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    throw new TypeError('INVALID_CONTENT_TYPE');
  const reader=request.body?.getReader();if(!reader)throw new TypeError('EMPTY_BODY');
  const chunks:Uint8Array[]=[];let size=0;
  try {for(;;){const item=await reader.read();if(item.done)break;
    size+=item.value.byteLength;if(size>1_048_576)throw new TypeError('BODY_TOO_LARGE');
    chunks.push(item.value);}}
  finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
function exactOrigin(request:Request):boolean{
  const origin=process.env.APP_ORIGIN;
  return !!origin&&request.headers.get('origin')===new URL(origin).origin;
}
function searchOptions(url:URL):unknown{
  const p=url.searchParams;
  return {query:p.get('q')??'',...(p.has('category')?{category:p.get('category')}:{}),
    ...(p.has('minimumPriceMinor')?{minimumPriceMinor:Number(p.get('minimumPriceMinor'))}:{}),
    ...(p.has('maximumPriceMinor')?{maximumPriceMinor:Number(p.get('maximumPriceMinor'))}:{}),
    ...(p.has('minimumRating')?{minimumRating:Number(p.get('minimumRating'))}:{}),
    ...(p.has('maximumRuntimeSeconds')?{maximumRuntimeSeconds:Number(p.get('maximumRuntimeSeconds'))}:{}),
    ...(p.has('outputType')?{outputType:p.get('outputType')}:{}),
    ...(p.has('sort')?{sort:p.get('sort')}:{}),
    onlineNow:p.get('onlineNow')==='true',
    ...(p.has('limit')?{limit:Number(p.get('limit'))}:{}),
    ...(p.has('offset')?{offset:Number(p.get('offset'))}:{}),
  };
}
/** Session identity is the only buyer identity accepted by this HTTP boundary. */
export async function handleMarketplaceRequest(request:Request,path:readonly string[],auth:AuthService):Promise<Response>{
  const method=request.method,url=new URL(request.url),key=path.join('/');
  if(method!=='GET'&&method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  if(method!=='GET'&&!exactOrigin(request))return json({code:'ORIGIN_DENIED'},403);
  try {
    const session=await auth.auth.api.getSession({headers:request.headers});
    const buyerId=session?.user.id??null;
    const app=getMarketplaceService();
    if(method==='GET'){
      if(key==='search')return json({items:await app.catalog.search(
        MarketplaceSearchSchema.parse(searchOptions(url)),buyerId)});
      if(key==='categories')return json({categories:await app.catalog.categories()});
      if(path[0]==='capability'&&path.length===2){
        const detail=await app.catalog.detail(path[1]!,buyerId);
        return detail?json({detail}):json({code:'NOT_FOUND'},404);
      }
      if(path[0]==='seller'&&path.length===2){
        const profile=await app.catalog.sellerPublicProfile(path[1]!);
        return profile?json({profile}):json({code:'NOT_FOUND'},404);
      }
      if(path[0]==='example-asset'&&path.length===2){
        const asset=await app.social.publicExampleAsset(path[1]!,buyerId);
        if(!asset)return json({code:'NOT_FOUND'},404);
        const stream=await app.getStorage().readPrivateObject(asset.objectKey);
        const iterator=stream[Symbol.asyncIterator]();
        const body=new ReadableStream<Uint8Array>({async pull(controller){
          const item=await iterator.next();if(item.done)controller.close();
          else controller.enqueue(item.value);},async cancel(){await iterator.return?.();}});
        const preview=url.searchParams.get('preview')==='1'&&
          /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|audio\/(mpeg|wav|ogg)|application\/pdf)$/.test(asset.mimeType);
        return new Response(body,{headers:{'Content-Type':asset.mimeType,
          'Content-Disposition':`${preview?'inline':'attachment'}; filename="kivro-example-${path[1]}"`,
          'Content-Security-Policy':"default-src 'none'; sandbox",
          'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
      }
      if(!buyerId)return json({code:'UNAUTHENTICATED'},401);
      if(key==='favorites'||key==='favorite-cards'){
        const page=z.coerce.number().int().min(1).max(12_500).parse(url.searchParams.get('page')??'1');
        const ids=await app.social.favorites(buyerId,80,(page-1)*80);
        const total=await app.social.favoritesCount(buyerId);
        return key==='favorites'?json({ids,total}):
          json({items:await app.catalog.listedCards(ids,buyerId),total});
      }
      if(key==='history'){
        const page=z.coerce.number().int().min(1).max(12_500).parse(url.searchParams.get('page')??'1');
        return json({jobs:await app.getBuyer().history(buyerId,80,null,(page-1)*80),
          total:await app.getBuyer().historyCount(buyerId)});
      }
      if(key==='recent')return json({ids:await app.getBuyer().recentlyUsed(buyerId)});
      if(key==='recent-cards')return json({items:await app.catalog.listedCards(
        await app.getBuyer().recentlyUsed(buyerId),buyerId)});
      if(key==='balance')return json({balance:await app.finance.buyerBalance(buyerId)});
      if(key==='terms')return json({accepted:await app.getBuyer().termsStatus(buyerId),version:1});
      if(key==='credit-purchases')return json({purchases:await app.getBuyer().creditPurchases(buyerId)});
      if(key==='stripe-config'){
        const mode=process.env.KIVRO_STRIPE_MODE;
        const publishableKey=process.env.STRIPE_PUBLISHABLE_KEY;
        if(!publishableKey||!publishableKey.startsWith(mode==='live'?'pk_live_':'pk_test_'))
          throw new Error('Stripe browser configuration unavailable');
        return json({publishableKey});
      }
      if(path[0]==='job'&&path.length===2)return json({job:await app.getBuyer().job(buyerId,path[1]!)});
      if(path[0]==='asset'&&path.length===2){
        const asset=await app.getBuyer().ownedOutputAsset(buyerId,path[1]!);
        if(!asset)return json({code:'NOT_FOUND'},404);
        const stream=await app.getStorage().readPrivateObject(asset.objectKey);
        const iterator=stream[Symbol.asyncIterator]();
        const body=new ReadableStream<Uint8Array>({async pull(controller){
          const item=await iterator.next();if(item.done)controller.close();
          else controller.enqueue(item.value);},async cancel(){await iterator.return?.();}});
        const preview=url.searchParams.get('preview')==='1'&&
          /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|audio\/(mpeg|wav|ogg)|application\/pdf)$/.test(asset.mimeType);
        return new Response(body,{headers:{'Content-Type':asset.mimeType,
          'Content-Length':String(asset.sizeBytes),'Content-Disposition':
            `${preview?'inline':'attachment'}; filename="kivro-result-${path[1]}"`,
          'Content-Security-Policy':"default-src 'none'; sandbox",
          'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
      }
      if(path[0]==='credit-secret'&&path.length===2){
        const finance=getFinanceService();
        return json({clientSecret:await finance.repository.creditPurchaseClientSecret(
          buyerId,path[1]!,finance.gateway)});
      }
      return json({code:'NOT_FOUND'},404);
    }
    if(!buyerId)return json({code:'UNAUTHENTICATED'},401);
    const raw=await boundedJson(request);
    if(key==='preflight'){
      const data=preflight.parse(raw);
      return json(await app.getBuyer().preflight({buyerId,capabilityId:data.capabilityId,
        mode:data.mode,quoteId:data.quoteId,payload:data.payload,
        expectedVersionId:data.expectedVersionId,
        ...(data.latestAcceptableStartAt?{latestAcceptableStartAt:data.latestAcceptableStartAt}:{})}));
    }
    if(key==='purchase')return json(await app.getBuyer().purchase({buyerId,...purchase.parse(raw)}),201);
    if(key==='favorite'){
      const data=favorite.parse(raw);
      await app.social.setFavorite(buyerId,data.capabilityId,data.favorite);
      return json({ok:true});
    }
    if(key==='review'){await app.social.submitReview({buyerId,...review.parse(raw)});return json({ok:true},201);}
    if(key==='review-edit'){
      const revision=await app.social.editReview({buyerId,...reviewEdit.parse(raw)});
      return json({revision});
    }
    if(key==='cancel'){const data=cancel.parse(raw);await app.getBuyer().cancel(buyerId,data.jobId,data.requestId);return json({ok:true});}
    if(key==='problem'){
      await app.getBuyer().reportProblem({buyerId,...problem.parse(raw)});
      return json({ok:true},201);
    }
    if(key==='upload-begin')return json(await app.getAssets().beginDirect(
      {buyerId,...uploadBegin.parse(raw)}),201);
    if(key==='upload-finalize')return json(await app.getAssets().finalizeDirect(
      {buyerId,...uploadFinalize.parse(raw)}));
    if(key==='credit-purchase'){
      const data=credit.parse(raw);await app.finance.beginBuyerBilling(buyerId);
      await app.finance.beginCreditPurchase({buyerId,...data});return json({purchaseId:data.purchaseId},202);
    }
    if(key==='terms'){
      const data=terms.parse(raw);await app.getBuyer().acceptTerms(buyerId,data.acceptanceId);
      return json({accepted:true,version:1});
    }
    return json({code:'NOT_FOUND'},404);
  }catch(error){
    if(error instanceof InputObjectValidationError)return json({code:error.code},409);
    if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError||
      error instanceof ContractValidationError)
      return json({code:'INVALID_INPUT'},400);
    if(error instanceof BuyerMarketplaceError||error instanceof MarketplaceActionError||
      error instanceof MarketplaceAssetError||error instanceof AvailabilityError||
      error instanceof FinanceError||error instanceof JobExecutionError){
      const code=error.code;
      return json({code},code==='NOT_FOUND'?404:
        ['NOT_ELIGIBLE','PAYMENT_NOT_SECURED'].includes(code)?403:409);
    }
    throw error;
  }
}
