import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const envPath = resolve('.env.local');
const root = resolve('.local');
const directory = resolve('.local/seaweedfs');
const configPath = resolve('.local/seaweedfs/s3.json');
const expected = {
  OBJECT_STORAGE_ENDPOINT: 'http://127.0.0.1:18333',
  KIVRO_STORAGE_ORIGIN: 'http://127.0.0.1:18333',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_BUCKET: 'kivro-local-private',
  OBJECT_STORAGE_ACCESS_KEY_ID: 'kivrolocal',
  KIVRO_CLAMAV_SOCKET: 'tcp://127.0.0.1:13310',
};

async function privateFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
    throw new Error('Local secret file is not private');
  }
}

async function privateDirectory(path) {
  await mkdir(path, { mode: 0o700 }).catch((error) => {
    if (error?.code !== 'EEXIST') throw error;
  });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
    throw new Error('Local storage directory is not private');
  }
}

await privateFile(envPath);
const contents = await readFile(envPath, 'utf8');
const values = new Map();
for (const line of contents.split('\n')) {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!match) continue;
  if (values.has(match[1])) throw new Error('Duplicate local environment key');
  values.set(match[1], match[2]);
}
const additions = [];
for (const [key, value] of Object.entries(expected)) {
  if (values.has(key) && values.get(key) !== value) throw new Error('Conflicting local storage configuration');
  if (!values.has(key)) { values.set(key, value); additions.push(`${key}=${value}`); }
}
let secret = values.get('OBJECT_STORAGE_SECRET_ACCESS_KEY');
if (secret === undefined) {
  secret = randomBytes(32).toString('hex');
  values.set('OBJECT_STORAGE_SECRET_ACCESS_KEY', secret);
  additions.push(`OBJECT_STORAGE_SECRET_ACCESS_KEY=${secret}`);
}
if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid local storage secret');
if (additions.length) {
  const file = await open(envPath, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
  try {
    await file.writeFile(`${contents.endsWith('\n') ? '' : '\n'}${additions.join('\n')}\n`);
  } finally { await file.close(); }
}
await privateDirectory(root);
await privateDirectory(directory);
const configuration = JSON.stringify({ identities: [{ name: 'kivrolocal',
  credentials: [{ accessKey: expected.OBJECT_STORAGE_ACCESS_KEY_ID, secretKey: secret }],
  actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
}] });
try {
  const file = await open(configPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try { await file.writeFile(configuration); } finally { await file.close(); }
} catch (error) {
  if (error?.code !== 'EEXIST') throw error;
  await privateFile(configPath);
  if (await readFile(configPath, 'utf8') !== configuration) {
    throw new Error('Local storage identity does not match the environment');
  }
}
process.stdout.write('Private local S3-compatible storage identity prepared.\n');
