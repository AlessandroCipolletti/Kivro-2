import { z } from 'zod';

/** Buyer and seller capabilities belong to one marketplace identity. */
export const AccountSchema = z.strictObject({
  id: z.uuid(),
  primaryEmail: z.email().max(320),
  emailVerifiedAt: z.iso.datetime().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']),
  termsAcceptedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const AccountIdentitySchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  provider: z.enum(['PASSWORD', 'GOOGLE']),
  providerSubject: z.string().min(1).max(255),
  email: z.email().max(320),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const SellerProfileSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  displayName: z.string().trim().min(1).max(120),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED']),
  payoutStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'RESTRICTED', 'ACTION_REQUIRED', 'READY', 'DISABLED']),
  createdAt: z.iso.datetime(),
});

export const WorkerDeviceSchema = z.strictObject({
  id: z.uuid(),
  sellerProfileId: z.uuid(),
  publicKey: z.string().min(32).max(2048),
  name: z.string().trim().min(1).max(120),
  platform: z.enum(['MACOS', 'LINUX', 'WINDOWS']),
  workerVersion: z.string().min(1).max(80),
  openClawVersion: z.string().min(1).max(80).nullable(),
  status: z.enum(['PAIRED', 'ONLINE', 'PAUSED', 'OFFLINE', 'REVOKED']),
  lastSeenAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountIdentity = z.infer<typeof AccountIdentitySchema>;
export type SellerProfile = z.infer<typeof SellerProfileSchema>;
export type WorkerDevice = z.infer<typeof WorkerDeviceSchema>;
