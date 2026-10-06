import {
  InternalPermissionPolicySchema, PublicPermissionManifestSchema,
  type PublicPermissionManifest, type PermissionCategory,
} from '../../contracts/src/permission-policy.js';

/** Deterministic buyer-safe projection. The M04 enforcer must use the same internal policy. */
export function buildPublicPermissionManifest(input: unknown): PublicPermissionManifest {
  const policy = InternalPermissionPolicySchema.parse(input);
  return {
    schemaVersion: 1,
    entries: [
      { category: 'AI_INFERENCE', state: policy.aiInference === 'SELLER' ? 'USED' : 'NOT_USED' },
      { category: 'PUBLIC_INTERNET', state: policy.publicInternet === 'PUBLIC_RESEARCH_BROKER' ? 'PUBLIC_RESEARCH_ONLY' : policy.publicInternet === 'DECLARED_DOMAINS' ? 'DECLARED_DOMAINS_ONLY' : 'NOT_USED' },
      { category: 'BROWSER', state: policy.browser ? 'USED' : 'NOT_USED' },
      { category: 'PROPRIETARY_DATABASE', state: policy.proprietaryDatabase === 'NONE' ? 'NOT_USED' : policy.proprietaryDatabase },
      { category: 'PRIVATE_API', state: policy.privateApi === 'NONE' ? 'NOT_USED' : policy.privateApi },
      { category: 'LOCAL_FILES', state: policy.selectedFileResourceIds.length ? 'SELECTED_ONLY' : 'NOT_USED' },
      { category: 'LOCAL_DIRECTORIES', state: policy.selectedDirectoryResourceIds.length ? 'SELECTED_ONLY' : 'NOT_USED' },
      { category: 'LOCAL_SOFTWARE', state: policy.localSoftware ? 'LIMITED' : 'NOT_USED' },
      { category: 'SHELL', state: policy.shell ? 'USED' : 'NOT_USED' },
      { category: 'EXTERNAL_SIDE_EFFECTS', state: policy.externalSideEffects ? 'USED' : 'NOT_USED' },
      { category: 'BUYER_FILE_ACCESS', state: policy.buyerFileAccess ? 'LIMITED' : 'NOT_USED' },
    ],
  };
}

/** Conservative: every changed active state is shown as an expansion needing seller review. */
export function permissionExpansion(
  previous: PublicPermissionManifest,
  next: PublicPermissionManifest,
): readonly PermissionCategory[] {
  const prior = PublicPermissionManifestSchema.parse(previous);
  const current = PublicPermissionManifestSchema.parse(next);
  const priorByCategory = new Map(prior.entries.map((entry) => [entry.category, entry.state]));
  return current.entries
    .filter((entry) => entry.state !== 'NOT_USED' && entry.state !== priorByCategory.get(entry.category))
    .map((entry) => entry.category);
}
