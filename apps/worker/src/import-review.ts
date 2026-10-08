import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { PriceSnapshotSchema } from '../../../packages/contracts/src/pricing.js';
import { WorkerCapabilityReviewSchema, type WorkerCapabilityReview } from
  '../../../packages/contracts/src/seller-publication.js';
import { buildVersionCandidate } from '../../../packages/domain/src/capability-version.js';
import type { runRepresentativePackageTest } from './import-review-runner.js';

type Tested=Awaited<ReturnType<typeof runRepresentativePackageTest>>;
const input=z.strictObject({versionNumber:z.number().int().positive().max(1_000_000),
  selectedPrice:PriceSnapshotSchema,
  externalProcessors:z.array(z.string().trim().min(2).max(160)).max(16)});
export const WorkerPrivateReviewConfigSchema=input.extend({
  providerEndpoint:z.url(),
  /** Local review requests leave from the seller host; paid jobs use cloud egress. */
  reviewResearchEgressApproval:z.literal(true).optional(),
  sampleInput:z.strictObject({values:z.record(z.string(),z.unknown()),
    assets:z.record(z.string(),z.array(z.uuid()))}),
  sampleFiles:z.array(z.strictObject({
    fieldKey:z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    assetId:z.uuid(),extension:z.string().regex(/^\.[a-z0-9]{1,16}$/),
    detectedMimeType:z.string().min(3).max(120),
    bytesBase64:z.base64().max(11_200_000),
  })).max(32).optional(),
});

export function buildWorkerCapabilityReview(tested:Tested,raw:unknown,context:{
  readonly workerDeviceId:string;readonly controlPlaneId:string;
  readonly providerUsage:{requests:number;estimatedMicroUsd:number;unsettled:number}}):
  WorkerCapabilityReview {
  const config=input.parse(raw),pkg=tested.reviewedPackage;
  const inference=pkg.dependencyGraph.inference;
  const budget=pkg.permissionPolicy.providerBudget;
  const localBudget=pkg.permissionPolicy.localInference;
  const hasExternalAccess=pkg.permissionPolicy.publicInternet!=='DENY'||
    pkg.permissionPolicy.privateApi!=='NONE'||
    pkg.permissionPolicy.externalSideEffects;
  if(!inference||pkg.permissionPolicy.aiInference!=='SELLER'||
    pkg.workerDeviceId!==z.uuid().parse(context.workerDeviceId)||
    config.selectedPrice.tier!==pkg.priceTier||
    context.providerUsage.requests<1||context.providerUsage.unsettled!==0||
    (inference.mode==='REMOTE_PROVIDER'&&(!budget||localBudget||
      !config.externalProcessors.includes(budget.providerId)||
      context.providerUsage.estimatedMicroUsd>budget.maxEstimatedSpendMicroUsdPerJob))||
    (inference.mode==='LOCAL'&&(!localBudget||budget||
      (hasExternalAccess?config.externalProcessors.length===0:
        config.externalProcessors.length!==0)||
      context.providerUsage.estimatedMicroUsd!==0)))
    throw new TypeError('REVIEW_NOT_READY');
  const candidate=buildVersionCandidate({id:pkg.capabilityVersionId,
    capabilityId:pkg.capabilityId,versionNumber:config.versionNumber,
    workerDeviceId:context.workerDeviceId,requestedAt:new Date().toISOString(),
    localPackage:pkg,selectedPrice:config.selectedPrice,
    externalProcessors:config.externalProcessors});
  const graphHash=hashCanonicalJson(pkg.dependencyGraph);
  return WorkerCapabilityReviewSchema.parse({type:'CAPABILITY_REVIEW',
    protocolVersion:'kivro-worker/1',messageId:randomUUID(),
    controlPlaneId:context.controlPlaneId,workerDeviceId:context.workerDeviceId,
    candidate,inferenceMode:inference.mode,
    requiredConsents:pkg.dependencyGraph.nodes.filter((node)=>node.selected)
      .map((node)=>({dependencyId:node.id,permissionType:node.type,
        permissionValueRef:node.id,
        sellerLabel:node.type==='LOCAL_FILE'?'Selected local file':
          node.type==='LOCAL_DIRECTORY'?'Selected local directory':node.name})),
    providerCost:inference.mode==='REMOTE_PROVIDER'&&budget?{
      estimatedMicroUsd:context.providerUsage.estimatedMicroUsd,
      estimateSource:'SELLER_ENTERED',maxMicroUsdPerJob:budget.maxEstimatedSpendMicroUsdPerJob,
      maxRequestsPerJob:budget.maxRequestsPerJob,
      maxDailyMicroUsd:budget.maxDailyProviderSpendMicroUsd??null}:{
        estimatedMicroUsd:0,estimateSource:'LOCAL_NO_API_BILL',maxMicroUsdPerJob:0,
        maxRequestsPerJob:localBudget!.maxRequestsPerJob,maxDailyMicroUsd:0},
    tests:{testedPackageHash:hashCanonicalJson(pkg),
      testedManifestHash:candidate.workerManifestHash,
      testedPermissionPolicyHash:candidate.permissionPolicyHash,
      testedDependencyGraphHash:graphHash,observedDependencyGraphHash:graphHash,
      dependencyHealth:tested.dependencyHealth,
      representativeJob:tested.representativeJob,
      observedVsDeclared:tested.observedVsDeclared,
      securityProbes:tested.securityProbes,outputContract:tested.outputContract,
      testedAt:tested.testedAt,approvedImageDigest:tested.approvedImageDigest,
      openClawVersion:tested.openClawVersion}});
}
