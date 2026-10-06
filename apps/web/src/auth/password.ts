import { Algorithm, Version, hash, parseOptions, verify } from '@node-rs/argon2';

const policy = {
  algorithm: Algorithm.Argon2id,
  version: Version.V0x13,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

/** PHC strings carry the algorithm and cost parameters for future upgrades. */
export async function hashAccountPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new TypeError('Invalid password length');
  return hash(password.normalize('NFKC'), policy);
}

export async function verifyAccountPassword(input: { hash: string; password: string }): Promise<boolean> {
  if (!input.hash.startsWith('$argon2id$') || input.hash.length > 256 || input.password.length > 128) return false;
  try {
    const parameters = parseOptions(input.hash);
    if (parameters.algorithm !== policy.algorithm || parameters.version !== policy.version ||
      parameters.memoryCost !== policy.memoryCost || parameters.timeCost !== policy.timeCost ||
      parameters.parallelism !== policy.parallelism || parameters.outputLen !== policy.outputLen ||
      parameters.saltLen < 16) return false;
    return await verify(input.hash, input.password.normalize('NFKC'));
  } catch { return false; }
}
