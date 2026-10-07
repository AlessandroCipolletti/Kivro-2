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
    policyVersion: number; operationalChecks?: readonly {
      code:'DEVICE_IDENTITY'|'DOCKER_DAEMON'|'APPROVED_SANDBOX_IMAGE'|
        'SELLER_INFERENCE_CREDENTIALS'|'REVIEWED_PACKAGES'|'CLOUD_CONNECTION'|
        'SECURITY_PAUSE'|'SELLER_PAUSE'|'SANDBOX_SELF_TEST'|'EXECUTION_CAPACITY';
      state:'HEALTHY'|'BLOCKING'|'UNKNOWN';}[] }): Promise<z.infer<typeof WorkerHeartbeatSchema>> {
    const paused = this.localState.snapshot();
    const reports: { capabilityVersionId: string; policyValidationHash: string | null;
      state: 'READY' | 'NOT_READY'; checks?: {sandboxVerified:boolean;
        requiredSecretsReady:boolean;runtimeHealthy:boolean} }[] = [];
    for (const pkg of this.packages.listInstalled()) {
      if (pkg.workerDeviceId !== this.deviceId) throw new Error('WRONG_WORKER_PACKAGE');
      let policyValidationHash: string | null = null;
      let state: 'READY' | 'NOT_READY' = 'NOT_READY';
      let checks: {sandboxVerified:boolean;requiredSecretsReady:boolean;
        runtimeHealthy:boolean}|undefined;
      try {
        const check = await this.readiness.check(pkg.capabilityVersionId);
        checks={sandboxVerified:check.sandboxVerified,
          requiredSecretsReady:check.requiredSecretsReady,runtimeHealthy:check.runtimeHealthy};
        policyValidationHash = check.policyValidationHash;
        const age = Date.now() - Date.parse(check.checkedAt);
        if (check.ready && check.sandboxVerified && check.requiredSecretsReady &&
          check.runtimeHealthy &&
          Number.isFinite(age) && age >= 0 && age <= 30_000 &&
          policyValidationHash &&
          this.localState.isUnpausedForNewJobOffer(pkg.capabilityId)) state = 'READY';
      } catch { /* A missing local prerequisite is NOT_READY, never optimistic. */ }
      reports.push({ capabilityVersionId: pkg.capabilityVersionId,
        policyValidationHash, state,...(checks?{checks}:{}) });
    }
    return WorkerHeartbeatSchema.parse({ type:'WORKER_HEARTBEAT',
      protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),
      controlPlaneId:input.controlPlaneId,workerDeviceId:this.deviceId,
      workerRelease:input.workerRelease,sentAt:new Date().toISOString(),
      openClawVersion:input.openClawVersion,
      status:paused.globalPaused||paused.securityPaused?'PAUSED':'ONLINE',
      runningJobs:input.runningJobs,capacity:input.capacity,
      policyVersion:input.policyVersion,localRevision:paused.localRevision,
      acknowledgedCloudRevision:paused.cloudRevision??0,
      localPause:{globalPaused:paused.localPaused ?? paused.globalPaused,
        securityPaused:paused.securityPaused,
        capabilityPauses:paused.localCapabilityPauses ?? paused.capabilityPauses ?? []},
      ...(input.operationalChecks?{operationalChecks:input.operationalChecks}:{}),
      capabilityReadiness:reports });
  }
}
