import { z } from 'zod';
import type { AuthService } from '../auth/server.js';
import { getMarketplaceAgentService } from './server.js';
import { AgentServiceError } from '../../../../packages/application/src/marketplace-agent.js';
import { AgentPurchaseError } from
  '../../../../packages/application/src/agent-purchase-authorization.js';
import { MarketplaceAgentError } from '../../../../packages/persistence/src/marketplace-agent.js';
import { PlatformInferenceError } from
  '../../../../packages/infrastructure/contracts/src/platform-inference-ports.js';
import { AvailabilityError } from '../../../../packages/persistence/src/availability.js';
import { FinanceError } from '../../../../packages/application/src/finance-policy.js';

const id=z.uuid();
const discover=z.strictObject({conversationId:id,messageId:id,
  request:z.string().trim().min(4).max(4000),constraints:z.unknown()});
const draft=z.strictObject({conversationId:id,capabilityId:id,
  request:z.string().trim().min(1).max(4000),ownedAssetIds:z.array(id).max(50)});
const plan=z.strictObject({conversationId:id,goal:z.string().trim().min(10).max(2000),
  constraints:z.unknown(),candidateIds:z.array(id).min(1).max(8),
  ownedAssetIds:z.array(id).max(50)});
const approval=z.strictObject({planId:id,approvalId:id});
const cancellation=z.strictObject({planId:id});
const replanning=z.strictObject({planId:id,choices:z.array(z.strictObject({
  stepId:id,capabilityId:id})).min(1).max(16)});

function json(value:unknown,status=200):Response{return Response.json(value,{status,
  headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
async function boundedJson(request:Request):Promise<unknown>{
  if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')
    throw new TypeError('INVALID_CONTENT_TYPE');
  const reader=request.body?.getReader();if(!reader)throw new TypeError('EMPTY_BODY');
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;
    size+=next.value.byteLength;if(size>128_000)throw new TypeError('BODY_TOO_LARGE');
    chunks.push(next.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
function exactOrigin(request:Request):boolean{
  const origin=process.env.APP_ORIGIN;
  return !!origin&&request.headers.get('origin')===new URL(origin).origin;
}

/** Never accepts buyer identity or financial approval from a model/tool call. */
export async function handleAgentRequest(request:Request,path:readonly string[],
  auth:AuthService):Promise<Response>{
  const key=path.join('/'),method=request.method;
  if(method!=='GET'&&method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  if(method==='POST'&&!exactOrigin(request))return json({code:'ORIGIN_DENIED'},403);
  try{
    const service=getMarketplaceAgentService();
    if(method==='GET'&&key==='health')return json({health:service.inference?
      await service.inference.health():{overall:'UNAVAILABLE',providers:[],tasks:[],
        configurationError:service.configurationError}});
    const session=await auth.auth.api.getSession({headers:request.headers});
    const buyerId=session?.user.id;
    if(!buyerId)return json({code:'UNAUTHENTICATED'},401);
    if(method==='GET'){
      if(key==='conversations')return json({items:await service.repository.listConversations(buyerId)});
      if(key==='plans')return json({items:await service.repository.listPlans(buyerId)});
      if(key==='owned-assets')return json({items:await service.getBuyer().recentOwnedInputAssets(buyerId)});
      if(path[0]==='conversation'&&path.length===2){
        const conversation=await service.repository.conversation(buyerId,path[1]!);
        if(!conversation)return json({code:'NOT_FOUND'},404);
        return json({conversation,messages:await service.repository.messages(buyerId,path[1]!)});
      }
      if(path[0]==='plan'&&path.length===2)return json(await service.repository.planView(
        buyerId,path[1]!));
      if(path[0]==='replan-options'&&path.length===2)
        return json({items:await service.getAuthorizer().pausedAlternatives(buyerId,path[1]!)});
      if(path[0]==='draft'&&path.length===2){
        const found=await service.repository.draft(buyerId,path[1]!);
        return found?json({draft:found}):json({code:'NOT_FOUND'},404);
      }
      return json({code:'NOT_FOUND'},404);
    }
    const raw=await boundedJson(request);
    if(key==='discover')return json(await service.discovery.discover(
      {buyerId,...discover.parse(raw)}));
    if(key==='draft'){
      const input=draft.parse(raw);
      const prepared=await service.discovery.prepareDraft({buyerId,...input});
      const draftId=await service.repository.saveDraft(buyerId,input.conversationId,prepared);
      return json({draftId,draft:prepared});
    }
    if(key==='plan')return json(await service.planner.propose(
      {buyerId,...plan.parse(raw)}),201);
    if(key==='approve'){
      const input=approval.parse(raw);
      const approved=await service.repository.approvePlan(buyerId,input.planId,input.approvalId);
      const progress=await service.getAuthorizer().advance(buyerId,input.planId);
      return json({plan:approved,progress});
    }
    if(key==='cancel'){
      await service.getAuthorizer().cancel(buyerId,cancellation.parse(raw).planId);
      return json({ok:true});
    }
    if(key==='replan'){
      const input=replanning.parse(raw);
      return json({plan:await service.getAuthorizer().revisePaused(
        buyerId,input.planId,input.choices)});
    }
    return json({code:'NOT_FOUND'},404);
  }catch(error){
    if(error instanceof z.ZodError||error instanceof TypeError||error instanceof SyntaxError)
      return json({code:'INVALID_INPUT'},400);
    if(error instanceof AgentServiceError||error instanceof AgentPurchaseError||
      error instanceof MarketplaceAgentError||error instanceof PlatformInferenceError||
      error instanceof AvailabilityError||error instanceof FinanceError){
      const code=error.code;
      return json({code},code==='NOT_FOUND'?404:
        code==='UNAVAILABLE'||code==='PROVIDER_UNAVAILABLE'?503:
          code==='BUDGET_EXCEEDED'||code==='RATE_LIMITED'?429:
            code==='NOT_APPROVED'||code==='NOT_ELIGIBLE'?403:409);
    }
    throw error;
  }
}
