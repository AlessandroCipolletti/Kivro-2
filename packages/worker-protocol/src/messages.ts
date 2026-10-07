import { z } from 'zod';
import { DigestSchema } from '../../contracts/src/capability-version.js';
import { PauseSupportSchema, JobControlCommandSchema, JobControlAckSchema } from '../../contracts/src/job-control.js';

export const WORKER_PROTOCOL_VERSION = 'kivro-worker/1' as const;

export const WorkerHelloSchema = z.strictObject({
  type: z.literal('WORKER_HELLO'),
  messageId: z.uuid(),
  workerDeviceId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  supportedProtocolVersions: z.array(z.string().min(1).max(80)).min(1).max(16),
  workerRelease: z.string().min(1).max(80),
  localRevision: z.number().int().nonnegative(),
  activeExecutionIds: z.array(z.uuid()).max(64),
});

export const WorkerWelcomeSchema = z.strictObject({
  type: z.literal('WORKER_WELCOME'),
  messageId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  selectedProtocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  controlPlaneState: z.enum(['ACTIVE', 'DRAINING', 'RETIRED']),
  serverTime: z.iso.datetime(),
  pauseDirective: z.strictObject({
    revision: z.number().int().nonnegative(),
    paused: z.boolean(),
    securityPaused: z.boolean(),
    clearSecurityPause: z.boolean().optional(),
    capabilityPauses: z.array(z.uuid()).max(64),
  }).refine((value)=>!value.clearSecurityPause||!value.securityPaused,
    'A security clear cannot accompany a security block').optional(),
});

export const WorkerHeartbeatSchema = z.strictObject({
  type: z.literal('WORKER_HEARTBEAT'),
  protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  workerDeviceId: z.uuid(),
  workerRelease: z.string().min(1).max(80),
  sentAt: z.iso.datetime().optional(),
  openClawVersion: z.string().min(1).max(80).nullable(),
  openClawCompatibility:z.enum(['APPROVED_PINNED','UNAVAILABLE']).optional(),
  status: z.enum(['ONLINE', 'PAUSED', 'NOT_READY']),
  runningJobs: z.number().int().nonnegative().max(64),
  capacity: z.number().int().nonnegative().max(64),
  policyVersion: z.number().int().positive(),
  localRevision: z.number().int().nonnegative(),
  acknowledgedCloudRevision: z.number().int().nonnegative().optional(),
  localPause: z.strictObject({
    globalPaused: z.boolean(),
    securityPaused: z.boolean(),
    capabilityPauses: z.array(z.uuid()).max(64),
  }).optional(),
  operationalChecks: z.array(z.strictObject({
    code:z.enum(['DEVICE_IDENTITY','DOCKER_DAEMON','APPROVED_SANDBOX_IMAGE',
      'SELLER_INFERENCE_CREDENTIALS','REVIEWED_PACKAGES','CLOUD_CONNECTION',
      'SECURITY_PAUSE','SELLER_PAUSE','SANDBOX_SELF_TEST','EXECUTION_CAPACITY']),
    state:z.enum(['HEALTHY','BLOCKING','UNKNOWN']),
  })).max(12).optional(),
  capabilityReadiness: z.array(z.strictObject({
    capabilityVersionId: z.uuid(),
    policyValidationHash: DigestSchema.nullable(),
    state: z.enum(['READY','NOT_READY','DEPENDENCY_BLOCKED']),
    checks: z.strictObject({sandboxVerified:z.boolean(),requiredSecretsReady:z.boolean(),
      runtimeHealthy:z.boolean()}).optional(),
  }).refine((value) => value.state !== 'READY' ||
    (value.policyValidationHash !== null && value.checks?.sandboxVerified === true &&
      value.checks.requiredSecretsReady === true && value.checks.runtimeHealthy === true))).max(64).optional(),
}).refine((value)=>value.openClawCompatibility!=='APPROVED_PINNED'||
  (value.openClawVersion!==null&&value.operationalChecks?.some((check)=>
    check.code==='APPROVED_SANDBOX_IMAGE'&&check.state==='HEALTHY')===true),
  'Approved runtime requires matching observed image health');

export const JobOfferSchema = z.strictObject({
  type: z.literal('JOB_OFFER'),
  protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  jobId: z.uuid(),
  executionId: z.uuid(),
  attemptId: z.uuid(),
  workerDeviceId: z.uuid(),
  capabilityId: z.uuid(),
  capabilityVersionId: z.uuid(),
  inputManifestId: z.uuid(),
  paymentReservationId: z.uuid(),
  workerManifestHash: DigestSchema,
  localPackageHash: DigestSchema,
  permissionPolicyHash: DigestSchema,
  policyValidationHash: DigestSchema,
  inputSchemaHash: DigestSchema,
  inputManifestHash: DigestSchema,
  inputTotalBytes: z.number().int().nonnegative(),
  inputFileCount: z.number().int().nonnegative().max(50),
  pauseSupport: PauseSupportSchema,
  expiresAt: z.iso.datetime(),
  leaseToken: z.string().min(32).max(512),
  paymentSecured: z.literal(true),
});

export const JobAcceptedSchema = z.strictObject({
  type: z.literal('JOB_ACCEPTED'), protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(), controlPlaneId: z.string().min(1).max(160),
  executionId: z.uuid(), attemptId: z.uuid(), jobId: z.uuid(), workerDeviceId: z.uuid(),
  leaseToken: z.string().min(32).max(512),
});

export const WorkerJobControlCommandSchema = JobControlCommandSchema.extend({
  type: z.literal('JOB_CONTROL'), protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(),
  overrideGlobalPause: z.boolean(),
});

export const WorkerJobControlAckSchema = JobControlAckSchema.extend({
  type: z.literal('JOB_CONTROL_ACK'), protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(), workerDeviceId: z.uuid(),
});

/** Durable seller-local command result; cloud may reconcile it after an outage. */
export const WorkerLocalJobControlReportSchema = z.strictObject({
  type:z.literal('LOCAL_JOB_CONTROL_REPORT'),protocolVersion:z.literal(WORKER_PROTOCOL_VERSION),
  messageId:z.uuid(),commandId:z.uuid(),jobId:z.uuid(),executionId:z.uuid(),
  attemptId:z.uuid(),controlPlaneId:z.string().min(1).max(160),workerDeviceId:z.uuid(),
  action:z.enum(['PAUSE','RESUME','CANCEL']),
  source:z.enum(['CLI','LOCAL_UI','PLATFORM_SECURITY']),
  actorId:z.string().min(1).max(160),reason:z.string().max(200).nullable(),
  status:z.enum(['PAUSED','RUNNING','SECURITY_PAUSED','CANCELLED','TIMED_OUT']),
  localRevision:z.number().int().positive(),confirmedAt:z.iso.datetime(),
});

export function negotiateWorkerProtocol(supported: readonly string[]): typeof WORKER_PROTOCOL_VERSION {
  if (!supported.includes(WORKER_PROTOCOL_VERSION)) throw new Error('INCOMPATIBLE_WORKER_PROTOCOL');
  return WORKER_PROTOCOL_VERSION;
}

export type JobOffer = z.infer<typeof JobOfferSchema>;

export function parseJobOffer(input: unknown): JobOffer {
  return JobOfferSchema.parse(input);
}
