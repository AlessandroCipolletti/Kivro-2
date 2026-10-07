/* global Buffer, setTimeout, clearTimeout */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalJson, hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { hashWorkerManifest } from '../dist/packages/contracts/src/worker-manifest.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';
import { SellerCompletionBroker } from '../dist/packages/application/src/completion-broker.js';
import { OpenClawImageApproval, hashOpenClawRuntimeSource } from
  '../dist/packages/openclaw-adapter/src/image-approval.js';
import { WorkerExecutionSupervisor } from '../dist/apps/worker/src/execution-supervisor.js';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';
import { WorkerJobControl, newLocalJobCommand } from '../dist/apps/worker/src/job-control.js';
import { WorkerResultOutbox } from '../dist/apps/worker/src/result-outbox.js';
import { runRepresentativePackageTest } from
  '../dist/apps/worker/src/import-review-runner.js';
import { WorkerCapabilityPackageStore } from
  '../dist/apps/worker/src/capability-package-store.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = JSON.parse(execFileSync(docker, ['image', 'inspect', 'kivro-openclaw-runtime:m07',
  '--format', '{{json .RepoDigests}}'], { encoding: 'utf8' }))
  .find((value) => value.startsWith('kivro-openclaw-runtime@sha256:'));
const collector = image;

test('a seller-selected skill package passes an actual isolated OpenClaw review job before local installation',
  {timeout:120_000},async()=>{
    const root=mkdtempSync(join(tmpdir(),'kivro-import-review-'));
    const {mkdirSync}=await import('node:fs');
    const stateDir=join(root,'state'),attemptRoot=join(root,'attempts');
    mkdirSync(stateDir,{mode:0o700});mkdirSync(attemptRoot,{mode:0o700});
    const runtimeRoot=resolve('runtime/openclaw'),approvalPath=join(root,'approval.json');
    writeFileSync(approvalPath,JSON.stringify({schemaVersion:1,image,
      openClawVersion:'2026.8.2',runtimeSourceHash:await hashOpenClawRuntimeSource(runtimeRoot),
      conformanceSuite:'m07-openclaw-execution/1',
      conformancePassedAt:new Date().toISOString()}),{mode:0o600});
    const base=fixture();
    const skillBytes=Buffer.from('---\nname: selected\ndescription: Answer buyer questions only.\n---\nUse the declared output contract.\n');
    const skillHash=hashCanonicalJson([{path:'SKILL.md',sha256:`sha256:${createHash('sha256')
      .update(skillBytes).digest('hex')}`}]);
    const graphNode=(id,type,dependsOn=[])=>({id,type,name:id,
      requirement:'REQUIRED',sensitivity:'LOW',discoveredFrom:['SELLER_DECLARATION'],
      dependsOn,marketplaceSupport:'UNDETERMINED',confidence:'CONFIRMED',
      selected:true,health:'UNKNOWN'});
    const pkg={...base.pkg,workerManifest:{...base.pkg.workerManifest,
      skills:[{name:'selected',contentHash:skillHash}]},
      dependencyGraph:{graphVersion:1,rootId:'skill',inference:{mode:'REMOTE_PROVIDER',
        dependencyId:'model',provider:'synthetic',model:'broker',credentialRef:'credential',
        billingOwner:'SELLER'},alternatives:[],nodes:[
        graphNode('skill','SKILL',['model']),graphNode('model','AI_MODEL',['provider','credential']),
        graphNode('provider','AI_PROVIDER'),graphNode('credential','CREDENTIAL')]},
      dependencySnapshot:[{id:'skill',version:'selected-skill',contentHash:skillHash}]};
    const skills=[{name:'selected',files:[{path:'SKILL.md',
      bytesBase64:skillBytes.toString('base64')}]}];
    const readiness={async check(){return {ready:false,checkedAt:new Date().toISOString(),
      blockingReasons:['REVIEW_ONLY']};}};
    const local=new WorkerLocalState(stateDir,readiness);
    const dockerControl=new DockerJobControlAdapter(docker);
    const jobs=new WorkerJobControl(stateDir,dockerControl,readiness,
      {maxPauseDurationMs:60_000});
    const packages=new WorkerCapabilityPackageStore(stateDir);
    let providerCalls=0;
    const completion=new SellerCompletionBroker({async resolve(){return 'synthetic-key';}},
      {providerId:'synthetic',async complete(){providerCalls++;
        return {id:randomUUID(),object:'chat.completion',created:Math.floor(Date.now()/1000),
          model:'broker',choices:[{index:0,finish_reason:providerCalls===1?'tool_calls':'stop',
            message:providerCalls===1?{role:'assistant',content:null,tool_calls:[{
              id:'call_kivro_result',type:'function',function:{name:'kivro_submit_result',
                arguments:JSON.stringify({fields:{answer:{type:'SHORT_TEXT',value:'ready'}}})}}]}:
              {role:'assistant',content:'Submitted.'}}],
          usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16}};
      }},{async reserve(){},async settle(){}});
    try{
      const result=await runRepresentativePackageTest(pkg,skills,base.accepted.payload,{
        attemptRoot,dockerExecutable:docker,approvedImage:image,
        imageApproval:new OpenClawImageApproval(approvalPath,runtimeRoot,docker),
        sandbox:new DockerSandboxAdapter({dockerExecutable:docker,approvedImage:image,
          collectorImage:collector,attemptRoot}),docker:dockerControl,
        jobControl:jobs,localState:local,brokerPorts:{completion},
        async checkDependencies(){return {ready:true,
          verifiedNodeIds:['skill','model','provider','credential'],
          evidence:{skillHash,credentialPresent:true,providerModel:'synthetic/broker'}};}});
      assert.equal(providerCalls,2);
      assert.equal(result.reviewedPackage.dependencyGraph.nodes.every((node)=>
        node.health==='READY'),true);
      assert.match(result.securityProbes,/^sha256:[a-f0-9]{64}$/);
      assert.match(result.representativeJob,/^sha256:[a-f0-9]{64}$/);
      packages.installReviewed(result.reviewedPackage,{actorId:'local:seller',
        approvedAt:new Date().toISOString(),reviewEvidenceHash:hashCanonicalJson(result)},skills);
      assert.equal(packages.loadReviewedSkills(pkg.capabilityVersionId)[0].name,'selected');
      assert.equal(jobs.snapshots().filter((item)=>item.controlPlaneId==='local-review')
        .every((item)=>item.status==='STOPPED'),true);
    }finally{packages.close();jobs.close();local.close();
      rmSync(root,{recursive:true,force:true});}
  });

