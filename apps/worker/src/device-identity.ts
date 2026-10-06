import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  scryptSync,
  sign,
  verify,
} from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const identityFile = z.strictObject({
  formatVersion: z.literal(1),
  deviceId: z.uuid(),
  publicKeyPem: z.string().startsWith('-----BEGIN PUBLIC KEY-----').max(512),
  kdf: z.literal('scrypt-N32768-r8-p1'),
  cipher: z.literal('aes-256-gcm'),
  salt: z.base64().max(64),
  nonce: z.base64().max(64),
  tag: z.base64().max(64),
  ciphertext: z.base64().max(4096),
});

export interface DeviceIdentityPublic {
  readonly deviceId: string;
  readonly publicKeyPem: string;
}

export interface DeviceIdentitySigner extends DeviceIdentityPublic {
  signChallenge(challenge: Uint8Array): Buffer;
}

export class DeviceIdentityError extends Error {
  constructor(readonly code: 'ALREADY_EXISTS' | 'NOT_FOUND' | 'INSECURE_KEY_FILE' | 'INVALID_KEY_FILE' | 'INVALID_PASSPHRASE') {
    super(`Device identity unavailable: ${code}`);
    this.name = 'DeviceIdentityError';
  }
}

function validatePrivateFile(path: string): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new DeviceIdentityError('NOT_FOUND');
  }
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && stat.uid !== process.getuid())) {
    throw new DeviceIdentityError('INSECURE_KEY_FILE');
  }
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (passphrase.length < 16) throw new DeviceIdentityError('INVALID_PASSPHRASE');
  return scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function signer(deviceId: string, publicKeyPem: string, privateKeyPem: string): DeviceIdentitySigner {
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(publicKeyPem);
  if (!createPublicKey(privateKey).equals(publicKey)) throw new DeviceIdentityError('INVALID_KEY_FILE');
  return {
    deviceId,
    publicKeyPem,
    signChallenge(challenge: Uint8Array): Buffer {
      if (challenge.byteLength < 16 || challenge.byteLength > 4096) throw new DeviceIdentityError('INVALID_KEY_FILE');
      return sign(null, challenge, privateKey);
    },
  };
}

/** Encrypted local fallback. The primary OS keychain adapter is still required for supported releases. */
export class EncryptedDeviceIdentityStore {
  private readonly path: string;

  constructor(private readonly privateStateDirectory: string) {
    const state = lstatSync(privateStateDirectory);
    if (!state.isDirectory() || state.isSymbolicLink() || (state.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && state.uid !== process.getuid())) {
      throw new DeviceIdentityError('INSECURE_KEY_FILE');
    }
    this.path = join(privateStateDirectory, 'device-identity.json');
  }

  create(passphrase: string): DeviceIdentityPublic {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const deviceId = randomUUID();
    const salt = randomBytes(32);
    const nonce = randomBytes(12);
    const key = deriveKey(passphrase, salt);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(`${deviceId}:${publicKeyPem}`));
    const ciphertext = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
    const record = {
      formatVersion: 1,
      deviceId,
      publicKeyPem,
      kdf: 'scrypt-N32768-r8-p1',
      cipher: 'aes-256-gcm',
      salt: salt.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    } as const;
    try {
      writeFileSync(this.path, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') throw new DeviceIdentityError('ALREADY_EXISTS');
      throw error;
    } finally {
      key.fill(0);
    }
    validatePrivateFile(this.path);
    return { deviceId, publicKeyPem };
  }

  readPublic(): DeviceIdentityPublic {
    const data = this.readRecord();
    return { deviceId: data.deviceId, publicKeyPem: data.publicKeyPem };
  }

  unlock(passphrase: string): DeviceIdentitySigner {
    const data = this.readRecord();
    const salt = Buffer.from(data.salt, 'base64');
    const nonce = Buffer.from(data.nonce, 'base64');
    const tag = Buffer.from(data.tag, 'base64');
    if (salt.length !== 32 || nonce.length !== 12 || tag.length !== 16) throw new DeviceIdentityError('INVALID_KEY_FILE');
    const key = deriveKey(passphrase, salt);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(Buffer.from(`${data.deviceId}:${data.publicKeyPem}`));
      decipher.setAuthTag(tag);
      const privateKeyPem = Buffer.concat([
        decipher.update(Buffer.from(data.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return signer(data.deviceId, data.publicKeyPem, privateKeyPem);
    } catch {
      throw new DeviceIdentityError('INVALID_PASSPHRASE');
    } finally {
      key.fill(0);
    }
  }

  private readRecord(): z.infer<typeof identityFile> {
    let descriptor: number;
    try {
      descriptor = openSync(this.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch {
      throw new DeviceIdentityError('NOT_FOUND');
    }
    try {
      const state = fstatSync(descriptor);
      if (!state.isFile() || (state.mode & 0o077) !== 0 ||
        (typeof process.getuid === 'function' && state.uid !== process.getuid())) {
        throw new DeviceIdentityError('INSECURE_KEY_FILE');
      }
      if (state.size > 8192) throw new DeviceIdentityError('INVALID_KEY_FILE');
      const result = identityFile.safeParse(JSON.parse(readFileSync(descriptor, { encoding: 'utf8' })));
      if (!result.success) throw new DeviceIdentityError('INVALID_KEY_FILE');
      return result.data;
    } catch (error) {
      if (error instanceof DeviceIdentityError) throw error;
      throw new DeviceIdentityError('INVALID_KEY_FILE');
    } finally {
      closeSync(descriptor);
    }
  }
}

export function verifyDeviceSignature(publicKeyPem: string, challenge: Uint8Array, signature: Uint8Array): boolean {
  return verify(null, challenge, createPublicKey(publicKeyPem), signature);
}
