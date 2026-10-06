import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DockerJobControlAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b';

test('real Docker pause freezes whole isolated job container; resume and stop verify identity', async () => {
  const jobId = randomUUID(), attemptId = randomUUID();
  const name = `kivro-m07-pause-${randomUUID()}`;
  const adapter = new DockerJobControlAdapter(docker);
  let id;
  try {
    id = execFileSync(docker, ['create', '--name', name, '--network=none', '--read-only',
      `--label=kivro.job-id=${jobId}`, `--label=kivro.attempt-id=${attemptId}`,
      image, '/bin/sh', '-c', 'sleep 120 & wait'], { encoding: 'utf8' }).trim();
    execFileSync(docker, ['start', id]);
    assert.equal(await adapter.status(id, jobId, attemptId), 'running');
    await assert.rejects(adapter.pause(id, randomUUID(), attemptId), { code: 'POLICY_MISMATCH' });
    await adapter.pause(id, jobId, attemptId);
    assert.equal(await adapter.status(id, jobId, attemptId), 'paused');
    const processes = execFileSync(docker, ['top', id, '-eo', 'pid,args'], { encoding: 'utf8' });
    assert.match(processes, /sleep 120/);
    await adapter.pause(id, jobId, attemptId);
    await adapter.resume(id, jobId, attemptId);
    assert.equal(await adapter.status(id, jobId, attemptId), 'running');
    await adapter.pause(id, jobId, attemptId);
    await adapter.stop(id, jobId, attemptId);
    assert.equal(await adapter.status(id, jobId, attemptId), 'exited');
  } finally {
    if (id) execFileSync(docker, ['rm', '-f', id], { stdio: 'ignore' });
  }
});
