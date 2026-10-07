import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import type { LocalCapabilityPackage } from '../../../packages/contracts/src/capability-package.js';
import { securitySurfaceExpansion } from '../../../packages/policy-engine/src/permission-diff.js';
import { WorkerCapabilityPackageStore } from './capability-package-store.js';

export class ImportPermissionReviewError extends Error {
  constructor(readonly code: 'PACKAGE_OWNER_MISMATCH' | 'VERSION_MISMATCH') {
    super(code);
    this.name = 'ImportPermissionReviewError';
  }
}

/** This projection stays on the seller's Worker. It contains references, never secret values. */
export function projectLocalPermissionReview(current: LocalCapabilityPackage,
  previous: LocalCapabilityPackage | null): {
    capabilityId: string; capabilityVersionId: string; packageHash: string;
    manifestHash: string; policyHash: string; previousVersionId: string | null;
    permissionPolicy: LocalCapabilityPackage['permissionPolicy'];
    workerManifest: LocalCapabilityPackage['workerManifest'];
    selectedDependencies: readonly { type: string; name: string; id: string }[];
    newOrChangedAccess: ReturnType<typeof securitySurfaceExpansion>;
  } {
  if (previous && (previous.capabilityId !== current.capabilityId ||
    previous.workerDeviceId !== current.workerDeviceId ||
    previous.capabilityVersionId === current.capabilityVersionId)) {
    throw new ImportPermissionReviewError('VERSION_MISMATCH');
  }
  return {
    capabilityId: current.capabilityId,
    capabilityVersionId: current.capabilityVersionId,
    packageHash: hashCanonicalJson(current),
    manifestHash: hashCanonicalJson(current.workerManifest),
    policyHash: hashCanonicalJson(current.permissionPolicy),
    previousVersionId: previous?.capabilityVersionId ?? null,
    permissionPolicy: current.permissionPolicy,
    workerManifest: current.workerManifest,
    selectedDependencies: current.dependencyGraph.nodes.filter((node) => node.selected)
      .map(({ type, name, id }) => ({ type, name, id })),
    newOrChangedAccess: securitySurfaceExpansion(previous ?? emptySecuritySurface(current), current),
  };
}

function emptySecuritySurface(current: LocalCapabilityPackage): {
  permissionPolicy: LocalCapabilityPackage['permissionPolicy'];
  workerManifest: LocalCapabilityPackage['workerManifest'];
  dependencyGraph: LocalCapabilityPackage['dependencyGraph'];
} {
  return {
    permissionPolicy: {
      policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY', browser: false,
      proprietaryDatabase: 'NONE', privateApi: 'NONE', selectedFileResourceIds: [],
      selectedDirectoryResourceIds: [], localSoftware: false, shell: false,
      externalSideEffects: false, buyerFileAccess: false, sellerCredentialRefs: [],
    },
    workerManifest: { ...current.workerManifest, skills: [],
      tools: { allow: [], deny: [] }, resources: [], network: { default: 'deny', allow: [] } },
    dependencyGraph: { ...current.dependencyGraph, inference: null, alternatives: [],
      nodes: current.dependencyGraph.nodes.map((node) => ({ ...node, selected: false })) },
  };
}

/** Loads only verified local packages bound to this paired device. */
export function readLocalPermissionReview(stateDir: string, deviceId: string,
  versionId: string, priorVersionId?: string): ReturnType<typeof projectLocalPermissionReview> {
  const packages = new WorkerCapabilityPackageStore(stateDir);
  try {
    const current = packages.load(versionId);
    const previous = priorVersionId ? packages.load(priorVersionId) : null;
    if (current.workerDeviceId !== deviceId ||
      previous && previous.workerDeviceId !== deviceId) {
      throw new ImportPermissionReviewError('PACKAGE_OWNER_MISMATCH');
    }
    return projectLocalPermissionReview(current, previous);
  } finally { packages.close(); }
}
