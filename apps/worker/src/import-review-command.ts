import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { WorkerPrivateReviewConfigSchema, buildWorkerCapabilityReview } from './import-review.js';
import { WorkerImportReviewOutbox } from './import-review-outbox.js';
import { WorkerUnreviewedPackageStore } from './import-package.js';
import { WorkerCapabilityPackageStore } from './capability-package-store.js';
import { projectReviewedPackage, runRepresentativePackageTest } from './import-review-runner.js';
import { WorkerProviderUsage } from './provider-usage.js';
import { WorkerLocalInferenceUsage } from './local-inference-usage.js';
import { WorkerResourceUsage,createWorkerResourcePorts,
  checkWorkerResourceReadiness } from './resource-ports.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';
import { WorkerReviewResearchUsage } from './review-research-usage.js';
import { ResearchBroker } from '../../../packages/application/src/research-broker.js';
import { BraveWebSearchProvider } from '../../../packages/infrastructure/http/src/brave-search.js';
import { NodePinnedPublicHttpTransport,SystemDnsResolver } from
  '../../../packages/infrastructure/http/src/pinned-http.js';
import { WorkerLocalState } from './local-state.js';
import { WorkerJobControl } from './job-control.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from
  '../../../packages/sandbox-adapter/src/docker.js';
import { OpenClawImageApproval } from
  '../../../packages/openclaw-adapter/src/image-approval.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
import { LocalOpenAiCompatibleConnector } from
  '../../../packages/infrastructure/adapters/src/local-openai-compatible.js';
import { SellerCompletionBroker } from '../../../packages/application/src/completion-broker.js';
import { discoverWorkerControlPlanes, HttpsPollingWorkerTransport,
  selectWorkerTransport } from
  '../../../packages/infrastructure/netsons/src/https-polling.js';
import {WebSocketWorkerTransport} from
  '../../../packages/infrastructure/adapters/src/websocket-worker.js';
import type { DeviceIdentitySigner } from './device-identity.js';

export class WorkerImportReviewCommandError extends Error {
  constructor(readonly code:'REVIEW_NOT_READY'|'REVIEW_ALREADY_TESTED'|
    'REVIEW_PENDING'|'REVIEW_CONFIG_MISSING'){
    super(code);this.name='WorkerImportReviewCommandError';
  }
}

export function privateAttemptRoot(stateDir:string):string{
  const root=process.env.KIVRO_WORKER_ATTEMPT_ROOT??join(stateDir,'attempts');
  if(!isAbsolute(root))throw new WorkerImportReviewCommandError('REVIEW_CONFIG_MISSING');
  mkdirSync(root,{recursive:true,mode:0o700});
  const stat=lstatSync(root);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||
    (typeof process.getuid==='function'&&stat.uid!==process.getuid()))
    throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
  return root;
}

async function activeTransport(signer:DeviceIdentitySigner){
  const url=process.env.WORKER_DISCOVERY_URL;
  if(!url)throw new WorkerImportReviewCommandError('REVIEW_CONFIG_MISSING');
  const allowLocalHttp=process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&
    process.env.NODE_ENV!=='production';
  const planes=await discoverWorkerControlPlanes(url,{allowLocalHttp});
  const active=planes.filter((plane)=>plane.state==='ACTIVE');
  if(active.length!==1||!active[0])
    throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
  const selected=selectWorkerTransport(active[0],{allowLocalHttp});
  return selected.type==='WEBSOCKET'?new WebSocketWorkerTransport(active[0].id,
    selected.endpoint,signer,{allowLocalHttp}):
    new HttpsPollingWorkerTransport(active[0].id,selected.endpoint,
      signer,{allowLocalHttp});
}

/** Initial review is a real local Docker/OpenClaw run. Retry replays its
 * persisted signed body and never pays the seller provider for another test. */
