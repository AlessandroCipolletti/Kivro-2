import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { WorkerHeartbeatSchema } from '../../worker-protocol/src/messages.js';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import { recordLocalPauseReport } from './seller-operations.js';
import { workerVersionStatus } from '../../domain/src/worker-version.js';

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
      const row = await client.query<{ status: string; last_seen_at:Date|null;
        latest_heartbeat_reported_at: Date | null;
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
      if(row.rows[0].last_seen_at&&
        Date.now()-row.rows[0].last_seen_at.getTime()>30_000){
        await client.query(`INSERT INTO worker_operational_events(id,worker_device_id,
          actor_kind,actor_id,kind,code) VALUES($1,$2,'WORKER',$3,
          'WORKER_RECONNECTED','SIGNED_HEARTBEAT_RESTORED')`,
        [randomUUID(),beat.workerDeviceId,beat.workerDeviceId]);
      }
      const priorHealth=await client.query<{operational_checks:{code:string;state:string}[]|null}>(
        `SELECT operational_checks FROM worker_heartbeats WHERE worker_device_id=$1
        ORDER BY observed_at DESC LIMIT 1`,[beat.workerDeviceId]);
      const previousChecks=new Map((priorHealth.rows[0]?.operational_checks??[]).map((check)=>
        [check.code,check.state]));
      for(const check of beat.operationalChecks??[]){
        if(previousChecks.get(check.code)===check.state)continue;
        await client.query(`INSERT INTO worker_operational_events(id,worker_device_id,
          actor_kind,actor_id,kind,code) VALUES($1,$2,'WORKER',$3,
          'HEALTH_CHANGED',$4)`,[randomUUID(),beat.workerDeviceId,beat.workerDeviceId,
          `${check.code}_${check.state}`]);
      }
      if (beat.localPause) {
        if ((beat.localPause.globalPaused||beat.localPause.securityPaused)&&beat.status==='ONLINE')
          throw new Error('HEARTBEAT_PAUSE_CONFLICT');
        await recordLocalPauseReport(client,beat.workerDeviceId,beat.localRevision,beat.localPause);
      }
      const minVersion=process.env.KIVRO_MIN_WORKER_RELEASE??null;
      const version=workerVersionStatus(beat.workerRelease,minVersion,
        process.env.KIVRO_LATEST_WORKER_RELEASE??null);
      let securityCode:string|null=version==='SECURITY_UPDATE_REQUIRED'||
        process.env.NODE_ENV==='production'&&version==='UNKNOWN'?
        'WORKER_SECURITY_UPDATE_REQUIRED':null;
      if(beat.capabilityReadiness?.some((report)=>report.checks?.sandboxVerified===false))
        securityCode='SANDBOX_ISOLATION_FAILED';
      if(beat.operationalChecks?.some((check)=>check.code==='APPROVED_SANDBOX_IMAGE'&&
        check.state==='BLOCKING'))securityCode='SANDBOX_IMAGE_NOT_APPROVED';
      if(securityCode){
        const existing=await client.query<{blocked:boolean;code:string}>(
          'SELECT blocked,code FROM worker_security_blocks WHERE worker_device_id=$1 FOR UPDATE',
          [beat.workerDeviceId]);
        if(!existing.rows[0]?.blocked){
          await client.query(`INSERT INTO worker_security_blocks(worker_device_id,blocked,code)
            VALUES($1,true,$2) ON CONFLICT(worker_device_id) DO UPDATE SET
            blocked=true,code=$2,detected_at=now(),resolved_at=NULL`,
          [beat.workerDeviceId,securityCode]);
          await client.query(`INSERT INTO worker_cloud_control_revisions(worker_device_id,revision)
            VALUES($1,1) ON CONFLICT(worker_device_id) DO UPDATE SET revision=
            worker_cloud_control_revisions.revision+1`,[beat.workerDeviceId]);
          await client.query(`INSERT INTO worker_operational_events(id,worker_device_id,
            actor_kind,actor_id,kind,code) VALUES($1,$2,'PLATFORM','health-policy',
            'SECURITY_BLOCK',$3)`,[randomUUID(),beat.workerDeviceId,securityCode]);
        }
      }
      if(beat.acknowledgedCloudRevision!==undefined){
        const control=await client.query<{revision:string;acknowledged_revision:string}>(
          'SELECT revision,acknowledged_revision FROM worker_cloud_control_revisions WHERE worker_device_id=$1 FOR UPDATE',
          [beat.workerDeviceId]);
        const row=control.rows[0];
        if(row&&beat.acknowledgedCloudRevision>Number(row.revision))
          throw new Error('CLOUD_CONTROL_REVISION_AHEAD');
        if(row&&beat.acknowledgedCloudRevision>Number(row.acknowledged_revision))
          await client.query(`UPDATE worker_cloud_control_revisions SET acknowledged_revision=$2
            WHERE worker_device_id=$1`,[beat.workerDeviceId,beat.acknowledgedCloudRevision]);
      }
      await client.query(`INSERT INTO worker_heartbeats(worker_device_id,control_plane_id,worker_release,
        openclaw_version,reported_status,running_jobs,capacity,policy_version,local_revision,
        reported_at,observed_at,operational_checks,openclaw_compatibility)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12)
        ON CONFLICT(worker_device_id,control_plane_id) DO UPDATE SET
        worker_release=EXCLUDED.worker_release,openclaw_version=EXCLUDED.openclaw_version,
        reported_status=EXCLUDED.reported_status,running_jobs=EXCLUDED.running_jobs,
        capacity=EXCLUDED.capacity,policy_version=EXCLUDED.policy_version,
        local_revision=GREATEST(worker_heartbeats.local_revision,EXCLUDED.local_revision),
        reported_at=EXCLUDED.reported_at,observed_at=now(),
        operational_checks=EXCLUDED.operational_checks,
        openclaw_compatibility=EXCLUDED.openclaw_compatibility`,
      [beat.workerDeviceId, beat.controlPlaneId, beat.workerRelease, beat.openClawVersion,
        beat.status, beat.runningJobs, beat.capacity, beat.policyVersion, beat.localRevision,
        beat.sentAt??null,beat.operationalChecks?JSON.stringify(beat.operationalChecks):null,
        beat.openClawCompatibility??null]);
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
        // Local review installs immutable bytes before the seller can publish.
        // An unpublished version has no public readiness to record; it must not
        // block health reports for already published capabilities.
        if (!row) continue;
        const version = PublishedCapabilityVersionSchema.parse(row.version_snapshot);
        if (version.workerDeviceId !== beat.workerDeviceId ||
          (report.policyValidationHash !== null &&
            version.policyValidationHash !== report.policyValidationHash) ||
          (report.state === 'READY' && report.policyValidationHash === null)) {
          throw new Error('READINESS_VERSION_MISMATCH');
        }
        if(report.state==='READY'&&(!report.checks||!report.checks.sandboxVerified||
          !report.checks.requiredSecretsReady||!report.checks.runtimeHealthy))
          throw new Error('READINESS_CHECK_CONFLICT');
        const previous=await client.query<{state:string;sandbox_verified:boolean|null;
          required_secrets_ready:boolean|null;runtime_healthy:boolean|null}>(
          'SELECT state,sandbox_verified,required_secrets_ready,runtime_healthy FROM capability_readiness WHERE capability_version_id=$1',
          [report.capabilityVersionId]);
        await client.query(`INSERT INTO capability_readiness(capability_id,capability_version_id,
          worker_device_id,state,observed_at,sandbox_verified,required_secrets_ready,
          runtime_healthy) VALUES($1,$2,$3,$4,now(),$5,$6,$7)
          ON CONFLICT(capability_version_id) DO UPDATE SET
          worker_device_id=$3,state=$4,observed_at=now(),sandbox_verified=$5,
          required_secrets_ready=$6,runtime_healthy=$7`,
        [row.capability_id,report.capabilityVersionId,beat.workerDeviceId,report.state,
          report.checks?.sandboxVerified??null,report.checks?.requiredSecretsReady??null,
          report.checks?.runtimeHealthy??null]);
        const prior=previous.rows[0];
        if(!prior||prior.state!==report.state||
          prior.sandbox_verified!==(report.checks?.sandboxVerified??null)||
          prior.required_secrets_ready!==(report.checks?.requiredSecretsReady??null)||
          prior.runtime_healthy!==(report.checks?.runtimeHealthy??null)){
          const code=report.checks?.sandboxVerified===false?'SANDBOX_NOT_READY':
            report.checks?.requiredSecretsReady===false?'SECRETS_NOT_READY':
            report.checks?.runtimeHealthy===false?'RUNTIME_NOT_READY':
            report.state==='READY'?'CAPABILITY_READY':'CAPABILITY_NOT_READY';
          await client.query(`INSERT INTO worker_operational_events(id,worker_device_id,
            capability_id,actor_kind,actor_id,kind,code)
            VALUES($1,$2,$3,'WORKER',$5,'HEALTH_CHANGED',$4)`,
          [randomUUID(),beat.workerDeviceId,row.capability_id,code,beat.workerDeviceId]);
        }
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

  /** Bounded scheduler sweep records a single offline transition per stale heartbeat. */
  async recordStaleWorkers(limit=100):Promise<number>{
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new RangeError('INVALID_LIMIT');
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const stale=await client.query<{id:string}>(`SELECT d.id FROM worker_devices d
        JOIN LATERAL (SELECT observed_at FROM worker_heartbeats h
          WHERE h.worker_device_id=d.id ORDER BY observed_at DESC LIMIT 1) h ON true
        WHERE d.status<>'REVOKED' AND h.observed_at<now()-interval '30 seconds'
        AND NOT EXISTS (SELECT 1 FROM worker_operational_events e
          WHERE e.worker_device_id=d.id AND e.kind='WORKER_STALE'
          AND e.created_at>=h.observed_at)
        ORDER BY h.observed_at,d.id LIMIT $1 FOR UPDATE OF d SKIP LOCKED`,[limit]);
      for(const item of stale.rows){
        await client.query(`UPDATE worker_devices SET status='OFFLINE' WHERE id=$1`,[item.id]);
        await client.query(`INSERT INTO worker_operational_events(id,worker_device_id,
          actor_kind,actor_id,kind,code) VALUES($1,$2,'PLATFORM','heartbeat-ttl',
          'WORKER_STALE','HEARTBEAT_EXPIRED')`,[randomUUID(),item.id]);
      }
      await client.query('COMMIT');return stale.rows.length;
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
}
