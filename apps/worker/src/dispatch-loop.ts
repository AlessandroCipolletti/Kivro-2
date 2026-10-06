import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { WORKER_PROTOCOL_VERSION, WorkerJobControlCommandSchema,
  WorkerWelcomeSchema, JobOfferSchema, type JobOffer } from
  '../../../packages/worker-protocol/src/messages.js';
import { WorkerTransportRouter } from '../../../packages/worker-protocol/src/transport.js';
import type { WorkerCapabilityPackageStore } from './capability-package-store.js';
import type { WorkerExecutionSupervisor } from './execution-supervisor.js';
import { WorkerJobControl } from './job-control.js';
import { WorkerLocalState } from './local-state.js';

export interface WorkerInboundPollingPort {
  readonly controlPlaneId: string;
  readonly kind: 'HTTPS_POLLING' | 'WEBSOCKET';
  readonly supportedProtocolVersions: readonly string[];
  poll(hello: unknown): Promise<readonly (z.infer<typeof WorkerWelcomeSchema> |
    z.infer<typeof JobOfferSchema> | z.infer<typeof WorkerJobControlCommandSchema>)[]>;
  send(message: unknown): Promise<void>;
  close(): Promise<void>;
}

export class WorkerDispatchError extends Error {
  constructor(readonly code: 'WRONG_WORKER' | 'WRONG_CONTROL_PLANE' |
    'CONTROL_NOT_OWNED' | 'DRAINING') { super(code); this.name = 'WorkerDispatchError'; }
}

/** Provider-neutral orchestration; callers compose a transport and a real job supervisor. */
export class WorkerDispatchLoop {
  private readonly router = new WorkerTransportRouter();
  private readonly active = new Map<string, Promise<void>>();
  private state: 'ACTIVE' | 'DRAINING' | 'RETIRED' = 'ACTIVE';
  private started = false;

  constructor(private readonly transport: WorkerInboundPollingPort,
    private readonly deviceId: string, private readonly packages: WorkerCapabilityPackageStore,
    private readonly localState: WorkerLocalState, private readonly jobControl: WorkerJobControl,
    private readonly supervisor: WorkerExecutionSupervisor,
    private readonly onExecutionError: (offer: JobOffer, error: unknown) => void) {
    z.uuid().parse(deviceId);
    this.router.connect(transport, 'ACTIVE');
  }

  /** Startup reconciliation never reruns an accepted paid job from a duplicate offer. */
  async startup(): Promise<void> {
    if (this.started) return;
    await this.jobControl.stopOrphanedAtStartup();
    await this.jobControl.expireLeases();
    await this.jobControl.expireOverdue();
    this.started = true;
  }

  async pollOnce(): Promise<void> {
    if (!this.started) await this.startup();
    const messages = await this.transport.poll({ type: 'WORKER_HELLO', messageId: randomUUID(),
      workerDeviceId: this.deviceId, controlPlaneId: this.transport.controlPlaneId,
      supportedProtocolVersions: [WORKER_PROTOCOL_VERSION], workerRelease: '0.0.0-dev',
      localRevision: this.localState.snapshot().localRevision,
      activeExecutionIds: this.jobControl.snapshots().filter((item) =>
        !['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(item.status)).map((item) => item.executionId) });
    for (const message of messages) {
      if (message.controlPlaneId !== this.transport.controlPlaneId) {
        throw new WorkerDispatchError('WRONG_CONTROL_PLANE');
      }
      if (message.type === 'WORKER_WELCOME') {
        this.state = message.controlPlaneState;
        if (this.state === 'DRAINING') this.router.markDraining(this.transport.controlPlaneId);
        continue;
      }
      if (message.type === 'JOB_OFFER') {
        if (message.workerDeviceId !== this.deviceId) throw new WorkerDispatchError('WRONG_WORKER');
        if (this.state !== 'ACTIVE') throw new WorkerDispatchError('DRAINING');
        if (this.active.has(message.executionId) || this.jobControl.snapshots().some((item) =>
          item.executionId === message.executionId)) continue;
        this.router.ownExecution(message.executionId, this.transport.controlPlaneId);
        let pkg;
        try { pkg = this.packages.load(message.capabilityVersionId); }
        catch (error) { this.router.releaseExecution(message.executionId); this.onExecutionError(message, error); continue; }
        const task = this.supervisor.execute(message, pkg).catch((error: unknown) => {
          this.onExecutionError(message, error);
        }).finally(() => {
          this.active.delete(message.executionId);
          this.router.releaseExecution(message.executionId);
        });
        this.active.set(message.executionId, task);
        continue;
      }
      const command = WorkerJobControlCommandSchema.parse(message);
      const local = this.jobControl.snapshot(command.jobId);
      if (local.executionId !== command.executionId || local.attemptId !== command.attemptId ||
        local.controlPlaneId !== command.controlPlaneId) {
        throw new WorkerDispatchError('CONTROL_NOT_OWNED');
      }
      let status: 'PAUSED' | 'RUNNING' | 'SECURITY_PAUSED' | 'CANCELLED' |
        'PAUSE_NOT_SUPPORTED' | 'RESUME_NOT_READY' | 'SECURITY_BLOCK' | 'CONTROL_FAILED';
      let revision = local.localRevision;
      try {
        const input = { id: command.commandId, jobId: command.jobId,
          actorId: command.actorId, source: command.source, reason: command.reason };
        const after = command.action === 'PAUSE' ? await this.jobControl.pause(input) :
          command.action === 'RESUME' ? await this.jobControl.resume(input, command.overrideGlobalPause) :
            await this.jobControl.cancel(input);
        status = after.status === 'PAUSED' || after.status === 'SECURITY_PAUSED' ||
          after.status === 'RUNNING' || after.status === 'CANCELLED' ? after.status : 'CONTROL_FAILED';
        revision = after.localRevision;
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        status = code === 'PAUSE_NOT_SUPPORTED' ? 'PAUSE_NOT_SUPPORTED' :
          code === 'SECURITY_BLOCK' ? 'SECURITY_BLOCK' :
            code === 'NOT_READY' ? 'RESUME_NOT_READY' : 'CONTROL_FAILED';
        revision = this.jobControl.snapshot(command.jobId).localRevision;
      }
      await this.transport.send({ type: 'JOB_CONTROL_ACK', protocolVersion: WORKER_PROTOCOL_VERSION,
        messageId: randomUUID(), workerDeviceId: this.deviceId, commandId: command.commandId,
        jobId: command.jobId, executionId: command.executionId, attemptId: command.attemptId,
        controlPlaneId: command.controlPlaneId, status, localRevision: revision,
        confirmedAt: ['PAUSED', 'RUNNING', 'SECURITY_PAUSED', 'CANCELLED'].includes(status) ?
          new Date().toISOString() : null });
    }
  }

  async runUntilAborted(signal: AbortSignal, pollIntervalMs = 1000): Promise<void> {
    if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 30_000) {
      throw new RangeError('Invalid poll interval');
    }
    await this.startup();
    let retryMs = pollIntervalMs;
    while (!signal.aborted) {
      try {
        await this.pollOnce();
        retryMs = pollIntervalMs;
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        if (!['TRANSPORT_FAILED', 'DISCOVERY_FAILED'].includes(code)) throw error;
        retryMs = Math.min(retryMs * 2, 30_000);
      }
      await delay(retryMs, undefined, { signal }).catch(() => undefined);
    }
    await Promise.allSettled([...this.active.values()]);
    await this.transport.close();
  }

  async awaitActiveForTest(): Promise<void> { await Promise.allSettled([...this.active.values()]); }
}
