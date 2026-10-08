import { healthyWorkerChecks } from './fixtures/healthy-worker-checks.mjs';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { PostgresSellerPublicationRepository } from
  '../dist/packages/persistence/src/seller-publication.js';
import { PostgresAvailabilityRepository } from
  '../dist/packages/persistence/src/availability.js';
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
import {runRepresentativePackageTest} from
  '../dist/apps/worker/src/import-review-runner.js';
import {buildWorkerCapabilityReview} from
  '../dist/apps/worker/src/import-review.js';
import {runM16InstalledWorkerE2e,inspectPublicProcessorDisclosure,
  publishInAuthenticatedSellerBrowser} from
  './m16-installed-worker-e2e.mjs';
import {ReadOnlyOpenClawDiscovery} from
  '../dist/packages/openclaw-adapter/src/read-only-discovery.js';
import {buildSuggestedDependencyGraph} from
  '../dist/packages/openclaw-adapter/src/dependency-candidates.js';
import {SellerImportDraftStore} from '../dist/apps/worker/src/import-drafts.js';

/** M16 component slice: v2 is authentically Worker-reviewed and published,
 * while funding uses the deterministic development credit adapter. */
export async function runM16CoreWorkerSlice({pool,buyer,otherToken,seller,sellerAccount,worker,
  capability,originalPackage,policyValidationHash,plane,inputAssetId,call,rpc,
  execution,finance,workerStateDir,workerPassphrasePath,scannerControl}){
  const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
  const image=JSON.parse(execFileSync(docker,['image','inspect','kivro-openclaw-runtime:m07',
    '--format','{{json .RepoDigests}}'],{encoding:'utf8'}))
    .find((value)=>value.startsWith('kivro-openclaw-runtime@sha256:'));
  assert.ok(image,'exact locally built OpenClaw image must be present');
  const versionId=randomUUID();
  const fixture=(name)=>readFileSync(new URL(`./fixtures/m16-document-analyzer/${name}`,
    import.meta.url));
  const inputBytes=fixture('source.txt');
  const summaryBytes=fixture('summary.md');
  const structuredBytes=fixture('structured-result.json');
  assert.equal(JSON.parse(structuredBytes.toString()).source,'source.txt');
  const skillBytes=fixture('SKILL.md');
  const discoveryRoot=mkdtempSync(join(realpathSync(tmpdir()),'kivro-m16-discovery-'));
  let skillHash,reviewedSkills;
  try{
    const stateDir=join(discoveryRoot,'.openclaw');
    const workspaceDir=join(stateDir,'workspace');
    const configPath=join(stateDir,'openclaw.json');
    const skillDir=join(workspaceDir,'skills','kivro-document-analyzer');
    mkdirSync(skillDir,{recursive:true,mode:0o700});
    writeFileSync(configPath,'{}',{mode:0o600});
    writeFileSync(join(skillDir,'SKILL.md'),skillBytes,{mode:0o600});
    const discovery=new ReadOnlyOpenClawDiscovery({homeDir:discoveryRoot,
      stateDir,workspaceDir,configPath});
    const scanned=await discovery.scan();
    const discovered=scanned.skills.find((item)=>item.name==='kivro-document-analyzer');
    assert.equal(discovered?.consent,'not-granted');
    assert.equal(discovered?.ambiguous,false);
    const graph=buildSuggestedDependencyGraph(scanned,discovered.name);
    const drafts=new SellerImportDraftStore(discoveryRoot);
    let selected;
    try{
      const draft=drafts.createDraft(versionId,sellerAccount,graph);
      selected=drafts.applySelection({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId:sellerAccount,dependencyId:graph.rootId,selected:true,
        expectedRevision:draft.revision,actedAt:new Date().toISOString()});
    }finally{drafts.close();}
    assert.equal(selected.graph.nodes.find((item)=>item.id===graph.rootId)?.selected,true);
    const snapshot=await discovery.snapshotSelectedSkill(discovered.name);
    skillHash=snapshot.contentHash;
    reviewedSkills=[{name:snapshot.name,files:snapshot.files}];
    assert.deepEqual(Buffer.from(snapshot.files[0].bytesBase64,'base64'),skillBytes);
    assert.deepEqual(readFileSync(join(skillDir,'SKILL.md')),skillBytes,
      'read-only discovery and explicit selection must not mutate the skill');
  }finally{rmSync(discoveryRoot,{recursive:true,force:true});}
  const providerBudget={providerId:'synthetic',modelId:'broker',credentialRef:'seller:m16-fixture',
    maxRequestsPerJob:6,maxInputTokensPerRequest:8192,maxOutputTokensPerRequest:2048,
    maxEstimatedSpendMicroUsdPerJob:100_000,
    inputPriceMicroUsdPerMillionTokens:1_000_000,
    outputPriceMicroUsdPerMillionTokens:1_000_000};
  const pkg={...originalPackage,capabilityVersionId:versionId,
    workerManifest:{...originalPackage.workerManifest,capabilityVersionId:versionId,
      skills:[{name:'kivro-document-analyzer',contentHash:skillHash}],
      limits:{...originalPackage.workerManifest.limits,memoryMb:1024,maxPids:128,
        maxInputBytes:65536,maxOutputBytes:65536}},
    ioContract:{...originalPackage.ioContract,output:{schemaVersion:1,fields:[
      {key:'summary',label:'Summary',order:0,required:true,type:'FILE',constraints:{
        minFiles:1,maxFiles:1,maxFileSizeBytes:65536,maxTotalSizeBytes:65536,
        allowedMimeTypes:['text/markdown'],allowedExtensions:['.md']}},
      {key:'structuredResult',label:'Structured result',order:1,required:true,type:'FILE',
        constraints:{minFiles:1,maxFiles:1,maxFileSizeBytes:65536,maxTotalSizeBytes:65536,
          allowedMimeTypes:['application/json'],allowedExtensions:['.json']}}]}},
    dependencySnapshot:[...originalPackage.dependencySnapshot,{
      id:'kivro-document-analyzer',version:'m16-fixture',contentHash:skillHash}],
    permissionPolicy:{...originalPackage.permissionPolicy,aiInference:'SELLER',providerBudget,
      buyerFileAccess:true,sellerCredentialRefs:['seller:m16-fixture']},
    dependencyGraph:{graphVersion:1,rootId:'skill',inference:{mode:'REMOTE_PROVIDER',
      dependencyId:'model',provider:'synthetic',model:'broker',
      credentialRef:'credential',billingOwner:'SELLER'},alternatives:[],nodes:[
      {id:'skill',type:'SKILL',name:'kivro-document-analyzer',requirement:'REQUIRED',
        sensitivity:'MEDIUM',discoveredFrom:['SKILL_METADATA'],dependsOn:['model'],
        marketplaceSupport:'UNDETERMINED',confidence:'CONFIRMED',selected:true,
        health:'UNKNOWN'},
      ...[['model','AI_MODEL',['provider','credential']],
        ['provider','AI_PROVIDER',[]],['credential','CREDENTIAL',[]]].map(
          ([id,type,dependsOn])=>({id,type,name:id,requirement:'REQUIRED',
            sensitivity:'MEDIUM',discoveredFrom:['SELLER_DECLARATION'],dependsOn,
            marketplaceSupport:'UNDETERMINED',confidence:'CONFIRMED',selected:true,
            health:'UNKNOWN'}))]},
    sellerInferenceConfigHash:`sha256:${'c'.repeat(64)}`};
  const reviewRoot=mkdtempSync(join(tmpdir(),'kivro-m16-real-review-'));
  const reviewState=join(reviewRoot,'state'),reviewAttempts=join(reviewRoot,'attempts');
  mkdirSync(reviewState,{mode:0o700});mkdirSync(reviewAttempts,{mode:0o700});
  const reviewRecord=join(reviewRoot,'approval.json'),runtimeRoot=resolve('runtime/openclaw');
  writeFileSync(reviewRecord,JSON.stringify({schemaVersion:1,image,
    openClawVersion:'2026.8.2',
    runtimeSourceHash:await hashOpenClawRuntimeSource(runtimeRoot),
    conformanceSuite:'m07-openclaw-execution/1',
    conformancePassedAt:new Date().toISOString()}),{mode:0o600});
  const reviewReady={async check(){return {ready:false,
    checkedAt:new Date().toISOString(),blockingReasons:['REVIEW_ONLY']};}};
  const reviewLocal=new WorkerLocalState(reviewState,reviewReady);
  const reviewDocker=new DockerJobControlAdapter(docker);
  const reviewJobs=new WorkerJobControl(reviewState,reviewDocker,reviewReady,
    {maxPauseDurationMs:60_000});
  const sampleAssetId=randomUUID();
  let reviewCalls=0;
  const reviewCompletion=new SellerCompletionBroker({async resolve(){return 'synthetic-key';}},
    {providerId:'synthetic',async complete(){reviewCalls++;
      const invocation=reviewCalls===1?{name:'kivro_read_input',arguments:JSON.stringify({
        fieldKey:'supportingFile',assetId:sampleAssetId,offset:0,length:1000})}:
        reviewCalls===2?{name:'kivro_write_output',arguments:JSON.stringify({
          name:'summary.md',offset:0,bytesBase64:summaryBytes.toString('base64')})}:
        reviewCalls===3?{name:'kivro_write_output',arguments:JSON.stringify({
          name:'structured-result.json',offset:0,
          bytesBase64:structuredBytes.toString('base64')})}:
          {name:'kivro_submit_result',arguments:JSON.stringify({fields:{
            summary:{type:'FILE',path:'summary.md'},
            structuredResult:{type:'FILE',path:'structured-result.json'}}})};
      return {id:randomUUID(),object:'chat.completion',created:Math.floor(Date.now()/1000),
        model:'broker',choices:[{index:0,finish_reason:reviewCalls<5?'tool_calls':'stop',
          message:reviewCalls<5?{role:'assistant',content:null,tool_calls:[{
            id:`review_${reviewCalls}`,type:'function',function:invocation}]}:
            {role:'assistant',content:'Submitted.'}}],
        usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16}};
    }},{async reserve(){},async settle(){}});
  let tested;
  try{
    tested=await runRepresentativePackageTest(pkg,reviewedSkills,{
      values:{question:'Summarize the private input and make a report'},
      assets:{supportingFile:[sampleAssetId]}},{
      attemptRoot:reviewAttempts,dockerExecutable:docker,approvedImage:image,
      sampleFiles:[{fieldKey:'supportingFile',assetId:sampleAssetId,extension:'.txt',
        detectedMimeType:'text/plain',bytesBase64:inputBytes.toString('base64')}],
      imageApproval:new OpenClawImageApproval(reviewRecord,runtimeRoot,docker),
      sandbox:new DockerSandboxAdapter({dockerExecutable:docker,approvedImage:image,
        collectorImage:image,attemptRoot:reviewAttempts}),docker:reviewDocker,
      jobControl:reviewJobs,localState:reviewLocal,
      brokerPorts:{completion:reviewCompletion},
      async checkDependencies(candidate){return {ready:true,
        verifiedNodeIds:candidate.dependencyGraph.nodes.filter((node)=>node.selected)
          .map((node)=>node.id),evidence:{dedicatedModel:true,selectedSkillHash:skillHash}};}});
    assert.equal(reviewCalls,5);
  }finally{reviewJobs.close();reviewLocal.close();
    rmSync(reviewRoot,{recursive:true,force:true});}
  const reviewedPkg=tested.reviewedPackage;
  const {revision:priceRevision,...selectedPrice}=await new PostgresPriceTierCatalog(pool)
    .selected('USD_999');
  assert.ok(priceRevision>0);
  const review=buildWorkerCapabilityReview(tested,{versionNumber:2,
    selectedPrice,externalProcessors:['synthetic']},{
    workerDeviceId:worker,controlPlaneId:plane,
    providerUsage:{requests:reviewCalls,estimatedMicroUsd:10_000,unsettled:0}});
  assert.deepEqual(review.candidate.externalProcessors,
    [pkg.dependencyGraph.inference.provider]);
  const publication=new PostgresSellerPublicationRepository(pool);
  await pool.query('UPDATE accounts SET auth_email_verified=true WHERE id=$1',
    [sellerAccount]);
  const staged=await publication.stageFromAuthenticatedWorker(review,worker);
  const slug=(await pool.query('SELECT slug FROM capabilities WHERE id=$1',
    [capability])).rows[0].slug;
  const sellerAuth=await publishInAuthenticatedSellerBrowser({pool,sellerAccount,
    seller,review,slug,versionId,screenshotTag:'remote'});
  const available=new PostgresAvailabilityRepository(pool,finance);
  const availabilityRevision=(await pool.query(`SELECT revision FROM
    capability_availability_policies WHERE capability_id=$1`,[capability])).rows[0].revision;
  await available.setCapabilityPolicy({capabilityId:capability,
    sellerAccountId:sellerAccount,policy:{schedule:null,concurrencyLimit:1,
      queueLimit:2,futureReservationLimit:2,estimatedRuntimeSeconds:60,
      maxWaitSeconds:604800},paused:false,source:'WEB',
    expectedRevision:Number(availabilityRevision)});
  const before=(await pool.query('SELECT latest_heartbeat_reported_at AS at FROM worker_devices WHERE id=$1',
    [worker])).rows[0].at;
  const revision=(await pool.query('SELECT revision FROM worker_cloud_control_revisions WHERE worker_device_id=$1',
    [worker])).rows[0].revision;
  await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,
    protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
    workerDeviceId:worker,workerRelease:'m16-test',
    sentAt:new Date(Math.max(Date.now(),before.getTime()+1000)).toISOString(),
    openClawVersion:'2026.8.2',status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
    localRevision:0,acknowledgedCloudRevision:Number(revision),
    capabilityReadiness:[{capabilityVersionId:versionId,
      policyValidationHash:staged.policyValidationHash,
      state:'READY',checks:{sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true}}]},
  worker,plane);
  await inspectPublicProcessorDisclosure({slug,expectedProcessors:['synthetic']});
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
  const approvalPath=join(root,'approval.json');
  writeFileSync(approvalPath,JSON.stringify({schemaVersion:1,image,openClawVersion:'2026.8.2',
    runtimeSourceHash:await hashOpenClawRuntimeSource(runtimeRoot),
    conformanceSuite:'m07-openclaw-execution/1',
    conformancePassedAt:new Date().toISOString()}),{mode:0o600});
  const readiness={async check(){return {ready:true,checkedAt:new Date().toISOString(),
    policyValidationHash:staged.policyValidationHash,
    sandboxVerified:true,requiredSecretsReady:true,runtimeHealthy:true,
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
        item.content.includes(inputBytes.subarray(0,1000).toString('base64'))));
      const invocation=calls===1?{name:'kivro_read_input',arguments:JSON.stringify({
        fieldKey:'supportingFile',assetId:inputAssetId,offset:0,length:1000})}:
        calls===2?{name:'kivro_write_output',arguments:JSON.stringify({name:'summary.md',offset:0,
          bytesBase64:summaryBytes.toString('base64')})}:
        calls===3?{name:'kivro_write_output',arguments:JSON.stringify({
          name:'structured-result.json',offset:0,
          bytesBase64:structuredBytes.toString('base64')})}:
          {name:'kivro_submit_result',arguments:JSON.stringify({fields:{
            summary:{type:'FILE',path:'summary.md'},
            structuredResult:{type:'FILE',path:'structured-result.json'}}})};
      return {id:randomUUID(),object:'chat.completion',created:Math.floor(Date.now()/1000),
        model:'broker',choices:[{index:0,finish_reason:calls<5?'tool_calls':'stop',
          message:calls<5?{role:'assistant',content:null,tool_calls:[{id:`call_${calls}`,
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
    try{await supervisor.execute(offer,reviewedPkg,reviewedSkills);}
    catch(error){if(lastCloudError)throw new Error(`Cloud RPC: ${JSON.stringify(lastCloudError)}`,
      {cause:error});if(error?.cause)throw new Error(`Upload: ${error.cause.message}`,
      {cause:error});throw error;}
    assert.equal(calls,5);
    assert.equal(outbox.pending().length,0);
    assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1',[jobId])).rows[0].status,
      'COMPLETED');
    const assets=(await pool.query(`SELECT a.id,r.field_key FROM assets a JOIN job_result_assets r
      ON r.asset_id=a.id JOIN job_result_manifests m ON m.id=r.manifest_id
      WHERE m.job_id=$1 ORDER BY r.field_key`,[jobId])).rows;
    assert.equal(assets.length,2);
    for(const asset of assets){
      const downloaded=await call('GET',`assets/${asset.id}`,null,null,clientKey.secret);
      assert.equal(downloaded.status,200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),
        asset.field_key==='summary'?summaryBytes:structuredBytes);
      assert.equal((await call('GET',`assets/${asset.id}`,null,null,otherToken)).status,404);
    }
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
    await assert.rejects(failingSupervisor.execute(failedOffer,reviewedPkg,reviewedSkills));
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
  if(process.env.M16_INSTALLED_WORKER==='1'){
    await runM16InstalledWorkerE2e({pool,buyer,otherToken,seller,sellerAccount,
      worker,capability,reviewedPkg,reviewedSkills,selectedPrice,inputAssetId,
      priorPaidJobId:jobId,
      workerStateDir,workerPassphrasePath,image,summaryBytes,structuredBytes,
      inputBytes,finance,plane,scannerControl,
      sellerAuth,
      reviewedPolicyValidationHash:staged.policyValidationHash});
  }
  const prior=(await pool.query('SELECT latest_heartbeat_reported_at AS at FROM worker_devices WHERE id=$1',
    [worker])).rows[0].at;
  const cloudRevision=(await pool.query('SELECT revision FROM worker_cloud_control_revisions WHERE worker_device_id=$1',
    [worker])).rows[0].revision;
  await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,
    protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
    workerDeviceId:worker,workerRelease:'m16-test',
    sentAt:new Date(Math.max(Date.now(),prior.getTime()+1000)).toISOString(),
    openClawVersion:'2026.8.2',status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
    localRevision:0,acknowledgedCloudRevision:Number(cloudRevision),
    capabilityReadiness:[{capabilityVersionId:originalPackage.capabilityVersionId,
      policyValidationHash,state:'READY',checks:{sandboxVerified:true,
        requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
  await publication.rollback(sellerAccount,capability,
    originalPackage.capabilityVersionId,versionId,randomUUID());
  const restoreRevision=(await pool.query(`SELECT revision FROM
    capability_availability_policies WHERE capability_id=$1`,[capability])).rows[0].revision;
  await available.setCapabilityPolicy({capabilityId:capability,
    sellerAccountId:sellerAccount,policy:{schedule:null,concurrencyLimit:1,
      queueLimit:2,futureReservationLimit:2,estimatedRuntimeSeconds:60,
      maxWaitSeconds:604800},paused:false,source:'WEB',
    expectedRevision:Number(restoreRevision)});
  const restoredCloudRevision=(await pool.query(`SELECT revision FROM
    worker_cloud_control_revisions WHERE worker_device_id=$1`,[worker])).rows[0].revision;
  const restoredAt=(await pool.query(`SELECT latest_heartbeat_reported_at AS at
    FROM worker_devices WHERE id=$1`,[worker])).rows[0].at;
  await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',operationalChecks:healthyWorkerChecks,
    protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
    workerDeviceId:worker,workerRelease:'m16-test',
    sentAt:new Date(Math.max(Date.now(),restoredAt.getTime()+1000)).toISOString(),
    openClawVersion:'2026.8.2',status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
    localRevision:0,acknowledgedCloudRevision:Number(restoredCloudRevision),
    capabilityReadiness:[{capabilityVersionId:originalPackage.capabilityVersionId,
      policyValidationHash,state:'READY',checks:{sandboxVerified:true,
        requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
  await finance.recordTestCreditPurchase(buyer,2000,`test-only:${randomUUID()}`);
  return {jobId,versionId};
}
