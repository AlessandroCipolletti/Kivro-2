import type { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InternetPolicySchema } from '../../contracts/src/internet-policy.js';
import { NetworkPolicyError } from '../../policy-engine/src/public-destination.js';
import type { DeclaredApiUsagePort } from '../../infrastructure/contracts/src/research-ports.js';

export interface DeclaredApiConnector<I, O> {
  readonly id: string;
  readonly host: string;
  readonly method: 'GET' | 'HEAD' | 'POST';
  readonly path: string;
  readonly sideEffect: 'READ_ONLY' | 'SIDE_EFFECTING' | 'UNKNOWN';
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  /** Connector code owns fixed destination, credential injection, rate and byte limits. */
  invoke(input: I, binding: { jobId: string; capabilityVersionId: string }): Promise<O>;
}

/** Registry is deployment controlled; the sandbox cannot supply a URL, method, path or credential. */
export class DeclaredApiBroker {
  constructor(private readonly connectors: ReadonlyMap<string, DeclaredApiConnector<unknown, unknown>>,
    private readonly usage: DeclaredApiUsagePort) {}

  async invoke(binding: { jobId: string; capabilityVersionId: string; internetPolicy: unknown },
    input: { connectorId: string; parameters: unknown; requestId?: string }): Promise<unknown> {
    try { return await this.invokeInternal(binding, input); }
    catch (error) {
      await this.usage.deny({ jobId: binding.jobId, capabilityVersionId: binding.capabilityVersionId,
        connectorId: 'UNDECLARED', reason: error instanceof NetworkPolicyError ? error.code : 'CONNECTOR_UNAVAILABLE' });
      throw error;
    }
  }

  private async invokeInternal(binding: { jobId: string; capabilityVersionId: string; internetPolicy: unknown },
    input: { connectorId: string; parameters: unknown; requestId?: string }): Promise<unknown> {
    const policy = InternetPolicySchema.parse(binding.internetPolicy);
    if (policy.mode !== 'DECLARED_API_ACCESS') {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    const declared = policy.connectors.find((item) => item.id === input.connectorId);
    if (!declared) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const connector = this.connectors.get(input.connectorId);
    if (!connector || connector.sideEffect !== 'READ_ONLY' || !['GET', 'HEAD', 'POST'].includes(connector.method) ||
      connector.host !== declared.host || connector.method !== declared.method || connector.path !== declared.path) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    const parsedInput = connector.input.safeParse(input.parameters);
    if (!parsedInput.success) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    const parameters = parsedInput.data;
    if (Buffer.byteLength(JSON.stringify(parameters)) > declared.maxRequestBytes) {
      throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
    }
    const requestId = input.requestId ?? randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
    }
    await this.usage.begin({ requestId, jobId: binding.jobId, capabilityVersionId: binding.capabilityVersionId,
      connectorId: connector.id, host: connector.host, method: connector.method,
      maxRequestsPerJob: declared.maxRequestsPerJob });
    let responseBytes = 0, status: 'ALLOWED' | 'DENIED' = 'DENIED', reason: string | null = 'CONNECTOR_UNAVAILABLE';
    try {
      const parsedOutput = connector.output.safeParse(await connector.invoke(parameters, binding));
      if (!parsedOutput.success) throw new NetworkPolicyError('NETWORK_POLICY_DENIED');
      const result = parsedOutput.data;
      responseBytes = Buffer.byteLength(JSON.stringify(result));
      if (responseBytes > declared.maxResponseBytes) throw new NetworkPolicyError('NETWORK_BUDGET_EXCEEDED');
      status = 'ALLOWED'; reason = null;
      return result;
    } catch (error) {
      reason = error instanceof NetworkPolicyError ? error.code : 'CONNECTOR_UNAVAILABLE';
      throw error;
    } finally { await this.usage.finish({ requestId, responseBytes, status, reason }); }
  }
}
