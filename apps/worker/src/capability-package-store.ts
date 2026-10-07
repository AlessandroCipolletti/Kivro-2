import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from
  '../../../packages/contracts/src/capability-package.js';
import { openPrivateWorkerSqlite } from './local-state.js';
import type { ReviewedSkillSnapshot } from '../../../packages/openclaw-adapter/src/job-config.js';

const review = z.strictObject({ actorId: z.string().min(1).max(160),
  approvedAt: z.iso.datetime(), reviewEvidenceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/) });
const snapshot = z.strictObject({ name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
  files: z.array(z.strictObject({ path: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
    bytesBase64: z.string().max(1_500_000) })).min(1).max(32) });

export function validateReviewedSkillSnapshots(pkg: LocalCapabilityPackage,
  raw: unknown): readonly ReviewedSkillSnapshot[] {
  const skills = z.array(snapshot).max(64).parse(raw);
  if (skills.length !== pkg.workerManifest.skills.length ||
    new Set(skills.map((item) => item.name)).size !== skills.length) {
    throw new WorkerPackageStoreError('CORRUPT');
  }
  return pkg.workerManifest.skills.map((declared) => {
    const skill = skills.find((item) => item.name === declared.name);
    if (!skill || !skill.files.some((file) => file.path === 'SKILL.md') ||
      new Set(skill.files.map((file) => file.path)).size !== skill.files.length) {
      throw new WorkerPackageStoreError('CORRUPT');
    }
    let total = 0;
    const files = skill.files.map((file) => {
      if (file.path === '.' || file.path === '..' ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.bytesBase64)) {
        throw new WorkerPackageStoreError('CORRUPT');
      }
      const bytes = Buffer.from(file.bytesBase64, 'base64');
      total += bytes.byteLength;
      if (bytes.byteLength > 1_000_000 || total > 2_000_000) throw new WorkerPackageStoreError('CORRUPT');
      return { path: file.path, bytesBase64: file.bytesBase64,
        sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
    }).sort((a, b) => a.path.localeCompare(b.path));
    if (hashCanonicalJson(files.map(({ path, sha256 }) => ({ path, sha256 }))) !== declared.contentHash) {
      throw new WorkerPackageStoreError('CORRUPT');
    }
    return { name: declared.name, files: files.map(({ path, bytesBase64 }) => ({ path, bytesBase64 })) };
  });
}

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
      BEFORE DELETE ON local_capability_package BEGIN SELECT RAISE(ABORT, 'package is immutable'); END;
      CREATE TABLE IF NOT EXISTS local_reviewed_skill_snapshot (
        capability_version_id TEXT NOT NULL REFERENCES local_capability_package(capability_version_id),
        skill_name TEXT NOT NULL, content_hash TEXT NOT NULL, files_json TEXT NOT NULL,
        PRIMARY KEY(capability_version_id,skill_name));
      CREATE TRIGGER IF NOT EXISTS local_reviewed_skill_no_update
      BEFORE UPDATE ON local_reviewed_skill_snapshot BEGIN SELECT RAISE(ABORT, 'skill snapshot is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS local_reviewed_skill_no_delete
      BEFORE DELETE ON local_reviewed_skill_snapshot BEGIN SELECT RAISE(ABORT, 'skill snapshot is immutable'); END;`);
  }

  close(): void { this.db.close(); }

  listInstalled(): readonly LocalCapabilityPackage[] {
    const rows = this.db.prepare('SELECT capability_version_id FROM local_capability_package ORDER BY capability_version_id')
      .all() as { capability_version_id: string }[];
    return rows.map((row) => {
      const pkg = this.load(row.capability_version_id);
      this.loadReviewedSkills(row.capability_version_id);
      return pkg;
    });
  }

  installReviewed(raw: unknown, rawReview: unknown, rawSkills: unknown = []):
    { capabilityVersionId: string; packageHash: string } {
    const pkg = LocalCapabilityPackageSchema.parse(raw);
    const consent = review.parse(rawReview);
    const skills = validateReviewedSkillSnapshots(pkg, rawSkills);
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
      if (canonicalJson(this.loadReviewedSkills(pkg.capabilityVersionId)) !== canonicalJson(skills)) {
        throw new WorkerPackageStoreError('CONFLICT');
      }
      return { capabilityVersionId: pkg.capabilityVersionId, packageHash };
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`INSERT INTO local_capability_package(capability_version_id,capability_id,
        worker_device_id,package_hash,package_json,approved_by,approved_at,review_evidence_hash,installed_at)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(pkg.capabilityVersionId, pkg.capabilityId, pkg.workerDeviceId,
        packageHash, serialized, consent.actorId, consent.approvedAt,
        consent.reviewEvidenceHash, new Date().toISOString());
      for (const skill of skills) {
        const declared = pkg.workerManifest.skills.find((item) => item.name === skill.name)!;
        this.db.prepare(`INSERT INTO local_reviewed_skill_snapshot
          (capability_version_id,skill_name,content_hash,files_json) VALUES(?,?,?,?)`)
          .run(pkg.capabilityVersionId, skill.name, declared.contentHash, canonicalJson(skill.files));
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return { capabilityVersionId: pkg.capabilityVersionId, packageHash };
  }

  loadReviewedSkills(capabilityVersionId: string): readonly ReviewedSkillSnapshot[] {
    const pkg = this.load(capabilityVersionId);
    const rows = this.db.prepare(`SELECT skill_name,content_hash,files_json
      FROM local_reviewed_skill_snapshot WHERE capability_version_id=? ORDER BY skill_name`)
      .all(capabilityVersionId) as { skill_name: string; content_hash: string; files_json: string }[];
    try {
      const skills = validateReviewedSkillSnapshots(pkg, rows.map((row) => ({ name: row.skill_name,
        files: JSON.parse(row.files_json) })));
      if (rows.some((row) => pkg.workerManifest.skills.find((item) => item.name === row.skill_name)
        ?.contentHash !== row.content_hash)) throw new WorkerPackageStoreError('CORRUPT');
      return skills;
    } catch { throw new WorkerPackageStoreError('CORRUPT'); }
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
