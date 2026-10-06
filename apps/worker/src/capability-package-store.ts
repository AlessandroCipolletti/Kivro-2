import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from
  '../../../packages/contracts/src/capability-package.js';
import { openPrivateWorkerSqlite } from './local-state.js';

const review = z.strictObject({ actorId: z.string().min(1).max(160),
  approvedAt: z.iso.datetime(), reviewEvidenceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/) });

export class WorkerPackageStoreError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'CONFLICT' | 'CORRUPT') {
    super(code); this.name = 'WorkerPackageStoreError';
  }
}

/** Private immutable seller-approved package bytes; discovery cannot install a capability. */
export class WorkerCapabilityPackageStore {
  private readonly db: DatabaseSync;

  constructor(stateDir: string) {
    this.db = openPrivateWorkerSqlite(stateDir, 'worker.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS local_capability_package (
      capability_version_id TEXT PRIMARY KEY, capability_id TEXT NOT NULL,
      worker_device_id TEXT NOT NULL, package_hash TEXT NOT NULL,
      package_json TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
      review_evidence_hash TEXT NOT NULL, installed_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS local_capability_package_no_update
      BEFORE UPDATE ON local_capability_package BEGIN SELECT RAISE(ABORT, 'package is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS local_capability_package_no_delete
      BEFORE DELETE ON local_capability_package BEGIN SELECT RAISE(ABORT, 'package is immutable'); END;`);
  }

  close(): void { this.db.close(); }

  installReviewed(raw: unknown, rawReview: unknown): { capabilityVersionId: string; packageHash: string } {
    const pkg = LocalCapabilityPackageSchema.parse(raw);
    const consent = review.parse(rawReview);
    const packageHash = hashCanonicalJson(pkg);
    const serialized = canonicalJson(pkg);
    const prior = this.db.prepare(`SELECT package_hash,package_json,approved_by,approved_at,
      review_evidence_hash FROM local_capability_package WHERE capability_version_id=?`)
      .get(pkg.capabilityVersionId) as { package_hash: string; package_json: string;
        approved_by: string; approved_at: string; review_evidence_hash: string } | undefined;
    if (prior) {
      if (prior.package_hash !== packageHash || prior.package_json !== serialized ||
        prior.approved_by !== consent.actorId || prior.approved_at !== consent.approvedAt ||
        prior.review_evidence_hash !== consent.reviewEvidenceHash) {
        throw new WorkerPackageStoreError('CONFLICT');
      }
      return { capabilityVersionId: pkg.capabilityVersionId, packageHash };
    }
    this.db.prepare(`INSERT INTO local_capability_package(capability_version_id,capability_id,
      worker_device_id,package_hash,package_json,approved_by,approved_at,review_evidence_hash,installed_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(pkg.capabilityVersionId, pkg.capabilityId, pkg.workerDeviceId,
      packageHash, serialized, consent.actorId, consent.approvedAt,
      consent.reviewEvidenceHash, new Date().toISOString());
    return { capabilityVersionId: pkg.capabilityVersionId, packageHash };
  }

  load(capabilityVersionId: string): LocalCapabilityPackage {
    const row = this.db.prepare('SELECT package_json,package_hash FROM local_capability_package WHERE capability_version_id=?')
      .get(z.uuid().parse(capabilityVersionId)) as { package_json: string; package_hash: string } | undefined;
    if (!row) throw new WorkerPackageStoreError('NOT_FOUND');
    try {
      const pkg = LocalCapabilityPackageSchema.parse(JSON.parse(row.package_json));
      if (pkg.capabilityVersionId !== capabilityVersionId || hashCanonicalJson(pkg) !== row.package_hash) {
        throw new WorkerPackageStoreError('CORRUPT');
      }
      return pkg;
    } catch { throw new WorkerPackageStoreError('CORRUPT'); }
  }
}
