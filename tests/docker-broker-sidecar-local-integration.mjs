import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import test from 'node:test';
import { BrokerSidecar } from '../dist/apps/worker/src/broker-sidecar.js';
import { DockerJobControlAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'kivro-openclaw-runtime:m07';
const execFileAsync = promisify(execFile);

test('offline sandbox reaches only the authenticated Worker broker sidecar', async () => {
  const jobId = randomUUID(), attemptId = randomUUID();
  const id = execFileSync(docker, ['create', '--pull=never', '--network=none', '--read-only',
    '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--security-opt=seccomp=builtin',
    '--user=65532:65532', '--pids-limit=32', '--memory=256m', '--cpus=1',
    `--label=kivro.job-id=${jobId}`, `--label=kivro.attempt-id=${attemptId}`,
    '--entrypoint=/bin/sleep', image, '60'], { encoding: 'utf8' }).trim();
  const control = new DockerJobControlAdapter(docker);
  let permitted = true, calls = 0;
  const sidecar = new BrokerSidecar(docker, control, jobId, attemptId,
    async () => { if (!permitted) throw new Error('LEASE_OR_JOB_NOT_ACTIVE'); },
    async (request) => {
      calls++;
      assert.equal(request.kind, 'RESEARCH_SEARCH');
      return { results: [{ title: 'bounded' }] };
    });
  try {
    execFileSync(docker, ['start', id]);
    await sidecar.start(id);
    assert.equal(sidecar.healthy, true);
    const invoke = `fetch('http://127.0.0.1:8787/broker/research/search', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'public'})}).then(async r=>console.log(JSON.stringify({status:r.status,body:await r.json()})))`;
    const first = JSON.parse((await execFileAsync(docker, ['exec', id, 'node', '-e', invoke],
      { encoding: 'utf8', timeout: 10_000 })).stdout);
    assert.equal(first.status, 200);
    assert.equal(first.body.results[0].title, 'bounded');
    permitted = false;
    const denied = JSON.parse((await execFileAsync(docker, ['exec', id, 'node', '-e', invoke],
      { encoding: 'utf8', timeout: 10_000 })).stdout);
    assert.equal(denied.status, 403);
    assert.equal(calls, 1);
    const internet = execFileSync(docker, ['exec', id, 'node', '-e',
      `fetch('https://example.com',{signal:AbortSignal.timeout(1000)}).then(()=>process.stdout.write('LEAK'),()=>process.stdout.write('DENIED'))`],
      { encoding: 'utf8', timeout: 5_000 });
    assert.equal(internet, 'DENIED');
  } finally {
    await sidecar.close();
    execFileSync(docker, ['rm', '-f', id]);
  }
});
