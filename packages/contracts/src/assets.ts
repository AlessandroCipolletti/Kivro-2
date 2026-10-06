import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const Sha256DigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const PrivateAssetObjectKeySchema = z.string().regex(/^private\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
const date = z.iso.datetime({ offset: true });

export const AssetRecordSchema = z.strictObject({
  id: z.uuid(),
  ownerAccountId: z.uuid(),
  sourceJobId: z.uuid().nullable(),
  kind: z.enum(['BUYER_INPUT', 'JOB_OUTPUT', 'EXAMPLE']),
  state: z.enum(['PENDING_UPLOAD', 'READY', 'QUARANTINED', 'EXPIRED', 'DELETED']),
  objectKey: PrivateAssetObjectKeySchema,
  sizeBytes: z.number().int().nonnegative().nullable(),
  sha256: Sha256DigestSchema.nullable(),
  detectedMimeType: z.string().min(3).max(120).nullable(),
  retainUntil: date,
}).superRefine((asset, context) => {
  if (!asset.objectKey.startsWith(`private/assets/${asset.id}/`)) {
    context.addIssue({ code: 'custom', message: 'Object key must belong to asset ID' });
  }
  if (asset.kind === 'JOB_OUTPUT' && asset.sourceJobId === null) {
    context.addIssue({ code: 'custom', message: 'Job output requires its source job' });
  }
  if (asset.state === 'READY' && (asset.sizeBytes === null || asset.sha256 === null ||
    asset.detectedMimeType === null)) {
    context.addIssue({ code: 'custom', message: 'Ready asset requires verified metadata' });
  }
});

export const AssetReadGrantSchema = z.strictObject({
  assetId: z.uuid(), targetJobId: z.uuid(),
  expiresAt: date, revokedAt: date.nullable(),
});

export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type AssetReadGrant = z.infer<typeof AssetReadGrantSchema>;

/** Opaque key never contains seller/buyer names, filenames, or contract fields. */
export function newPrivateAssetKey(assetId: string): string {
  const id = z.uuid().parse(assetId);
  return `private/assets/${id}/${randomUUID()}`;
}
