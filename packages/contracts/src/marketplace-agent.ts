import { z } from 'zod';
import { PermissionCategorySchema, PermissionStateSchema } from './permission-policy.js';
import { MarketplaceCategorySchema } from './marketplace.js';

const id = z.uuid();
const minor = z.number().int().min(0).max(1_000_000);
const shortText = z.string().trim().min(1).max(500);

export const AgentTimingPolicySchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('IMMEDIATE'), maxQueueWaitSeconds: z.number().int().min(0).max(604800) }),
  z.strictObject({ mode: z.literal('EARLIEST_AVAILABLE_ALLOWED'), maxQueueWaitSeconds: z.number().int().min(0).max(604800) }),
  z.strictObject({ mode: z.literal('DEADLINE'), maxQueueWaitSeconds: z.number().int().min(0).max(604800), deadlineAt: z.iso.datetime() }),
]);
export type AgentTimingPolicy = z.infer<typeof AgentTimingPolicySchema>;

/** Buyer-authored controls are applied after extraction. The model cannot loosen them. */
export const BuyerAgentConstraintsSchema = z.strictObject({
  maxTotalSpendMinor: minor.optional(),
  maxPerJobSpendMinor: minor.optional(),
  minRating: z.number().min(1).max(5).optional(),
  onlineOnly: z.boolean().default(false),
  maxRuntimeSeconds: z.number().int().positive().max(86_400).optional(),
  maxJobs: z.number().int().min(1).max(16).optional(),
  category: MarketplaceCategorySchema.optional(),
  outputTypes: z.array(z.string().min(1).max(80)).max(8).default([]),
  requiredInputTypes: z.array(z.string().min(1).max(80)).max(8).default([]),
  blockedSellerIds: z.array(id).max(50).default([]),
  preferredCapabilityIds: z.array(id).max(50).default([]),
  permissionLimits: z.array(z.strictObject({ category: PermissionCategorySchema,
    allowedStates: z.array(PermissionStateSchema).min(1).max(7) })).max(11).default([]),
  timing: AgentTimingPolicySchema.default({ mode: 'IMMEDIATE', maxQueueWaitSeconds: 0 }),
});
export type BuyerAgentConstraints = z.infer<typeof BuyerAgentConstraintsSchema>;

export const ExtractedIntentSchema = z.strictObject({
  searchQuery: z.string().trim().max(160),
  goal: z.string().trim().min(1).max(2000),
  requirements: z.array(shortText).max(8),
  missingInformation: z.array(shortText).max(8),
  suggestedCategory: MarketplaceCategorySchema.nullable(),
  suggestedOutputTypes: z.array(z.string().min(1).max(80)).max(8),
  suggestedInputTypes: z.array(z.string().min(1).max(80)).max(8),
  extractedMaxSpendMinor: minor.nullable(),
  extractedMinRating: z.number().min(1).max(5).nullable(),
  extractedOnlineOnly: z.boolean(),
});
export type ExtractedIntent = z.infer<typeof ExtractedIntentSchema>;

export const AgentRecommendationSchema = z.strictObject({
  capabilityId: id, capabilityVersionId: id, slug: z.string(), name: z.string(),
  sellerId: id, priceMinor: minor, currency: z.literal('USD'),
  rating: z.number().min(1).max(5).nullable(), reviewCount: z.number().int().nonnegative(),
  availability: z.string(), nextAvailableAt: z.iso.datetime().nullable(),
  executionEligible: z.boolean(),
  typicalRuntimeSeconds: z.number().int().nonnegative().nullable(),
  score: z.number().finite(), why: z.array(shortText).min(1).max(5),
  limitations: z.array(z.string().max(500)).max(5),
});

export const AgentInputDraftSchema = z.strictObject({
  capabilityId: id, capabilityVersionId: id,
  values: z.record(z.string(), z.unknown()),
  assets: z.record(z.string(), z.array(id)),
  missingFieldKeys: z.array(z.string()).max(64),
  warnings: z.array(shortText).max(16),
});

export const AgentStepMappingSchema = z.strictObject({
  sourceStepId: id, sourceOutputKey: z.string().min(1).max(64),
  targetInputKey: z.string().min(1).max(64),
});
export const AgentPlanStepSchema = z.strictObject({
  id, capabilityId: id, capabilityVersionId: id,
  nameSnapshot:z.string().trim().min(1).max(200),slugSnapshot:z.string().trim().min(1).max(200),
  availabilityStatusAtQuote:z.string().trim().min(1).max(50),
  earliestEligibleAt:z.iso.datetime(),
  quoteId: id, jobId: id, reservationId: id, manifestId: id,
  quotedPriceMinor: minor.positive(), quoteExpiresAt: z.iso.datetime(),
  dependsOn: z.array(id).max(16),
  inputValues: z.record(z.string(), z.unknown()),
  inputAssets: z.record(z.string(), z.array(id)),
  mappings: z.array(AgentStepMappingSchema).max(64),
  status: z.enum(['PLANNED','READY','PURCHASING','PAYMENT_RESERVED','RUNNING',
    'COMPLETED','FAILED','SKIPPED','AWAITING_REAPPROVAL']),
});
export const AgentPlanSchema = z.strictObject({
  id, buyerId: id, conversationId: id, goal: z.string().min(1).max(2000),
  constraints: BuyerAgentConstraintsSchema, approvalMode: z.literal('APPROVE_PLAN'),
  maxBudgetMinor: minor.positive(), quotedTotalMinor: minor,
  status: z.enum(['DRAFT','AWAITING_APPROVAL','RUNNING','CANCELLING','AWAITING_REAPPROVAL',
    'COMPLETED','FAILED','CANCELLED']),
  steps: z.array(AgentPlanStepSchema).min(1).max(16),
  createdAt: z.iso.datetime(), approvedAt: z.iso.datetime().nullable(),
});
export type AgentPlan = z.infer<typeof AgentPlanSchema>;

export const AgentFinalResultSchema=z.strictObject({
  kind:z.literal('PROVENANCE_SUMMARY'),
  note:z.string().min(1).max(500),
  jobs:z.array(z.strictObject({stepId:id,jobId:id,priceMinor:minor})).min(1).max(16),
  finalJobIds:z.array(id).min(1).max(16),
  spentMinor:minor,unusedAuthorizationMinor:minor,completedAt:z.iso.datetime(),
});
export type AgentFinalResult=z.infer<typeof AgentFinalResultSchema>;

export const AgentInferenceTaskSchema = z.enum([
  'INTENT_EXTRACTION','DISCOVERY_RERANK','RECOMMENDATION',
  'ORCHESTRATION_PLANNING','INPUT_PREPARATION','RESULT_SYNTHESIS',
]);
export type AgentInferenceTask = z.infer<typeof AgentInferenceTaskSchema>;

export const AgentToolNameSchema = z.enum([
  'search_capabilities','get_capability','get_capability_version',
  'get_reviews_summary','get_price_quote','get_availability','estimate_job',
  'create_job_draft','create_orchestration_plan','validate_plan',
  'get_job_status','get_job_result',
]);

export const AgentConversationMessageSchema = z.strictObject({
  id, role: z.enum(['BUYER','AGENT','SYSTEM_NOTICE']),
  body: z.string().max(20_000), createdAt: z.iso.datetime(),
  references: z.array(z.strictObject({ kind: z.enum(['CAPABILITY','JOB','PLAN','ASSET']), id })).max(32),
});
