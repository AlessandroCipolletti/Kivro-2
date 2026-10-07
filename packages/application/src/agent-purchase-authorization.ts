import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { validateInputPayload } from '../../contracts/src/contract-values.js';
import type { AgentPlan } from '../../contracts/src/marketplace-agent.js';
import { AgentFinalResultSchema } from '../../contracts/src/marketplace-agent.js';
import { CapabilityDiscoveryDocumentSchema,type CapabilityDiscoveryDocument } from
  '../../contracts/src/marketplace.js';
import { rankAgentCandidates } from './marketplace-agent-discovery.js';
import { equivalentSupply } from './marketplace-agent-planner.js';
import type { MarketplaceAgentRepository } from '../../persistence/src/marketplace-agent.js';
import type { MarketplaceCatalog } from '../../persistence/src/marketplace-catalog.js';
import type { MarketplaceBuyerRepository } from '../../persistence/src/marketplace-buyer.js';
import type { PostgresAvailabilityRepository } from '../../persistence/src/availability.js';
import { AvailabilityError } from '../../persistence/src/availability.js';
import { FinanceError } from './finance-policy.js';
import { BuyerMarketplaceError } from '../../persistence/src/marketplace-buyer.js';
import { ContractValidationError } from '../../contracts/src/contract-values.js';

type Step=AgentPlan['steps'][number];
const terminal=new Set(['COMPLETED','REJECTED','EXPIRED','CANCELLED','FAILED_STARTUP',
  'FAILED_POLICY','FAILED_EXECUTION','TIMED_OUT','WORKER_OFFLINE','RESULT_REJECTED']);

export class AgentPurchaseError extends Error {
  constructor(readonly code:'NOT_FOUND'|'NOT_APPROVED'|'STALE_PLAN'|'BUDGET_EXCEEDED'|
    'MISSING_RESULT'|'INVALID_MAPPING') {super(code);this.name='AgentPurchaseError';}
}

type ResultPayload={values:Record<string,unknown>;assets:Record<string,string[]>};
const payloadSchema=z.strictObject({values:z.record(z.string(),z.unknown()),
  assets:z.record(z.string(),z.array(z.uuid()))});

/** All financial effects go through the M08/M09/M10 purchase path. */
export class AgentPurchaseAuthorizationService {
  constructor(private readonly pool:Pool,private readonly repository:MarketplaceAgentRepository,
    private readonly catalog:MarketplaceCatalog,
    private readonly availability:PostgresAvailabilityRepository,
    private readonly buyer:MarketplaceBuyerRepository){}

  private async delivered(client:PoolClient,buyerId:string,jobId:string):Promise<ResultPayload>{
    const row=await client.query<{payload:unknown}>(`SELECT m.payload FROM jobs j
      JOIN job_payment_states payment ON payment.job_id=j.id AND payment.state='SETTLED'
      JOIN job_result_manifests m ON m.job_id=j.id
      WHERE j.id=$1 AND j.buyer_account_id=$2 AND j.status='COMPLETED'`,
    [jobId,buyerId]);
    if(!row.rows[0])throw new AgentPurchaseError('MISSING_RESULT');
    return payloadSchema.parse(row.rows[0].payload);
  }

