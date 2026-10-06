import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { open, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const path = resolve('.env.local');
const dbPassword = randomBytes(24).toString('hex');
const authSecret = randomBytes(48).toString('base64');
const outboxKey = randomBytes(32).toString('base64');
const financeCronSecret = randomBytes(32).toString('hex');
const contents = [
  '# Local development only. Never use these credentials for a hosted profile.',
  'NODE_ENV=development',
  'APP_ORIGIN=http://localhost:3000',
  `KIVRO_LOCAL_DB_PASSWORD=${dbPassword}`,
  `DATABASE_URL=postgresql://kivro:${dbPassword}@127.0.0.1:15432/kivro`,
  `BETTER_AUTH_SECRET=${authSecret}`,
  `AUTH_OUTBOX_KEY_BASE64=${outboxKey}`,
  'KIVRO_STRIPE_MODE=test',
  `FINANCE_CRON_SECRET=${financeCronSecret}`,
  'SMTP_HOST=127.0.0.1',
  'SMTP_PORT=11025',
  'SMTP_FROM="Kivro Dev <no-reply@kivro.local>"',
  'SMTP_SECURITY=LOCAL_PLAINTEXT',
  'GOOGLE_CLIENT_ID=',
  'GOOGLE_CLIENT_SECRET=',
  '',
].join('\n');

try {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try { await file.writeFile(contents); }
  finally { await file.close(); }
  process.stdout.write('Created private .env.local for Kivro auth development.\n');
} catch (error) {
  if (error?.code !== 'EEXIST') throw error;
  process.stdout.write('Existing .env.local kept unchanged.\n');
}

try {
  await symlink('../../.env.local', resolve('apps/web/.env.local'));
  process.stdout.write('Linked the web app to the local auth environment.\n');
} catch (error) {
  if (error?.code !== 'EEXIST') throw error;
}
