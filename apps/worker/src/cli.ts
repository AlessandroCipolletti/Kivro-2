import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { homedir, hostname, platform } from 'node:os';
import { join } from 'node:path';
import { OpenClawDiscoveryAdapter } from '../../../packages/openclaw-adapter/src/discovery.js';
import { LocalOpenClawCommandRunner } from '../../../packages/openclaw-adapter/src/command-runner.js';
import { ReadOnlyOpenClawDiscovery } from '../../../packages/openclaw-adapter/src/read-only-discovery.js';
import { buildSuggestedDependencyGraph } from '../../../packages/openclaw-adapter/src/dependency-candidates.js';
import { analyzeDependencyGraph } from '../../../packages/domain/src/dependency-graph.js';
import { checkOpenClawCompatibility } from '../../../packages/openclaw-adapter/src/compatibility.js';
import { WorkerLocalState, WorkerStateError, openPrivateWorkerSqlite } from './local-state.js';
import { EncryptedDeviceIdentityStore, KeychainDeviceIdentityStore } from './device-identity.js';
import { WorkerJobControl, newLocalJobCommand } from './job-control.js';
import { DockerJobControlAdapter } from '../../../packages/sandbox-adapter/src/docker.js';
import { localHealth, localResumeReadiness } from './health.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';
import { workerPairingProofBytes } from '../../../packages/persistence/src/worker-pairing.js';
import { unlockIdentity } from './control-sync-runtime.js';
import { SellerImportDraftStore } from './import-drafts.js';
import { pairedSellerForDevice, rememberPairedSeller } from './paired-seller.js';
import { prepareSelectedPackage, WorkerUnreviewedPackageStore } from './import-package.js';
import { runWorkerImportReview } from './import-review-command.js';
import { runGuidedImport } from './guided-import.js';
import { readLocalPermissionReview } from './import-permission-review.js';

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
  return 'Usage: kivro-worker pair <code> | discover [--json] | import guided | import start <skill-name> | import show <draft-id> [--json] | import declare <draft-id> database|api <resource-id> <label> | import select <draft-id> <dependency-id> --allow|--deny | import inference <draft-id> remote <provider> <model> <seller:credential-ref> | import inference <draft-id> local <provider> <model> <endpoint-ref> | import package <draft-id> <private-config.json> | import review <version-id> <private-review.json> | import review-retry <version-id> | import permissions <version-id> [--against <prior-version-id>] | pause --all|<capability-id> [--reason <text>] | resume --all|<capability-id> | stop --all --confirm | job pause|resume|cancel|status <job-id> | credential check <seller:ref> | credential set <seller:ref> --from-fd <fd> | health [--json] | doctor [--json] | device status [--json]';
}

function readPrivateAuthoring(path: string): unknown {
  if (constants.O_NOFOLLOW === undefined) throw new Error('PRIVATE_CONFIG_UNAVAILABLE');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 2 || stat.size > 65_536 ||
      (stat.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && stat.uid !== process.getuid())) {
      throw new Error('PRIVATE_CONFIG_UNSAFE');
    }
    const bytes=Buffer.alloc(65_537);let used=0;
    while(used<bytes.length){
      const count=readSync(fd,bytes,used,bytes.length-used,used);
      if(count===0)break;
      used+=count;
    }
    const after=fstatSync(fd);
    if(used>65_536||used!==stat.size||after.dev!==stat.dev||
      after.ino!==stat.ino||after.mtimeMs!==stat.mtimeMs)
      throw new Error('PRIVATE_CONFIG_CHANGED');
    return JSON.parse(bytes.subarray(0,used).toString('utf8'));
  } finally { closeSync(fd); }
}

async function discover(args: readonly string[], write: (line: string) => void): Promise<number> {
  if (args.length > 1 || args.length === 1 && args[0] !== '--json') {
    write(help()); return 2;
  }
  try {
    const snapshot = await new ReadOnlyOpenClawDiscovery().scan();
    if (args[0] === '--json') write(JSON.stringify(snapshot));
    else write([
      `Read-only OpenClaw discovery: ${snapshot.status}`,
      ...snapshot.skills.map((skill) =>
        `${skill.name} (${skill.source}; metadata ${skill.metadata}; readiness unknown${skill.ambiguous ? '; ambiguous' : ''})`),
      ...snapshot.issues.map((issue) => `Uncertainty: ${issue}`),
      'Discovery is local and grants no Kivro permissions. Select and approve resources separately before publication.',
    ].join('\n'));
    return snapshot.status === 'unavailable' ? 1 : 0;
  } catch {
    write('READ_ONLY_DISCOVERY_UNAVAILABLE'); return 1;
  }
}

function pairingEndpoint(): URL {
  const configured=process.env.KIVRO_CLOUD_URL;
  if(!configured)throw new Error('CLOUD_URL_NOT_CONFIGURED');
  const url=new URL('/api/seller/pairing/redeem',configured);
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'&&
    process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&process.env.NODE_ENV!=='production'))
    throw new Error('PAIRING_REQUIRES_HTTPS');
  return url;
}

