import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { MarketplaceCatalog } from '../../persistence/src/marketplace-catalog.js';
import type { MarketplaceBuyerRepository } from '../../persistence/src/marketplace-buyer.js';
import type { MarketplaceAgentRepository } from '../../persistence/src/marketplace-agent.js';
import type { PostgresAvailabilityRepository } from '../../persistence/src/availability.js';
import { BuyerAgentConstraintsSchema } from '../../contracts/src/marketplace-agent.js';
import type { PlatformToolDefinition } from '../../infrastructure/contracts/src/platform-inference-ports.js';
import { validateAgentPlan } from '../../domain/src/agent-plan.js';
import { rankAgentCandidates } from './marketplace-agent-discovery.js';
import { PlatformToolExecutor } from './platform-tools.js';
import type { MarketplaceAgentPlanner } from './marketplace-agent-planner.js';
import type { MarketplaceAgentDiscoveryService } from './marketplace-agent.js';

const id=z.uuid();
const byId=z.strictObject({id});
const search=z.strictObject({query:z.string().trim().max(160),
  constraints:BuyerAgentConstraintsSchema,mode:z.enum(['RECOMMEND','EXECUTE']),
  limit:z.number().int().min(1).max(8)});
const quote=z.strictObject({capabilityId:id,mode:z.enum(['IMMEDIATE_ONLY','EARLIEST_AVAILABLE']),
  latestAcceptableStartAt:z.iso.datetime().optional()});
const draft=z.strictObject({conversationId:id,capabilityId:id,request:z.string().min(1).max(4000),
  ownedAssetIds:z.array(id).max(50)});
const plan=z.strictObject({conversationId:id,goal:z.string().min(10).max(2000),
  constraints:BuyerAgentConstraintsSchema,candidateIds:z.array(id).min(1).max(8),
  ownedAssetIds:z.array(id).max(50)});
const job=z.strictObject({jobId:id});
const planId=z.strictObject({planId:id});

/** Bound public marketplace and buyer-owned tools. Financial approval is intentionally absent. */
export class MarketplaceAgentTools {
  readonly executor:PlatformToolExecutor;
  readonly providerDefinitions:readonly PlatformToolDefinition[];
  constructor(catalog:MarketplaceCatalog,availability:PostgresAvailabilityRepository,
    buyer:()=>MarketplaceBuyerRepository,repository:MarketplaceAgentRepository,
    discovery:MarketplaceAgentDiscoveryService,planner:MarketplaceAgentPlanner){
    const getPublic=async(capabilityId:string)=>{
      const found=await catalog.discoveryDocument(capabilityId);
      if(!found)throw new Error('NOT_FOUND');
      return found;
    };
    this.executor=new PlatformToolExecutor({
      search_capabilities:{schema:search,execute:async(raw)=>{
        const args=search.parse(raw);const cards=[];
        for(let offset=0;offset<=4_800;offset+=48){
          const batch=await catalog.search({query:args.query,limit:48,offset});
          cards.push(...batch);if(batch.length<48)break;
          if(offset+48>4_800)throw new Error('CATALOG_SCAN_LIMIT');
        }
        const documents=(await Promise.all(cards.map((card)=>catalog.discoveryDocument(card.id))))
          .filter((item):item is NonNullable<typeof item>=>item!==null);
        return rankAgentCandidates(documents,args.constraints,args.mode,args.query,args.limit)
          .map((item)=>item.document);
      }},
      get_capability:{schema:byId,execute:async(raw)=>getPublic(byId.parse(raw).id)},
      get_capability_version:{schema:byId,execute:async(raw)=>{
        const found=await getPublic(byId.parse(raw).id);
        return {capabilityId:found.capabilityId,capabilityVersionId:found.capabilityVersionId,
          ioContract:found.ioContract,permissionManifest:found.permissionManifest};
      }},
      get_reviews_summary:{schema:byId,execute:async(raw)=>(await getPublic(byId.parse(raw).id)).rating},
      get_availability:{schema:byId,execute:async(raw)=>(await getPublic(byId.parse(raw).id)).availability},
      get_price_quote:{schema:quote,execute:async(raw,buyerId)=>{
        const args=quote.parse(raw);await getPublic(args.capabilityId);
        return availability.quote({id:randomUUID(),buyerAccountId:buyerId,
          capabilityId:args.capabilityId,executionMode:args.mode,
          ...(args.latestAcceptableStartAt?{latestAcceptableStartAt:args.latestAcceptableStartAt}:{})});
      }},
      estimate_job:{schema:quote,execute:async(raw,buyerId)=>{
        const args=quote.parse(raw);await getPublic(args.capabilityId);
        const result=await availability.quote({id:randomUUID(),buyerAccountId:buyerId,
          capabilityId:args.capabilityId,executionMode:args.mode,
          ...(args.latestAcceptableStartAt?{latestAcceptableStartAt:args.latestAcceptableStartAt}:{})});
        return {capabilityVersionId:result.capabilityVersionId,price:result.price,
          earliestEligibleAt:result.earliestEligibleAt,startIsGuaranteed:false,
          quoteExpiresAt:result.quoteExpiresAt};
      }},
      create_job_draft:{schema:draft,execute:async(raw,buyerId)=>{
        const args=draft.parse(raw);
        const prepared=await discovery.prepareDraft({buyerId,...args});
        const draftId=await repository.saveDraft(buyerId,args.conversationId,prepared);
        return {draftId,draft:prepared};
      }},
      create_orchestration_plan:{schema:plan,execute:async(raw,buyerId)=>
        planner.propose({buyerId,...plan.parse(raw)})},
      validate_plan:{schema:planId,execute:async(raw,buyerId)=>{
        const saved=await repository.plan(buyerId,planId.parse(raw).planId);
        if(!saved)throw new Error('NOT_FOUND');
        const docs=(await Promise.all(saved.steps.map((step)=>
          catalog.discoveryDocument(step.capabilityId))))
          .filter((item):item is NonNullable<typeof item>=>item!==null);
        const result=validateAgentPlan(saved,docs);
        return {issues:result.issues,topologicalStepIds:result.topologicalStepIds};
      }},
      get_job_status:{schema:job,execute:async(raw,buyerId)=>{
        const view=await buyer().job(buyerId,job.parse(raw).jobId);
        return view.summary;
      }},
      get_job_result:{schema:job,execute:async(raw,buyerId)=>{
        const view=await buyer().job(buyerId,job.parse(raw).jobId);
        if(view.summary.status!=='COMPLETED'||view.summary.financialState!=='SETTLED')
          throw new Error('NOT_DELIVERED');
        return {jobId:view.summary.id,result:view.result,outputFiles:view.outputFiles};
      }},
    });
    const uuidParameter={type:'object',additionalProperties:false,properties:{
      id:{type:'string'}},required:['id']};
    this.providerDefinitions=[
      {name:'get_capability',description:'Read current public capability metadata by ID.',
        parameters:uuidParameter},
      {name:'get_capability_version',description:'Read current public input/output contract and permissions.',
        parameters:uuidParameter},
      {name:'get_reviews_summary',description:'Read verified review aggregate for a public capability.',
        parameters:uuidParameter},
      {name:'get_availability',description:'Read current authoritative public availability.',
        parameters:uuidParameter},
    ];
  }

  async executeModelCalls(calls:readonly {id:string;name:string;arguments:unknown}[],
    buyerId:string){
    const allowed=new Set(this.providerDefinitions.map((item)=>item.name));
    if(calls.some((item)=>!allowed.has(item.name)))
      throw new Error('UNAUTHORIZED_MODEL_TOOL');
    return this.executor.execute(calls,buyerId);
  }
}
