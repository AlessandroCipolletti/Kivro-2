import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { EncryptedDeviceIdentityStore } from '../dist/apps/worker/src/device-identity.js';

const command = join(process.cwd(), 'tools', 'kivro-worker.mjs');

test('CLI pause commits before success and health sees it from a new process', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-worker-cli-'));
  chmodSync(directory, 0o700);
  const env = { ...process.env, KIVRO_WORKER_STATE_DIR: directory };
  try {
    const paused = execFileSync(process.execPath, [command, 'pause', '--all'], { env, encoding: 'utf8' });
    assert.match(paused, /Paused new jobs locally/);
    const health = JSON.parse(execFileSync(process.execPath, [command, 'health', '--json'], { env, encoding: 'utf8' }));
    assert.equal(health.localPaused, true);
    assert.equal(health.acceptingNewJobs, false);
    assert.equal(health.overall, 'PAUSED');
    assert.equal(health.cloudSyncPending, true);
    assert.equal(health.runningJobs, 0, 'local execution table has no running job');
    const denied = spawnSync(process.execPath, [command, 'resume', '--all'], { env, encoding: 'utf8' });
    assert.equal(denied.status, 1);
    assert.match(denied.stdout, /NOT_READY/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('doctor shows critical failures and does not print local paths or secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-worker-cli-'));
  chmodSync(directory, 0o700);
  const env = { ...process.env, KIVRO_WORKER_STATE_DIR: directory, SECRET_SENTINEL: 'do-not-print-me' };
  try {
    const result = spawnSync(process.execPath, [command, 'doctor', '--json'], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.overall, 'NOT_READY');
    assert.ok(report.checks.some((check) => check.name === 'APPROVED_SANDBOX_IMAGE' && check.status === 'FAIL'));
    assert.ok(report.checks.some((check) => check.name === 'EXECUTION_CAPACITY' && check.status === 'FAIL'));
    assert.doesNotMatch(result.stdout, /do-not-print-me|kivro-worker-cli-/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('device status reports local metadata without claiming credential or cloud pairing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-worker-cli-'));
  chmodSync(directory, 0o700);
  const env = { ...process.env, KIVRO_WORKER_STATE_DIR: directory };
  try {
    const missing = JSON.parse(execFileSync(process.execPath, [command, 'device', 'status', '--json'], { env, encoding: 'utf8' }));
    assert.equal(missing.status, 'MISSING');
    assert.equal(missing.pairing, 'UNKNOWN');
    const device = new EncryptedDeviceIdentityStore(directory).create('fixture passphrase for local device');
    const found = JSON.parse(execFileSync(process.execPath, [command, 'device', 'status', '--json'], { env, encoding: 'utf8' }));
    assert.equal(found.status, 'METADATA_PRESENT');
    assert.equal(found.deviceId, device.deviceId);
    assert.equal(found.storage, 'ENCRYPTED_FILE');
    assert.equal(found.pairing, 'UNKNOWN');
    assert.doesNotMatch(JSON.stringify(found), /PRIVATE KEY|passphrase/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('destructive global job stop requires an explicit confirmation flag',()=>{
  const denied=spawnSync(process.execPath,[command,'stop','--all'],{encoding:'utf8'});
  assert.equal(denied.status,2);
  assert.match(denied.stdout,/--confirm/);
});
