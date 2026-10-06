import { CapabilityIOContractSchema } from '../../contracts/src/capability-io.js';
import {
  CapabilityVersionCandidateSchema, PublishedCapabilityVersionSchema, DigestSchema,
  type CapabilityVersionCandidate, type PublishedCapabilityVersion, type JobContractSnapshot,
  JobContractSnapshotSchema,
} from '../../contracts/src/capability-version.js';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { InternalPermissionPolicySchema } from '../../contracts/src/permission-policy.js';
import { buildPublicPermissionManifest } from '../../policy-engine/src/public-manifest.js';
import type { PriceTier } from '../../contracts/src/pricing.js';
import { hashWorkerManifest, WorkerManifestSchema } from '../../contracts/src/worker-manifest.js';
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
  readonly workerManifest: unknown;
  readonly localPackageHash: string;
  readonly permissionPolicy: unknown;
  readonly sellerInferenceConfigHash: string | null;
  readonly ioContract: unknown;
  readonly priceTier: PriceTier;
  readonly dependencySnapshot: readonly unknown[];
  readonly concurrencyLimit: number;
  readonly exampleRefs: readonly string[];
  readonly testRefs: readonly string[];
}

export function buildVersionCandidate(input: VersionCandidateInput): Readonly<CapabilityVersionCandidate> {
  const manifest = WorkerManifestSchema.parse(input.workerManifest);
  if (manifest.capabilityVersionId !== input.id) throw new TypeError('Worker manifest version ID mismatch');
  const permissionPolicy = InternalPermissionPolicySchema.parse(input.permissionPolicy);
  if ((permissionPolicy.aiInference === 'SELLER') !== (input.sellerInferenceConfigHash !== null)) {
    throw new TypeError('Seller inference configuration mismatch');
  }
  const ioContract = CapabilityIOContractSchema.parse(input.ioContract);
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
    localPackageHash: DigestSchema.parse(input.localPackageHash),
    permissionPolicyHash: hashCanonicalJson(permissionPolicy),
    sellerInferenceConfigHash: input.sellerInferenceConfigHash === null ? null : DigestSchema.parse(input.sellerInferenceConfigHash),
    ioContract,
    publicPermissionManifest: buildPublicPermissionManifest(permissionPolicy),
    price: priceForTier(input.priceTier),
    dependencySnapshot: input.dependencySnapshot,
    resourceLimits: manifest.limits,
    concurrencyLimit: input.concurrencyLimit,
    exampleRefs: input.exampleRefs,
    testRefs: input.testRefs,
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
    inputContractSnapshot: version.ioContract.input,
    outputContractSnapshot: version.ioContract.output,
    priceSnapshot: version.price,
  });
  return freezeDeep(snapshot);
}
