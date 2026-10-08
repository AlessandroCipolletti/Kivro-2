import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DockerSandboxAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b';
const plan = Object.freeze({ planVersion: 1, image, networkMode: 'none', readOnlyRoot: true,
  capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin', runAs: '65532:65532',
  maxRuntimeSeconds: 5, memoryMb: 128, cpu: 1, maxPids: 32, maxOutputBytes: 4096 });

function containersForAttempt(attemptId) {
  const ids=execFileSync(docker,['ps','-a','--filter','name=kivro-sbx-',
    '--format','{{.ID}}'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  return ids.filter((id)=>{
    const details=JSON.parse(execFileSync(docker,['inspect',id],{encoding:'utf8'}))[0];
    return details.Mounts?.some((mount)=>mount.Source?.includes(attemptId));
  }).sort();
}

test('real Docker sandbox enforces offline isolation and cleans up', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-sandbox-'));
  const attemptId = randomUUID();
  const input = join(root, attemptId, 'input');
  mkdirSync(input, { recursive: true, mode: 0o700 });
  const hostSentinel = join(root, 'personal-secret');
  writeFileSync(hostSentinel, 'PRIVATE HOST SENTINEL', { mode: 0o600 });
  try {
    const adapter = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image, attemptRoot: root });
    const result = await adapter.run(plan, attemptId, ['/bin/sh', '-c',
      'id -u; id -g; test ! -e /var/run/docker.sock && echo NO_SOCKET; ' +
      'test ! -e /root/.openclaw && echo NO_PERSONAL_OPENCLAW; ' +
      'if touch /etc/kivro-escape 2>/dev/null; then echo ROOT_WRITABLE; else echo ROOT_READONLY; fi; ' +
      'if touch /job/input/escape 2>/dev/null; then echo INPUT_WRITABLE; else echo INPUT_READONLY; fi; ' +
      'if test -e /job/metadata; then echo METADATA_VISIBLE; else echo METADATA_HIDDEN; fi; ' +
      'touch /job/work/ephemeral && echo WORK_WRITABLE; ' +
      `if test -e ${hostSentinel}; then echo HOST_VISIBLE; else echo HOST_HIDDEN; fi; ` +
      "grep '^CapEff:[[:space:]]*0000000000000000' /proc/self/status >/dev/null && echo NO_CAPABILITIES; " +
      "grep '^NoNewPrivs:[[:space:]]*1' /proc/self/status >/dev/null && echo NO_NEW_PRIVILEGES; " +
      'for target in 1.1.1.1 127.0.0.1 192.168.1.1 169.254.169.254; do ' +
      'if wget -q -T 1 -O /dev/null "http://$target/" 2>/dev/null; then ' +
      'echo NETWORK_OPEN_$target; else echo NETWORK_BLOCKED_$target; fi; done; ' +
      'touch /job/output/created && echo OUTPUT_WRITABLE']);
    assert.equal(result.exitCode, 0, result.stderr);
    for (const marker of ['65532\n65532', 'NO_SOCKET', 'NO_PERSONAL_OPENCLAW', 'ROOT_READONLY',
      'INPUT_READONLY', 'METADATA_HIDDEN', 'WORK_WRITABLE', 'HOST_HIDDEN',
      'NO_CAPABILITIES', 'NO_NEW_PRIVILEGES',
      'NETWORK_BLOCKED_1.1.1.1', 'NETWORK_BLOCKED_127.0.0.1',
      'NETWORK_BLOCKED_192.168.1.1', 'NETWORK_BLOCKED_169.254.169.254',
      'OUTPUT_WRITABLE']) {
      assert.ok(result.stdout.includes(marker), `missing ${marker}: ${result.stdout}`);
    }
    assert.ok(!result.stdout.includes('ROOT_WRITABLE'));
    assert.ok(!result.stdout.includes('NETWORK_OPEN'));
    await assert.rejects(adapter.run(plan, attemptId, ['/bin/sh', '-c', 'sleep 5']), { code: 'TIMED_OUT' });
    await assert.rejects(adapter.run({ ...plan, image: `alpine@sha256:${'a'.repeat(64)}` },
      attemptId, ['/bin/true']), { code: 'IMAGE_UNAPPROVED' });
    const missingImage = `alpine@sha256:${'a'.repeat(64)}`;
    const missingAdapter = new DockerSandboxAdapter({ dockerExecutable: docker,
      approvedImage: missingImage, attemptRoot: root });
    await assert.rejects(missingAdapter.run({ ...plan, image: missingImage }, attemptId,
      ['/bin/true']), { code: 'IMAGE_UNAVAILABLE' });
    const noDocker = new DockerSandboxAdapter({ dockerExecutable: '/does/not/exist/docker',
      approvedImage: image, attemptRoot: root });
    await assert.rejects(noDocker.run(plan, attemptId, ['/bin/true']), { code: 'DOCKER_UNAVAILABLE' });
    assert.deepEqual(containersForAttempt(attemptId), [],
      'this attempt must leave no sandbox container even when other tests run');
    const unsafeAttempt = randomUUID();
    symlinkSync(input, join(root, unsafeAttempt));
    await assert.rejects(adapter.run(plan, unsafeAttempt, ['/bin/true']), { code: 'INSECURE_INPUT' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
