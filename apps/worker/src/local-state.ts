import { randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type PauseSource = 'LOCAL_CLI' | 'WEB' | 'PLATFORM_SECURITY' | 'ADMIN';
export type PauseScope = 'ALL' | 'CAPABILITY';
export type PauseAction = 'PAUSE' | 'RESUME';

export interface PauseAuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly source: PauseSource;
  readonly actorId: string;
  readonly scope: PauseScope;
  readonly capabilityId: string | null;
  readonly action: PauseAction;
  readonly reason: string | null;
  readonly localRevision: number;
}

export interface PauseState {
  readonly globalPaused: boolean;
  readonly localPaused: boolean;
  readonly cloudPaused: boolean;
  readonly cloudRevision: number;
  readonly securityPaused: boolean;
  readonly pausedAt: string | null;
  readonly pauseReason: string | null;
  readonly pauseSource: PauseSource | null;
  readonly localRevision: number;
  readonly acknowledgedRevision: number;
  readonly cloudSyncPending: boolean;
  readonly capabilityPauses: readonly string[];
  readonly localCapabilityPauses: readonly string[];
  readonly lastCloudContactAt: string | null;
  readonly reportedCapacity: number;
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly checkedAt: string;
  readonly blockingReasons: readonly string[];
}

export interface WorkerReadinessChecker {
  check(): Promise<ReadinessResult>;
}

export class WorkerStateError extends Error {
  constructor(readonly code: 'INSECURE_STATE_PATH' | 'SECURITY_PAUSE' | 'NOT_READY' | 'INVALID_ARGUMENT', message: string) {
    super(message);
    this.name = 'WorkerStateError';
  }
}

const schema = `
CREATE TABLE IF NOT EXISTS worker_pause_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  global_paused INTEGER NOT NULL DEFAULT 0 CHECK (global_paused IN (0,1)),
  security_paused INTEGER NOT NULL DEFAULT 0 CHECK (security_paused IN (0,1)),
  security_pause_origin TEXT CHECK (security_pause_origin IN ('LOCAL','CLOUD')),
  paused_at TEXT,
  pause_reason TEXT,
  pause_source TEXT CHECK (pause_source IN ('LOCAL_CLI','WEB','PLATFORM_SECURITY','ADMIN')),
  local_revision INTEGER NOT NULL DEFAULT 0 CHECK (local_revision >= 0),
  acknowledged_revision INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged_revision >= 0 AND acknowledged_revision <= local_revision)
);
INSERT OR IGNORE INTO worker_pause_state(singleton) VALUES (1);
CREATE TABLE IF NOT EXISTS capability_pause (
  capability_id TEXT PRIMARY KEY,
  paused_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('LOCAL_CLI','WEB','PLATFORM_SECURITY','ADMIN')),
  reason TEXT
);
CREATE TABLE IF NOT EXISTS cloud_capability_pause (
  capability_id TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS worker_connection_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  last_contact_at TEXT,
  advertised_capacity INTEGER NOT NULL DEFAULT 0 CHECK(advertised_capacity BETWEEN 0 AND 64)
);
INSERT OR IGNORE INTO worker_connection_state(singleton) VALUES(1);
CREATE TABLE IF NOT EXISTS pause_audit (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('LOCAL_CLI','WEB','PLATFORM_SECURITY','ADMIN')),
  actor_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('ALL','CAPABILITY')),
  capability_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('PAUSE','RESUME')),
  reason TEXT,
  local_revision INTEGER NOT NULL,
  CHECK ((scope = 'ALL' AND capability_id IS NULL) OR (scope = 'CAPABILITY' AND capability_id IS NOT NULL))
);
CREATE TRIGGER IF NOT EXISTS pause_audit_no_update BEFORE UPDATE ON pause_audit BEGIN SELECT RAISE(ABORT, 'pause audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS pause_audit_no_delete BEFORE DELETE ON pause_audit BEGIN SELECT RAISE(ABORT, 'pause audit is append-only'); END;
`;

type StateRow = {
  global_paused: number;
  cloud_paused: number;
  cloud_revision: number;
  security_paused: number;
  security_pause_origin: 'LOCAL'|'CLOUD'|null;
  paused_at: string | null;
  pause_reason: string | null;
  pause_source: PauseSource | null;
  local_revision: number;
  acknowledged_revision: number;
};

