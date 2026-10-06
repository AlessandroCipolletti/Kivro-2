import { z } from 'zod';

export const DigestPinnedImageSchema = z.string().regex(/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/);

/** This first executable profile is deliberately offline and has no seller resource broker. */
export const OfflineSandboxPlanSchema = z.strictObject({
  planVersion: z.literal(1),
  image: DigestPinnedImageSchema,
  networkMode: z.literal('none'),
  readOnlyRoot: z.literal(true),
  capDrop: z.tuple([z.literal('ALL')]),
  noNewPrivileges: z.literal(true),
  seccomp: z.literal('builtin'),
  runAs: z.literal('65532:65532'),
  maxRuntimeSeconds: z.number().int().min(1).max(3600),
  memoryMb: z.number().int().min(64).max(4096),
  cpu: z.number().min(0.1).max(4),
  maxPids: z.number().int().min(16).max(256),
  maxOutputBytes: z.number().int().min(0).max(1_073_741_824),
});

export type OfflineSandboxPlan = z.infer<typeof OfflineSandboxPlanSchema>;
