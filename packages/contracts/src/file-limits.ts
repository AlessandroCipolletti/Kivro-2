import { z } from 'zod';

/** One versioned platform safety ceiling; deployments may choose stricter values. */
export const PLATFORM_FILE_LIMITS = Object.freeze({
  policyVersion: 1,
  maxSingleFileBytes: 1_073_741_824,
  maxTotalFieldBytes: 5_368_709_120,
  maxFilesPerField: 50,
});

export const PlatformFileLimitsSchema = z.strictObject({
  policyVersion: z.literal(1),
  maxSingleFileBytes: z.number().int().positive().max(PLATFORM_FILE_LIMITS.maxSingleFileBytes),
  maxTotalFieldBytes: z.number().int().positive().max(PLATFORM_FILE_LIMITS.maxTotalFieldBytes),
  maxFilesPerField: z.number().int().positive().max(PLATFORM_FILE_LIMITS.maxFilesPerField),
});

export function effectiveFileCeilings(seller: { maxFileSizeBytes: number; maxTotalSizeBytes: number;
  maxFiles: number }, rawPlatform: unknown): { maxFileSizeBytes: number; maxTotalSizeBytes: number; maxFiles: number } {
  const platform = PlatformFileLimitsSchema.parse(rawPlatform);
  if (![seller.maxFileSizeBytes, seller.maxTotalSizeBytes, seller.maxFiles].every(
    (value) => Number.isSafeInteger(value) && value > 0)) throw new TypeError('Invalid seller file limits');
  return Object.freeze({
    maxFileSizeBytes: Math.min(seller.maxFileSizeBytes, platform.maxSingleFileBytes),
    maxTotalSizeBytes: Math.min(seller.maxTotalSizeBytes, platform.maxTotalFieldBytes),
    maxFiles: Math.min(seller.maxFiles, platform.maxFilesPerField),
  });
}
