import nodemailer from 'nodemailer';
import type { AuthEmailTransport } from './outbox.js';
import type { AuthMessage } from './options.js';

export interface SmtpConfiguration {
  readonly host: string;
  readonly port: number;
  readonly from: string;
  readonly security: 'LOCAL_PLAINTEXT' | 'STARTTLS' | 'TLS';
  readonly username?: string;
  readonly password?: string;
  readonly production: boolean;
}

/** SMTP is an adapter; the outbox owns durable retry and token encryption. */
export function createSmtpAuthTransport(config: SmtpConfiguration): AuthEmailTransport {
  if (!['LOCAL_PLAINTEXT', 'STARTTLS', 'TLS'].includes(config.security)) {
    throw new TypeError('Invalid SMTP security mode');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new TypeError('Invalid SMTP port');
  }
  if (!config.from || /[\r\n]/.test(config.from)) throw new TypeError('Invalid SMTP sender');
  if (config.security === 'LOCAL_PLAINTEXT' &&
    (config.production || !['localhost', '127.0.0.1', '::1'].includes(config.host))) {
    throw new TypeError('Plaintext SMTP is restricted to local development');
  }
  if ((config.username === undefined) !== (config.password === undefined)) {
    throw new TypeError('SMTP credentials must be configured together');
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.security === 'TLS',
    requireTLS: config.security === 'STARTTLS',
    ignoreTLS: config.security === 'LOCAL_PLAINTEXT',
    auth: config.username === undefined ? undefined : { user: config.username, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  return {
    async send(message: AuthMessage): Promise<void> {
      const subject = message.purpose === 'VERIFY_EMAIL' ? 'Verify your Kivro email' : 'Reset your Kivro password';
      const action = message.purpose === 'VERIFY_EMAIL' ? 'Verify your email' : 'Reset your password';
      await transporter.sendMail({
        from: config.from,
        to: message.recipient,
        subject,
        text: `${action}: ${message.url}\n\nIf you did not request this, ignore this email.`,
      });
    },
  };
}