function boundedCliCode(value:unknown,fallback:string):string{
  return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value)?
    value:fallback;
}

async function pairDevice(args:readonly string[],write:(line:string)=>void):Promise<number>{
  if(args.length!==1||! /^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/.test(args[0]??'')){
    write(help());return 2;
  }
  try{
    const endpoint=pairingEndpoint();
    const directory=stateDirectory();
    const local=openPrivateWorkerSqlite(directory,'worker.sqlite');local.close();
    const keychain=new KeychainDeviceIdentityStore(directory);
    const status=deviceStatus();
    if(status.status==='INVALID')throw new Error('DEVICE_IDENTITY_INVALID');
    if(status.status==='MISSING')await keychain.create();
    const identity=await unlockIdentity(directory);
    const code=args[0]!;
    const proof=workerPairingProofBytes(code,identity.deviceId,identity.publicKeyPem);
    const response=await fetch(endpoint,{method:'POST',redirect:'error',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({code,deviceId:identity.deviceId,
        publicKeyPem:identity.publicKeyPem,
        possessionSignature:identity.signChallenge(proof).toString('base64url'),
        name:hostname().slice(0,120)||'Seller computer',
        platform:platform()==='darwin'?'MACOS':platform()==='win32'?'WINDOWS':'LINUX',
        workerRelease:process.env.KIVRO_WORKER_RELEASE??'0.0.0-dev'}),
      signal:AbortSignal.timeout(10_000)});
    const body=await response.json() as {code?:string;deviceId?:string;
      sellerAccountId?:string;sellerProfileId?:string};
    if(!response.ok||body.deviceId!==identity.deviceId){
      write(boundedCliCode(body.code,'PAIRING_FAILED'));return 1;
    }
    rememberPairedSeller(directory,body);
    write(`Worker paired: ${identity.deviceId}. Start the Worker control connection to report health.`);
    return 0;
  }catch(error){
    const code=error instanceof Error&&'code' in error?
      boundedCliCode(error.code,'PAIRING_FAILED'):'PAIRING_FAILED';
    const known=error instanceof Error&&[
      'CLOUD_URL_NOT_CONFIGURED','PAIRING_REQUIRES_HTTPS',
      'DEVICE_IDENTITY_INVALID','WORKER_IDENTITY_NOT_UNLOCKED',
      'INSECURE_PASSPHRASE_FILE'].includes(error.message)?error.message:code;
    write(known);return 1;
  }
}

