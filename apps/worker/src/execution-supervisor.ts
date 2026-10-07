import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema } from '../../../packages/contracts/src/capability-package.js';
import { OfflineSandboxPlanSchema } from '../../../packages/contracts/src/sandbox.js';
import { buildJobInstructionEnvelope } from '../../../packages/application/src/job-instructions.js';
import type { ObjectStoragePort } from '../../../packages/infrastructure/contracts/src/ports.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from '../../../packages/sandbox-adapter/src/docker.js';
import type { JobOffer } from '../../../packages/worker-protocol/src/messages.js';
import { workerExecutionEventId } from '../../../packages/worker-protocol/src/event-id.js';
import { assessJobOffer, type CapabilityAdmissionReadinessPort } from './job-admission.js';
import { WorkerJobControl } from './job-control.js';
import type { WorkerLocalState } from './local-state.js';
import { withStagedBuyerInputs, type InputDownload } from './input-staging.js';
import { uploadValidatedOutput } from './output-upload.js';
import { WorkerResultOutbox, type PendingWorkerResult } from './result-outbox.js';
import { BrokerSidecar } from './broker-sidecar.js';
import { WorkerBrokerRouter, type JobBrokerPorts } from './broker-router.js';
import { prepareOpenClawJobInput, type ReviewedSkillSnapshot } from
  '../../../packages/openclaw-adapter/src/job-config.js';
import type { OpenClawImageApproval } from '../../../packages/openclaw-adapter/src/image-approval.js';
import { isPinnedRuntimeRangeCompatible } from
  '../../../packages/openclaw-adapter/src/compatibility.js';

export interface AcceptedJobPayload {
  readonly jobId: string; readonly executionId: string; readonly attemptId: string;
  readonly buyerAccountId: string; readonly outputRetainUntil: string;
  readonly inputManifestId: string; readonly inputManifestHash: string; readonly inputSchemaHash: string;
  readonly inputContract: unknown; readonly outputContract: unknown; readonly payload: unknown;
  readonly stagedAssets: unknown; readonly downloads: readonly InputDownload[];
}

/** The remote implementation must authenticate Worker identity and re-read ledger/job/lease state. */
export interface WorkerExecutionCloudPort {
  accept(offer: JobOffer, messageId: string): Promise<void>;
  acceptedInput(offer: JobOffer): Promise<AcceptedJobPayload>;
  transition(offer: JobOffer, input: { id: string; jobId: string; from: 'ACCEPTED' | 'STARTING' | 'RUNNING';
    to: 'STARTING' | 'RUNNING' | 'UPLOADING_RESULT'; actor: 'WORKER'; reason: string;
    attemptId: string; correlationId: string; paymentReservationId: null; resultManifestId: null }): Promise<void>;
  renewLease(offer: JobOffer, ttlSeconds: number): Promise<string>;
  prepareResultAsset(offer:JobOffer,asset:{assetId:string;fieldKey:string;
    extension:string;sizeBytes:number;sha256:string;detectedMimeType:string}):Promise<{
    assetId:string;objectKey:string;uploadUrl:string;
    uploadHeaders:Readonly<Record<string,string>>}>;
  finalizeResult(result: PendingWorkerResult): Promise<void>;
  failExecution(offer: JobOffer, input: { from: 'ACCEPTED' | 'STARTING' | 'RUNNING' |
    'UPLOADING_RESULT'; to: 'FAILED_POLICY' | 'FAILED_STARTUP' | 'FAILED_EXECUTION' |
    'RESULT_REJECTED';
    reason: string }): Promise<void>;
}

export class WorkerExecutionError extends Error {
  constructor(readonly code: 'PAYLOAD_MISMATCH' | 'LEASE_EXPIRED' | 'NOT_READY' | 'OUTPUT_NOT_DURABLE') {
    super(code); this.name = 'WorkerExecutionError';
  }
}

