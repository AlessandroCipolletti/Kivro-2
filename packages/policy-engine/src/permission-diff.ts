import { canonicalJson } from '../../contracts/src/canonical-json.js';
import { DependencyGraphSchema } from '../../contracts/src/dependency-graph.js';
import { InternalPermissionPolicySchema } from '../../contracts/src/permission-policy.js';
import { WorkerManifestSchema } from '../../contracts/src/worker-manifest.js';

export type SecuritySurfaceChangeKind =
  | 'POLICY_FIELD' | 'RESOURCE_REFERENCE' | 'CREDENTIAL_REFERENCE'
  | 'SKILL' | 'TOOL' | 'RESOURCE_PERMISSION' | 'NETWORK_DESTINATION'
  | 'DEPENDENCY' | 'INFERENCE';

export interface SecuritySurfaceChange {
  readonly kind: SecuritySurfaceChangeKind;
  readonly reference: string;
}

export interface SecuritySurface {
  readonly permissionPolicy: unknown;
  readonly workerManifest: unknown;
  readonly dependencyGraph: unknown;
}

function newlyPresent(previous: readonly string[], next: readonly string[]): readonly string[] {
  const prior = new Set(previous);
  return next.filter((value) => !prior.has(value));
}

/**
 * Seller-facing review input. Public permission categories are intentionally too coarse for this check:
 * replacing one allowed file, credential, tool or host with another must require fresh review.
 */
export function securitySurfaceExpansion(previous: SecuritySurface, next: SecuritySurface): readonly SecuritySurfaceChange[] {
  const priorPolicy = InternalPermissionPolicySchema.parse(previous.permissionPolicy);
  const nextPolicy = InternalPermissionPolicySchema.parse(next.permissionPolicy);
  const priorManifest = WorkerManifestSchema.parse(previous.workerManifest);
  const nextManifest = WorkerManifestSchema.parse(next.workerManifest);
  const priorGraph = DependencyGraphSchema.parse(previous.dependencyGraph);
  const nextGraph = DependencyGraphSchema.parse(next.dependencyGraph);
  const changes = new Map<string, SecuritySurfaceChange>();
  const add = (kind: SecuritySurfaceChangeKind, reference: string): void => {
    changes.set(`${kind}\0${reference}`, { kind, reference });
  };

  for (const field of ['aiInference', 'publicInternet', 'browser', 'proprietaryDatabase', 'privateApi',
    'localSoftware', 'shell', 'externalSideEffects', 'buyerFileAccess'] as const) {
    if (nextPolicy[field] !== priorPolicy[field]) add('POLICY_FIELD', field);
  }
  if (canonicalJson(nextPolicy.internet ?? null) !== canonicalJson(priorPolicy.internet ?? null)) {
    add('POLICY_FIELD', 'internet');
  }
  const previousConnectors = new Map(priorPolicy.internet?.mode === 'DECLARED_API_ACCESS'
    ? priorPolicy.internet.connectors.map((connector) => [connector.id, canonicalJson(connector)]) : []);
  if (nextPolicy.internet?.mode === 'DECLARED_API_ACCESS') {
    for (const connector of nextPolicy.internet.connectors) {
      if (previousConnectors.get(connector.id) !== canonicalJson(connector)) {
        add('NETWORK_DESTINATION', `connector:${connector.id}:${connector.host}${connector.path}`);
      }
    }
  }
  if (canonicalJson(nextPolicy.localResources ?? null) !== canonicalJson(priorPolicy.localResources ?? null)) {
    add('RESOURCE_PERMISSION', 'localResources');
  }
  const previousOperations = new Map<string, string>((priorPolicy.localResources ?? []).flatMap((resource) =>
    resource.operations.map((operation) =>
      [`${resource.resourceId}:${operation.id}`,
        canonicalJson({ statementTimeoutMs: resource.statementTimeoutMs, operation })] as const)));
  for (const resource of nextPolicy.localResources ?? []) {
    for (const operation of resource.operations) {
      const reference = `${resource.resourceId}:${operation.id}`;
      if (previousOperations.get(reference) !== canonicalJson({
        statementTimeoutMs: resource.statementTimeoutMs, operation,
      })) add('RESOURCE_PERMISSION', `operation:${reference}`);
    }
  }
  if (canonicalJson(nextPolicy.providerBudget ?? null) !== canonicalJson(priorPolicy.providerBudget ?? null)) {
    add('INFERENCE', 'providerBudget');
  }
  for (const id of newlyPresent(priorPolicy.selectedFileResourceIds, nextPolicy.selectedFileResourceIds)) {
    add('RESOURCE_REFERENCE', `file:${id}`);
  }
  for (const id of newlyPresent(priorPolicy.selectedDirectoryResourceIds, nextPolicy.selectedDirectoryResourceIds)) {
    add('RESOURCE_REFERENCE', `directory:${id}`);
  }
  for (const id of newlyPresent(priorPolicy.sellerCredentialRefs, nextPolicy.sellerCredentialRefs)) {
    add('CREDENTIAL_REFERENCE', id);
  }

  const priorSkills = new Map(priorManifest.skills.map((skill) => [skill.name, skill.contentHash]));
  for (const skill of nextManifest.skills) {
    if (priorSkills.get(skill.name) !== skill.contentHash) add('SKILL', skill.name);
  }
  for (const tool of newlyPresent(priorManifest.tools.allow, nextManifest.tools.allow)) add('TOOL', tool);

  const priorResources = new Map(priorManifest.resources.map((resource) => [resource.id, canonicalJson(resource)]));
  for (const resource of nextManifest.resources) {
    if (priorResources.get(resource.id) !== canonicalJson(resource)) add('RESOURCE_PERMISSION', resource.id);
  }
  const priorNetwork = new Set(priorManifest.network.allow.map((destination) => canonicalJson(destination)));
  for (const destination of nextManifest.network.allow) {
    if (!priorNetwork.has(canonicalJson(destination))) add('NETWORK_DESTINATION', `${destination.host}:${destination.ports.join(',')}`);
  }

  const priorNodes = new Map(priorGraph.nodes.filter((node) => node.selected).map((node) => [node.id, canonicalJson(node)]));
  for (const node of nextGraph.nodes.filter((item) => item.selected)) {
    if (priorNodes.get(node.id) !== canonicalJson(node)) add('DEPENDENCY', node.id);
  }
  if (canonicalJson(priorGraph.inference) !== canonicalJson(nextGraph.inference)) add('INFERENCE', 'configuration');
  return Object.freeze([...changes.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.reference.localeCompare(b.reference)));
}
