import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { createAuthOptions, type GoogleIdentityConfig } from './options.js';
import { PgAuthMessageOutbox } from './outbox.js';
import { PgVerificationTokenStore } from './verification-tokens.js';
import { PgAuthAudit } from './audit.js';

export interface AuthService {
  readonly auth: ReturnType<typeof betterAuth>;
  readonly outbox: PgAuthMessageOutbox;
  readonly verificationTokens: PgVerificationTokenStore;
  readonly audit: PgAuthAudit;
  readonly database: Pool;
}

let cached: AuthService | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required auth configuration: ${name}`);
  return value;
}

function googleIdentity(): GoogleIdentityConfig | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId && !clientSecret) {
    if (process.env.NODE_ENV === 'production') throw new Error('Google identity configuration is required in production');
    return undefined;
  }
  if (!clientId || !clientSecret) throw new Error('Google identity configuration is incomplete');
  return { clientId, clientSecret };
}

/** No fallback development secrets or memory auth path. */
export function getAuthService(): AuthService {
  if (cached) return cached;
  const databaseUrl = required('DATABASE_URL');
  const baseURL = required('APP_ORIGIN');
  const secret = required('BETTER_AUTH_SECRET');
  const key = Buffer.from(required('AUTH_OUTBOX_KEY_BASE64'), 'base64');
  if (key.length !== 32) throw new Error('AUTH_OUTBOX_KEY_BASE64 must encode 32 bytes');
  const google = googleIdentity();
  const database = new Pool({ connectionString: databaseUrl, max: 10 });
  const outbox = new PgAuthMessageOutbox(database, key, baseURL);
  const verificationTokens = new PgVerificationTokenStore(database, key);
  const audit = new PgAuthAudit(database);
  const options = createAuthOptions({
    database, baseURL, secret, outbox, verificationTokens,
    ...(google ? { google } : {}),
  });
  const auth = betterAuth(options);
  cached = { auth, outbox, verificationTokens, audit, database };
  return cached;
}
