import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { SellerCompletionBroker } from
  '../../../packages/application/src/completion-broker.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
import { NetsonsWorkerJobCloud } from
  '../../../packages/infrastructure/netsons/src/job-cloud.js';
import { discoverWorkerControlPlanes, HttpsPollingWorkerTransport } from
  '../../../packages/infrastructure/netsons/src/https-polling.js';
import { OpenClawImageApproval } from
  '../../../packages/openclaw-adapter/src/image-approval.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from
  '../../../packages/sandbox-adapter/src/docker.js';
import { WorkerAvailabilityReporter } from './availability-reporter.js';
import { WorkerCapabilityPackageStore } from './capability-package-store.js';
import { unlockIdentity } from './control-sync-runtime.js';
import { WorkerDispatchLoop } from './dispatch-loop.js';
import { WorkerExecutionSupervisor } from './execution-supervisor.js';
import { WorkerImportReviewOutbox } from './import-review-outbox.js';
import { privateAttemptRoot } from './import-review-command.js';
import { WorkerJobControl } from './job-control.js';
import { localResumeReadiness } from './health.js';
import { WorkerLocalState } from './local-state.js';
import { pairedSellerForDevice } from './paired-seller.js';
import { WorkerProviderUsage } from './provider-usage.js';
import { WorkerResultOutbox } from './result-outbox.js';
import { WorkerRuntimeReadiness } from './runtime-readiness.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';

function required(name:string):string{
  const value=process.env[name];
  if(!value)throw new Error(`WORKER_${name}_MISSING`);
  return value;
}

function storageOrigin(raw:string,allowLocalHttp:boolean):string{
  const url=new URL(raw);
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    (url.protocol!=='https:'&&!(allowLocalHttp&&local&&url.protocol==='http:')))
    throw new Error('WORKER_STORAGE_ORIGIN_INVALID');
  return url.origin;
}

/** Host-native paid composition. Dispatch and job state remain in shared Worker
 * classes; HTTPS is only the current transport. Missing security prerequisites
 * abort startup before any paid offer can be accepted. */
