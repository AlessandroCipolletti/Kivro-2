import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { LAUNCH_PRICE_TIERS } from '../../../packages/contracts/src/pricing.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
import { LocalOpenAiCompatibleConnector } from
  '../../../packages/infrastructure/adapters/src/local-openai-compatible.js';
import { buildSuggestedDependencyGraph } from
  '../../../packages/openclaw-adapter/src/dependency-candidates.js';
import { ReadOnlyOpenClawDiscovery } from
  '../../../packages/openclaw-adapter/src/read-only-discovery.js';
import type { DeviceIdentitySigner } from './device-identity.js';
import { SellerImportDraftStore } from './import-drafts.js';
import { prepareSelectedPackage, WorkerUnreviewedPackageStore } from './import-package.js';
import { runWorkerImportReview } from './import-review-command.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';

export class GuidedImportError extends Error {
  constructor(readonly code:'INTERACTIVE_REQUIRED'|'SELLER_DECLINED'|
    'UNSUPPORTED_DEPENDENCY'|'INVALID_ANSWER'|'CREDENTIAL_MISSING'){
    super(code);this.name='GuidedImportError';
  }
}

type Question=(prompt:string)=>Promise<string>;
function required(value:string,max:number):string{
  const result=value.trim();
  if(result.length<1||result.length>max)throw new GuidedImportError('INVALID_ANSWER');
  return result;
}
function dollarsToMicro(raw:string,min=1,max=1_000_000_000):number{
  const match=/^(\d{1,4})(?:\.(\d{1,6}))?$/.exec(raw.trim());
  if(!match)throw new GuidedImportError('INVALID_ANSWER');
  const value=Number(BigInt(match[1]!)*1_000_000n+
    BigInt((match[2]??'').padEnd(6,'0')));
  if(!Number.isSafeInteger(value)||value<min||value>max)
    throw new GuidedImportError('INVALID_ANSWER');
  return value;
}
function integer(raw:string,min:number,max:number):number{
  if(!/^[0-9]+$/.test(raw.trim()))throw new GuidedImportError('INVALID_ANSWER');
  const value=Number(raw.trim());
  if(!Number.isSafeInteger(value)||value<min||value>max)
    throw new GuidedImportError('INVALID_ANSWER');
  return value;
}
async function confirm(ask:Question,prompt:string):Promise<void>{
  if((await ask(`${prompt} Type yes to continue: `)).trim()!=='yes')
    throw new GuidedImportError('SELLER_DECLINED');
}

export interface GuidedImportDependencies {
  readonly stateDir:string;readonly sellerAccountId:string;
  readonly signer:DeviceIdentitySigner;
  readonly ask:Question;readonly write:(line:string)=>void;
  readonly discovery?:Pick<ReadOnlyOpenClawDiscovery,'scan'|'snapshotSelectedSkill'>;
  readonly credentialExists?:(ref:string)=>Promise<boolean>;
  readonly review?:typeof runWorkerImportReview;
}

/** Guides the supported isolated single-skill inference profiles.
 * No discovered dependency is selected without an individual seller action;
 * the private key is never typed into this wizard or sent to Cloud. */
