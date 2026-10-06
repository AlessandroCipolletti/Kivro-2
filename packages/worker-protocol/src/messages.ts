import { z } from 'zod';

export const WORKER_PROTOCOL_VERSION = 'kivro-worker/1' as const;

export const JobOfferSchema = z.strictObject({
  type: z.literal('JOB_OFFER'),
  protocolVersion: z.literal(WORKER_PROTOCOL_VERSION),
  messageId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  jobId: z.uuid(),
  executionId: z.uuid(),
  attemptId: z.uuid(),
  workerDeviceId: z.uuid(),
  capabilityVersionId: z.uuid(),
  inputManifestId: z.uuid(),
  expiresAt: z.iso.datetime(),
  leaseToken: z.string().min(32).max(512),
  paymentSecured: z.literal(true),
});

export type JobOffer = z.infer<typeof JobOfferSchema>;

export function parseJobOffer(input: unknown): JobOffer {
  return JobOfferSchema.parse(input);
}
