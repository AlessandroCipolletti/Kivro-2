import { AgentPlanSchema, type AgentPlan } from '../../contracts/src/marketplace-agent.js';
import { CapabilityDiscoveryDocumentSchema, type CapabilityDiscoveryDocument } from
  '../../contracts/src/marketplace.js';
import { assessFieldMapping } from './io-compatibility.js';

export type PlanIssueCode = 'DUPLICATE_STEP'|'UNKNOWN_DEPENDENCY'|'CYCLE'|'UNKNOWN_CAPABILITY'|
  'VERSION_CHANGED'|'PRICE_CHANGED'|'OVER_BUDGET'|'INCOMPATIBLE_MAPPING'|
  'MISSING_INPUT'|'INVALID_INPUT_FIELD'|'NOT_AVAILABLE'|'RATING_CONSTRAINT'|
  'PERMISSION_CONSTRAINT'|'RUNTIME_CONSTRAINT'|'TOO_MANY_JOBS';
export interface PlanIssue { readonly stepId: string|null; readonly code: PlanIssueCode; }

function outputSupports(document:CapabilityDiscoveryDocument,wanted:string):boolean{
  return document.ioContract.output.fields.some((field)=>field.type===wanted||
    field.semanticType===wanted||((field.type==='FILE'||field.type==='FILES')&&
      (field.constraints.allowedMimeTypes.includes(wanted)||
        field.constraints.allowedExtensions.includes(wanted.toLowerCase())))||
    (wanted==='TEXT'&&['SHORT_TEXT','LONG_TEXT','MARKDOWN'].includes(field.type))||
    (wanted==='FILE'&&(field.type==='FILE'||field.type==='FILES'))||
    (wanted==='PDF'&&(field.type==='FILE'||field.type==='FILES')&&
      field.constraints.allowedMimeTypes.includes('application/pdf')));
}
function inputSupports(document:CapabilityDiscoveryDocument,wanted:string):boolean{
  return document.ioContract.input.fields.some((field)=>field.type===wanted||
    field.semanticType===wanted||((field.type==='FILE'||field.type==='FILES')&&
      (field.constraints.allowedMimeTypes.includes(wanted)||
        field.constraints.allowedExtensions.includes(wanted.toLowerCase()))));
}