export async function runWorkerImportReview(input:{stateDir:string;versionId:string;
  sellerAccountId:string;signer:DeviceIdentitySigner;
  privateConfig?:unknown;retry:boolean}):Promise<{
    capabilityVersionId:string;state:'STAGED_FOR_SELLER_REVIEW';
    packageHash:string}> {
  const outbox=new WorkerImportReviewOutbox(input.stateDir);
  const packages=new WorkerCapabilityPackageStore(input.stateDir);
  try{
    const existing=outbox.load(input.versionId,input.sellerAccountId);
    if(existing){
      const staged=new WorkerUnreviewedPackageStore(input.stateDir);
      let prepared:ReturnType<typeof staged.load>;
      try{prepared=staged.load(input.versionId,input.sellerAccountId);}
      finally{staged.close();}
      const reviewed=projectReviewedPackage(prepared.localPackage);
      if(hashCanonicalJson(reviewed)!==existing.review.candidate.localPackageHash||
        existing.review.tests.testedPackageHash!==hashCanonicalJson(reviewed)||
        reviewed.workerDeviceId!==input.signer.deviceId||
        existing.review.workerDeviceId!==input.signer.deviceId)
        throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
      packages.installReviewed(reviewed,{actorId:'local:seller',
        approvedAt:existing.review.tests.testedAt,
        reviewEvidenceHash:hashCanonicalJson(existing.review.tests)},
      prepared.reviewedSkills);
      const transport=await activeTransport(input.signer);
      await transport.send(transport.controlPlaneId===existing.review.controlPlaneId?
        existing.review:{...existing.review,messageId:randomUUID(),
          controlPlaneId:transport.controlPlaneId});
      outbox.markSent(input.versionId,input.sellerAccountId);
      return {capabilityVersionId:input.versionId,state:'STAGED_FOR_SELLER_REVIEW',
        packageHash:existing.review.candidate.localPackageHash};
    }
    if(input.retry)throw new WorkerImportReviewCommandError('REVIEW_PENDING');
    if(input.privateConfig===undefined)
      throw new WorkerImportReviewCommandError('REVIEW_CONFIG_MISSING');
    const config=WorkerPrivateReviewConfigSchema.parse(input.privateConfig);
    const staged=new WorkerUnreviewedPackageStore(input.stateDir);
    let prepared:ReturnType<typeof staged.load>;
    try{prepared=staged.load(input.versionId,input.sellerAccountId);}
    finally{staged.close();}
    const pkg=prepared.localPackage;
    if(pkg.permissionPolicy.internet?.mode==='PUBLIC_WEB_RESEARCH'&&
      config.reviewResearchEgressApproval!==true)
      throw new WorkerImportReviewCommandError('REVIEW_CONFIG_MISSING');
    if(pkg.workerDeviceId!==input.signer.deviceId)
      throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
    try{packages.load(input.versionId);
      throw new WorkerImportReviewCommandError('REVIEW_ALREADY_TESTED');}
    catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='NOT_FOUND'))throw error;}
    const transport=await activeTransport(input.signer);
    const image=process.env.KIVRO_OPENCLAW_APPROVED_IMAGE;
    const collector=process.env.KIVRO_OUTPUT_COLLECTOR_IMAGE;
    const record=process.env.KIVRO_OPENCLAW_APPROVAL_RECORD;
    const runtimeRoot=process.env.KIVRO_OPENCLAW_RUNTIME_ROOT;
    if(!image||!collector||!record||!runtimeRoot||
      !isAbsolute(record)||!isAbsolute(runtimeRoot))
      throw new WorkerImportReviewCommandError('REVIEW_CONFIG_MISSING');
    if(collector!==image)
      throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
    const docker=execFileSync('which',['docker'],{encoding:'utf8',timeout:2_000,
      stdio:['ignore','pipe','ignore']}).trim();
    const attemptRoot=privateAttemptRoot(input.stateDir);
    const vault=new KeychainSellerCredentialVault(input.signer.deviceId);
    const inference=pkg.dependencyGraph.inference;
    const budget=pkg.permissionPolicy.providerBudget;
    const localBudget=pkg.permissionPolicy.localInference;
    if(!inference||
      (inference.mode==='REMOTE_PROVIDER'&&(!budget||localBudget||
        budget.providerId!==inference.provider||budget.modelId!==inference.model||
        !await vault.exists(budget.credentialRef)))||
      (inference.mode==='LOCAL'&&(!localBudget||budget||
        localBudget.providerId!==inference.provider||
        localBudget.modelId!==inference.model||
        localBudget.endpointRef!==inference.endpointRef)))
      throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
    const connector=budget?
      new OpenAiCompatibleHttpsConnector(budget.providerId,config.providerEndpoint):
      new LocalOpenAiCompatibleConnector(localBudget!.providerId,
        config.providerEndpoint);
    if(localBudget)await (connector as LocalOpenAiCompatibleConnector)
      .checkModel(localBudget.modelId);
    const usage=budget?new WorkerProviderUsage(input.stateDir):null;
    const localUsage=localBudget?new WorkerLocalInferenceUsage(input.stateDir):null;
    const resourceUsage=new WorkerResourceUsage(input.stateDir);
    const reviewResearch=pkg.permissionPolicy.internet?.mode==='PUBLIC_WEB_RESEARCH'?
      new WorkerReviewResearchUsage(input.stateDir):null;
    const local=new WorkerLocalState(input.stateDir,{check:async()=>({ready:false,
      checkedAt:new Date().toISOString(),blockingReasons:['REVIEW_ONLY']})});
    const control=new DockerJobControlAdapter(docker);
    const jobs=new WorkerJobControl(input.stateDir,control,
      {check:async()=>({ready:false,checkedAt:new Date().toISOString(),
        blockingReasons:['REVIEW_ONLY']})},{maxPauseDurationMs:60_000});
    try{
      const completion=new SellerCompletionBroker(budget?vault:null,
        connector,usage,localUsage??undefined);
      const resourcePorts=createWorkerResourcePorts(pkg,vault,resourceUsage,
        reviewResearch?(jobId,versionId)=>
          reviewResearch.markPrivateResourceRead(jobId,versionId):undefined);
      const reviewResearchBroker=reviewResearch?(()=>{
        const resolver=new SystemDnsResolver();
        const transport=new NodePinnedPublicHttpTransport();
        const token=process.env.KIVRO_REVIEW_BRAVE_TOKEN;
        const provider=token?new BraveWebSearchProvider(token,resolver,transport):{
          async search():Promise<never>{throw new Error('REVIEW_SEARCH_CREDENTIAL_MISSING');}
        };
        return new ResearchBroker(provider,resolver,transport,reviewResearch);
      })():null;
      const tested=await runRepresentativePackageTest(pkg,prepared.reviewedSkills,
        config.sampleInput,{attemptRoot,dockerExecutable:docker,approvedImage:image,
          ...(config.sampleFiles?{sampleFiles:config.sampleFiles}:{}),
          imageApproval:new OpenClawImageApproval(record,runtimeRoot,docker),
          sandbox:new DockerSandboxAdapter({dockerExecutable:docker,
            approvedImage:image,collectorImage:collector,attemptRoot}),docker:control,
          jobControl:jobs,localState:local,brokerPorts:{completion,...resourcePorts,
            ...(reviewResearchBroker?{research:reviewResearchBroker}:{})},
          async checkDependencies(candidate){
            const selected=candidate.dependencyGraph.nodes.filter((node)=>node.selected);
            const resources=candidate.permissionPolicy.localResources?.length??0;
            const apiPolicy=candidate.permissionPolicy.declaredApiPolicy??
              candidate.permissionPolicy.internet;
            const apis=apiPolicy?.mode==='DECLARED_API_ACCESS'?
              apiPolicy.connectors.length:0;
            const files=(candidate.selectedLocalBindings??[]).length;
            const researchTools=candidate.workerManifest.tools.allow.filter((name)=>
              name.startsWith('kivro_research_')).length;
            const exact=selected.length===4+resources+apis+files+researchTools&&
              ['SKILL','AI_PROVIDER','AI_MODEL',
                localBudget?'LOCAL_SERVICE':'CREDENTIAL'].every((type)=>
                selected.filter((node)=>node.type===type).length===1);
            const routeReady=budget?await vault.exists(budget.credentialRef):
              await (connector as LocalOpenAiCompatibleConnector)
                .checkModel(localBudget!.modelId).then(()=>true,()=>false);
            const resourceReady=await checkWorkerResourceReadiness(candidate,vault);
            const researchPolicy=candidate.permissionPolicy.internet;
            const researchReady=researchTools===0||
              (researchPolicy?.mode==='PUBLIC_WEB_RESEARCH'&&
                (!researchPolicy.search.enabled||
                  Boolean(process.env.KIVRO_REVIEW_BRAVE_TOKEN)));
            return {ready:exact&&routeReady&&resourceReady&&researchReady,
              verifiedNodeIds:exact&&routeReady&&resourceReady&&researchReady?
                selected.map((node)=>node.id):[],
              evidence:{routeReady,resourceReady,researchReady,
                selectedClosureExact:exact,
                skillHash:candidate.workerManifest.skills[0]?.contentHash??'missing',
                provider:inference.provider,model:inference.model}};
          }});
      const accounting=usage?usage.summary(tested.localTestJobId):
        localUsage!.summary(tested.localTestJobId);
      const review=buildWorkerCapabilityReview(tested,{
        versionNumber:config.versionNumber,selectedPrice:config.selectedPrice,
        externalProcessors:config.externalProcessors},{
          workerDeviceId:input.signer.deviceId,controlPlaneId:transport.controlPlaneId,
          providerUsage:{requests:accounting.requests,
            estimatedMicroUsd:usage?
              usage.summary(tested.localTestJobId).estimatedMicroUsd:0,
            unsettled:accounting.unsettled}});
      outbox.record(review,input.sellerAccountId,config.providerEndpoint);
      packages.installReviewed(tested.reviewedPackage,{actorId:'local:seller',
        approvedAt:review.tests.testedAt,reviewEvidenceHash:hashCanonicalJson(review.tests)},
      prepared.reviewedSkills);
      await transport.send(review);
      outbox.markSent(input.versionId,input.sellerAccountId);
      return {capabilityVersionId:input.versionId,state:'STAGED_FOR_SELLER_REVIEW',
        packageHash:review.candidate.localPackageHash};
    }finally{jobs.close();local.close();usage?.close();localUsage?.close();
      resourceUsage.close();reviewResearch?.close();}
  }finally{packages.close();outbox.close();}
}
