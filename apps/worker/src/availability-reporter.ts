import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { WorkerHeartbeatSchema, WORKER_PROTOCOL_VERSION } from
  '../../../packages/worker-protocol/src/messages.js';
import type { CapabilityAdmissionReadinessPort } from './job-admission.js';
import type { WorkerCapabilityPackageStore } from './capability-package-store.js';
import type { WorkerLocalState } from './local-state.js';

/** Read-only local health reporting. A bad or unknown dependency can only lower readiness. */
export class WorkerAvailabilityReporter {
  constructor(private readonly deviceId: string,
    private readonly packages: WorkerCapabilityPackageStore,
    private readonly localState: WorkerLocalState,
    private readonly readiness: CapabilityAdmissionReadinessPort) {
    z.uuid().parse(deviceId);
  }

  async heartbeat(input: { controlPlaneId: string; workerRelease: string;
    openClawVersion: string | null; runningJobs: number; capacity: number;
    policyVersion: number }): Promise<z.infer<typeof WorkerHeartbeatSchema>> {
    const paused = this.localState.snapshot();
    const reports: { capabilityVersionId: string; policyValidationHash: string | null;
      state: 'READY' | 'NOT_READY' }[] = [];
    for (const pkg of this.packages.listInstalled()) {
      if (pkg.workerDeviceId !== this.deviceId) throw new Error('WRONG_WORKER_PACKAGE');
      let policyValidationHash: string | null = null;
      let state: 'READY' | 'NOT_READY' = 'NOT_READY';
      try {
        const check = await this.readiness.check(pkg.capabilityVersionId);
        policyValidationHash = check.policyValidationHash;
        const age = Date.now() - Date.parse(check.checkedAt);
        if (check.ready && check.sandboxVerified && check.requiredSecretsReady &&
          check.runtimeHealthy &&
          Number.isFinite(age) && age >= 0 && age <= 30_000 &&
          policyValidationHash &&
          this.localState.isUnpausedForNewJobOffer(pkg.capabilityId)) state = 'READY';
      } catch { /* A missing local prerequisite is NOT_READY, never optimistic. */ }
      reports.push({ capabilityVersionId: pkg.capabilityVersionId,
        policyValidationHash, state });
    }
    return WorkerHeartbeatSchema.parse({ type:'WORKER_HEARTBEAT',
      protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),
      controlPlaneId:input.controlPlaneId,workerDeviceId:this.deviceId,
      workerRelease:input.workerRelease,sentAt:new Date().toISOString(),
      openClawVersion:input.openClawVersion,
      status:paused.globalPaused||paused.securityPaused?'PAUSED':'ONLINE',
      runningJobs:input.runningJobs,capacity:input.capacity,
      policyVersion:input.policyVersion,localRevision:paused.localRevision,
      capabilityReadiness:reports });
  }
}