export interface WorkerSupervisorDependencies {
  readonly cloud: WorkerExecutionCloudPort;
  readonly localState: WorkerLocalState;
  readonly readiness: CapabilityAdmissionReadinessPort;
  readonly jobControl: WorkerJobControl;
  readonly outbox: WorkerResultOutbox;
  readonly sandbox: DockerSandboxAdapter;
  readonly docker: DockerJobControlAdapter;
  readonly dockerExecutable: string;
  readonly brokerPorts: JobBrokerPorts | ((pkg: ReturnType<typeof LocalCapabilityPackageSchema.parse>) => JobBrokerPorts);
  readonly storage: ObjectStoragePort | null;
  readonly attemptRoot: string;
  readonly storageOrigin: string;
  readonly approvedImage: string;
  readonly imageApproval: OpenClawImageApproval;
  readonly localWorkerDeviceId: string;
  readonly authenticatedControlPlaneId: string;
  readonly allowInsecureLoopbackStorage?: boolean;
  readonly inputFetcher?: typeof fetch;
}

/** One accepted attempt; cloud owns financial truth and Docker owns execution isolation. */
export class WorkerExecutionSupervisor {
  constructor(private readonly deps: WorkerSupervisorDependencies) {}

  private event(offer: JobOffer, from: 'ACCEPTED' | 'STARTING' | 'RUNNING',
    to: 'STARTING' | 'RUNNING' | 'UPLOADING_RESULT') {
    return { id: workerExecutionEventId(offer.executionId, to), jobId: offer.jobId, from, to,
      actor: 'WORKER' as const, reason: `WORKER_${to}`, attemptId: offer.attemptId,
      correlationId: offer.executionId, paymentReservationId: null, resultManifestId: null };
  }

