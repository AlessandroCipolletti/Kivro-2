import { createHash, verify } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from '../../contracts/src/canonical-json.js';

export const WorkerSignedEnvelopeSchema = z.strictObject({
  workerDeviceId: z.uuid(),
  controlPlaneId: z.string().min(1).max(160),
  messageId: z.uuid(),
  signedAt: z.iso.datetime(),
  bodyHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  signature: z.base64url().min(32).max(1024),
});

export type WorkerSignedEnvelope = z.infer<typeof WorkerSignedEnvelopeSchema>;

export function workerMessageHash(body: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(body)).digest('hex')}`;
}

export function workerSignatureBytes(envelope: Omit<WorkerSignedEnvelope, 'signature'>): Buffer {
  return Buffer.from(canonicalJson(envelope), 'utf8');
}

export function verifyWorkerEnvelopeSignature(publicKeyPem: string, raw: unknown, body: unknown,
  now = Date.now()): WorkerSignedEnvelope {
  const envelope = WorkerSignedEnvelopeSchema.parse(raw);
  const signedAt = Date.parse(envelope.signedAt);
  if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > 5 * 60_000) {
    throw new Error('WORKER_MESSAGE_EXPIRED');
  }
  if (workerMessageHash(body) !== envelope.bodyHash) throw new Error('WORKER_BODY_MISMATCH');
  const { signature, ...signed } = envelope;
  if (!verify(null, workerSignatureBytes(signed), publicKeyPem, Buffer.from(signature, 'base64url'))) {
    throw new Error('WORKER_SIGNATURE_INVALID');
  }
  return envelope;
}
