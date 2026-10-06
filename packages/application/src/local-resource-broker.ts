import type { LocalResourceAuditPort, LocalResourceQueryPort, ResearchUsagePort } from '../../infrastructure/contracts/src/research-ports.js';
import { ReadOnlyResourcePolicySchema, type ReadOnlyResourcePolicy } from '../../contracts/src/local-resource-policy.js';

/** Dedicated seller DB credentials live only in this Worker-side adapter; the agent sees named calls and rows. */
export class LocalResourceBroker {
  constructor(private readonly query: LocalResourceQueryPort, private readonly policy: ReadOnlyResourcePolicy,
    private readonly audit: LocalResourceAuditPort, private readonly researchUsage: ResearchUsagePort) {
    ReadOnlyResourcePolicySchema.parse(policy);
  }

  async invoke(binding: { jobId: string; capabilityVersionId: string }, input: { operationId: string; lookup: string }): Promise<readonly Record<string, unknown>[]> {
    const op = this.policy.operations.find((candidate) => candidate.id === input.operationId);
    const event = (status: 'ALLOWED' | 'DENIED', rowCount: number, reason: string | null) => this.audit.record({
      ...binding, resourceId: this.policy.resourceId, operationId: op?.id ?? 'UNDECLARED', rowCount,
      status, reason, occurredAt: new Date().toISOString(),
    });
    if (!op || typeof input.lookup !== 'string' || input.lookup.length < 1 || input.lookup.length > 160) {
      await event('DENIED', 0, 'UNDECLARED_OPERATION');
      throw new Error('RESOURCE_POLICY_DENIED');
    }
    try {
      // An authoritative per-job barrier prevents research after a private read, including after reconnect.
      await this.researchUsage.markPrivateResourceRead(binding.jobId, binding.capabilityVersionId);
      const rows = await this.query.query(op, input.lookup, this.policy.statementTimeoutMs);
      await event('ALLOWED', rows.length, null);
      return rows;
    } catch (error) {
      await event('DENIED', 0, error instanceof Error && error.message === 'RESOURCE_CREDENTIAL_UNSAFE' ?
        'RESOURCE_CREDENTIAL_UNSAFE' : 'RESOURCE_ERROR');
      throw error;
    }
  }
}
