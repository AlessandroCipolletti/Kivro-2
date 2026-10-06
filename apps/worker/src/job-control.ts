import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { PauseSupportSchema, type PauseSupport } from '../../../packages/contracts/src/job-control.js';
import { DockerJobControlAdapter } from '../../../packages/sandbox-adapter/src/docker.js';
import { WorkerLocalState, type WorkerReadinessChecker, openPrivateWorkerSqlite } from './local-state.js';

export type LocalJobStatus = 'READY' | 'RUNNING' | 'PAUSE_REQUESTED' | 'PAUSED' |
  'RESUME_REQUESTED' | 'SECURITY_PAUSED' | 'CANCEL_REQUESTED' | 'STOPPED' | 'CANCELLED' | 'TIMED_OUT';
export type JobControlSource = 'WEB' | 'LOCAL_UI' | 'CLI' | 'PLATFORM_SECURITY';

const uuid = z.uuid();
const containerId = z.string().regex(/^[a-f0-9]{64}$/);
const registration = z.strictObject({
  jobId: uuid, executionId: uuid, attemptId: uuid, capabilityVersionId: uuid,
  containerId, controlPlaneId: z.string().min(1).max(160),
  pauseSupport: PauseSupportSchema, leaseExpiresAt: z.iso.datetime(),
});
const command = z.strictObject({
  id: uuid, jobId: uuid, actorId: z.string().min(1).max(160),
  source: z.enum(['WEB', 'LOCAL_UI', 'CLI', 'PLATFORM_SECURITY']),
  reason: z.string().max(200).nullable(),
});

type JobRow = {
  job_id: string; execution_id: string; attempt_id: string; capability_version_id: string;
  container_id: string; control_plane_id: string; pause_support: PauseSupport;
  lease_expires_at: string;
  status: LocalJobStatus; pause_requested_at: string | null; paused_at: string | null;
  pause_expires_at: string | null; local_revision: number; acknowledged_revision: number;
};

export class WorkerJobControlError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'PAUSE_NOT_SUPPORTED' | 'NOT_READY' |
    'SECURITY_BLOCK' | 'INVALID_STATE' | 'CONTROL_FAILED') {
    super(code); this.name = 'WorkerJobControlError';
  }
}

const schema = `
CREATE TABLE IF NOT EXISTS local_job_execution (
  job_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL UNIQUE,
  capability_version_id TEXT NOT NULL,
  container_id TEXT NOT NULL UNIQUE,
  control_plane_id TEXT NOT NULL,
  pause_support TEXT NOT NULL CHECK (pause_support IN ('FULL_RESUME','RESTART_STEP','NOT_SUPPORTED')),
  lease_expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('READY','RUNNING','PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED','CANCEL_REQUESTED','STOPPED','CANCELLED','TIMED_OUT')),
  pause_requested_at TEXT,
  paused_at TEXT,
  pause_expires_at TEXT,
  local_revision INTEGER NOT NULL DEFAULT 0,
  acknowledged_revision INTEGER NOT NULL DEFAULT 0,
  CHECK (acknowledged_revision <= local_revision)
);
CREATE TABLE IF NOT EXISTS local_job_command (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES local_job_execution(job_id),
  actor_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('WEB','LOCAL_UI','CLI','PLATFORM_SECURITY')),
  action TEXT NOT NULL CHECK (action IN ('PAUSE','RESUME','CANCEL')),
  reason TEXT,
  previous_state TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  confirmed_at TEXT,
  resulting_state TEXT,
  pause_support TEXT NOT NULL,
  local_revision INTEGER NOT NULL,
  CHECK ((confirmed_at IS NULL) = (resulting_state IS NULL))
);
CREATE TRIGGER IF NOT EXISTS local_job_command_no_delete BEFORE DELETE ON local_job_command
  BEGIN SELECT RAISE(ABORT, 'job command audit is append-only'); END;
CREATE TABLE IF NOT EXISTS local_broker_activity (
  request_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES local_job_execution(job_id),
  started_at TEXT NOT NULL
);
`;

export interface LocalJobSnapshot {
  readonly jobId: string;
  readonly executionId: string;
  readonly attemptId: string;
  readonly controlPlaneId: string;
  readonly pauseSupport: PauseSupport;
  readonly leaseExpiresAt: string;
  readonly status: LocalJobStatus;
  readonly pauseExpiresAt: string | null;
  readonly localRevision: number;
  readonly cloudSyncPending: boolean;
}

