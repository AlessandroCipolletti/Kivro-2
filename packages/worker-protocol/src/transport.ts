import { z } from 'zod';
import { WORKER_PROTOCOL_VERSION, negotiateWorkerProtocol } from './messages.js';

export interface WorkerProtocolTransport {
  readonly controlPlaneId: string;
  readonly kind: 'HTTPS_POLLING' | 'WEBSOCKET';
  readonly supportedProtocolVersions: readonly string[];
  send(message: unknown): Promise<void>;
  close(): Promise<void>;
}

/** Both network adapters expose identical signed Worker RPC semantics. */
export interface WorkerRpcTransport extends WorkerProtocolTransport {
  poll(hello:unknown):Promise<readonly unknown[]>;
  postJobRpc(kind:'ACCEPT'|'ACCEPTED_INPUT'|'TRANSITION'|'RENEW_LEASE'|
    'PREPARE_RESULT_ASSET'|'FINALIZE_RESULT'|'RESEARCH_SEARCH'|'RESEARCH_FETCH'|
    'RESEARCH_DOWNLOAD'|'PRIVATE_RESOURCE_READ',body:unknown):Promise<unknown>;
}

export class WorkerTransportError extends Error {
  constructor(readonly code: 'INCOMPATIBLE_PROTOCOL' | 'UNKNOWN_CONTROL_PLANE' |
    'WRONG_CONTROL_PLANE' | 'RETIRED_CONTROL_PLANE') {
    super(code); this.name = 'WorkerTransportError';
  }
}

type Session = { transport: WorkerProtocolTransport; state: 'ACTIVE' | 'DRAINING' | 'RETIRED' };

/** Routes by immutable execution owner. Transport preference never changes financial/job ownership. */
export class WorkerTransportRouter {
  private readonly sessions = new Map<string, Session>();
  private readonly owners = new Map<string, string>();

  connect(transport: WorkerProtocolTransport, state: Session['state']): typeof WORKER_PROTOCOL_VERSION {
    const planeId = z.string().min(1).max(160).parse(transport.controlPlaneId);
    if (state === 'RETIRED') throw new WorkerTransportError('RETIRED_CONTROL_PLANE');
    let version: typeof WORKER_PROTOCOL_VERSION;
    try { version = negotiateWorkerProtocol(transport.supportedProtocolVersions); }
    catch { throw new WorkerTransportError('INCOMPATIBLE_PROTOCOL'); }
    this.sessions.set(planeId, { transport, state });
    return version;
  }

  markDraining(controlPlaneId: string): void {
    const session = this.sessions.get(controlPlaneId);
    if (!session) throw new WorkerTransportError('UNKNOWN_CONTROL_PLANE');
    session.state = 'DRAINING';
  }

  ownExecution(executionId: string, controlPlaneId: string): void {
    z.uuid().parse(executionId);
    const session = this.sessions.get(controlPlaneId);
    if (!session) throw new WorkerTransportError('UNKNOWN_CONTROL_PLANE');
    if (session.state !== 'ACTIVE') throw new WorkerTransportError('RETIRED_CONTROL_PLANE');
    const prior = this.owners.get(executionId);
    if (prior && prior !== controlPlaneId) throw new WorkerTransportError('WRONG_CONTROL_PLANE');
    this.owners.set(executionId, controlPlaneId);
  }

  restoreExecution(executionId: string, controlPlaneId: string): void {
    z.uuid().parse(executionId);
    if (!this.sessions.has(controlPlaneId)) throw new WorkerTransportError('UNKNOWN_CONTROL_PLANE');
    const prior = this.owners.get(executionId);
    if (prior && prior !== controlPlaneId) throw new WorkerTransportError('WRONG_CONTROL_PLANE');
    this.owners.set(executionId, controlPlaneId);
  }

  async sendForExecution(executionId: string, message: unknown): Promise<void> {
    z.uuid().parse(executionId);
    const owner = this.owners.get(executionId);
    if (!owner) throw new WorkerTransportError('UNKNOWN_CONTROL_PLANE');
    const session = this.sessions.get(owner);
    if (!session || session.state === 'RETIRED') throw new WorkerTransportError('UNKNOWN_CONTROL_PLANE');
    await session.transport.send(message);
  }

  releaseExecution(executionId: string): void { this.owners.delete(z.uuid().parse(executionId)); }

  async disconnect(controlPlaneId: string): Promise<void> {
    const session = this.sessions.get(controlPlaneId);
    if (session) {
      this.sessions.delete(controlPlaneId);
      await session.transport.close();
    }
  }
}
