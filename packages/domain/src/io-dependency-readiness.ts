import { CapabilityIOContractSchema } from '../../contracts/src/capability-io.js';
import { DependencyGraphSchema } from '../../contracts/src/dependency-graph.js';

export interface DependencyCompatibilityIssue {
  readonly fieldKey: string;
  readonly mimeType: string;
  readonly code: 'NO_DECLARED_HANDLER' | 'UNSELECTED_HANDLER' | 'UNVERIFIED_HANDLER';
}

/** Handler metadata is a warning signal, never permission or successful test evidence. */
export function assessInputDependencyReadiness(rawContract: unknown,
  rawGraph: unknown): readonly DependencyCompatibilityIssue[] {
  const contract = CapabilityIOContractSchema.parse(rawContract);
  const graph = DependencyGraphSchema.parse(rawGraph);
  const issues: DependencyCompatibilityIssue[] = [];
  for (const field of contract.input.fields) {
    if (field.type !== 'FILE' && field.type !== 'FILES') continue;
    for (const mimeType of field.constraints.allowedMimeTypes) {
      const candidates = graph.nodes.filter((node) => node.handlesMimeTypes?.includes(mimeType));
      if (!candidates.length) {
        issues.push({ fieldKey: field.key, mimeType, code: 'NO_DECLARED_HANDLER' });
      } else if (!candidates.some((node) => node.selected)) {
        issues.push({ fieldKey: field.key, mimeType, code: 'UNSELECTED_HANDLER' });
      } else if (!candidates.some((node) => node.selected && node.health === 'READY' &&
        node.confidence === 'CONFIRMED' && node.marketplaceSupport === 'SUPPORTED')) {
        issues.push({ fieldKey: field.key, mimeType, code: 'UNVERIFIED_HANDLER' });
      }
    }
  }
  return Object.freeze(issues);
}