  async execute(rawOffer: unknown, rawPackage: unknown,
    reviewedSkills: readonly ReviewedSkillSnapshot[]): Promise<void> {
    const offer = await assessJobOffer(rawOffer, rawPackage, {
      authenticatedControlPlaneId: this.deps.authenticatedControlPlaneId,
      localWorkerDeviceId: this.deps.localWorkerDeviceId,
      localPauseState: this.deps.localState, readiness: this.deps.readiness,
    });
    const pkg = LocalCapabilityPackageSchema.parse(rawPackage);
    const approval=await this.deps.imageApproval.assertApprovedImage(this.deps.approvedImage);
    if(!isPinnedRuntimeRangeCompatible(pkg.workerManifest.runtime.supportedVersionRange,
      approval.openClawVersion))throw new WorkerExecutionError('NOT_READY');
    if (this.deps.outbox.load(offer.executionId)) {
      throw new WorkerExecutionError('OUTPUT_NOT_DURABLE');
    }
    await this.deps.cloud.accept(offer, workerExecutionEventId(offer.executionId, 'ACCEPT'));
    let phase: 'ACCEPTED' | 'STARTING' | 'RUNNING' | 'UPLOADING_RESULT' = 'ACCEPTED';
    try {
    const accepted = await this.deps.cloud.acceptedInput(offer);
    if (accepted.jobId !== offer.jobId || accepted.executionId !== offer.executionId ||
      accepted.attemptId !== offer.attemptId || accepted.inputManifestId !== offer.inputManifestId ||
      accepted.inputManifestHash !== offer.inputManifestHash ||
      accepted.inputSchemaHash !== offer.inputSchemaHash ||
      hashCanonicalJson(accepted.inputContract) !== offer.inputSchemaHash ||
      hashCanonicalJson(accepted.outputContract) !== hashCanonicalJson(pkg.ioContract.output) ||
      accepted.downloads.length !== offer.inputFileCount ||
      !z.uuid().safeParse(accepted.buyerAccountId).success ||
      Date.parse(accepted.outputRetainUntil) <= Date.now()) {
      throw new WorkerExecutionError('PAYLOAD_MISMATCH');
    }
    const envelope = buildJobInstructionEnvelope(accepted.inputContract, accepted.outputContract,
      accepted.payload, accepted.stagedAssets);
    const hashes = accepted.downloads.map((file) => ({ id: file.binding.assetId,
      sizeBytes: file.binding.sizeBytes, sha256: file.expectedSha256 })).sort((a, b) => a.id.localeCompare(b.id));
    const inputBytes = Buffer.byteLength(canonicalJson(accepted.payload)) +
      hashes.reduce((sum, file) => sum + file.sizeBytes, 0);
    if (hashCanonicalJson({ jobId: offer.jobId, payload: accepted.payload, assets: hashes }) !==
      offer.inputManifestHash || inputBytes !== offer.inputTotalBytes ||
      new Set(hashes.map((file) => file.id)).size !== hashes.length ||
      !envelope.files.every((file) => accepted.downloads.some((item) =>
        item.binding.path === file.path && item.binding.assetId === file.assetId))) {
      throw new WorkerExecutionError('PAYLOAD_MISMATCH');
    }
    const fileOutput = envelope.contractData.output.fields.some((field) =>
      field.type === 'FILE' || field.type === 'FILES');
    const brokerPorts=typeof this.deps.brokerPorts==='function'?
      this.deps.brokerPorts(pkg):this.deps.brokerPorts;
    const router = new WorkerBrokerRouter(pkg, offer.jobId, brokerPorts,
      { inputFiles: envelope.files.length > 0, outputFiles: fileOutput });
    const limits = pkg.workerManifest.limits;
    const plan = OfflineSandboxPlanSchema.parse({ planVersion: 1, image: this.deps.approvedImage,
      networkMode: 'none', readOnlyRoot: true, capDrop: ['ALL'], noNewPrivileges: true,
      seccomp: 'builtin', runAs: '65532:65532', maxRuntimeSeconds: limits.timeoutSeconds,
      memoryMb: limits.memoryMb, cpu: limits.cpu, maxPids: limits.maxPids,
      maxOutputBytes: limits.maxOutputBytes });
    if (pkg.workerManifest.network.default !== 'deny' ||
      pkg.workerManifest.runtime.type !== 'openclaw' ||
      pkg.workerManifest.network.allow.length > 0) {
      throw new WorkerExecutionError('NOT_READY');
    }
    const maxOutputFileBytes = Math.max(1, Math.min(limits.maxOutputBytes,
      ...envelope.contractData.output.fields.filter((field) =>
        field.type === 'FILE' || field.type === 'FILES').map((field) => field.constraints.maxFileSizeBytes)));
    await this.deps.cloud.transition(offer, this.event(offer, 'ACCEPTED', 'STARTING'));
    phase = 'STARTING';
    await withStagedBuyerInputs({ attemptRoot: this.deps.attemptRoot, attemptId: offer.attemptId,
      storageOrigin: this.deps.storageOrigin,
      ...(this.deps.allowInsecureLoopbackStorage === undefined ? {} :
        { allowInsecureLoopback: this.deps.allowInsecureLoopbackStorage }),
      downloads: accepted.downloads, maxFileBytes: limits.maxInputBytes,
      maxTotalBytes: limits.maxInputBytes, timeoutMs: 60_000,
      ...(this.deps.inputFetcher ? { fetcher: this.deps.inputFetcher } : {}),
    }, async (inputRoot) => {
      await prepareOpenClawJobInput({ inputRoot, localPackage: pkg, envelope,
        approvedImage: this.deps.approvedImage,
        allowedToolNames: router.allowedToolNames, reviewedSkills,
        maxOutputFileBytes });
      const authorize = async (): Promise<void> => {
        const state = this.deps.jobControl.snapshot(offer.jobId);
        if (state.executionId !== offer.executionId || state.attemptId !== offer.attemptId ||
          state.status !== 'RUNNING' || Date.parse(state.leaseExpiresAt) <= Date.now() ||
          this.deps.localState.snapshot().securityPaused) throw new WorkerExecutionError('NOT_READY');
      };
      const sidecar = new BrokerSidecar(this.deps.dockerExecutable, this.deps.docker,
        offer.jobId, offer.attemptId, authorize, (request, signal) => router.dispatch(request, signal),
        { begin: (id) => this.deps.jobControl.beginBrokerOperation(offer.jobId, id),
          end: (id) => this.deps.jobControl.endBrokerOperation(offer.jobId, id) });
      let lastRenewAttempt = 0;
      try {
        await this.deps.sandbox.runWithOutputControlled(plan, offer.attemptId, ['run-job'],
          envelope.contractData.output, { maxFileBytes: maxOutputFileBytes,
            maxResultBytes: limits.maxOutputBytes }, async (collected, outputRoot) => {
            await this.deps.cloud.transition(offer, this.event(offer, 'RUNNING', 'UPLOADING_RESULT'));
            phase = 'UPLOADING_RESULT';
            const upload = await uploadValidatedOutput(this.deps.storage, {
              ownerAccountId: accepted.buyerAccountId, sourceJobId: offer.jobId,
              retainUntil: accepted.outputRetainUntil, maxTotalBytes: limits.maxOutputBytes,
              outputRoot, outputContract: envelope.contractData.output, collected,
              storageOrigin:this.deps.storageOrigin,
              allowInsecureLoopback:this.deps.allowInsecureLoopbackStorage??false,
              prepareAsset:(asset)=>this.deps.cloud.prepareResultAsset(offer,asset) });
            const pending = this.deps.outbox.record(offer, upload, accepted.outputRetainUntil);
            await this.deps.cloud.finalizeResult(pending);
            this.deps.outbox.acknowledge(offer.executionId);
          }, { jobId: offer.jobId,
            onReady: async (containerId) => {
              this.deps.jobControl.register({ jobId: offer.jobId, executionId: offer.executionId,
                attemptId: offer.attemptId, capabilityVersionId: offer.capabilityVersionId,
                containerId, controlPlaneId: offer.controlPlaneId,
                pauseSupport: offer.pauseSupport, leaseExpiresAt: offer.expiresAt });
            },
            onStartPermitted: async (id) => { this.deps.jobControl.assertStartPermitted(offer.jobId, id); },
            onStarted: async (id) => {
              this.deps.jobControl.markRunning(offer.jobId);
              await this.deps.cloud.transition(offer, this.event(offer, 'STARTING', 'RUNNING'));
              phase = 'RUNNING';
              await sidecar.start(id);
            },
            onWatchdogTick: async () => {
              const before = this.deps.jobControl.snapshot(offer.jobId);
              if(this.deps.localState.snapshot().securityPaused){
                await sidecar.quiesce();
                const changed=await this.deps.jobControl.enforceSecurityPause();
                if(changed.some((item)=>item.jobId===offer.jobId&&item.status==='CANCELLED'))
                  throw new WorkerExecutionError('NOT_READY');
              }
              if (['PAUSE_REQUESTED', 'CANCEL_REQUESTED'].includes(before.status) ||
                Date.parse(before.leaseExpiresAt) <= Date.now() ||
                (before.pauseExpiresAt && Date.parse(before.pauseExpiresAt) <= Date.now())) {
                await sidecar.quiesce();
              }
              await this.deps.jobControl.expireLeases();
              await this.deps.jobControl.expireOverdue();
              const state = this.deps.jobControl.snapshot(offer.jobId);
              if (state.status === 'RUNNING' && Date.parse(state.leaseExpiresAt) - Date.now() < 15_000 &&
                Date.now() - lastRenewAttempt > 2_000) {
                lastRenewAttempt = Date.now();
                try {
                  const expiry = await this.deps.cloud.renewLease(offer, 60);
                  this.deps.jobControl.extendLease(offer.jobId, offer.executionId, offer.controlPlaneId, expiry);
                } catch (error) {
                  if (error instanceof Error && 'code' in error &&
                    ['PAYMENT_NOT_SECURED', 'NOT_ELIGIBLE', 'WRONG_WORKER', 'INVALID_LEASE'].includes(
                      String(error.code))) throw error;
                }
              }
            },
            onStopped: async (id) => {
              await sidecar.close();
              this.deps.jobControl.markStopped(offer.jobId, id);
            },
          });
      } finally { await sidecar.close(); }
    });
    } catch (error) {
      if (!this.deps.outbox.load(offer.executionId)) {
        const reason = error instanceof Error && 'code' in error && typeof error.code === 'string' &&
          /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code) ? error.code : 'WORKER_EXECUTION_FAILED';
        const to = phase === 'ACCEPTED' ? 'FAILED_POLICY' :
          phase === 'STARTING' ? 'FAILED_STARTUP' :
          phase === 'RUNNING' ? 'FAILED_EXECUTION' : 'RESULT_REJECTED';
        try { await this.deps.cloud.failExecution(offer, { from: phase, to, reason }); }
        catch { /* The cloud reconciler remains authoritative if cancellation/payment raced. */ }
      }
      throw error;
    }
  }

  /** Retry a lost finalization acknowledgement without rerunning OpenClaw or uploading files. */
  async retryPendingResults(controlPlaneId?:string): Promise<number> {
    let completed = 0;
    for (const pending of this.deps.outbox.pending()) {
      if(controlPlaneId&&pending.controlPlaneId!==controlPlaneId)continue;
      await this.deps.cloud.finalizeResult(pending);
      this.deps.outbox.acknowledge(pending.executionId);
      completed++;
    }
    return completed;
  }
}
