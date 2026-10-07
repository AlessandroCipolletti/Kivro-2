import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AgentPlanSchema, AgentConversationMessageSchema, AgentInputDraftSchema,
  AgentFinalResultSchema,type AgentPlan,type AgentFinalResult } from
  '../../contracts/src/marketplace-agent.js';
import { validateAgentPlan } from '../../domain/src/agent-plan.js';
import type { CapabilityDiscoveryDocument } from '../../contracts/src/marketplace.js';
import { CapabilityDiscoveryDocumentSchema } from '../../contracts/src/marketplace.js';
import type { ScheduleQuote } from '../../contracts/src/availability.js';

const id=z.uuid();
export class MarketplaceAgentError extends Error {
  constructor(readonly code:'NOT_FOUND'|'NOT_ELIGIBLE'|'CONFLICT'|'INVALID_PLAN'|'STALE_PLAN'){
    super(code);this.name='MarketplaceAgentError';
  }
}
type PlanRow={id:string;conversation_id:string;buyer_account_id:string;goal:string;
  constraints_json:unknown;approval_mode:'APPROVE_PLAN';max_budget_minor:string;
  quoted_total_minor:string;status:AgentPlan['status'];approved_at:Date|null;created_at:Date;
  revision:number};
type StepRow={id:string;plan_id:string;capability_id:string;capability_version_id:string;
  name_snapshot:string;slug_snapshot:string;availability_status_at_quote:string;
  earliest_eligible_at:Date;
  planning_quote_id:string;execution_quote_id:string|null;job_id:string;
  reservation_id:string;manifest_id:string;quoted_price_minor:string;
  quote_expires_at:Date;depends_on:string[];input_values:unknown;
  input_assets:unknown;mappings:unknown;status:AgentPlan['steps'][number]['status']};

function parsePlan(row:PlanRow,steps:readonly StepRow[]):AgentPlan{
  return AgentPlanSchema.parse({id:row.id,buyerId:row.buyer_account_id,
    conversationId:row.conversation_id,goal:row.goal,constraints:row.constraints_json,
    approvalMode:row.approval_mode,maxBudgetMinor:Number(row.max_budget_minor),
    quotedTotalMinor:Number(row.quoted_total_minor),status:row.status,
    createdAt:row.created_at.toISOString(),approvedAt:row.approved_at?.toISOString()??null,
    steps:steps.map((step)=>({id:step.id,capabilityId:step.capability_id,
      capabilityVersionId:step.capability_version_id,nameSnapshot:step.name_snapshot,
      slugSnapshot:step.slug_snapshot,availabilityStatusAtQuote:step.availability_status_at_quote,
      earliestEligibleAt:step.earliest_eligible_at.toISOString(),
      quoteId:step.planning_quote_id,
      jobId:step.job_id,reservationId:step.reservation_id,manifestId:step.manifest_id,
      quotedPriceMinor:Number(step.quoted_price_minor),quoteExpiresAt:step.quote_expires_at.toISOString(),
      dependsOn:step.depends_on,inputValues:step.input_values,inputAssets:step.input_assets,
      mappings:step.mappings,status:step.status}))});
}

