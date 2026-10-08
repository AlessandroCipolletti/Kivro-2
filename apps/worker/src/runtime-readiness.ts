import { randomUUID } from 'node:crypto';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { SellerCompletionBroker } from '../../../packages/application/src/completion-broker.js';
import { DigestPinnedImageSchema } from '../../../packages/contracts/src/sandbox.js';
import { analyzeDependencyGraph } from '../../../packages/domain/src/dependency-graph.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
import { LocalOpenAiCompatibleConnector } from
  '../../../packages/infrastructure/adapters/src/local-openai-compatible.js';
import { isPinnedRuntimeRangeCompatible } from
  '../../../packages/openclaw-adapter/src/compatibility.js';
import type { OpenClawImageApproval } from
  '../../../packages/openclaw-adapter/src/image-approval.js';
import type { CapabilityAdmissionReadinessPort } from './job-admission.js';
import { WorkerCapabilityPackageStore } from './capability-package-store.js';
import { WorkerImportReviewOutbox } from './import-review-outbox.js';
import { WorkerBrokerRouter } from './broker-router.js';
import { WorkerJobControl } from './job-control.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';
import { WorkerLocalState } from './local-state.js';
import { WorkerProviderUsage } from './provider-usage.js';
import { WorkerLocalInferenceUsage } from './local-inference-usage.js';
import { WorkerResourceUsage,createWorkerResourcePorts,
  checkWorkerResourceReadiness } from './resource-ports.js';

export interface RuntimeReadinessDeps {
  readonly deviceId:string;readonly sellerAccountId:string;
  readonly packages:WorkerCapabilityPackageStore;
  readonly reviews:WorkerImportReviewOutbox;
  readonly vault:KeychainSellerCredentialVault;
  readonly usage:WorkerProviderUsage;
  readonly localUsage?:WorkerLocalInferenceUsage;
  readonly resourceUsage?:WorkerResourceUsage;
  readonly imageApproval:OpenClawImageApproval;
  readonly approvedImage:string;readonly collectorImage:string;
  readonly jobControl:WorkerJobControl;
  readonly localState:WorkerLocalState;
  /** Set only by the runtime that binds signed, lease-scoped research RPCs for each offer. */
  readonly cloudResearchRoutingReady?:boolean;
  readonly checkProviderDestination?:(endpoint:string)=>Promise<void>;
}

const admissionResearchPort={
  async search():Promise<never>{throw new Error('RESEARCH_JOB_BINDING_REQUIRED');},
  async fetch():Promise<never>{throw new Error('RESEARCH_JOB_BINDING_REQUIRED');},
  async download():Promise<never>{throw new Error('RESEARCH_JOB_BINDING_REQUIRED');},
};

/** Every offer checks the exact reviewed bytes and current host prerequisites.
 * A stale/unknown component can only lower capability readiness. */
export class WorkerRuntimeReadiness implements CapabilityAdmissionReadinessPort {
  constructor(private readonly deps:RuntimeReadinessDeps){}

