import {
  CapabilityAccessContextSchema, VersionLifecycleStateSchema,
  type VersionLifecycleState,
} from '../../contracts/src/capability-visibility.js';

export interface CapabilityVisibilityDecision {
  readonly canViewDetail: boolean;
  readonly appearsInSearch: boolean;
  readonly visibilityAllowsAgentRecommendation: boolean;
}

/** Visibility is access/discovery only. Paid admission still needs readiness and payment. */
export function decideCapabilityVisibility(input: unknown): CapabilityVisibilityDecision {
  const context = CapabilityAccessContextSchema.parse(input);
  const seller = context.viewerAccountId === context.sellerAccountId;
  switch (context.visibility) {
    case 'DRAFT': return { canViewDetail: seller, appearsInSearch: false,
      visibilityAllowsAgentRecommendation: false };
    case 'PRIVATE': return { canViewDetail: seller || (context.viewerAccountId !== null && context.explicitPrivateGrant),
      appearsInSearch: false, visibilityAllowsAgentRecommendation: false };
    case 'UNLISTED': return { canViewDetail: seller || context.arrivedByDirectLink,
      appearsInSearch: false, visibilityAllowsAgentRecommendation: false };
    case 'PUBLIC': return { canViewDetail: true, appearsInSearch: true,
      visibilityAllowsAgentRecommendation: true };
  }
}

const allowed: Readonly<Record<VersionLifecycleState, readonly VersionLifecycleState[]>> = {
  DRAFT: ['TESTING'],
  TESTING: ['DRAFT', 'READY_TO_PUBLISH'],
  READY_TO_PUBLISH: ['DRAFT', 'TESTING', 'PUBLISHED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
};

/** Legal lifecycle shape; readiness evidence is checked by the publication service. */
export function isLegalVersionTransition(from: unknown, to: unknown): boolean {
  const source = VersionLifecycleStateSchema.parse(from);
  const target = VersionLifecycleStateSchema.parse(to);
  return allowed[source].includes(target);
}