/** Drafts contain only the seller's selected skill graph and never leave this Worker. */
async function importCommand(args:readonly string[],write:(line:string)=>void):Promise<number>{
  const status=deviceStatus();
  if(status.status!=='METADATA_PRESENT'||!status.deviceId){
    write('DEVICE_IDENTITY_UNAVAILABLE');return 1;
  }
  const owner=pairedSellerForDevice(stateDirectory(),status.deviceId);
  if(!owner){write('PAIRING_REQUIRED');return 1;}
  const store=new SellerImportDraftStore(stateDirectory());
  try{
    if(args[0]==='permissions'&&
      (args.length===2||args.length===4&&args[2]==='--against')){
      const result=readLocalPermissionReview(stateDirectory(),status.deviceId,
        args[1]!,args.length===4?args[3]:undefined);
      write(JSON.stringify(result,null,2));
      return 0;
    }
    if(args[0]==='guided'&&args.length===1){
      if(!process.stdin.isTTY||!process.stderr.isTTY){write('INTERACTIVE_REQUIRED');return 2;}
      const signer=await unlockIdentity(stateDirectory());
      if(signer.deviceId!==status.deviceId)throw new Error('DEVICE_IDENTITY_MISMATCH');
      const terminal=createInterface({input:process.stdin,output:process.stderr});
      try{
        await runGuidedImport({stateDir:stateDirectory(),
          sellerAccountId:owner.sellerAccountId,signer,
          ask:(prompt)=>terminal.question(prompt),write});
      }finally{terminal.close();}
      return 0;
    }
    if(args[0]==='start'&&args.length===2){
      const discovery=await new ReadOnlyOpenClawDiscovery().scan();
      const graph=buildSuggestedDependencyGraph(discovery,args[1]!);
      const draft=store.createDraft(randomUUID(),owner.sellerAccountId,graph);
      write(JSON.stringify({draftId:draft.id,graphHash:draft.graphHash,
        selectedDependencies:0,readiness:'UNKNOWN',
        discoveryIssues:discovery.issues,
        dependencies:draft.graph.nodes.map((node)=>({id:node.id,name:node.name,
          type:node.type,requirement:node.requirement,sensitivity:node.sensitivity,
          confidence:node.confidence,health:node.health})),
        next:'Review each dependency locally. Use import select <draft-id> <dependency-id> --allow or --deny. No resource is approved automatically.'}));
      return 0;
    }
    if(args[0]==='show'&&(args.length===2||args.length===3&&args[2]==='--json')){
      const draft=store.getDraft(args[1]!,owner.sellerAccountId);
      const analysis=analyzeDependencyGraph(draft.graph);
      write(args[2]==='--json'?JSON.stringify({draft,analysis}):[
        `Local draft ${draft.id}, revision ${draft.revision}`,
        ...draft.graph.nodes.map((node)=>`${node.selected?'SELECTED':'NOT SELECTED'} ${node.type} ${node.name} (${node.id}; ${node.health.toLowerCase()} health)`),
        ...analysis.issues.map((issue)=>`Publication check: ${issue.code} (${issue.dependencyId})`),
        'Selections are local review only. Publication requires separate permission consent and tests.',
      ].join('\n'));
      return 0;
    }
    if(args[0]==='select'&&args.length===4&&
      (args[3]==='--allow'||args[3]==='--deny')){
      const draft=store.getDraft(args[1]!,owner.sellerAccountId);
      const next=store.applySelection({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:owner.sellerAccountId,dependencyId:args[2],
        selected:args[3]==='--allow',expectedRevision:draft.revision,
        actedAt:new Date().toISOString()});
      write(`Local selection recorded. Revision ${next.revision}. This does not grant runtime access or publish a capability.`);
      return 0;
    }
    if(args[0]==='declare'&&args.length===5&&
      ['database','api','file','directory'].includes(args[2]!)){
      const draft=store.getDraft(args[1]!,owner.sellerAccountId);
      const next=store.declareResource({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:owner.sellerAccountId,expectedRevision:draft.revision,
        actedAt:new Date().toISOString(),resourceId:args[3]!,name:args[4]!,
        type:({database:'DATABASE',api:'PRIVATE_API',file:'LOCAL_FILE',
          directory:'LOCAL_DIRECTORY'} as const)[args[2] as 'database'|'api'|'file'|'directory']});
      write(JSON.stringify({draftId:next.id,revision:next.revision,
        resourceId:args[3],selected:false,
        next:'Review and select this declaration explicitly, then bind its exact policy and a local vault credential in the private package. Declaration itself grants nothing.'}));
      return 0;
    }
    if(args[0]==='inference'&&args.length===6&&
      (args[2]==='remote'||args[2]==='local')){
      const draft=store.getDraft(args[1]!,owner.sellerAccountId);
      const common={actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:owner.sellerAccountId,expectedRevision:draft.revision,
        actedAt:new Date().toISOString(),provider:args[3]!,model:args[4]!};
      const next=store.configureInference(args[2]==='remote'
        ? {...common,mode:'REMOTE_PROVIDER',credentialRef:args[5]!}
        : {...common,mode:'LOCAL',endpointRef:args[5]!});
      write(JSON.stringify({draftId:next.id,revision:next.revision,
        inference:next.graph.inference,
        candidates:next.graph.nodes.filter((node)=>node.discoveredFrom.includes('SELLER_DECLARATION'))
          .map((node)=>({id:node.id,type:node.type,name:node.name,selected:node.selected,
            health:node.health})),
        next:'These are unselected candidates. Review and select each required resource separately; configure dedicated credentials locally. Inference remains blocked until tested and explicitly consented.'}));
      return 0;
    }
    if(args[0]==='package'&&args.length===3){
      const draft=store.getDraft(args[1]!,owner.sellerAccountId);
      const authored=readPrivateAuthoring(args[2]!);
      const prepared=await prepareSelectedPackage(draft,authored,
        {sellerAccountId:owner.sellerAccountId,workerDeviceId:status.deviceId},
        new ReadOnlyOpenClawDiscovery());
      const packages=new WorkerUnreviewedPackageStore(stateDirectory());
      try{
        const staged=packages.stage(draft,prepared);
        write(JSON.stringify({...staged,state:'UNREVIEWED',
          next:'Run isolated dependency, representative-job and security tests before seller review or publication.'}));
      }finally{packages.close();}
      return 0;
    }
    if((args[0]==='review'&&args.length===3)||
      (args[0]==='review-retry'&&args.length===2)){
      const signer=await unlockIdentity(stateDirectory());
      if(signer.deviceId!==status.deviceId)
        throw new Error('DEVICE_IDENTITY_MISMATCH');
      const result=await runWorkerImportReview({stateDir:stateDirectory(),
        versionId:args[1]!,sellerAccountId:owner.sellerAccountId,signer,
        retry:args[0]==='review-retry',
        ...(args[0]==='review'?{privateConfig:readPrivateAuthoring(args[2]!)}:{})});
      write(JSON.stringify({...result,
        next:'Open the seller dashboard to review the exact tested package and approve publication. Discovery and local testing do not grant consent.'}));
      return 0;
    }
    write(help());return 2;
  }catch(error){
    write(error instanceof Error&&'code' in error?
      boundedCliCode(error.code,'IMPORT_UNAVAILABLE_OR_AMBIGUOUS'):
      error instanceof Error&&error.message==='PAIRING_OWNER_CHANGED'?
        error.message:'IMPORT_UNAVAILABLE_OR_AMBIGUOUS');
    return 1;
  }finally{store.close();}
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
  if (command === 'pair') return pairDevice(args.slice(1),write);
  if (command === 'discover') return discover(args.slice(1),write);
  if (command === 'import') return importCommand(args.slice(1),write);
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
