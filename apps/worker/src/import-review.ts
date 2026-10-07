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
  externalProcessors:z.array(z.string().trim().min(2).max(160)).min(1).max(16)});
export const WorkerPrivateReviewConfigSchema=input.extend({
  providerEndpoint:z.url(),
  sampleInput:z.strictObject({values:z.record(z.string(),z.unknown()),
    assets:z.record(z.string(),z.array(z.uuid()))}),
});

export function buildWorkerCapabilityReview(tested:Tested,raw:unknown,context:{
  readonly workerDeviceId:string;readonly controlPlaneId:string;
  readonly providerUsage:{requests:number;estimatedMicroUsd:number;unsettled:number}}):
  WorkerCapabilityReview {
  const config=input.parse(raw),pkg=tested.reviewedPackage;
  const budget=pkg.permissionPolicy.providerBudget;
  if(!budget||pkg.permissionPolicy.aiInference!=='SELLER'||
    pkg.dependencyGraph.inference?.mode!=='REMOTE_PROVIDER'||
    pkg.workerDeviceId!==z.uuid().parse(context.workerDeviceId)||
    config.selectedPrice.tier!==pkg.priceTier||
    !config.externalProcessors.includes(budget.providerId)||
    context.providerUsage.requests<1||context.providerUsage.unsettled!==0||
    context.providerUsage.estimatedMicroUsd>budget.maxEstimatedSpendMicroUsdPerJob)
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
    candidate,inferenceMode:'REMOTE_PROVIDER',
    requiredConsents:pkg.dependencyGraph.nodes.filter((node)=>node.selected)
      .map((node)=>({dependencyId:node.id,permissionType:node.type,
        permissionValueRef:node.id,sellerLabel:node.name})),
    providerCost:{estimatedMicroUsd:context.providerUsage.estimatedMicroUsd,
      estimateSource:'SELLER_ENTERED',maxMicroUsdPerJob:budget.maxEstimatedSpendMicroUsdPerJob,
      maxRequestsPerJob:budget.maxRequestsPerJob,
      maxDailyMicroUsd:budget.maxDailyProviderSpendMicroUsd??null},
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
