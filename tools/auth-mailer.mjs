import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { getAuthService } from '../dist/apps/web/src/auth/server.js';
import { createSmtpAuthTransport } from '../dist/apps/web/src/auth/smtp-transport.js';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required mail configuration: ${name}`);
  return value;
}

const service = getAuthService();
const transport = createSmtpAuthTransport({
  host: required('SMTP_HOST'),
  port: Number(required('SMTP_PORT')),
  from: required('SMTP_FROM'),
  security: required('SMTP_SECURITY'),
  ...(process.env.SMTP_USERNAME ? { username: process.env.SMTP_USERNAME } : {}),
  ...(process.env.SMTP_PASSWORD ? { password: process.env.SMTP_PASSWORD } : {}),
  production: process.env.NODE_ENV === 'production',
});

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

try {
  do {
    const result = await service.outbox.deliverDue(transport);
    process.stdout.write(`auth-mailer claimed=${result.claimed} sent=${result.sent} retried=${result.retried} dead=${result.dead}\n`);
    if (process.argv.includes('--once')) break;
    await delay(5000);
  } while (!stopping);
} finally {
  await service.database.end();
}
