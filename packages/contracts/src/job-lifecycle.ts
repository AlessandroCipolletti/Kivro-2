import { z } from 'zod';

/** Job state is separate from payment/ledger state (Master Spec §24.9). */
export const JobStatusSchema = z.enum([
  'CREATED', 'PAYMENT_RESERVED', 'WAITING_FOR_AVAILABILITY', 'QUEUED', 'WAITING_FOR_WORKER', 'DISPATCHED',
  'ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT', 'CANCEL_REQUESTED',
  'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED', 'SECURITY_PAUSED',
  'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED_STARTUP',
  'FAILED_POLICY', 'FAILED_EXECUTION', 'TIMED_OUT', 'WORKER_OFFLINE', 'RESULT_REJECTED',
]);

export const JobTransitionSchema = z.strictObject({
  id: z.uuid(),
  jobId: z.uuid(),
  from: JobStatusSchema,
  to: JobStatusSchema,
  at: z.iso.datetime(),
  actor: z.enum(['BUYER', 'SELLER', 'CLOUD', 'WORKER', 'PAYMENT', 'SYSTEM']),
  reason: z.string().trim().min(1).max(200),
  attemptId: z.uuid().nullable(),
  correlationId: z.uuid(),
  paymentReservationId: z.uuid().nullable(),
  resultManifestId: z.uuid().nullable(),
});

export const JobLifecycleSchema = z.strictObject({
  jobId: z.uuid(),
  status: JobStatusSchema,
  transitions: z.array(JobTransitionSchema),
});

export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobTransition = z.infer<typeof JobTransitionSchema>;
export type JobLifecycle = z.infer<typeof JobLifecycleSchema>;
