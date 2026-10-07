#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const coverage = readFileSync(resolve(root, 'spec/COVERAGE.md'), 'utf8');
const backlog = readFileSync(resolve(root, 'docs/verification-backlog.md'), 'utf8');

export function auditVerification(coverageText, backlogText) {
  const covered = new Map();
  for (const line of coverageText.split('\n')) {
    const match = /^\s+`?([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3,4})`?\s+P\d+\s+(?:§(\d+)\s+)?`?([A-Z_]+)`?\s+/.exec(line);
    if (!match) continue;
    if (covered.has(match[1])) throw new Error(`DUPLICATE_COVERAGE:${match[1]}`);
    covered.set(match[1], { section: match[2] ? Number(match[2]) : null, status: match[3] });
  }
  const rows = [];
  const seen = new Set();
  for (const line of backlogText.split('\n')) {
    const match = /^\| `([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3,4})` \(§(\d+)\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/.exec(line);
    if (!match) continue;
    const [, id, sectionText, why, dependency, closingEvidence] = match;
    if (seen.has(id)) throw new Error(`DUPLICATE_BACKLOG:${id}`);
    seen.add(id);
    const entry = covered.get(id);
    if (!entry || !['DEFERRED_VERIFICATION', 'OPEN_IMPLEMENTATION'].includes(entry.status) ||
      entry.section !== null && entry.section !== Number(sectionText))
      throw new Error(`BACKLOG_COVERAGE_MISMATCH:${id}`);
    if (why.trim().length < 20 || dependency.trim().length < 8 ||
      closingEvidence.trim().length < 20) throw new Error(`BACKLOG_EVIDENCE_MISSING:${id}`);
    const milestones = [...dependency.matchAll(/\bM(\d{2})\b/g)]
      .map((item) => Number(item[1]));
    const laterMilestones = milestones.filter((number) => number > 16);
    const priorMilestones = milestones.filter((number) => number < 16);
    const mentionsM16 = /\bM16\b/.test(dependency);
    const external = /\bexternal\b|credential|professional review|real OS|physical device|deployed OS|Google OAuth|Google OIDC|Google callback/i.test(dependency);
    rows.push({ id, section: Number(sectionText), status: entry.status,
      why: why.trim(), dependency: dependency.trim(), closingEvidence: closingEvidence.trim(),
      reviewBucket: laterMilestones.length ? 'LATER_MILESTONE' :
        priorMilestones.length ? 'PREVIOUS_IMPLEMENTATION' :
          external ? 'EXTERNAL' : mentionsM16 ? 'M16_CANDIDATE' : 'UNSCOPED',
      laterMilestones, priorMilestones, external });
  }
  const openRows = [...covered].filter(([, entry]) =>
    ['DEFERRED_VERIFICATION', 'OPEN_IMPLEMENTATION'].includes(entry.status));
  for (const [id] of openRows) if (!seen.has(id)) throw new Error(`BACKLOG_ROW_MISSING:${id}`);
  const counts = Object.fromEntries(['M16_CANDIDATE', 'PREVIOUS_IMPLEMENTATION',
    'LATER_MILESTONE', 'EXTERNAL', 'UNSCOPED'].map((name) =>
    [name, rows.filter((row) => row.reviewBucket === name).length]));
  return { totalCoverage: covered.size,
    deferred: rows.filter((row) => row.status === 'DEFERRED_VERIFICATION').length,
    openImplementation: rows.filter((row) => row.status === 'OPEN_IMPLEMENTATION').length,
    openRows: rows.length, counts, rows };
}

export const requiredReleaseEvidence = Object.freeze([
  'TWO_USER_PAID_STRIPE_TEST_MODE', 'REAL_OPENCLAW_DOCKER',
  'PRIVATE_FILE_ROUND_TRIP', 'EXACTLY_ONCE_LEDGER', 'FAILURE_MATRIX',
  'SECURITY_MATRIX', 'NETSONS_CONFORMANCE', 'AWS_CONFORMANCE',
  'EXTERNAL_SECURITY_REVIEW', 'LEGAL_PRODUCT_REVIEW',
]);
const evidenceClassForGate = Object.freeze({
  TWO_USER_PAID_STRIPE_TEST_MODE:'FULL_E2E', REAL_OPENCLAW_DOCKER:'FULL_E2E',
  PRIVATE_FILE_ROUND_TRIP:'FULL_E2E', EXACTLY_ONCE_LEDGER:'FULL_E2E',
  FAILURE_MATRIX:'FULL_E2E', SECURITY_MATRIX:'SECURITY_RED_TEAM',
  NETSONS_CONFORMANCE:'PROVIDER_CONFORMANCE',AWS_CONFORMANCE:'PROVIDER_CONFORMANCE',
  EXTERNAL_SECURITY_REVIEW:'EXTERNAL_REVIEW',LEGAL_PRODUCT_REVIEW:'EXTERNAL_REVIEW',
});

export function releaseDecision(coverageText, backlogText, evidence = null) {
  const audit = auditVerification(coverageText, backlogText);
  const open = [];
  for (const line of coverageText.split('\n')) {
    const match = /^\s+`?([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3,4})`?\s+P\d+\s+(?:§\d+\s+)?`?([A-Z_]+)`?\s+/.exec(line);
    if (match && !['VERIFIED', 'DEFERRED', 'USER_OVERRIDE'].includes(match[2])) {
      open.push({ id: match[1], status: match[2] });
    }
  }
  const missingEvidence = requiredReleaseEvidence.filter((gate) => {
    const result = evidence?.gates?.[gate];
    return result?.passed !== true || typeof result.evidencePath !== 'string' ||
      result.evidencePath.trim().length < 8 ||
      result.evidenceClass !== evidenceClassForGate[gate];
  });
  return { ready: open.length === 0 && audit.deferred === 0 && missingEvidence.length === 0,
    openCount: open.length, deferredCount: audit.deferred,
    openImplementationCount: audit.openImplementation, open,
    auditCounts: audit.counts, missingEvidence };
}

/** An arbitrary existing path is not release evidence. The report must identify
 * its exact gate and carry an explicit passing result or external attestation. */
export function validReleaseEvidenceFile(gate, item, directory = root) {
  if (!Object.hasOwn(evidenceClassForGate, gate) ||
    typeof item?.evidencePath !== 'string' ||
    item.evidenceClass !== evidenceClassForGate[gate]) return false;
  const path = resolve(directory, item.evidencePath);
  if (!path.startsWith(directory + '/')) return false;
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return false;
    const report = JSON.parse(readFileSync(path, 'utf8'));
    if (report.schemaVersion !== 1 || report.gate !== gate || report.passed !== true ||
      report.evidenceClass !== evidenceClassForGate[gate]) return false;
    if (item.evidenceClass === 'EXTERNAL_REVIEW') {
      return typeof report.reviewer === 'string' && report.reviewer.trim().length >= 3 &&
        typeof report.scope === 'string' && report.scope.trim().length >= 20 &&
        typeof report.reviewedCommit === 'string' && /^[a-f0-9]{40}$/.test(report.reviewedCommit) &&
        (report.decision === 'APPROVED' || gate === 'EXTERNAL_SECURITY_REVIEW' &&
          report.decision === 'PRIVATE_BETA_RISK_ACCEPTED');
    }
    return Array.isArray(report.results) && report.results.length > 0 &&
      report.results.every((step) => typeof step.name === 'string' &&
        step.name.trim().length > 0 && step.exitCode === 0);
  } catch { return false; }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const command = process.argv[2] ?? 'audit';
  if (command === 'audit') {
    const audit = auditVerification(coverage, backlog);
    if (process.argv[3] === '--json') process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
    else process.stdout.write(`${JSON.stringify({ totalCoverage: audit.totalCoverage,
      deferred: audit.deferred, openImplementation: audit.openImplementation,
      openRows: audit.openRows, counts: audit.counts }, null, 2)}\n`);
  } else if (command === 'release-gate') {
    const argument = process.argv[3];
    let evidence = null;
    if (argument) {
      if (argument !== '--evidence' || !process.argv[4] || process.argv[5]) {
        throw new Error('USAGE: release-gate [--evidence <json-file>]');
      }
      evidence = JSON.parse(readFileSync(resolve(process.argv[4]), 'utf8'));
      if (!evidence || typeof evidence !== 'object' ||
        Object.entries(evidence.gates ?? {}).some(([gate,item]) =>
          item?.passed === true && !validReleaseEvidenceFile(gate,item))) {
        throw new Error('INVALID_RELEASE_EVIDENCE');
      }
    }
    const decision = releaseDecision(coverage, backlog, evidence);
    process.stdout.write(`${JSON.stringify({ ready: decision.ready, openCount: decision.openCount,
      deferredCount: decision.deferredCount, auditCounts: decision.auditCounts,
      openImplementationCount: decision.openImplementationCount,
      missingEvidence: decision.missingEvidence,
      sampleOpen: decision.open.slice(0, 25) }, null, 2)}\n`);
    if (!decision.ready) process.exitCode = 1;
  } else if (command === 'write-json' && process.argv[3]) {
    writeFileSync(resolve(process.argv[3]), JSON.stringify(auditVerification(coverage, backlog), null, 2));
  } else {
    process.stderr.write('Usage: node tools/m16-verification-audit.mjs [audit [--json]|release-gate|write-json <path>]\n');
    process.exitCode = 2;
  }
}
