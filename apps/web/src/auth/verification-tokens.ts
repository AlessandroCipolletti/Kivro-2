import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import { normalizeEmail } from '../../../../packages/domain/src/identity-linking.js';

export interface VerificationTokenStore {
  register(token: string, recipient: string): Promise<void>;
  consume(token: string): Promise<boolean>;
}

/** One-use registry around Better Auth's otherwise reusable signed verification JWT. */
export class PgVerificationTokenStore implements VerificationTokenStore {
  private readonly key: Buffer;

  constructor(private readonly database: Pool, key: Buffer) {
    if (key.length !== 32) throw new TypeError('Verification HMAC key must be 32 bytes');
    this.key = Buffer.from(key);
  }

  private digest(token: string): string {
    if (token.length < 16 || token.length > 4096) throw new TypeError('Invalid verification token');
    return createHmac('sha256', this.key).update('kivro:verify-email:v1\0').update(token).digest('hex');
  }

  async register(token: string, recipient: string): Promise<void> {
    const digest = this.digest(token);
    await this.database.query(
      `INSERT INTO auth_one_time_tokens(purpose, recipient, token_digest, expires_at)
       VALUES ('VERIFY_EMAIL', $1, $2, now() + interval '1 hour')
       ON CONFLICT (token_digest) DO NOTHING`,
      [normalizeEmail(recipient), digest],
    );
  }

  async consume(token: string): Promise<boolean> {
    let digest: string;
    try { digest = this.digest(token); }
    catch { return false; }
    const result = await this.database.query(
      `UPDATE auth_one_time_tokens SET consumed_at = now()
       WHERE purpose = 'VERIFY_EMAIL' AND token_digest = $1
         AND consumed_at IS NULL AND expires_at > now()
       RETURNING id`,
      [digest],
    );
    return result.rowCount === 1;
  }
}