type AuditRow = {
  id: string;
  occurred_at: string;
  source: PauseSource;
  actor_id: string;
  scope: PauseScope;
  capability_id: string | null;
  action: PauseAction;
  reason: string | null;
  local_revision: number;
};

function assertPrivatePath(path: string, directory: boolean): void {
  const info = lstatSync(path);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) {
    throw new WorkerStateError('INSECURE_STATE_PATH', 'Worker state path is not a private regular path');
  }
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) {
    throw new WorkerStateError('INSECURE_STATE_PATH', 'Worker state path has a different owner');
  }
  if ((info.mode & 0o077) !== 0) {
    throw new WorkerStateError('INSECURE_STATE_PATH', 'Worker state path allows group or other access');
  }
}

function pathExistsNoFollow(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

/** Opens a seller-local SQLite file with the same ownership, mode and durability rules for every Worker store. */
export function openPrivateWorkerSqlite(stateDir: string, filename: 'worker.sqlite' | 'import.sqlite'): DatabaseSync {
  const dir = resolve(stateDir);
  if (!pathExistsNoFollow(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  assertPrivatePath(dir, true);
  const dbPath = join(dir, filename);
  if (pathExistsNoFollow(dbPath)) assertPrivatePath(dbPath, false);
  const db = new DatabaseSync(dbPath);
  try {
    chmodSync(dbPath, 0o600);
    assertPrivatePath(dbPath, false);
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function assertReason(reason: string | undefined): string | null {
  if (reason === undefined) return null;
  if (reason.length > 500 || [...reason].some((character) => character.charCodeAt(0) < 32)) {
    throw new WorkerStateError('INVALID_ARGUMENT', 'Pause reason must be short, plain text');
  }
  return reason;
}

function assertActor(actorId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(actorId)) {
    throw new WorkerStateError('INVALID_ARGUMENT', 'Invalid pause actor');
  }
}

function assertCapabilityId(capabilityId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,48}$/i.test(capabilityId)) {
    throw new WorkerStateError('INVALID_ARGUMENT', 'Invalid capability ID');
  }
}

function assertFreshReadiness(result: ReadinessResult): void {
  const checkedAt = Date.parse(result.checkedAt);
  const age = Date.now() - checkedAt;
  if (!result.ready || result.blockingReasons.length > 0 || !Number.isFinite(age) || age < 0 || age > 30_000) {
    throw new WorkerStateError('NOT_READY', 'Worker security or readiness checks failed');
  }
}

function rowToAudit(row: AuditRow): PauseAuditEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    source: row.source,
    actorId: row.actor_id,
    scope: row.scope,
    capabilityId: row.capability_id,
    action: row.action,
    reason: row.reason,
    localRevision: row.local_revision,
  };
}

/** Local seller control. No method in this store grants job execution permission. */
export class WorkerLocalState {
  private readonly db: DatabaseSync;

