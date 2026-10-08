import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DockerSandboxAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b';
const plan = { planVersion: 1, image, networkMode: 'none', readOnlyRoot: true,
  capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin', runAs: '65532:65532',
  maxRuntimeSeconds: 5, memoryMb: 128, cpu: 1, maxPids: 32, maxOutputBytes: 4096 };
const contract = { schemaVersion: 1, fields: [
  { key: 'message', label: 'Message', order: 0, required: true, type: 'SHORT_TEXT' },
  { key: 'file', label: 'File', order: 1, required: true, type: 'FILE', constraints: {
    maxFiles: 1, maxFileSizeBytes: 1024, maxTotalSizeBytes: 1024,
    allowedMimeTypes: ['text/plain'], allowedExtensions: ['.txt'],
  } },
] };

function inventory() {
  return {
    sandboxes: execFileSync(docker, ['ps', '-a', '--filter', 'name=kivro-sbx-', '--format', '{{.Names}}'],
      { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort(),
    collectors: execFileSync(docker, ['ps', '-a', '--filter', 'name=kivro-collector-', '--format', '{{.Names}}'],
      { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort(),
    volumes: execFileSync(docker, ['volume', 'ls', '--filter', 'name=kivro-output-', '--format', '{{.Name}}'],
      { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort(),
  };
}

test('real Docker transfers bounded stopped output, validates it and cleans up all transient resources', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-delivery-'));
  const attemptId = randomUUID();
  mkdirSync(join(root, attemptId, 'input'), { recursive: true, mode: 0o700 });
  const before = inventory();
  try {
    const adapter = new DockerSandboxAdapter({ dockerExecutable: docker,
      approvedImage: image, collectorImage: image, attemptRoot: root });
    let consumed = false;
    const command = 'printf \'{"schemaVersion":1,"fields":{"message":{"type":"SHORT_TEXT","value":"ok"},' +
      '"file":{"type":"FILE","path":"note.txt"}}}\' > /job/output/result.json; ' +
      'printf hello > /job/output/note.txt';
    const result = await adapter.runWithOutput(plan, attemptId, ['/bin/sh', '-c', command], contract,
      { maxFileBytes: 1024, maxResultBytes: 4096 }, async (collected, outputRoot) => {
        assert.equal(collected.values.message, 'ok');
        assert.equal(collected.files.length, 1);
        assert.equal(collected.files[0].detectedMimeType, 'text/plain');
        assert.equal(readFileSync(join(outputRoot, 'note.txt'), 'utf8'), 'hello');
        consumed = true;
      });
    assert.equal(result.exitCode, 0);
    assert.equal(consumed, true);
    assert.equal(existsSync(join(root, attemptId, 'output')), false);
    assert.deepEqual(inventory(), before);

    const hostileStderr='PRIVATE_BUYER_CONTENT_MUST_NOT_BE_LOGGED';
    await assert.rejects(adapter.runWithOutput(plan,attemptId,
      ['/bin/sh','-c',`printf '${hostileStderr}' >&2; exit 17`],contract,
      {maxFileBytes:1024,maxResultBytes:4096},async()=>{
        throw new Error('failed execution cannot deliver output');
      }),error=>{
      assert.equal(error.code,'EXECUTION_FAILED');
      assert.equal(error.diagnostic?.exitCode,17);
      assert.equal(error.diagnostic?.stderrBytes,hostileStderr.length);
      assert.match(error.diagnostic?.stderrSha256??'',/^sha256:[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(error).includes(hostileStderr),false,
        'untrusted OpenClaw stderr must not enter the structured diagnostic');
      return true;
    });
    assert.deepEqual(inventory(),before,'a failed process leaves no sandbox resources');

    const unsafe = 'printf \'{"schemaVersion":1,"fields":{"message":{"type":"SHORT_TEXT","value":"ok"},' +
      '"file":{"type":"FILE","path":"note.txt"}}}\' > /job/output/result.json; ' +
      'ln -s /etc/passwd /job/output/note.txt';
    await assert.rejects(adapter.runWithOutput(plan, attemptId, ['/bin/sh', '-c', unsafe], contract,
      { maxFileBytes: 1024, maxResultBytes: 4096 }, async () => { throw new Error('must not consume'); }));
    assert.equal(existsSync(join(root, attemptId, 'output')), false);
    assert.deepEqual(inventory(), before);

    const sparse = 'printf \'{"schemaVersion":1,"fields":{"message":{"type":"SHORT_TEXT","value":"ok"},' +
      '"file":{"type":"FILE","path":"huge.txt"}}}\' > /job/output/result.json; ' +
      'truncate -s 104857600 /job/output/huge.txt';
    await assert.rejects(adapter.runWithOutput(plan, attemptId, ['/bin/sh', '-c', sparse], contract,
      { maxFileBytes: 1024, maxResultBytes: 4096 }, async () => { throw new Error('must not consume'); }),
    { code: 'LIMIT_EXCEEDED' });
    assert.equal(existsSync(join(root, attemptId, 'output')), false);
    assert.deepEqual(inventory(), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