function fixture() {
  const workerDeviceId = randomUUID(), capabilityId = randomUUID(), capabilityVersionId = randomUUID();
  const jobId = randomUUID(), executionId = randomUUID(), attemptId = randomUUID();
  const buyerAccountId = randomUUID(), inputManifestId = randomUUID();
  const input = { values: { question: 'Give a safe answer.' }, assets: {} };
  const providerBudget = { providerId: 'synthetic', modelId: 'broker', credentialRef: 'seller:test-only',
    maxRequestsPerJob: 4, maxInputTokensPerRequest: 8192, maxOutputTokensPerRequest: 2048,
    maxEstimatedSpendMicroUsdPerJob: 100_000,
    inputPriceMicroUsdPerMillionTokens: 1_000_000,
    outputPriceMicroUsdPerMillionTokens: 1_000_000 };
  const policy = { policyVersion: 1, aiInference: 'SELLER', providerBudget,
    publicInternet: 'DENY', browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
    selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
    shell: false, externalSideEffects: false, buyerFileAccess: false,
    sellerCredentialRefs: ['seller:test-only'] };
  const inputContract = { schemaVersion: 1, fields: [{ key: 'question', label: 'Question',
    order: 0, required: true, type: 'SHORT_TEXT' }] };
  const outputContract = { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer',
    order: 0, required: true, type: 'SHORT_TEXT' }] };
  const manifest = { manifestVersion: 1, workerId: randomUUID(), capabilityVersionId,
    runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
    skills: [], tools: { allow: [], deny: ['browser', 'exec', 'gateway'] }, resources: [],
    network: { default: 'deny', allow: [] }, limits: { timeoutSeconds: 60, memoryMb: 1024,
      cpu: 1, maxPids: 128, maxInputBytes: 1000, maxOutputBytes: 65536 } };
  const pkg = { packageVersion: 1, capabilityId, capabilityVersionId, workerDeviceId,
    workerManifest: manifest, dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null,
      alternatives: [], nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill', requirement: 'REQUIRED',
        sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'], dependsOn: [],
        marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED', selected: false, health: 'UNKNOWN' }] },
    permissionPolicy: policy, sellerInferenceConfigHash: `sha256:${'a'.repeat(64)}`,
    ioContract: { contractVersion: 1, input: inputContract, output: outputContract },
    priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
    exampleRefs: [], testRefs: [], pauseSupport: 'FULL_RESUME' };
  const inputManifestHash = hashCanonicalJson({ jobId, payload: input, assets: [] });
  const offer = { type: 'JOB_OFFER', protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: randomUUID(), controlPlaneId: 'plane-a', jobId, executionId, attemptId,
    workerDeviceId, capabilityId, capabilityVersionId, inputManifestId,
    paymentReservationId: randomUUID(), workerManifestHash: hashWorkerManifest(manifest),
    localPackageHash: hashCanonicalJson(pkg), permissionPolicyHash: hashCanonicalJson(policy),
    policyValidationHash: `sha256:${'b'.repeat(64)}`,
    inputSchemaHash: hashCanonicalJson(inputContract), inputManifestHash,
    inputTotalBytes: Buffer.byteLength(canonicalJson(input)),
    inputFileCount: 0, pauseSupport: 'FULL_RESUME',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    leaseToken: 'x'.repeat(32), paymentSecured: true };
  const accepted = { jobId, executionId, attemptId, buyerAccountId,
    outputRetainUntil: new Date(Date.now() + 3_600_000).toISOString(), inputManifestId,
    inputManifestHash, inputSchemaHash: offer.inputSchemaHash,
    inputContract, outputContract, payload: input, stagedAssets: {}, downloads: [] };
  return { pkg, offer, accepted, providerBudget };
}

