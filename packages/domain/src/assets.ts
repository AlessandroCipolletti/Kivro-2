import { AssetReadGrantSchema, AssetRecordSchema } from '../../contracts/src/assets.js';

const activeWorkerStatuses = new Set(['ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT']);

export interface AssetReadActor {
  readonly type: 'BUYER' | 'WORKER';
  readonly accountId?: string;
  readonly workerDeviceId?: string;
}

export interface AssetTargetJob {
  readonly id: string;
  readonly buyerAccountId: string;
  readonly workerDeviceId: string;
  readonly status: string;
  readonly paymentSecured: boolean;
  readonly workerActive: boolean;
}

/** Inputs here must come from authoritative DB rows and authenticated actor identity. */
export function mayReadPrivateAsset(rawAsset: unknown, actor: AssetReadActor, now: Date,
  rawGrant?: unknown, targetJob?: AssetTargetJob): boolean {
  const asset = AssetRecordSchema.parse(rawAsset);
  if (Number.isNaN(now.getTime())) return false;
  if (asset.state !== 'READY' || Date.parse(asset.retainUntil) <= now.getTime()) return false;
  if (actor.type === 'BUYER') return actor.accountId === asset.ownerAccountId;
  if (!actor.workerDeviceId || !rawGrant || !targetJob) return false;
  const grant = AssetReadGrantSchema.parse(rawGrant);
  return grant.assetId === asset.id && grant.targetJobId === targetJob.id &&
    grant.revokedAt === null && Date.parse(grant.expiresAt) > now.getTime() &&
    targetJob.buyerAccountId === asset.ownerAccountId &&
    targetJob.workerDeviceId === actor.workerDeviceId &&
    targetJob.paymentSecured && targetJob.workerActive && activeWorkerStatuses.has(targetJob.status);
}