  async check(capabilityVersionId:string){
    const checkedAt=new Date().toISOString();
    let policyValidationHash:string|null=null;
    let sandboxVerified=false,requiredSecretsReady=false,runtimeHealthy=false;
    let capacityAvailable=false,unpaused=false,revalidationRequired=false;
    try{
      const pkg=this.deps.packages.load(capabilityVersionId);
      try{this.deps.packages.loadReviewedSkills(capabilityVersionId);}
      catch(error){revalidationRequired=true;throw error;}
      const saved=this.deps.reviews.load(capabilityVersionId,this.deps.sellerAccountId);
      if(!saved?.sentAt||saved.review.candidate.localPackageHash!==hashCanonicalJson(pkg)||
        saved.review.tests.testedPackageHash!==hashCanonicalJson(pkg))
        revalidationRequired=true;
      if(!saved?.sentAt||!saved.providerEndpoint||
        pkg.workerDeviceId!==this.deps.deviceId||
        saved.review.workerDeviceId!==this.deps.deviceId||
        saved.review.candidate.localPackageHash!==hashCanonicalJson(pkg)||
        saved.review.tests.testedPackageHash!==hashCanonicalJson(pkg)||
        !analyzeDependencyGraph(pkg.dependencyGraph).publishable||
        pkg.permissionPolicy.aiInference!=='SELLER'||
        !pkg.dependencyGraph.inference)
        throw new Error('REVIEW_NOT_READY');
      const inference=pkg.dependencyGraph.inference;
      const budget=pkg.permissionPolicy.providerBudget;
      const localBudget=pkg.permissionPolicy.localInference;
      if(inference.mode==='REMOTE_PROVIDER'&&(!budget||localBudget||
        budget.providerId!==inference.provider||budget.modelId!==inference.model)||
        inference.mode==='LOCAL'&&(!localBudget||budget||
        localBudget.providerId!==inference.provider||
        localBudget.modelId!==inference.model||
        localBudget.endpointRef!==inference.endpointRef||!this.deps.localUsage))
        throw new Error('INFERENCE_NOT_READY');
      const connector=budget?
        new OpenAiCompatibleHttpsConnector(budget.providerId,saved.providerEndpoint):
        new LocalOpenAiCompatibleConnector(localBudget!.providerId,
          saved.providerEndpoint);
      const review=saved.review;
      policyValidationHash=hashCanonicalJson({
        candidateHash:hashCanonicalJson(review.candidate),tests:review.tests});
      requiredSecretsReady=budget?
        await this.deps.vault.exists(budget.credentialRef):true;
      requiredSecretsReady=requiredSecretsReady&&
        await checkWorkerResourceReadiness(pkg,this.deps.vault);
      if(!requiredSecretsReady)throw new Error('CREDENTIAL_NOT_READY');
      const approved=await this.deps.imageApproval.assertApprovedImage(
        this.deps.approvedImage);
      if(!isPinnedRuntimeRangeCompatible(
        pkg.workerManifest.runtime.supportedVersionRange,approved.openClawVersion)||
        review.tests.approvedImageDigest!==
          `sha256:${this.deps.approvedImage.split('@sha256:')[1]}`||
        review.tests.openClawVersion!==approved.openClawVersion){
        revalidationRequired=true;throw new Error('RUNTIME_CHANGED');
      }
      const collector=DigestPinnedImageSchema.parse(this.deps.collectorImage);
      if(collector!==this.deps.approvedImage)
        throw new Error('COLLECTOR_NOT_APPROVED');
      // Approval already checked the exact RepoDigests reference and source.
      // Docker's local image ID is a different digest and is not compared here.
      sandboxVerified=true;
      if(localBudget)await (connector as LocalOpenAiCompatibleConnector)
        .checkModel(localBudget.modelId);
      else if(this.deps.checkProviderDestination)
        await this.deps.checkProviderDestination(saved.providerEndpoint);
      else await connector.checkDestination();
      // Construction checks every declared broker tool has a real port.
      // Research RPCs are bound to a specific signed offer only at execution.
      // This admission probe cannot perform a request or bypass that binding.
      new WorkerBrokerRouter(pkg,randomUUID(),{
        completion:new SellerCompletionBroker(budget?this.deps.vault:null,
          connector,budget?this.deps.usage:null,this.deps.localUsage),
        ...(pkg.permissionPolicy.internet?.mode==='PUBLIC_WEB_RESEARCH'&&
          this.deps.cloudResearchRoutingReady?{research:admissionResearchPort}:{}),
        ...(this.deps.resourceUsage?
          createWorkerResourcePorts(pkg,this.deps.vault,this.deps.resourceUsage):{})});
      runtimeHealthy=true;
      const running=this.deps.jobControl.snapshots().filter((item)=>
        item.capabilityVersionId===capabilityVersionId&&
        !['STOPPED','CANCELLED','TIMED_OUT'].includes(item.status)).length;
      unpaused=this.deps.localState.isUnpausedForNewJobOffer(pkg.capabilityId);
      capacityAvailable=running<pkg.concurrencyLimit&&unpaused;
    }catch{/* Fail closed and keep the review hash only for diagnostics. */}
    // A full slot is BUSY, not a broken capability. Admission checks capacity separately.
    return {ready:sandboxVerified&&requiredSecretsReady&&runtimeHealthy&&unpaused,
      checkedAt,policyValidationHash,sandboxVerified,requiredSecretsReady,
      runtimeHealthy,capacityAvailable,revalidationRequired};
  }
}
