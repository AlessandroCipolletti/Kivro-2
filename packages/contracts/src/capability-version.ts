import { z } from 'zod';
import { CapabilityIOContractSchema } from './capability-io.js';
import { PublicPermissionManifestSchema } from './permission-policy.js';
import { PriceSnapshotSchema } from './pricing.js';
import { WorkerManifestSchema } from './worker-manifest.js';

export const DigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const DependencySnapshotSchema = z.strictObject({
  id: z.string().min(1).max(160),
  version: z.string().min(1).max(120),
  contentHash: DigestSchema,
});

/** Buyer-safe version metadata. Full local package remains on the Worker. */
const versionFields = {
  id: z.uuid(),
  capabilityId: z.uuid(),
  versionNumber: z.number().int().positive(),
  workerDeviceId: z.uuid(),
  localWorkerId: z.uuid(),
  runtime: WorkerManifestSchema.shape.runtime,
  workerManifestHash: DigestSchema,
  localPackageHash: DigestSchema,
  permissionPolicyHash: DigestSchema,
  sellerInferenceConfigHash: DigestSchema.nullable(),
  ioContract: CapabilityIOContractSchema,
  publicPermissionManifest: PublicPermissionManifestSchema,
  price: PriceSnapshotSchema,
  dependencySnapshot: z.array(DependencySnapshotSchema).max(128),
  resourceLimits: WorkerManifestSchema.shape.limits,
  concurrencyLimit: z.number().int().positive().max(64),
  exampleRefs: z.array(z.uuid()).max(32),
  testRefs: z.array(z.uuid()).max(32),
};

/** A draft preview is not eligible for jobs or marketplace publication. */
export const CapabilityVersionCandidateSchema = z.strictObject({
  ...versionFields,
  publicationState: z.literal('DRAFT'),
  requestedAt: z.iso.datetime(),
});

/** M03/M04 publication must supply verified policy/readiness evidence. */
export const PublishedCapabilityVersionSchema = z.strictObject({
  ...versionFields,
  publicationState: z.literal('PUBLISHED'),
  publishedAt: z.iso.datetime(),
  policyValidationHash: DigestSchema,
});

export const JobContractSnapshotSchema = z.strictObject({
  jobId: z.uuid(),
  buyerAccountId: z.uuid(),
  capabilityId: z.uuid(),
  capabilityVersionId: z.uuid(),
  versionNumber: z.number().int().positive(),
  workerDeviceId: z.uuid(),
  createdAt: z.iso.datetime(),
  permissionManifestSnapshot: PublicPermissionManifestSchema,
  inputContractSnapshot: CapabilityIOContractSchema.shape.input,
  outputContractSnapshot: CapabilityIOContractSchema.shape.output,
  priceSnapshot: PriceSnapshotSchema,
});

export type CapabilityVersionCandidate = z.infer<typeof CapabilityVersionCandidateSchema>;
export type PublishedCapabilityVersion = z.infer<typeof PublishedCapabilityVersionSchema>;
export type JobContractSnapshot = z.infer<typeof JobContractSnapshotSchema>;