/** Validate full DAG and terms independently of any model-produced explanation. */
export function validateAgentPlan(rawPlan:unknown,rawDocuments:readonly unknown[]):{
  plan:AgentPlan; issues:readonly PlanIssue[]; topologicalStepIds:readonly string[];
  estimatedCompletionSeconds:number|null;
}{
  const plan=AgentPlanSchema.parse(rawPlan);
  const documents=new Map(rawDocuments.map((raw)=>{
    const document=CapabilityDiscoveryDocumentSchema.parse(raw);
    return [document.capabilityVersionId,document] as const;
  }));
  const issues:PlanIssue[]=[];
  const add=(stepId:string|null,code:PlanIssueCode)=>issues.push({stepId,code});
  const byId=new Map(plan.steps.map((step)=>[step.id,step] as const));
  if(byId.size!==plan.steps.length)add(null,'DUPLICATE_STEP');
  if(plan.constraints.maxJobs!==undefined&&plan.steps.length>plan.constraints.maxJobs)
    add(null,'TOO_MANY_JOBS');
  const total=plan.steps.reduce((sum,step)=>sum+step.quotedPriceMinor,0);
  if(!Number.isSafeInteger(total)||total>plan.maxBudgetMinor||
    total!==plan.quotedTotalMinor||
    (plan.constraints.maxTotalSpendMinor!==undefined&&total>plan.constraints.maxTotalSpendMinor))
    add(null,'OVER_BUDGET');
  const order:string[]=[];const visiting=new Set<string>();const visited=new Set<string>();
  const visit=(stepId:string):void=>{
    if(visiting.has(stepId)){add(stepId,'CYCLE');return;}
    if(visited.has(stepId))return;
    const step=byId.get(stepId);if(!step){add(stepId,'UNKNOWN_DEPENDENCY');return;}
    visiting.add(stepId);
    for(const dependency of step.dependsOn)visit(dependency);
    visiting.delete(stepId);visited.add(stepId);order.push(stepId);
  };
  for(const step of plan.steps)visit(step.id);
  const lengths=new Map<string,number>();
  let durationKnown=true;
  for(const stepId of order){
    const step=byId.get(stepId);if(!step)continue;
    const doc=documents.get(step.capabilityVersionId);
    if(!doc){add(step.id,'UNKNOWN_CAPABILITY');continue;}
    if(doc.capabilityId!==step.capabilityId)add(step.id,'UNKNOWN_CAPABILITY');
    if(doc.capabilityVersionId!==step.capabilityVersionId)add(step.id,'VERSION_CHANGED');
    if(doc.priceMinor!==step.quotedPriceMinor)add(step.id,'PRICE_CHANGED');
    if(plan.constraints.category&&doc.category!==plan.constraints.category)
      add(step.id,'UNKNOWN_CAPABILITY');
    if(plan.constraints.blockedSellerIds.includes(doc.sellerId))
      add(step.id,'UNKNOWN_CAPABILITY');
    const isFinal=!plan.steps.some((next)=>next.dependsOn.includes(step.id));
    if(isFinal&&!plan.constraints.outputTypes.every((wanted)=>outputSupports(doc,wanted)))
      add(step.id,'INCOMPATIBLE_MAPPING');
    if(!step.dependsOn.length&&!plan.constraints.requiredInputTypes.every((wanted)=>
      inputSupports(doc,wanted)))add(step.id,'INCOMPATIBLE_MAPPING');
    if(plan.constraints.maxPerJobSpendMinor!==undefined&&
      doc.priceMinor>plan.constraints.maxPerJobSpendMinor)add(step.id,'OVER_BUDGET');
    if(plan.constraints.minRating!==undefined&&
      (doc.rating.average??0)<plan.constraints.minRating)add(step.id,'RATING_CONSTRAINT');
    if(plan.constraints.maxRuntimeSeconds!==undefined&&
      (doc.typicalRuntimeSeconds===null||doc.typicalRuntimeSeconds>
        plan.constraints.maxRuntimeSeconds))add(step.id,'RUNTIME_CONSTRAINT');
    if(!plan.constraints.permissionLimits.every((limit)=>doc.permissionManifest.entries.some((entry)=>
      entry.category===limit.category&&limit.allowedStates.includes(entry.state))))
      add(step.id,'PERMISSION_CONSTRAINT');
    if(plan.constraints.timing.mode==='IMMEDIATE'&&
      !(doc.availability.status==='ONLINE'&&doc.availability.acceptingImmediate))
      add(step.id,'NOT_AVAILABLE');
    if(plan.constraints.onlineOnly&&
      !(doc.availability.status==='ONLINE'&&doc.availability.acceptingImmediate))
      add(step.id,'NOT_AVAILABLE');
    if(plan.constraints.timing.mode!=='IMMEDIATE'&&
      !(doc.availability.acceptingImmediate||doc.availability.canSchedule))
      add(step.id,'NOT_AVAILABLE');
    const inputFields=new Map(doc.ioContract.input.fields.map((field)=>[field.key,field] as const));
    for(const key of [...Object.keys(step.inputValues),...Object.keys(step.inputAssets)]){
      if(!inputFields.has(key))add(step.id,'INVALID_INPUT_FIELD');
    }
    const groups=new Map<string,typeof step.mappings>();
    for(const mapping of step.mappings){
      const values=groups.get(mapping.targetInputKey)??[];
      groups.set(mapping.targetInputKey,[...values,mapping]);
    }
    const mapped=new Set(groups.keys());
    for(const [targetKey,mappings] of groups){
      const sources=mappings.map((mapping)=>{
        const sourceStep=byId.get(mapping.sourceStepId);
        const sourceDoc=sourceStep&&documents.get(sourceStep.capabilityVersionId);
        return {mapping,sourceStep,sourceDoc};
      });
      if(Object.hasOwn(step.inputValues,targetKey)||Object.hasOwn(step.inputAssets,targetKey)||
        sources.some(({mapping,sourceStep,sourceDoc})=>!sourceStep||!sourceDoc||
          !step.dependsOn.includes(mapping.sourceStepId))||
        (mappings.length===1?!compatible(sources[0]!.sourceDoc!,
          mappings[0]!.sourceOutputKey,doc,targetKey):
          !compatibleFileGroup(sources.map(({mapping,sourceDoc})=>({
            document:sourceDoc!,outputKey:mapping.sourceOutputKey})),doc,targetKey)))
        add(step.id,'INCOMPATIBLE_MAPPING');
    }
    for(const field of doc.ioContract.input.fields){
      const supplied=Object.hasOwn(step.inputValues,field.key)||
        Object.hasOwn(step.inputAssets,field.key)||mapped.has(field.key);
      if(field.required&&!supplied&&(!('defaultValue' in field)||field.defaultValue===undefined))
        add(step.id,'MISSING_INPUT');
    }
    if(doc.typicalRuntimeSeconds===null)durationKnown=false;
    const maxPrevious=Math.max(0,...step.dependsOn.map((dependency)=>lengths.get(dependency)??0));
    lengths.set(step.id,maxPrevious+(doc.typicalRuntimeSeconds??0));
  }
  // Runtime history cannot predict queue, Worker or provider waiting. Keep a
  // non-authoritative estimate private to this validator until evidence exists.
  const estimatedCompletionSeconds=durationKnown&&issues.length===0&&
    plan.steps.every((step)=>documents.get(step.capabilityVersionId)?.availability.acceptingImmediate)?
    Math.max(...lengths.values(),0):null;
  if(plan.constraints.timing.mode==='DEADLINE'&&estimatedCompletionSeconds!==null &&
    Date.now()+estimatedCompletionSeconds*1000>Date.parse(plan.constraints.timing.deadlineAt))
    add(null,'NOT_AVAILABLE');
  return {plan,issues,topologicalStepIds:order,estimatedCompletionSeconds};
}

