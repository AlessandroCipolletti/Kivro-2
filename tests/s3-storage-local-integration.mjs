import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { S3PrivateObjectStorage } from '../dist/packages/infrastructure/s3/src/storage.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const fetch = globalThis.fetch;
const image = 'minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e';
const user = 'kivrotest';
const password = 'm05-local-temporary-password';
const bucket = 'kivro-m05-private-test';
const key = `private/assets/${randomUUID()}/${randomUUID()}`;
const bytes = Buffer.from('private Kivro fixture\n');
const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

test('real MinIO adapter stores private bytes and issues short-lived authorized URLs', async () => {
  const name = `kivro-m05-minio-${randomUUID()}`;
  execFileSync(docker, ['run', '--rm', '-d', '--name', name, '-p', '127.0.0.1::9000',
    '-e', `MINIO_ROOT_USER=${user}`, '-e', `MINIO_ROOT_PASSWORD=${password}`,
    image, 'server', '/data'], { encoding: 'utf8' });
  let storage;
  let client;
  try {
    const port = execFileSync(docker, ['port', name, '9000/tcp'], { encoding: 'utf8' }).trim().split(':').at(-1);
    const endpoint = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { if ((await fetch(`${endpoint}/minio/health/live`)).ok) { healthy = true; break; } }
      catch { /* Wait for container startup. */ }
      await sleep(100);
    }
    assert.ok(healthy, 'MinIO did not become healthy');
    const config = { region: 'us-east-1', endpoint, forcePathStyle: true,
      credentials: { accessKeyId: user, secretAccessKey: password } };
    client = new S3Client(config);
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = new S3PrivateObjectStorage({ bucket, region: 'us-east-1', endpoint,
      accessKeyId: user, secretAccessKey: password, allowInsecureLoopback: true });
    async function* body() { yield bytes; }
    await storage.putPrivateObject(key, body(), { contentType: 'text/plain', sizeBytes: bytes.length, sha256 });
    assert.deepEqual(await storage.headPrivateObject(key), { sizeBytes: bytes.length, claimedSha256: sha256 });
    const read = await storage.readPrivateObject(key);
    const chunks = [];
    for await (const chunk of read) chunks.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), bytes);
    const anonymous = await fetch(`${endpoint}/${bucket}/${key}`);
    assert.equal(anonymous.status, 403);
    const signedGet = await storage.presignPrivateDownload(key, 30);
    assert.deepEqual(Buffer.from(await (await fetch(signedGet)).arrayBuffer()), bytes);
    const tampered = new URL(signedGet);
    tampered.searchParams.set('X-Amz-Signature', '0'.repeat(64));
    assert.equal((await fetch(tampered)).status, 403);
    const uploadKey = `private/assets/${randomUUID()}/${randomUUID()}`;
    const upload = await storage.presignPrivateUpload(uploadKey,
      { contentType: 'text/plain', sizeBytes: bytes.length, sha256, expiresSeconds: 30 });
    const put = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: bytes });
    assert.ok(put.ok, `presigned upload status ${put.status}: ${(await put.text()).slice(0, 500)}`);
    assert.equal((await storage.headPrivateObject(uploadKey))?.sizeBytes, bytes.length);
    const tamperedUploadKey = `private/assets/${randomUUID()}/${randomUUID()}`;
    const tamperedUpload = await storage.presignPrivateUpload(tamperedUploadKey,
      { contentType: 'text/plain', sizeBytes: bytes.length, sha256, expiresSeconds: 30 });
    const rejected = await fetch(tamperedUpload.url, { method: 'PUT', headers: tamperedUpload.headers,
      body: Buffer.from('X'.repeat(bytes.length)) });
    assert.equal(rejected.ok, false);
    assert.equal(await storage.headPrivateObject(tamperedUploadKey), null);
    await storage.deletePrivateObject(uploadKey);
    assert.equal(await storage.headPrivateObject(uploadKey), null);
  } finally {
    storage?.destroy();
    client?.destroy();
    execFileSync(docker, ['rm', '-f', name], { stdio: 'ignore' });
  }
});
