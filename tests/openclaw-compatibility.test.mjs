import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOpenClawCompatibility, openClawCompatibilityMatrix } from '../dist/packages/openclaw-adapter/src/compatibility.js';

test('isolated pinned image conformance never authorizes the ambient personal binary', () => {
  assert.equal(openClawCompatibilityMatrix.length, 1);
  assert.equal(openClawCompatibilityMatrix[0].configSyntaxChecked, true);
  assert.equal(openClawCompatibilityMatrix[0].executionConformanceChecked, true);
  const candidate = checkOpenClawCompatibility('2026.8.2');
  assert.equal(candidate.status, 'CANDIDATE');
  assert.equal(candidate.executionAllowed, false);
});

test('unknown, missing and untested OpenClaw versions fail closed', () => {
  for (const version of ['2026.8.3', '2026.7.0', '2026.8.2-beta.1', null]) {
    const report = checkOpenClawCompatibility(version);
    assert.notEqual(report.status, 'CANDIDATE');
    assert.equal(report.executionAllowed, false);
  }
});
