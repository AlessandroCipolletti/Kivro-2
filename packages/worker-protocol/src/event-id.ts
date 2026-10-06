import { createHash } from 'node:crypto';
import { z } from 'zod';

/** One stable idempotency key for a Worker execution action across retries/transports. */
export function workerExecutionEventId(executionId: string, action: string): string {
  z.uuid().parse(executionId);
  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(action)) throw new TypeError('Invalid Worker action');
  const bytes = createHash('sha256').update(`${executionId}:${action}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
