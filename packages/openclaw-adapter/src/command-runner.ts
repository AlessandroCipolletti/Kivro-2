import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
 * Only version probing is permitted and it runs with an isolated temporary home.
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
      const scratch = mkdtempSync(join(tmpdir(), 'kivro-openclaw-version-'));
      const child = spawn(this.executable, [...args], {
        shell: false,
        stdio: ['ignore', 'pipe', 'ignore'],
        detached: process.platform !== 'win32',
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          HOME: scratch,
          XDG_CONFIG_HOME: join(scratch, 'xdg'),
          OPENCLAW_HOME: scratch,
          OPENCLAW_STATE_DIR: join(scratch, 'state'),
          OPENCLAW_CONFIG_PATH: join(scratch, 'openclaw.json'),
          OPENCLAW_OFFLINE: '1',
          OPENCLAW_LOAD_SHELL_ENV: '0',
          OPENCLAW_CONFIG_READONLY: '1',
          NODE_ENV: 'production',
        },
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
        try { rmSync(scratch, { recursive: true, force: true }); }
        catch { reject(new OpenClawCommandError('PROCESS_FAILED')); return; }
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
