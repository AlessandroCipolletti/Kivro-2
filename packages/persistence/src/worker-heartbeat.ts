import type { Pool } from 'pg';
import { WorkerHeartbeatSchema } from '../../worker-protocol/src/messages.js';

export class PostgresWorkerHeartbeatRepository {
  constructor(private readonly pool: Pool) {}

  /** Caller must provide the identity verified by PostgresWorkerMessageAuthenticator. */
  async observe(raw: unknown, authenticatedWorkerDeviceId: string, authenticatedControlPlaneId: string): Promise<void> {
    const beat = WorkerHeartbeatSchema.parse(raw);
    if (beat.workerDeviceId !== authenticatedWorkerDeviceId ||
      beat.controlPlaneId !== authenticatedControlPlaneId) throw new Error('WORKER_SCOPE_MISMATCH');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query<{ status: string }>(
        'SELECT status FROM worker_devices WHERE id=$1 FOR UPDATE', [beat.workerDeviceId]);
      if (!row.rows[0] || row.rows[0].status === 'REVOKED') throw new Error('WORKER_REVOKED');
      await client.query(`INSERT INTO worker_heartbeats(worker_device_id,control_plane_id,worker_release,
        openclaw_version,reported_status,running_jobs,capacity,policy_version,local_revision,observed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        ON CONFLICT(worker_device_id,control_plane_id) DO UPDATE SET
        worker_release=EXCLUDED.worker_release,openclaw_version=EXCLUDED.openclaw_version,
        reported_status=EXCLUDED.reported_status,running_jobs=EXCLUDED.running_jobs,
        capacity=EXCLUDED.capacity,policy_version=EXCLUDED.policy_version,
        local_revision=GREATEST(worker_heartbeats.local_revision,EXCLUDED.local_revision),
        observed_at=now()`,
      [beat.workerDeviceId, beat.controlPlaneId, beat.workerRelease, beat.openClawVersion,
        beat.status, beat.runningJobs, beat.capacity, beat.policyVersion, beat.localRevision]);
      const status = beat.status === 'ONLINE' ? 'ONLINE' : beat.status === 'PAUSED' ? 'PAUSED' : 'OFFLINE';
      await client.query('UPDATE worker_devices SET worker_version=$2,openclaw_version=$3,status=$4,last_seen_at=now() WHERE id=$1',
        [beat.workerDeviceId, beat.workerRelease, beat.openClawVersion, status]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async effectiveStatus(workerDeviceId: string, maxAgeSeconds: number): Promise<'ONLINE' | 'PAUSED' | 'OFFLINE'> {
    if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 5 || maxAgeSeconds > 3600) {
      throw new RangeError('Invalid heartbeat age');
    }
    const result = await this.pool.query<{ status: string; fresh_status: string | null }>(`
      SELECT d.status,
        (SELECT h.reported_status FROM worker_heartbeats h
         WHERE h.worker_device_id=d.id AND h.observed_at >= now() - ($2::integer * interval '1 second')
         ORDER BY h.observed_at DESC LIMIT 1) AS fresh_status
      FROM worker_devices d WHERE d.id=$1`, [workerDeviceId, maxAgeSeconds]);
    const row = result.rows[0];
    if (!row || row.status === 'REVOKED' || !row.fresh_status) return 'OFFLINE';
    return row.fresh_status === 'ONLINE' ? 'ONLINE' : row.fresh_status === 'PAUSED' ? 'PAUSED' : 'OFFLINE';
  }
}
