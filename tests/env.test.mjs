import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('checked-in environment example documents every value and contains only example secrets', () => {
  const lines = readFileSync(join(root, '.env.example'), 'utf8').split(/\r?\n/);
  const values = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.+)$/.exec(line);
    assert.ok(match, `Invalid example entry on line ${index + 1}`);
    assert.ok(lines[index - 1]?.startsWith('#'), `Missing explanation for ${match[1]}`);
    assert.equal(values.has(match[1]), false, `Duplicate example key ${match[1]}`);
    values.set(match[1], match[2]);
  }
  assert.ok(values.size > 0);
  for (const key of ['KIVRO_LOCAL_DB_PASSWORD', 'DATABASE_URL',
    'OBJECT_STORAGE_SECRET_ACCESS_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'SESSION_SECRET', 'BETTER_AUTH_SECRET', 'AUTH_OUTBOX_KEY_BASE64', 'SMTP_PASSWORD']) {
    assert.match(values.get(key), /replace-me/, `Expected a non-secret placeholder for ${key}`);
  }
  assert.equal(values.get('STRIPE_SECRET_KEY'), 'sk_test_replace_me');
  assert.equal(values.get('STRIPE_WEBHOOK_SECRET'), 'whsec_replace_me');
  assert.equal(values.get('WORKER_DISCOVERY_URL'), 'https://discovery.example.invalid');
  assert.equal(values.get('NODE_ENV'), 'development');
  assert.equal(values.get('APP_ORIGIN'), 'http://localhost:3000');
});
