import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { createWorkerEnvironment, isolatedOpenClawEnvironment } from '../dist/packages/openclaw-adapter/src/worker-environment.js';

const base = mkdtempSync(join(tmpdir(), 'kivro-openclaw-isolated-test-'));
chmodSync(base, 0o700);
try {
  const paths = createWorkerEnvironment(base, '6381174c-2a9f-4e48-b180-b6eb954af30a', `openclaw-sandbox@sha256:${'a'.repeat(64)}`);
  const result = execFileSync('openclaw', ['config', 'validate', '--json'], {
    cwd: paths.workerRoot,
    env: isolatedOpenClawEnvironment(paths, process.env.PATH ?? '/usr/bin:/bin'),
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const parsed = JSON.parse(result);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.path, paths.configPath);
  process.stdout.write('Isolated OpenClaw config validated; seller personal state was not selected.\n');
} finally {
  rmSync(base, { recursive: true, force: true });
}
