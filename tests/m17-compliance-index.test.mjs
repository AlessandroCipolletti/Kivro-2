import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildComplianceIndex } from '../tools/m17-compliance-index.mjs';

const root = resolve(import.meta.dirname, '..');
const input = ['MASTER-SPEC.md', 'REQUIREMENTS.md', 'COVERAGE.md']
  .map((name) => readFileSync(resolve(root, 'spec', name), 'utf8'));

test('all generated and curated requirements have matching priority and coverage', () => {
  const report = buildComplianceIndex(...input);
  assert.equal(report.masterSections, 619);
  assert.equal(report.generatedRequirements, 1672);
  assert.equal(report.curatedRequirements, 282);
  assert.equal(report.catalogRequirements, 1954);
  assert.equal(report.coverageRequirements, 1954);
  assert.equal(report.requirements.length, 1954);
  assert.equal(report.missingCoverage.length, 0);
  assert.equal(report.uncatalogedCoverage.length, 0);
  assert.equal(report.mismatches.length, 0);
  assert.deepEqual(report.untracedMasterSections, []);
  assert.equal(report.evidenceClass, 'STRUCTURAL_INDEX_ONLY');
});

test('catalog priority and source drift fail the M17 index', () => {
  assert.throws(() => buildComplianceIndex(input[0], input[1],
    input[2].replace('`PAY-0107`    P0', '`PAY-0107`    P1')),
  /SPEC_COVERAGE_MISMATCH/);
  assert.throws(() => buildComplianceIndex(input[0], input[1],
    input[2].replace('  DEV-LOCAL-014   P1', '  DEV-LOCAL-014   P2')),
  /SPEC_COVERAGE_MISMATCH/);
  assert.throws(() => buildComplianceIndex(input[0],
    input[1].replace('- §554: `DEV-LOCAL-002`', ''), input[2]),
  /SPEC_COVERAGE_MISMATCH/);
});
