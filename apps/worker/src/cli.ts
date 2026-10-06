import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { OpenClawDiscoveryAdapter } from '../../../packages/openclaw-adapter/src/discovery.js';
import { LocalOpenClawCommandRunner } from '../../../packages/openclaw-adapter/src/command-runner.js';
import { WorkerLocalState, WorkerStateError } from './local-state.js';

interface Check {
  readonly name: string;
  readonly status: 'PASS' | 'FAIL';
  readonly detail: string;
}

const unmetReadiness = {
  async check() {
    return { ready: false, checkedAt: new Date().toISOString(), blockingReasons: ['runtime isolation and cloud identity are not configured'] };
  },
};

function actorId(): string {
  return typeof process.getuid === 'function' ? `local:${process.getuid()}` : 'local:worker';
}

function stateDirectory(): string {
  return process.env.KIVRO_WORKER_STATE_DIR ?? join(homedir(), '.kivro', 'worker', 'state');
}

function checkDocker(): Check {
  try {
    execFileSync('docker', ['version', '--format', '{{.Server.Version}}'], {
      encoding: 'utf8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1024,
    });
    return { name: 'Docker', status: 'PASS', detail: 'daemon responds' };
  } catch {
    return { name: 'Docker', status: 'FAIL', detail: 'daemon unavailable' };
  }
}

async function doctor(): Promise<readonly Check[]> {
  const inspection = await new OpenClawDiscoveryAdapter(new LocalOpenClawCommandRunner()).inspect();
  return [
    { name: 'OpenClaw installed', status: inspection.detection.status === 'detected' ? 'PASS' : 'FAIL', detail: inspection.detection.status === 'detected' ? inspection.detection.version : 'unavailable' },
    { name: 'OpenClaw compatibility', status: 'FAIL', detail: 'supported version policy is not configured' },
    { name: 'OpenClaw config', status: inspection.config === 'valid' ? 'PASS' : 'FAIL', detail: inspection.config },
    checkDocker(),
    { name: 'Sandbox isolation', status: 'FAIL', detail: 'no verified effective policy or self-test' },
    { name: 'Device identity', status: 'FAIL', detail: 'no paired identity' },
    { name: 'Cloud connection', status: 'FAIL', detail: 'not connected' },
  ];
}

function help(): string {
  return 'Usage: kivro-worker pause --all|<capability-id> [--reason <text>] | resume --all|<capability-id> | health [--json] | doctor [--json]';
}

function parseReason(args: readonly string[]): string | undefined {
  const index = args.indexOf('--reason');
  if (index === -1) return undefined;
  if (index !== 1 || args.length !== 3 || args[2] === undefined) throw new WorkerStateError('INVALID_ARGUMENT', help());
  return args[2];
}

/** Host-native CLI; success for pause means the local database committed. */
export async function runWorkerCli(args: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Promise<number> {
  const command = args[0];
  if (!['pause', 'resume', 'health', 'doctor'].includes(command ?? '')) {
    write(help());
    return 2;
  }
  let state: WorkerLocalState;
  try {
    state = new WorkerLocalState(stateDirectory(), unmetReadiness);
  } catch (error) {
    write(error instanceof WorkerStateError ? `${error.code}: ${error.message}` : 'Worker state unavailable');
    return 1;
  }
  try {
    if (command === 'pause' || command === 'resume') {
      const target = args[1];
      if (!target) throw new WorkerStateError('INVALID_ARGUMENT', help());
      const reason = command === 'pause' ? parseReason(args.slice(1)) : undefined;
      if (command === 'resume' && args.length !== 2) throw new WorkerStateError('INVALID_ARGUMENT', help());
      if (command === 'pause' && reason === undefined && args.length !== 2) throw new WorkerStateError('INVALID_ARGUMENT', help());
      const actor = actorId();
      if (command === 'pause') {
        const result = target === '--all' ? state.pauseAll(actor, 'LOCAL_CLI', reason) : state.pauseCapability(target, actor, 'LOCAL_CLI', reason);
        write(`Paused new jobs locally. Revision ${result.localRevision}.`);
      } else {
        const result = target === '--all' ? await state.resumeAll(actor) : await state.resumeCapability(target, actor);
        write(`Resume checks passed. Revision ${result.localRevision}.`);
      }
      return 0;
    }

    if (args.length > 2 || (args.length === 2 && args[1] !== '--json')) throw new WorkerStateError('INVALID_ARGUMENT', help());
    const snapshot = state.snapshot();
    if (command === 'health') {
      const report = {
        overall: 'NOT_READY',
        acceptingNewJobs: false,
        globalPaused: snapshot.globalPaused,
        securityPaused: snapshot.securityPaused,
        capabilityPauseCount: snapshot.capabilityPauses.length,
        cloudSyncPending: snapshot.cloudSyncPending,
        cloudConnection: 'OFFLINE',
        runningJobs: null,
        queuedJobs: null,
      };
      write(args[1] === '--json' ? JSON.stringify(report) : [
        'Worker health: NOT_READY',
        `Global pause: ${report.globalPaused ? 'ON' : 'OFF'}`,
        `Security pause: ${report.securityPaused ? 'ON' : 'OFF'}`,
        `Cloud connection: ${report.cloudConnection}`,
        'New jobs: BLOCKED',
      ].join('\n'));
      return 0;
    }

    const checks = await doctor();
    const report = { overall: 'NOT_READY', checks };
    write(args[1] === '--json' ? JSON.stringify(report) : checks.map((check) => `${check.name}: ${check.status} (${check.detail})`).join('\n'));
    return checks.some((check) => check.status === 'FAIL') ? 1 : 0;
  } catch (error) {
    write(error instanceof WorkerStateError ? `${error.code}: ${error.message}` : 'Worker command failed');
    return 1;
  } finally {
    state.close();
  }
}