test('Worker supervisor admits, executes, validates, and finalizes one real offline OpenClaw job',
  { timeout: 120_000 }, async () => {
    assert.ok(image);
    const root = mkdtempSync(join(tmpdir(), 'kivro-supervisor-'));
    const stateDir = join(root, 'state'), attemptRoot = join(root, 'attempts');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(stateDir, { mode: 0o700 }); mkdirSync(attemptRoot, { mode: 0o700 });
    const approvalPath = join(root, 'approval.json');
    const runtimeRoot = resolve('runtime/openclaw');
    const sourceHash = await hashOpenClawRuntimeSource(runtimeRoot);
    writeFileSync(approvalPath, JSON.stringify({ schemaVersion: 1, image,
      openClawVersion: '2026.8.2', runtimeSourceHash: sourceHash,
      conformanceSuite: 'm07-openclaw-execution/1',
      conformancePassedAt: new Date().toISOString() }), { mode: 0o600 });
    const { pkg, offer, accepted } = fixture();
    const readiness = { async check() { return { ready: true, checkedAt: new Date().toISOString(),
      blockingReasons: [], policyValidationHash: offer.policyValidationHash,
      sandboxVerified: true, requiredSecretsReady: true, runtimeHealthy: true,
      capacityAvailable: true }; } };
    const localState = new WorkerLocalState(stateDir, readiness);
    const dockerControl = new DockerJobControlAdapter(docker);
    const jobControl = new WorkerJobControl(stateDir, dockerControl, readiness,
      { maxPauseDurationMs: 60_000 });
    const outbox = new WorkerResultOutbox(stateDir);
    let inferenceCalls = 0, finalizations = 0;
    let loseFirstFinalizeAck = true;
    const transitions = [];
    const completion = new SellerCompletionBroker({ async resolve() { return 'synthetic-key'; } },
      { providerId: 'synthetic', async complete(request, credential) {
        assert.equal(credential, 'synthetic-key'); assert.equal(request.stream, false);
        inferenceCalls++;
        return { id: randomUUID(), object: 'chat.completion', created: Math.floor(Date.now() / 1000),
          model: 'broker', choices: [{ index: 0,
            finish_reason: inferenceCalls === 1 ? 'tool_calls' : 'stop',
            message: inferenceCalls === 1 ? { role: 'assistant', content: null, tool_calls: [{
              id: 'call_kivro_result', type: 'function', function: { name: 'kivro_submit_result',
                arguments: JSON.stringify({ fields: { answer: { type: 'SHORT_TEXT', value: 'ready' } } }) },
            }] } : { role: 'assistant', content: 'Submitted.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } };
      } }, { async reserve() {}, async settle() {} });
    const cloud = { async accept(seen) { assert.equal(seen.executionId, offer.executionId); },
      async acceptedInput() { return accepted; },
      async transition(_, event) { transitions.push(`${event.from}->${event.to}`); },
      async renewLease() { return new Date(Date.now() + 60_000).toISOString(); },
      async failExecution() { throw new Error('UNEXPECTED_FAILURE_REPORT'); },
      async finalizeResult(result) {
        finalizations++;
        assert.equal(result.jobId, offer.jobId);
        assert.equal(result.payload.values.answer, 'ready');
        assert.deepEqual(result.assets, []);
        if (loseFirstFinalizeAck) { loseFirstFinalizeAck = false; throw new Error('ACK_LOST'); }
      } };
    const supervisor = new WorkerExecutionSupervisor({ cloud, localState, readiness,
      jobControl, outbox, sandbox: new DockerSandboxAdapter({ dockerExecutable: docker,
        approvedImage: image, collectorImage: collector, attemptRoot }), docker: dockerControl,
      dockerExecutable: docker, brokerPorts: { completion }, storage: {}, attemptRoot,
      storageOrigin: 'https://storage.example.invalid', approvedImage: image,
      imageApproval: new OpenClawImageApproval(approvalPath, runtimeRoot, docker),
      localWorkerDeviceId: offer.workerDeviceId, authenticatedControlPlaneId: offer.controlPlaneId,
    });
    try {
      await assert.rejects(supervisor.execute({ ...offer, paymentSecured: false }, pkg, []));
      assert.equal(inferenceCalls, 0);
      assert.deepEqual(transitions, []);
      await assert.rejects(supervisor.execute(offer, pkg, []), /ACK_LOST/);
      assert.equal(inferenceCalls, 2);
      assert.equal(finalizations, 1);
      assert.deepEqual(transitions, ['ACCEPTED->STARTING', 'STARTING->RUNNING',
        'RUNNING->UPLOADING_RESULT']);
      assert.equal(jobControl.snapshot(offer.jobId).status, 'STOPPED');
      assert.equal(outbox.pending().length, 1);
      assert.equal(await supervisor.retryPendingResults(), 1);
      assert.equal(finalizations, 2);
      assert.equal(inferenceCalls, 2);
      assert.equal(outbox.pending().length, 0);
    } finally {
      outbox.close(); jobControl.close(); localState.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

test('accepted payload drift fails before Docker and reports a terminal policy failure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kivro-supervisor-denial-'));
  const { pkg, offer, accepted } = fixture();
  const localState = new WorkerLocalState(root, { async check() { return { ready: true,
    checkedAt: new Date().toISOString(), blockingReasons: [] }; } });
  const failures = [];
  const supervisor = new WorkerExecutionSupervisor({ localState,
    readiness: { async check() { return { ready: true, checkedAt: new Date().toISOString(),
      policyValidationHash: offer.policyValidationHash, sandboxVerified: true,
      requiredSecretsReady: true, runtimeHealthy: true, capacityAvailable: true }; } },
    imageApproval: { async assertApprovedImage() {return {openClawVersion:'2026.8.2'};} },
    approvedImage: image,
    outbox: { load() { return null; } },
    cloud: { async accept() {}, async acceptedInput() { return { ...accepted,
      outputContract: { schemaVersion: 1, fields: [{ key: 'secret', label: 'Secret',
        order: 0, required: true, type: 'SHORT_TEXT' }] } }; },
      async failExecution(_, input) { failures.push(input); } },
    sandbox: { async runWithOutputControlled() { throw new Error('DOCKER_MUST_NOT_START'); } },
    localWorkerDeviceId: offer.workerDeviceId, authenticatedControlPlaneId: offer.controlPlaneId });
  try {
    await assert.rejects(supervisor.execute(offer, pkg, []), { code: 'PAYLOAD_MISMATCH' });
    assert.deepEqual(failures, [{ from: 'ACCEPTED', to: 'FAILED_POLICY',
      reason: 'PAYLOAD_MISMATCH' }]);
  } finally { localState.close(); rmSync(root, { recursive: true, force: true }); }
});

test('a real OpenClaw inference is quiesced before PAUSED and cannot spend again while paused',
  { timeout: 120_000 }, async () => {
    const root = mkdtempSync(join(tmpdir(), 'kivro-openclaw-pause-'));
    const { mkdirSync } = await import('node:fs');
    const stateDir = join(root, 'state'), attemptRoot = join(root, 'attempts');
    mkdirSync(stateDir, { mode: 0o700 }); mkdirSync(attemptRoot, { mode: 0o700 });
    const runtimeRoot = resolve('runtime/openclaw');
    const approvalPath = join(root, 'approval.json');
    writeFileSync(approvalPath, JSON.stringify({ schemaVersion: 1, image,
      openClawVersion: '2026.8.2', runtimeSourceHash: await hashOpenClawRuntimeSource(runtimeRoot),
      conformanceSuite: 'm07-openclaw-execution/1',
      conformancePassedAt: new Date().toISOString() }), { mode: 0o600 });
    const { pkg, offer, accepted } = fixture();
    const readiness = { async check() { return { ready: true, checkedAt: new Date().toISOString(),
      blockingReasons: [], policyValidationHash: offer.policyValidationHash,
      sandboxVerified: true, requiredSecretsReady: true, runtimeHealthy: true,
      capacityAvailable: true }; } };
    const localState = new WorkerLocalState(stateDir, readiness);
    const dockerControl = new DockerJobControlAdapter(docker);
    const jobControl = new WorkerJobControl(stateDir, dockerControl, readiness,
      { maxPauseDurationMs: 60_000 });
    const outbox = new WorkerResultOutbox(stateDir);
    let providerCalls = 0;
    let started;
    const providerStarted = new Promise((resolveStarted) => { started = resolveStarted; });
    const completion = new SellerCompletionBroker({ async resolve() { return 'synthetic-key'; } },
      { providerId: 'synthetic', async complete(_request, _credential, signal) {
        providerCalls++;
        started();
        await new Promise((_, reject) => signal.addEventListener('abort',
          () => reject(new Error('ABORTED_BY_PAUSE')), { once: true }));
      } }, { async reserve() {}, async settle() {} });
    const cloud = { async accept() {}, async acceptedInput() { return accepted; },
      async transition() {}, async renewLease() { return new Date(Date.now() + 60_000).toISOString(); },
      async finalizeResult() { throw new Error('NO_RESULT_EXPECTED'); }, async failExecution() {} };
    const supervisor = new WorkerExecutionSupervisor({ cloud, localState, readiness,
      jobControl, outbox, sandbox: new DockerSandboxAdapter({ dockerExecutable: docker,
        approvedImage: image, collectorImage: collector, attemptRoot }), docker: dockerControl,
      dockerExecutable: docker, brokerPorts: { completion }, storage: {}, attemptRoot,
      storageOrigin: 'https://storage.example.invalid', approvedImage: image,
      imageApproval: new OpenClawImageApproval(approvalPath, runtimeRoot, docker),
      localWorkerDeviceId: offer.workerDeviceId, authenticatedControlPlaneId: offer.controlPlaneId,
    });
    try {
      const execution = supervisor.execute(offer, pkg, []).then(() => 'COMPLETED', (error) => error);
      let timeout;
      try {
        await Promise.race([providerStarted, new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('INFERENCE_NOT_STARTED')), 20_000);
        })]);
      } finally { clearTimeout(timeout); }
      const paused = await jobControl.pause(newLocalJobCommand(offer.jobId, 'local:seller', 'CLI'));
      assert.equal(paused.status, 'PAUSED');
      const before = providerCalls;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
      assert.equal(providerCalls, before);
      assert.equal(jobControl.snapshot(offer.jobId).status, 'PAUSED');
      const cancelled = await jobControl.cancel(newLocalJobCommand(offer.jobId, 'local:seller', 'CLI'));
      assert.equal(cancelled.status, 'CANCELLED');
      assert.notEqual(await execution, 'COMPLETED');
    } finally {
      outbox.close(); jobControl.close(); localState.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
