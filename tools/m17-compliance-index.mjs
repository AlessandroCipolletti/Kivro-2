#!/usr/bin/env node
/** Structural inventory only. A coverage row never proves runtime behavior. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const idPattern = '[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d{3,4}';

function add(map, id, value, kind) {
  if (map.has(id)) throw new Error(`DUPLICATE_${kind}:${id}`);
  map.set(id, value);
}

export function buildComplianceIndex(master, requirements, coverage) {
  const sectionIds = new Set([...master.matchAll(/^#{1,2} (\d+)\./gm)]
    .map((match) => Number(match[1])));
  const catalog = new Map();
  const generated = [...requirements.matchAll(new RegExp(`^### (${idPattern}) --- [^\\n]+`, 'gm'))];
  for (let index = 0; index < generated.length; index++) {
    const match = generated[index];
    const body = requirements.slice(match.index,
      generated[index + 1]?.index ?? requirements.indexOf('## Curated requirements ---'));
    const priority = /\*\*Priority:\*\* (P[0-3])/.exec(body)?.[1];
    const source = /\*\*Source:\*\* MASTER-SPEC\.md §(\d+)/.exec(body)?.[1];
    if (!priority || !source) throw new Error(`CATALOG_METADATA_MISSING:${match[1]}`);
    add(catalog, match[1], { priority, source: Number(source), kind: 'GENERATED' }, 'CATALOG');
  }
  const curatedStart = requirements.indexOf('## Curated requirements ---');
  if (curatedStart < 0) throw new Error('CURATED_CATALOG_MISSING');
  const curated = requirements.slice(curatedStart);
  for (const line of curated.split('\n')) {
    const match = new RegExp(`^  (${idPattern})\\s+(P[0-3])\\s+`).exec(line);
    if (!match) continue;
    const source = /§(\d+)/.exec(line)?.[1];
    add(catalog, match[1], { priority: match[2],
      source: source ? Number(source) : null, kind: 'CURATED' }, 'CATALOG');
  }

  const covered = new Map();
  for (const line of coverage.split('\n')) {
    const match = new RegExp('^  `?(' + idPattern + ')`?\\s+(P[0-3])\\s+' +
      '(?:§(\\d+)\\s+)?`?([A-Z_]+)`?\\s+').exec(line);
    if (!match) continue;
    add(covered, match[1], { priority: match[2],
      source: match[3] ? Number(match[3]) : null, status: match[4],
      coverageClaim: line.trim() }, 'COVERAGE');
  }
  const missingCoverage = [...catalog.keys()].filter((id) => !covered.has(id));
  const uncatalogedCoverage = [...covered.keys()].filter((id) => !catalog.has(id));
  const tracedSections = new Set([...catalog.values()].map((item) => item.source)
    .filter((source) => source !== null));
  for (const match of requirements.matchAll(/^- §(\d+): (.+)$/gm)) {
    const section = Number(match[1]);
    const ids = [...match[2].matchAll(new RegExp(idPattern, 'g'))].map((item) => item[0]);
    if (ids.length === 0 || !sectionIds.has(section) ||
      ids.some((id) => !catalog.has(id))) throw new Error(`INVALID_SOURCE_CROSSWALK:${section}`);
    tracedSections.add(section);
  }
  const untracedMasterSections = [...sectionIds].filter((section) =>
    !tracedSections.has(section)).sort((left, right) => left - right);
  const mismatches = [];
  for (const [id, item] of catalog) {
    const row = covered.get(id);
    if (!row) continue;
    if (row.priority !== item.priority ||
      item.source !== null && row.source !== null && row.source !== item.source ||
      item.source !== null && !sectionIds.has(item.source)) mismatches.push(id);
  }
  const statusCounts = {};
  const priorityStatus = {};
  const openByFamily = {};
  for (const [id, row] of covered) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    priorityStatus[row.priority] ??= {};
    priorityStatus[row.priority][row.status] =
      (priorityStatus[row.priority][row.status] ?? 0) + 1;
    if (!['VERIFIED', 'DEFERRED', 'USER_OVERRIDE'].includes(row.status)) {
      const family = id.replace(/-\d{3,4}$/, '');
      openByFamily[family] = (openByFamily[family] ?? 0) + 1;
    }
  }
  const report = { evidenceClass: 'STRUCTURAL_INDEX_ONLY',
    masterSections: sectionIds.size, generatedRequirements: generated.length,
    curatedRequirements: catalog.size - generated.length,
    catalogRequirements: catalog.size, coverageRequirements: covered.size,
    missingCoverage, uncatalogedCoverage, mismatches, untracedMasterSections,
    statusCounts, priorityStatus, openByFamily,
    openMandatoryCount: [...covered.values()].filter((row) =>
      !['VERIFIED', 'DEFERRED', 'USER_OVERRIDE'].includes(row.status)).length,
    requirements: [...catalog].map(([id, item]) => ({ id, ...item,
      status: covered.get(id)?.status ?? 'MISSING_COVERAGE' })) };
  if (missingCoverage.length || uncatalogedCoverage.length || mismatches.length ||
    untracedMasterSections.length)
    throw new Error(`SPEC_COVERAGE_MISMATCH:${JSON.stringify({
      missingCoverage, uncatalogedCoverage, mismatches, untracedMasterSections })}`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const report = buildComplianceIndex(
    readFileSync(resolve(root, 'spec/MASTER-SPEC.md'), 'utf8'),
    readFileSync(resolve(root, 'spec/REQUIREMENTS.md'), 'utf8'),
    readFileSync(resolve(root, 'spec/COVERAGE.md'), 'utf8'));
  if (process.argv[2] === '--write') {
    writeFileSync(resolve(root, 'docs/evidence/m17-compliance-index.json'),
      `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ ...report, requirements: undefined }, null, 2)}\n`);
  if (report.openMandatoryCount > 0 && process.argv[2] !== '--check') process.exitCode = 1;
}
