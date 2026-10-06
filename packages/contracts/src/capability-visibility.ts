import { z } from 'zod';

export const CapabilityVisibilitySchema = z.enum(['DRAFT', 'PRIVATE', 'UNLISTED', 'PUBLIC']);
export const VersionLifecycleStateSchema = z.enum([
  'DRAFT', 'TESTING', 'READY_TO_PUBLISH', 'PUBLISHED', 'RETIRED',
]);

export const CapabilityAccessContextSchema = z.strictObject({
  visibility: CapabilityVisibilitySchema,
  sellerAccountId: z.uuid(),
  viewerAccountId: z.uuid().nullable(),
  /** A direct link is a discovery route, never an authorization credential. */
  arrivedByDirectLink: z.boolean(),
  explicitPrivateGrant: z.boolean(),
});

export type CapabilityVisibility = z.infer<typeof CapabilityVisibilitySchema>;
export type VersionLifecycleState = z.infer<typeof VersionLifecycleStateSchema>;
export type CapabilityAccessContext = z.infer<typeof CapabilityAccessContextSchema>;
