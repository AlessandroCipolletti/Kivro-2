import { execFileSync } from 'node:child_process';
import { readSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { OpenClawDiscoveryAdapter } from '../../../packages/openclaw-adapter/src/discovery.js';
import { LocalOpenClawCommandRunner } from '../../../packages/openclaw-adapter/src/command-runner.js';
import { checkOpenClawCompatibility } from '../../../packages/openclaw-adapter/src/compatibility.js';
import { WorkerLocalState, WorkerStateError, openPrivateWorkerSqlite } from './local-state.js';
import { EncryptedDeviceIdentityStore, KeychainDeviceIdentityStore } from './device-identity.js';
import { WorkerJobControl, newLocalJobCommand } from './job-control.js';
import { DockerJobControlAdapter } from '../../../packages/sandbox-adapter/src/docker.js';
import { localHealth, localResumeReadiness } from './health.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';

interface Check {
  readonly name: string;
  readonly status: 'PASS' | 'FAIL';
  readonly detail: string;
}

function actorId(): string {
  return typeof process.getuid === 'function' ? `local:${process.getuid()}` : 'local:worker';
}

function stateDirectory(): string {
  return process.env.KIVRO_WORKER_STATE_DIR ?? join(homedir(), '.kivro', 'worker', 'state');
}

async function doctor(): Promise<readonly Check[]> {
  const inspection = await new OpenClawDiscoveryAdapter(new LocalOpenClawCommandRunner()).inspect();
  const compatibility = checkOpenClawCompatibility(inspection.detection.status === 'detected' ? inspection.detection.version : null);
  return [
    { name: 'OpenClaw installed', status: inspection.detection.status === 'detected' ? 'PASS' : 'FAIL', detail: inspection.detection.status === 'detected' ? inspection.detection.version : 'unavailable' },
    { name: 'OpenClaw discovery compatibility', status: compatibility.status === 'CANDIDATE' ? 'PASS' : 'FAIL', detail: `${compatibility.status}: ${compatibility.reason}; candidate ${compatibility.candidateVersion}` },
    { name: 'OpenClaw config', status: inspection.local.config === 'parsed' ? 'PASS' : 'FAIL', detail: `${inspection.local.config}; personal environment is discovery-only` },
  ];
}

function runningJobCount(): number {
  const db=openPrivateWorkerSqlite(stateDirectory(),'worker.sqlite');
  try {
    const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='local_job_execution'").get();
    if(!exists)return 0;
    const row=db.prepare(`SELECT count(*) AS count FROM local_job_execution WHERE status IN
      ('RUNNING','PAUSE_REQUESTED','PAUSED','RESUME_REQUESTED','SECURITY_PAUSED')`).get() as {count:number};
    return row.count;
  } finally {db.close();}
}

function help(): string {
  return 'Usage: kivro-worker pause --all|<capability-id> [--reason <text>] | resume --all|<capability-id> | stop --all --confirm | job pause|resume|cancel|status <job-id> | credential check <seller:ref> | credential set <seller:ref> --from-fd <fd> | health [--json] | doctor [--json] | device status [--json]';
}

async function credentialCommand(args:readonly string[],write:(line:string)=>void):Promise<number>{
  const identity=deviceStatus();
  if(!identity.deviceId){write('DEVICE_IDENTITY_UNAVAILABLE');return 1;}
  const vault=new KeychainSellerCredentialVault(identity.deviceId);
  try{
    if(args[0]==='check'&&args.length===2){
      write(await vault.exists(args[1]!)?'CONFIGURED':'MISSING');return 0;
    }
    if(args[0]==='set'&&args.length===4&&args[2]==='--from-fd'){
      const fd=Number(args[3]);
      if(!Number.isSafeInteger(fd)||fd<3||fd>64)throw new WorkerStateError(
        'INVALID_ARGUMENT',help());
      const bytes=Buffer.alloc(8193);let used=0;
      try{
        while(used<bytes.length){const size=readSync(fd,bytes,used,bytes.length-used,null);
          if(size===0)break;used+=size;}
        if(used===0||used>8192)throw new WorkerStateError('INVALID_ARGUMENT',
          'Credential must contain 1–8192 bytes');
        await vault.put(args[1]!,bytes.subarray(0,used));
      }finally{bytes.fill(0);}
      write('Credential stored in the local OS vault. No value was sent to Kivro cloud.');
      return 0;
    }
    write(help());return 2;
  }catch(error){
    write(error instanceof Error&&'code' in error&&typeof error.code==='string'?
      error.code:'CREDENTIAL_UNAVAILABLE');return 1;
  }
}

async function stopAll(args:readonly string[],write:(line:string)=>void):Promise<number>{
  if(args.length!==2||args[0]!=='--all'||args[1]!=='--confirm'){
    write('Stopping running jobs is irreversible. Re-run: kivro-worker stop --all --confirm');
    return 2;
  }
  let control:WorkerJobControl|undefined;
  try{
    const docker=execFileSync('which',['docker'],{encoding:'utf8',timeout:2_000}).trim();
    control=new WorkerJobControl(stateDirectory(),new DockerJobControlAdapter(docker),
      {check:async()=>({ready:false,checkedAt:new Date().toISOString(),
        blockingReasons:['STOP_ONLY']})},{maxPauseDurationMs:60_000});
    let stopped=0;
    for(const job of control.snapshots()){
      if(['STOPPED','CANCELLED','TIMED_OUT','CANCEL_REQUESTED'].includes(job.status))continue;
      await control.cancel(newLocalJobCommand(job.jobId,actorId(),'CLI',
        'SELLER_EMERGENCY_STOP_ALL'));
      stopped++;
    }
    write(`Stopped ${stopped} local job(s). Cloud reconciliation remains pending until connected.`);
    return 0;
  }catch(error){
    write(error instanceof Error&&'code' in error&&typeof error.code==='string'?
      error.code:'Emergency stop failed; inspect local jobs and Docker');
    return 1;
  }finally{control?.close();}
}

async function runJobCommand(args: readonly string[], write: (line: string) => void): Promise<number> {
  const action = args[0], jobId = args[1];
  if (!jobId || !['pause', 'resume', 'cancel', 'status'].includes(action ?? '') || args.length !== 2) {
    write(help()); return 2;
  }
  let control: WorkerJobControl | undefined;
  let local:WorkerLocalState|undefined;
  try {
    const docker = execFileSync('which', ['docker'], { encoding: 'utf8', timeout: 2_000 }).trim();
    const seconds = Number(process.env.KIVRO_MAX_PAUSE_DURATION_SECONDS ?? '14400');
    const state:WorkerLocalState=new WorkerLocalState(stateDirectory(),{
      check:()=>localResumeReadiness(stateDirectory(),state.snapshot(),
        deviceStatus().status,deviceStatus().deviceId),
    });
    local=state;
    control = new WorkerJobControl(stateDirectory(), new DockerJobControlAdapter(docker),
      {check:()=>localResumeReadiness(stateDirectory(),state.snapshot(),
        deviceStatus().status,deviceStatus().deviceId)},
      { maxPauseDurationMs: seconds * 1000 });
    if (action === 'status') {
      const snapshot = control.snapshot(jobId);
      write(JSON.stringify(snapshot)); return 0;
    }
    const command = newLocalJobCommand(jobId, actorId(), 'CLI');
    const result = action === 'pause' ? await control.pause(command) :
      action === 'resume' ? await control.resume(command) : await control.cancel(command);
    write(`${result.status}; local revision ${result.localRevision}; cloud sync ${result.cloudSyncPending ? 'pending' : 'acknowledged'}`);
    return 0;
  } catch (error) {
    write(error instanceof Error && 'code' in error && typeof error.code === 'string' ?
      error.code : 'Job control unavailable');
    return 1;
  } finally { control?.close();local?.close(); }
}

function deviceStatus(): { readonly status: 'METADATA_PRESENT' | 'MISSING' | 'INVALID'; readonly storage: 'OS_KEYCHAIN' | 'ENCRYPTED_FILE' | null; readonly deviceId: string | null; readonly pairing: 'UNKNOWN' } {
  const directory = stateDirectory();
  const candidates: { storage: 'OS_KEYCHAIN' | 'ENCRYPTED_FILE'; deviceId: string }[] = [];
  try {
    candidates.push({ storage: 'OS_KEYCHAIN', deviceId: new KeychainDeviceIdentityStore(directory).readPublic().deviceId });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'NOT_FOUND')) {
      return { status: 'INVALID', storage: null, deviceId: null, pairing: 'UNKNOWN' };
    }
  }
  try {
    candidates.push({ storage: 'ENCRYPTED_FILE', deviceId: new EncryptedDeviceIdentityStore(directory).readPublic().deviceId });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'NOT_FOUND')) {
      return { status: 'INVALID', storage: null, deviceId: null, pairing: 'UNKNOWN' };
    }
  }
  if (candidates.length !== 1) return { status: candidates.length === 0 ? 'MISSING' : 'INVALID', storage: null, deviceId: null, pairing: 'UNKNOWN' };
  const candidate = candidates[0];
  if (!candidate) throw new Error('Missing device candidate');
  return { status: 'METADATA_PRESENT', storage: candidate.storage, deviceId: candidate.deviceId, pairing: 'UNKNOWN' };
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
  if (command === 'job') return runJobCommand(args.slice(1), write);
  if (command === 'stop') return stopAll(args.slice(1),write);
  if (command === 'credential') return credentialCommand(args.slice(1),write);
  if (!['pause', 'resume', 'health', 'doctor', 'device'].includes(command ?? '')) {
    write(help());
    return 2;
  }
  let state: WorkerLocalState;
  try {
    if (command === 'device') {
      if (args[1] !== 'status' || args.length > 3 || (args.length === 3 && args[2] !== '--json')) {
        throw new WorkerStateError('INVALID_ARGUMENT', help());
      }
      const status = deviceStatus();
      write(args[2] === '--json' ? JSON.stringify(status) : `Device identity: ${status.status}${status.storage ? ` (${status.storage})` : ''}; cloud pairing ${status.pairing}`);
      return status.status === 'INVALID' ? 1 : 0;
    }
    let local:WorkerLocalState;
    state = local = new WorkerLocalState(stateDirectory(),{
      check:()=>localResumeReadiness(stateDirectory(),local.snapshot(),
        deviceStatus().status,deviceStatus().deviceId),
    });
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
      const report = await localHealth(stateDirectory(),snapshot,deviceStatus().status,
        runningJobCount(),false,deviceStatus().deviceId);
      write(args[1] === '--json' ? JSON.stringify(report) : [
        `Worker health: ${report.overall}`,
        `Local pause: ${report.localPaused ? 'ON' : 'OFF'}`,
        `Cloud pause: ${report.cloudPaused ? 'ON' : 'OFF'}`,
        `Security pause: ${report.securityPaused ? 'ON' : 'OFF'}`,
        `Last cloud contact: ${report.cloudLastContactAt??'none'}`,
        `Running jobs: ${report.runningJobs}`,
        ...report.checks.map((check)=>`${check.code}: ${check.state} — ${check.action}`),
        `New jobs: ${report.acceptingNewJobs?'READY':'BLOCKED'}`,
      ].join('\n'));
      return 0;
    }

    const health=await localHealth(stateDirectory(),snapshot,deviceStatus().status,
      runningJobCount(),true,deviceStatus().deviceId);
    const checks = [...await doctor(),...health.checks.map((check)=>({name:check.code,
      status:check.state==='HEALTHY'?'PASS' as const:'FAIL' as const,detail:check.action}))];
    const report = { overall: health.overall, checks };
    write(args[1] === '--json' ? JSON.stringify(report) : checks.map((check) => `${check.name}: ${check.status} (${check.detail})`).join('\n'));
    return checks.some((check) => check.status === 'FAIL') ? 1 : 0;
  } catch (error) {
    write(error instanceof WorkerStateError ? `${error.code}: ${error.message}` : 'Worker command failed');
    return 1;
  } finally {
    state.close();
  }
}
