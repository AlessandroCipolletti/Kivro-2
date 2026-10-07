import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { buildVersionCandidate } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';
import { workerExecutionEventId } from '../dist/packages/worker-protocol/src/event-id.js';
import { DockerJobControlAdapter, DockerSandboxAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';
import { SellerCompletionBroker } from '../dist/packages/application/src/completion-broker.js';
import { OpenClawImageApproval, hashOpenClawRuntimeSource } from
  '../dist/packages/openclaw-adapter/src/image-approval.js';
import { WorkerExecutionSupervisor } from '../dist/apps/worker/src/execution-supervisor.js';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';
import { WorkerJobControl } from '../dist/apps/worker/src/job-control.js';
import { WorkerResultOutbox } from '../dist/apps/worker/src/result-outbox.js';

/** Component vertical slice: SQL-seeded publication, test credits and deterministic model.
 * Never cite it as the Stripe/seller-onboarding release acceptance gate. */
export async function runM16CoreWorkerSlice({pool,buyer,otherToken,seller,worker,
  capability,originalPackage,policyValidationHash,plane,inputAssetId,call,rpc,
  execution,finance}){
  const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
  const image=JSON.parse(execFileSync(docker,['image','inspect','kivro-openclaw-runtime:m07',
    '--format','{{json .RepoDigests}}'],{encoding:'utf8'}))
    .find((value)=>value.startsWith('kivro-openclaw-runtime@sha256:'));
  assert.ok(image,'exact locally built OpenClaw image must be present');
  const versionId=randomUUID();
  const providerBudget={providerId:'synthetic',modelId:'broker',credentialRef:'seller:m16-fixture',
    maxRequestsPerJob:6,maxInputTokensPerRequest:8192,maxOutputTokensPerRequest:2048,
    maxEstimatedSpendMicroUsdPerJob:100_000,
    inputPriceMicroUsdPerMillionTokens:1_000_000,
    outputPriceMicroUsdPerMillionTokens:1_000_000};
  const pkg={...originalPackage,capabilityVersionId:versionId,
    workerManifest:{...originalPackage.workerManifest,capabilityVersionId:versionId,
      limits:{...originalPackage.workerManifest.limits,memoryMb:1024,maxPids:128,
        maxInputBytes:65536,maxOutputBytes:65536}},
    permissionPolicy:{...originalPackage.permissionPolicy,aiInference:'SELLER',providerBudget,
      buyerFileAccess:true,sellerCredentialRefs:['seller:m16-fixture']},
    sellerInferenceConfigHash:`sha256:${'c'.repeat(64)}`};
  const candidate=buildVersionCandidate({id:versionId,capabilityId:capability,
    versionNumber:2,workerDeviceId:worker,requestedAt:new Date().toISOString(),
    localPackage:pkg,selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_999'),
    externalProcessors:['Synthetic test provider']});
  const fields={...candidate};delete fields.requestedAt;
  const published=PublishedCapabilityVersionSchema.parse({...fields,
    publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
    policyValidationHash});
  await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
    publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
    VALUES($1,$2,2,'PUBLISHED',$3,$4,$5,now())`,
  [versionId,capability,published,published.workerManifestHash,policyValidationHash]);
  await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
    [capability,versionId]);
  const before=(await pool.query('SELECT latest_heartbeat_reported_at AS at FROM worker_devices WHERE id=$1',
    [worker])).rows[0].at;
  const revision=(await pool.query('SELECT revision FROM worker_cloud_control_revisions WHERE worker_device_id=$1',
    [worker])).rows[0].revision;
  await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
    protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
    workerDeviceId:worker,workerRelease:'m16-test',
    sentAt:new Date(Math.max(Date.now(),before.getTime()+1000)).toISOString(),
    openClawVersion:'2026.8.2',status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
    localRevision:0,acknowledgedCloudRevision:Number(revision),
    capabilityReadiness:[{capabilityVersionId:versionId,policyValidationHash,
      state:'READY',checks:{sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true}}]},
  worker,plane);
  const inputBytes=Buffer.from('M13 private input\n');
  const {BuyerApiKeyRepository}=await import('../dist/packages/persistence/src/buyer-api-keys.js');
  const clientKey=await new BuyerApiKeyRepository(pool,'test').create(buyer,
    {name:'M16 core Worker slice',scopes:['jobs:create','jobs:read','assets:read']});
  const jobBody={inputs:{question:'Summarize the private input and make a report'},
    assets:{supportingFile:[inputAssetId]}};
  const purchased=await call('POST',`capabilities/${capability}/jobs`,jobBody,
    'm16-real-openclaw-0001',clientKey.secret);
  assert.equal(purchased.status,201,JSON.stringify(await purchased.clone().json()));
  const jobId=(await purchased.json()).jobId;
  const lease=await execution.offer(jobId,worker,plane,120);
  const offer=await execution.materializeOffer(lease.executionId);
  assert.equal(offer.capabilityVersionId,versionId);
  const binding={jobId,executionId:offer.executionId,attemptId:offer.attemptId,
    workerDeviceId:worker,controlPlaneId:plane,leaseToken:offer.leaseToken};
  let lastCloudError=null;
  const checked=async(kind,body)=>{
    const response=await rpc(kind,body);
    if(response.status!==200)lastCloudError={kind,status:response.status,
      body:await response.clone().json()};
    assert.equal(response.status,200,`${kind}: ${JSON.stringify(await response.clone().json())}`);
    return response.json();
  };
  const cloud={
    async accept(_offer,messageId){await checked('ACCEPT',{...binding,messageId});},
    async acceptedInput(){return checked('ACCEPTED_INPUT',binding);},
    async transition(_offer,event){await checked('TRANSITION',{...binding,event});},
    async renewLease(_offer,ttlSeconds){return (await checked('RENEW_LEASE',
      {...binding,ttlSeconds})).leaseExpiresAt;},
    async prepareResultAsset(_offer,asset){return checked('PREPARE_RESULT_ASSET',
      {...binding,...asset});},
    async finalizeResult(result){assert.deepEqual(await checked('FINALIZE_RESULT',result),{ok:true});},
    async failExecution(_offer,input){await checked('TRANSITION',{...binding,event:{
      id:workerExecutionEventId(offer.executionId,input.to),jobId,from:input.from,to:input.to,
      actor:'WORKER',reason:input.reason,attemptId:offer.attemptId,
      correlationId:offer.executionId,paymentReservationId:null,resultManifestId:null}});},
  };
  const earningsBefore=await finance.sellerEarnings(seller);
  const root=mkdtempSync(join(tmpdir(),'kivro-m16-core-worker-'));
  const stateDir=join(root,'state'),attemptRoot=join(root,'attempts');
  mkdirSync(stateDir,{mode:0o700});mkdirSync(attemptRoot,{mode:0o700});
  const runtimeRoot=resolve('runtime/openclaw'),approvalPath=join(root,'approval.json');
  writeFileSync(approvalPath,JSON.stringify({schemaVersion:1,image,openClawVersion:'2026.8.2',
    runtimeSourceHash:await hashOpenClawRuntimeSource(runtimeRoot),
    conformanceSuite:'m07-openclaw-execution/1',
    conformancePassedAt:new Date().toISOString()}),{mode:0o600});
  const readiness={async check(){return {ready:true,checkedAt:new Date().toISOString(),
    policyValidationHash,sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true,
    capacityAvailable:true};}};
  const localState=new WorkerLocalState(stateDir,readiness);
  const dockerControl=new DockerJobControlAdapter(docker);
  const jobControl=new WorkerJobControl(stateDir,dockerControl,readiness,
    {maxPauseDurationMs:60_000});
  const outbox=new WorkerResultOutbox(stateDir);
  let calls=0;
  const completion=new SellerCompletionBroker({async resolve(){return 'synthetic-key';}},
    {providerId:'synthetic',async complete(request,credential){
      assert.equal(credential,'synthetic-key');
      assert.equal(request.stream,false);
      calls++;
      if(calls===2)assert.ok(request.messages.some((item)=>item.role==='tool'&&
        item.content.includes(inputBytes.toString('base64'))));
      const invocation=calls===1?{name:'kivro_read_input',arguments:JSON.stringify({
        fieldKey:'supportingFile',assetId:inputAssetId,offset:0,length:100})}:
        calls===2?{name:'kivro_write_output',arguments:JSON.stringify({name:'report.txt',offset:0,
          bytesBase64:Buffer.from('M16 sandboxed report\n').toString('base64')})}:
          {name:'kivro_submit_result',arguments:JSON.stringify({fields:{
            answer:{type:'LONG_TEXT',value:'The private document was summarized.'},
            report:{type:'FILE',path:'report.txt'}}})};
      return {id:randomUUID(),object:'chat.completion',created:Math.floor(Date.now()/1000),
        model:'broker',choices:[{index:0,finish_reason:calls<4?'tool_calls':'stop',
          message:calls<4?{role:'assistant',content:null,tool_calls:[{id:`call_${calls}`,
            type:'function',function:invocation}]}:{role:'assistant',content:'Submitted.'}}],
        usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16}};
    }},{async reserve(){},async settle(){}});
  const supervisor=new WorkerExecutionSupervisor({cloud,localState,readiness,jobControl,outbox,
    sandbox:new DockerSandboxAdapter({dockerExecutable:docker,approvedImage:image,
      collectorImage:image,attemptRoot}),docker:dockerControl,dockerExecutable:docker,
    brokerPorts:{completion},storage:null,attemptRoot,
    storageOrigin:new URL(process.env.OBJECT_STORAGE_ENDPOINT).origin,
    allowInsecureLoopbackStorage:true,approvedImage:image,
    imageApproval:new OpenClawImageApproval(approvalPath,runtimeRoot,docker),
    localWorkerDeviceId:worker,authenticatedControlPlaneId:plane});
  try{
    try{await supervisor.execute(offer,pkg,[]);}
    catch(error){if(lastCloudError)throw new Error(`Cloud RPC: ${JSON.stringify(lastCloudError)}`,
      {cause:error});if(error?.cause)throw new Error(`Upload: ${error.cause.message}`,
      {cause:error});throw error;}
    assert.equal(calls,4);
    assert.equal(outbox.pending().length,0);
    assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1',[jobId])).rows[0].status,
      'COMPLETED');
    const asset=(await pool.query(`SELECT a.id FROM assets a JOIN job_result_assets r
      ON r.asset_id=a.id JOIN job_result_manifests m ON m.id=r.manifest_id
      WHERE m.job_id=$1`,[jobId])).rows[0].id;
    const downloaded=await call('GET',`assets/${asset}`,null,null,clientKey.secret);
    assert.equal(downloaded.status,200);
    assert.equal(Buffer.from(await downloaded.arrayBuffer()).toString(),'M16 sandboxed report\n');
    assert.equal((await call('GET',`assets/${asset}`,null,null,otherToken)).status,404);
    const pending=outbox.load(offer.executionId);
    await checked('FINALIZE_RESULT',pending);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
      WHERE job_id=$1 AND kind='SETTLE'`,[jobId])).rows[0].n,1,
    'completion replay must never create a second settlement journal');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM payment_reservations
      WHERE job_id=$1 AND state='SETTLED'`,[jobId])).rows[0].n,1);
    const earnings=await finance.sellerEarnings(seller);
    assert.equal(earnings.pendingMinor,earningsBefore.pendingMinor+800,
      'one validated paid result creates exactly one seller earning');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM job_result_manifests
      WHERE job_id=$1`,[jobId])).rows[0].n,1);
    assert.deepEqual(await finance.reconcileLedger(),{
      unbalancedJournals:0,negativeProtectedAccounts:0,reservationMismatches:0});
    await finance.recordTestCreditPurchase(buyer,2000,`test-only:${randomUUID()}`);
    const failedPurchase=await call('POST',`capabilities/${capability}/jobs`,jobBody,
      'm16-sandbox-crash-0001',clientKey.secret);
    assert.equal(failedPurchase.status,201);
    const failedJobId=(await failedPurchase.json()).jobId;
    const failedLease=await execution.offer(failedJobId,worker,plane,120);
    const failedOffer=await execution.materializeOffer(failedLease.executionId);
    const failedBinding={jobId:failedJobId,executionId:failedOffer.executionId,
      attemptId:failedOffer.attemptId,workerDeviceId:worker,controlPlaneId:plane,
      leaseToken:failedOffer.leaseToken};
    let failedInferenceCalls=0;
    const failingCompletion=new SellerCompletionBroker({async resolve(){return 'synthetic-key';}},
      {providerId:'synthetic',async complete(){failedInferenceCalls++;
        throw new Error('SYNTHETIC_MODEL_CRASH');}},
      {async reserve(){},async settle(){}});
    const failCloud={
      async accept(_offer,messageId){await checked('ACCEPT',{...failedBinding,messageId});},
      async acceptedInput(){return checked('ACCEPTED_INPUT',failedBinding);},
      async transition(_offer,event){await checked('TRANSITION',{...failedBinding,event});},
      async renewLease(_offer,ttlSeconds){return (await checked('RENEW_LEASE',
        {...failedBinding,ttlSeconds})).leaseExpiresAt;},
      async prepareResultAsset(_offer,asset){return checked('PREPARE_RESULT_ASSET',
        {...failedBinding,...asset});},
      async finalizeResult(result){await checked('FINALIZE_RESULT',result);},
      async failExecution(_offer,input){await checked('TRANSITION',{...failedBinding,event:{
        id:workerExecutionEventId(failedOffer.executionId,input.to),jobId:failedJobId,
        from:input.from,to:input.to,actor:'WORKER',reason:input.reason,
        attemptId:failedOffer.attemptId,correlationId:failedOffer.executionId,
        paymentReservationId:null,resultManifestId:null}});},
    };
    const failingSupervisor=new WorkerExecutionSupervisor({cloud:failCloud,localState,readiness,
      jobControl,outbox,sandbox:new DockerSandboxAdapter({dockerExecutable:docker,
        approvedImage:image,collectorImage:image,attemptRoot}),docker:dockerControl,
      dockerExecutable:docker,brokerPorts:{completion:failingCompletion},storage:null,
      attemptRoot,storageOrigin:new URL(process.env.OBJECT_STORAGE_ENDPOINT).origin,
      allowInsecureLoopbackStorage:true,approvedImage:image,
      imageApproval:new OpenClawImageApproval(approvalPath,runtimeRoot,docker),
      localWorkerDeviceId:worker,authenticatedControlPlaneId:plane});
    await assert.rejects(failingSupervisor.execute(failedOffer,pkg,[]));
    assert.equal(failedInferenceCalls,1,'failure occurs after real sandbox/model start');
    assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1',[failedJobId])).rows[0].status,
      'FAILED_EXECUTION');
    assert.equal((await pool.query('SELECT state FROM payment_reservations WHERE job_id=$1',
      [failedJobId])).rows[0].state,'RELEASED');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
      WHERE job_id=$1 AND kind='SETTLE'`,[failedJobId])).rows[0].n,0);
    assert.equal((await finance.sellerEarnings(seller)).pendingMinor,earnings.pendingMinor);
    assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
  }finally{outbox.close();jobControl.close();localState.close();
    rmSync(root,{recursive:true,force:true});}
  await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
    [capability,originalPackage.capabilityVersionId]);
  const prior=(await pool.query('SELECT latest_heartbeat_reported_at AS at FROM worker_devices WHERE id=$1',
    [worker])).rows[0].at;
  const cloudRevision=(await pool.query('SELECT revision FROM worker_cloud_control_revisions WHERE worker_device_id=$1',
    [worker])).rows[0].revision;
  await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
    protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
    workerDeviceId:worker,workerRelease:'m16-test',
    sentAt:new Date(Math.max(Date.now(),prior.getTime()+1000)).toISOString(),
    openClawVersion:'2026.8.2',status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
    localRevision:0,acknowledgedCloudRevision:Number(cloudRevision),
    capabilityReadiness:[{capabilityVersionId:originalPackage.capabilityVersionId,
      policyValidationHash,state:'READY',checks:{sandboxVerified:true,
        requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
  await finance.recordTestCreditPurchase(buyer,2000,`test-only:${randomUUID()}`);
  return {jobId,versionId};
}
