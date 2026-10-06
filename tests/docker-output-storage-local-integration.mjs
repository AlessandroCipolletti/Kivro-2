import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { uploadValidatedOutput } from '../dist/apps/worker/src/output-upload.js';
import { withStagedBuyerInputs } from '../dist/apps/worker/src/input-staging.js';
import { DockerSandboxAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';
import { S3PrivateObjectStorage } from '../dist/packages/infrastructure/s3/src/storage.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const fetch = globalThis.fetch;
const sandboxImage = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b';
const storageImage = 'minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e';
const contract = { schemaVersion: 1, fields: [
  { key: 'message', label: 'Message', order: 0, required: true, type: 'SHORT_TEXT' },
  { key: 'file', label: 'File', order: 1, required: true, type: 'FILE', constraints: {
    maxFiles: 1, maxFileSizeBytes: 1024, maxTotalSizeBytes: 1024,
    allowedMimeTypes: ['text/plain'], allowedExtensions: ['.txt'],
  } },
] };

test('real Docker output and Worker input pass through private S3-compatible storage', async () => {
  const minioName = `kivro-m05-storage-${randomUUID()}`;
  const root = mkdtempSync(join(tmpdir(), 'kivro-output-storage-'));
  const attemptId = randomUUID();
  mkdirSync(join(root, attemptId, 'input'), { recursive: true, mode: 0o700 });
  const user = 'kivrotest';
  const password = 'm05-local-temporary-password';
  const bucket = 'kivro-m05-output-test';
  let client;
  let storage;
  execFileSync(docker, ['run', '--rm', '-d', '--name', minioName, '-p', '127.0.0.1::9000',
    '-e', `MINIO_ROOT_USER=${user}`, '-e', `MINIO_ROOT_PASSWORD=${password}`,
    storageImage, 'server', '/data'], { encoding: 'utf8' });
  try {
    const port = execFileSync(docker, ['port', minioName, '9000/tcp'], { encoding: 'utf8' }).trim().split(':').at(-1);
    const endpoint = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { if ((await fetch(`${endpoint}/minio/health/live`)).ok) { healthy = true; break; } }
      catch { /* Wait for test storage. */ }
      await sleep(100);
    }
    assert.ok(healthy, 'MinIO did not become healthy');
    client = new S3Client({ region: 'us-east-1', endpoint, forcePathStyle: true,
      credentials: { accessKeyId: user, secretAccessKey: password } });
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = new S3PrivateObjectStorage({ bucket, region: 'us-east-1', endpoint,
      accessKeyId: user, secretAccessKey: password, allowInsecureLoopback: true });
    const adapter = new DockerSandboxAdapter({ dockerExecutable: docker,
      approvedImage: sandboxImage, collectorImage: sandboxImage, attemptRoot: root });
    const plan = { planVersion: 1, image: sandboxImage, networkMode: 'none', readOnlyRoot: true,
      capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin', runAs: '65532:65532',
      maxRuntimeSeconds: 5, memoryMb: 128, cpu: 1, maxPids: 32, maxOutputBytes: 4096 };
    const command = 'printf \'{"schemaVersion":1,"fields":{"message":{"type":"SHORT_TEXT","value":"ok"},' +
      '"file":{"type":"FILE","path":"note.txt"}}}\' > /job/output/result.json; ' +
      'printf hello > /job/output/note.txt';
    let uploaded;
    await adapter.runWithOutput(plan, attemptId, ['/bin/sh', '-c', command], contract,
      { maxFileBytes: 1024, maxResultBytes: 4096 }, async (collected, outputRoot) => {
        uploaded = await uploadValidatedOutput(storage, { ownerAccountId: randomUUID(),
          sourceJobId: randomUUID(), retainUntil: new Date(Date.now() + 86_400_000).toISOString(),
          maxTotalBytes: 4096, outputRoot, outputContract: contract, collected });
      });
    assert.equal(existsSync(join(root, attemptId, 'output')), false);
    assert.equal(uploaded.assets.length, 1);
    assert.equal(uploaded.payload.values.message, 'ok');
    const asset = uploaded.assets[0];
    assert.equal(asset.sizeBytes, 5);
    assert.equal((await fetch(`${endpoint}/${bucket}/${asset.objectKey}`)).status, 403);
    const signed = await storage.presignPrivateDownload(asset.objectKey, 30);
    assert.deepEqual(Buffer.from(await (await fetch(signed)).arrayBuffer()), Buffer.from('hello'));
    const nextAttemptId = randomUUID();
    await withStagedBuyerInputs({ attemptRoot: root, attemptId: nextAttemptId,
      storageOrigin: endpoint, allowInsecureLoopback: true, maxFileBytes: 1024,
      maxTotalBytes: 4096, timeoutMs: 5000, downloads: [{
        binding: { fieldKey: 'source', assetId: asset.id,
          path: `/job/input/source/${asset.id}.txt`, detectedMimeType: 'text/plain',
          sizeBytes: asset.sizeBytes },
        signedGetUrl: signed, expectedSha256: asset.sha256,
      }] }, async () => {
      const readBack = await adapter.run(plan, nextAttemptId,
        ['/bin/cat', `/job/input/source/${asset.id}.txt`]);
      assert.equal(readBack.exitCode, 0);
      assert.equal(readBack.stdout, 'hello');
    });
    assert.equal(existsSync(join(root, nextAttemptId)), false);
  } finally {
    storage?.destroy();
    client?.destroy();
    execFileSync(docker, ['rm', '-f', minioName], { stdio: 'ignore' });
    rmSync(root, { recursive: true, force: true });
  }
});
