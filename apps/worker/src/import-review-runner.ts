import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { hashCanonicalJson } from '../../../packages/contracts/src/canonical-json.js';
import { LocalCapabilityPackageSchema, type LocalCapabilityPackage } from
  '../../../packages/contracts/src/capability-package.js';
import { OfflineSandboxPlanSchema } from '../../../packages/contracts/src/sandbox.js';
import { buildJobInstructionEnvelope } from '../../../packages/application/src/job-instructions.js';
import { analyzeDependencyGraph } from '../../../packages/domain/src/dependency-graph.js';
import type { CollectedLocalResult } from '../../../packages/sandbox-adapter/src/output-collector.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from
  '../../../packages/sandbox-adapter/src/docker.js';
import { prepareOpenClawJobInput, type ReviewedSkillSnapshot } from
  '../../../packages/openclaw-adapter/src/job-config.js';
import { isPinnedRuntimeRangeCompatible } from
  '../../../packages/openclaw-adapter/src/compatibility.js';
import type { OpenClawImageApproval } from
  '../../../packages/openclaw-adapter/src/image-approval.js';
import { BrokerSidecar } from './broker-sidecar.js';
import { BrokerRoutingError, WorkerBrokerRouter, type JobBrokerPorts } from './broker-router.js';
import type { WorkerJobControl } from './job-control.js';
import type { WorkerLocalState } from './local-state.js';

const execFileAsync=promisify(execFile);
const testInput=z.strictObject({values:z.record(z.string(),z.unknown()),
  assets:z.record(z.string(),z.array(z.uuid()))});
const probe=`const fs=require('node:fs');
if(process.getuid()!==65532||fs.existsSync('/var/run/docker.sock')||
  Object.keys(process.env).some(k=>/^(KIVRO_|AWS_|STRIPE_)/.test(k)))process.exit(1);
try{fs.writeFileSync('/job/input/kivro-probe','x');process.exit(2)}
catch{process.stdout.write('ISOLATED')}`;

export class ImportReviewError extends Error {
  constructor(readonly code:'NOT_READY'|'INPUT_UNSUPPORTED'|'DEPENDENCY_UNHEALTHY'|
    'SECURITY_PROBE_FAILED'|'OBSERVED_EXPANSION'|'OUTPUT_MISSING'){
    super(code);this.name='ImportReviewError';
  }
}

export interface ImportReviewRunnerDependencies {
  readonly attemptRoot:string;
  readonly dockerExecutable:string;
  readonly approvedImage:string;
  readonly imageApproval:OpenClawImageApproval;
  readonly sandbox:DockerSandboxAdapter;
  readonly docker:DockerJobControlAdapter;
  readonly jobControl:WorkerJobControl;
  readonly localState:WorkerLocalState;
  readonly brokerPorts:JobBrokerPorts;
  /** Must check exact selected resources and credential readiness, without exposing values. */
  readonly checkDependencies:(pkg:LocalCapabilityPackage)=>Promise<{
    readonly ready:boolean;readonly verifiedNodeIds:readonly string[];
    readonly evidence:Readonly<Record<string,string|boolean>>}>;
}

/** Rebuilds only the deterministic package projection after a persisted review.
 * This function does not certify that tests ran; callers must verify the exact
 * package hash against the immutable review before installation or dispatch. */
export function projectReviewedPackage(raw:unknown):LocalCapabilityPackage{
  const pkg=LocalCapabilityPackageSchema.parse(raw);
  return LocalCapabilityPackageSchema.parse({...pkg,
    dependencyGraph:{...pkg.dependencyGraph,nodes:pkg.dependencyGraph.nodes.map((node)=>
      node.selected?{...node,health:'READY',marketplaceSupport:'SUPPORTED',
        confidence:'CONFIRMED'}:node)}});
}

/** A local seller test uses the real pinned Docker/OpenClaw/broker boundary.
 * It never creates a paid offer, cloud job, reservation or seller earning. */
