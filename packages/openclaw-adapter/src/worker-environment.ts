import { lstatSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface WorkerEnvironmentPaths {
  readonly workerRoot: string;
  readonly configPath: string;
  readonly stateDir: string;
  readonly workspaceDir: string;
  readonly skillsDir: string;
  readonly xdgConfigDir: string;
}

export class WorkerEnvironmentError extends Error {
  constructor(readonly code: 'INVALID_WORKER_ID' | 'UNPINNED_IMAGE' | 'INSECURE_PATH' | 'ALREADY_EXISTS') {
    super(`Worker environment unavailable: ${code}`);
    this.name = 'WorkerEnvironmentError';
  }
}

function assertPrivateDirectory(path: string): void {
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
    throw new WorkerEnvironmentError('INSECURE_PATH');
  }
}

function createPrivateDirectory(path: string): void {
  mkdirSync(path, { mode: 0o700 });
  assertPrivateDirectory(path);
}

function baseConfig(image: string): object {
  return {
    agents: {
      defaults: {
        sandbox: {
          mode: 'all',
          backend: 'docker',
          scope: 'session',
          workspaceAccess: 'none',
          docker: {
            image,
            readOnlyRoot: true,
            tmpfs: ['/tmp', '/var/tmp', '/run'],
            network: 'none',
            capDrop: ['ALL'],
            pidsLimit: 128,
            memory: '1g',
            cpus: 1,
          },
        },
      },
    },
    tools: {
      allow: ['read'],
      deny: ['exec', 'process', 'write', 'edit', 'apply_patch', 'browser', 'gateway', 'nodes', 'cron'],
      elevated: { enabled: false },
    },
  };
}

/** Creates a fresh, private worker profile. Its config is a restricted baseline, not execution proof. */
export function createWorkerEnvironment(baseDirectory: string, workerId: string, sandboxImage: string): WorkerEnvironmentPaths {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,48}$/i.test(workerId)) throw new WorkerEnvironmentError('INVALID_WORKER_ID');
  if (!/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/.test(sandboxImage)) {
    throw new WorkerEnvironmentError('UNPINNED_IMAGE');
  }
  const base = resolve(baseDirectory);
  assertPrivateDirectory(base);
  const workersDir = join(base, 'workers');
  try {
    createPrivateDirectory(workersDir);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') assertPrivateDirectory(workersDir);
    else throw error;
  }
  const workerRoot = join(workersDir, workerId);
  try {
    createPrivateDirectory(workerRoot);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') throw new WorkerEnvironmentError('ALREADY_EXISTS');
    throw error;
  }
  try {
    const configDir = join(workerRoot, 'config');
    const stateDir = join(workerRoot, 'state');
    const workspaceDir = join(workerRoot, 'workspace');
    const skillsDir = join(workerRoot, 'skills');
    const xdgConfigDir = join(workerRoot, 'xdg');
    for (const dir of [configDir, stateDir, workspaceDir, skillsDir, xdgConfigDir]) createPrivateDirectory(dir);
    const configPath = join(configDir, 'openclaw.json');
    writeFileSync(configPath, JSON.stringify(baseConfig(sandboxImage)), { flag: 'wx', mode: 0o600 });
    return { workerRoot, configPath, stateDir, workspaceDir, skillsDir, xdgConfigDir };
  } catch (error) {
    rmSync(workerRoot, { recursive: true, force: true });
    throw error;
  }
}

/** Inherited seller env is deliberately excluded, including provider credentials and OpenClaw defaults. */
export function isolatedOpenClawEnvironment(paths: WorkerEnvironmentPaths, executablePath: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    PATH: executablePath,
    HOME: paths.workerRoot,
    XDG_CONFIG_HOME: paths.xdgConfigDir,
    OPENCLAW_HOME: paths.workerRoot,
    OPENCLAW_STATE_DIR: paths.stateDir,
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_WORKSPACE_DIR: paths.workspaceDir,
    OPENCLAW_OFFLINE: '1',
    OPENCLAW_LOAD_SHELL_ENV: '0',
  };
}
