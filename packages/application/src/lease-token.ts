import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from '../../contracts/src/canonical-json.js';

export interface LeaseIdentity {
  readonly executionId: string;
  readonly jobId: string;
  readonly attemptId: string;
  readonly workerDeviceId: string;
  readonly controlPlaneId: string;
  readonly keyVersion: string;
}

export interface LeaseTokenIssuer {
  readonly currentKeyVersion: string;
  derive(identity: LeaseIdentity): string;
}

/** Stable across cloud restarts; old key versions remain usable for their in-flight leases. */
export class HmacLeaseTokenIssuer implements LeaseTokenIssuer {
  readonly currentKeyVersion: string;
  private readonly keys: ReadonlyMap<string, Buffer>;

  constructor(keys: Readonly<Record<string, Uint8Array>>, currentKeyVersion: string) {
    this.currentKeyVersion = z.string().min(1).max(80).parse(currentKeyVersion);
    const entries = Object.entries(keys);
    if (!entries.length || !Object.hasOwn(keys, this.currentKeyVersion)) {
      throw new TypeError('Current lease key is missing');
    }
    for (const [version, bytes] of entries) {
      z.string().min(1).max(80).parse(version);
      if (bytes.byteLength < 32) throw new TypeError('Lease keys must contain at least 256 bits');
    }
    this.keys = new Map(entries.map(([version, bytes]) => [version, Buffer.from(bytes)]));
  }

  derive(identity: LeaseIdentity): string {
    const checked = z.strictObject({ executionId: z.uuid(), jobId: z.uuid(),
      attemptId: z.uuid(), workerDeviceId: z.uuid(),
      controlPlaneId: z.string().min(1).max(160), keyVersion: z.string().min(1).max(80) }).parse(identity);
    const key = this.keys.get(checked.keyVersion);
    if (!key) throw new Error('LEASE_KEY_UNAVAILABLE');
    return createHmac('sha256', key).update(`kivro-lease-v1\0${canonicalJson(checked)}`).digest('base64url');
  }
}

/** Composition roots must supply a private persistent key; no development fallback is permitted. */
export function leaseTokenIssuerFromEnvironment(env: Readonly<Record<string, string | undefined>>): HmacLeaseTokenIssuer {
  const version = z.string().min(1).max(80).parse(env.KIVRO_LEASE_KEY_VERSION);
  const decode = (encoded: unknown): Buffer => {
    const checked = z.base64().parse(encoded);
    const bytes = Buffer.from(checked, 'base64');
    if (bytes.length !== 32 || bytes.toString('base64') !== checked) {
      throw new TypeError('Kivro lease key must be exactly 32 canonical base64 bytes');
    }
    return bytes;
  };
  const previous = env.KIVRO_LEASE_PREVIOUS_KEYS_JSON === undefined ? {} :
    z.record(z.string().min(1).max(80), z.string()).parse(JSON.parse(env.KIVRO_LEASE_PREVIOUS_KEYS_JSON) as unknown);
  if (Object.hasOwn(previous, version)) throw new TypeError('Current lease key cannot appear in previous keys');
  const keys: Record<string, Buffer> = {};
  for (const [oldVersion, encoded] of Object.entries(previous)) keys[oldVersion] = decode(encoded);
  keys[version] = decode(env.KIVRO_LEASE_KEY_BASE64);
  return new HmacLeaseTokenIssuer(keys, version);
}
