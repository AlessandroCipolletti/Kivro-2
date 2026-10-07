import type { Pool } from 'pg';
import { verifyWorkerEnvelopeSignature } from '../../worker-protocol/src/auth.js';

export class WorkerAuthenticationError extends Error {
  constructor(readonly code: 'UNKNOWN_DEVICE' | 'REVOKED_DEVICE' | 'REPLAY_CONFLICT' |
    'INVALID_SIGNATURE') {
    super(code); this.name = 'WorkerAuthenticationError';
  }
}

/** Provider-neutral PostgreSQL replay barrier for authenticated Worker messages. */
export class PostgresWorkerMessageAuthenticator {
  constructor(private readonly pool: Pool) {}

  async verify(rawEnvelope: unknown, body: unknown): Promise<{ readonly workerDeviceId: string;
    readonly controlPlaneId: string; readonly duplicate: boolean }> {
    const envelope = rawEnvelope as { workerDeviceId?: unknown };
    if (typeof envelope?.workerDeviceId !== 'string') throw new WorkerAuthenticationError('UNKNOWN_DEVICE');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const device = await client.query<{ public_key: string; status: string; revoked_at: Date | null }>(
        'SELECT public_key,status,revoked_at FROM worker_devices WHERE id=$1 FOR SHARE', [envelope.workerDeviceId]);
      const row = device.rows[0];
      if (!row) throw new WorkerAuthenticationError('UNKNOWN_DEVICE');
      if (row.status === 'REVOKED' || row.revoked_at) throw new WorkerAuthenticationError('REVOKED_DEVICE');
      let checked;
      try{checked=verifyWorkerEnvelopeSignature(row.public_key,rawEnvelope,body);}
      catch{throw new WorkerAuthenticationError('INVALID_SIGNATURE');}
      if (!body || typeof body !== 'object' ||
        !('controlPlaneId' in body) || body.controlPlaneId !== checked.controlPlaneId ||
        !('workerDeviceId' in body) || body.workerDeviceId !== checked.workerDeviceId) {
        throw new Error('WORKER_SCOPE_MISMATCH');
      }
      const inserted = await client.query(`INSERT INTO worker_message_receipts(worker_device_id,message_id,body_hash)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [checked.workerDeviceId, checked.messageId, checked.bodyHash]);
      const receipt = await client.query<{ body_hash: string }>(
        'SELECT body_hash FROM worker_message_receipts WHERE worker_device_id=$1 AND message_id=$2',
        [checked.workerDeviceId, checked.messageId]);
      const previous = receipt.rows[0];
      if (previous && previous.body_hash !== checked.bodyHash) throw new WorkerAuthenticationError('REPLAY_CONFLICT');
      const duplicate = inserted.rowCount === 0;
      await client.query('COMMIT');
      return { workerDeviceId: checked.workerDeviceId, controlPlaneId: checked.controlPlaneId,
        duplicate };
    } catch (error) {
      await client.query('ROLLBACK'); throw error;
    } finally { client.release(); }
  }
}
