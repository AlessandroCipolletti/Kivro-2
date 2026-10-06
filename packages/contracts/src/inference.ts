import { z } from 'zod';

const providerId = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const modelId = z.string().min(1).max(160);

/** Marketplace operator pays; these credentials must never enter Worker jobs. */
export const PlatformInferenceConfigSchema = z.strictObject({
  owner: z.literal('PLATFORM'),
  providerId,
  modelId,
  credentialRef: z.string().regex(/^platform:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
});

/** Seller pays; only opaque references are published, never credential values. */
export const SellerInferenceConfigSchema = z.strictObject({
  owner: z.literal('SELLER'),
  providerId,
  modelId,
  credentialRef: z.string().regex(/^seller:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/).nullable(),
  estimatedCostMinor: z.number().int().nonnegative().nullable(),
  currency: z.literal('USD'),
});

export type PlatformInferenceConfig = z.infer<typeof PlatformInferenceConfigSchema>;
export type SellerInferenceConfig = z.infer<typeof SellerInferenceConfigSchema>;
