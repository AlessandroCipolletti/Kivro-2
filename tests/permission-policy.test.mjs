import assert from 'node:assert/strict';
import test from 'node:test';
import { InternalPermissionPolicySchema, PublicPermissionManifestSchema } from '../dist/packages/contracts/src/permission-policy.js';
import { buildPublicPermissionManifest, permissionExpansion } from '../dist/packages/policy-engine/src/public-manifest.js';

const policy = {
  policyVersion: 1,
  aiInference: 'SELLER', publicInternet: 'PUBLIC_RESEARCH_BROKER', browser: false,
  proprietaryDatabase: 'READ_ONLY', privateApi: 'NONE',
  selectedFileResourceIds: ['seller-dataset-1'], selectedDirectoryResourceIds: [],
  localSoftware: false, shell: false, externalSideEffects: false,
  buyerFileAccess: true, sellerCredentialRefs: ['seller:provider-key-ref'],
};

test('public manifest is derived from internal policy and omits seller identifiers', () => {
  const manifest = buildPublicPermissionManifest(policy);
  assert.equal(PublicPermissionManifestSchema.safeParse(manifest).success, true);
  assert.deepEqual(manifest.entries.find((entry) => entry.category === 'PUBLIC_INTERNET'),
    { category: 'PUBLIC_INTERNET', state: 'PUBLIC_RESEARCH_ONLY' });
  assert.deepEqual(manifest.entries.find((entry) => entry.category === 'LOCAL_FILES'),
    { category: 'LOCAL_FILES', state: 'SELECTED_ONLY' });
  assert.doesNotMatch(JSON.stringify(manifest), /seller-dataset|provider-key|credential|hostname|path/i);
  assert.equal(InternalPermissionPolicySchema.safeParse({ ...policy, apiKey: 'secret' }).success, false);
  assert.equal(InternalPermissionPolicySchema.safeParse({ ...policy, sellerCredentialRefs: ['platform:operator-key'] }).success, false);
});

test('permission changes that grant or alter active powers require seller review', () => {
  const previous = buildPublicPermissionManifest({ ...policy, publicInternet: 'DENY', browser: false });
  const expanded = buildPublicPermissionManifest({ ...policy, browser: true });
  assert.deepEqual(permissionExpansion(previous, expanded), ['PUBLIC_INTERNET', 'BROWSER']);
  const reduced = buildPublicPermissionManifest({ ...policy, publicInternet: 'DENY', aiInference: 'NONE' });
  assert.deepEqual(permissionExpansion(expanded, reduced), []);
  const changedActive = buildPublicPermissionManifest({ ...policy, publicInternet: 'DECLARED_DOMAINS' });
  assert.deepEqual(permissionExpansion(expanded, changedActive), ['PUBLIC_INTERNET']);
});

test('public manifest cannot omit or duplicate a permission category', () => {
  const manifest = buildPublicPermissionManifest(policy);
  assert.equal(PublicPermissionManifestSchema.safeParse({ ...manifest, entries: [...manifest.entries.slice(0, 10), manifest.entries[0]] }).success, false);
});