function compatible(source:CapabilityDiscoveryDocument,sourceKey:string,
  target:CapabilityDiscoveryDocument,targetKey:string):boolean{
  const output=source.ioContract.output.fields.find((field)=>field.key===sourceKey);
  const input=target.ioContract.input.fields.find((field)=>field.key===targetKey);
  if(!output||!input)return false;
  const assessment=assessFieldMapping(output,input);
  return assessment.status==='DIRECT'||assessment.status==='SAFE_TEXT_MAPPING';
}

/** Multiple upstream private file outputs can feed one typed FILES input. */
function compatibleFileGroup(sources:readonly {document:CapabilityDiscoveryDocument;
  outputKey:string}[],target:CapabilityDiscoveryDocument,targetKey:string):boolean{
  const input=target.ioContract.input.fields.find((field)=>field.key===targetKey);
  if(!input||input.type!=='FILES'||sources.length<2)return false;
  let minimum=0,maximum=0,totalBytes=0;
  for(const source of sources){
    const output=source.document.ioContract.output.fields.find((field)=>
      field.key===source.outputKey);
    if(!output||(output.type!=='FILE'&&output.type!=='FILES'))return false;
    const relaxed={...input,required:false,constraints:{...input.constraints,minFiles:0}};
    const decision=assessFieldMapping(output,relaxed);
    if(decision.status!=='DIRECT')return false;
    minimum+=Math.max(output.required?1:0,output.constraints.minFiles??0);
    maximum+=output.constraints.maxFiles;
    totalBytes+=output.constraints.maxTotalSizeBytes;
  }
  return minimum>=Math.max(input.required?1:0,input.constraints.minFiles??0)&&
    maximum<=input.constraints.maxFiles&&totalBytes<=input.constraints.maxTotalSizeBytes;
}
