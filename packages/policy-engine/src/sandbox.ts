import { OfflineSandboxPlanSchema, DigestPinnedImageSchema,
  type OfflineSandboxPlan } from '../../contracts/src/sandbox.js';
import { InternalPermissionPolicySchema } from '../../contracts/src/permission-policy.js';
import { WorkerManifestSchema } from '../../contracts/src/worker-manifest.js';

export class SandboxPolicyError extends Error {
  constructor(readonly code: 'IMAGE_NOT_APPROVED' | 'NETWORK_BROKER_REQUIRED' |
    'RESOURCE_BROKER_REQUIRED' | 'TOOL_UNSUPPORTED' | 'BROWSER_UNSUPPORTED' |
    'LIMIT_EXCEEDED', message: string) {
    super(message); this.name = 'SandboxPolicyError';
  }
}

/**
 * Platform minimums are not seller settings. This profile is only suitable for offline canaries;
 * provider/resource access requires a separately tested broker policy in M06.
 */
export function buildOfflineSandboxPlan(rawManifest: unknown, rawPolicy: unknown,
  image: string, approvedImage: string): Readonly<OfflineSandboxPlan> {
  const manifest = WorkerManifestSchema.parse(rawManifest);
  const policy = InternalPermissionPolicySchema.parse(rawPolicy);
  DigestPinnedImageSchema.parse(image);
  DigestPinnedImageSchema.parse(approvedImage);
  if (image !== approvedImage) throw new SandboxPolicyError('IMAGE_NOT_APPROVED', 'Image differs from platform approval');
  if (manifest.network.allow.length || policy.publicInternet !== 'DENY' || policy.aiInference === 'SELLER') {
    throw new SandboxPolicyError('NETWORK_BROKER_REQUIRED', 'Network or inference requires an approved broker');
  }
  if (policy.browser || manifest.tools.allow.includes('browser')) {
    throw new SandboxPolicyError('BROWSER_UNSUPPORTED', 'Personal or arbitrary browser execution is unavailable');
  }
  if (manifest.resources.length || policy.selectedFileResourceIds.length || policy.selectedDirectoryResourceIds.length ||
    policy.sellerCredentialRefs.length || policy.proprietaryDatabase !== 'NONE' || policy.privateApi !== 'NONE') {
    throw new SandboxPolicyError('RESOURCE_BROKER_REQUIRED', 'Seller resources require an approved broker');
  }
  if (manifest.tools.allow.length || policy.localSoftware || policy.shell || policy.externalSideEffects) {
    throw new SandboxPolicyError('TOOL_UNSUPPORTED', 'Tools and side effects are unavailable in the offline profile');
  }
  const limits = manifest.limits;
  const parsed = OfflineSandboxPlanSchema.safeParse({
    planVersion: 1, image, networkMode: 'none', readOnlyRoot: true,
    capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin', runAs: '65532:65532',
    maxRuntimeSeconds: limits.timeoutSeconds, memoryMb: limits.memoryMb,
    cpu: limits.cpu, maxPids: limits.maxPids, maxOutputBytes: limits.maxOutputBytes,
  });
  if (!parsed.success) throw new SandboxPolicyError('LIMIT_EXCEEDED', 'Manifest limits exceed platform sandbox bounds');
  return Object.freeze(parsed.data);
}