export async function runWorkerExecution(signal:AbortSignal):Promise<void>{
  const stateDir=process.env.KIVRO_WORKER_STATE_DIR??
    join(homedir(),'.kivro','worker','state');
  const signer=await unlockIdentity(stateDir);
  const owner=pairedSellerForDevice(stateDir,signer.deviceId);
  if(!owner)throw new Error('WORKER_PAIRING_REQUIRED');
  const allowLocalHttp=process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&
    process.env.NODE_ENV!=='production';
  const discovered=await discoverWorkerControlPlanes(required('WORKER_DISCOVERY_URL'),
    {allowLocalHttp});
  if(discovered.filter((plane)=>plane.state==='ACTIVE').length!==1)
    throw new Error('WORKER_ACTIVE_PLANE_AMBIGUOUS');
  if(discovered.length!==1)
    throw new Error('WORKER_MULTIPLANE_NOT_READY');
  const image=required('KIVRO_OPENCLAW_APPROVED_IMAGE');
  const collector=required('KIVRO_OUTPUT_COLLECTOR_IMAGE');
  if(collector!==image)throw new Error('WORKER_COLLECTOR_NOT_APPROVED');
  const record=required('KIVRO_OPENCLAW_APPROVAL_RECORD');
  const source=required('KIVRO_OPENCLAW_RUNTIME_ROOT');
  const origin=storageOrigin(required('KIVRO_STORAGE_ORIGIN'),allowLocalHttp);
  const docker=execFileSync('which',['docker'],{encoding:'utf8',timeout:2_000,
    stdio:['ignore','pipe','ignore']}).trim();
  const attemptRoot=privateAttemptRoot(stateDir);
  const imageApproval=new OpenClawImageApproval(record,source,docker);
  const approved=await imageApproval.assertApprovedImage(image);
  const sandbox=new DockerSandboxAdapter({dockerExecutable:docker,
    approvedImage:image,collectorImage:collector,attemptRoot});
  const control=new DockerJobControlAdapter(docker);
  const packages=new WorkerCapabilityPackageStore(stateDir);
  const reviews=new WorkerImportReviewOutbox(stateDir);
  const vault=new KeychainSellerCredentialVault(signer.deviceId);
  const usage=new WorkerProviderUsage(stateDir);
  const outbox=new WorkerResultOutbox(stateDir);
  const local:WorkerLocalState=new WorkerLocalState(stateDir,{check:()=>localResumeReadiness(stateDir,
    local.snapshot(),'METADATA_PRESENT',signer.deviceId)});
  const jobs=new WorkerJobControl(stateDir,control,
    {check:()=>localResumeReadiness(stateDir,local.snapshot(),
      'METADATA_PRESENT',signer.deviceId)},
    {maxPauseDurationMs:14_400_000});
  const readiness=new WorkerRuntimeReadiness({deviceId:signer.deviceId,
    sellerAccountId:owner.sellerAccountId,packages,reviews,vault,usage,imageApproval,
    approvedImage:image,collectorImage:collector,
    jobControl:jobs,localState:local});
  const reporter=new WorkerAvailabilityReporter(signer.deviceId,packages,local,readiness);
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)controller.abort();
  try{
    await jobs.stopOrphanedAtStartup();
    const loops=[] as WorkerDispatchLoop[];
    const supervisors=[] as {planeId:string;supervisor:WorkerExecutionSupervisor}[];
    for(const plane of discovered){
      const transport=new HttpsPollingWorkerTransport(plane.id,plane.endpoint,
        signer,{allowLocalHttp});
      const cloud=new NetsonsWorkerJobCloud(transport);
      const supervisor=new WorkerExecutionSupervisor({cloud,localState:local,
        readiness,jobControl:jobs,outbox,sandbox,docker:control,
        dockerExecutable:docker,storage:null,attemptRoot,storageOrigin:origin,
        approvedImage:image,imageApproval,localWorkerDeviceId:signer.deviceId,
        authenticatedControlPlaneId:plane.id,
        allowInsecureLoopbackStorage:allowLocalHttp,
        brokerPorts:(pkg)=>{
          const budget=pkg.permissionPolicy.providerBudget;
          const saved=reviews.load(pkg.capabilityVersionId,owner.sellerAccountId);
          if(!budget||!saved?.sentAt||!saved.providerEndpoint||
            saved.review.candidate.localPackageHash!==hashCanonicalJson(pkg))
            throw new Error('WORKER_REVIEW_NOT_READY');
          return {completion:new SellerCompletionBroker(vault,
            new OpenAiCompatibleHttpsConnector(budget.providerId,
              saved.providerEndpoint),usage)};
        }});
      supervisors.push({planeId:plane.id,supervisor});
      const loop=new WorkerDispatchLoop(transport,signer.deviceId,packages,
        local,jobs,supervisor,(offer,error)=>{
          const code=error instanceof Error&&'code' in error&&
            typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?
            error.code:'EXECUTION_REFUSED';
          process.stderr.write(`Kivro Worker refused execution ${
            z.uuid().parse(offer.executionId)}: ${code}\n`);
        },{reporter,capacity:plane.state==='ACTIVE'?1:0,
          workerRelease:process.env.KIVRO_WORKER_RELEASE??'0.0.0-dev',
          openClawVersion:approved.openClawVersion,policyVersion:1});
      loops.push(loop);
    }
    for(const loop of loops)await loop.startup();
    for(const item of supervisors){
      try{await item.supervisor.retryPendingResults(item.planeId);}
      catch{/* Keep the outbox and let cloud reconciliation decide expired leases. */}
    }
    const running=loops.map((loop)=>loop.runUntilAborted(controller.signal));
    try{await Promise.all(running);}
    finally{controller.abort();await Promise.allSettled(running);}
  }finally{
    signal.removeEventListener('abort',abort);
    jobs.close();local.close();outbox.close();usage.close();reviews.close();
    packages.close();
  }
}
