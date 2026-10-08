import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { WorkerHeartbeatSchema } from '../../../packages/worker-protocol/src/messages.js';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { SellerCompletionBroker } from
  '../../../packages/application/src/completion-broker.js';
import { OpenAiCompatibleHttpsConnector } from
  '../../../packages/infrastructure/adapters/src/openai-compatible-https.js';
import { LocalOpenAiCompatibleConnector } from
  '../../../packages/infrastructure/adapters/src/local-openai-compatible.js';
import { ProtocolWorkerJobCloud } from
  '../../../packages/application/src/worker-job-cloud.js';
import { discoverWorkerControlPlanes, HttpsPollingWorkerTransport,
  selectWorkerTransport } from
  '../../../packages/infrastructure/netsons/src/https-polling.js';
import {WebSocketWorkerTransport} from
  '../../../packages/infrastructure/adapters/src/websocket-worker.js';
import { OpenClawImageApproval } from
  '../../../packages/openclaw-adapter/src/image-approval.js';
import { DockerJobControlAdapter, DockerSandboxAdapter, DockerSandboxError } from
  '../../../packages/sandbox-adapter/src/docker.js';
import { WorkerAvailabilityReporter } from './availability-reporter.js';
import { WorkerCapabilityPackageStore } from './capability-package-store.js';
import { unlockIdentity } from './control-sync-runtime.js';
import { WorkerDispatchLoop } from './dispatch-loop.js';
import { WorkerDispatchCapacity } from './dispatch-capacity.js';
import {WorkerControlPlaneRoutes,restoreOwnedControlPlaneRoutes} from
  './control-plane-routes.js';
import { WorkerExecutionSupervisor } from './execution-supervisor.js';
import { WorkerImportReviewOutbox } from './import-review-outbox.js';
import { privateAttemptRoot } from './import-review-command.js';
import { WorkerJobControl } from './job-control.js';
import { removeKnownStagedAttempts } from './input-staging.js';
import { localHealth,localResumeReadiness } from './health.js';
import { WorkerLocalState } from './local-state.js';
import { pairedSellerForDevice } from './paired-seller.js';
import { WorkerProviderUsage } from './provider-usage.js';
import { WorkerLocalInferenceUsage } from './local-inference-usage.js';
import { WorkerResourceUsage,createWorkerResourcePorts } from './resource-ports.js';
import { WorkerResultOutbox } from './result-outbox.js';
import { WorkerRuntimeReadiness } from './runtime-readiness.js';
import { KeychainSellerCredentialVault } from './seller-credential-vault.js';

function required(name:string):string{
  const value=process.env[name];
  if(!value)throw new Error(`WORKER_${name}_MISSING`);
  return value;
}

/** A seller Worker must not inherit cloud financial, storage or platform
 * credentials from a shared developer shell or service manager. */
export function assertWorkerEnvironmentIsolated(env:NodeJS.ProcessEnv=process.env):void{
  const cloudOnly=['DATABASE_URL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
    'OBJECT_STORAGE_ACCESS_KEY_ID','OBJECT_STORAGE_SECRET_ACCESS_KEY',
    'KIVRO_BRAVE_SEARCH_TOKEN','GOOGLE_CLIENT_SECRET','BETTER_AUTH_SECRET',
    'PLATFORM_AI_PROFILES_JSON'];
  if(cloudOnly.some((name)=>Boolean(env[name])))
    throw new Error('WORKER_CLOUD_CREDENTIAL_PRESENT');
}

function storageOrigin(raw:string,allowLocalHttp:boolean):string{
  const url=new URL(raw);
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    (url.protocol!=='https:'&&!(allowLocalHttp&&local&&url.protocol==='http:')))
    throw new Error('WORKER_STORAGE_ORIGIN_INVALID');
  return url.origin;
}

type DiscoveredPlane=Awaited<ReturnType<typeof discoverWorkerControlPlanes>>[number];

export function assertWorkerPlaneSet(planes:readonly DiscoveredPlane[]):void{
  if(planes.filter((plane)=>plane.state==='ACTIVE').length!==1)
    throw new Error('WORKER_ACTIVE_PLANE_AMBIGUOUS');
  if(planes.length<1||planes.length>2||
    planes.some((plane)=>plane.state!=='ACTIVE'&&plane.state!=='DRAINING')||
    new Set(planes.map((plane)=>plane.id)).size!==planes.length)
    throw new Error('WORKER_CONTROL_PLANE_SET_INVALID');
}

/** Host-native paid composition. Dispatch and job state remain in shared Worker
 * classes; polling and WSS are transport choices. Missing security prerequisites
 * abort startup before any paid offer can be accepted. */
