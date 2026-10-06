import { z } from 'zod';
import {
  DependencyGraphSchema, PermissionConsentSchema,
  type DependencyGraph, type DependencyNode, type PermissionConsent,
} from '../../contracts/src/dependency-graph.js';

const SellerSelectionActionSchema = z.strictObject({
  sellerAccountId: z.uuid(),
  dependencyId: DependencyGraphSchema.shape.rootId,
  selected: z.boolean(),
  actedAt: z.iso.datetime(),
  source: z.literal('SELLER_ACTION'),
});

export type SellerSelectionAction = z.infer<typeof SellerSelectionActionSchema>;

export type GraphIssueCode =
  | 'ROOT_NOT_SELECTED' | 'REQUIRED_NOT_SELECTED' | 'CONDITIONAL_NEEDS_REVIEW'
  | 'DEPENDENCY_CYCLE' | 'UNREACHABLE_SELECTED' | 'UNSUPPORTED_DEPENDENCY'
  | 'BLOCKED_SENSITIVITY' | 'RESTRICTIONS_NEED_REVIEW' | 'SUPPORT_UNDETERMINED'
  | 'DEPENDENCY_UNCERTAIN' | 'HEALTH_UNKNOWN' | 'HEALTH_FAILED'
  | 'ALTERNATIVE_UNSELECTED'
  | 'INFERENCE_UNDECLARED' | 'INFERENCE_MODEL_NOT_SELECTED'
  | 'INFERENCE_CREDENTIAL_NOT_SELECTED' | 'INFERENCE_ENDPOINT_NOT_SELECTED';

export interface GraphIssue {
  readonly code: GraphIssueCode;
  readonly dependencyId: string;
}

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

/** A seller action changes exactly one selection. Graph edges never grant consent. */
export function applySellerSelection(input: unknown, rawAction: unknown): Readonly<DependencyGraph> {
  const graph = DependencyGraphSchema.parse(input);
  const action = SellerSelectionActionSchema.parse(rawAction);
  const target = graph.nodes.find((node) => node.id === action.dependencyId);
  if (!target) throw new TypeError('Unknown dependency selection');
  if (action.selected && (target.sensitivity === 'BLOCKED' || target.marketplaceSupport === 'UNSUPPORTED')) {
    throw new TypeError('Unsupported dependency cannot be selected');
  }
  // Authentication/ownership of sellerAccountId is the API boundary's duty.
  return freezeDeep(DependencyGraphSchema.parse({
    ...graph,
    nodes: graph.nodes.map((node) => node.id === action.dependencyId
      ? { ...node, selected: action.selected } : node),
  }));
}

