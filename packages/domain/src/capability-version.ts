import { CapabilityIOContractSchema } from '../../contracts/src/capability-io.js';
import {
  CapabilityVersionCandidateSchema, PublishedCapabilityVersionSchema, DigestSchema,
  type CapabilityVersionCandidate, type PublishedCapabilityVersion, type JobContractSnapshot,
  JobContractSnapshotSchema,
} from '../../contracts/src/capability-version.js';
import { LocalCapabilityPackageSchema } from '../../contracts/src/capability-package.js';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { buildPublicPermissionManifest } from '../../policy-engine/src/public-manifest.js';
import { hashWorkerManifest } from '../../contracts/src/worker-manifest.js';
import { priceForTier } from './pricing.js';

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

export interface VersionCandidateInput {
  readonly id: string;
  readonly capabilityId: string;
  readonly versionNumber: number;
  readonly workerDeviceId: string;
  readonly requestedAt: string;
  readonly localPackage: unknown;
}

export function buildVersionCandidate(input: VersionCandidateInput): Readonly<CapabilityVersionCandidate> {
  const localPackage = LocalCapabilityPackageSchema.parse(input.localPackage);
  if (localPackage.capabilityVersionId !== input.id || localPackage.workerDeviceId !== input.workerDeviceId) {
    throw new TypeError('Local package identity mismatch');
  }
  const manifest = localPackage.workerManifest;
  const permissionPolicy = localPackage.permissionPolicy;
  const ioContract = CapabilityIOContractSchema.parse(localPackage.ioContract);
  const version = CapabilityVersionCandidateSchema.parse({
    id: input.id,
    capabilityId: input.capabilityId,
    versionNumber: input.versionNumber,
    workerDeviceId: input.workerDeviceId,
    localWorkerId: manifest.workerId,
    publicationState: 'DRAFT',
    requestedAt: input.requestedAt,
    runtime: manifest.runtime,
    workerManifestHash: hashWorkerManifest(manifest),
    localPackageHash: hashCanonicalJson(localPackage),
    dependencyGraphHash: hashCanonicalJson(localPackage.dependencyGraph),
    permissionPolicyHash: hashCanonicalJson(permissionPolicy),
    publicResearchPolicy: permissionPolicy.internet?.mode === 'PUBLIC_WEB_RESEARCH' ? permissionPolicy.internet : null,
    sellerInferenceConfigHash: localPackage.sellerInferenceConfigHash === null ? null : DigestSchema.parse(localPackage.sellerInferenceConfigHash),
    ioContract,
    publicPermissionManifest: buildPublicPermissionManifest(permissionPolicy),
    price: priceForTier(localPackage.priceTier),
    dependencySnapshot: localPackage.dependencySnapshot,
    resourceLimits: manifest.limits,
    concurrencyLimit: localPackage.concurrencyLimit,
    exampleRefs: localPackage.exampleRefs,
    testRefs: localPackage.testRefs,
  });
  return freezeDeep(version);
}

export function createJobContractSnapshot(
  published: PublishedCapabilityVersion,
  jobId: string,
  buyerAccountId: string,
  createdAt: string,
): Readonly<JobContractSnapshot> {
  const version = PublishedCapabilityVersionSchema.parse(published);
  const snapshot = JobContractSnapshotSchema.parse({
    jobId,
    buyerAccountId,
    capabilityId: version.capabilityId,
    capabilityVersionId: version.id,
    versionNumber: version.versionNumber,
    workerDeviceId: version.workerDeviceId,
    createdAt,
    permissionManifestSnapshot: version.publicPermissionManifest,
    publicResearchPolicySnapshot: version.publicResearchPolicy,
    inputContractSnapshot: version.ioContract.input,
    outputContractSnapshot: version.ioContract.output,
    priceSnapshot: version.price,
  });
  return freezeDeep(snapshot);
}