  constructor(stateDir: string, private readonly readiness: WorkerReadinessChecker) {
    this.db = openPrivateWorkerSqlite(stateDir, 'worker.sqlite');
    try {
      this.db.exec(schema);
      // Expand existing private Worker state without dropping a persisted local stop.
      const columns = this.db.prepare('PRAGMA table_info(worker_pause_state)').all() as { name: string }[];
      if (!columns.some((column) => column.name === 'cloud_paused')) {
        this.db.exec('ALTER TABLE worker_pause_state ADD COLUMN cloud_paused INTEGER NOT NULL DEFAULT 0 CHECK (cloud_paused IN (0,1))');
      }
      if (!columns.some((column) => column.name === 'cloud_revision')) {
        this.db.exec('ALTER TABLE worker_pause_state ADD COLUMN cloud_revision INTEGER NOT NULL DEFAULT 0 CHECK (cloud_revision >= 0)');
      }
      if (!columns.some((column) => column.name === 'security_pause_origin')) {
        this.db.exec("ALTER TABLE worker_pause_state ADD COLUMN security_pause_origin TEXT CHECK (security_pause_origin IN ('LOCAL','CLOUD'))");
      }
      const connectionColumns=this.db.prepare('PRAGMA table_info(worker_connection_state)').all() as {name:string}[];
      if(!connectionColumns.some((column)=>column.name==='advertised_capacity'))
        this.db.exec('ALTER TABLE worker_connection_state ADD COLUMN advertised_capacity INTEGER NOT NULL DEFAULT 0 CHECK(advertised_capacity BETWEEN 0 AND 64)');
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  snapshot(): PauseState {
    const row = this.db.prepare('SELECT * FROM worker_pause_state WHERE singleton = 1').get() as StateRow;
    const localCapabilityPauses = (this.db.prepare('SELECT capability_id FROM capability_pause ORDER BY capability_id').all() as { capability_id: string }[]).map((item) => item.capability_id);
    const cloudCapabilityPauses = (this.db.prepare('SELECT capability_id FROM cloud_capability_pause ORDER BY capability_id').all() as { capability_id: string }[]).map((item) => item.capability_id);
    const connection = this.db.prepare('SELECT last_contact_at,advertised_capacity FROM worker_connection_state WHERE singleton=1').get() as {last_contact_at:string|null;advertised_capacity:number};
    return {
      globalPaused: row.global_paused === 1 || row.cloud_paused === 1,
      localPaused: row.global_paused === 1,
      cloudPaused: row.cloud_paused === 1,
      cloudRevision:row.cloud_revision,
      securityPaused: row.security_paused === 1,
      pausedAt: row.paused_at,
      pauseReason: row.pause_reason,
      pauseSource: row.pause_source,
      localRevision: row.local_revision,
      acknowledgedRevision: row.acknowledged_revision,
      cloudSyncPending: row.acknowledged_revision < row.local_revision,
      capabilityPauses: [...new Set([...localCapabilityPauses, ...cloudCapabilityPauses])].sort(),
      localCapabilityPauses,
      lastCloudContactAt:connection.last_contact_at,
      reportedCapacity:connection.advertised_capacity,
    };
  }

  /** Local pause persists in a FULL-synchronous transaction before this returns. */
  pauseAll(actorId: string, source: PauseSource = 'LOCAL_CLI', reason?: string): PauseState {
    assertActor(actorId);
    const safeReason = assertReason(reason);
    const now = new Date().toISOString();
    this.transaction(() => {
      const row = this.readRow();
      if (row.global_paused === 1) return;
      this.db.prepare('UPDATE worker_pause_state SET global_paused=1, paused_at=?, pause_reason=?, pause_source=?, local_revision=local_revision+1 WHERE singleton=1')
        .run(now, safeReason, source);
      this.audit(source, actorId, 'ALL', null, 'PAUSE', safeReason, now, row.local_revision + 1);
    });
    return this.snapshot();
  }

  async resumeAll(actorId: string, source: PauseSource = 'LOCAL_CLI', reason?: string): Promise<PauseState> {
    assertActor(actorId);
    const safeReason = assertReason(reason);
    const expected = this.readRow();
    if (expected.security_paused === 1) throw new WorkerStateError('SECURITY_PAUSE', 'A security pause blocks seller resume');
    if (expected.cloud_paused === 1) throw new WorkerStateError('NOT_READY', 'Web pause remains active');
    const readiness = await this.readiness.check();
    assertFreshReadiness(readiness);
    const now = new Date().toISOString();
    this.transaction(() => {
      const row = this.readRow();
      if (row.security_paused === 1) throw new WorkerStateError('SECURITY_PAUSE', 'A security pause blocks seller resume');
      if (row.cloud_paused === 1) throw new WorkerStateError('NOT_READY', 'Web pause remains active');
      if (row.local_revision !== expected.local_revision) throw new WorkerStateError('NOT_READY', 'Pause state changed during readiness check');
      if (row.global_paused === 0) return;
      this.db.prepare('UPDATE worker_pause_state SET global_paused=0, paused_at=NULL, pause_reason=NULL, pause_source=NULL, local_revision=local_revision+1 WHERE singleton=1').run();
      this.audit(source, actorId, 'ALL', null, 'RESUME', safeReason, now, row.local_revision + 1);
    });
    return this.snapshot();
  }

  pauseCapability(capabilityId: string, actorId: string, source: PauseSource = 'LOCAL_CLI', reason?: string): PauseState {
    assertCapabilityId(capabilityId);
    assertActor(actorId);
    const safeReason = assertReason(reason);
    const now = new Date().toISOString();
    this.transaction(() => {
      const exists = this.db.prepare('SELECT 1 FROM capability_pause WHERE capability_id=?').get(capabilityId);
      if (exists) return;
      const row = this.readRow();
      this.db.prepare('INSERT INTO capability_pause(capability_id,paused_at,source,reason) VALUES (?,?,?,?)').run(capabilityId, now, source, safeReason);
      this.db.prepare('UPDATE worker_pause_state SET local_revision=local_revision+1 WHERE singleton=1').run();
      this.audit(source, actorId, 'CAPABILITY', capabilityId, 'PAUSE', safeReason, now, row.local_revision + 1);
    });
    return this.snapshot();
  }

  async resumeCapability(capabilityId: string, actorId: string, source: PauseSource = 'LOCAL_CLI', reason?: string): Promise<PauseState> {
    assertCapabilityId(capabilityId);
    assertActor(actorId);
    const safeReason = assertReason(reason);
    const current = this.readRow();
    if (current.security_paused === 1 || current.global_paused === 1 || current.cloud_paused === 1 ||
      this.db.prepare('SELECT 1 FROM cloud_capability_pause WHERE capability_id=?').get(capabilityId)) {
      throw new WorkerStateError('SECURITY_PAUSE', 'Global or security pause blocks capability resume');
    }
    const readiness = await this.readiness.check();
    assertFreshReadiness(readiness);
    const now = new Date().toISOString();
    this.transaction(() => {
      const row = this.readRow();
      if (row.security_paused === 1 || row.global_paused === 1 || row.cloud_paused === 1 ||
        this.db.prepare('SELECT 1 FROM cloud_capability_pause WHERE capability_id=?').get(capabilityId))
        throw new WorkerStateError('SECURITY_PAUSE', 'Global, web or security pause blocks capability resume');
      if (row.local_revision !== current.local_revision) throw new WorkerStateError('NOT_READY', 'Pause state changed during readiness check');
      const result = this.db.prepare('DELETE FROM capability_pause WHERE capability_id=?').run(capabilityId);
      if (result.changes === 0) return;
      this.db.prepare('UPDATE worker_pause_state SET local_revision=local_revision+1 WHERE singleton=1').run();
      this.audit(source, actorId, 'CAPABILITY', capabilityId, 'RESUME', safeReason, now, row.local_revision + 1);
    });
    return this.snapshot();
  }

  /** Security pause has no seller-controlled clear operation. Release needs a future authenticated policy path. */
  applySecurityPause(actorId: string, reason: string): PauseState {
    assertActor(actorId);
    const safeReason = assertReason(reason);
    if (safeReason === null || safeReason.length === 0) throw new WorkerStateError('INVALID_ARGUMENT', 'Security pause requires a reason');
    const now = new Date().toISOString();
    this.transaction(() => {
      const row = this.readRow();
      if (row.security_paused === 1 && row.security_pause_origin === 'LOCAL') return;
      this.db.prepare("UPDATE worker_pause_state SET security_paused=1, security_pause_origin='LOCAL',paused_at=?, pause_reason=?, pause_source='PLATFORM_SECURITY', local_revision=local_revision+1 WHERE singleton=1")
        .run(now, safeReason);
      this.audit('PLATFORM_SECURITY', actorId, 'ALL', null, 'PAUSE', safeReason, now, row.local_revision + 1);
    });
    return this.snapshot();
  }

  /** A signed cloud welcome is applied before any offer in that poll. It cannot clear a local stop. */
  applyCloudDirective(input: { readonly revision: number; readonly paused: boolean;
    readonly capabilityPauses: readonly string[]; readonly securityPaused: boolean;
    readonly clearSecurityPause?: boolean | undefined }): PauseState {
    if (!Number.isSafeInteger(input.revision) || input.revision < 0 ||
      input.capabilityPauses.length > 64 || (input.clearSecurityPause && input.securityPaused))
      throw new WorkerStateError('INVALID_ARGUMENT', 'Invalid cloud pause directive');
    for (const id of input.capabilityPauses) assertCapabilityId(id);
    this.transaction(() => {
      const row = this.readRow();
      if (input.revision < row.cloud_revision) return;
      if (input.revision === row.cloud_revision) {
        const existing = this.db.prepare('SELECT capability_id FROM cloud_capability_pause ORDER BY capability_id').all() as { capability_id: string }[];
        if (row.cloud_paused !== Number(input.paused) ||
          existing.map((item) => item.capability_id).join(',') !== [...input.capabilityPauses].sort().join(',')) {
          throw new WorkerStateError('INVALID_ARGUMENT', 'Conflicting cloud pause directive');
        }
        if (input.securityPaused && row.security_paused === 0) {
          this.db.prepare("UPDATE worker_pause_state SET security_paused=1,security_pause_origin='CLOUD',paused_at=?,pause_reason='Security policy blocked execution',pause_source='PLATFORM_SECURITY',local_revision=local_revision+1 WHERE singleton=1")
            .run(new Date().toISOString());
        }
        return;
      }
      this.db.prepare('UPDATE worker_pause_state SET cloud_paused=?,cloud_revision=? WHERE singleton=1')
        .run(Number(input.paused), input.revision);
      this.db.prepare('DELETE FROM cloud_capability_pause').run();
      for (const id of input.capabilityPauses) {
        this.db.prepare('INSERT INTO cloud_capability_pause(capability_id) VALUES(?)').run(id);
      }
      if (input.securityPaused && row.security_paused === 0) {
        this.db.prepare("UPDATE worker_pause_state SET security_paused=1,security_pause_origin='CLOUD',paused_at=?,pause_reason='Security policy blocked execution',pause_source='PLATFORM_SECURITY',local_revision=local_revision+1 WHERE singleton=1")
          .run(new Date().toISOString());
      } else if (input.clearSecurityPause && !input.securityPaused &&
        row.security_paused === 1 && row.security_pause_origin === 'CLOUD') {
        const now=new Date().toISOString();
        this.db.prepare("UPDATE worker_pause_state SET security_paused=0,security_pause_origin=NULL,local_revision=local_revision+1 WHERE singleton=1")
          .run();
        this.audit('PLATFORM_SECURITY','platform-policy','ALL',null,'RESUME',
          'Security block cleared after platform verification',now,row.local_revision+1);
      }
    });
    return this.snapshot();
  }

  /** Called only after the cloud has durably acknowledged this local revision. */
  acknowledgeCloudRevision(revision: number): PauseState {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision > this.readRow().local_revision) {
      throw new WorkerStateError('INVALID_ARGUMENT', 'Invalid acknowledged revision');
    }
    this.db.prepare('UPDATE worker_pause_state SET acknowledged_revision=MAX(acknowledged_revision,?) WHERE singleton=1').run(revision);
    return this.snapshot();
  }

  recordCloudContact(advertisedCapacity=0):void{
    if(!Number.isSafeInteger(advertisedCapacity)||advertisedCapacity<0||advertisedCapacity>64)
      throw new WorkerStateError('INVALID_ARGUMENT','Invalid announced execution capacity');
    this.db.prepare('UPDATE worker_connection_state SET last_contact_at=?,advertised_capacity=? WHERE singleton=1')
      .run(new Date().toISOString(),advertisedCapacity);
  }

  /** This is only the pause decision, not authorization to execute a job. */
  isUnpausedForNewJobOffer(capabilityId: string): boolean {
    assertCapabilityId(capabilityId);
    const row = this.readRow();
    if (row.global_paused === 1 || row.cloud_paused === 1 || row.security_paused === 1) return false;
    return this.db.prepare('SELECT 1 FROM capability_pause WHERE capability_id=?').get(capabilityId) === undefined &&
      this.db.prepare('SELECT 1 FROM cloud_capability_pause WHERE capability_id=?').get(capabilityId) === undefined;
  }

  auditEvents(): readonly PauseAuditEvent[] {
    return (this.db.prepare('SELECT * FROM pause_audit ORDER BY local_revision, occurred_at, id').all() as AuditRow[]).map(rowToAudit);
  }

  private readRow(): StateRow {
    return this.db.prepare('SELECT * FROM worker_pause_state WHERE singleton=1').get() as StateRow;
  }

  private audit(source: PauseSource, actorId: string, scope: PauseScope, capabilityId: string | null, action: PauseAction, reason: string | null, occurredAt: string, revision: number): void {
    this.db.prepare('INSERT INTO pause_audit(id,occurred_at,source,actor_id,scope,capability_id,action,reason,local_revision) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(), occurredAt, source, actorId, scope, capabilityId, action, reason, revision);
  }

  private transaction(operation: () => void): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      operation();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
