import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { S3PrivateObjectStorage } from '../dist/packages/infrastructure/s3/src/storage.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'chrislusf/seaweedfs@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d';
const fetch = globalThis.fetch;

test('portable pinned SeaweedFS S3 profile denies anonymous reads and preserves signed transfers', async () => {
  const name = `kivro-m05-seaweed-${randomUUID()}`;
  const root = mkdtempSync(join(tmpdir(), 'kivro-seaweed-'));
  const configPath = join(root, 's3.json');
  const user = 'kivrotest';
  const password = 'm05-local-temporary-password';
  writeFileSync(configPath, JSON.stringify({ identities: [{ name: user,
    credentials: [{ accessKey: user, secretKey: password }],
    actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
  }] }), { mode: 0o600 });
  execFileSync(docker, ['run', '--rm', '-d', '--name', name, '-p', '127.0.0.1::8333',
    '--mount', `type=bind,source=${configPath},target=/etc/seaweedfs/s3.json,readonly`,
    image, 'server', '-dir=/data', '-s3', '-s3.config=/etc/seaweedfs/s3.json',
    '-volume.max=0', '-master.volumeSizeLimitMB=100'], { encoding: 'utf8' });
  let storage;
  let client;
  try {
    const port = execFileSync(docker, ['port', name, '8333/tcp'], { encoding: 'utf8' }).trim().split(':').at(-1);
    const endpoint = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { if ((await fetch(endpoint)).status > 0) { healthy = true; break; } }
      catch { /* Wait for startup. */ }
      await sleep(100);
    }
    assert.ok(healthy, 'SeaweedFS did not become ready');
    const credentials = { accessKeyId: user, secretAccessKey: password };
    client = new S3Client({ region: 'us-east-1', endpoint, forcePathStyle: true, credentials });
    const bucket = 'kivro-m05-seaweed-test';
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = new S3PrivateObjectStorage({ bucket, region: 'us-east-1', endpoint,
      accessKeyId: user, secretAccessKey: password, allowInsecureLoopback: true });
    const key = `private/assets/${randomUUID()}/${randomUUID()}`;
    const bytes = Buffer.from('private Kivro fixture\n');
    const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    async function* body() { yield bytes; }
    await storage.putPrivateObject(key, body(), { contentType: 'text/plain', sizeBytes: bytes.length, sha256 });
    assert.equal((await storage.headPrivateObject(key))?.sizeBytes, bytes.length);
    assert.equal((await fetch(`${endpoint}/${bucket}/${key}`)).status, 403);
    const signedGet = await storage.presignPrivateDownload(key, 30);
    assert.deepEqual(Buffer.from(await (await fetch(signedGet)).arrayBuffer()), bytes);
    const uploadKey = `private/assets/${randomUUID()}/${randomUUID()}`;
    const signedPut = await storage.presignPrivateUpload(uploadKey,
      { contentType: 'text/plain', sizeBytes: bytes.length, sha256, expiresSeconds: 30 });
    const uploaded = await fetch(signedPut.url, { method: 'PUT', headers: signedPut.headers, body: bytes });
    assert.ok(uploaded.ok, `SeaweedFS signed PUT status ${uploaded.status}`);
    assert.equal((await storage.headPrivateObject(uploadKey))?.sizeBytes, bytes.length);
    const tampered = await fetch(signedPut.url, { method: 'PUT', headers: signedPut.headers,
      body: Buffer.from('X'.repeat(bytes.length)) });
    assert.equal(tampered.ok, false);
  } finally {
    storage?.destroy(); client?.destroy();
    execFileSync(docker, ['rm', '-f', name], { stdio: 'ignore' });
    rmSync(root, { recursive: true, force: true });
  }
});
