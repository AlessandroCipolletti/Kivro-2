import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { DigestPinnedImageSchema, OfflineSandboxPlanSchema, type OfflineSandboxPlan } from '../../contracts/src/sandbox.js';
import { collectStoppedAttemptOutput, type CollectedLocalResult, type PlatformFileLimits } from './output-collector.js';
import { extractBoundedOutputTar } from './output-transfer.js';

const execFileAsync = promisify(execFile);
const uuid = z.uuid();
const containerIdPattern = /^[a-f0-9]{64}$/;

export class DockerSandboxError extends Error {
  constructor(readonly code: 'DOCKER_UNAVAILABLE' | 'IMAGE_UNAPPROVED' | 'INSECURE_INPUT' |
    'IMAGE_UNAVAILABLE' | 'CREATE_FAILED' | 'POLICY_MISMATCH' | 'START_FAILED' | 'TIMED_OUT' |
    'OUTPUT_LIMIT' | 'CLEANUP_FAILED' | 'COLLECTOR_UNAVAILABLE' | 'TRANSFER_FAILED' |
    'EXECUTION_FAILED') {
    super(`Docker sandbox unavailable: ${code}`); this.name = 'DockerSandboxError';
  }
}

export interface DockerSandboxResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface DockerSandboxOptions {
  readonly dockerExecutable: string;
  readonly approvedImage: string;
  readonly attemptRoot: string;
  readonly collectorImage?: string;
}

type DockerInspect = {
  Config?: { User?: unknown; Image?: unknown };
  HostConfig?: Record<string, unknown>;
  Mounts?: { Type?: unknown; Name?: unknown; Source?: unknown; Destination?: unknown; RW?: unknown }[];
  State?: { ExitCode?: unknown; Status?: unknown; StartedAt?: unknown; FinishedAt?: unknown };
};

function ownedPrivateDirectory(path: string): string {
  const resolved = resolve(path);
  try {
    const info = lstatSync(resolved);
    if (info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o077) === 0 &&
      (typeof process.getuid !== 'function' || info.uid === process.getuid())) return realpathSync(resolved);
  } catch { /* Fail with a sanitized error below. */ }
  throw new DockerSandboxError('INSECURE_INPUT');
}

function inputDirectory(root: string, attemptId: string): string {
  const rootReal = ownedPrivateDirectory(root);
  const attemptReal = ownedPrivateDirectory(join(rootReal, attemptId));
  const inputReal = ownedPrivateDirectory(join(attemptReal, 'input'));
  if (relative(rootReal, inputReal).startsWith('..') || relative(rootReal, inputReal) === '') {
    throw new DockerSandboxError('INSECURE_INPUT');
  }
  return inputReal;
}

