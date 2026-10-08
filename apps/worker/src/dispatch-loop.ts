import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { WORKER_PROTOCOL_VERSION, WorkerHeartbeatSchema, WorkerJobControlCommandSchema,
  WorkerWelcomeSchema, JobOfferSchema, type JobOffer } from
  '../../../packages/worker-protocol/src/messages.js';
import { WorkerTransportRouter } from '../../../packages/worker-protocol/src/transport.js';
import type { WorkerCapabilityPackageStore } from './capability-package-store.js';
import type { WorkerExecutionSupervisor } from './execution-supervisor.js';
import { WorkerJobControl } from './job-control.js';
import { WorkerLocalState } from './local-state.js';
import type { WorkerAvailabilityReporter } from './availability-reporter.js';
import { flushLocalJobControls } from './local-control-outbox.js';
import type { WorkerDispatchCapacity } from './dispatch-capacity.js';

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
    'CONTROL_NOT_OWNED' | 'DRAINING' | 'CAPACITY_FULL' | 'PAUSE_UNSYNCHRONIZED' |
    'NOT_READY') { super(code); this.name = 'WorkerDispatchError'; }
}

/** Spread reconnect attempts without extending the 30-second transport cap. */
export function workerRetryDelayMs(backoffMs:number,randomFraction=Math.random()):number{
  if(!Number.isSafeInteger(backoffMs)||backoffMs<100||backoffMs>30_000||
    !Number.isFinite(randomFraction)||randomFraction<0||randomFraction>=1)
    throw new RangeError('Invalid retry delay');
  return Math.min(30_000,Math.max(100,
    Math.floor(backoffMs*(0.8+randomFraction*0.4))));
}

/** Provider-neutral orchestration; callers compose a transport and a real job supervisor. */
export class WorkerDispatchLoop {
  private readonly router = new WorkerTransportRouter();
  private readonly active = new Map<string, Promise<void>>();
  private state: 'ACTIVE' | 'DRAINING' | 'RETIRED' = 'ACTIVE';
  private discoveryDraining=false;
  private started = false;
  private pauseSynchronized = false;
  private readyVersions=new Set<string>();

  constructor(private readonly transport: WorkerInboundPollingPort,
    private readonly deviceId: string, private readonly packages: WorkerCapabilityPackageStore,
    private readonly localState: WorkerLocalState, private readonly jobControl: WorkerJobControl,
    private readonly supervisor: WorkerExecutionSupervisor,
  private readonly onExecutionError: (offer: JobOffer, error: unknown) => void,
    private readonly availabilityReporting?: { reporter: WorkerAvailabilityReporter;
      capacity: number; workerRelease: string; openClawVersion: string | null;
      policyVersion: number; coordinator?: WorkerDispatchCapacity;
      operationalChecks?:()=>Promise<NonNullable<z.infer<typeof WorkerHeartbeatSchema>['operationalChecks']>> }) {
    z.uuid().parse(deviceId);
    this.router.connect(transport, 'ACTIVE');
  }

  /** Startup reconciliation never reruns an accepted paid job from a duplicate offer. */
  async startup(skipOrphanSweep=false): Promise<void> {
    if (this.started) return;
    if(!skipOrphanSweep)await this.jobControl.stopOrphanedAtStartup();
    await this.jobControl.expireLeases();
    await this.jobControl.expireOverdue();
    await flushLocalJobControls(this.jobControl,this.transport,this.deviceId);
    this.started = true;
  }

  setDiscoveryState(state:'ACTIVE'|'DRAINING'):void{
    this.discoveryDraining=state==='DRAINING';
    if(this.discoveryDraining){
      this.state='DRAINING';
      this.router.markDraining(this.transport.controlPlaneId);
    }else this.router.connect(this.transport,'ACTIVE');
  }

