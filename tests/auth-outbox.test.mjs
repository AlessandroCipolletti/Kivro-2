import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { PgAuthMessageOutbox } from '../dist/apps/web/src/auth/outbox.js';

class MemoryDatabase {
  rows = [];

  async query(sql, params) {
    if (sql.includes('INSERT INTO auth_email_outbox')) {
      if (!this.rows.some((row) => row.idempotency_key === params[3])) {
        this.rows.push({ id: params[0], purpose: params[1], recipient: params[2], idempotency_key: params[3],
          nonce: params[4], ciphertext: params[5], auth_tag: params[6], attempt_count: 0 });
      }
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('WITH due AS')) {
      const due = this.rows.filter((row) => !row.sent && !row.dead && !row.leased).slice(0, params[0]);
      for (const row of due) { row.leased = params[1]; row.attempt_count += 1; }
      return { rows: due, rowCount: due.length };
    }
    const row = this.rows.find((item) => item.id === params[0] && item.leased === params[1]);
    if (!row) return { rows: [], rowCount: 0 };
    if (sql.includes('SET sent_at')) row.sent = true;
    else if (sql.includes('SET dead_at')) row.dead = true;
    else if (sql.includes('SET lease_id')) row.retried = true;
    row.leased = undefined;
    return { rows: [], rowCount: 1 };
  }
}

test('auth outbox encrypts bearer URL, deduplicates enqueue and delivers once', async () => {
  const database = new MemoryDatabase();
  const outbox = new PgAuthMessageOutbox(database, randomBytes(32), 'https://kivro.example');
  const message = { purpose: 'VERIFY_EMAIL', recipient: 'BUYER@example.test',
    url: 'https://kivro.example/api/auth/verify-email?token=private-token' };
  await outbox.enqueue(message);
  await outbox.enqueue(message);
  assert.equal(database.rows.length, 1);
  const stored = database.rows[0];
  assert.equal(stored.recipient, 'buyer@example.test');
  assert.doesNotMatch(stored.ciphertext.toString('utf8'), /private-token/);
  assert.doesNotMatch(JSON.stringify({ ...stored, nonce: undefined, ciphertext: undefined, auth_tag: undefined }), /private-token/);
  const delivered = [];
  assert.deepEqual(await outbox.deliverDue({ async send(item) { delivered.push(item); } }),
    { claimed: 1, sent: 1, retried: 0, dead: 0 });
  assert.deepEqual(delivered, [{ ...message, recipient: 'buyer@example.test' }]);
  assert.equal(stored.sent, true);
  assert.deepEqual(await outbox.deliverDue({ async send() { throw new Error('unexpected'); } }),
    { claimed: 0, sent: 0, retried: 0, dead: 0 });
});

test('outbox fails closed on tampered ciphertext and never sends an untrusted URL', async () => {
  const database = new MemoryDatabase();
  const outbox = new PgAuthMessageOutbox(database, randomBytes(32), 'https://kivro.example');
  await outbox.enqueue({ purpose: 'RESET_PASSWORD', recipient: 'buyer@example.test',
    url: 'https://kivro.example/reset?token=private' });
  database.rows[0].auth_tag[0] ^= 1;
  const result = await outbox.deliverDue({ async send() { throw new Error('must not send'); } });
  assert.deepEqual(result, { claimed: 1, sent: 0, retried: 0, dead: 1 });
  assert.equal(database.rows[0].dead, true);
});

test('transport failure leaves a retryable message and external reset links are rejected', async () => {
  const database = new MemoryDatabase();
  const outbox = new PgAuthMessageOutbox(database, randomBytes(32), 'https://kivro.example');
  await assert.rejects(outbox.enqueue({ purpose: 'RESET_PASSWORD', recipient: 'buyer@example.test',
    url: 'https://attacker.example/reset?token=private' }), TypeError);
  await outbox.enqueue({ purpose: 'RESET_PASSWORD', recipient: 'buyer@example.test',
    url: 'https://kivro.example/reset?token=private' });
  const result = await outbox.deliverDue({ async send() { throw new Error('SMTP offline'); } });
  assert.deepEqual(result, { claimed: 1, sent: 0, retried: 1, dead: 0 });
  assert.equal(database.rows[0].retried, true);
});
