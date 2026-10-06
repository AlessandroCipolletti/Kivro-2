import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';

const uuid = z.uuid();
const pairingCode = z.string().regex(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
const redemptionSchema = z.strictObject({
  code: pairingCode,
  deviceId: uuid,
  publicKeyPem: z.string().startsWith('-----BEGIN PUBLIC KEY-----').max(512),
  possessionSignature: z.base64url().min(32).max(256),
  name: z.string().trim().min(1).max(120),
  platform: z.enum(['MACOS', 'LINUX', 'WINDOWS']),
  workerRelease: z.string().min(1).max(80),
});

function hashCode(code: string): string {
  return `sha256:${createHash('sha256').update(code).digest('hex')}`;
}

export function workerPairingProofBytes(code: string, deviceId: string, publicKeyPem: string): Buffer {
  return Buffer.from(`kivro-worker-pair-v1\0${hashCode(pairingCode.parse(code))}\0${uuid.parse(deviceId)}\0${publicKeyPem}`);
}

export class WorkerPairingError extends Error {
  constructor(readonly code: 'NOT_ELIGIBLE' | 'INVALID_CODE' | 'INVALID_PROOF' | 'ALREADY_PAIRED') {
    super(code); this.name = 'WorkerPairingError';
  }
}

/** Authenticated seller issues a short-lived bearer code; only its digest is persisted. */
export class PostgresWorkerPairingRepository {
  constructor(private readonly pool: Pool) {}

  async issue(sellerAccountId: string, sellerProfileId: string, ttlSeconds = 600): Promise<{
    readonly code: string; readonly expiresAt: string;
  }> {
    uuid.parse(sellerAccountId); uuid.parse(sellerProfileId);
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) {
      throw new RangeError('Invalid pairing lifetime');
    }
    const owner = await this.pool.query<{ id: string }>(`SELECT s.id FROM seller_profiles s
      JOIN accounts a ON a.id=s.account_id WHERE s.id=$1 AND s.account_id=$2
      AND s.status <> 'SUSPENDED' AND a.status='ACTIVE' AND a.email_verified_at IS NOT NULL`,
    [sellerProfileId, sellerAccountId]);
    if (!owner.rows[0]) throw new WorkerPairingError('NOT_ELIGIBLE');
    const compact = randomBytes(16).toString('hex').toUpperCase();
    const code = compact.match(/.{8}/g)!.join('-');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await this.pool.query(`INSERT INTO worker_pairing_codes(id,seller_profile_id,code_hash,expires_at)
      VALUES($1,$2,$3,$4)`, [randomUUID(), sellerProfileId, hashCode(code), expiresAt]);
    return { code, expiresAt };
  }

  async redeem(raw: unknown): Promise<{ readonly deviceId: string; readonly sellerProfileId: string }> {
    const input = redemptionSchema.parse(raw);
    let publicKey;
    try {
      publicKey = createPublicKey(input.publicKeyPem);
      if (publicKey.asymmetricKeyType !== 'ed25519' || !verify(null,
        workerPairingProofBytes(input.code, input.deviceId, input.publicKeyPem), publicKey,
        Buffer.from(input.possessionSignature, 'base64url'))) {
        throw new WorkerPairingError('INVALID_PROOF');
      }
    } catch { throw new WorkerPairingError('INVALID_PROOF'); }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const code = await client.query<{ seller_profile_id: string; expires_at: Date;
        consumed_at: Date | null }>(`SELECT seller_profile_id,expires_at,consumed_at
        FROM worker_pairing_codes WHERE code_hash=$1 FOR UPDATE`, [hashCode(input.code)]);
      const row = code.rows[0];
      if (!row || row.consumed_at || row.expires_at.getTime() <= Date.now()) {
        throw new WorkerPairingError('INVALID_CODE');
      }
      const owner = await client.query<{ id: string }>(`SELECT s.id FROM seller_profiles s
        JOIN accounts a ON a.id=s.account_id WHERE s.id=$1 AND s.status <> 'SUSPENDED'
        AND a.status='ACTIVE' AND a.email_verified_at IS NOT NULL FOR SHARE OF s,a`,
      [row.seller_profile_id]);
      if (!owner.rows[0]) throw new WorkerPairingError('NOT_ELIGIBLE');
      const existing = await client.query('SELECT id FROM worker_devices WHERE id=$1 OR public_key=$2',
        [input.deviceId, input.publicKeyPem]);
      if (existing.rowCount) throw new WorkerPairingError('ALREADY_PAIRED');
      await client.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
        worker_version,status) VALUES($1,$2,$3,$4,$5,$6,'PAIRED')`,
      [input.deviceId, row.seller_profile_id, input.publicKeyPem, input.name,
        input.platform, input.workerRelease]);
      await client.query(`UPDATE worker_pairing_codes SET consumed_at=now(),paired_device_id=$2
        WHERE code_hash=$1`, [hashCode(input.code), input.deviceId]);
      await client.query('COMMIT');
      return { deviceId: input.deviceId, sellerProfileId: row.seller_profile_id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async revoke(sellerAccountId: string, deviceId: string): Promise<void> {
    uuid.parse(sellerAccountId); uuid.parse(deviceId);
    const result = await this.pool.query(`UPDATE worker_devices d SET status='REVOKED',
      revoked_at=COALESCE(d.revoked_at,now())
      FROM seller_profiles s WHERE d.id=$1 AND d.seller_profile_id=s.id AND s.account_id=$2
      `, [deviceId, sellerAccountId]);
    if (result.rowCount !== 1) throw new WorkerPairingError('NOT_ELIGIBLE');
  }
}
