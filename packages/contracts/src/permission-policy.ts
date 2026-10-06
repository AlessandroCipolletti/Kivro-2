import { z } from 'zod';
import { InternetPolicySchema } from './internet-policy.js';
import { ReadOnlyResourcePolicySchema } from './local-resource-policy.js';
import { ProviderBudgetPolicySchema } from './provider-budget-policy.js';

const reference = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Internal seller-approved policy. Runtime enforcement must consume this same version. */
export const InternalPermissionPolicySchema = z.strictObject({
  policyVersion: z.literal(1),
  aiInference: z.enum(['NONE', 'SELLER']),
  providerBudget: ProviderBudgetPolicySchema.optional(),
  publicInternet: z.enum(['DENY', 'PUBLIC_RESEARCH_BROKER', 'DECLARED_DOMAINS']),
  internet: InternetPolicySchema.optional(),
  browser: z.boolean(),
  proprietaryDatabase: z.enum(['NONE', 'READ_ONLY', 'LIMITED']),
  privateApi: z.enum(['NONE', 'READ_ONLY', 'LIMITED']),
  selectedFileResourceIds: z.array(reference).max(64),
  selectedDirectoryResourceIds: z.array(reference).max(64),
  localResources: z.array(ReadOnlyResourcePolicySchema).max(32).optional(),
  localSoftware: z.boolean(),
  shell: z.boolean(),
  externalSideEffects: z.boolean(),
  buyerFileAccess: z.boolean(),
  sellerCredentialRefs: z.array(z.string().regex(/^seller:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/)).max(64),
}).superRefine((policy, context) => {
  if (policy.internet && ({ NO_NETWORK: 'DENY', PUBLIC_WEB_RESEARCH: 'PUBLIC_RESEARCH_BROKER', DECLARED_API_ACCESS: 'DECLARED_DOMAINS' } as const)[policy.internet.mode] !== policy.publicInternet) {
    context.addIssue({ code: 'custom', message: 'Detailed Internet mode and public permission disagree' });
  }
  for (const ids of [policy.selectedFileResourceIds, policy.selectedDirectoryResourceIds, policy.sellerCredentialRefs]) {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'Duplicate permission reference' });
  }
  if (policy.localResources && policy.proprietaryDatabase === 'NONE') {
    context.addIssue({ code: 'custom', message: 'Local database broker requires database permission' });
  }
  if (policy.providerBudget && policy.aiInference !== 'SELLER') {
    context.addIssue({ code: 'custom', message: 'Provider budget requires seller inference consent' });
  }
});

export const PermissionCategorySchema = z.enum([
  'AI_INFERENCE', 'PUBLIC_INTERNET', 'BROWSER', 'PROPRIETARY_DATABASE', 'PRIVATE_API',
  'LOCAL_FILES', 'LOCAL_DIRECTORIES', 'LOCAL_SOFTWARE', 'SHELL',
  'EXTERNAL_SIDE_EFFECTS', 'BUYER_FILE_ACCESS',
]);

export const PermissionStateSchema = z.enum([
  'NOT_USED', 'USED', 'READ_ONLY', 'LIMITED', 'SELECTED_ONLY',
  'DECLARED_DOMAINS_ONLY', 'PUBLIC_RESEARCH_ONLY',
]);

export const PublicPermissionManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(z.strictObject({
    category: PermissionCategorySchema,
    state: PermissionStateSchema,
  })).length(11),
}).refine((manifest) => new Set(manifest.entries.map((entry) => entry.category)).size === 11,
  'Each permission category must appear exactly once');

export type InternalPermissionPolicy = z.infer<typeof InternalPermissionPolicySchema>;
export type PublicPermissionManifest = z.infer<typeof PublicPermissionManifestSchema>;
export type PermissionCategory = z.infer<typeof PermissionCategorySchema>;
export type PermissionState = z.infer<typeof PermissionStateSchema>;
