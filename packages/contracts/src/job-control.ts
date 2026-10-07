import { z } from 'zod';

/** Immutable, seller-reviewed runtime capability; never inferred from a UI button. */
export const PauseSupportSchema = z.enum(['FULL_RESUME', 'RESTART_STEP', 'NOT_SUPPORTED']);
export type PauseSupport = z.infer<typeof PauseSupportSchema>;

export const JobControlCommandSchema = z.strictObject({
  commandId: z.uuid(), jobId: z.uuid(), executionId: z.uuid(), attemptId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  action: z.enum(['PAUSE', 'RESUME', 'CANCEL']),
  source: z.enum(['WEB', 'LOCAL_UI', 'CLI', 'PLATFORM_SECURITY']),
  actorId: z.string().min(1).max(160),
  reason: z.string().max(200).nullable(),
  requestedAt: z.iso.datetime(),
  overrideGlobalPause: z.boolean().optional(),
});

export const JobControlAckSchema = z.strictObject({
  commandId: z.uuid(), jobId: z.uuid(), executionId: z.uuid(), attemptId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  status: z.enum(['PAUSED', 'RUNNING', 'SECURITY_PAUSED', 'CANCELLED',
    'PAUSE_NOT_SUPPORTED', 'RESUME_NOT_READY', 'DEPENDENCY_UNAVAILABLE',
    'INFERENCE_UNAVAILABLE', 'SECURITY_BLOCK', 'CONTROL_FAILED']),
  localRevision: z.number().int().nonnegative(),
  confirmedAt: z.iso.datetime().nullable(),
});
