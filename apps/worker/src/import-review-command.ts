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
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';
import { WorkerLocalState } from './local-state.js';
import { WorkerJobControl } from './job-control.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from
  '../../../packages/sandbox-adapter/src/docker.js';
import { OpenClawImageApproval } from
  '../../../packages/openclaw-adapter/src/image-approval.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
import { SellerCompletionBroker } from '../../../packages/application/src/completion-broker.js';
import { discoverWorkerControlPlanes, HttpsPollingWorkerTransport } from
  '../../../packages/infrastructure/netsons/src/https-polling.js';
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

async function activeTransport(signer:DeviceIdentitySigner):Promise<HttpsPollingWorkerTransport>{
  const url=process.env.WORKER_DISCOVERY_URL;
  if(!url)throw new WorkerImportReviewCommandError('REVIEW_CONFIG_MISSING');
  const allowLocalHttp=process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&
    process.env.NODE_ENV!=='production';
  const planes=await discoverWorkerControlPlanes(url,{allowLocalHttp});
  const active=planes.filter((plane)=>plane.state==='ACTIVE');
  if(active.length!==1||!active[0])
    throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
  return new HttpsPollingWorkerTransport(active[0].id,active[0].endpoint,
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
    const budget=pkg.permissionPolicy.providerBudget;
    if(!budget||pkg.dependencyGraph.inference?.mode!=='REMOTE_PROVIDER'||
      budget.providerId!==pkg.dependencyGraph.inference.provider||
      budget.modelId!==pkg.dependencyGraph.inference.model||
      !await vault.exists(budget.credentialRef))
      throw new WorkerImportReviewCommandError('REVIEW_NOT_READY');
    const usage=new WorkerProviderUsage(input.stateDir);
    const local=new WorkerLocalState(input.stateDir,{check:async()=>({ready:false,
      checkedAt:new Date().toISOString(),blockingReasons:['REVIEW_ONLY']})});
    const control=new DockerJobControlAdapter(docker);
    const jobs=new WorkerJobControl(input.stateDir,control,
      {check:async()=>({ready:false,checkedAt:new Date().toISOString(),
        blockingReasons:['REVIEW_ONLY']})},{maxPauseDurationMs:60_000});
    try{
      const completion=new SellerCompletionBroker(vault,
        new OpenAiCompatibleHttpsConnector(budget.providerId,config.providerEndpoint),usage);
      const tested=await runRepresentativePackageTest(pkg,prepared.reviewedSkills,
        config.sampleInput,{attemptRoot,dockerExecutable:docker,approvedImage:image,
          imageApproval:new OpenClawImageApproval(record,runtimeRoot,docker),
          sandbox:new DockerSandboxAdapter({dockerExecutable:docker,
            approvedImage:image,collectorImage:collector,attemptRoot}),docker:control,
          jobControl:jobs,localState:local,brokerPorts:{completion},
          async checkDependencies(candidate){
            const selected=candidate.dependencyGraph.nodes.filter((node)=>node.selected);
            const exact=selected.length===4&&
              ['SKILL','AI_PROVIDER','AI_MODEL','CREDENTIAL'].every((type)=>
                selected.filter((node)=>node.type===type).length===1);
            const credentialPresent=await vault.exists(budget.credentialRef);
            return {ready:exact&&credentialPresent,
              verifiedNodeIds:exact&&credentialPresent?selected.map((node)=>node.id):[],
              evidence:{credentialPresent,selectedClosureExact:exact,
                skillHash:candidate.workerManifest.skills[0]?.contentHash??'missing',
                provider:budget.providerId,model:budget.modelId}};
          }});
      const accounting=usage.summary(tested.localTestJobId);
      const review=buildWorkerCapabilityReview(tested,{
        versionNumber:config.versionNumber,selectedPrice:config.selectedPrice,
        externalProcessors:config.externalProcessors},{
          workerDeviceId:input.signer.deviceId,controlPlaneId:transport.controlPlaneId,
          providerUsage:accounting});
      outbox.record(review,input.sellerAccountId,config.providerEndpoint);
      packages.installReviewed(tested.reviewedPackage,{actorId:'local:seller',
        approvedAt:review.tests.testedAt,reviewEvidenceHash:hashCanonicalJson(review.tests)},
      prepared.reviewedSkills);
      await transport.send(review);
      outbox.markSent(input.versionId,input.sellerAccountId);
      return {capabilityVersionId:input.versionId,state:'STAGED_FOR_SELLER_REVIEW',
        packageHash:review.candidate.localPackageHash};
    }finally{jobs.close();local.close();usage.close();}
  }finally{packages.close();outbox.close();}
}
