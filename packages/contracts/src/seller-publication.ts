import { z } from 'zod';
import { hashCanonicalJson } from './canonical-json.js';
import { CapabilityVersionCandidateSchema, DigestSchema } from './capability-version.js';
import { DependencyTypeSchema } from './dependency-graph.js';
import { AvailabilityPolicySchema } from './availability.js';

const reference = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Seller-safe projection. The full package, paths, instructions and secrets stay on the Worker. */
export const WorkerCapabilityReviewSchema = z.strictObject({
  type: z.literal('CAPABILITY_REVIEW'),
  protocolVersion: z.literal('kivro-worker/1'),
  messageId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  workerDeviceId: z.uuid(),
  candidate: CapabilityVersionCandidateSchema,
  inferenceMode: z.enum(['REMOTE_PROVIDER','LOCAL']),
  requiredConsents: z.array(z.strictObject({ dependencyId: reference,
    permissionType: DependencyTypeSchema, permissionValueRef: reference,
    sellerLabel: z.string().trim().min(1).max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 ._:-]*$/) })).min(1).max(128),
  providerCost: z.strictObject({
    estimatedMicroUsd: z.number().int().nonnegative().nullable(),
    estimateSource: z.enum(['PROVIDER_PRICING','SELLER_ENTERED','UNKNOWN','LOCAL_NO_API_BILL']),
    maxMicroUsdPerJob: z.number().int().nonnegative(),
    maxRequestsPerJob: z.number().int().positive().max(10_000),
    maxDailyMicroUsd: z.number().int().nonnegative().nullable(),
  }),
  tests: z.strictObject({
    testedPackageHash: DigestSchema,
    testedManifestHash: DigestSchema,
    testedPermissionPolicyHash: DigestSchema,
    testedDependencyGraphHash: DigestSchema,
    observedDependencyGraphHash: DigestSchema,
    dependencyHealth: DigestSchema,
    representativeJob: DigestSchema,
    observedVsDeclared: DigestSchema,
    securityProbes: DigestSchema,
    outputContract: DigestSchema,
    testedAt: z.iso.datetime(),
    approvedImageDigest: DigestSchema,
    openClawVersion: z.string().min(1).max(80),
  }),
}).superRefine((value, ctx) => {
  if (value.candidate.workerDeviceId !== value.workerDeviceId) {
    ctx.addIssue({ code: 'custom', message: 'Worker identity mismatch' });
  }
  if(value.candidate.sellerInferenceConfigHash===null){
    ctx.addIssue({code:'custom',message:'Published OpenClaw capability requires seller inference'});
  }
  if(value.tests.testedPackageHash!==value.candidate.localPackageHash||
    value.tests.testedManifestHash!==value.candidate.workerManifestHash||
    value.tests.testedPermissionPolicyHash!==value.candidate.permissionPolicyHash||
    value.tests.testedDependencyGraphHash!==value.candidate.dependencyGraphHash||
    value.tests.observedDependencyGraphHash!==value.candidate.dependencyGraphHash){
    ctx.addIssue({code:'custom',message:'Local test evidence does not match reviewed package or observed dependencies'});
  }
  const keys = value.requiredConsents.map((entry) => entry.dependencyId);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate consent dependency' });
  }
  const types=new Set(value.requiredConsents.map((entry)=>entry.permissionType));
  if(!types.has('SKILL')||!types.has('AI_MODEL')||!types.has('AI_PROVIDER')||
    !types.has(value.inferenceMode==='REMOTE_PROVIDER'?'CREDENTIAL':'LOCAL_SERVICE')){
    ctx.addIssue({code:'custom',message:'Incomplete inference and skill permission review'});
  }
  if(value.inferenceMode==='REMOTE_PROVIDER'&&
    (value.providerCost.maxMicroUsdPerJob===0||
      value.providerCost.estimateSource==='LOCAL_NO_API_BILL')||
    value.inferenceMode==='LOCAL'&&
    (value.providerCost.estimateSource!=='LOCAL_NO_API_BILL'||
      value.providerCost.estimatedMicroUsd!==0)){
    ctx.addIssue({code:'custom',message:'Provider cost disclosure is inconsistent with inference mode'});
  }
  if(value.providerCost.estimateSource==='UNKNOWN'&&
    value.providerCost.estimatedMicroUsd!==null){
    ctx.addIssue({code:'custom',message:'Unknown provider cost cannot be presented as an estimate'});
  }
});

const publicText = z.string().trim().min(1).max(160);
export const SellerPublicationApprovalSchema = z.strictObject({
  reviewId: z.uuid(),
  capabilityVersionId: z.uuid(),
  candidateHash: DigestSchema,
  manifestHash: DigestSchema,
  packageHash: DigestSchema,
  policyValidationHash: DigestSchema,
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/),
  name: publicText,
  description: z.string().trim().min(20).max(4000),
  category: z.enum(['RESEARCH','DATA_ANALYSIS','DOCUMENTS','DEVELOPMENT','MEDIA','BUSINESS','OTHER']),
  shortDescription: z.string().trim().min(20).max(320),
  tags: z.array(z.string().trim().min(2).max(40)).max(8),
  strengths: z.array(z.string().trim().min(2).max(160)).max(8),
  limitations: z.array(z.string().trim().min(2).max(160)).max(8),
  visibility: z.enum(['PRIVATE','UNLISTED','PUBLIC']),
  availability: AvailabilityPolicySchema,
  consentDependencyIds: z.array(reference).min(1).max(128),
  providerCostAcknowledged: z.literal(true),
  localPermissionReviewAcknowledged: z.literal(true).optional(),
  versionChangeAcknowledged: z.literal(true).optional(),
  approvedAt: z.iso.datetime(),
}).superRefine((value, ctx) => {
  if (new Set(value.consentDependencyIds).size !== value.consentDependencyIds.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate seller approval' });
  }
  if (value.tags.length !== new Set(value.tags).size) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate tags' });
  }
});

export type WorkerCapabilityReview = z.infer<typeof WorkerCapabilityReviewSchema>;
export type SellerPublicationApproval = z.infer<typeof SellerPublicationApprovalSchema>;

/** Stable tested content across transport retries and control-plane migration.
 * Message identity and plane ownership remain authenticated by the envelope. */
export function workerReviewContentHash(raw:unknown):`sha256:${string}`{
  const review=WorkerCapabilityReviewSchema.parse(raw);
  return hashCanonicalJson({...review,messageId:undefined,controlPlaneId:undefined});
}