  private async mappedPayload(client:PoolClient,plan:AgentPlan,step:Step):Promise<{
    payload:ResultPayload;links:readonly {sourceStepId:string;sourceJobId:string;
      assetId:string;sourceOutputKey:string;targetInputKey:string}[]} >{
    const values={...step.inputValues};
    const assets:Record<string,string[]>={...step.inputAssets};
    const links=[];
    for(const mapping of step.mappings){
      const source=plan.steps.find((item)=>item.id===mapping.sourceStepId);
      if(!source||!step.dependsOn.includes(source.id))throw new AgentPurchaseError('INVALID_MAPPING');
      const result=await this.delivered(client,plan.buyerId,source.jobId);
      if(Object.hasOwn(result.values,mapping.sourceOutputKey)){
        if(Object.hasOwn(values,mapping.targetInputKey)||Object.hasOwn(assets,mapping.targetInputKey))
          throw new AgentPurchaseError('INVALID_MAPPING');
        values[mapping.targetInputKey]=result.values[mapping.sourceOutputKey];
      }else if(Object.hasOwn(result.assets,mapping.sourceOutputKey)){
        if(Object.hasOwn(values,mapping.targetInputKey)||
          Object.hasOwn(step.inputAssets,mapping.targetInputKey))
          throw new AgentPurchaseError('INVALID_MAPPING');
        const ids=result.assets[mapping.sourceOutputKey]!;
        assets[mapping.targetInputKey]=[...(assets[mapping.targetInputKey]??[]),...ids];
        for(const assetId of ids){
          const valid=await client.query(`SELECT 1 FROM assets a
            JOIN job_result_assets ra ON ra.asset_id=a.id AND ra.field_key=$4
            JOIN job_result_manifests m ON m.id=ra.manifest_id AND m.job_id=$2
            WHERE a.id=$1 AND a.owner_account_id=$3 AND a.state='READY'
              AND a.retain_until>now() AND a.source_job_id=$2`,
          [assetId,source.jobId,plan.buyerId,mapping.sourceOutputKey]);
          if(!valid.rows[0])throw new AgentPurchaseError('INVALID_MAPPING');
          links.push({sourceStepId:source.id,sourceJobId:source.jobId,assetId,
            sourceOutputKey:mapping.sourceOutputKey,targetInputKey:mapping.targetInputKey});
        }
      }else throw new AgentPurchaseError('MISSING_RESULT');
    }
    return {payload:{values,assets},links};
  }

  private async currentDocuments(plan:AgentPlan):Promise<readonly CapabilityDiscoveryDocument[]>{
    const docs=(await Promise.all([...new Set(plan.steps.filter((step)=>
      step.status==='PLANNED'||step.status==='READY').map((step)=>step.capabilityId))]
      .map((capabilityId)=>this.catalog.discoveryDocument(capabilityId))))
      .filter((doc):doc is NonNullable<typeof doc>=>doc!==null);
    return docs;
  }

  /** Buyer-visible substitutions are proposed before a new explicit approval. */
  async pausedAlternatives(buyerId:string,planId:string):Promise<readonly {
    stepId:string;options:readonly {capabilityId:string;name:string;slug:string;
      priceMinor:number;availability:string}[]}[]>{
    const plan=await this.repository.plan(buyerId,planId);
    if(!plan)throw new AgentPurchaseError('NOT_FOUND');
    if(plan.status!=='AWAITING_REAPPROVAL')throw new AgentPurchaseError('NOT_APPROVED');
    const rows=await this.pool.query<{id:string;document_snapshot:unknown}>(`
      SELECT id,document_snapshot FROM orchestration_steps WHERE plan_id=$1`,[planId]);
    const prior=new Map(rows.rows.map((row)=>[row.id,
      CapabilityDiscoveryDocumentSchema.parse(row.document_snapshot)] as const));
    const cards=[];
    for(let page=0;page<6;page++){
      const batch=await this.catalog.search({query:'',limit:48,offset:page*48});
      cards.push(...batch);if(batch.length<48)break;
    }
    const docs=(await Promise.all(cards.map((card)=>this.catalog.discoveryDocument(card.id))))
      .filter((doc):doc is NonNullable<typeof doc>=>doc!==null);
    return plan.steps.filter((step)=>['PLANNED','READY','AWAITING_REAPPROVAL']
      .includes(step.status)).map((step)=>{
        const old=prior.get(step.id);
        if(!old)throw new AgentPurchaseError('STALE_PLAN');
        return {stepId:step.id,options:docs.filter((doc)=>
          (doc.capabilityId===old.capabilityId||equivalentSupply(old,doc))&&
          rankAgentCandidates([doc],{...plan.constraints,outputTypes:[],
            requiredInputTypes:[]},'EXECUTE',plan.goal,1).length>0)
          .map((doc)=>({capabilityId:doc.capabilityId,name:doc.name,slug:doc.slug,
            priceMinor:doc.priceMinor,availability:doc.availability.status}))};
      });
  }

