import type { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import type { VerificationTokenStore } from './verification-tokens.js';
import { hashAccountPassword, verifyAccountPassword } from './password.js';

export interface AuthMessage {
  readonly purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
  readonly recipient: string;
  readonly url: string;
}

export interface AuthMessageOutbox {
  enqueue(message: AuthMessage): Promise<void>;
}

export interface GoogleIdentityConfig {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface AuthConfiguration {
  readonly database: Pool;
  readonly baseURL: string;
  readonly secret: string;
  readonly outbox: AuthMessageOutbox;
  readonly verificationTokens: VerificationTokenStore;
  readonly google?: GoogleIdentityConfig;
}

/**
 * The same `accounts.id` is the Better Auth user ID and the Kivro account ID.
 * Database table/field mappings are paired with migration 0002_auth.sql.
 */
export function createAuthOptions(config: AuthConfiguration): Parameters<typeof betterAuth>[0] {
  if (config.secret.length < 32) throw new TypeError('Authentication secret is too short');
  const baseURL = new URL(config.baseURL);
  if (baseURL.protocol !== 'https:' && !(baseURL.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(baseURL.hostname))) {
    throw new TypeError('Authentication base URL must use HTTPS or local HTTP');
  }
  if (config.google && (!config.google.clientId || !config.google.clientSecret)) {
    throw new TypeError('Google identity configuration is incomplete');
  }
  return {
    appName: 'Kivro',
    // The upstream logger can include an existing email in sign-up messages.
    // Kivro writes sanitized auth outcomes through its own audit boundary.
    logger: { disabled: true },
    database: config.database,
    baseURL: baseURL.origin,
    secret: config.secret,
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: baseURL.protocol === 'https:',
    },
    user: {
      modelName: 'accounts',
      fields: {
        name: 'auth_name', email: 'primary_email', emailVerified: 'auth_email_verified',
        image: 'auth_image', createdAt: 'created_at', updatedAt: 'updated_at',
      },
    },
    account: {
      modelName: 'account_identities',
      fields: {
        accountId: 'provider_subject', providerId: 'provider', userId: 'account_id',
        accessToken: 'access_token', refreshToken: 'refresh_token', idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at', refreshTokenExpiresAt: 'refresh_token_expires_at',
        scope: 'scope', password: 'password_hash', createdAt: 'created_at', updatedAt: 'updated_at',
      },
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        trustedProviders: [],
        requireLocalEmailVerified: true,
        allowDifferentEmails: false,
        disableImplicitLinking: false,
      },
    },
    session: {
      modelName: 'auth_sessions',
      fields: {
        expiresAt: 'expires_at', ipAddress: 'ip_address', userAgent: 'user_agent',
        userId: 'account_id', createdAt: 'created_at', updatedAt: 'updated_at',
      },
    },
    verification: {
      modelName: 'auth_verifications',
      storeIdentifier: 'hashed',
      fields: { identifier: 'identifier', value: 'value', expiresAt: 'expires_at',
        createdAt: 'created_at', updatedAt: 'updated_at' },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      password: { hash: hashAccountPassword, verify: verifyAccountPassword },
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, url }) => config.outbox.enqueue({
        purpose: 'RESET_PASSWORD', recipient: user.email, url,
      }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url, token }) => {
        await config.verificationTokens.register(token, user.email);
        const link = new URL(url);
        link.searchParams.set('callbackURL', '/sign-in?verified=1');
        await config.outbox.enqueue({ purpose: 'VERIFY_EMAIL', recipient: user.email, url: link.toString() });
      },
    },
    socialProviders: config.google ? {
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        scope: [],
        includeGrantedScopes: false,
        accessType: 'online',
      },
    } : {},
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'auth_rate_limits',
      fields: { lastRequest: 'last_request' },
      window: 60,
      max: 30,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 3600, max: 5 },
        '/request-password-reset': { window: 3600, max: 5 },
        '/send-verification-email': { window: 3600, max: 5 },
      },
    },
  };
}
