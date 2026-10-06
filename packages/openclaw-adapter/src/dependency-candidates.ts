import { createHash } from 'node:crypto';
import { DependencyGraphSchema, type DependencyGraph, type DependencyNode } from '../../contracts/src/dependency-graph.js';
import type { LocalOpenClawDiscovery } from './read-only-discovery.js';

function id(type: string, name: string): string {
  return `dep:${type.toLowerCase()}:${createHash('sha256').update(name).digest('hex').slice(0, 24)}`;
}

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

/** Only declared metadata is mapped; the result is a seller-local suggestion, not a permission manifest. */
export function buildSuggestedDependencyGraph(
  discovery: LocalOpenClawDiscovery, skillName: string,
): Readonly<DependencyGraph> {
  const matches = discovery.skills.filter((skill) => skill.name === skillName);
  const skill = matches[0];
  if (!skill || matches.length !== 1 || skill.ambiguous) throw new TypeError('Skill discovery is missing or ambiguous');
  const rootId = id('skill', skill.name);
  const nodes: DependencyNode[] = [];
  const children = new Set<string>();
  const make = (
    type: DependencyNode['type'], name: string,
    requirement: DependencyNode['requirement'], sensitivity: DependencyNode['sensitivity'],
  ): string => {
    const dependencyId = id(type, name);
    if (!nodes.some((node) => node.id === dependencyId)) nodes.push({
      id: dependencyId, type, name, requirement, sensitivity,
      discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
      marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED',
      selected: false, health: 'UNKNOWN',
    });
    children.add(dependencyId);
    return dependencyId;
  };
  for (const binary of skill.declaredResources.binaries) make('SYSTEM_BINARY', binary, 'REQUIRED', 'MEDIUM');
  for (const key of skill.declaredResources.environmentKeys) make('ENVIRONMENT_VARIABLE', key, 'REQUIRED', 'HIGH');
  for (const key of skill.declaredResources.configKeys) make('CONFIGURATION_KEY', key, 'REQUIRED', 'MEDIUM');
  const alternatives = [];
  const alternativeNames = [...new Set(skill.declaredResources.anyBinaries)]
    .filter((name) => !skill.declaredResources.binaries.includes(name));
  if (alternativeNames.length === 1) make('SYSTEM_BINARY', alternativeNames[0]!, 'REQUIRED', 'MEDIUM');
  else if (alternativeNames.length > 1) {
    const candidateIds = alternativeNames.map((name) => make('SYSTEM_BINARY', name, 'OPTIONAL', 'MEDIUM'));
    alternatives.push({ groupId: id('alternative', `${skill.name}:anyBins`), candidateIds,
      requirement: 'REQUIRED' as const });
  }
  nodes.unshift({
    id: rootId, type: 'SKILL', name: skill.name, requirement: 'REQUIRED', sensitivity: 'MEDIUM',
    discoveredFrom: ['SKILL_METADATA'], dependsOn: [...children].sort(),
    marketplaceSupport: 'UNDETERMINED', confidence: skill.metadata === 'parsed' ? 'CONFIRMED' : 'UNKNOWN',
    selected: false, health: 'UNKNOWN',
  });
  const graph = DependencyGraphSchema.parse({ graphVersion: 1, rootId, inference: null,
    nodes: [nodes[0], ...nodes.slice(1).sort((a, b) => a.id.localeCompare(b.id))], alternatives });
  return freezeDeep(graph);
}