/** Buyer-owned durable Agent state, entirely separate from seller OpenClaw sessions. */
export class MarketplaceAgentRepository {
  constructor(readonly pool:Pool){}
  async conversation(buyerId:string,conversationId:string):Promise<{id:string;createdAt:string}|null>{
    const result=await this.pool.query<{id:string;created_at:Date}>(
      'SELECT id,created_at FROM marketplace_conversations WHERE id=$1 AND buyer_account_id=$2',
      [id.parse(conversationId),id.parse(buyerId)]);
    return result.rows[0]?{id:result.rows[0].id,
      createdAt:result.rows[0].created_at.toISOString()}:null;
  }
  async createConversation(buyerId:string,conversationId:string):Promise<void>{
    id.parse(buyerId);id.parse(conversationId);
    const result=await this.pool.query<{buyer_account_id:string}>(`
      INSERT INTO marketplace_conversations(id,buyer_account_id) VALUES($1,$2)
      ON CONFLICT(id) DO UPDATE SET id=marketplace_conversations.id
      RETURNING buyer_account_id`,[conversationId,buyerId]);
    if(result.rows[0]?.buyer_account_id!==buyerId)throw new MarketplaceAgentError('CONFLICT');
  }
  async appendMessage(input:{id:string;buyerId:string;conversationId:string;
    role:'BUYER'|'AGENT'|'SYSTEM_NOTICE';body:string;
    references?:readonly {kind:'CAPABILITY'|'JOB'|'PLAN'|'ASSET';id:string}[]}):Promise<void>{
    const message=AgentConversationMessageSchema.parse({id:input.id,role:input.role,
      body:input.body,createdAt:new Date().toISOString(),references:input.references??[]});
    const result=await this.pool.query<{buyer_account_id:string}>(
      'SELECT buyer_account_id FROM marketplace_conversations WHERE id=$1',
      [id.parse(input.conversationId)]);
    if(result.rows[0]?.buyer_account_id!==id.parse(input.buyerId))
      throw new MarketplaceAgentError('NOT_FOUND');
    const inserted=await this.pool.query(`INSERT INTO marketplace_messages(id,conversation_id,buyer_account_id,
      role,body,references_json) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(id) DO NOTHING RETURNING id`,[message.id,input.conversationId,input.buyerId,
      message.role,message.body,JSON.stringify(message.references)]);
    if(!inserted.rows[0]){
      const prior=await this.pool.query<{conversation_id:string;buyer_account_id:string;
        role:string;body:string;references_json:unknown}>(`SELECT conversation_id,
        buyer_account_id,role,body,references_json FROM marketplace_messages WHERE id=$1`,
      [message.id]);
      const row=prior.rows[0];
      if(!row||row.conversation_id!==input.conversationId||
        row.buyer_account_id!==input.buyerId||row.role!==message.role||
        row.body!==message.body||JSON.stringify(row.references_json)!==JSON.stringify(message.references))
        throw new MarketplaceAgentError('CONFLICT');
    }
    await this.pool.query('UPDATE marketplace_conversations SET updated_at=now() WHERE id=$1',
      [input.conversationId]);
  }
  async messages(buyerId:string,conversationId:string):Promise<readonly z.infer<typeof AgentConversationMessageSchema>[]>{
    if(!await this.conversation(buyerId,conversationId))throw new MarketplaceAgentError('NOT_FOUND');
    const result=await this.pool.query<{id:string;role:string;body:string;
      references_json:unknown;created_at:Date}>(`SELECT id,role,body,references_json,created_at
      FROM marketplace_messages WHERE conversation_id=$1 AND buyer_account_id=$2
      ORDER BY created_at,id LIMIT 200`,[conversationId,buyerId]);
    return result.rows.map((row)=>AgentConversationMessageSchema.parse({id:row.id,role:row.role,
      body:row.body,references:row.references_json,createdAt:row.created_at.toISOString()}));
  }
  async listConversations(buyerId:string):Promise<readonly {id:string;createdAt:string;updatedAt:string}[]>{
    const result=await this.pool.query<{id:string;created_at:Date;updated_at:Date}>(`
      SELECT id,created_at,updated_at FROM marketplace_conversations
      WHERE buyer_account_id=$1 ORDER BY updated_at DESC,id DESC LIMIT 50`,[id.parse(buyerId)]);
    return result.rows.map((row)=>({id:row.id,createdAt:row.created_at.toISOString(),
      updatedAt:row.updated_at.toISOString()}));
  }
  async saveDraft(buyerId:string,conversationId:string,rawDraft:unknown):Promise<string>{
    const draft=AgentInputDraftSchema.parse(rawDraft);
    if(!await this.conversation(buyerId,conversationId))throw new MarketplaceAgentError('NOT_FOUND');
    const draftId=randomUUID();
    await this.pool.query(`INSERT INTO marketplace_agent_drafts(id,conversation_id,buyer_account_id,
      capability_id,capability_version_id,values_json,assets_json,missing_field_keys,warnings)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [draftId,conversationId,buyerId,draft.capabilityId,draft.capabilityVersionId,
      draft.values,draft.assets,draft.missingFieldKeys,draft.warnings]);
    return draftId;
  }
  async draft(buyerId:string,draftId:string):Promise<(z.infer<typeof AgentInputDraftSchema> & {
    id:string;expiresAt:string})|null>{
    const result=await this.pool.query<{id:string;capability_id:string;
      capability_version_id:string;values_json:unknown;assets_json:unknown;
      missing_field_keys:string[];warnings:string[];expires_at:Date}>(`
      SELECT id,capability_id,capability_version_id,values_json,assets_json,
        missing_field_keys,warnings,expires_at FROM marketplace_agent_drafts
      WHERE id=$1 AND buyer_account_id=$2 AND expires_at>now()`,
    [id.parse(draftId),id.parse(buyerId)]);
    const row=result.rows[0];
    return row?{...AgentInputDraftSchema.parse({capabilityId:row.capability_id,
      capabilityVersionId:row.capability_version_id,values:row.values_json,
      assets:row.assets_json,missingFieldKeys:row.missing_field_keys,warnings:row.warnings}),
      id:row.id,expiresAt:row.expires_at.toISOString()}:null;
  }
  async plan(buyerId:string,planId:string,client:Pool|PoolClient=this.pool):Promise<AgentPlan|null>{
    const result=await client.query<PlanRow>(`SELECT * FROM orchestration_plans
      WHERE id=$1 AND buyer_account_id=$2`,[id.parse(planId),id.parse(buyerId)]);
    if(!result.rows[0])return null;
    const steps=await client.query<StepRow>(`SELECT * FROM orchestration_steps
      WHERE plan_id=$1 ORDER BY position`,[planId]);
    return parsePlan(result.rows[0],steps.rows);
  }
  async createPlan(rawPlan:unknown,rawDocuments:readonly CapabilityDiscoveryDocument[]):Promise<AgentPlan>{
    const validation=validateAgentPlan(rawPlan,rawDocuments);
    const plan=validation.plan;
    if(validation.issues.length||plan.status!=='AWAITING_APPROVAL'||plan.approvedAt!==null)
      throw new MarketplaceAgentError('INVALID_PLAN');
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
        [`agent-plan:${plan.id}`]);
      const owner=await client.query<{buyer_account_id:string}>(
        'SELECT buyer_account_id FROM marketplace_conversations WHERE id=$1 FOR UPDATE',
        [plan.conversationId]);
      if(owner.rows[0]?.buyer_account_id!==plan.buyerId)
        throw new MarketplaceAgentError('NOT_FOUND');
      const prior=await client.query<PlanRow>('SELECT * FROM orchestration_plans WHERE id=$1',
        [plan.id]);
      if(prior.rows[0]){
        const existing=await this.plan(plan.buyerId,plan.id,client);
        // The server, not the caller, chooses createdAt. Compare immutable
        // commercial terms and step identity; a replay cannot change a plan.
        if(!existing||JSON.stringify({...existing,createdAt:null})!==
          JSON.stringify({...plan,createdAt:null}))throw new MarketplaceAgentError('CONFLICT');
        await client.query('COMMIT');return existing!;
      }
      for(const step of plan.steps){
        const quote=await client.query<{buyer_account_id:string;capability_id:string;
          capability_version_id:string;price_snapshot:unknown;expires_at:Date}>(`
          SELECT buyer_account_id,capability_id,capability_version_id,price_snapshot,expires_at
          FROM job_schedule_quotes WHERE id=$1`,[step.quoteId]);
        const item=quote.rows[0];
        if(!item||item.buyer_account_id!==plan.buyerId||item.capability_id!==step.capabilityId||
          item.capability_version_id!==step.capabilityVersionId||
          (item.price_snapshot as {buyerAmountMinor?:number})?.buyerAmountMinor!==
            step.quotedPriceMinor||item.expires_at.getTime()<=Date.now())
          throw new MarketplaceAgentError('STALE_PLAN');
      }
      await client.query(`INSERT INTO orchestration_plans(id,conversation_id,buyer_account_id,
        goal,constraints_json,approval_mode,max_budget_minor,quoted_total_minor,status)
        VALUES($1,$2,$3,$4,$5,'APPROVE_PLAN',$6,$7,'AWAITING_APPROVAL')`,
      [plan.id,plan.conversationId,plan.buyerId,plan.goal,plan.constraints,
        plan.maxBudgetMinor,plan.quotedTotalMinor]);
      for(const [position,step] of plan.steps.entries()){
        const document=rawDocuments.find((item)=>item.capabilityId===step.capabilityId&&
          item.capabilityVersionId===step.capabilityVersionId);
        if(!document)throw new MarketplaceAgentError('INVALID_PLAN');
        await client.query(`INSERT INTO orchestration_steps(id,plan_id,capability_id,
          position,capability_version_id,name_snapshot,slug_snapshot,availability_status_at_quote,
          earliest_eligible_at,planning_quote_id,job_id,reservation_id,manifest_id,
          quoted_price_minor,quote_expires_at,depends_on,input_values,input_assets,mappings,
          document_snapshot,status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'PLANNED')`,
        [step.id,plan.id,step.capabilityId,position,step.capabilityVersionId,step.nameSnapshot,
          step.slugSnapshot,step.availabilityStatusAtQuote,step.earliestEligibleAt,
          step.quoteId,step.jobId,step.reservationId,step.manifestId,step.quotedPriceMinor,
          step.quoteExpiresAt,step.dependsOn,step.inputValues,step.inputAssets,
          JSON.stringify(step.mappings),document]);
      }
      await client.query('COMMIT');return (await this.plan(plan.buyerId,plan.id))!;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async approvePlan(buyerId:string,planId:string,approvalId:string):Promise<AgentPlan>{
    id.parse(buyerId);id.parse(planId);id.parse(approvalId);
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const row=await client.query<PlanRow>(
        'SELECT * FROM orchestration_plans WHERE id=$1 AND buyer_account_id=$2 FOR UPDATE',
        [planId,buyerId]);
      const plan=row.rows[0];if(!plan)throw new MarketplaceAgentError('NOT_FOUND');
      const prior=await client.query<{id:string}>(
        'SELECT id FROM orchestration_approvals WHERE plan_id=$1 AND plan_revision=$2',
        [planId,plan.revision]);
      if(prior.rows[0]){
        if(prior.rows[0].id!==approvalId)throw new MarketplaceAgentError('CONFLICT');
        await client.query('COMMIT');return (await this.plan(buyerId,planId))!;
      }
      if(plan.status!=='AWAITING_APPROVAL')throw new MarketplaceAgentError('NOT_ELIGIBLE');
      const stale=await client.query<{count:number}>(`SELECT count(*)::int AS count
        FROM orchestration_steps WHERE plan_id=$1 AND status IN ('PLANNED','READY')
          AND quote_expires_at<=now()`,[planId]);
      if(stale.rows[0]?.count){
        await client.query(`UPDATE orchestration_plans SET status='AWAITING_REAPPROVAL',
          updated_at=now() WHERE id=$1`,[planId]);
        await client.query(`UPDATE orchestration_steps SET status='AWAITING_REAPPROVAL',
          updated_at=now() WHERE plan_id=$1 AND status IN ('PLANNED','READY')`,[planId]);
        await client.query('COMMIT');
        throw new MarketplaceAgentError('STALE_PLAN');
      }
      const terms=await client.query<{accepted:boolean}>(`SELECT EXISTS(
        SELECT 1 FROM marketplace_terms_acceptances WHERE account_id=$1 AND version=1
      ) AS accepted`,[buyerId]);
      if(!terms.rows[0]?.accepted)throw new MarketplaceAgentError('NOT_ELIGIBLE');
      await client.query(`INSERT INTO orchestration_approvals(id,plan_id,buyer_account_id,
        plan_revision,maximum_authorized_minor) VALUES($1,$2,$3,$4,$5)`,
      [approvalId,planId,buyerId,plan.revision,plan.max_budget_minor]);
      await client.query(`UPDATE orchestration_plans SET status='RUNNING',approved_at=now(),
        updated_at=now() WHERE id=$1`,[planId]);
      await client.query('COMMIT');return (await this.plan(buyerId,planId))!;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  /** Revises only unpurchased steps. Prior approved terms remain append-only. */
  async revisePausedPlan(buyerId:string,planId:string,changes:readonly {
    stepId:string;document:CapabilityDiscoveryDocument;quote:ScheduleQuote}[]):Promise<AgentPlan>{
    const client=await this.pool.connect();
    try{await client.query('BEGIN');
      const row=await client.query<PlanRow>(`SELECT * FROM orchestration_plans
        WHERE id=$1 AND buyer_account_id=$2 FOR UPDATE`,[id.parse(planId),id.parse(buyerId)]);
      if(!row.rows[0])throw new MarketplaceAgentError('NOT_FOUND');
      if(row.rows[0].status!=='AWAITING_REAPPROVAL')
        throw new MarketplaceAgentError('NOT_ELIGIBLE');
      const prior=await this.plan(buyerId,planId,client);
      if(!prior)throw new MarketplaceAgentError('NOT_FOUND');
      const rows=await client.query<{id:string;status:string;document_snapshot:unknown}>(`
        SELECT id,status,document_snapshot FROM orchestration_steps
        WHERE plan_id=$1 ORDER BY position`,[planId]);
      const open=rows.rows.filter((step)=>['PLANNED','READY','AWAITING_REAPPROVAL'].includes(step.status));
      if(open.length!==changes.length||new Set(changes.map((change)=>change.stepId)).size!==changes.length)
        throw new MarketplaceAgentError('INVALID_PLAN');
      const amended=prior.steps.map((step)=>{
        const change=changes.find((item)=>item.stepId===step.id);
        if(!change)return step;
        const doc=CapabilityDiscoveryDocumentSchema.parse(change.document);
        const quote=change.quote;
        if(doc.capabilityId!==quote.capabilityId||
          doc.capabilityVersionId!==quote.capabilityVersionId||
          doc.priceMinor!==quote.price.buyerAmountMinor||
          quote.buyerAccountId!==buyerId||
          Date.parse(quote.quoteExpiresAt)<=Date.now())
          throw new MarketplaceAgentError('STALE_PLAN');
        return {...step,capabilityId:doc.capabilityId,
          capabilityVersionId:doc.capabilityVersionId,nameSnapshot:doc.name,
          slugSnapshot:doc.slug,availabilityStatusAtQuote:doc.availability.status,
          earliestEligibleAt:quote.earliestEligibleAt,quoteId:quote.id,
          quotedPriceMinor:doc.priceMinor,quoteExpiresAt:quote.quoteExpiresAt,
          status:'PLANNED' as const};
      });
      const total=amended.reduce((sum,step)=>sum+step.quotedPriceMinor,0);
      if(total>prior.maxBudgetMinor||!Number.isSafeInteger(total))
        throw new MarketplaceAgentError('INVALID_PLAN');
      const snapshots=rows.rows.map((row)=>{
        const change=changes.find((item)=>item.stepId===row.id);
        return change?.document??CapabilityDiscoveryDocumentSchema.parse(row.document_snapshot);
      });
      const candidate=AgentPlanSchema.parse({...prior,steps:amended,
        quotedTotalMinor:total,status:'AWAITING_APPROVAL'});
      if(validateAgentPlan(candidate,snapshots).issues.length)
        throw new MarketplaceAgentError('INVALID_PLAN');
      for(const change of changes){
        const persisted=await client.query<{buyer_account_id:string;capability_id:string;
          capability_version_id:string;price_snapshot:unknown;expires_at:Date}>(`
          SELECT buyer_account_id,capability_id,capability_version_id,price_snapshot,expires_at
          FROM job_schedule_quotes WHERE id=$1`,[change.quote.id]);
        const quote=persisted.rows[0];
        if(!quote||quote.buyer_account_id!==buyerId||
          quote.capability_id!==change.document.capabilityId||
          quote.capability_version_id!==change.document.capabilityVersionId||
          (quote.price_snapshot as {buyerAmountMinor?:number}).buyerAmountMinor!==
            change.document.priceMinor||quote.expires_at.getTime()<=Date.now())
          throw new MarketplaceAgentError('STALE_PLAN');
      }
      await client.query(`INSERT INTO orchestration_revision_snapshots(plan_id,revision,plan_snapshot)
        VALUES($1,$2,$3)`,[planId,row.rows[0].revision,{plan:prior,
          documents:rows.rows.map((item)=>item.document_snapshot)}]);
      for(const change of changes){
        await client.query(`UPDATE orchestration_steps SET capability_id=$2,
          capability_version_id=$3,name_snapshot=$4,slug_snapshot=$5,
          availability_status_at_quote=$6,earliest_eligible_at=$7,planning_quote_id=$8,
          quoted_price_minor=$9,quote_expires_at=$10,document_snapshot=$11,
          status='PLANNED',updated_at=now() WHERE id=$1`,
        [change.stepId,change.document.capabilityId,change.document.capabilityVersionId,
          change.document.name,change.document.slug,change.document.availability.status,
          change.quote.earliestEligibleAt,change.quote.id,change.document.priceMinor,
          change.quote.quoteExpiresAt,change.document]);
      }
      await client.query(`UPDATE orchestration_plans SET revision=revision+1,
        quoted_total_minor=$2,status='AWAITING_APPROVAL',approved_at=NULL,updated_at=now()
        WHERE id=$1`,[planId,total]);
      await client.query('COMMIT');return (await this.plan(buyerId,planId))!;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async listActive(limit=50):Promise<readonly {planId:string;buyerId:string}[]>{
    const rows=await this.pool.query<{id:string;buyer_account_id:string}>(`
      SELECT id,buyer_account_id FROM orchestration_plans WHERE status IN ('RUNNING','CANCELLING')
      ORDER BY updated_at,id LIMIT $1`,[z.number().int().min(1).max(100).parse(limit)]);
    return rows.rows.map((row)=>({planId:row.id,buyerId:row.buyer_account_id}));
  }
  async listPlans(buyerId:string):Promise<readonly AgentPlan[]>{
    const rows=await this.pool.query<{id:string}>(`SELECT id FROM orchestration_plans
      WHERE buyer_account_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[id.parse(buyerId)]);
    const plans=await Promise.all(rows.rows.map((row)=>this.plan(buyerId,row.id)));
    return plans.filter((plan):plan is AgentPlan=>plan!==null);
  }
  async planView(buyerId:string,planId:string):Promise<{
    plan:AgentPlan;finalResult:AgentFinalResult|null;spentMinor:number;reservedMinor:number;
    jobs:readonly {stepId:string;jobId:string;status:string;paymentState:string|null}[];
    stepPermissions:readonly {stepId:string;entries:readonly {category:string;state:string}[]}[]}>{
    const plan=await this.plan(buyerId,planId);
    if(!plan)throw new MarketplaceAgentError('NOT_FOUND');
    const row=await this.pool.query<{final_result:unknown}>(`SELECT final_result
      FROM orchestration_plans WHERE id=$1 AND buyer_account_id=$2`,[planId,buyerId]);
    const jobs=await this.pool.query<{step_id:string;job_id:string;status:string;
      payment_state:string|null;buyer_total_minor:string}>(`
      SELECT s.id AS step_id,j.id AS job_id,j.status,p.state AS payment_state,
        f.buyer_total_minor FROM orchestration_steps s
      JOIN jobs j ON j.id=s.job_id JOIN job_financial_snapshots f ON f.job_id=j.id
      LEFT JOIN job_payment_states p ON p.job_id=j.id
      WHERE s.plan_id=$1 AND j.buyer_account_id=$2`,[planId,buyerId]);
    const snapshots=await this.pool.query<{id:string;document_snapshot:unknown}>(`
      SELECT s.id,s.document_snapshot FROM orchestration_steps s
      JOIN orchestration_plans p ON p.id=s.plan_id
      WHERE p.id=$1 AND p.buyer_account_id=$2 ORDER BY s.position`,[planId,buyerId]);
    return {plan,finalResult:row.rows[0]?.final_result?
      AgentFinalResultSchema.parse(row.rows[0].final_result):null,
      spentMinor:jobs.rows.filter((job)=>job.payment_state==='SETTLED')
        .reduce((sum,job)=>sum+Number(job.buyer_total_minor),0),
      reservedMinor:jobs.rows.filter((job)=>job.payment_state==='RESERVED')
        .reduce((sum,job)=>sum+Number(job.buyer_total_minor),0),
      jobs:jobs.rows.map((job)=>({stepId:job.step_id,jobId:job.job_id,
        status:job.status,paymentState:job.payment_state})),
      stepPermissions:snapshots.rows.map((snapshot)=>({stepId:snapshot.id,
        entries:CapabilityDiscoveryDocumentSchema.parse(snapshot.document_snapshot)
          .permissionManifest.entries.filter((entry)=>entry.state!=='NOT_USED')
          .map((entry)=>({category:entry.category,state:entry.state}))}))};
  }
  async systemNotice(buyerId:string,conversationId:string,body:string):Promise<void>{
    await this.appendMessage({id:randomUUID(),buyerId,conversationId,
      role:'SYSTEM_NOTICE',body});
  }
}
