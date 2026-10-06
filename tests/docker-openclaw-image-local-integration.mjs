import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DockerSandboxAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';

test('repository-built OpenClaw image starts inside the effective offline job sandbox', async () => {
  const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
  const digests = JSON.parse(execFileSync(docker,
    ['image', 'inspect', 'kivro-openclaw-runtime:m07', '--format', '{{json .RepoDigests}}'],
    { encoding: 'utf8' }));
  const image = digests.find((value) => value.startsWith('kivro-openclaw-runtime@sha256:'));
  assert.ok(image, 'A digest-pinned repository build is required');
  const root = mkdtempSync(join(tmpdir(), 'kivro-openclaw-sbx-'));
  const attemptId = randomUUID();
  mkdirSync(join(root, attemptId, 'input'), { recursive: true, mode: 0o700 });
  try {
    const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
      attemptRoot: root });
    const result = await sandbox.run({ planVersion: 1, image, networkMode: 'none',
      readOnlyRoot: true, capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin',
      runAs: '65532:65532', maxRuntimeSeconds: 30, memoryMb: 512, cpu: 1,
      maxPids: 64, maxOutputBytes: 1024 }, attemptId, ['--version']);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /^OpenClaw 2026\.8\.2\b/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
