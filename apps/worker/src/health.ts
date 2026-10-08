import { execFileSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { OpenClawImageApproval } from '../../../packages/openclaw-adapter/src/image-approval.js';
import { WorkerCapabilityPackageStore } from './capability-package-store.js';
import type { PauseState, ReadinessResult } from './local-state.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';

export interface LocalHealthCheck {readonly code:string;readonly state:'HEALTHY'|'BLOCKING'|'UNKNOWN';
  readonly action:string}
export interface LocalHealthReport {readonly overall:'HEALTHY'|'PAUSED'|'OFFLINE'|'NOT_READY'|'SECURITY_WARNING';
  readonly acceptingNewJobs:boolean;readonly checkedAt:string;readonly checks:readonly LocalHealthCheck[];
  readonly runningJobs:number;readonly knownCapabilities:number;readonly cloudLastContactAt:string|null;
  readonly localPaused:boolean;readonly cloudPaused:boolean;readonly securityPaused:boolean;
  readonly cloudSyncPending:boolean;readonly openClawVersion:string|null;
  readonly openClawCompatibility:'APPROVED_PINNED'|'UNAVAILABLE'}

function imageConfiguration():{image:string;record:string;root:string;docker:string}|null{
  const image=process.env.KIVRO_OPENCLAW_APPROVED_IMAGE;
  const record=process.env.KIVRO_OPENCLAW_APPROVAL_RECORD;
  const root=process.env.KIVRO_OPENCLAW_RUNTIME_ROOT;
  if(!image||!record||!root||!isAbsolute(record)||!isAbsolute(root))return null;
  let docker:string;
  try{docker=execFileSync('which',['docker'],{encoding:'utf8',timeout:2000,
    stdio:['ignore','pipe','ignore']}).trim();}
  catch{return null;}
  return {image,record,root,docker};
}

/** Sanitized local diagnostics. Unknown prerequisites remain blocking for admission. */
export async function localHealth(stateDir:string,pause:PauseState,
  identityStatus:'METADATA_PRESENT'|'MISSING'|'INVALID',runningJobs:number,
  activeDiagnostics=false,deviceId:string|null=null):Promise<LocalHealthReport>{
  const checks:LocalHealthCheck[]=[];
  const add=(code:string,state:LocalHealthCheck['state'],action:string)=>checks.push({code,state,action});
  if(identityStatus!=='METADATA_PRESENT')add('DEVICE_IDENTITY', 'BLOCKING','Pair or repair the Worker identity');
  else add('DEVICE_IDENTITY','HEALTHY','Identity metadata present; cloud verifies possession on every request');
  try{execFileSync('docker',['version','--format','{{.Server.Version}}'],{encoding:'utf8',
    timeout:5000,stdio:['ignore','pipe','ignore'],maxBuffer:1024});
    add('DOCKER_DAEMON','HEALTHY','Docker daemon responds');}
  catch{add('DOCKER_DAEMON','BLOCKING','Start or repair Docker');}
  const config=imageConfiguration();
  let approvedOpenClawVersion:string|null=null;
  if(!config)add('APPROVED_SANDBOX_IMAGE','BLOCKING','Configure an exact approved image and private approval record');
  else try{const approval=await new OpenClawImageApproval(config.record,config.root,config.docker)
    .assertApprovedImage(config.image);
    approvedOpenClawVersion=approval.openClawVersion;
    add('APPROVED_SANDBOX_IMAGE','HEALTHY','Exact image, source and conformance approval match');}
  catch{add('APPROVED_SANDBOX_IMAGE','BLOCKING','Rebuild and rerun pinned runtime conformance before approval');}
  let knownCapabilities=0;
  let store:WorkerCapabilityPackageStore|undefined;
  try{store=new WorkerCapabilityPackageStore(resolve(stateDir));
    const packages=store.listInstalled();knownCapabilities=packages.length;
    const refs=[...new Set(packages.flatMap((item)=>
      item.permissionPolicy.sellerCredentialRefs))];
    const missingInference=packages.some((item)=>
      item.dependencyGraph.inference?.mode==='REMOTE_PROVIDER'&&
      item.permissionPolicy.sellerCredentialRefs.length===0);
    if(refs.length||missingInference){
      let allPresent=!!deviceId&&!missingInference;
      if(allPresent&&deviceId){
        const vault=new KeychainSellerCredentialVault(deviceId);
        for(const ref of refs){
          try{if(!await vault.exists(ref))allPresent=false;}
          catch{allPresent=false;}
        }
      }
      add('SELLER_INFERENCE_CREDENTIALS',allPresent?'HEALTHY':'BLOCKING',
        allPresent?'Every selected seller credential is present in the OS vault':
          'Configure or unlock every selected seller credential in the OS vault');
    }
    add('REVIEWED_PACKAGES','HEALTHY',`${packages.length} reviewed package(s) available`);
  }catch{add('REVIEWED_PACKAGES','BLOCKING','Repair private reviewed capability packages');}
  finally{store?.close();}
  const cloudAge=pause.lastCloudContactAt?Date.now()-Date.parse(pause.lastCloudContactAt):Infinity;
  add('EXECUTION_CAPACITY',pause.reportedCapacity>0&&knownCapabilities>0?'HEALTHY':'BLOCKING',
    pause.reportedCapacity>0&&knownCapabilities>0?'Execution loop announced reviewed capacity':
      'Worker is in control-only mode or has no reviewed runnable capability');
  if(!Number.isFinite(cloudAge)||cloudAge<0||cloudAge>30_000||pause.cloudSyncPending){
    add('CLOUD_CONNECTION','BLOCKING','Reconnect and synchronize Worker controls');
  }else add('CLOUD_CONNECTION','HEALTHY','Control plane contacted recently');
  if(pause.securityPaused)add('SECURITY_PAUSE','BLOCKING','Resolve the security block through authorized policy');
  if(pause.localPaused||pause.cloudPaused)add('SELLER_PAUSE','BLOCKING','Explicitly resume after readiness checks');
  if(activeDiagnostics&&config&&checks.find((check)=>check.code==='APPROVED_SANDBOX_IMAGE')?.state==='HEALTHY'){
    try{execFileSync(config.docker,['run','--rm','--network','none','--read-only',
      '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64',
      config.image,'--version'],{encoding:'utf8',timeout:15000,
      stdio:['ignore','pipe','ignore'],maxBuffer:1024});
      add('SANDBOX_SELF_TEST','HEALTHY','Pinned image runs under restrictive Docker options');}
    catch{add('SANDBOX_SELF_TEST','BLOCKING','Pinned sandbox self-test failed');}
  }
  const security=pause.securityPaused;
  const paused=pause.localPaused||pause.cloudPaused;
  const cloud=checks.find((check)=>check.code==='CLOUD_CONNECTION')?.state==='HEALTHY';
  const blocking=checks.some((check)=>check.state!=='HEALTHY'&&
    !['CLOUD_CONNECTION','SELLER_PAUSE'].includes(check.code));
  const overall=security?'SECURITY_WARNING':paused?'PAUSED':blocking?'NOT_READY':
    !cloud?'OFFLINE':'HEALTHY';
  return {overall,acceptingNewJobs:overall==='HEALTHY',checkedAt:new Date().toISOString(),
    checks,runningJobs,knownCapabilities,cloudLastContactAt:pause.lastCloudContactAt,
    localPaused:pause.localPaused,cloudPaused:pause.cloudPaused,securityPaused:pause.securityPaused,
    cloudSyncPending:pause.cloudSyncPending,openClawVersion:approvedOpenClawVersion,
    openClawCompatibility:approvedOpenClawVersion?'APPROVED_PINNED':'UNAVAILABLE'};
}

/** Resume may clear a local seller pause offline, but never ignores runtime/security blockers. */
export async function localResumeReadiness(stateDir:string,pause:PauseState,
  identityStatus:'METADATA_PRESENT'|'MISSING'|'INVALID',
  deviceId:string|null=null):Promise<ReadinessResult>{
  const report=await localHealth(stateDir,{...pause,localPaused:false,globalPaused:pause.cloudPaused},
    identityStatus,0,true,deviceId);
  const blocking=report.checks.filter((check)=>check.state!=='HEALTHY'&&
    !['CLOUD_CONNECTION','SELLER_PAUSE'].includes(check.code)).map((check)=>check.code);
  return {ready:blocking.length===0,checkedAt:report.checkedAt,blockingReasons:blocking};
}