  async revisePaused(buyerId:string,planId:string,
    choices:readonly {stepId:string;capabilityId:string}[]):Promise<AgentPlan>{
    const plan=await this.repository.plan(buyerId,planId);
    if(!plan)throw new AgentPurchaseError('NOT_FOUND');
    if(plan.status!=='AWAITING_REAPPROVAL')throw new AgentPurchaseError('NOT_APPROVED');
    const options=await this.pausedAlternatives(buyerId,planId);
    const allowed=new Map(options.map((item)=>[item.stepId,
      new Set(item.options.map((option)=>option.capabilityId))] as const));
    if(choices.length!==options.length||
      new Set(choices.map((choice)=>choice.stepId)).size!==choices.length||
      choices.some((choice)=>!allowed.get(choice.stepId)?.has(choice.capabilityId)))
      throw new AgentPurchaseError('STALE_PLAN');
    const changes=[];
    for(const choice of choices){
      const doc=await this.catalog.discoveryDocument(choice.capabilityId);
      if(!doc)throw new AgentPurchaseError('STALE_PLAN');
      const quote=await this.availability.quote({id:randomUUID(),buyerAccountId:buyerId,
        capabilityId:choice.capabilityId,
        executionMode:plan.constraints.timing.mode==='IMMEDIATE'?
          'IMMEDIATE_ONLY':'EARLIEST_AVAILABLE',
        ...(plan.constraints.timing.mode==='DEADLINE'?
          {latestAcceptableStartAt:plan.constraints.timing.deadlineAt}:{})});
      if(Date.parse(quote.earliestEligibleAt)-Date.now()>
        plan.constraints.timing.maxQueueWaitSeconds*1000||
        (plan.constraints.timing.mode==='DEADLINE'&&(
          doc.typicalRuntimeSeconds===null||
          Date.parse(quote.earliestEligibleAt)+doc.typicalRuntimeSeconds*1000>
            Date.parse(plan.constraints.timing.deadlineAt))))
        throw new AgentPurchaseError('STALE_PLAN');
      changes.push({stepId:choice.stepId,document:doc,quote});
    }
    return this.repository.revisePausedPlan(buyerId,planId,changes);
  }

  private async revalidatePlan(plan:AgentPlan):Promise<readonly CapabilityDiscoveryDocument[]>{
    const docs=await this.currentDocuments(plan);
    for(const step of plan.steps.filter((item)=>item.status==='PLANNED'||item.status==='READY')){
      const doc=docs.find((item)=>item.capabilityId===step.capabilityId);
      if(!doc||doc.capabilityVersionId!==step.capabilityVersionId||
        doc.priceMinor!==step.quotedPriceMinor||
        !rankAgentCandidates([doc],{...plan.constraints,outputTypes:[],
          requiredInputTypes:[]},'EXECUTE',plan.goal,1).length)
        throw new AgentPurchaseError('STALE_PLAN');
    }
    return docs;
  }

  private async financialCeiling(client:PoolClient,plan:AgentPlan,step:Step,
    currentPriceMinor:number):Promise<void>{
    const approval=await client.query<{maximum_authorized_minor:string}>(`
      SELECT maximum_authorized_minor FROM orchestration_approvals
      WHERE plan_id=$1 AND buyer_account_id=$2 AND plan_revision=(
        SELECT revision FROM orchestration_plans WHERE id=$1)
      LIMIT 1`,
    [plan.id,plan.buyerId]);
    if(!approval.rows[0]||!plan.approvedAt)throw new AgentPurchaseError('NOT_APPROVED');
    const ceiling=Number(approval.rows[0].maximum_authorized_minor);
    if(currentPriceMinor!==step.quotedPriceMinor||
      currentPriceMinor>(plan.constraints.maxPerJobSpendMinor??Infinity))
      throw new AgentPurchaseError('STALE_PLAN');
    const booked=await client.query<{job_id:string;buyer_total_minor:string;state:string}>(`
      SELECT s.job_id,f.buyer_total_minor,p.state FROM orchestration_steps s
      JOIN job_financial_snapshots f ON f.job_id=s.job_id
      JOIN job_payment_states p ON p.job_id=s.job_id
      WHERE s.plan_id=$1 AND p.state IN ('RESERVED','SETTLED')`,[plan.id]);
    const counted=new Set(booked.rows.map((row)=>row.job_id));
    const secured=booked.rows.reduce((sum,row)=>sum+Number(row.buyer_total_minor),0);
    const pending=plan.steps.filter((item)=>!counted.has(item.jobId))
      .reduce((sum,item)=>sum+item.quotedPriceMinor,0);
    if(!Number.isSafeInteger(secured+pending)||secured+pending>ceiling||
      secured+pending>plan.maxBudgetMinor)
      throw new AgentPurchaseError('BUDGET_EXCEEDED');
  }

