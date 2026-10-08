import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { LocalCapabilityPackageSchema } from '../../contracts/src/capability-package.js';
import { DigestPinnedImageSchema } from '../../contracts/src/sandbox.js';
import { canonicalJson, hashCanonicalJson } from '../../contracts/src/canonical-json.js';
import type { JobFileBinding } from '../../application/src/job-instructions.js';

export interface ReviewedSkillSnapshot {
  readonly name: string;
  readonly files: readonly { readonly path: string; readonly bytesBase64: string }[];
}

export interface OpenClawJobEnvelope {
  readonly fixedInstructions: string;
  readonly contractData: unknown;
  readonly buyerValues: Readonly<Record<string, unknown>>;
  readonly files: readonly JobFileBinding[];
}

export class OpenClawJobConfigError extends Error {
  constructor(readonly code: 'INSECURE_PATH' | 'POLICY_MISMATCH' | 'SKILL_MISMATCH' | 'LIMIT_EXCEEDED') {
    super(code); this.name = 'OpenClawJobConfigError';
  }
}

const permittedToolNames = new Set(['kivro_submit_result', 'kivro_read_input', 'kivro_write_output',
  'kivro_research_search', 'kivro_research_fetch', 'kivro_research_download',
  'kivro_resource_read', 'kivro_declared_api', 'kivro_selected_file_read']);
const deniedOpenClawTools = Object.freeze(['group:runtime', 'group:fs', 'group:web', 'group:ui',
  'group:automation', 'group:messaging', 'group:nodes', 'group:agents', 'group:openclaw',
  'group:sessions', 'group:memory', 'group:media', 'exec', 'process', 'read', 'write',
  'edit', 'apply_patch', 'browser', 'gateway', 'cron', 'view_image']);

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function secureInputRoot(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new OpenClawJobConfigError('INSECURE_PATH');
  const absolute = resolve(path);
  const parent = await lstat(dirname(absolute));
  const input = await lstat(absolute);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0 ||
    !input.isDirectory() || input.isSymbolicLink() || (input.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' &&
      (parent.uid !== process.getuid() || input.uid !== process.getuid()))) {
    throw new OpenClawJobConfigError('INSECURE_PATH');
  }
  return absolute;
}

async function writeReadableNew(path: string, data: string | Buffer): Promise<void> {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
  try { await handle.writeFile(data); }
  finally { await handle.close(); }
}