export async function runRepresentativePackageTest(rawPackage:unknown,
  reviewedSkills:readonly ReviewedSkillSnapshot[],rawSample:unknown,
  deps:ImportReviewRunnerDependencies):Promise<{
    readonly reviewedPackage:LocalCapabilityPackage;
    readonly localTestJobId:string;
    readonly dependencyHealth:string;readonly representativeJob:string;
    readonly observedVsDeclared:string;readonly securityProbes:string;
    readonly outputContract:string;readonly approvedImageDigest:string;
    readonly openClawVersion:string;readonly testedAt:string}> {
  const pkg=LocalCapabilityPackageSchema.parse(rawPackage);
  const sample=testInput.parse(rawSample);
  if(Object.values(sample.assets).some((ids)=>ids.length>0)||
    pkg.ioContract.input.fields.some((field)=>field.type==='FILE'||field.type==='FILES'))
    throw new ImportReviewError('INPUT_UNSUPPORTED');
  if(!deps.localState.isUnpausedForNewJobOffer(pkg.capabilityId))
    throw new ImportReviewError('NOT_READY');
  const approval=await deps.imageApproval.assertApprovedImage(deps.approvedImage);
  if(pkg.workerManifest.runtime.type!=='openclaw'||
    !isPinnedRuntimeRangeCompatible(pkg.workerManifest.runtime.supportedVersionRange,
      approval.openClawVersion))
    throw new ImportReviewError('NOT_READY');
  const health=await deps.checkDependencies(pkg);
  const selected=pkg.dependencyGraph.nodes.filter((node)=>node.selected);
  if(!health.ready||Object.values(health.evidence).some((value)=>value===false)||
    health.verifiedNodeIds.length!==selected.length||
    new Set(health.verifiedNodeIds).size!==selected.length||
    selected.some((node)=>!health.verifiedNodeIds.includes(node.id)))
    throw new ImportReviewError('DEPENDENCY_UNHEALTHY');
  const reviewedPackage=projectReviewedPackage(pkg);
  if(!analyzeDependencyGraph(reviewedPackage.dependencyGraph).publishable)
    throw new ImportReviewError('DEPENDENCY_UNHEALTHY');
  const jobId=randomUUID(),executionId=randomUUID(),attemptId=randomUUID();
  const envelope=buildJobInstructionEnvelope(reviewedPackage.ioContract.input,
    reviewedPackage.ioContract.output,
    sample,{});
  const router=new WorkerBrokerRouter(reviewedPackage,jobId,deps.brokerPorts,
    {inputFiles:false,outputFiles:reviewedPackage.ioContract.output.fields.some((field)=>
      field.type==='FILE'||field.type==='FILES')});
  const limits=pkg.workerManifest.limits;
  const outputFileBytes=Math.max(1,Math.min(limits.maxOutputBytes,
    ...pkg.ioContract.output.fields.filter((field)=>
      field.type==='FILE'||field.type==='FILES')
      .map((field)=>field.constraints.maxFileSizeBytes)));
  const plan=OfflineSandboxPlanSchema.parse({planVersion:1,image:deps.approvedImage,
    networkMode:'none',readOnlyRoot:true,capDrop:['ALL'],noNewPrivileges:true,
    seccomp:'builtin',runAs:'65532:65532',maxRuntimeSeconds:limits.timeoutSeconds,
    memoryMb:limits.memoryMb,cpu:limits.cpu,maxPids:limits.maxPids,
    maxOutputBytes:limits.maxOutputBytes});
  if(pkg.workerManifest.network.default!=='deny'||
    pkg.workerManifest.network.allow.length>0)
    throw new ImportReviewError('NOT_READY');
  const attempt=join(deps.attemptRoot,attemptId),inputRoot=join(attempt,'input');
  await mkdir(attempt,{mode:0o700});
  let sidecar:BrokerSidecar|undefined;
  let output:CollectedLocalResult|undefined;
  let probeHash:string|undefined;
  const observedKinds:string[]=[];
  let expansion=false;
  try{
    await mkdir(inputRoot,{mode:0o700});
    await prepareOpenClawJobInput({inputRoot,localPackage:reviewedPackage,envelope,
      approvedImage:deps.approvedImage,allowedToolNames:router.allowedToolNames,
      reviewedSkills,maxOutputFileBytes:outputFileBytes});
    const authorize=async()=>{
      const current=deps.jobControl.snapshot(jobId);
      if(current.status!=='RUNNING'||Date.parse(current.leaseExpiresAt)<=Date.now()||
        !deps.localState.isUnpausedForNewJobOffer(pkg.capabilityId))
        throw new ImportReviewError('NOT_READY');
    };
    sidecar=new BrokerSidecar(deps.dockerExecutable,deps.docker,jobId,attemptId,
      authorize,async(request,signal)=>{
        observedKinds.push(request.kind);
        try{return await router.dispatch(request,signal);}
        catch(error){if(error instanceof BrokerRoutingError)expansion=true;throw error;}
      },{begin:(id)=>deps.jobControl.beginBrokerOperation(jobId,id),
        end:(id)=>deps.jobControl.endBrokerOperation(jobId,id)});
    const broker=sidecar;
    const leaseExpiresAt=new Date(Date.now()+Math.min(3_600_000,
      (limits.timeoutSeconds+30)*1000)).toISOString();
    await deps.sandbox.runWithOutputControlled(plan,attemptId,['run-job'],
      envelope.contractData.output,{maxFileBytes:outputFileBytes,
        maxResultBytes:limits.maxOutputBytes},async(collected)=>{output=collected;},
      {jobId,
        onReady:async(containerId)=>{deps.jobControl.register({jobId,executionId,attemptId,
          capabilityVersionId:pkg.capabilityVersionId,containerId,
          controlPlaneId:'local-review',pauseSupport:'NOT_SUPPORTED',leaseExpiresAt});},
        onStartPermitted:async(containerId)=>{
          deps.jobControl.assertStartPermitted(jobId,containerId);
          if(!deps.localState.isUnpausedForNewJobOffer(pkg.capabilityId))
            throw new ImportReviewError('NOT_READY');
        },
        onStarted:async(containerId)=>{
          deps.jobControl.markRunning(jobId);
          try{
            const result=await execFileAsync(deps.dockerExecutable,
              ['exec','--user=65532:65532',containerId,'node','-e',probe],
              {timeout:5_000,maxBuffer:1024});
            if(result.stdout!=='ISOLATED')throw new Error('PROBE_MISMATCH');
            probeHash=hashCanonicalJson({probe,result:'ISOLATED',
              image:deps.approvedImage,policy:plan});
          }catch{throw new ImportReviewError('SECURITY_PROBE_FAILED');}
          await broker.start(containerId);
        },
        onWatchdogTick:async()=>{
          if(!deps.localState.isUnpausedForNewJobOffer(pkg.capabilityId)||
            Date.parse(deps.jobControl.snapshot(jobId).leaseExpiresAt)<=Date.now())
            throw new ImportReviewError('NOT_READY');
        },
        onStopped:async(containerId)=>{
          await broker.close();deps.jobControl.markStopped(jobId,containerId);
        }});
    if(expansion||!observedKinds.includes('INFERENCE'))
      throw new ImportReviewError('OBSERVED_EXPANSION');
    if(!output||!probeHash)throw new ImportReviewError('OUTPUT_MISSING');
    const outputHash=hashCanonicalJson(output);
    const packageHash=hashCanonicalJson(reviewedPackage);
    return {reviewedPackage,localTestJobId:jobId,
      dependencyHealth:hashCanonicalJson({packageHash,health:health.evidence}),
      representativeJob:hashCanonicalJson({packageHash,inputHash:hashCanonicalJson(sample),
        outputHash,attemptId}),
      observedVsDeclared:hashCanonicalJson({packageHash,observedKinds,
        allowedTools:router.allowedToolNames}),securityProbes:probeHash,
      outputContract:hashCanonicalJson({contract:reviewedPackage.ioContract.output,outputHash}),
      approvedImageDigest:`sha256:${deps.approvedImage.split('@sha256:')[1]}`,
      openClawVersion:approval.openClawVersion,testedAt:new Date().toISOString()};
  }finally{
    await sidecar?.close().catch(()=>undefined);
    await rm(attempt,{recursive:true,force:true});
  }
}