export async function runGuidedImport(deps:GuidedImportDependencies):Promise<{
  capabilityVersionId:string;packageHash:string}> {
  const {ask,write}=deps;
  await confirm(ask,'Jobs will run on this computer in a separate restricted OpenClaw environment.');
  const discovery=deps.discovery??new ReadOnlyOpenClawDiscovery();
  const scanned=await discovery.scan();
  if(scanned.status==='unavailable'||scanned.skills.length===0)
    throw new GuidedImportError('UNSUPPORTED_DEPENDENCY');
  write(`Read-only discovery found ${scanned.skills.length} skill(s). Uncertainty remains explicit.`);
  for(const [index,skill] of scanned.skills.entries())
    write(`${index+1}. ${skill.name} · ${skill.metadata}${skill.ambiguous?' · ambiguous':''}`);
  for(const issue of scanned.issues)write(`Discovery uncertainty: ${issue}`);
  const choice=integer(await ask('Choose one skill number: '),1,scanned.skills.length);
  const skill=scanned.skills[choice-1]!;
  if(skill.ambiguous)throw new GuidedImportError('UNSUPPORTED_DEPENDENCY');
  const graph=buildSuggestedDependencyGraph(scanned,skill.name);
  if(graph.nodes.length!==1||graph.nodes[0]?.type!=='SKILL')
    throw new GuidedImportError('UNSUPPORTED_DEPENDENCY');
  const store=new SellerImportDraftStore(deps.stateDir);
  try{
    let draft=store.createDraft(randomUUID(),deps.sellerAccountId,graph);
    await confirm(ask,`Select only ${skill.name} for this marketplace Worker. Discovery itself grants nothing.`);
    draft=store.applySelection({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId:deps.sellerAccountId,dependencyId:graph.rootId,
      selected:true,expectedRevision:draft.revision,actedAt:new Date().toISOString()});
    const candidates=scanned.localInference??[];
    const route=candidates.length?integer(await ask(
      `Inference route: 1 for dedicated remote provider, 2–${candidates.length+1} for a discovered local model: `),
      1,candidates.length+1):1;
    const localCandidate=route>1?candidates[route-2]:undefined;
    const provider=localCandidate?.provider??
      required(await ask('Dedicated inference provider ID: '),120);
    const model=localCandidate?.model??
      required(await ask('Exact model ID: '),160);
    let credentialRef:string|undefined;
    if(localCandidate){
      new LocalOpenAiCompatibleConnector(provider,localCandidate.endpoint);
      await confirm(ask,`Select local model ${provider}/${model} at ${
        localCandidate.endpoint}. This service remains on the seller computer.`);
      const endpointRef=`local:${createHash('sha256').update(localCandidate.endpoint)
        .digest('hex').slice(0,24)}`;
      draft=store.configureInference({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:deps.sellerAccountId,expectedRevision:draft.revision,
        actedAt:new Date().toISOString(),mode:'LOCAL',provider,model,endpointRef});
    }else{
      credentialRef=required(await ask('Existing local vault credential ref (seller:...): '),160);
      const exists=deps.credentialExists??((ref:string)=>
        new KeychainSellerCredentialVault(deps.signer.deviceId).exists(ref));
      if(!await exists(credentialRef))throw new GuidedImportError('CREDENTIAL_MISSING');
      draft=store.configureInference({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:deps.sellerAccountId,expectedRevision:draft.revision,
        actedAt:new Date().toISOString(),mode:'REMOTE_PROVIDER',provider,model,credentialRef});
    }
    for(const node of draft.graph.nodes.filter((item)=>!item.selected)){
      await confirm(ask,`Select ${node.type} ${node.name} for this version.`);
      draft=store.applySelection({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:deps.sellerAccountId,dependencyId:node.id,selected:true,
        expectedRevision:draft.revision,actedAt:new Date().toISOString()});
    }
    const inputLabel=required(await ask('Buyer input label: '),120);
    const outputLabel=required(await ask('Result output label: '),120);
    const sample=required(await ask('Representative buyer input for the isolated test: '),10_000);
    write(LAUNCH_PRICE_TIERS.map((tier,index)=>`${index+1}. ${tier.tier} · buyer $${
      (tier.buyerAmountMinor/100).toFixed(2)} · seller $${
        (tier.sellerEarningMinor/100).toFixed(2)}`).join('\n'));
    const priceIndex=integer(await ask('Choose price tier number: '),1,LAUNCH_PRICE_TIERS.length);
    const price=LAUNCH_PRICE_TIERS[priceIndex-1]!;
    const maxRequests=integer(await ask('Maximum model requests per job (1–200): '),1,200);
    const maxDailyJobs=integer(await ask('Maximum model jobs per day (1–10000): '),1,10_000);
    let endpoint:string;
    let budget:object|undefined;
    let localInference:object|undefined;
    if(localCandidate){
      const maxTokens=integer(await ask('Maximum local model tokens per job: '),1,10_000_000);
      if(maxTokens<8192+1024)throw new GuidedImportError('INVALID_ANSWER');
      endpoint=localCandidate.endpoint;
      localInference={providerId:provider,modelId:model,
        endpointRef:draft.graph.inference?.mode==='LOCAL'?
          draft.graph.inference.endpointRef:'',
        maxRequestsPerJob:maxRequests,maxInputTokensPerRequest:8192,
        maxOutputTokensPerRequest:1024,maxTokensPerJob:maxTokens,maxDailyJobs};
    }else{
      const inputRate=dollarsToMicro(await ask('Estimated provider USD per million input tokens: '),0);
      const outputRate=dollarsToMicro(await ask('Estimated provider USD per million output tokens: '),0);
      const maxSpend=dollarsToMicro(await ask('Maximum provider USD per job: '),1,100_000_000);
      const dailySpend=dollarsToMicro(await ask('Maximum provider USD per day: '));
      if(dailySpend<maxSpend)throw new GuidedImportError('INVALID_ANSWER');
      endpoint=required(await ask('Provider HTTPS base URL ending in /v1: '),300);
      new OpenAiCompatibleHttpsConnector(provider,endpoint);
      if(maxSpend>=price.sellerEarningMinor*10_000)
        write('Cost warning: your per-job provider ceiling meets or exceeds your seller proceeds. You will confirm economics again in the dashboard.');
      budget={providerId:provider,modelId:model,credentialRef,
        maxRequestsPerJob:maxRequests,maxInputTokensPerRequest:8192,
        maxOutputTokensPerRequest:1024,maxEstimatedSpendMicroUsdPerJob:maxSpend,
        inputPriceMicroUsdPerMillionTokens:inputRate,
        outputPriceMicroUsdPerMillionTokens:outputRate,
        maxDailyJobs,maxDailyProviderSpendMicroUsd:dailySpend};
    }
    const instructions=required(await ask('Seller instructions for this service: '),10_000);
    const versionNumber=integer(await ask('Version number (1 for a new service): '),1,1_000_000);
    const capabilityId=required(await ask('Capability ID, or new: '),40);
    const actualCapabilityId=capabilityId==='new'?randomUUID():capabilityId;
    const versionId=randomUUID();
    const authored={capabilityId:actualCapabilityId,capabilityVersionId:versionId,
      supportedOpenClawVersionRange:'2026.8.2',priceTier:price.tier,
      ioContract:{contractVersion:1,input:{schemaVersion:1,fields:[{
        key:'question',label:inputLabel,required:true,order:0,type:'SHORT_TEXT'}]},
        output:{schemaVersion:1,fields:[{key:'answer',label:outputLabel,
          required:true,order:0,type:'LONG_TEXT'}]}},
      ...(budget?{providerBudget:budget}:{}),
      ...(localInference?{localInference}:{}),
      limits:{timeoutSeconds:120,memoryMb:1024,cpu:1,maxPids:128,
        maxInputBytes:100_000,maxOutputBytes:1_048_576},
      concurrencyLimit:1,pauseSupport:'NOT_SUPPORTED',sellerInstructions:instructions};
    const prepared=await prepareSelectedPackage(draft,authored,
      {sellerAccountId:deps.sellerAccountId,workerDeviceId:deps.signer.deviceId},discovery);
    const packages=new WorkerUnreviewedPackageStore(deps.stateDir);
    let staged:{packageHash:string;capabilityVersionId:string};
    try{staged=packages.stage(draft,prepared);}finally{packages.close();}
    write(`Private unreviewed package staged: ${versionId}. The seller still must approve publication.`);
    const run=deps.review??runWorkerImportReview;
    await run({stateDir:deps.stateDir,versionId,sellerAccountId:deps.sellerAccountId,
      signer:deps.signer,retry:false,privateConfig:{versionNumber,
        selectedPrice:price,providerEndpoint:endpoint,
        externalProcessors:localCandidate?[]:[provider],
        sampleInput:{values:{question:sample},assets:{}}}});
    write('Isolated review sent. Open your seller dashboard to inspect the exact contract, costs, permissions and version changes before publishing.');
    return {capabilityVersionId:versionId,packageHash:staged.packageHash};
  }finally{store.close();}
}