function verifyEffectiveContainer(raw: unknown, plan: OfflineSandboxPlan, input: string,
  outputVolume?: string): void {
  if (!Array.isArray(raw) || raw.length !== 1 || !raw[0] || typeof raw[0] !== 'object') {
    throw new DockerSandboxError('POLICY_MISMATCH');
  }
  const container = raw[0] as DockerInspect;
  const host = container.HostConfig;
  const mounts = container.Mounts;
  const inputMount = mounts?.find((mount) => mount.Destination === '/job/input');
  const outputMount = mounts?.find((mount) => mount.Destination === '/job/output');
  const opts = host?.SecurityOpt;
  const capDrop = host?.CapDrop;
  const tmpfs = host?.Tmpfs;
  const safe = host?.NetworkMode === 'none' && host?.ReadonlyRootfs === true &&
    host?.Privileged === false && host?.IpcMode === 'none' &&
    (host?.PidMode === '' || host?.PidMode === 'private') &&
    container.Config?.User === plan.runAs && container.Config.Image === plan.image &&
    Array.isArray(capDrop) && capDrop.length === 1 && capDrop[0] === 'ALL' &&
    Array.isArray(opts) && opts.includes('no-new-privileges:true') && opts.includes('seccomp=builtin') &&
    host?.OomKillDisable === false && host?.PidsLimit === plan.maxPids &&
    host?.Memory === plan.memoryMb * 1024 * 1024 &&
    host?.MemorySwap === plan.memoryMb * 1024 * 1024 &&
    host?.NanoCpus === Math.round(plan.cpu * 1_000_000_000) &&
    (!Array.isArray(host?.CapAdd) || host.CapAdd.length === 0) &&
    (!Array.isArray(host?.Devices) || host.Devices.length === 0) &&
    mounts?.length === (outputVolume ? 2 : 1) && inputMount?.Type === 'bind' &&
    (inputMount.Source === input || inputMount.Source === `/host_mnt${input}`) &&
    inputMount.RW === false &&
    tmpfs !== null && typeof tmpfs === 'object' &&
    ['/tmp', '/var/tmp', '/run', '/job/work', ...(outputVolume ? [] : ['/job/output'])].every((path) =>
      Object.hasOwn(tmpfs, path)) &&
    (outputVolume ? !Object.hasOwn(tmpfs, '/job/output') && outputMount?.Type === 'volume' &&
      outputMount.Name === outputVolume && outputMount.RW === true : true);
  if (!safe) throw new DockerSandboxError('POLICY_MISMATCH');
}

function verifyOutputVolume(raw: unknown, name: string, options: string): void {
  if (!Array.isArray(raw) || raw.length !== 1 || !raw[0] || typeof raw[0] !== 'object') {
    throw new DockerSandboxError('POLICY_MISMATCH');
  }
  const volume = raw[0] as { Name?: unknown; Driver?: unknown; Options?: Record<string, unknown> };
  if (volume.Name !== name || volume.Driver !== 'local' || volume.Options?.type !== 'tmpfs' ||
    volume.Options.device !== 'tmpfs' || volume.Options.o !== options) {
    throw new DockerSandboxError('POLICY_MISMATCH');
  }
}

function verifyCollector(raw: unknown, image: string, volume: string): void {
  if (!Array.isArray(raw) || raw.length !== 1 || !raw[0] || typeof raw[0] !== 'object') {
    throw new DockerSandboxError('POLICY_MISMATCH');
  }
  const container = raw[0] as DockerInspect;
  const host = container.HostConfig;
  const mount = container.Mounts?.[0];
  if (container.Config?.Image !== image || container.Config.User !== '65532:65532' ||
    host?.NetworkMode !== 'none' || host.ReadonlyRootfs !== true || host.Privileged !== false ||
    host.IpcMode !== 'private' && host.IpcMode !== '' ||
    host.PidsLimit !== 16 || host.Memory !== 64 * 1024 * 1024 ||
    host.MemorySwap !== 64 * 1024 * 1024 || host.NanoCpus !== 200_000_000 ||
    !Array.isArray(host.CapDrop) || host.CapDrop.length !== 1 || host.CapDrop[0] !== 'ALL' ||
    !Array.isArray(host.SecurityOpt) || !host.SecurityOpt.includes('no-new-privileges:true') ||
    !host.SecurityOpt.includes('seccomp=builtin') || container.Mounts?.length !== 1 ||
    mount?.Type !== 'volume' || mount.Name !== volume || mount.Destination !== '/job/output' ||
    mount.RW !== false) throw new DockerSandboxError('POLICY_MISMATCH');
}

async function boundedDockerCommand(executable: string, args: readonly string[]): Promise<string> {
  try {
    const result = await execFileAsync(executable, [...args], { timeout: 10_000, maxBuffer: 2_000_000 });
    return result.stdout;
  } catch { throw new DockerSandboxError('DOCKER_UNAVAILABLE'); }
}