export async function runWorkerExecution(signal:AbortSignal):Promise<void>{
  assertWorkerEnvironmentIsolated();
  const stateDir=process.env.KIVRO_WORKER_STATE_DIR??
    join(homedir(),'.kivro','worker','state');
  const signer=await unlockIdentity(stateDir);
  const owner=pairedSellerForDevice(stateDir,signer.deviceId);
  if(!owner)throw new Error('WORKER_PAIRING_REQUIRED');
  const allowLocalHttp=process.env.KIVRO_ALLOW_LOCAL_HTTP==='true'&&
    process.env.NODE_ENV!=='production';
  const discovered=await discoverWorkerControlPlanes(required('WORKER_DISCOVERY_URL'),
    {allowLocalHttp});
  assertWorkerPlaneSet(discovered);
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
  const localUsage=new WorkerLocalInferenceUsage(stateDir);
  const resourceUsage=new WorkerResourceUsage(stateDir);
  const outbox=new WorkerResultOutbox(stateDir);
  const routes=new WorkerControlPlaneRoutes(stateDir);
  const local:WorkerLocalState=new WorkerLocalState(stateDir,{check:()=>localResumeReadiness(stateDir,
    local.snapshot(),'METADATA_PRESENT',signer.deviceId)});
  const jobs=new WorkerJobControl(stateDir,control,
    {check:()=>localResumeReadiness(stateDir,local.snapshot(),
      'METADATA_PRESENT',signer.deviceId)},
    {maxPauseDurationMs:14_400_000});
  for(const plane of discovered)routes.remember(plane);
  const ownedPlaneIds=new Set([
    ...outbox.pending().map((item)=>item.controlPlaneId),
    ...jobs.snapshots().filter((item)=>
      !['STOPPED','CANCELLED','TIMED_OUT'].includes(item.status))
      .map((item)=>item.controlPlaneId),
  ]);
  const initial=restoreOwnedControlPlaneRoutes(discovered,ownedPlaneIds,routes);
  assertWorkerPlaneSet(initial);
  local.migrateLegacyCloudDirective(initial.find((plane)=>plane.state==='DRAINING')?.id??
    initial[0]!.id);
  for(const plane of initial)local.registerControlPlane(plane.id);
  const readiness=new WorkerRuntimeReadiness({deviceId:signer.deviceId,
    sellerAccountId:owner.sellerAccountId,packages,reviews,vault,usage,localUsage,imageApproval,
    resourceUsage,cloudResearchRoutingReady:true,
    approvedImage:image,collectorImage:collector,
    jobControl:jobs,localState:local});
  const reporter=new WorkerAvailabilityReporter(signer.deviceId,packages,local,readiness);
  const capacity=new WorkerDispatchCapacity(1);
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)controller.abort();
  try{
    await jobs.stopOrphanedAtStartup();
    await removeKnownStagedAttempts(attemptRoot,
      jobs.snapshots().map((item)=>item.attemptId));
    const loops=new Map<string,{plane:DiscoveredPlane;selectedEndpoint:string;
      loop:WorkerDispatchLoop;
      abort:AbortController;task:Promise<void>}>();
    const retired=new Set<string>();
    let fatal:unknown=null;
    const owned=(planeId:string)=>capacity.inFlightForPlane(planeId)>0||
      jobs.snapshots().some((item)=>item.controlPlaneId===planeId&&
        !['STOPPED','CANCELLED','TIMED_OUT'].includes(item.status));
    const startPlane=async(plane:DiscoveredPlane):Promise<void>=>{
      local.registerControlPlane(plane.id);
      const selected=selectWorkerTransport(plane,{allowLocalHttp});
      const transport=selected.type==='WEBSOCKET'?new WebSocketWorkerTransport(
        plane.id,selected.endpoint,signer,{allowLocalHttp}):
        new HttpsPollingWorkerTransport(plane.id,selected.endpoint,
          signer,{allowLocalHttp});
      const cloud=new ProtocolWorkerJobCloud(transport);
      const supervisor=new WorkerExecutionSupervisor({cloud,localState:local,
        readiness,jobControl:jobs,outbox,sandbox,docker:control,
        dockerExecutable:docker,storage:null,attemptRoot,storageOrigin:origin,
        approvedImage:image,imageApproval,localWorkerDeviceId:signer.deviceId,
        authenticatedControlPlaneId:plane.id,
        allowInsecureLoopbackStorage:allowLocalHttp,
        brokerPorts:(pkg,offer)=>{
          const budget=pkg.permissionPolicy.providerBudget;
          const localBudget=pkg.permissionPolicy.localInference;
          const saved=reviews.load(pkg.capabilityVersionId,owner.sellerAccountId);
          if(!saved?.sentAt||!saved.providerEndpoint||
            Boolean(budget)===Boolean(localBudget)||
            saved.review.candidate.localPackageHash!==hashCanonicalJson(pkg))
            throw new Error('WORKER_REVIEW_NOT_READY');
          const resources=createWorkerResourcePorts(pkg,vault,resourceUsage,
            ()=>cloud.markPrivateResourceRead(offer));
          const research=pkg.permissionPolicy.internet?.mode==='PUBLIC_WEB_RESEARCH'?
            {research:cloud.researchFor(offer)}:{};
          if(localBudget){
            const connector=new LocalOpenAiCompatibleConnector(localBudget.providerId,
              saved.providerEndpoint);
            return {completion:new SellerCompletionBroker(null,connector,null,localUsage),
              ...resources,...research};
          }
          return {completion:new SellerCompletionBroker(vault,
            new OpenAiCompatibleHttpsConnector(budget!.providerId,
              saved.providerEndpoint),usage),
            ...resources,...research};
        }});
      const loop=new WorkerDispatchLoop(transport,signer.deviceId,packages,
        local,jobs,supervisor,(offer,error)=>{
          const code=error instanceof Error&&'code' in error&&
            typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?
            error.code:'EXECUTION_REFUSED';
          const diagnostic=error instanceof z.ZodError?
            `SCHEMA:${error.issues.slice(0,3).map((issue)=>[
              issue.code,'expected' in issue?String(issue.expected):'unknown',
              issue.path.map(String).filter((part)=>
                /^[A-Za-z0-9_]{1,80}$/.test(part)).join('.')].join(':')).join(',')}`:
            error instanceof Error&&/^[A-Za-z][A-Za-z0-9]{0,79}$/.test(error.name)?
              error.name:'UnknownError';
          process.stderr.write(`${JSON.stringify({event:'worker_execution_refused',
            at:new Date().toISOString(),executionId:z.uuid().parse(offer.executionId),
            code,diagnostic,...(error instanceof DockerSandboxError&&error.diagnostic?
              {sandboxDiagnostic:error.diagnostic}:{})})}\n`);
        },{reporter,capacity:1,coordinator:capacity,
          workerRelease:process.env.KIVRO_WORKER_RELEASE??'0.0.0-dev',
          openClawVersion:approved.openClawVersion,policyVersion:1,
          operationalChecks:async()=>{
            const report=await localHealth(stateDir,local.snapshot(),
              'METADATA_PRESENT',capacity.activeCount(jobs.snapshots()),true,
              signer.deviceId);
            return WorkerHeartbeatSchema.shape.operationalChecks.unwrap().parse(
              report.checks.map(({code,state})=>({code,state})));
          }});
      loop.setDiscoveryState(plane.state);
      await loop.startup(true);
      try{await supervisor.retryPendingResults(plane.id);}
      catch{/* Keep the outbox and let cloud reconciliation decide expired leases. */}
      const planeAbort=new AbortController();
      if(controller.signal.aborted)planeAbort.abort();
      const task=loop.runUntilAborted(planeAbort.signal).catch((error:unknown)=>{
        if(!planeAbort.signal.aborted){fatal=error;controller.abort();}
      });
      loops.set(plane.id,{plane,selectedEndpoint:selected.endpoint,loop,
        abort:planeAbort,task});
    };
    try{
      for(const plane of initial)await startPlane(plane);
      while(!controller.signal.aborted){
        await delay(5_000,undefined,{signal:controller.signal}).catch(()=>undefined);
        if(controller.signal.aborted)break;
        let current:readonly DiscoveredPlane[];
        try{current=await discoverWorkerControlPlanes(required('WORKER_DISCOVERY_URL'),
          {allowLocalHttp});}
        catch{
          // A cached route may finish its owned executions, but discovery loss
          // cannot authorize another offer on a possibly superseded plane.
          for(const entry of loops.values())entry.loop.setDiscoveryState('DRAINING');
          continue;
        }
        assertWorkerPlaneSet(current);
        for(const plane of current)routes.remember(plane);
        for(const [id,entry] of loops){
          const advertised=current.find((plane)=>plane.id===id);
          entry.loop.setDiscoveryState(advertised?.state??'DRAINING');
        }
        for(const plane of current){
          const existing=loops.get(plane.id);
          if(retired.has(plane.id)&&plane.state==='DRAINING')continue;
          const selected=selectWorkerTransport(plane,{allowLocalHttp});
          if(existing&&existing.selectedEndpoint!==selected.endpoint){
            if(owned(plane.id))continue;
            existing.abort.abort();await existing.task;loops.delete(plane.id);
          }
          if(!loops.has(plane.id)){
            retired.delete(plane.id);
            try{await startPlane(plane);}
            catch{continue; /* Retry discovery without stopping an owned old execution. */}
          }
        }
        for(const [id,entry] of loops){
          const advertised=current.find((plane)=>plane.id===id);
          if(advertised?.state==='ACTIVE'||owned(id)||
            outbox.pending().some((item)=>item.controlPlaneId===id))continue;
          if(!local.canRetireControlPlane(id))continue;
          entry.abort.abort();await entry.task;
          loops.delete(id);
          if(local.retireControlPlane(id)){
            retired.add(id);routes.forget(id);
          }
          else await startPlane({...entry.plane,state:'DRAINING'});
        }
      }
      if(fatal)throw fatal;
    }finally{
      controller.abort();
      for(const entry of loops.values())entry.abort.abort();
      await Promise.allSettled([...loops.values()].map((entry)=>entry.task));
    }
  }finally{
    signal.removeEventListener('abort',abort);
    jobs.close();local.close();outbox.close();usage.close();localUsage.close();
    resourceUsage.close();routes.close();reviews.close();
    packages.close();
  }
}
