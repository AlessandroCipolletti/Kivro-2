import type { Pool } from 'pg';
import { WorkerHeartbeatSchema } from '../../worker-protocol/src/messages.js';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';

export class PostgresWorkerHeartbeatRepository {
  constructor(private readonly pool: Pool) {}

  /** Caller must provide the identity verified by PostgresWorkerMessageAuthenticator. */
  async observe(raw: unknown, authenticatedWorkerDeviceId: string, authenticatedControlPlaneId: string): Promise<void> {
    const beat = WorkerHeartbeatSchema.parse(raw);
    if (!beat.sentAt && (beat.capabilityReadiness?.length ?? 0)>0) {
      throw new Error('HEARTBEAT_TIMESTAMP_REQUIRED');
    }
    if (beat.workerDeviceId !== authenticatedWorkerDeviceId ||
      beat.controlPlaneId !== authenticatedControlPlaneId) throw new Error('WORKER_SCOPE_MISMATCH');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query<{ status: string; latest_heartbeat_reported_at: Date | null;
        latest_heartbeat_message_id: string | null; latest_heartbeat_hash: string | null }>(
        'SELECT * FROM worker_devices WHERE id=$1 FOR UPDATE', [beat.workerDeviceId]);
      if (!row.rows[0] || row.rows[0].status === 'REVOKED') throw new Error('WORKER_REVOKED');
      const latest=row.rows[0].latest_heartbeat_reported_at?.getTime()??null;
      const sent=beat.sentAt?Date.parse(beat.sentAt):null;
      const bodyHash=hashCanonicalJson(beat);
      if (sent!==null && Math.abs(Date.now()-sent)>60_000) throw new Error('HEARTBEAT_CLOCK_SKEW');
      if (latest!==null && (sent===null || sent<latest)) {
        await client.query('COMMIT'); return;
      }
      if (latest!==null && sent===latest) {
        if (row.rows[0].latest_heartbeat_message_id!==beat.messageId ||
          row.rows[0].latest_heartbeat_hash!==bodyHash) throw new Error('HEARTBEAT_REPLAY_CONFLICT');
        await client.query('COMMIT'); return;
      }
      await client.query(`INSERT INTO worker_heartbeats(worker_device_id,control_plane_id,worker_release,
        openclaw_version,reported_status,running_jobs,capacity,policy_version,local_revision,
        reported_at,observed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
        ON CONFLICT(worker_device_id,control_plane_id) DO UPDATE SET
        worker_release=EXCLUDED.worker_release,openclaw_version=EXCLUDED.openclaw_version,
        reported_status=EXCLUDED.reported_status,running_jobs=EXCLUDED.running_jobs,
        capacity=EXCLUDED.capacity,policy_version=EXCLUDED.policy_version,
        local_revision=GREATEST(worker_heartbeats.local_revision,EXCLUDED.local_revision),
        reported_at=EXCLUDED.reported_at,observed_at=now()`,
      [beat.workerDeviceId, beat.controlPlaneId, beat.workerRelease, beat.openClawVersion,
        beat.status, beat.runningJobs, beat.capacity, beat.policyVersion, beat.localRevision,
        beat.sentAt??null]);
      const status = beat.status === 'ONLINE' ? 'ONLINE' : beat.status === 'PAUSED' ? 'PAUSED' : 'OFFLINE';
      await client.query(`UPDATE worker_devices SET worker_version=$2,openclaw_version=$3,
        status=$4,last_seen_at=now(),latest_heartbeat_reported_at=$5,
        latest_heartbeat_message_id=$6,latest_heartbeat_hash=$7 WHERE id=$1`,
      [beat.workerDeviceId, beat.workerRelease, beat.openClawVersion, status,
        beat.sentAt??null,beat.sentAt?beat.messageId:null,beat.sentAt?bodyHash:null]);
      if (beat.sentAt) await client.query(`UPDATE capability_readiness
        SET state='NOT_READY',observed_at=now() WHERE worker_device_id=$1`,[beat.workerDeviceId]);
      const seen = new Set<string>();
      for (const report of beat.capabilityReadiness ?? []) {
        if (seen.has(report.capabilityVersionId)) throw new Error('DUPLICATE_READINESS');
        seen.add(report.capabilityVersionId);
        const selected = await client.query<{ capability_id: string; version_snapshot: unknown }>(
          `SELECT v.capability_id,v.version_snapshot FROM capability_versions v
           JOIN capabilities c ON c.id=v.capability_id
           WHERE v.id=$1 AND v.publication_state='PUBLISHED'`,
        [report.capabilityVersionId]);
        const row = selected.rows[0];
        if (!row) throw new Error('READINESS_VERSION_NOT_PUBLISHED');
        const version = PublishedCapabilityVersionSchema.parse(row.version_snapshot);
        if (version.workerDeviceId !== beat.workerDeviceId ||
          (report.policyValidationHash !== null &&
            version.policyValidationHash !== report.policyValidationHash) ||
          (report.state === 'READY' && report.policyValidationHash === null)) {
          throw new Error('READINESS_VERSION_MISMATCH');
        }
        await client.query(`INSERT INTO capability_readiness(capability_id,capability_version_id,
          worker_device_id,state,observed_at) VALUES($1,$2,$3,$4,now())
          ON CONFLICT(capability_version_id) DO UPDATE SET
          worker_device_id=$3,state=$4,observed_at=now()`,
        [row.capability_id,report.capabilityVersionId,beat.workerDeviceId,report.state]);
      }
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