/** Static analysis is advisory; UNKNOWN health/support cannot become publish readiness. */
export function analyzeDependencyGraph(input: unknown): Readonly<{ issues: readonly GraphIssue[]; publishable: boolean }> {
  const graph = DependencyGraphSchema.parse(input);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const issues: GraphIssue[] = [];
  const seenIssues = new Set<string>();
  const add = (code: GraphIssueCode, dependencyId: string): void => {
    const key = `${code}\0${dependencyId}`;
    if (!seenIssues.has(key)) { issues.push({ code, dependencyId }); seenIssues.add(key); }
  };
  const reached = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: DependencyNode): void => {
    reached.add(node.id);
    if (visiting.has(node.id)) { add('DEPENDENCY_CYCLE', node.id); return; }
    if (visited.has(node.id)) return;
    visiting.add(node.id);
    for (const targetId of node.dependsOn) {
      const target = byId.get(targetId);
      if (!target) continue; // The schema already rejects unknown references.
      if (target.requirement === 'REQUIRED' && !target.selected) add('REQUIRED_NOT_SELECTED', target.id);
      if (target.requirement === 'CONDITIONAL' && !target.selected) add('CONDITIONAL_NEEDS_REVIEW', target.id);
      visit(target);
    }
    visiting.delete(node.id);
    visited.add(node.id);
  };
  const root = byId.get(graph.rootId);
  if (!root) throw new TypeError('Unknown graph root');
  if (!root.selected) add('ROOT_NOT_SELECTED', root.id);
  visit(root);

  for (const group of graph.alternatives) {
    if (group.requirement === 'REQUIRED' && group.candidateIds.some((id) => reached.has(id)) &&
      !group.candidateIds.some((id) => byId.get(id)?.selected)) {
      add('ALTERNATIVE_UNSELECTED', group.groupId);
    }
  }

  for (const node of graph.nodes) {
    if (!node.selected) continue;
    if (!reached.has(node.id)) add('UNREACHABLE_SELECTED', node.id);
    if (node.marketplaceSupport === 'UNSUPPORTED') add('UNSUPPORTED_DEPENDENCY', node.id);
    if (node.marketplaceSupport === 'UNDETERMINED') add('SUPPORT_UNDETERMINED', node.id);
    if (node.marketplaceSupport === 'SUPPORTED_WITH_RESTRICTIONS') add('RESTRICTIONS_NEED_REVIEW', node.id);
    if (node.sensitivity === 'BLOCKED') add('BLOCKED_SENSITIVITY', node.id);
    if (node.confidence === 'POSSIBLE' || node.confidence === 'UNKNOWN') add('DEPENDENCY_UNCERTAIN', node.id);
    if (node.health === 'UNKNOWN') add('HEALTH_UNKNOWN', node.id);
    if (node.health === 'FAILED') add('HEALTH_FAILED', node.id);
  }

  if (!graph.inference) add('INFERENCE_UNDECLARED', root.id);
  else {
    const inference = graph.inference;
    const model = byId.get(inference.dependencyId);
    if (!model || model.type !== 'AI_MODEL' || !model.selected || !reached.has(model.id)) {
      add('INFERENCE_MODEL_NOT_SELECTED', inference.dependencyId);
    }
    if (inference.mode === 'REMOTE_PROVIDER') {
      const credential = byId.get(inference.credentialRef);
      if (!credential || credential.type !== 'CREDENTIAL' || !credential.selected || !reached.has(credential.id)) {
        add('INFERENCE_CREDENTIAL_NOT_SELECTED', inference.credentialRef);
      }
    } else if (inference.endpointRef) {
      const endpoint = byId.get(inference.endpointRef);
      if (!endpoint || endpoint.type !== 'LOCAL_SERVICE' || !endpoint.selected || !reached.has(endpoint.id)) {
        add('INFERENCE_ENDPOINT_NOT_SELECTED', inference.endpointRef);
      }
    }
  }
  issues.sort((a, b) => a.code.localeCompare(b.code) || a.dependencyId.localeCompare(b.dependencyId));
  return freezeDeep({ issues, publishable: issues.length === 0 });
}

export interface ConsentContext {
  readonly sellerAccountId: string;
  readonly workerDeviceId: string;
  readonly capabilityVersionId: string;
  readonly manifestHash: string;
}

/** Called with server-derived context after the final manifest hash is known. */
export function missingPermissionConsents(
  input: unknown, rawConsents: readonly unknown[], context: ConsentContext,
): readonly string[] {
  const graph = DependencyGraphSchema.parse(input);
  const consents: PermissionConsent[] = rawConsents.map((item) => PermissionConsentSchema.parse(item));
  const approved = new Set<string>();
  for (const consent of consents) {
    if (consent.sellerAccountId !== context.sellerAccountId ||
      consent.workerDeviceId !== context.workerDeviceId ||
      consent.capabilityVersionId !== context.capabilityVersionId ||
      consent.manifestHash !== context.manifestHash) continue;
    const node = graph.nodes.find((item) => item.id === consent.dependencyId);
    if (node?.selected && node.type === consent.permissionType && consent.permissionValueRef === node.id) {
      approved.add(node.id);
    }
  }
  return freezeDeep(graph.nodes.filter((node) => node.selected && !approved.has(node.id)).map((node) => node.id).sort());
}
