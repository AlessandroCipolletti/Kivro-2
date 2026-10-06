import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createWorkerEnvironment, isolatedOpenClawEnvironment } from '../dist/packages/openclaw-adapter/src/worker-environment.js';

const workerId = '6381174c-2a9f-4e48-b180-b6eb954af30a';
const pinnedImage = `openclaw-sandbox@sha256:${'a'.repeat(64)}`;

test('dedicated environment starts with no seller resources or dangerous tools', () => {
  const base = mkdtempSync(join(tmpdir(), 'kivro-worker-env-'));
  chmodSync(base, 0o700);
  const personalSentinel = join(base, 'personal-openclaw.json');
  writeFileSync(personalSentinel, 'private seller credential fixture');
  try {
    const paths = createWorkerEnvironment(base, workerId, pinnedImage);
    const config = JSON.parse(readFileSync(paths.configPath, 'utf8'));
    assert.equal(config.agents.defaults.sandbox.mode, 'all');
    assert.equal(config.agents.defaults.sandbox.backend, 'docker');
    assert.equal(config.agents.defaults.sandbox.workspaceAccess, 'none');
    assert.equal(config.agents.defaults.sandbox.docker.network, 'none');
    assert.deepEqual(config.agents.defaults.sandbox.docker.capDrop, ['ALL']);
    assert.equal(config.tools.elevated.enabled, false);
    assert.deepEqual(config.tools.allow, ['read']);
    assert.ok(config.tools.deny.includes('exec'));
    assert.equal(lstatSync(paths.configPath).mode & 0o077, 0);
    assert.equal(readFileSync(personalSentinel, 'utf8'), 'private seller credential fixture');
    assert.doesNotMatch(JSON.stringify(config), /private seller credential|\.openclaw\/openclaw\.json/);
    const env = isolatedOpenClawEnvironment(paths, '/usr/bin:/bin');
    assert.equal(env.HOME, paths.workerRoot);
    assert.equal(env.OPENCLAW_STATE_DIR, paths.stateDir);
    assert.equal(env.OPENCLAW_CONFIG_PATH, paths.configPath);
    assert.equal(env.OPENCLAW_OFFLINE, '1');
    assert.equal(env.SECRET_SENTINEL, undefined);
    assert.throws(() => createWorkerEnvironment(base, workerId, pinnedImage), { code: 'ALREADY_EXISTS' });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('environment refuses mutable image tags and insecure base directories', () => {
  const base = mkdtempSync(join(tmpdir(), 'kivro-worker-env-'));
  chmodSync(base, 0o700);
  try {
    assert.throws(() => createWorkerEnvironment(base, workerId, 'openclaw-sandbox:bookworm-slim'), { code: 'UNPINNED_IMAGE' });
    chmodSync(base, 0o755);
    assert.throws(() => createWorkerEnvironment(base, workerId, pinnedImage), { code: 'INSECURE_PATH' });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
