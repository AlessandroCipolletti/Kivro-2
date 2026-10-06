import { z } from 'zod';

const reference = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const DependencyTypeSchema = z.enum([
  'SKILL', 'TOOL', 'MCP_SERVER', 'PLUGIN', 'DATABASE', 'LOCAL_FILE', 'LOCAL_DIRECTORY',
  'LOCAL_SERVICE', 'PRIVATE_API', 'NETWORK_DESTINATION', 'AI_PROVIDER', 'AI_MODEL',
  'CREDENTIAL', 'EXECUTABLE', 'ENVIRONMENT_VARIABLE', 'SYSTEM_BINARY', 'MODEL_FILE',
  'CONFIGURATION_KEY',
]);

export const InferenceDependencySchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('REMOTE_PROVIDER'), dependencyId: reference, provider: reference, model: z.string().min(1).max(160),
    credentialRef: reference, billingOwner: z.literal('SELLER'),
  }),
  z.strictObject({
    mode: z.literal('LOCAL'), dependencyId: reference, provider: reference, model: z.string().min(1).max(160),
    endpointRef: reference.optional(), billingOwner: z.literal('SELLER'),
  }),
]);

export const DependencyNodeSchema = z.strictObject({
  id: reference,
  type: DependencyTypeSchema,
  name: z.string().min(1).max(160),
  requirement: z.enum(['REQUIRED', 'OPTIONAL', 'CONDITIONAL']),
  sensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'BLOCKED']),
  discoveredFrom: z.array(z.enum([
    'STATIC_CONFIG', 'SKILL_METADATA', 'RUNTIME_OBSERVATION', 'SELLER_DECLARATION',
  ])).min(1).max(4),
  dependsOn: z.array(reference).max(32),
  marketplaceSupport: z.enum(['SUPPORTED', 'SUPPORTED_WITH_RESTRICTIONS', 'UNSUPPORTED', 'UNDETERMINED']),
  confidence: z.enum(['CONFIRMED', 'LIKELY', 'POSSIBLE', 'UNKNOWN']),
  selected: z.boolean(),
  health: z.enum(['UNKNOWN', 'READY', 'FAILED']),
  handlesMimeTypes: z.array(z.string().min(3).max(120)).max(32).optional(),
});

export const DependencyGraphSchema = z.strictObject({
  graphVersion: z.literal(1),
  rootId: reference,
  inference: InferenceDependencySchema.nullable(),
  nodes: z.array(DependencyNodeSchema).min(1).max(128),
  alternatives: z.array(z.strictObject({
    groupId: reference,
    candidateIds: z.array(reference).min(2).max(16),
    requirement: z.literal('REQUIRED'),
  })).max(16).default([]),
}).superRefine((graph, context) => {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) context.addIssue({ code: 'custom', message: `Duplicate dependency ID: ${node.id}` });
    ids.add(node.id);
    if (new Set(node.dependsOn).size !== node.dependsOn.length) {
      context.addIssue({ code: 'custom', message: `Duplicate dependency edge: ${node.id}` });
    }
  }
  const groups = new Set<string>();
  for (const group of graph.alternatives) {
    if (groups.has(group.groupId)) context.addIssue({ code: 'custom', message: `Duplicate alternative group: ${group.groupId}` });
    groups.add(group.groupId);
    if (new Set(group.candidateIds).size !== group.candidateIds.length) {
      context.addIssue({ code: 'custom', message: `Duplicate alternative candidate: ${group.groupId}` });
    }
    for (const candidateId of group.candidateIds) {
      if (!ids.has(candidateId)) context.addIssue({ code: 'custom', message: `Unknown alternative candidate: ${candidateId}` });
    }
  }
  if (!ids.has(graph.rootId)) context.addIssue({ code: 'custom', message: 'Unknown graph root' });
  for (const node of graph.nodes) {
    for (const target of node.dependsOn) {
      if (!ids.has(target)) context.addIssue({ code: 'custom', message: `Unknown dependency target: ${target}` });
    }
  }
});

/** An approval is bound to one immutable manifest and one seller action. */
export const PermissionConsentSchema = z.strictObject({
  sellerAccountId: z.uuid(),
  workerDeviceId: z.uuid(),
  capabilityVersionId: z.uuid(),
  dependencyId: reference,
  permissionType: DependencyTypeSchema,
  permissionValueRef: reference,
  approvedAt: z.iso.datetime(),
  manifestHash: digest,
  source: z.literal('SELLER_ACTION'),
});

export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;
export type InferenceDependency = z.infer<typeof InferenceDependencySchema>;
export type PermissionConsent = z.infer<typeof PermissionConsentSchema>;
