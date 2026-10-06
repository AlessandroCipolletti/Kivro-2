import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { normalizeEmail } from '../../../../packages/domain/src/identity-linking.js';
import type { AuthMessage, AuthMessageOutbox } from './options.js';

interface ClaimedMessage {
  readonly id: string;
  readonly purpose: AuthMessage['purpose'];
  readonly recipient: string;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly auth_tag: Buffer;
  readonly attempt_count: number;
}

export interface AuthEmailTransport {
  /** Must either settle or time out within the outbox lease (120 seconds). */
  send(message: AuthMessage): Promise<void>;
}

export interface DeliverySummary {
  readonly claimed: number;
  readonly sent: number;
  readonly retried: number;
  readonly dead: number;
}

class OutboxIntegrityError extends Error {
  constructor() { super('Auth outbox ciphertext failed integrity validation'); }
}

/** PostgreSQL outbox with AES-GCM token URL storage and lease-safe delivery. */
export class PgAuthMessageOutbox implements AuthMessageOutbox {
  private readonly key: Buffer;
  private readonly origin: string;

  constructor(private readonly database: Pool, key: Buffer, baseURL: string) {
    if (key.length !== 32) throw new TypeError('Auth outbox key must be 32 bytes');
    this.key = Buffer.from(key);
    this.origin = new URL(baseURL).origin;
  }

  async enqueue(message: AuthMessage): Promise<void> {
    const recipient = normalizeEmail(message.recipient);
    const url = new URL(message.url);
    if (url.origin !== this.origin || url.username || url.password || Buffer.byteLength(message.url) > 4096) {
      throw new TypeError('Auth message URL is not an allowed local origin');
    }
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(`${message.purpose}\0${recipient}`));
    const ciphertext = Buffer.concat([cipher.update(message.url, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const idempotencyKey = createHmac('sha256', this.key)
      .update(`${message.purpose}\0${recipient}\0${message.url}`).digest('hex');
    await this.database.query(
      `INSERT INTO auth_email_outbox
       (id, purpose, recipient, idempotency_key, nonce, ciphertext, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [randomUUID(), message.purpose, recipient, idempotencyKey, nonce, ciphertext, authTag],
    );
  }

  async deliverDue(transport: AuthEmailTransport, limit = 10): Promise<DeliverySummary> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Invalid outbox batch size');
    const leaseId = randomUUID();
    const claimed = await this.database.query<ClaimedMessage>(
      `WITH due AS (
         SELECT id FROM auth_email_outbox
         WHERE sent_at IS NULL AND dead_at IS NULL AND next_attempt_at <= now()
           AND (lease_until IS NULL OR lease_until < now())
         ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE auth_email_outbox AS message
       SET lease_id = $2, lease_until = now() + interval '120 seconds',
           attempt_count = message.attempt_count + 1
       FROM due WHERE message.id = due.id
       RETURNING message.id, message.purpose, message.recipient, message.nonce,
         message.ciphertext, message.auth_tag, message.attempt_count`,
      [limit, leaseId],
    );
    let sent = 0;
    let retried = 0;
    let dead = 0;
    for (const row of claimed.rows) {
      try {
        const url = this.decrypt(row);
        await transport.send({ purpose: row.purpose, recipient: row.recipient, url });
        await this.database.query(
          `UPDATE auth_email_outbox SET sent_at = now(), lease_id = NULL, lease_until = NULL,
             ciphertext = $3, nonce = $4, auth_tag = $5
           WHERE id = $1 AND lease_id = $2 AND sent_at IS NULL`,
          [row.id, leaseId, Buffer.from([0]), randomBytes(12), randomBytes(16)],
        );
        sent += 1;
      } catch (error) {
        if (error instanceof OutboxIntegrityError || row.attempt_count >= 12) {
          await this.database.query(
            `UPDATE auth_email_outbox SET dead_at = now(), lease_id = NULL, lease_until = NULL,
               ciphertext = $3, nonce = $4, auth_tag = $5
             WHERE id = $1 AND lease_id = $2 AND sent_at IS NULL`,
            [row.id, leaseId, Buffer.from([0]), randomBytes(12), randomBytes(16)],
          );
          dead += 1;
        } else {
          const delaySeconds = Math.min(3600, 2 ** Math.min(row.attempt_count, 11));
          await this.database.query(
            `UPDATE auth_email_outbox SET lease_id = NULL, lease_until = NULL,
               next_attempt_at = now() + ($3 * interval '1 second')
             WHERE id = $1 AND lease_id = $2 AND sent_at IS NULL`,
            [row.id, leaseId, delaySeconds],
          );
          retried += 1;
        }
      }
    }
    return { claimed: claimed.rows.length, sent, retried, dead };
  }

  private decrypt(row: ClaimedMessage): string {
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, row.nonce);
      decipher.setAAD(Buffer.from(`${row.purpose}\0${row.recipient}`));
      decipher.setAuthTag(row.auth_tag);
      const url = Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');
      if (new URL(url).origin !== this.origin) throw new OutboxIntegrityError();
      return url;
    } catch {
      throw new OutboxIntegrityError();
    }
  }
}