export class WorkerJobControl {
  private readonly db: DatabaseSync;
  constructor(private readonly stateDir: string, private readonly docker: DockerJobControlAdapter,
    private readonly readiness: WorkerReadinessChecker,
    private readonly pausePolicy: { readonly maxPauseDurationMs: number }) {
    if (!Number.isSafeInteger(pausePolicy.maxPauseDurationMs) ||
      pausePolicy.maxPauseDurationMs < 60_000) throw new RangeError('Invalid maxPauseDurationMs');
    this.db = openPrivateWorkerSqlite(stateDir, 'worker.sqlite');
    this.db.exec(schema);
  }

  close(): void { this.db.close(); }

  private transaction(operation: () => void): void {
    this.db.exec('BEGIN IMMEDIATE');
    try { operation(); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  private row(jobId: string): JobRow {
    uuid.parse(jobId);
    const row = this.db.prepare('SELECT * FROM local_job_execution WHERE job_id=?').get(jobId) as JobRow | undefined;
    if (!row) throw new WorkerJobControlError('NOT_FOUND');
    return row;
  }

  snapshot(jobId: string): LocalJobSnapshot {
    const row = this.row(jobId);
    return {
      jobId, executionId: row.execution_id, attemptId: row.attempt_id,
      controlPlaneId: row.control_plane_id, pauseSupport: row.pause_support,
      leaseExpiresAt: row.lease_expires_at,
      status: row.status, pauseExpiresAt: row.pause_expires_at,
      localRevision: row.local_revision,
      cloudSyncPending: row.acknowledged_revision < row.local_revision,
    };
  }

  snapshots(): readonly LocalJobSnapshot[] {
    const rows = this.db.prepare('SELECT job_id FROM local_job_execution ORDER BY job_id')
      .all() as { job_id: string }[];
    return rows.map(({ job_id }) => this.snapshot(job_id));
  }

  /** Startup only: the former supervisor and its broker channel died with the Worker process. */
  async stopOrphanedAtStartup(): Promise<readonly LocalJobSnapshot[]> {
    const stopped: LocalJobSnapshot[] = [];
    for (const current of this.snapshots()) {
      if (['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(current.status)) continue;
      const row = this.row(current.jobId);
      const actual = await this.docker.status(row.container_id, row.job_id, row.attempt_id);
      if (actual === 'running' || actual === 'paused') {
        await this.docker.stop(row.container_id, row.job_id, row.attempt_id);
      }
      this.transaction(() => {
        this.db.prepare('DELETE FROM local_broker_activity WHERE job_id=?').run(current.jobId);
        this.db.prepare("UPDATE local_job_execution SET status='STOPPED',local_revision=local_revision+1 WHERE job_id=?")
          .run(current.jobId);
      });
      stopped.push(this.snapshot(current.jobId));
    }
    return stopped;
  }

  register(input: unknown): LocalJobSnapshot {
    const item = registration.parse(input);
    this.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM local_job_execution WHERE job_id=?').get(item.jobId) as JobRow | undefined;
      if (existing) {
        if (existing.execution_id === item.executionId && existing.attempt_id === item.attemptId &&
          existing.container_id === item.containerId && existing.control_plane_id === item.controlPlaneId &&
          existing.capability_version_id === item.capabilityVersionId && existing.pause_support === item.pauseSupport &&
          existing.lease_expires_at === item.leaseExpiresAt) return;
        throw new WorkerJobControlError('CONFLICT');
      }
      if (Date.parse(item.leaseExpiresAt) <= Date.now() ||
        Date.parse(item.leaseExpiresAt) - Date.now() > 3_600_000) {
        throw new WorkerJobControlError('INVALID_STATE');
      }
      this.db.prepare(`INSERT INTO local_job_execution(job_id,execution_id,attempt_id,capability_version_id,
        container_id,control_plane_id,pause_support,lease_expires_at,status,local_revision)
        VALUES(?,?,?,?,?,?,?,?,'READY',1)`).run(item.jobId, item.executionId, item.attemptId,
        item.capabilityVersionId, item.containerId, item.controlPlaneId, item.pauseSupport, item.leaseExpiresAt);
    });
    return this.snapshot(item.jobId);
  }

  markRunning(jobId: string): LocalJobSnapshot {
    this.transaction(() => {
      const row = this.row(jobId);
      if (row.status === 'RUNNING') return;
      if (row.status !== 'READY') throw new WorkerJobControlError('INVALID_STATE');
      if (Date.parse(row.lease_expires_at) <= Date.now()) throw new WorkerJobControlError('NOT_READY');
      this.db.prepare("UPDATE local_job_execution SET status='RUNNING',local_revision=local_revision+1 WHERE job_id=?").run(jobId);
    });
    return this.snapshot(jobId);
  }

  /** Transactional barrier with pause: a new host operation starts only while RUNNING. */
  beginBrokerOperation(jobId: string, requestId: string): void {
    uuid.parse(requestId);
    this.transaction(() => {
      const row = this.row(jobId);
      if (row.status !== 'RUNNING' || Date.parse(row.lease_expires_at) <= Date.now()) {
        throw new WorkerJobControlError('NOT_READY');
      }
      this.db.prepare('INSERT INTO local_broker_activity(request_id,job_id,started_at) VALUES(?,?,?)')
        .run(requestId, jobId, new Date().toISOString());
    });
  }

  endBrokerOperation(jobId: string, requestId: string): void {
    uuid.parse(jobId); uuid.parse(requestId);
    this.db.prepare('DELETE FROM local_broker_activity WHERE request_id=? AND job_id=?')
      .run(requestId, jobId);
  }

  activeBrokerOperations(jobId: string): number {
    this.row(jobId);
    const result = this.db.prepare('SELECT COUNT(*) AS count FROM local_broker_activity WHERE job_id=?')
      .get(jobId) as { count: number };
    return result.count;
  }

  private async waitBrokerQuiescent(jobId: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (this.activeBrokerOperations(jobId) > 0) {
      if (Date.now() >= deadline) throw new WorkerJobControlError('CONTROL_FAILED');
      await delay(50);
    }
  }

  assertStartPermitted(jobId: string, container: string): void {
    const row = this.row(jobId);
    if (row.container_id !== containerId.parse(container) || row.status !== 'READY' ||
      Date.parse(row.lease_expires_at) <= Date.now()) throw new WorkerJobControlError('NOT_READY');
  }

  markStopped(jobId: string, container: string): LocalJobSnapshot {
    containerId.parse(container);
    this.transaction(() => {
      const row = this.row(jobId);
      if (row.container_id !== container) throw new WorkerJobControlError('CONFLICT');
      if (['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(row.status)) return;
      this.db.prepare("UPDATE local_job_execution SET status='STOPPED',local_revision=local_revision+1 WHERE job_id=?").run(jobId);
    });
    return this.snapshot(jobId);
  }

  private beginCommand(input: z.infer<typeof command>, action: 'PAUSE' | 'RESUME' | 'CANCEL',
    from: LocalJobStatus[], to: LocalJobStatus): JobRow {
    let before: JobRow | undefined;
    this.transaction(() => {
      const row = this.row(input.jobId);
      const old = this.db.prepare('SELECT * FROM local_job_command WHERE id=?').get(input.id) as
        { job_id: string; action: string; actor_id: string; source: string; reason: string | null } | undefined;
      if (old) {
        if (old.job_id !== input.jobId || old.action !== action || old.actor_id !== input.actorId ||
          old.source !== input.source || old.reason !== input.reason) throw new WorkerJobControlError('CONFLICT');
        before = row;
        return;
      }
      if (!from.includes(row.status)) throw new WorkerJobControlError('INVALID_STATE');
      const now = new Date().toISOString();
      this.db.prepare(`INSERT INTO local_job_command(id,job_id,actor_id,source,action,reason,previous_state,
        requested_at,pause_support,local_revision) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(input.id, input.jobId,
        input.actorId, input.source, action, input.reason, row.status, now, row.pause_support, row.local_revision + 1);
      this.db.prepare(`UPDATE local_job_execution SET status=?,local_revision=local_revision+1,
        pause_requested_at=CASE WHEN ?='PAUSE' THEN ? ELSE pause_requested_at END WHERE job_id=?`)
        .run(to, action, now, input.jobId);
      before = row;
    });
    if (!before) throw new WorkerJobControlError('CONFLICT');
    return before;
  }

  private assertCommandIdentity(input: z.infer<typeof command>, action: 'PAUSE' | 'RESUME' | 'CANCEL'): void {
    const old = this.db.prepare('SELECT job_id,actor_id,source,action,reason FROM local_job_command WHERE id=?')
      .get(input.id) as { job_id: string; actor_id: string; source: string; action: string;
        reason: string | null } | undefined;
    if (old && (old.job_id !== input.jobId || old.actor_id !== input.actorId || old.source !== input.source ||
      old.action !== action || old.reason !== input.reason)) throw new WorkerJobControlError('CONFLICT');
  }

  private confirm(input: z.infer<typeof command>, status: LocalJobStatus): LocalJobSnapshot {
    this.transaction(() => {
      const row = this.row(input.jobId);
      const old = this.db.prepare('SELECT confirmed_at,resulting_state FROM local_job_command WHERE id=?').get(input.id) as
        { confirmed_at: string | null; resulting_state: string | null } | undefined;
      if (!old) throw new WorkerJobControlError('CONFLICT');
      if (old.confirmed_at !== null) {
        if (old.resulting_state !== status) throw new WorkerJobControlError('CONFLICT');
        return;
      }
      const now = new Date().toISOString();
      const expires = status === 'PAUSED' || status === 'SECURITY_PAUSED' ?
        new Date(Date.now() + this.pausePolicy.maxPauseDurationMs).toISOString() : null;
      this.db.prepare(`UPDATE local_job_execution SET status=?,paused_at=?,pause_expires_at=?,
        local_revision=local_revision+1 WHERE job_id=?`).run(status,
        status === 'PAUSED' || status === 'SECURITY_PAUSED' ? now : null, expires, input.jobId);
      this.db.prepare('UPDATE local_job_command SET confirmed_at=?,resulting_state=? WHERE id=?')
        .run(now, status, input.id);
      if (row.status === 'STOPPED' || row.status === 'CANCELLED') throw new WorkerJobControlError('INVALID_STATE');
    });
    return this.snapshot(input.jobId);
  }

  async pause(raw: unknown): Promise<LocalJobSnapshot> {
    const input = command.parse(raw);
    this.assertCommandIdentity(input, 'PAUSE');
    const current = this.row(input.jobId);
    if (current.pause_support !== 'FULL_RESUME') throw new WorkerJobControlError('PAUSE_NOT_SUPPORTED');
    if (current.status === 'PAUSED' || current.status === 'SECURITY_PAUSED') return this.snapshot(input.jobId);
    if (current.status === 'RUNNING' &&
      await this.docker.status(current.container_id, current.job_id, current.attempt_id) === 'exited') {
      this.markStopped(input.jobId, current.container_id);
      throw new WorkerJobControlError('INVALID_STATE');
    }
    this.beginCommand(input, 'PAUSE', ['RUNNING'], 'PAUSE_REQUESTED');
    const row = this.row(input.jobId);
    try {
      await this.waitBrokerQuiescent(input.jobId);
      await this.docker.pause(row.container_id, row.job_id, row.attempt_id);
    } catch {
      try {
        if (await this.docker.status(row.container_id, row.job_id, row.attempt_id) === 'exited') {
          this.markStopped(input.jobId, row.container_id);
        }
      } catch { /* Preserve the pending request for later reconciliation. */ }
      throw new WorkerJobControlError('CONTROL_FAILED');
    }
    return this.confirm(input, input.source === 'PLATFORM_SECURITY' ? 'SECURITY_PAUSED' : 'PAUSED');
  }

  async resume(raw: unknown, allowGlobalPause = false): Promise<LocalJobSnapshot> {
    const input = command.parse(raw);
    this.assertCommandIdentity(input, 'RESUME');
    const row = this.row(input.jobId);
    if (row.status === 'RUNNING') return this.snapshot(input.jobId);
    if (row.status === 'SECURITY_PAUSED') throw new WorkerJobControlError('SECURITY_BLOCK');
    if (row.status !== 'PAUSED' && row.status !== 'RESUME_REQUESTED') throw new WorkerJobControlError('INVALID_STATE');
    if (Date.parse(row.lease_expires_at) <= Date.now()) throw new WorkerJobControlError('NOT_READY');
    const local = new WorkerLocalState(this.stateDir, this.readiness);
    try {
      const pause = local.snapshot();
      if (pause.securityPaused) throw new WorkerJobControlError('SECURITY_BLOCK');
      if (pause.globalPaused && !allowGlobalPause) throw new WorkerJobControlError('NOT_READY');
    } finally { local.close(); }
    const readiness = await this.readiness.check();
    const age = Date.now() - Date.parse(readiness.checkedAt);
    if (!readiness.ready || readiness.blockingReasons.length || age < 0 || age > 30_000) {
      throw new WorkerJobControlError('NOT_READY');
    }
    this.beginCommand(input, 'RESUME', ['PAUSED'], 'RESUME_REQUESTED');
    const latest = this.row(input.jobId);
    try { await this.docker.resume(latest.container_id, latest.job_id, latest.attempt_id); }
    catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
    return this.confirm(input, 'RUNNING');
  }

  async cancel(raw: unknown): Promise<LocalJobSnapshot> {
    const input = command.parse(raw);
    this.assertCommandIdentity(input, 'CANCEL');
    const row = this.row(input.jobId);
    if (row.status === 'CANCELLED') return this.snapshot(input.jobId);
    this.beginCommand(input, 'CANCEL', ['READY', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED',
      'RESUME_REQUESTED', 'SECURITY_PAUSED'], 'CANCEL_REQUESTED');
    try {
      await this.waitBrokerQuiescent(input.jobId);
      if (await this.docker.status(row.container_id, row.job_id, row.attempt_id) !== 'created') {
        await this.docker.stop(row.container_id, row.job_id, row.attempt_id);
      }
    }
    catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
    return this.confirm(input, 'CANCELLED');
  }

  /** Call at Worker startup and on a bounded timer; never leave paid work paused forever. */
  async expireOverdue(now = new Date()): Promise<readonly LocalJobSnapshot[]> {
    if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid clock');
    const overdue = this.db.prepare(`SELECT job_id FROM local_job_execution
      WHERE status IN ('PAUSED','SECURITY_PAUSED') AND pause_expires_at <= ?`)
      .all(now.toISOString()) as { job_id: string }[];
    const expired: LocalJobSnapshot[] = [];
    for (const { job_id: jobId } of overdue) {
      const row = this.row(jobId);
      const input = newLocalJobCommand(jobId, 'kivro:pause-timeout', 'PLATFORM_SECURITY', 'MAX_PAUSE_DURATION');
      this.beginCommand(input, 'CANCEL', ['PAUSED', 'SECURITY_PAUSED'], 'CANCEL_REQUESTED');
      try { await this.docker.stop(row.container_id, row.job_id, row.attempt_id); }
      catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
      expired.push(this.confirm(input, 'TIMED_OUT'));
    }
    return expired;
  }

  /** An authenticated renewal can only extend the same execution's still-live local lease. */
  extendLease(jobId: string, executionId: string, planeId: string, expiresAt: string): LocalJobSnapshot {
    const expiry = z.iso.datetime().parse(expiresAt);
    this.transaction(() => {
      const row = this.row(jobId);
      if (row.execution_id !== uuid.parse(executionId) || row.control_plane_id !== planeId ||
        ['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(row.status) ||
        Date.parse(row.lease_expires_at) <= Date.now() ||
        Date.parse(expiry) <= Date.parse(row.lease_expires_at) ||
        Date.parse(expiry) - Date.now() > 3_600_000) throw new WorkerJobControlError('CONFLICT');
      this.db.prepare(`UPDATE local_job_execution SET lease_expires_at=?,local_revision=local_revision+1
        WHERE job_id=?`).run(expiry, jobId);
    });
    return this.snapshot(jobId);
  }

  /** Call on startup and periodically even while the cloud connection is down. */
  async expireLeases(now = new Date()): Promise<readonly LocalJobSnapshot[]> {
    if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid clock');
    const rows = this.db.prepare(`SELECT job_id FROM local_job_execution
      WHERE status NOT IN ('STOPPED','CANCELLED','TIMED_OUT') AND lease_expires_at <= ?`)
      .all(now.toISOString()) as { job_id: string }[];
    const expired: LocalJobSnapshot[] = [];
    for (const { job_id: jobId } of rows) {
      const row = this.row(jobId);
      const input = newLocalJobCommand(jobId, 'kivro:lease-timeout', 'PLATFORM_SECURITY', 'LEASE_EXPIRED');
      this.beginCommand(input, 'CANCEL', ['READY', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED',
        'RESUME_REQUESTED', 'SECURITY_PAUSED'], 'CANCEL_REQUESTED');
      try {
        if (await this.docker.status(row.container_id, row.job_id, row.attempt_id) !== 'created') {
          await this.docker.stop(row.container_id, row.job_id, row.attempt_id);
        }
      }
      catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
      expired.push(this.confirm(input, 'TIMED_OUT'));
    }
    return expired;
  }

  /** Acknowledgement is scoped to an execution's originating control plane. */
  acknowledge(jobId: string, executionId: string, planeId: string, revision: number): LocalJobSnapshot {
    const row = this.row(jobId);
    if (row.execution_id !== uuid.parse(executionId) || row.control_plane_id !== planeId ||
      !Number.isSafeInteger(revision) || revision < 0 || revision > row.local_revision) {
      throw new WorkerJobControlError('CONFLICT');
    }
    this.db.prepare('UPDATE local_job_execution SET acknowledged_revision=MAX(acknowledged_revision,?) WHERE job_id=?')
      .run(revision, jobId);
    return this.snapshot(jobId);
  }

  /** Reconcile persisted state with Docker before reporting any pause as confirmed. */
  async reconcile(jobId: string): Promise<LocalJobSnapshot> {
    const row = this.row(jobId);
    if (!['STOPPED', 'CANCELLED', 'TIMED_OUT'].includes(row.status) &&
      Date.parse(row.lease_expires_at) <= Date.now()) {
      await this.expireLeases();
      return this.snapshot(jobId);
    }
    if (!['PAUSE_REQUESTED', 'PAUSED', 'SECURITY_PAUSED', 'RESUME_REQUESTED',
      'CANCEL_REQUESTED'].includes(row.status)) {
      return this.snapshot(jobId);
    }
    const actual = await this.docker.status(row.container_id, row.job_id, row.attempt_id);
    if (actual === 'exited' && row.status !== 'CANCEL_REQUESTED') {
      return this.markStopped(jobId, row.container_id);
    }
    const pending = this.db.prepare(`SELECT id,actor_id,source,reason,action FROM local_job_command
      WHERE job_id=? AND confirmed_at IS NULL ORDER BY local_revision DESC LIMIT 1`).get(jobId) as
      { id: string; actor_id: string; source: JobControlSource; reason: string | null;
        action: 'PAUSE' | 'RESUME' | 'CANCEL' } | undefined;
    const commandInput = pending && { id: pending.id, jobId, actorId: pending.actor_id,
      source: pending.source, reason: pending.reason };
    if (actual === 'paused' && row.status === 'PAUSE_REQUESTED') {
      if (!commandInput || pending?.action !== 'PAUSE') throw new WorkerJobControlError('CONFLICT');
      return this.confirm(commandInput, pending.source === 'PLATFORM_SECURITY' ? 'SECURITY_PAUSED' : 'PAUSED');
    } else if (actual === 'running' && (row.status === 'PAUSED' || row.status === 'SECURITY_PAUSED')) {
      try { await this.docker.pause(row.container_id, row.job_id, row.attempt_id); }
      catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
    } else if (actual === 'running' && row.status === 'PAUSE_REQUESTED') {
      if (this.activeBrokerOperations(jobId) > 0) return this.snapshot(jobId);
      try { await this.docker.pause(row.container_id, row.job_id, row.attempt_id); }
      catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
      if (!commandInput || pending?.action !== 'PAUSE') throw new WorkerJobControlError('CONFLICT');
      return this.confirm(commandInput, pending.source === 'PLATFORM_SECURITY' ? 'SECURITY_PAUSED' : 'PAUSED');
    } else if (row.status === 'RESUME_REQUESTED' && commandInput && pending?.action === 'RESUME') {
      if (actual === 'running') {
        const readiness = await this.readiness.check();
        if (readiness.ready && readiness.blockingReasons.length === 0 &&
          Date.now() - Date.parse(readiness.checkedAt) <= 30_000) return this.confirm(commandInput, 'RUNNING');
        try { await this.docker.pause(row.container_id, row.job_id, row.attempt_id); }
        catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
      }
      if (actual === 'paused' || actual === 'running') return this.confirm(commandInput, 'PAUSED');
    } else if (row.status === 'CANCEL_REQUESTED' && commandInput && pending?.action === 'CANCEL') {
      try { await this.docker.stop(row.container_id, row.job_id, row.attempt_id); }
      catch { throw new WorkerJobControlError('CONTROL_FAILED'); }
      return this.confirm(commandInput, pending.reason === 'MAX_PAUSE_DURATION' ? 'TIMED_OUT' : 'CANCELLED');
    }
    return this.snapshot(jobId);
  }

  commandHistory(jobId: string): readonly Record<string, unknown>[] {
    this.row(jobId);
    return this.db.prepare('SELECT id,job_id,actor_id,source,action,reason,previous_state,requested_at,confirmed_at,resulting_state,pause_support,local_revision FROM local_job_command WHERE job_id=? ORDER BY local_revision,id')
      .all(jobId) as Record<string, unknown>[];
  }

}

export function newLocalJobCommand(jobId: string, actorId: string, source: JobControlSource,
  reason: string | null = null): z.infer<typeof command> {
  return command.parse({ id: randomUUID(), jobId, actorId, source, reason });
}