  /** Serializes all steps of one approved plan while M08 serializes buyer credits. */
  async advanceOne(buyerId:string,planId:string):Promise<'PURCHASED'|'WAITING'|
    'COMPLETED'|'FAILED'|'PAUSED'> {
    z.uuid().parse(buyerId);z.uuid().parse(planId);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const locked=await client.query<{status:string}>(`SELECT status FROM orchestration_plans
        WHERE id=$1 AND buyer_account_id=$2 FOR UPDATE`,[planId,buyerId]);
      if(!locked.rows[0])throw new AgentPurchaseError('NOT_FOUND');
      if(locked.rows[0].status!=='RUNNING'){
        await client.query('COMMIT');return locked.rows[0].status==='COMPLETED'?'COMPLETED':'PAUSED';
      }
      let plan=await this.repository.plan(buyerId,planId,client);
      if(!plan)throw new AgentPurchaseError('NOT_FOUND');
      // The job and payment tables, never Worker messages or step convenience
      // fields, determine paid completion and failure.
      for(const step of plan.steps){
        const status=await client.query<{status:string;payment_state:string|null}>(`
          SELECT j.status,p.state AS payment_state FROM jobs j
          LEFT JOIN job_payment_states p ON p.job_id=j.id
          WHERE j.id=$1 AND j.buyer_account_id=$2`,[step.jobId,buyerId]);
        const job=status.rows[0];if(!job)continue;
        const target=job.status==='COMPLETED'&&job.payment_state==='SETTLED'?'COMPLETED':
          terminal.has(job.status)&&job.status!=='COMPLETED'?'FAILED':
          job.payment_state==='RESERVED'?'RUNNING':null;
        if(target&&step.status!==target){
          await client.query(`UPDATE orchestration_steps SET status=$2,updated_at=now()
            WHERE id=$1`,[step.id,target]);
        }
      }
      plan=(await this.repository.plan(buyerId,planId,client))!;
      if(plan.steps.some((step)=>step.status==='FAILED')){
        await client.query(`UPDATE orchestration_steps SET status='SKIPPED',updated_at=now()
          WHERE plan_id=$1 AND status IN ('PLANNED','READY')`,[planId]);
        await client.query(`UPDATE orchestration_plans SET status='FAILED',updated_at=now()
          WHERE id=$1`,[planId]);
        await client.query('COMMIT');return 'FAILED';
      }
      if(plan.steps.every((step)=>step.status==='COMPLETED')){
        const jobs=await client.query<{step_id:string;id:string;buyer_total_minor:string}>(`
          SELECT s.id AS step_id,j.id,f.buyer_total_minor FROM orchestration_steps s
          JOIN jobs j ON j.id=s.job_id AND j.status='COMPLETED'
          JOIN job_payment_states p ON p.job_id=j.id AND p.state='SETTLED'
          JOIN job_financial_snapshots f ON f.job_id=j.id
          WHERE s.plan_id=$1 ORDER BY s.position`,[planId]);
        if(jobs.rows.length!==plan.steps.length)throw new AgentPurchaseError('MISSING_RESULT');
        const finalResult=AgentFinalResultSchema.parse({kind:'PROVENANCE_SUMMARY',
          note:'Each result was produced by the listed paid marketplace service.',
          jobs:jobs.rows.map((row)=>({stepId:row.step_id,jobId:row.id,
            priceMinor:Number(row.buyer_total_minor)})),
          finalJobIds:plan.steps.filter((step)=>!plan.steps.some((next)=>
            next.dependsOn.includes(step.id))).map((step)=>step.jobId),
          spentMinor:jobs.rows.reduce((sum,row)=>sum+Number(row.buyer_total_minor),0),
          unusedAuthorizationMinor:plan.maxBudgetMinor-
            jobs.rows.reduce((sum,row)=>sum+Number(row.buyer_total_minor),0),
          completedAt:new Date().toISOString()});
        await client.query(`UPDATE orchestration_plans SET status='COMPLETED',
          final_result=$2,updated_at=now() WHERE id=$1`,[planId,finalResult]);
        await client.query('COMMIT');return 'COMPLETED';
      }
      const ready=plan.steps.find((step)=>step.status==='PLANNED'&&
        step.dependsOn.every((dependency)=>plan!.steps.find((source)=>source.id===dependency)?.status==='COMPLETED'));
      if(!ready){await client.query('COMMIT');return 'WAITING';}
      let docs:readonly CapabilityDiscoveryDocument[];
      try{docs=await this.revalidatePlan(plan);}catch(error){
        if(!(error instanceof AgentPurchaseError)||error.code!=='STALE_PLAN')throw error;
        await client.query(`UPDATE orchestration_plans SET status='AWAITING_REAPPROVAL',
          updated_at=now() WHERE id=$1`,[planId]);
        await client.query(`UPDATE orchestration_steps SET status='AWAITING_REAPPROVAL'
          WHERE id=$1`,[ready.id]);
        await client.query('COMMIT');return 'PAUSED';
      }
      const doc=docs.find((item)=>item.capabilityId===ready.capabilityId);
      if(!doc)throw new AgentPurchaseError('STALE_PLAN');
      let mapped:Awaited<ReturnType<typeof this.mappedPayload>>;
      try{
        mapped=await this.mappedPayload(client,plan,ready);
        validateInputPayload(doc.ioContract.input,mapped.payload);
      }catch(error){
        if(!(error instanceof AgentPurchaseError)&&
          !(error instanceof ContractValidationError))throw error;
        await client.query(`UPDATE orchestration_steps SET status='FAILED',updated_at=now()
          WHERE id=$1`,[ready.id]);
        await client.query(`UPDATE orchestration_steps SET status='SKIPPED',updated_at=now()
          WHERE plan_id=$1 AND status IN ('PLANNED','READY')`,[planId]);
        await client.query(`UPDATE orchestration_plans SET status='FAILED',updated_at=now()
          WHERE id=$1`,[planId]);
        await client.query('COMMIT');return 'FAILED';
      }
      const prior=await client.query<{status:string;payment_state:string|null}>(`
        SELECT j.status,p.state AS payment_state FROM jobs j
        LEFT JOIN job_payment_states p ON p.job_id=j.id
        WHERE j.id=$1 AND j.buyer_account_id=$2`,[ready.jobId,buyerId]);
      if(prior.rows[0]?.payment_state==='RESERVED'||prior.rows[0]?.payment_state==='SETTLED'){
        await this.auditLinks(client,plan,ready,mapped.links);
        await client.query(`UPDATE orchestration_steps SET status='RUNNING',updated_at=now()
          WHERE id=$1`,[ready.id]);
        await client.query('COMMIT');return 'WAITING';
      }
      const mode=plan.constraints.timing.mode==='IMMEDIATE'?'IMMEDIATE_ONLY':'EARLIEST_AVAILABLE';
      let quote;
      try{quote=await this.availability.quote({id:randomUUID(),buyerAccountId:buyerId,
        capabilityId:ready.capabilityId,executionMode:mode,
        ...(plan.constraints.timing.mode==='DEADLINE'?
          {latestAcceptableStartAt:plan.constraints.timing.deadlineAt}:{})});}
      catch(error){
        if(!(error instanceof AvailabilityError))throw error;
        await client.query(`UPDATE orchestration_plans SET status='AWAITING_REAPPROVAL',
          updated_at=now() WHERE id=$1`,[planId]);
        await client.query(`UPDATE orchestration_steps SET status='AWAITING_REAPPROVAL'
          WHERE id=$1`,[ready.id]);
        await client.query('COMMIT');return 'PAUSED';
      }
      if(quote.capabilityVersionId!==ready.capabilityVersionId ||
        quote.price.buyerAmountMinor!==ready.quotedPriceMinor||
        Date.parse(quote.earliestEligibleAt)-Date.now()>
          plan.constraints.timing.maxQueueWaitSeconds*1000||
        (plan.constraints.timing.mode==='DEADLINE'&&(
          doc.typicalRuntimeSeconds===null||
          Date.parse(quote.earliestEligibleAt)+doc.typicalRuntimeSeconds*1000>
            Date.parse(plan.constraints.timing.deadlineAt)))){
        await client.query(`UPDATE orchestration_plans SET status='AWAITING_REAPPROVAL',
          updated_at=now() WHERE id=$1`,[planId]);
        await client.query(`UPDATE orchestration_steps SET status='AWAITING_REAPPROVAL'
          WHERE id=$1`,[ready.id]);
        await client.query('COMMIT');return 'PAUSED';
      }
      await this.financialCeiling(client,plan,ready,quote.price.buyerAmountMinor);
      // Do not create the execution_quote_id foreign-key reference yet. Its
      // KEY SHARE lock would block M10 purchase's FOR UPDATE on that quote
      // from the second connection while this plan transaction remains open.
      await client.query(`UPDATE orchestration_steps SET status='PURCHASING',
        updated_at=now() WHERE id=$1`,[ready.id]);
      try{
        await this.buyer.purchase({buyerId,quoteId:quote.id,jobId:ready.jobId,
          reservationId:ready.reservationId,manifestId:ready.manifestId,payload:mapped.payload});
      }catch(error){
        const actual=await client.query<{state:string}>(`SELECT p.state FROM job_payment_states p
          JOIN jobs j ON j.id=p.job_id WHERE j.id=$1 AND j.buyer_account_id=$2`,
        [ready.jobId,buyerId]);
        if(!['RESERVED','SETTLED'].includes(actual.rows[0]?.state??'')){
          if((error instanceof FinanceError&&['INSUFFICIENT_CREDITS',
            'STRIPE_NOT_READY','NOT_ELIGIBLE'].includes(error.code))||
            error instanceof AvailabilityError||error instanceof BuyerMarketplaceError||
            error instanceof ContractValidationError){
            await client.query(`UPDATE orchestration_plans SET status='AWAITING_REAPPROVAL',
              updated_at=now() WHERE id=$1`,[planId]);
            await client.query(`UPDATE orchestration_steps SET status='AWAITING_REAPPROVAL'
              WHERE id=$1`,[ready.id]);
            await client.query('COMMIT');return 'PAUSED';
          }
          throw error;
        }
      }
      await this.auditLinks(client,plan,ready,mapped.links);
      await client.query(`UPDATE orchestration_steps SET execution_quote_id=$2,
        status='RUNNING',updated_at=now() WHERE id=$1`,[ready.id,quote.id]);
      await client.query('UPDATE orchestration_plans SET updated_at=now() WHERE id=$1',[planId]);
      await client.query('COMMIT');return 'PURCHASED';
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  private async auditLinks(client:PoolClient,plan:AgentPlan,target:Step,
    links:readonly {sourceStepId:string;sourceJobId:string;assetId:string;
      sourceOutputKey:string;targetInputKey:string}[]):Promise<void>{
    for(const link of links){
      const grant=await client.query<{id:string}>(`SELECT id FROM asset_read_grants
        WHERE asset_id=$1 AND target_job_id=$2 AND revoked_at IS NULL AND expires_at>now()`,
      [link.assetId,target.jobId]);
      if(!grant.rows[0])throw new AgentPurchaseError('INVALID_MAPPING');
      await client.query(`INSERT INTO orchestration_asset_links(id,plan_id,source_step_id,
        target_step_id,source_job_id,target_job_id,asset_id,grant_id,source_output_key,
        target_input_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT(plan_id,source_step_id,target_step_id,asset_id,target_input_key) DO NOTHING`,
      [randomUUID(),plan.id,link.sourceStepId,target.id,link.sourceJobId,target.jobId,
        link.assetId,grant.rows[0].id,link.sourceOutputKey,link.targetInputKey]);
    }
  }

  async advance(buyerId:string,planId:string):Promise<'WAITING'|'COMPLETED'|'FAILED'|'PAUSED'>{
    for(let attempt=0;attempt<16;attempt++){
      const result=await this.advanceOne(buyerId,planId);
      if(result!=='PURCHASED')return result;
    }
    return 'WAITING';
  }

  async reconcile(limit=50):Promise<{processed:number;errors:number}>{
    const active=await this.repository.listActive(limit);
    let errors=0;
    for(const plan of active){
      try{
        const status=await this.repository.plan(plan.buyerId,plan.planId);
        if(status?.status==='CANCELLING')await this.finishCancellation(plan.buyerId,plan.planId);
        else await this.advance(plan.buyerId,plan.planId);
      }catch{errors++;}
    }
    return {processed:active.length,errors};
  }

  async cancel(buyerId:string,planId:string):Promise<void>{
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const row=await client.query<{status:string}>(`SELECT status FROM orchestration_plans
        WHERE id=$1 AND buyer_account_id=$2 FOR UPDATE`,[planId,buyerId]);
      if(!row.rows[0])throw new AgentPurchaseError('NOT_FOUND');
      if(row.rows[0].status==='CANCELLED'){await client.query('COMMIT');return;}
      if(!['RUNNING','AWAITING_APPROVAL','AWAITING_REAPPROVAL'].includes(row.rows[0].status))
        {if(row.rows[0].status!=='CANCELLING')throw new AgentPurchaseError('NOT_APPROVED');}
      await client.query(`UPDATE orchestration_plans SET status='CANCELLING',updated_at=now()
        WHERE id=$1`,[planId]);
      await client.query(`UPDATE orchestration_steps SET status='SKIPPED',updated_at=now()
        WHERE plan_id=$1 AND status IN ('PLANNED','READY','AWAITING_REAPPROVAL')`,[planId]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    await this.finishCancellation(buyerId,planId);
  }

  private stableCancelId(planId:string,jobId:string):string{
    const hex=createHash('sha256').update(`agent-cancel:${planId}:${jobId}`).digest('hex');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
  }

  private async finishCancellation(buyerId:string,planId:string):Promise<void>{
    const rows=await this.pool.query<{job_id:string;status:string;
      payment_state:string|null;scheduled:boolean}>(`
      SELECT j.id AS job_id,j.status,payment.state AS payment_state,
        EXISTS(SELECT 1 FROM job_schedule_plans schedule WHERE schedule.job_id=j.id) AS scheduled
      FROM orchestration_steps s
      JOIN jobs j ON j.id=s.job_id JOIN orchestration_plans p ON p.id=s.plan_id
      LEFT JOIN job_payment_states payment ON payment.job_id=j.id
      WHERE p.id=$1 AND p.buyer_account_id=$2 AND p.status='CANCELLING'`,[planId,buyerId]);
    for(const row of rows.rows){
      if(terminal.has(row.status))continue;
      if(row.status==='CREATED'&&!row.scheduled&&!row.payment_state)continue;
      try{await this.buyer.cancel(buyerId,row.job_id,
        this.stableCancelId(planId,row.job_id));}
      catch(error){
        // Running work may finish and settle; a transient database or network
        // failure must leave CANCELLING durable for the next reconciliation.
        if(error instanceof FinanceError&&error.code==='NOT_ELIGIBLE')continue;
        throw error;
      }
    }
    await this.pool.query(`UPDATE orchestration_plans SET status='CANCELLED',updated_at=now()
      WHERE id=$1 AND buyer_account_id=$2 AND status='CANCELLING'`,[planId,buyerId]);
  }
}
