import { z } from 'zod';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from '../../../packages/contracts/src/capability-package.js';
import type { SellerCompletionBroker } from '../../../packages/application/src/completion-broker.js';
import type { ResearchBroker } from '../../../packages/application/src/research-broker.js';
import type { LocalResourceBroker } from '../../../packages/application/src/local-resource-broker.js';
import type { DeclaredApiBroker } from '../../../packages/application/src/declared-api-broker.js';
import type { BrokerRequest } from './broker-sidecar.js';

const search = z.strictObject({ query: z.string().min(2).max(256), maxResults: z.number().int().min(1).max(20) });
const url = z.strictObject({ url: z.url().max(2048) });
const resource = z.strictObject({ resourceId: z.string().min(1).max(160),
  operationId: z.string().min(1).max(160), lookup: z.string().min(1).max(160) });
const declared = z.strictObject({ connectorId: z.string().min(1).max(160),
  input: z.record(z.string(), z.unknown()) });

const brokerTools = new Set(['kivro_research_search', 'kivro_research_fetch',
  'kivro_research_download', 'kivro_resource_read', 'kivro_declared_api']);

export class BrokerRoutingError extends Error {
  constructor(readonly code: 'UNDECLARED_TOOL' | 'BROKER_UNAVAILABLE' | 'POLICY_MISMATCH') {
    super(code); this.name = 'BrokerRoutingError';
  }
}

export interface JobBrokerPorts {
  readonly completion: SellerCompletionBroker;
  readonly research?: ResearchBroker;
  readonly localResources?: ReadonlyMap<string, LocalResourceBroker>;
  readonly declaredApi?: DeclaredApiBroker;
}

/** Maps only a seller-selected and policy-authorized tool surface to M06 broker ports. */
export class WorkerBrokerRouter {
  readonly allowedToolNames: readonly string[];
  private readonly selected: ReadonlySet<string>;
  private readonly pkg: LocalCapabilityPackage;

  constructor(rawPackage: unknown, private readonly jobId: string, private readonly ports: JobBrokerPorts,
    fileTools: { readonly inputFiles: boolean; readonly outputFiles: boolean } =
      { inputFiles: false, outputFiles: false }) {
    this.pkg = LocalCapabilityPackageSchema.parse(rawPackage);
    z.uuid().parse(jobId);
    const manifest = this.pkg.workerManifest;
    const policy = this.pkg.permissionPolicy;
    if (manifest.tools.allow.some((name) => !brokerTools.has(name)) ||
      manifest.tools.allow.some((name) => manifest.tools.deny.includes(name)) ||
      manifest.tools.allow.length !== new Set(manifest.tools.allow).size ||
      policy.aiInference !== 'SELLER' || !policy.providerBudget) {
      throw new BrokerRoutingError('POLICY_MISMATCH');
    }
    this.selected = new Set(manifest.tools.allow);
    for (const name of this.selected) {
      const permitted =
        (name === 'kivro_research_search' && policy.internet?.mode === 'PUBLIC_WEB_RESEARCH' &&
          policy.internet.search.enabled && !!ports.research) ||
        (name === 'kivro_research_fetch' && policy.internet?.mode === 'PUBLIC_WEB_RESEARCH' &&
          policy.internet.fetch.enabled && !!ports.research) ||
        (name === 'kivro_research_download' && policy.internet?.mode === 'PUBLIC_WEB_RESEARCH' &&
          policy.internet.download.enabled && !!ports.research) ||
        (name === 'kivro_resource_read' && policy.localResources?.length && !!ports.localResources) ||
        (name === 'kivro_declared_api' && policy.internet?.mode === 'DECLARED_API_ACCESS' &&
          !!ports.declaredApi);
      if (!permitted) throw new BrokerRoutingError('BROKER_UNAVAILABLE');
    }
    if (fileTools.inputFiles && !policy.buyerFileAccess) throw new BrokerRoutingError('POLICY_MISMATCH');
    this.allowedToolNames = Object.freeze(['kivro_submit_result',
      ...(fileTools.inputFiles ? ['kivro_read_input'] : []),
      ...(fileTools.outputFiles ? ['kivro_write_output'] : []), ...this.selected].sort());
  }

  async dispatch(request: BrokerRequest, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    const version = this.pkg.capabilityVersionId;
    const policy = this.pkg.permissionPolicy;
    let result: unknown;
    switch (request.kind) {
      case 'INFERENCE':
        result = await this.ports.completion.invoke({ jobId: this.jobId, capabilityVersionId: version,
          providerBudget: policy.providerBudget, allowedToolNames: this.allowedToolNames },
        request.payload, request.id, signal);
        break;
      case 'RESEARCH_SEARCH':
        if (!this.selected.has('kivro_research_search') || !this.ports.research) {
          throw new BrokerRoutingError('UNDECLARED_TOOL');
        }
        result = await this.ports.research.search({ jobId: this.jobId, capabilityVersionId: version,
          internetPolicy: policy.internet }, search.parse(request.payload));
        break;
      case 'RESEARCH_FETCH':
        if (!this.selected.has('kivro_research_fetch') || !this.ports.research) {
          throw new BrokerRoutingError('UNDECLARED_TOOL');
        }
        result = await this.ports.research.fetch({ jobId: this.jobId, capabilityVersionId: version,
          internetPolicy: policy.internet }, url.parse(request.payload));
        break;
      case 'RESEARCH_DOWNLOAD': {
        if (!this.selected.has('kivro_research_download') || !this.ports.research) {
          throw new BrokerRoutingError('UNDECLARED_TOOL');
        }
        const downloaded = await this.ports.research.download({ jobId: this.jobId,
          capabilityVersionId: version, internetPolicy: policy.internet }, url.parse(request.payload));
        if (downloaded.bytes.byteLength > 1_000_000) throw new BrokerRoutingError('POLICY_MISMATCH');
        result = { ...downloaded, bytesBase64: Buffer.from(downloaded.bytes).toString('base64'), bytes: undefined };
        break;
      }
      case 'RESOURCE_READ': {
        if (!this.selected.has('kivro_resource_read')) throw new BrokerRoutingError('UNDECLARED_TOOL');
        const input = resource.parse(request.payload);
        const selectedResource = this.pkg.workerManifest.resources.find((item) =>
          item.id === input.resourceId && item.type === 'local-resource-broker' &&
          item.permissions.includes(input.operationId));
        const broker = this.ports.localResources?.get(input.resourceId);
        if (!selectedResource || !broker) throw new BrokerRoutingError('UNDECLARED_TOOL');
        result = await broker.invoke({ jobId: this.jobId, capabilityVersionId: version }, input);
        break;
      }
      case 'DECLARED_API': {
        if (!this.selected.has('kivro_declared_api') || !this.ports.declaredApi) {
          throw new BrokerRoutingError('UNDECLARED_TOOL');
        }
        const input = declared.parse(request.payload);
        if (!this.pkg.workerManifest.resources.some((item) =>
          item.id === input.connectorId && item.type === 'declared-api')) {
          throw new BrokerRoutingError('UNDECLARED_TOOL');
        }
        result = await this.ports.declaredApi.invoke({ jobId: this.jobId,
          capabilityVersionId: version, internetPolicy: policy.internet },
        { connectorId: input.connectorId, parameters: input.input, requestId: request.id });
        break;
      }
    }
    signal.throwIfAborted();
    return result;
  }
}