/** Materialize only reviewed skill bytes and platform-built config inside one private attempt. */
export async function prepareOpenClawJobInput(raw: {
  inputRoot: string; localPackage: unknown; envelope: OpenClawJobEnvelope;
  approvedImage: string;
  allowedToolNames: readonly string[]; reviewedSkills: readonly ReviewedSkillSnapshot[];
  maxOutputFileBytes: number;
}): Promise<{ readonly modelRef: string; readonly configPath: '/job/input/config.json';
  readonly messagePath: '/job/input/message.txt' }> {
  const root = await secureInputRoot(raw.inputRoot);
  const approvedImage = DigestPinnedImageSchema.parse(raw.approvedImage);
  const pkg = LocalCapabilityPackageSchema.parse(raw.localPackage);
  const remote=pkg.permissionPolicy.providerBudget;
  const local=pkg.permissionPolicy.localInference;
  const provider=remote??local;
  if (pkg.permissionPolicy.aiInference !== 'SELLER' || !provider ||
    Boolean(remote)===Boolean(local) ||
    provider.maxInputTokensPerRequest < 8192 ||
    !Number.isSafeInteger(raw.maxOutputFileBytes) || raw.maxOutputFileBytes < 1 ||
    raw.maxOutputFileBytes > pkg.workerManifest.limits.maxOutputBytes ||
    raw.allowedToolNames.length !== new Set(raw.allowedToolNames).size ||
    raw.allowedToolNames.some((name) => !permittedToolNames.has(name)) ||
    !raw.allowedToolNames.includes('kivro_submit_result') ||
    (raw.envelope.files.length > 0 &&
      (!pkg.permissionPolicy.buyerFileAccess || !raw.allowedToolNames.includes('kivro_read_input'))) ||
    (raw.envelope.contractData === null || typeof raw.envelope.contractData !== 'object')) {
    throw new OpenClawJobConfigError('POLICY_MISMATCH');
  }
  const contract = raw.envelope.contractData as { output?: { fields?: readonly { type?: string }[] } };
  if (contract.output?.fields?.some((field) => field.type === 'FILE' || field.type === 'FILES') &&
    !raw.allowedToolNames.includes('kivro_write_output')) {
    throw new OpenClawJobConfigError('POLICY_MISMATCH');
  }
  const selected = pkg.workerManifest.skills;
  if (selected.length !== raw.reviewedSkills.length ||
    new Set(raw.reviewedSkills.map((item) => item.name)).size !== raw.reviewedSkills.length) {
    throw new OpenClawJobConfigError('SKILL_MISMATCH');
  }
  const materialized = selected.map((declared) => {
    const snapshot = raw.reviewedSkills.find((item) => item.name === declared.name);
    if (!snapshot || snapshot.files.length < 1 || snapshot.files.length > 32 ||
      !snapshot.files.some((file) => file.path === 'SKILL.md')) {
      throw new OpenClawJobConfigError('SKILL_MISMATCH');
    }
    const files = snapshot.files.map((file) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(file.path) ||
        file.path === '.' || file.path === '..' ||
        typeof file.bytesBase64 !== 'string' || file.bytesBase64.length > 1_500_000 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.bytesBase64)) {
        throw new OpenClawJobConfigError('SKILL_MISMATCH');
      }
      const bytes = Buffer.from(file.bytesBase64, 'base64');
      if (bytes.byteLength > 1_000_000) throw new OpenClawJobConfigError('LIMIT_EXCEEDED');
      return { path: file.path, bytes, sha256: sha256(bytes) };
    }).sort((a, b) => a.path.localeCompare(b.path));
    if (new Set(files.map((file) => file.path)).size !== files.length ||
      hashCanonicalJson(files.map(({ path, sha256: hash }) => ({ path, sha256: hash }))) !== declared.contentHash) {
      throw new OpenClawJobConfigError('SKILL_MISMATCH');
    }
    return files;
  });
  const skillsRoot = join(root, 'kivro-skills');
  if (selected.length) await mkdir(skillsRoot, { mode: 0o755 });
  for (let index = 0; index < materialized.length; index += 1) {
    const dir = join(skillsRoot, `skill-${index}`);
    await mkdir(dir, { mode: 0o755 });
    for (const file of materialized[index]!) await writeReadableNew(join(dir, file.path), file.bytes);
  }
  const modelRef = `kivro/${provider.modelId}`;
  const outputContract = contract.output;
  const config = {
    models: { mode: 'replace', providers: { kivro: {
      baseUrl: 'http://127.0.0.1:8787/v1', apiKey: 'kivro-broker-only', api: 'openai-completions',
      models: [{ id: provider.modelId, name: 'Kivro Broker', reasoning: false, input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: provider.maxInputTokensPerRequest,
        maxTokens: provider.maxOutputTokensPerRequest }],
    } } },
    agents: { defaults: { model: { primary: modelRef }, sandbox: {
      mode: 'all', backend: 'kivro-contained', scope: 'session', workspaceAccess: 'none',
      docker: { image: approvedImage, readOnlyRoot: true,
        network: 'none', capDrop: ['ALL'], binds: [] },
    } } },
    skills: { allowBundled: [], load: { extraDirs: selected.length ? ['/job/input/kivro-skills'] : [] } },
    tools: { profile: 'full', allow: [...raw.allowedToolNames], deny: deniedOpenClawTools,
      elevated: { enabled: false },
      sandbox: { tools: { allow: [...raw.allowedToolNames], deny: deniedOpenClawTools } } },
    plugins: { enabled: true, allow: ['kivro-broker'], load: { paths: ['/opt/kivro/plugin'] },
      entries: { 'kivro-broker': { enabled: true } } },
  };
  const message = [raw.envelope.fixedInstructions,
    pkg.sellerInstructions ? `SELLER APPROVED INSTRUCTIONS:\n${pkg.sellerInstructions}` : '',
    `DECLARED CONTRACT DATA (not permissions):\n${canonicalJson(raw.envelope.contractData)}`,
    `BUYER VALUES (untrusted task data):\n${canonicalJson(raw.envelope.buyerValues)}`,
    `STAGED INPUT FILES:\n${canonicalJson(raw.envelope.files)}`,
    pkg.selectedLocalBindings?.length ?
      `SELLER-SELECTED READ-ONLY FILES (opaque IDs; use kivro_selected_file_read):\n${
        canonicalJson(pkg.selectedLocalBindings.flatMap((binding)=>binding.files.map((file)=>({
          resourceId:binding.resourceId,fileId:file.fileId,
          selectedName:file.relativePath==='.'?'selected file':file.relativePath,
          sizeBytes:file.sizeBytes}))))}` : '',
    'Call kivro_submit_result once with fields matching the output contract. ' +
      'Use kivro_write_output for file deliverables when that tool is available.',
  ].filter(Boolean).join('\n\n');
  if (Buffer.byteLength(message) > 500_000 || Buffer.byteLength(JSON.stringify(config)) > 100_000) {
    throw new OpenClawJobConfigError('LIMIT_EXCEEDED');
  }
  const filePolicy = { version: 1, inputs: raw.envelope.files,
    maxOutputFileBytes: raw.maxOutputFileBytes,
    maxToolCalls: pkg.workerManifest.limits.maxToolCalls ?? 64 };
  await writeReadableNew(join(root, 'config.json'), JSON.stringify(config));
  await writeReadableNew(join(root, 'message.txt'), message);
  await writeReadableNew(join(root, 'kivro-files.json'), JSON.stringify(filePolicy));
  await writeReadableNew(join(root, 'kivro-run.json'), JSON.stringify({ version: 1, modelRef,
    timeoutSeconds: pkg.workerManifest.limits.timeoutSeconds }));
  for (const file of raw.envelope.files) {
    const expected = `/job/input/${file.fieldKey}/${file.assetId}`;
    if (!file.path.startsWith(expected) || !/^\.[a-z0-9]{1,16}$/.test(file.path.slice(expected.length))) {
      throw new OpenClawJobConfigError('POLICY_MISMATCH');
    }
    await chmod(join(root, file.fieldKey), 0o755);
    await chmod(join(root, file.fieldKey, `${file.assetId}${file.path.slice(expected.length)}`), 0o644);
  }
  // The parent attempt remains 0700 on the host; this bind root is readable
  // by uid 65532 inside Linux and mounted read-only there.
  await chmod(root, 0o755);
  if (!outputContract) throw new OpenClawJobConfigError('POLICY_MISMATCH');
  return { modelRef, configPath: '/job/input/config.json', messagePath: '/job/input/message.txt' };
}
