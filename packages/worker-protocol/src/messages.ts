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
});

export const WorkerHeartbeatSchema = z.strictObject({
  type: z.literal('WORKER_HEARTBEAT'),
  protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  workerDeviceId: z.uuid(),
  workerRelease: z.string().min(1).max(80),
  openClawVersion: z.string().min(1).max(80).nullable(),
  status: z.enum(['ONLINE', 'PAUSED', 'NOT_READY']),
  runningJobs: z.number().int().nonnegative().max(64),
  capacity: z.number().int().nonnegative().max(64),
  policyVersion: z.number().int().positive(),
  localRevision: z.number().int().nonnegative(),
});

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

export function negotiateWorkerProtocol(supported: readonly string[]): typeof WORKER_PROTOCOL_VERSION {
  if (!supported.includes(WORKER_PROTOCOL_VERSION)) throw new Error('INCOMPATIBLE_WORKER_PROTOCOL');
  return WORKER_PROTOCOL_VERSION;
}

export type JobOffer = z.infer<typeof JobOfferSchema>;

export function parseJobOffer(input: unknown): JobOffer {
  return JobOfferSchema.parse(input);
}
