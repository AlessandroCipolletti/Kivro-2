import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import { buildVersionCandidate } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { MarketplaceCatalog } from '../dist/packages/persistence/src/marketplace-catalog.js';
import { MarketplaceSocialRepository } from '../dist/packages/persistence/src/marketplace-social.js';
import { MarketplaceBuyerRepository } from '../dist/packages/persistence/src/marketplace-buyer.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { MarketplaceAgentRepository } from '../dist/packages/persistence/src/marketplace-agent.js';
import { PostgresPlatformInferenceUsage } from '../dist/packages/persistence/src/platform-inference-usage.js';
import { MarketplaceAgentPlanner } from '../dist/packages/application/src/marketplace-agent-planner.js';
import { MarketplaceAgentDiscoveryService } from '../dist/packages/application/src/marketplace-agent.js';
import { AgentPurchaseAuthorizationService } from '../dist/packages/application/src/agent-purchase-authorization.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

if(!process.env.M11_DATABASE_URL){test('M11 requires disposable PostgreSQL',{skip:true},()=>{});}else{
  test('M11 durable agent plan, approval, purchase and isolation',async()=>{
    const pool=new pg.Pool({connectionString:process.env.M11_DATABASE_URL,max:16});
    const finance=new PostgresFinanceRepository(pool,'test');
    const availability=new PostgresAvailabilityRepository(pool,finance);
    const execution=new PostgresJobExecutionRepository(pool,finance,
      new HmacLeaseTokenIssuer({v1:Buffer.alloc(32,17)},'v1'),availability,
      {async scan(){return 'CLEAN';}});
    const catalog=new MarketplaceCatalog(pool,availability);
    const social=new MarketplaceSocialRepository(pool);
    const buyerRepo=new MarketplaceBuyerRepository(pool,availability,finance,execution);
    const buyer=randomUUID(),other=randomUUID(),sellerAccount=randomUUID(),seller=randomUUID();
    const worker=randomUUID(),capability=randomUUID(),versionId=randomUUID();
    const hash=`sha256:${'a'.repeat(64)}`,plane='m10-test-plane';
    const slug=`m10-${capability}`;
    try{
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$4,'ACTIVE',now()),($2,$5,'ACTIVE',now()),($3,$6,'ACTIVE',now())`,
      [buyer,other,sellerAccount,`${buyer}@example.test`,`${other}@example.test`,
        `${sellerAccount}@example.test`]);
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
        VALUES($1,$2,'Verified Seller','ACTIVE','READY')`,[seller,sellerAccount]);
      await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_account_id,
        stripe_mode,onboarding_status,transfers_enabled,payouts_enabled,country,last_reconciled_at)
        VALUES($1,'acct_M10TEST','test','READY',true,true,'US',now())`,[seller]);
      await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
        worker_version,status) VALUES($1,$2,'m10-key','M10 Worker','LINUX','test','ONLINE')`,
      [worker,seller]);
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
        VALUES($1,$2,$3,'Research brief','A focused research brief','PUBLISHED')`,
      [capability,seller,slug]);
      const localPackage={packageVersion:1,capabilityId:capability,capabilityVersionId:versionId,
        workerDeviceId:worker,workerManifest:{manifestVersion:1,workerId:randomUUID(),
          capabilityVersionId:versionId,runtime:{type:'openclaw',supportedVersionRange:'>=2026.8.2 <2026.9.0'},
          skills:[],tools:{allow:[],deny:['browser','exec','gateway']},resources:[],
          network:{default:'deny',allow:[]},limits:{timeoutSeconds:120,memoryMb:128,cpu:1,
            maxPids:32,maxInputBytes:1000,maxOutputBytes:1000}},
        dependencyGraph:{graphVersion:1,rootId:'skill',inference:null,alternatives:[],nodes:[
          {id:'skill',type:'SKILL',name:'Skill',requirement:'REQUIRED',sensitivity:'LOW',
            discoveredFrom:['SKILL_METADATA'],dependsOn:[],marketplaceSupport:'UNDETERMINED',
            confidence:'CONFIRMED',selected:false,health:'UNKNOWN'}]},
        permissionPolicy:{policyVersion:1,aiInference:'NONE',publicInternet:'DENY',browser:false,
          proprietaryDatabase:'NONE',privateApi:'NONE',selectedFileResourceIds:[],
          selectedDirectoryResourceIds:[],localSoftware:false,shell:false,
          externalSideEffects:false,buyerFileAccess:false,sellerCredentialRefs:[]},
        sellerInferenceConfigHash:null,ioContract:{contractVersion:1,
          input:{schemaVersion:1,fields:[{key:'question',label:'Question',order:0,
            group:'PROJECT',required:true,type:'LONG_TEXT'},
            {key:'supportingFile',label:'Supporting file',order:1,group:'SOURCE',
            required:false,type:'FILE',constraints:{minFiles:0,maxFiles:1,
              maxFileSizeBytes:1000,maxTotalSizeBytes:1000,
              allowedMimeTypes:['text/plain'],allowedExtensions:['.txt']}}]},
          output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
            required:true,type:'LONG_TEXT'},
            {key:'report',label:'Research file',order:1,required:false,type:'FILE',
              constraints:{maxFiles:1,maxFileSizeBytes:1000,maxTotalSizeBytes:1000,
                allowedMimeTypes:['text/plain'],allowedExtensions:['.txt']}}]}},
        priceTier:'USD_999',dependencySnapshot:[],concurrencyLimit:1,
        exampleRefs:[],testRefs:[],pauseSupport:'NOT_SUPPORTED'};
      const candidate=buildVersionCandidate({id:versionId,capabilityId:capability,
        versionNumber:1,workerDeviceId:worker,requestedAt:new Date().toISOString(),localPackage,
        selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_999')});
      const fields={...candidate};delete fields.requestedAt;
      const published=PublishedCapabilityVersionSchema.parse({...fields,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:hash});
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [versionId,capability,published,published.workerManifestHash,hash]);
      await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC' WHERE id=$1`,
        [capability,versionId]);
      await availability.setWorkerDefault({workerDeviceId:worker,sellerAccountId:sellerAccount,
        schedule:{mode:'ALWAYS_AVAILABLE',timezone:'UTC',weeklyWindows:[]},paused:false,
        source:'WEB',expectedRevision:null});
      await availability.setCapabilityPolicy({capabilityId:capability,sellerAccountId:sellerAccount,
        policy:{schedule:null,concurrencyLimit:1,queueLimit:2,futureReservationLimit:2,
          estimatedRuntimeSeconds:60,maxWaitSeconds:604800},paused:false,source:'WEB',
        expectedRevision:null});
      await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',sentAt:new Date().toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,capabilityReadiness:[{capabilityVersionId:versionId,
          policyValidationHash:hash,state:'READY',checks:{sandboxVerified:true,
            requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
      await social.setSellerMetadata(capability,sellerAccount,{category:'RESEARCH',
        shortDescription:'A focused research brief',tags:['research','brief'],
        strengths:['Fast scope'],limitations:['No private web access']});
      const repo=new MarketplaceAgentRepository(pool);
      const conversation=randomUUID();
      await repo.createConversation(buyer,conversation);
      await repo.createConversation(buyer,conversation);
      await assert.rejects(repo.createConversation(other,conversation),{code:'CONFLICT'});
      const messageId=randomUUID();
      await repo.appendMessage({id:messageId,buyerId:buyer,conversationId:conversation,
        role:'BUYER',body:'Research Acme under $20'});
      await repo.appendMessage({id:messageId,buyerId:buyer,conversationId:conversation,
        role:'BUYER',body:'Research Acme under $20'});
      await assert.rejects(repo.appendMessage({id:messageId,buyerId:buyer,
        conversationId:conversation,role:'BUYER',body:'Spend more'}),{code:'CONFLICT'});
      await assert.rejects(repo.messages(other,conversation),{code:'NOT_FOUND'});
      assert.equal((await repo.messages(buyer,conversation)).length,1);
      const draft={capabilityId:capability,capabilityVersionId:versionId,
        values:{question:'Research Acme'},assets:{},missingFieldKeys:[],warnings:[]};
      const draftId=await repo.saveDraft(buyer,conversation,draft);
      assert.equal((await repo.draft(buyer,draftId)).values.question,'Research Acme');
      assert.equal(await repo.draft(other,draftId),null);
      const usage=new PostgresPlatformInferenceUsage(pool,{requestsPerMinute:3,
        turnsPerDay:4,reservedTokensPerDay:300});
      await usage.recordRoutingConfiguration({INTENT_EXTRACTION:{provider:'openai',
        model:'configured-test-model'}});
      await usage.recordRoutingConfiguration({INTENT_EXTRACTION:{model:'configured-test-model',
        provider:'openai'}});
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM platform_ai_profile_audit'))
        .rows[0].n,1);
      await assert.rejects(pool.query('DELETE FROM platform_ai_profile_audit'));
      const guards=await Promise.allSettled(Array.from({length:5},()=>usage.reserveRequest({
        userId:buyer,task:'INTENT_EXTRACTION',maxTokens:100})));
      assert.equal(guards.filter((item)=>item.status==='fulfilled').length,3);
      assert.equal(guards.filter((item)=>item.status==='rejected').length,2);
      const guard=guards.find((item)=>item.status==='fulfilled').value;
      const accounting={requestId:guard,userId:buyer,conversationId:conversation,
        task:'INTENT_EXTRACTION',provider:'openai',model:'configured-test-model',
        inputTokens:30,outputTokens:10,cachedInputTokens:0,estimatedCostMicrousd:5,
        latencyMs:3,outcome:'SUCCESS',toolCallCount:0};
      await usage.recordUsage(accounting);
      await usage.recordUsage(accounting);
      await assert.rejects(usage.recordUsage({...accounting,outputTokens:11}),
        {code:'INVALID_REQUEST'});
      assert.deepEqual(await usage.summary(buyer),{requests:1,estimatedCostMicrousd:5});
      const metrics=await usage.metrics(new Date(Date.now()-86_400_000),
        new Date(Date.now()+1000));
      assert.equal(metrics.days[0].requests,1);
      assert.equal(metrics.users[0].buyerId,buyer);
      assert.equal(metrics.conversations[0].conversationId,conversation);
      const publishedDoc=await catalog.discoveryDocument(capability);
      assert.ok(publishedDoc);
      assert.equal(publishedDoc.priceMinor,999);
      assert.equal(JSON.stringify(publishedDoc).includes('sellerCredentialRefs'),false);
      assert.equal((await catalog.search({query:'supporting',limit:10,offset:0}))[0]?.id,
        capability);
      const fakeInference={generate:async(request)=>({structuredOutput:request.task==='INPUT_PREPARATION'?
        {values:[{fieldKey:'question',value:'Research Acme'}],assetAssignments:[]}:
        {steps:[{key:'research',capabilityId:capability,dependsOnKeys:[],
          inputValues:[{fieldKey:'question',value:'Research Acme'}],inputAssetIds:[],mappings:[]}]}})};
      const discovery=new MarketplaceAgentDiscoveryService(catalog,repo,()=>buyerRepo,fakeInference);
      const prepared=await discovery.prepareDraft({buyerId:buyer,conversationId:conversation,
        capabilityId:capability,request:'Research Acme',ownedAssetIds:[]});
      assert.equal(prepared.values.question,'Research Acme');
      const planner=new MarketplaceAgentPlanner(catalog,availability,()=>buyerRepo,repo,fakeInference);
      const constraints={maxTotalSpendMinor:2000,onlineOnly:false,outputTypes:[],
        requiredInputTypes:[],blockedSellerIds:[],preferredCapabilityIds:[],
        permissionLimits:[],timing:{mode:'IMMEDIATE',maxQueueWaitSeconds:0}};
      const proposed=await planner.propose({buyerId:buyer,conversationId:conversation,
        goal:'Research Acme',constraints,candidateIds:[capability],ownedAssetIds:[]});
      assert.equal(proposed.plan.quotedTotalMinor,999);
      assert.equal(proposed.plan.steps.length,1);
      assert.equal((await repo.createPlan(proposed.plan,[publishedDoc])).id,proposed.plan.id);
      assert.equal((await repo.plan(other,proposed.plan.id)),null);
      const authorizer=new AgentPurchaseAuthorizationService(pool,repo,catalog,availability,buyerRepo);
      assert.equal(await authorizer.advanceOne(buyer,proposed.plan.id),'PAUSED');
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM jobs WHERE id=$1',
        [proposed.plan.steps[0].jobId])).rows[0].n,0);
      await buyerRepo.acceptTerms(buyer,randomUUID());
      await finance.recordTestCreditPurchase(buyer,100,`test-only:${randomUUID()}`);
      const approvalId=randomUUID();
      await repo.approvePlan(buyer,proposed.plan.id,approvalId);
      await repo.approvePlan(buyer,proposed.plan.id,approvalId);
      await assert.rejects(repo.approvePlan(buyer,proposed.plan.id,randomUUID()),{code:'CONFLICT'});
      assert.equal(await authorizer.advanceOne(buyer,proposed.plan.id),'PAUSED');
      const unfundedJob=await pool.query(`SELECT j.status,p.state FROM jobs j
        LEFT JOIN job_payment_states p ON p.job_id=j.id WHERE j.id=$1`,
      [proposed.plan.steps[0].jobId]);
      assert.ok(!unfundedJob.rows.length||unfundedJob.rows[0]?.status==='CREATED');
      assert.equal(unfundedJob.rows[0]?.state??null,null);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,100);
      await finance.recordTestCreditPurchase(buyer,4900,`test-only:${randomUUID()}`);
      await authorizer.revisePaused(buyer,proposed.plan.id,[{
        stepId:proposed.plan.steps[0].id,capabilityId:capability}]);
      await repo.approvePlan(buyer,proposed.plan.id,randomUUID());
      const races=await Promise.all([authorizer.advanceOne(buyer,proposed.plan.id),
        authorizer.advanceOne(buyer,proposed.plan.id)]);
      assert.ok(races.includes('PURCHASED'));
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM jobs WHERE id=$1',
        [proposed.plan.steps[0].jobId])).rows[0].n,1);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      assert.equal((await repo.planView(buyer,proposed.plan.id)).reservedMinor,999);
      await assert.rejects(repo.planView(other,proposed.plan.id),{code:'NOT_FOUND'});
      // A new process has only persisted plans and authoritative job/payment state.
      const restarted=new AgentPurchaseAuthorizationService(pool,new MarketplaceAgentRepository(pool),
        catalog,availability,buyerRepo);
      assert.equal(await restarted.advanceOne(buyer,proposed.plan.id),'WAITING');
      await restarted.cancel(buyer,proposed.plan.id);
      await restarted.cancel(buyer,proposed.plan.id);
      assert.equal((await repo.plan(buyer,proposed.plan.id)).status,'CANCELLED');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      const settled=await pool.query('SELECT state FROM job_payment_states WHERE job_id=$1',
        [proposed.plan.steps[0].jobId]);
      assert.equal(settled.rows[0].state,'RELEASED');
      const completedPlan=(await planner.propose({buyerId:buyer,conversationId:conversation,
        goal:'Research Acme',constraints,candidateIds:[capability],ownedAssetIds:[]})).plan;
      await repo.approvePlan(buyer,completedPlan.id,randomUUID());
      assert.equal(await restarted.advanceOne(buyer,completedPlan.id),'PURCHASED');
      const finalJobId=completedPlan.steps[0].jobId;
      const offer=await execution.offer(finalJobId,worker,plane,120);
      await execution.accept(offer.executionId,worker,plane,offer.leaseToken,randomUUID());
      const transition=async(from,to)=>execution.workerTransition({id:randomUUID(),
        jobId:finalJobId,from,to,actor:'WORKER',reason:`M11_${to}`,
        attemptId:offer.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null},offer.executionId,worker,plane,
      offer.leaseToken);
      await transition('ACCEPTED','STARTING');
      await transition('STARTING','RUNNING');
      await transition('RUNNING','UPLOADING_RESULT');
      await execution.finalizeResult({resultManifestId:randomUUID(),jobId:finalJobId,
        executionId:offer.executionId,attemptId:offer.attemptId,workerDeviceId:worker,
        controlPlaneId:plane,leaseToken:offer.leaseToken,
        payload:{values:{answer:'Validated marketplace result'},assets:{}},assets:[]},
      {async headPrivateObject(){throw new Error('No files');},
        async readPrivateObject(){throw new Error('No files');}},
      new Date(Date.now()+86_400_000).toISOString());
      await finance.settleDeliveredJob(finalJobId);
      assert.equal(await restarted.advance(buyer,completedPlan.id),'COMPLETED');
      assert.equal(await restarted.advance(buyer,completedPlan.id),'COMPLETED');
      const finalView=await repo.planView(buyer,completedPlan.id);
      assert.equal(finalView.finalResult.kind,'PROVENANCE_SUMMARY');
      assert.deepEqual(finalView.finalResult.finalJobIds,[finalJobId]);
      assert.equal(finalView.finalResult.spentMinor,999);
      assert.equal(finalView.spentMinor,999);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,4001);

      // Two paid jobs must advance from a persisted DAG, with the second
      // purchase receiving only the first job's validated and settled output.
      const chainInference={generate:async()=>({structuredOutput:{steps:[
        {key:'first',capabilityId:capability,dependsOnKeys:[],
          inputValues:[{fieldKey:'question',value:'Research Acme'}],inputAssetIds:[],mappings:[]},
        {key:'second',capabilityId:capability,dependsOnKeys:['first'],inputValues:[],
          inputAssetIds:[],mappings:[{sourceKey:'first',sourceOutputKey:'answer',
            targetInputKey:'question'},{sourceKey:'first',sourceOutputKey:'report',
            targetInputKey:'supportingFile'}]}
      ]}})};
      const chainPlanner=new MarketplaceAgentPlanner(catalog,availability,()=>buyerRepo,repo,
        chainInference);
      const chained=(await chainPlanner.propose({buyerId:buyer,conversationId:conversation,
        goal:'Research Acme',constraints,candidateIds:[capability],ownedAssetIds:[]})).plan;
      assert.equal(chained.quotedTotalMinor,1998);
      await repo.approvePlan(buyer,chained.id,randomUUID());
      assert.equal(await restarted.advanceOne(buyer,chained.id),'PURCHASED');
      assert.equal(await restarted.advanceOne(buyer,chained.id),'WAITING');
      const first=chained.steps.find((step)=>step.dependsOn.length===0);
      const second=chained.steps.find((step)=>step.dependsOn.length===1);
      assert.ok(first&&second);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM jobs WHERE id=$1',
        [second.jobId])).rows[0].n,0);
      const fileId=randomUUID();const fileBytes=Buffer.from('Validated private research file\n');
      const fileHash=`sha256:${createHash('sha256').update(fileBytes).digest('hex')}`;
      const fileObjects=new Map();
      let fileKey;
      const resultStorage={
        async presignPrivateUpload(){return {url:'https://storage.example.test/put',headers:{}};},
        async headPrivateObject(key){const bytes=fileObjects.get(key);
          return bytes?{sizeBytes:bytes.length,claimedSha256:fileHash}:null;},
        async readPrivateObject(key){const bytes=fileObjects.get(key);
          if(!bytes)throw new Error('missing');return (async function*(){yield bytes;})();},
        async copyPrivateObject(source,target){const bytes=fileObjects.get(source);
          if(!bytes)throw new Error('missing');fileObjects.set(target,Buffer.from(bytes));},
        async deletePrivateObject(key){fileObjects.delete(key)},
      };
      const deliver=async(step,answer,withFile=false)=>{
        const offered=await execution.offer(step.jobId,worker,plane,120);
        await execution.accept(offered.executionId,worker,plane,offered.leaseToken,randomUUID());
        for(const [from,to] of [['ACCEPTED','STARTING'],['STARTING','RUNNING'],
          ['RUNNING','UPLOADING_RESULT']]){
          await execution.workerTransition({id:randomUUID(),jobId:step.jobId,from,to,
            actor:'WORKER',reason:`M11_${to}`,attemptId:offered.attemptId,
            correlationId:randomUUID(),paymentReservationId:null,resultManifestId:null},
          offered.executionId,worker,plane,offered.leaseToken);
        }
        if(withFile){
          const prepared=await execution.prepareResultAsset({assetId:fileId,jobId:step.jobId,
            executionId:offered.executionId,attemptId:offered.attemptId,
            workerDeviceId:worker,controlPlaneId:plane,leaseToken:offered.leaseToken,
            fieldKey:'report',extension:'.txt',sizeBytes:fileBytes.length,sha256:fileHash,
            detectedMimeType:'text/plain'},resultStorage);
          fileKey=prepared.objectKey;fileObjects.set(fileKey,fileBytes);
        }
        await execution.finalizeResult({resultManifestId:randomUUID(),jobId:step.jobId,
          executionId:offered.executionId,attemptId:offered.attemptId,workerDeviceId:worker,
          controlPlaneId:plane,leaseToken:offered.leaseToken,
          payload:{values:{answer},assets:withFile?{report:[fileId]}:{}},
          assets:withFile?[{id:fileId,fieldKey:'report',objectKey:fileKey,
            sizeBytes:fileBytes.length,sha256:fileHash,detectedMimeType:'text/plain'}]:[]},
        resultStorage,
        new Date(Date.now()+86_400_000).toISOString());
        await finance.settleDeliveredJob(step.jobId);
      };
      await deliver(first,'Validated result for downstream question',true);
      const policy={schedule:null,concurrencyLimit:1,queueLimit:2,futureReservationLimit:2,
        estimatedRuntimeSeconds:60,maxWaitSeconds:604800};
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:true,source:'WEB',expectedRevision:1});
      assert.equal(await restarted.advanceOne(buyer,chained.id),'PAUSED');
      assert.equal((await repo.planView(buyer,chained.id)).spentMinor,999);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:false,source:'WEB',expectedRevision:2});
      const revision=await pool.query(`SELECT revision FROM worker_cloud_control_revisions
        WHERE worker_device_id=$1`,[worker]);
      const lastBeat=await pool.query(`SELECT latest_heartbeat_reported_at AS at
        FROM worker_devices WHERE id=$1`,[worker]);
      await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',
        sentAt:new Date(Math.max(Date.now(),lastBeat.rows[0].at.getTime()+1)).toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,acknowledgedCloudRevision:Number(revision.rows[0].revision),
        capabilityReadiness:[{capabilityVersionId:versionId,policyValidationHash:hash,
          state:'READY',checks:{sandboxVerified:true,requiredSecretsReady:true,
            runtimeHealthy:true}}]},worker,plane);
      await restarted.revisePaused(buyer,chained.id,[{
        stepId:second.id,capabilityId:capability}]);
      await repo.approvePlan(buyer,chained.id,randomUUID());
      assert.equal(await restarted.advanceOne(buyer,chained.id),'PURCHASED');
      const downstream=await pool.query('SELECT payload FROM job_input_manifests WHERE job_id=$1',
        [second.jobId]);
      assert.equal(downstream.rows[0].payload.values.question,
        'Validated result for downstream question');
      assert.deepEqual(downstream.rows[0].payload.assets.supportingFile,[fileId]);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM orchestration_asset_links
        WHERE plan_id=$1 AND source_job_id=$2 AND target_job_id=$3 AND asset_id=$4`,
      [chained.id,first.jobId,second.jobId,fileId])).rows[0].n,1);
      await deliver(second,'Validated final chained result');
      assert.equal(await restarted.advance(buyer,chained.id),'COMPLETED');
      const chainView=await repo.planView(buyer,chained.id);
      assert.deepEqual(chainView.finalResult.finalJobIds,[second.jobId]);
      assert.equal(chainView.finalResult.spentMinor,1998);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,2003);

      const paused=(await planner.propose({buyerId:buyer,conversationId:conversation,
        goal:'Research Acme',constraints,candidateIds:[capability],ownedAssetIds:[]})).plan;
      await repo.approvePlan(buyer,paused.id,randomUUID());
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:true,source:'WEB',expectedRevision:3});
      assert.equal(await restarted.advanceOne(buyer,paused.id),'PAUSED');
      assert.equal((await repo.plan(buyer,paused.id)).status,'AWAITING_REAPPROVAL');
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM jobs WHERE id=$1',
        [paused.steps[0].jobId])).rows[0].n,0);
      await availability.setCapabilityPolicy({capabilityId:capability,
        sellerAccountId:sellerAccount,policy,paused:false,source:'WEB',expectedRevision:4});
      const revisionAgain=await pool.query(`SELECT revision FROM worker_cloud_control_revisions
        WHERE worker_device_id=$1`,[worker]);
      const lastBeatAgain=await pool.query(`SELECT latest_heartbeat_reported_at AS at
        FROM worker_devices WHERE id=$1`,[worker]);
      await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',
        sentAt:new Date(Math.max(Date.now(),lastBeatAgain.rows[0].at.getTime()+1)).toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,acknowledgedCloudRevision:Number(revisionAgain.rows[0].revision),
        capabilityReadiness:[{capabilityVersionId:versionId,policyValidationHash:hash,
          state:'READY',checks:{sandboxVerified:true,requiredSecretsReady:true,
            runtimeHealthy:true}}]},worker,plane);
      const options=await restarted.pausedAlternatives(buyer,paused.id);
      assert.equal(options[0].options[0].capabilityId,capability);
      const revised=await restarted.revisePaused(buyer,paused.id,[{
        stepId:paused.steps[0].id,capabilityId:capability}]);
      assert.equal(revised.status,'AWAITING_APPROVAL');
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM orchestration_revision_snapshots WHERE plan_id=$1',
        [paused.id])).rows[0].n,1);
      await assert.rejects(pool.query('DELETE FROM orchestration_revision_snapshots WHERE plan_id=$1',
        [paused.id]));
      await repo.approvePlan(buyer,paused.id,randomUUID());
      assert.equal(await restarted.advanceOne(buyer,paused.id),'PURCHASED');
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      await restarted.cancel(buyer,paused.id);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);

      // Independent DAG branches may reserve on separate ready Workers, but
      // never beyond the one buyer-approved ceiling or available credits.
      const worker2=randomUUID(),capability2=randomUUID(),version2=randomUUID();
      await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,
        platform,worker_version,status) VALUES($1,$2,'m11-second-key','Second Worker',
        'LINUX','test','ONLINE')`,[worker2,seller]);
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
        VALUES($1,$2,$3,'Research supplement','Research a second subject','PUBLISHED')`,
      [capability2,seller,`m11-${capability2}`]);
      const package2={...localPackage,capabilityId:capability2,
        capabilityVersionId:version2,workerDeviceId:worker2,priceTier:'USD_299',
        workerManifest:{...localPackage.workerManifest,workerId:randomUUID(),
          capabilityVersionId:version2}};
      const candidate2=buildVersionCandidate({id:version2,capabilityId:capability2,
        versionNumber:1,workerDeviceId:worker2,requestedAt:new Date().toISOString(),
        localPackage:package2,selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_299')});
      const fields2={...candidate2};delete fields2.requestedAt;
      const published2=PublishedCapabilityVersionSchema.parse({...fields2,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:hash});
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,
        published_at) VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [version2,capability2,published2,published2.workerManifestHash,hash]);
      await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC'
        WHERE id=$1`,[capability2,version2]);
      await availability.setWorkerDefault({workerDeviceId:worker2,sellerAccountId:sellerAccount,
        schedule:{mode:'ALWAYS_AVAILABLE',timezone:'UTC',weeklyWindows:[]},paused:false,
        source:'WEB',expectedRevision:null});
      await availability.setCapabilityPolicy({capabilityId:capability2,
        sellerAccountId:sellerAccount,policy,paused:false,source:'WEB',
        expectedRevision:null});
      await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker2,workerRelease:'test',sentAt:new Date().toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,capabilityReadiness:[{capabilityVersionId:version2,
          policyValidationHash:hash,state:'READY',checks:{sandboxVerified:true,
            requiredSecretsReady:true,runtimeHealthy:true}}]},worker2,plane);
      await social.setSellerMetadata(capability2,sellerAccount,{category:'RESEARCH',
        shortDescription:'Research a second subject',tags:['research'],strengths:['Focused'],
        limitations:['No private web access']});
      const parallelInference={generate:async()=>({structuredOutput:{steps:[
        {key:'primary',capabilityId:capability,dependsOnKeys:[],
          inputValues:[{fieldKey:'question',value:'Research Acme'}],inputAssetIds:[],mappings:[]},
        {key:'supplement',capabilityId:capability2,dependsOnKeys:[],
          inputValues:[{fieldKey:'question',value:'Research Acme'}],inputAssetIds:[],mappings:[]}
      ]}})};
      const parallelPlanner=new MarketplaceAgentPlanner(catalog,availability,()=>buyerRepo,
        repo,parallelInference);
      const parallel=(await parallelPlanner.propose({buyerId:buyer,conversationId:conversation,
        goal:'Research Acme',constraints,candidateIds:[capability,capability2],
        ownedAssetIds:[]})).plan;
      assert.equal(parallel.quotedTotalMinor,1298);
      await repo.approvePlan(buyer,parallel.id,randomUUID());
      assert.equal(await restarted.advance(buyer,parallel.id),'WAITING');
      const parallelView=await repo.planView(buyer,parallel.id);
      assert.equal(parallelView.jobs.length,2);
      assert.equal(parallelView.reservedMinor,1298);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,705);
      await restarted.cancel(buyer,parallel.id);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
    }finally{await pool.end();}
  });
}
