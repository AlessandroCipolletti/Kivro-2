import { z } from 'zod';

export const ProviderBudgetPolicySchema = z.strictObject({
  providerId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
  modelId: z.string().min(1).max(160),
  credentialRef: z.string().regex(/^seller:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
  maxRequestsPerJob: z.number().int().min(1).max(200),
  maxInputTokensPerRequest: z.number().int().min(1).max(200_000),
  maxOutputTokensPerRequest: z.number().int().min(1).max(200_000),
  maxEstimatedSpendMicroUsdPerJob: z.number().int().min(1).max(100_000_000),
  inputPriceMicroUsdPerMillionTokens: z.number().int().min(0).max(1_000_000_000),
  outputPriceMicroUsdPerMillionTokens: z.number().int().min(0).max(1_000_000_000),
});

export type ProviderBudgetPolicy = z.infer<typeof ProviderBudgetPolicySchema>;