  async pollOnce(): Promise<void> {
    if (!this.started) await this.startup();
    this.pauseSynchronized=false;
    this.readyVersions.clear();
    await this.jobControl.expireLeases();
    await this.jobControl.expireOverdue();
    await flushLocalJobControls(this.jobControl,this.transport,this.deviceId);
    if (this.availabilityReporting) {
      // Refresh security prerequisites on every signed heartbeat. An omitted
      // report would overwrite the initial health observation in Cloud.
      const operationalChecks=await this.availabilityReporting.operationalChecks?.();
      const beat=await this.availabilityReporting.reporter.heartbeat({
        controlPlaneId:this.transport.controlPlaneId,
        workerRelease:this.availabilityReporting.workerRelease,
        openClawVersion:this.availabilityReporting.openClawVersion,
        runningJobs:this.availabilityReporting.coordinator?.activeCount(
          this.jobControl.snapshots())??this.active.size,
        capacity:this.discoveryDraining?0:this.availabilityReporting.capacity,
        policyVersion:this.availabilityReporting.policyVersion,
        ...(operationalChecks?{operationalChecks}:{}) });
      await this.transport.send(beat);
      this.readyVersions=new Set((beat.capabilityReadiness??[])
        .filter((item)=>item.state==='READY').map((item)=>item.capabilityVersionId));
      // HTTP success means the signed report was durably accepted by cloud. If it
      // times out, keep the revision pending; the retry is replay-safe.
      if(this.localState.acknowledgeCloudRevisionForPlane)
        this.localState.acknowledgeCloudRevisionForPlane(this.transport.controlPlaneId,
          beat.localRevision);
      else this.localState.acknowledgeCloudRevision(beat.localRevision);
    }
    const messages = await this.transport.poll({ type: 'WORKER_HELLO', messageId: randomUUID(),
      workerDeviceId: this.deviceId, controlPlaneId: this.transport.controlPlaneId,
      supportedProtocolVersions: [WORKER_PROTOCOL_VERSION],
      workerRelease: this.availabilityReporting?.workerRelease ?? '0.0.0-dev',
      localRevision: this.localState.snapshot().localRevision,
      activeExecutionIds: this.jobControl.snapshots().filter((item) =>
        item.controlPlaneId===this.transport.controlPlaneId &&
        !['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(item.status)).map((item) => item.executionId) });
    for (const message of messages) {
      if (message.controlPlaneId !== this.transport.controlPlaneId) {
        throw new WorkerDispatchError('WRONG_CONTROL_PLANE');
      }
      if (message.type === 'WORKER_WELCOME') {
        this.state = this.discoveryDraining?'DRAINING':message.controlPlaneState;
        if (message.pauseDirective) {
          if(this.localState.applyCloudDirectiveForPlane)
            this.localState.applyCloudDirectiveForPlane(this.transport.controlPlaneId,
              message.pauseDirective);
          else this.localState.applyCloudDirective(message.pauseDirective);
          this.pauseSynchronized = true;
          this.localState.recordCloudContact(this.availabilityReporting?.capacity??0);
          if(this.localState.snapshot().securityPaused)
            await this.jobControl.enforceSecurityPause();
        } else {
          this.pauseSynchronized = false;
        }
        if (this.state === 'DRAINING') this.router.markDraining(this.transport.controlPlaneId);
        continue;
      }
      if (message.type === 'JOB_OFFER') {
        if (message.workerDeviceId !== this.deviceId) throw new WorkerDispatchError('WRONG_WORKER');
        if (this.state !== 'ACTIVE') {
          this.onExecutionError(message,new WorkerDispatchError('DRAINING'));
          continue;
        }
        if (!this.pauseSynchronized) {
          this.onExecutionError(message,new WorkerDispatchError('PAUSE_UNSYNCHRONIZED'));
          continue;
        }
        if(!this.availabilityReporting||this.availabilityReporting.capacity<1||
          !this.readyVersions.has(message.capabilityVersionId)||
          !this.localState.isUnpausedForNewJobOffer(message.capabilityId)){
          this.onExecutionError(message,new WorkerDispatchError('NOT_READY'));
          continue;
        }
        const existing=this.jobControl.snapshots().find((item)=>
          item.executionId===message.executionId);
        if(existing&&existing.controlPlaneId!==this.transport.controlPlaneId)
          throw new WorkerDispatchError('WRONG_CONTROL_PLANE');
        if (this.active.has(message.executionId) || existing) continue;
        if (this.availabilityReporting && this.active.size >= this.availabilityReporting.capacity) {
          this.onExecutionError(message,new WorkerDispatchError('CAPACITY_FULL')); continue;
        }
        let pkg;
        let reviewedSkills;
        try {
          pkg = this.packages.load(message.capabilityVersionId);
          reviewedSkills = this.packages.loadReviewedSkills(message.capabilityVersionId);
        }
        catch (error) { this.onExecutionError(message, error); continue; }
        const snapshots=this.jobControl.snapshots();
        const reserved=this.availabilityReporting?.coordinator?.reserve(message,
          pkg.concurrencyLimit,snapshots);
        const occupied=snapshots.filter((item)=>
          item.capabilityVersionId===pkg.capabilityVersionId&&
          !['STOPPED','CANCELLED','TIMED_OUT'].includes(item.status)).length;
        if(reserved&&reserved!=='ACQUIRED'||!reserved&&occupied>=pkg.concurrencyLimit){
          this.onExecutionError(message,new WorkerDispatchError(
            reserved==='WRONG_CONTROL_PLANE'?'WRONG_CONTROL_PLANE':'CAPACITY_FULL'));
          continue;
        }
        try{this.router.ownExecution(message.executionId,this.transport.controlPlaneId);}
        catch(error){this.availabilityReporting?.coordinator?.release(message.executionId,
          this.transport.controlPlaneId);throw error;}
        const task = this.supervisor.execute(message, pkg, reviewedSkills).catch((error: unknown) => {
          this.onExecutionError(message, error);
        }).finally(() => {
          this.active.delete(message.executionId);
          this.router.releaseExecution(message.executionId);
          this.availabilityReporting?.coordinator?.release(message.executionId,
            this.transport.controlPlaneId);
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
      if(['PAUSED','RUNNING','SECURITY_PAUSED','CANCELLED'].includes(status))
        this.jobControl.acknowledge(command.jobId,command.executionId,
          command.controlPlaneId,revision);
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
      await delay(retryMs===pollIntervalMs?retryMs:workerRetryDelayMs(retryMs),
        undefined, { signal }).catch(() => undefined);
    }
    await Promise.allSettled([...this.active.values()]);
    await this.transport.close();
  }

  async awaitActiveForTest(): Promise<void> { await Promise.allSettled([...this.active.values()]); }
}
