import { randomUUID } from 'node:crypto';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { SellerCompletionBroker } from '../../../packages/application/src/completion-broker.js';
import { DigestPinnedImageSchema } from '../../../packages/contracts/src/sandbox.js';
import { analyzeDependencyGraph } from '../../../packages/domain/src/dependency-graph.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
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

export interface RuntimeReadinessDeps {
  readonly deviceId:string;readonly sellerAccountId:string;
  readonly packages:WorkerCapabilityPackageStore;
  readonly reviews:WorkerImportReviewOutbox;
  readonly vault:KeychainSellerCredentialVault;
  readonly usage:WorkerProviderUsage;
  readonly imageApproval:OpenClawImageApproval;
  readonly approvedImage:string;readonly collectorImage:string;
  readonly jobControl:WorkerJobControl;
  readonly localState:WorkerLocalState;
  readonly checkProviderDestination?:(endpoint:string)=>Promise<void>;
}

/** Every offer checks the exact reviewed bytes and current host prerequisites.
 * A stale/unknown component can only lower capability readiness. */
export class WorkerRuntimeReadiness implements CapabilityAdmissionReadinessPort {
  constructor(private readonly deps:RuntimeReadinessDeps){}

  async check(capabilityVersionId:string){
    const checkedAt=new Date().toISOString();
    let policyValidationHash:string|null=null;
    let sandboxVerified=false,requiredSecretsReady=false,runtimeHealthy=false;
    let capacityAvailable=false;
    try{
      const pkg=this.deps.packages.load(capabilityVersionId);
      this.deps.packages.loadReviewedSkills(capabilityVersionId);
      const saved=this.deps.reviews.load(capabilityVersionId,this.deps.sellerAccountId);
      if(!saved?.sentAt||!saved.providerEndpoint||
        pkg.workerDeviceId!==this.deps.deviceId||
        saved.review.workerDeviceId!==this.deps.deviceId||
        saved.review.candidate.localPackageHash!==hashCanonicalJson(pkg)||
        saved.review.tests.testedPackageHash!==hashCanonicalJson(pkg)||
        !analyzeDependencyGraph(pkg.dependencyGraph).publishable||
        pkg.permissionPolicy.aiInference!=='SELLER'||
        pkg.dependencyGraph.inference?.mode!=='REMOTE_PROVIDER')
        throw new Error('REVIEW_NOT_READY');
      const budget=pkg.permissionPolicy.providerBudget;
      if(!budget||budget.providerId!==pkg.dependencyGraph.inference.provider||
        budget.modelId!==pkg.dependencyGraph.inference.model)
        throw new Error('INFERENCE_NOT_READY');
      new OpenAiCompatibleHttpsConnector(budget.providerId,saved.providerEndpoint);
      const review=saved.review;
      policyValidationHash=hashCanonicalJson({
        candidateHash:hashCanonicalJson(review.candidate),tests:review.tests});
      requiredSecretsReady=await this.deps.vault.exists(budget.credentialRef);
      if(!requiredSecretsReady)throw new Error('CREDENTIAL_NOT_READY');
      const approved=await this.deps.imageApproval.assertApprovedImage(
        this.deps.approvedImage);
      if(!isPinnedRuntimeRangeCompatible(
        pkg.workerManifest.runtime.supportedVersionRange,approved.openClawVersion)||
        review.tests.approvedImageDigest!==
          `sha256:${this.deps.approvedImage.split('@sha256:')[1]}`||
        review.tests.openClawVersion!==approved.openClawVersion)
        throw new Error('RUNTIME_CHANGED');
      const collector=DigestPinnedImageSchema.parse(this.deps.collectorImage);
      if(collector!==this.deps.approvedImage)
        throw new Error('COLLECTOR_NOT_APPROVED');
      // Approval already checked the exact RepoDigests reference and source.
      // Docker's local image ID is a different digest and is not compared here.
      sandboxVerified=true;
      const connector=new OpenAiCompatibleHttpsConnector(budget.providerId,
        saved.providerEndpoint);
      if(this.deps.checkProviderDestination)
        await this.deps.checkProviderDestination(saved.providerEndpoint);
      else await connector.checkDestination();
      // Construction checks every declared broker tool has a real port.
      new WorkerBrokerRouter(pkg,randomUUID(),{
        completion:new SellerCompletionBroker(this.deps.vault,connector,this.deps.usage)});
      runtimeHealthy=true;
      const running=this.deps.jobControl.snapshots().filter((item)=>
        item.capabilityVersionId===capabilityVersionId&&
        !['STOPPED','CANCELLED','TIMED_OUT'].includes(item.status)).length;
      capacityAvailable=running<pkg.concurrencyLimit&&
        this.deps.localState.isUnpausedForNewJobOffer(pkg.capabilityId);
    }catch{/* Fail closed and keep the review hash only for diagnostics. */}
    return {ready:sandboxVerified&&requiredSecretsReady&&runtimeHealthy&&capacityAvailable,
      checkedAt,policyValidationHash,sandboxVerified,requiredSecretsReady,
      runtimeHealthy,capacityAvailable};
  }
}
