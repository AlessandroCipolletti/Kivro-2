import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { DigestPinnedImageSchema } from '../../contracts/src/sandbox.js';

const execFileAsync = promisify(execFile);
const approvalSchema = z.strictObject({
  schemaVersion: z.literal(1), image: DigestPinnedImageSchema,
  openClawVersion: z.literal('2026.8.2'),
  runtimeSourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  conformanceSuite: z.literal('m07-openclaw-execution/1'),
  conformancePassedAt: z.iso.datetime({ offset: true }),
});

export type ApprovedOpenClawImage = z.infer<typeof approvalSchema>;

export class OpenClawImageApprovalError extends Error {
  constructor(readonly code: 'NOT_APPROVED' | 'INVALID_RECORD' | 'SOURCE_CHANGED' |
    'IMAGE_UNAVAILABLE' | 'IMAGE_MISMATCH') {
    super(code); this.name = 'OpenClawImageApprovalError';
  }
}

const sourceFiles = ['Dockerfile', 'package.json', 'package-lock.json', 'bridge.mjs',
  'runner.mjs', 'plugin/index.mjs', 'plugin/openclaw.plugin.json', 'plugin/package.json'];

/** Any runtime or plugin source edit invalidates a local approval until conformance reruns. */
export async function hashOpenClawRuntimeSource(runtimeRoot: string): Promise<`sha256:${string}`> {
  const hash = createHash('sha256');
  for (const name of sourceFiles) {
    const path = join(resolve(runtimeRoot), name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2_000_000) {
      throw new OpenClawImageApprovalError('SOURCE_CHANGED');
    }
    hash.update(name); hash.update('\0'); hash.update(await readFile(path)); hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

/** The private operator record is a trust root, never supplied by a job or buyer. */
export class OpenClawImageApproval {
  constructor(private readonly recordPath: string, private readonly runtimeRoot: string,
    private readonly dockerExecutable: string) {
    if (!isAbsolute(recordPath) || !isAbsolute(dockerExecutable)) {
      throw new OpenClawImageApprovalError('INVALID_RECORD');
    }
  }

  async assertApprovedImage(image: string): Promise<ApprovedOpenClawImage> {
    const expected = DigestPinnedImageSchema.safeParse(image);
    if (!expected.success) throw new OpenClawImageApprovalError('NOT_APPROVED');
    let approval: ApprovedOpenClawImage;
    try {
      const info = await lstat(this.recordPath);
      if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
        (typeof process.getuid === 'function' && info.uid !== process.getuid()) ||
        info.size > 4096) throw new Error('UNSAFE_RECORD');
      approval = approvalSchema.parse(JSON.parse(await readFile(this.recordPath, 'utf8')));
    } catch { throw new OpenClawImageApprovalError('INVALID_RECORD'); }
    if (approval.image !== image) throw new OpenClawImageApprovalError('NOT_APPROVED');
    if (approval.runtimeSourceHash !== await hashOpenClawRuntimeSource(this.runtimeRoot)) {
      throw new OpenClawImageApprovalError('SOURCE_CHANGED');
    }
    let raw: string;
    try {
      raw = (await execFileAsync(this.dockerExecutable, ['image', 'inspect', image],
        { timeout: 10_000, maxBuffer: 1_000_000 })).stdout;
    } catch { throw new OpenClawImageApprovalError('IMAGE_UNAVAILABLE'); }
    const list = JSON.parse(raw) as { RepoDigests?: string[]; Config?: { Labels?: Record<string, string> } }[];
    const inspected = list[0];
    if (list.length !== 1 || !inspected?.RepoDigests?.includes(image) ||
      inspected.Config?.Labels?.['io.kivro.openclaw.version'] !== approval.openClawVersion) {
      throw new OpenClawImageApprovalError('IMAGE_MISMATCH');
    }
    return approval;
  }
}
