import type { Pool } from 'pg';

export type AuthHttpEvent =
  | 'SIGN_UP_EMAIL_REQUEST' | 'SIGN_IN_EMAIL_REQUEST'
  | 'SEND_VERIFICATION_REQUEST' | 'VERIFY_EMAIL_REQUEST'
  | 'RESET_REQUEST' | 'RESET_PASSWORD_REQUEST'
  | 'GOOGLE_SIGN_IN_REQUEST' | 'GOOGLE_CALLBACK_REQUEST';

/** Only the event class and status cross this boundary. */
export class PgAuthAudit {
  constructor(private readonly database: Pool) {}

  async record(event: AuthHttpEvent, status: number): Promise<void> {
    if (!Number.isInteger(status) || status < 100 || status > 599) throw new TypeError('Invalid auth audit status');
    await this.database.query(
      'INSERT INTO auth_audit_events(event_type, http_status) VALUES ($1, $2)',
      [event, status],
    );
  }
}

export function classifyAuthRequest(request: Request): AuthHttpEvent | undefined {
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (method === 'POST') {
    switch (path) {
      case '/api/auth/sign-up/email': return 'SIGN_UP_EMAIL_REQUEST';
      case '/api/auth/sign-in/email': return 'SIGN_IN_EMAIL_REQUEST';
      case '/api/auth/send-verification-email': return 'SEND_VERIFICATION_REQUEST';
      case '/api/auth/request-password-reset': return 'RESET_REQUEST';
      case '/api/auth/reset-password': return 'RESET_PASSWORD_REQUEST';
      case '/api/auth/sign-in/social': return 'GOOGLE_SIGN_IN_REQUEST';
      default: return undefined;
    }
  }
  if (method === 'GET') {
    if (path === '/api/auth/verify-email') return 'VERIFY_EMAIL_REQUEST';
    if (path === '/api/auth/callback/google') return 'GOOGLE_CALLBACK_REQUEST';
  }
  return undefined;
}
