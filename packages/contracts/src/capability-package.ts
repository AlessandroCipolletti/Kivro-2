import { z } from 'zod';
import { CapabilityIOContractSchema } from './capability-io.js';
import { DependencyGraphSchema } from './dependency-graph.js';
import { InternalPermissionPolicySchema } from './permission-policy.js';
import { PriceTierSchema } from './pricing.js';
import { WorkerManifestSchema } from './worker-manifest.js';

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);

/** Full Worker-local draft. Cloud and buyer views receive only its hash and sanitized projections. */
export const LocalCapabilityPackageSchema = z.strictObject({
  packageVersion: z.literal(1),
  capabilityVersionId: z.uuid(),
  workerDeviceId: z.uuid(),
  workerManifest: WorkerManifestSchema,
  dependencyGraph: DependencyGraphSchema,
  permissionPolicy: InternalPermissionPolicySchema,
  sellerInferenceConfigHash: digest.nullable(),
  ioContract: CapabilityIOContractSchema,
  priceTier: PriceTierSchema,
  dependencySnapshot: z.array(z.strictObject({
    id: z.string().min(1).max(160), version: z.string().min(1).max(120), contentHash: digest,
  })).max(128),
  concurrencyLimit: z.number().int().positive().max(64),
  exampleRefs: z.array(z.uuid()).max(32),
  testRefs: z.array(z.uuid()).max(32),
}).superRefine((value, context) => {
  if (value.workerManifest.capabilityVersionId !== value.capabilityVersionId) {
    context.addIssue({ code: 'custom', message: 'Package and Worker manifest version differ' });
  }
  if ((value.permissionPolicy.aiInference === 'SELLER') !== (value.sellerInferenceConfigHash !== null)) {
    context.addIssue({ code: 'custom', message: 'Seller inference configuration mismatch' });
  }
  if (value.permissionPolicy.publicInternet !== 'DENY' && !value.permissionPolicy.internet) {
    context.addIssue({ code: 'custom', message: 'Networked capability requires detailed Internet policy' });
  }
  if (value.permissionPolicy.proprietaryDatabase !== 'NONE' && !value.permissionPolicy.localResources?.length) {
    context.addIssue({ code: 'custom', message: 'Database access requires named local broker operations' });
  }
  const resources = new Map(value.workerManifest.resources.map((resource) => [resource.id, resource]));
  for (const policy of value.permissionPolicy.localResources ?? []) {
    const resource = resources.get(policy.resourceId);
    if (resource?.type !== 'local-resource-broker' ||
      policy.operations.some((operation) => !resource.permissions.includes(operation.id))) {
      context.addIssue({ code: 'custom', message: 'Local resource policy is not selected in Worker manifest' });
    }
  }
  if (value.permissionPolicy.internet?.mode === 'DECLARED_API_ACCESS') {
    for (const connector of value.permissionPolicy.internet.connectors) {
      if (resources.get(connector.id)?.type !== 'declared-api') {
        context.addIssue({ code: 'custom', message: 'Declared API connector is not selected in Worker manifest' });
      }
    }
  }
  if (value.permissionPolicy.providerBudget &&
    !value.permissionPolicy.sellerCredentialRefs.includes(value.permissionPolicy.providerBudget.credentialRef)) {
    context.addIssue({ code: 'custom', message: 'Provider credential was not selected by seller' });
  }
});

export type LocalCapabilityPackage = z.infer<typeof LocalCapabilityPackageSchema>;
