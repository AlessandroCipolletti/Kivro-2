import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { auditVerification, releaseDecision, requiredReleaseEvidence,
  validReleaseEvidenceFile } from
  '../tools/m16-verification-audit.mjs';

const root = resolve(import.meta.dirname, '..');
const coverage = readFileSync(resolve(root, 'spec/COVERAGE.md'), 'utf8');
const backlog = readFileSync(resolve(root, 'docs/verification-backlog.md'), 'utf8');

test('all real deferred gates are audited individually and the public release stays closed', () => {
  const result = auditVerification(coverage, backlog);
  assert.equal(result.totalCoverage, 1954,
    'compound-prefix curated requirements must be counted in the release audit');
  assert.ok(result.deferred > 0);
  assert.equal(result.rows.length, new Set(result.rows.map((row) => row.id)).size);
  assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0),
    result.openRows);
  const release = releaseDecision(coverage, backlog);
  assert.equal(release.ready, false);
  assert.equal(release.deferredCount, result.deferred);
  assert.ok(release.open.some((item) => item.status === 'OPEN_IMPLEMENTATION'));
});

test('compound-prefix requirements cannot disappear from the release gate', () => {
  const row = '  DEV-LOCAL-014 P1 TODO --- --- §563\n';
  const audit = auditVerification(row, '');
  assert.equal(audit.totalCoverage, 1);
  assert.deepEqual(releaseDecision(row, '').open,
    [{ id: 'DEV-LOCAL-014', status: 'TODO' }]);
});

test('gate fails closed for missing, duplicated, stale or unsupported evidence', () => {
  const base = '  `TST-9000` P1 §91 `DEFERRED_VERIFICATION` implementation test note\n';
  const row = '| `TST-9000` (§91) | Has security work but no real proof. | M16 paid E2E. | Run a real sandbox and prove denial with a trace. |\n';
  assert.equal(auditVerification(base, row).deferred, 1);
  assert.equal(releaseDecision(base, row).ready, false);
  assert.throws(() => auditVerification(base, ''), /BACKLOG_ROW_MISSING/);
  assert.throws(() => auditVerification(base, row + row), /DUPLICATE_BACKLOG/);
  assert.throws(() => auditVerification(base.replace('§91', '§92'), row), /BACKLOG_COVERAGE_MISMATCH/);
  assert.throws(() => auditVerification(base.replace('DEFERRED_VERIFICATION', 'VERIFIED'), row),
    /BACKLOG_COVERAGE_MISMATCH/);
  assert.throws(() => auditVerification(base + base, row), /DUPLICATE_COVERAGE/);
  assert.equal(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'TESTED'), '').ready, false);
  assert.equal(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'OPEN_IMPLEMENTATION'), row).ready,
    false);
  assert.equal(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'VERIFIED'), '').ready,
    false, 'coverage claims alone cannot open the release gate');
  assert.ok(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'VERIFIED'), '')
    .missingEvidence.includes('TWO_USER_PAID_STRIPE_TEST_MODE'));
  const synthetic = { gates: Object.fromEntries(requiredReleaseEvidence.map((name) =>
    [name, { passed: true, evidencePath: 'tests/fixture-evidence.json',
      evidenceClass: name.endsWith('_REVIEW') ? 'EXTERNAL_REVIEW' :
        name.endsWith('_CONFORMANCE') ? 'PROVIDER_CONFORMANCE' :
          name === 'SECURITY_MATRIX' ? 'SECURITY_RED_TEAM' : 'FULL_E2E' }])) };
  assert.equal(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'VERIFIED'), '', synthetic).ready,
    true, 'the pure decision opens only with complete independently supplied evidence');
  synthetic.gates.REAL_OPENCLAW_DOCKER.evidenceClass='COMPONENT_ONLY';
  assert.equal(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'VERIFIED'), '', synthetic).ready,
    false,'a component report cannot satisfy the final OpenClaw acceptance gate');
  synthetic.gates.REAL_OPENCLAW_DOCKER.evidenceClass='FULL_E2E';
  delete synthetic.gates.REAL_OPENCLAW_DOCKER;
  assert.equal(releaseDecision(base.replace('DEFERRED_VERIFICATION', 'VERIFIED'), '', synthetic).ready,
    false);
});

test('release evidence cannot be satisfied by an existing unrelated file or a component report', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'kivro-release-gate-'));
  const file = resolve(directory, 'evidence.json');
  const item = { passed: true, evidencePath: 'evidence.json', evidenceClass: 'FULL_E2E' };
  try {
    writeFileSync(file, '# A plausible looking report\n');
    assert.equal(validReleaseEvidenceFile('REAL_OPENCLAW_DOCKER', item, directory), false);
    const report = { schemaVersion: 1, gate: 'REAL_OPENCLAW_DOCKER',
      evidenceClass: 'COMPONENT_ONLY', passed: true,
      results: [{ name: 'sandbox', exitCode: 0 }] };
    writeFileSync(file, JSON.stringify(report));
    assert.equal(validReleaseEvidenceFile('REAL_OPENCLAW_DOCKER', item, directory), false);
    report.evidenceClass = 'FULL_E2E';
    report.gate = 'TWO_USER_PAID_STRIPE_TEST_MODE';
    writeFileSync(file, JSON.stringify(report));
    assert.equal(validReleaseEvidenceFile('REAL_OPENCLAW_DOCKER', item, directory), false);
    report.gate = 'REAL_OPENCLAW_DOCKER';
    report.results[0].exitCode = 1;
    writeFileSync(file, JSON.stringify(report));
    assert.equal(validReleaseEvidenceFile('REAL_OPENCLAW_DOCKER', item, directory), false);
    report.results[0].exitCode = 0;
    writeFileSync(file, JSON.stringify(report));
    assert.equal(validReleaseEvidenceFile('REAL_OPENCLAW_DOCKER', item, directory), true);

    const external = { passed: true, evidencePath: 'evidence.json',
      evidenceClass: 'EXTERNAL_REVIEW' };
    assert.equal(validReleaseEvidenceFile('EXTERNAL_SECURITY_REVIEW', external, directory), false);
    writeFileSync(file, JSON.stringify({ schemaVersion: 1,
      gate: 'EXTERNAL_SECURITY_REVIEW', evidenceClass: 'EXTERNAL_REVIEW',
      passed: true, reviewer: 'Independent reviewer',
      scope: 'Full sandbox and financial security review',
      reviewedCommit: 'a'.repeat(40), decision: 'APPROVED' }));
    assert.equal(validReleaseEvidenceFile('EXTERNAL_SECURITY_REVIEW', external, directory), true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
