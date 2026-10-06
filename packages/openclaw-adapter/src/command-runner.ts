import { spawn } from 'node:child_process';

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

export interface OpenClawCommandRunner {
  run(args: readonly string[]): Promise<CommandResult>;
}

export type CommandFailureCode = 'UNAVAILABLE' | 'TIMED_OUT' | 'OUTPUT_LIMIT' | 'PROCESS_FAILED';

export class OpenClawCommandError extends Error {
  constructor(readonly code: CommandFailureCode) {
    super(`OpenClaw command failed: ${code}`);
    this.name = 'OpenClawCommandError';
  }
}

/**
 * Only version probing is proven side-effect free on the installed CLI.
 * `skills list --json` attempted to chmod personal state on OpenClaw 2026.8.2.
 * Config/skill inspection remains fixture-only until isolated read-only discovery is proven.
 */
const allowedCommands = new Set([
  '--version',
]);

export class LocalOpenClawCommandRunner implements OpenClawCommandRunner {
  constructor(
    private readonly executable = 'openclaw',
    private readonly timeoutMs = 10_000,
    private readonly maxOutputBytes = 2 * 1024 * 1024,
  ) {}

  run(args: readonly string[]): Promise<CommandResult> {
    if (!allowedCommands.has(args.join(' '))) {
      throw new TypeError('Unsupported OpenClaw inspection command');
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.executable, [...args], {
        shell: false,
        stdio: ['ignore', 'pipe', 'ignore'],
        detached: process.platform !== 'win32',
        env: { ...process.env, OPENCLAW_CONFIG_READONLY: '1' },
      });
      const terminate = (): void => {
        if (process.platform !== 'win32' && child.pid !== undefined) {
          try {
            process.kill(-child.pid, 'SIGKILL');
            return;
          } catch {
            // The process may have exited before the group signal was sent.
          }
        }
        child.kill('SIGKILL');
      };
      const chunks: Buffer[] = [];
      let size = 0;
      let failure: CommandFailureCode | undefined;
      const timeout = setTimeout(() => {
        failure = 'TIMED_OUT';
        terminate();
      }, this.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxOutputBytes) {
          failure = 'OUTPUT_LIMIT';
          terminate();
          return;
        }
        chunks.push(chunk);
      });

      child.on('error', () => {
        failure = 'UNAVAILABLE';
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (failure) {
          reject(new OpenClawCommandError(failure));
          return;
        }
        if (code === null) {
          reject(new OpenClawCommandError('PROCESS_FAILED'));
          return;
        }
        resolve({ exitCode: code, stdout: Buffer.concat(chunks).toString('utf8') });
      });
    });
  }
}
