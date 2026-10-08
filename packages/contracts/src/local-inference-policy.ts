import { z } from 'zod';

const reference=z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Local model execution has token/call ceilings but no external API charge or
 * seller credential. Its endpoint stays in the private Worker review record. */
export const LocalInferencePolicySchema=z.strictObject({
  providerId:reference,
  modelId:z.string().min(1).max(160),
  endpointRef:reference,
  maxRequestsPerJob:z.number().int().min(1).max(200),
  maxInputTokensPerRequest:z.number().int().min(1).max(200_000),
  maxOutputTokensPerRequest:z.number().int().min(1).max(200_000),
  maxTokensPerJob:z.number().int().min(1).max(10_000_000),
  maxDailyJobs:z.number().int().min(1).max(10_000),
});

export type LocalInferencePolicy=z.infer<typeof LocalInferencePolicySchema>;
