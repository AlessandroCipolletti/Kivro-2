import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema } from '../../../packages/contracts/src/capability-package.js';
import { hashWorkerManifest } from '../../../packages/contracts/src/worker-manifest.js';
import { parseJobOffer, type JobOffer } from '../../../packages/worker-protocol/src/messages.js';
import type { WorkerLocalState } from './local-state.js';

export interface CapabilityAdmissionReadiness {
  /** Security/runtime readiness is independent of the separately reported slot capacity. */
  readonly ready: boolean;
  readonly checkedAt: string;
  readonly policyValidationHash: string | null;
  readonly sandboxVerified: boolean;
  readonly requiredSecretsReady: boolean;
  readonly runtimeHealthy: boolean;
  readonly capacityAvailable: boolean;
  /** An installed published package or approved runtime changed after seller review. */
  readonly revalidationRequired?: boolean;
}

export interface CapabilityAdmissionReadinessPort {
  check(capabilityVersionId: string): Promise<CapabilityAdmissionReadiness>;
}

export class JobAdmissionError extends Error {
  constructor(readonly code: 'WRONG_WORKER' | 'WRONG_CONTROL_PLANE' | 'OFFER_EXPIRED' |
    'VERSION_MISMATCH' | 'POLICY_MISMATCH' | 'INPUT_LIMIT' | 'SELLER_PAUSED' |
    'RUNTIME_NOT_READY' | 'PAYMENT_UNATTESTED') {
    super(code); this.name = 'JobAdmissionError';
  }
}

/** Admission is local and read-only; payload fetch is authorized separately after cloud acceptance. */
export async function assessJobOffer(rawOffer: unknown, rawPackage: unknown, context: {
  readonly authenticatedControlPlaneId: string;
  readonly localWorkerDeviceId: string;
  readonly localPauseState: WorkerLocalState;
  readonly readiness: CapabilityAdmissionReadinessPort;
  readonly now?: number;
}): Promise<JobOffer> {
  const offer = parseJobOffer(rawOffer);
  const localPackage = LocalCapabilityPackageSchema.parse(rawPackage);
  if (offer.workerDeviceId !== context.localWorkerDeviceId ||
    localPackage.workerDeviceId !== context.localWorkerDeviceId) throw new JobAdmissionError('WRONG_WORKER');
  if (offer.controlPlaneId !== context.authenticatedControlPlaneId) {
    throw new JobAdmissionError('WRONG_CONTROL_PLANE');
  }
  if (Date.parse(offer.expiresAt) <= (context.now ?? Date.now())) throw new JobAdmissionError('OFFER_EXPIRED');
  if (offer.paymentSecured !== true || !offer.paymentReservationId) {
    throw new JobAdmissionError('PAYMENT_UNATTESTED');
  }
  if (offer.capabilityVersionId !== localPackage.capabilityVersionId ||
    offer.capabilityId !== localPackage.capabilityId ||
    offer.localPackageHash !== hashCanonicalJson(localPackage) ||
    offer.workerManifestHash !== hashWorkerManifest(localPackage.workerManifest) ||
    offer.inputSchemaHash !== hashCanonicalJson(localPackage.ioContract.input) ||
    offer.pauseSupport !== localPackage.pauseSupport) throw new JobAdmissionError('VERSION_MISMATCH');
  if (offer.permissionPolicyHash !== hashCanonicalJson(localPackage.permissionPolicy)) {
    throw new JobAdmissionError('POLICY_MISMATCH');
  }
  if (offer.inputTotalBytes > localPackage.workerManifest.limits.maxInputBytes ||
    offer.inputFileCount > 50) throw new JobAdmissionError('INPUT_LIMIT');
  if (!context.localPauseState.isUnpausedForNewJobOffer(localPackage.capabilityId)) {
    throw new JobAdmissionError('SELLER_PAUSED');
  }
  const readiness = await context.readiness.check(localPackage.capabilityVersionId);
  const age = (context.now ?? Date.now()) - Date.parse(readiness.checkedAt);
  if (!readiness.ready || !readiness.sandboxVerified || !readiness.requiredSecretsReady ||
    !readiness.runtimeHealthy || !readiness.capacityAvailable || !Number.isFinite(age) ||
    age < 0 || age > 30_000) throw new JobAdmissionError('RUNTIME_NOT_READY');
  if (readiness.policyValidationHash !== offer.policyValidationHash) {
    throw new JobAdmissionError('POLICY_MISMATCH');
  }
  return offer;
}
