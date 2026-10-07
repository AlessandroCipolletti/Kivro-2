import { z } from 'zod';
import { openPrivateWorkerSqlite } from './local-state.js';

const uuid = z.uuid();

export interface PairedSeller {
  readonly deviceId: string;
  readonly sellerAccountId: string;
  readonly sellerProfileId: string;
}

/** Local owner hint from an authenticated pairing response. Cloud rechecks ownership
 * and revocation for every privileged request; this record grants no cloud access. */
export function rememberPairedSeller(directory: string, raw: unknown): PairedSeller {
  const paired = z.strictObject({
    deviceId: uuid, sellerAccountId: uuid, sellerProfileId: uuid,
  }).parse(raw);
  const db = openPrivateWorkerSqlite(directory, 'paired-seller.sqlite');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS paired_seller (
      device_id TEXT PRIMARY KEY,
      seller_account_id TEXT NOT NULL,
      seller_profile_id TEXT NOT NULL
    )`);
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db.prepare('SELECT seller_account_id,seller_profile_id FROM paired_seller WHERE device_id=?')
        .get(paired.deviceId) as { seller_account_id:string;seller_profile_id:string } | undefined;
      if (existing && (existing.seller_account_id !== paired.sellerAccountId ||
        existing.seller_profile_id !== paired.sellerProfileId)) {
        throw new Error('PAIRING_OWNER_CHANGED');
      }
      if (!existing) db.prepare(`INSERT INTO paired_seller
        (device_id,seller_account_id,seller_profile_id) VALUES(?,?,?)`).run(
        paired.deviceId, paired.sellerAccountId, paired.sellerProfileId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return paired;
  } finally { db.close(); }
}

export function pairedSellerForDevice(directory: string, deviceId: string): PairedSeller | null {
  uuid.parse(deviceId);
  const db = openPrivateWorkerSqlite(directory, 'paired-seller.sqlite');
  try {
    const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='paired_seller'`).get();
    if (!exists) return null;
    const row = db.prepare('SELECT * FROM paired_seller WHERE device_id=?').get(deviceId) as {
      device_id:string;seller_account_id:string;seller_profile_id:string;
    } | undefined;
    return row ? { deviceId:row.device_id, sellerAccountId:row.seller_account_id,
      sellerProfileId:row.seller_profile_id } : null;
  } finally { db.close(); }
}
