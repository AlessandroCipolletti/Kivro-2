import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import type { VerifiedOutputUpload } from './output-upload.js';
import { openPrivateWorkerSqlite } from './local-state.js';

const entry = z.strictObject({
  resultManifestId: z.uuid(), jobId: z.uuid(), executionId: z.uuid(), attemptId: z.uuid(),
  workerDeviceId: z.uuid(), controlPlaneId: z.string().min(1).max(160),
  leaseToken: z.string().min(32).max(512),
  retainUntil: z.iso.datetime({ offset: true }),
  payload: z.strictObject({ values: z.record(z.string(), z.unknown()),
    assets: z.record(z.string(), z.array(z.uuid())) }),
  assets: z.array(z.strictObject({ id: z.uuid(), fieldKey: z.string().min(1),
    objectKey: z.string().min(1), sizeBytes: z.number().int().nonnegative(),
    sha256: z.string(), detectedMimeType: z.string() })),
});

export type PendingWorkerResult = z.infer<typeof entry>;

export class WorkerResultOutbox {
  private readonly db: DatabaseSync;

  constructor(stateDir: string) {
    this.db = openPrivateWorkerSqlite(stateDir, 'worker.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS local_result_outbox (
      execution_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL, acknowledged_at TEXT,
      created_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS local_result_outbox_no_delete BEFORE DELETE ON local_result_outbox
        BEGIN SELECT RAISE(ABORT, 'result outbox is append-only'); END;`);
  }

  close(): void { this.db.close(); }

  record(offer: { jobId: string; executionId: string; attemptId: string;
    workerDeviceId: string; controlPlaneId: string; leaseToken: string },
    upload: VerifiedOutputUpload, retainUntil: string): PendingWorkerResult {
    const prior = this.load(offer.executionId);
    const record = entry.parse({ resultManifestId: prior?.resultManifestId ?? randomUUID(),
      jobId: offer.jobId, executionId: offer.executionId, attemptId: offer.attemptId,
      workerDeviceId: offer.workerDeviceId, controlPlaneId: offer.controlPlaneId,
      leaseToken: offer.leaseToken, retainUntil, payload: upload.payload,
      assets: upload.assets.map((asset) => ({ id: asset.id, fieldKey: asset.fieldKey,
        objectKey: asset.objectKey, sizeBytes: asset.sizeBytes, sha256: asset.sha256,
        detectedMimeType: asset.detectedMimeType })) });
    const digest = hashCanonicalJson(record);
    this.db.prepare(`INSERT INTO local_result_outbox(execution_id,job_id,payload_json,payload_hash,created_at)
      VALUES(?,?,?,?,?) ON CONFLICT(execution_id) DO NOTHING`).run(offer.executionId, offer.jobId,
      canonicalJson(record), digest, new Date().toISOString());
    const stored = this.db.prepare('SELECT payload_hash FROM local_result_outbox WHERE execution_id=?')
      .get(offer.executionId) as { payload_hash: string } | undefined;
    if (stored?.payload_hash !== digest) throw new Error('RESULT_OUTBOX_CONFLICT');
    return record;
  }

  load(executionId: string): PendingWorkerResult | null {
    const row = this.db.prepare('SELECT payload_json FROM local_result_outbox WHERE execution_id=?')
      .get(z.uuid().parse(executionId)) as { payload_json: string } | undefined;
    return row ? entry.parse(JSON.parse(row.payload_json)) : null;
  }

  pending(): readonly PendingWorkerResult[] {
    const rows = this.db.prepare('SELECT payload_json FROM local_result_outbox WHERE acknowledged_at IS NULL ORDER BY created_at')
      .all() as { payload_json: string }[];
    return rows.map((row) => entry.parse(JSON.parse(row.payload_json)));
  }

  acknowledge(executionId: string): void {
    const result = this.db.prepare('UPDATE local_result_outbox SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE execution_id=?')
      .run(new Date().toISOString(), z.uuid().parse(executionId));
    if (result.changes !== 1) throw new Error('RESULT_OUTBOX_MISSING');
  }
}
