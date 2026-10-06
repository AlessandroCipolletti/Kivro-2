import { z } from 'zod';
import { hashCanonicalJson } from './canonical-json.js';

const reference = z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const WorkerManifestSchema = z.strictObject({
  manifestVersion: z.literal(1),
  workerId: z.uuid(),
  capabilityVersionId: z.uuid(),
  runtime: z.strictObject({
    type: z.literal('openclaw'),
    supportedVersionRange: z.string().min(1).max(120),
  }),
  skills: z.array(z.strictObject({
    name: reference,
    contentHash: sha256,
  })).max(64),
  tools: z.strictObject({
    allow: z.array(reference).max(64),
    deny: z.array(reference).max(64),
  }),
  resources: z.array(z.strictObject({
    id: reference,
    type: z.enum(['local-resource-broker', 'declared-api', 'selected-file']),
    permissions: z.array(reference).max(64),
    credentialRef: reference.optional(),
  })).max(64),
  network: z.strictObject({
    default: z.literal('deny'),
    allow: z.array(z.strictObject({
      host: z.string().min(1).max(253),
      ports: z.array(z.number().int().min(1).max(65535)).max(16),
      purpose: z.string().min(1).max(200),
    })).max(32),
  }),
  limits: z.strictObject({
    timeoutSeconds: z.number().int().positive(),
    memoryMb: z.number().int().positive(),
    cpu: z.number().positive(),
    maxPids: z.number().int().positive(),
    maxInputBytes: z.number().int().nonnegative(),
    maxOutputBytes: z.number().int().nonnegative(),
  }),
});

export type WorkerManifest = z.infer<typeof WorkerManifestSchema>;

export function hashWorkerManifest(input: unknown): `sha256:${string}` {
  const manifest = WorkerManifestSchema.parse(input);
  return hashCanonicalJson(manifest);
}
