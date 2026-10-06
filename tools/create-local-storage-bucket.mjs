import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';
const fetch = globalThis.fetch;

const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
const bucket = process.env.OBJECT_STORAGE_BUCKET;
const region = process.env.OBJECT_STORAGE_REGION;
const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
if (endpoint !== 'http://127.0.0.1:18333' || bucket !== 'kivro-local-private' ||
  region !== 'us-east-1' || accessKeyId !== 'kivrolocal' ||
  !/^[a-f0-9]{64}$/.test(secretAccessKey ?? '')) {
  throw new Error('Local private storage configuration is incomplete');
}
const client = new S3Client({ region, endpoint, forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey } });
try {
  let ready = false;
  let lastFailure = 'not started';
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      ready = true;
      break;
    } catch (error) {
      lastFailure = `${error?.name ?? 'unknown'}:${error?.$metadata?.httpStatusCode ?? 'no-status'}`;
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        ready = true;
        break;
      } catch (createError) {
        lastFailure = `${createError?.name ?? 'unknown'}:${createError?.$metadata?.httpStatusCode ?? 'no-status'}`;
      }
    }
    await sleep(250);
  }
  if (!ready) throw new Error(`Local private storage did not become ready (${lastFailure})`);
  const anonymous = await fetch(`${endpoint}/${bucket}/private/probe`);
  if (anonymous.status !== 403) throw new Error('Local storage accepted an anonymous read');
  process.stdout.write('Private local object bucket is ready.\n');
} finally { client.destroy(); }