async function startAttached(executable: string, id: string, timeoutMs: number,
  outputLimit: number): Promise<{ stdout: string; stderr: string; stoppedFor: 'NONE' | 'TIMEOUT' | 'OUTPUT' }> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(executable, ['start', '--attach', id], { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let size = 0;
    let stoppedFor: 'NONE' | 'TIMEOUT' | 'OUTPUT' = 'NONE';
    const stop = (reason: 'TIMEOUT' | 'OUTPUT'): void => {
      if (stoppedFor !== 'NONE') return;
      stoppedFor = reason;
      void boundedDockerCommand(executable, ['kill', id]).catch(() => undefined);
      child.kill('SIGTERM');
    };
    const timer = setTimeout(() => stop('TIMEOUT'), timeoutMs);
    const collect = (target: Buffer[], chunk: Buffer): void => {
      size += chunk.byteLength;
      if (size > outputLimit) { stop('OUTPUT'); return; }
      target.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.on('error', () => { clearTimeout(timer); rejectResult(new DockerSandboxError('START_FAILED')); });
    child.on('close', () => {
      clearTimeout(timer);
      resolveResult({ stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'), stoppedFor });
    });
  });
}

async function transferOutput(executable: string, collectorId: string, outputRoot: string,
  maxBytes: number): Promise<void> {
  const child = spawn(executable, ['cp', `${collectorId}:/job/output/.`, '-'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  const finished = new Promise<number>((resolveFinished, rejectFinished) => {
    child.on('error', () => rejectFinished(new DockerSandboxError('TRANSFER_FAILED')));
    child.on('close', (code) => resolveFinished(code ?? -1));
  });
  let stderrBytes = 0;
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.byteLength;
    if (stderrBytes > 1_048_576) child.kill('SIGTERM');
  });
  try {
    await extractBoundedOutputTar(child.stdout, outputRoot, maxBytes);
    if (await finished !== 0 || stderrBytes > 1_048_576) throw new DockerSandboxError('TRANSFER_FAILED');
  } catch (error) {
    child.kill('SIGTERM');
    await finished.catch(() => undefined);
    throw error;
  }
}

/** Docker is an infrastructure adapter; caller supplies only a trusted command, never buyer text. */
export class DockerSandboxAdapter {
  private readonly dockerExecutable: string;
  private readonly approvedImage: string;
  private readonly attemptRoot: string;
  private readonly collectorImage: string | undefined;

  constructor(options: DockerSandboxOptions) {
    if (!isAbsolute(options.dockerExecutable)) throw new TypeError('Docker executable must be absolute');
    this.dockerExecutable = options.dockerExecutable;
    this.approvedImage = DigestPinnedImageSchema.parse(options.approvedImage);
    this.collectorImage = options.collectorImage ? DigestPinnedImageSchema.parse(options.collectorImage) : undefined;
    this.attemptRoot = ownedPrivateDirectory(options.attemptRoot);
  }

  async run(rawPlan: unknown, attemptId: string, trustedArgv: readonly string[]): Promise<DockerSandboxResult> {
    return this.execute(rawPlan, attemptId, trustedArgv);
  }

  /** The consumer must durably store validated files before returning; local staging is then erased. */
  async runWithOutput(rawPlan: unknown, attemptId: string, trustedArgv: readonly string[],
    outputContract: unknown, limits: PlatformFileLimits,
    consume: (collected: CollectedLocalResult, outputRoot: string) => Promise<void>): Promise<DockerSandboxResult> {
    if (!this.collectorImage) throw new DockerSandboxError('COLLECTOR_UNAVAILABLE');
    return this.execute(rawPlan, attemptId, trustedArgv, { outputContract, limits, consume });
  }

  private async execute(rawPlan: unknown, attemptId: string, trustedArgv: readonly string[],
    delivery?: { outputContract: unknown; limits: PlatformFileLimits;
      consume: (collected: CollectedLocalResult, outputRoot: string) => Promise<void> }): Promise<DockerSandboxResult> {
    const plan = OfflineSandboxPlanSchema.parse(rawPlan);
    uuid.parse(attemptId);
    if (plan.image !== this.approvedImage) throw new DockerSandboxError('IMAGE_UNAPPROVED');
    if (!trustedArgv.length || trustedArgv.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) {
      throw new TypeError('Trusted entrypoint arguments are required');
    }
    const input = inputDirectory(this.attemptRoot, attemptId);
    const name = `kivro-sbx-${randomUUID()}`;
    const outputVolume = delivery ? `kivro-output-${randomUUID()}` : undefined;
    const collectorName = delivery ? `kivro-collector-${randomUUID()}` : undefined;
    const outputRoot = join(this.attemptRoot, attemptId, 'output');
    if (delivery) {
      try { lstatSync(outputRoot); throw new DockerSandboxError('INSECURE_INPUT'); }
      catch (error) {
        if (error instanceof DockerSandboxError ||
          !(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
    }
    let volumeCreated = false;
    let collectorCreated = false;
    let createAttempted = false;
    let result: DockerSandboxResult | undefined;
    let failure: unknown;
    try {
      await boundedDockerCommand(this.dockerExecutable, ['version', '--format', '{{.Server.Version}}']);
      try { await boundedDockerCommand(this.dockerExecutable, ['image', 'inspect', plan.image, '--format', '{{.Id}}']); }
      catch { throw new DockerSandboxError('IMAGE_UNAVAILABLE'); }
      if (delivery && outputVolume && collectorName && this.collectorImage) {
        if (plan.maxOutputBytes < 1) throw new DockerSandboxError('OUTPUT_LIMIT');
        try { await boundedDockerCommand(this.dockerExecutable,
          ['image', 'inspect', this.collectorImage, '--format', '{{.Id}}']); }
        catch { throw new DockerSandboxError('COLLECTOR_UNAVAILABLE'); }
        const sizeMb = Math.max(1, Math.ceil(plan.maxOutputBytes / 1_048_576));
        const volumeOptions = `size=${sizeMb}m,uid=65532,gid=65532,mode=0700`;
        await boundedDockerCommand(this.dockerExecutable, ['volume', 'create', '--driver', 'local',
          '--opt', 'type=tmpfs', '--opt', 'device=tmpfs', '--opt', `o=${volumeOptions}`, outputVolume]);
        volumeCreated = true;
        verifyOutputVolume(JSON.parse(await boundedDockerCommand(this.dockerExecutable,
          ['volume', 'inspect', outputVolume])) as unknown, outputVolume, volumeOptions);
        const collectorArgs = ['create', '--name', collectorName, '--pull=never', '--network=none',
          '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
          '--security-opt=seccomp=builtin', '--user=65532:65532', '--pids-limit=16',
          '--memory=64m', '--memory-swap=64m', '--cpus=0.2',
          `--mount=type=volume,source=${outputVolume},target=/job/output,readonly`,
          this.collectorImage, 'sleep', '7200'];
        collectorCreated = true;
        const collectorId = (await boundedDockerCommand(this.dockerExecutable, collectorArgs)).trim();
        if (!containerIdPattern.test(collectorId)) throw new DockerSandboxError('COLLECTOR_UNAVAILABLE');
        verifyCollector(JSON.parse(await boundedDockerCommand(this.dockerExecutable,
          ['inspect', collectorId])) as unknown, this.collectorImage, outputVolume);
        await boundedDockerCommand(this.dockerExecutable, ['start', collectorId]);
      }
      const args = ['create', '--name', name, '--pull=never', '--init',
        '--network=none', '--ipc=none', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges:true', '--security-opt=seccomp=builtin',
        `--user=${plan.runAs}`, `--pids-limit=${plan.maxPids}`,
        `--memory=${plan.memoryMb}m`, `--memory-swap=${plan.memoryMb}m`, `--cpus=${plan.cpu}`,
        '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=16m',
        '--tmpfs=/var/tmp:rw,nosuid,nodev,noexec,size=16m',
        '--tmpfs=/run:rw,nosuid,nodev,noexec,size=8m',
        '--tmpfs=/job/work:rw,nosuid,nodev,size=64m',
        ...(outputVolume ? [`--mount=type=volume,source=${outputVolume},target=/job/output`] :
          [`--tmpfs=/job/output:rw,nosuid,nodev,noexec,size=${Math.max(1, Math.ceil(plan.maxOutputBytes / 1048576))}m`]),
        `--mount=type=bind,source=${input},target=/job/input,readonly`,
        '--workdir=/job/work', '--env=HOME=/job/work',
        plan.image, ...trustedArgv];
      let created: string;
      createAttempted = true;
      try { created = await boundedDockerCommand(this.dockerExecutable, args); }
      catch { throw new DockerSandboxError('CREATE_FAILED'); }
      const containerId = created.trim();
      if (!containerIdPattern.test(containerId)) throw new DockerSandboxError('CREATE_FAILED');
      const inspected = await boundedDockerCommand(this.dockerExecutable, ['inspect', containerId]);
      verifyEffectiveContainer(JSON.parse(inspected) as unknown, plan, input, outputVolume);
      const attached = await startAttached(this.dockerExecutable, containerId,
        plan.maxRuntimeSeconds * 1000, Math.min(plan.maxOutputBytes, 1_048_576));
      if (attached.stoppedFor === 'TIMEOUT') throw new DockerSandboxError('TIMED_OUT');
      if (attached.stoppedFor === 'OUTPUT') throw new DockerSandboxError('OUTPUT_LIMIT');
      const after = await boundedDockerCommand(this.dockerExecutable, ['inspect', containerId]);
      const state = JSON.parse(after) as DockerInspect[];
      const finalState = state[0]?.State;
      const exitCode = finalState?.ExitCode;
      if (finalState?.Status !== 'exited' || typeof finalState.StartedAt !== 'string' ||
        finalState.StartedAt.startsWith('0001-') || typeof finalState.FinishedAt !== 'string' ||
        finalState.FinishedAt.startsWith('0001-') ||
        typeof exitCode !== 'number' || !Number.isInteger(exitCode)) {
        throw new DockerSandboxError('START_FAILED');
      }
      result = Object.freeze({ exitCode, stdout: attached.stdout, stderr: attached.stderr });
      if (delivery && collectorName) {
        if (exitCode !== 0) throw new DockerSandboxError('EXECUTION_FAILED');
        await transferOutput(this.dockerExecutable, collectorName, outputRoot, plan.maxOutputBytes);
        const collected = await collectStoppedAttemptOutput(this.attemptRoot, attemptId,
          delivery.outputContract, { maxFileBytes: delivery.limits.maxFileBytes,
            maxResultBytes: Math.min(delivery.limits.maxResultBytes, plan.maxOutputBytes) });
        await delivery.consume(collected, outputRoot);
      }
    } catch (error) {
      failure = error;
    }
    let cleanupFailed = false;
    if (createAttempted) {
      try { await boundedDockerCommand(this.dockerExecutable, ['rm', '-f', name]); }
      catch { cleanupFailed = true; }
    }
    if (collectorCreated && collectorName) {
      try { await boundedDockerCommand(this.dockerExecutable, ['rm', '-f', collectorName]); }
      catch { cleanupFailed = true; }
    }
    if (volumeCreated && outputVolume) {
      try { await boundedDockerCommand(this.dockerExecutable, ['volume', 'rm', outputVolume]); }
      catch { cleanupFailed = true; }
    }
    if (delivery) {
      try { await rm(outputRoot, { recursive: true, force: true }); }
      catch { cleanupFailed = true; }
    }
    if (cleanupFailed) throw new DockerSandboxError('CLEANUP_FAILED');
    if (failure) throw failure;
    if (!result) throw new DockerSandboxError('START_FAILED');
    return result;
  }
}
