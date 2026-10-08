/* global AbortController */
import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import pg from 'pg';
import process from 'node:process';
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import { PostgresResearchUsage } from '../dist/packages/persistence/src/research-usage.js';
import {PostgresJobExecutionRepository} from
  '../dist/packages/persistence/src/job-execution.js';
import {buildVersionCandidate} from
  '../dist/packages/domain/src/capability-version.js';
import {PublishedCapabilityVersionSchema} from
  '../dist/packages/contracts/src/capability-version.js';
import { PostgresLocalResourceAudit } from '../dist/packages/persistence/src/local-resource-audit.js';
import { LocalResourceBroker } from '../dist/packages/application/src/local-resource-broker.js';
import { PostgresReadOnlyResourceAdapter } from '../dist/packages/persistence/src/postgres-readonly-resource.js';
import { PostgresDeclaredApiUsage } from '../dist/packages/persistence/src/declared-api-usage.js';
import { PostgresProviderUsage } from '../dist/packages/persistence/src/provider-usage.js';
import {WorkerResourceUsage,createWorkerResourcePorts,
  checkWorkerResourceReadiness} from '../dist/apps/worker/src/resource-ports.js';
import {captureSelectedLocalBinding} from
  '../dist/apps/worker/src/selected-local-file.js';
import {WorkerReviewResearchUsage} from
  '../dist/apps/worker/src/review-research-usage.js';
import {ResearchBroker} from
  '../dist/packages/application/src/research-broker.js';
import {WorkerBrokerRouter} from '../dist/apps/worker/src/broker-router.js';
import {pkg as packageFixture} from './fixtures/worker-package.mjs';
import {runRepresentativePackageTest} from
  '../dist/apps/worker/src/import-review-runner.js';
import {SellerCompletionBroker} from
  '../dist/packages/application/src/completion-broker.js';
import {DockerJobControlAdapter,DockerSandboxAdapter} from
  '../dist/packages/sandbox-adapter/src/docker.js';
import {OpenClawImageApproval,hashOpenClawRuntimeSource} from
  '../dist/packages/openclaw-adapter/src/image-approval.js';
import {WorkerLocalState} from '../dist/apps/worker/src/local-state.js';
import {WorkerJobControl} from '../dist/apps/worker/src/job-control.js';
import {buildWorkerCapabilityReview} from '../dist/apps/worker/src/import-review.js';
import {PostgresSellerPublicationRepository} from
  '../dist/packages/persistence/src/seller-publication.js';
import {PostgresPriceTierCatalog} from
  '../dist/packages/persistence/src/price-tiers.js';
import {publishInAuthenticatedSellerBrowser,inspectPublicProcessorDisclosure} from
  './m16-installed-worker-e2e.mjs';

if (!process.env.M06_DATABASE_URL) {
  test('M06 PostgreSQL integration requires the Docker test script', { skip: true }, () => {});
} else {
  const admin = new pg.Pool({ connectionString: process.env.M06_DATABASE_URL });
  after(async()=>admin.end());
  const buyer = randomUUID(), sellerAccount = randomUUID(), seller = randomUUID(), worker = randomUUID();
  const capability = randomUUID(), version = randomUUID(), job = randomUUID();

  test('seed dedicated seller DB user and job fixture', async () => {
    await admin.query(`INSERT INTO accounts(id,primary_email,status) VALUES($1,'buyer-m06@example.com','ACTIVE'),($2,'seller-m06@example.com','ACTIVE')`, [buyer, sellerAccount]);
    await admin.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
      VALUES($1,$2,'Seller','ACTIVE','NOT_STARTED')`, [seller, sellerAccount]);
    await admin.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,worker_version,status)
      VALUES($1,$2,'test-key','Worker','LINUX','test','ONLINE')`, [worker, seller]);
    await admin.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
      VALUES($1,$2,'m06-test','Test','DRAFT')`, [capability, seller]);
    await admin.query(`INSERT INTO capability_versions(id,capability_id,version_number,publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
      VALUES($1,$2,1,'PUBLISHED','{}',$3,$4,now())`, [version, capability, `sha256:${'a'.repeat(64)}`, `sha256:${'b'.repeat(64)}`]);
    await admin.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,status,contract_snapshot,payment_reservation_id)
      VALUES($1,$2,$3,$4,'RUNNING','{}',$5)`, [job, buyer, version, worker, randomUUID()]);
    await admin.query(`CREATE ROLE seller_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 2`);
    await admin.query('CREATE SCHEMA seller_public');
    await admin.query('CREATE SCHEMA seller_private');
    await admin.query('CREATE TABLE seller_public.company(id text primary key, company_name text, funding text, tenant text)');
    await admin.query("INSERT INTO seller_public.company VALUES ('acme','Acme','$1M','approved'),('other','Other','$2M','hidden')");
    await admin.query('CREATE TABLE seller_private.secrets(secret text)');
    await admin.query("INSERT INTO seller_private.secrets VALUES ('do-not-expose')");
    await admin.query('GRANT USAGE ON SCHEMA seller_public TO seller_readonly');
    await admin.query('GRANT SELECT ON seller_public.company TO seller_readonly');
  });

  test('atomic per-job budgets, duplicate request IDs and sanitized audit', async () => {
    const usage = new PostgresResearchUsage(admin);
    const base = { jobId: job, capabilityVersionId: version, operation: 'SEARCH', host: null,
      queryHash: `sha256:${'b'.repeat(64)}`, byteReservation: 100, maxTotalBytes: 500,
      maxQueries: 2, maxPages: 2, maxDownloads: 1, maxDownloadsBytes: 200,
      maxConcurrent: 2, maxPerHost: 2, maxDurationMs: 10000 };
    const requestIds = [randomUUID(), randomUUID(), randomUUID()];
    const outcomes = await Promise.allSettled(requestIds.map((requestId) => usage.begin({ ...base, requestId })));
    assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 2);
    const [first, second] = requestIds.filter((_, index) => outcomes[index].status === 'fulfilled');
    await usage.finish({ requestId: first, bytes: 25, contentType: 'application/json', status: 200, blockedReason: null });
    await usage.finish({ requestId: second, bytes: 20, contentType: null, status: 429, blockedReason: 'NETWORK_POLICY_DENIED' });
    await assert.rejects(usage.begin({ ...base, requestId: first }));
    await usage.deny({ jobId: job, capabilityVersionId: version, operation: 'FETCH', host: null, queryHash: null,
      reason: 'PRIVATE_DESTINATION_DENIED' });
    const audit = await admin.query('SELECT operation,query_hash,actual_bytes,blocked_reason FROM research_requests WHERE job_id=$1', [job]);
    assert.equal(audit.rowCount, 2);
    assert.deepEqual(audit.rows.map((row) => row.actual_bytes).sort((a, b) => a - b), ['20', '25']);
    const denials = await admin.query('SELECT reason FROM research_denials WHERE job_id=$1', [job]);
    assert.equal(denials.rows[0].reason, 'PRIVATE_DESTINATION_DENIED');
    assert.doesNotMatch(JSON.stringify(audit.rows), /Acme|do-not-expose/);
  });

  test('cloud private-read barrier waits for in-flight research and permanently denies later egress', async()=>{
    const protectedJob=randomUUID();
    await admin.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,
      worker_device_id,status,contract_snapshot,payment_reservation_id)
      VALUES($1,$2,$3,$4,'RUNNING','{}',$5)`,
    [protectedJob,buyer,version,worker,randomUUID()]);
    const usage=new PostgresResearchUsage(admin);
    const requestId=randomUUID();
    const budget={requestId,jobId:protectedJob,capabilityVersionId:version,
      operation:'FETCH',host:'example.com',queryHash:null,byteReservation:100,
      maxTotalBytes:1000,maxQueries:1,maxPages:2,maxDownloads:1,
      maxDownloadsBytes:500,maxConcurrent:1,maxPerHost:2,maxDurationMs:60_000};
    await usage.begin(budget);
    await assert.rejects(usage.markPrivateResourceRead(protectedJob,version),
      /NETWORK_POLICY_DENIED/);
    await usage.finish({requestId,bytes:10,contentType:'text/plain',
      status:200,blockedReason:null});
    await usage.markPrivateResourceRead(protectedJob,version);
    await usage.markPrivateResourceRead(protectedJob,version);
    await assert.rejects(usage.begin({...budget,requestId:randomUUID()}),
      /NETWORK_POLICY_DENIED/);
    await assert.rejects(usage.markPrivateResourceRead(protectedJob,randomUUID()),
      /NETWORK_POLICY_DENIED/);
  });

  test('cloud research authorization is tied to accepted lease, payment and immutable published policy',async()=>{
    const researchVersion=randomUUID(),researchJob=randomUUID(),executionId=randomUUID(),
      attemptId=randomUUID(),reservationId=randomUUID(),leaseToken='lease-token-'.repeat(4);
    const packageData=packageFixture(['kivro_research_search']);
    packageData.capabilityId=capability;
    packageData.capabilityVersionId=researchVersion;
    packageData.workerDeviceId=worker;
    packageData.workerManifest.workerId=worker;
    packageData.workerManifest.capabilityVersionId=researchVersion;
    const candidate=buildVersionCandidate({id:researchVersion,capabilityId:capability,
      versionNumber:2,workerDeviceId:worker,requestedAt:new Date().toISOString(),
      localPackage:packageData,selectedPrice:{tier:'USD_999',currency:'USD',
        buyerAmountMinor:999,platformFeeMinor:199,sellerEarningMinor:800},
      externalProcessors:['synthetic']});
    const {requestedAt:_,...fields}=candidate;void _;
    const published=PublishedCapabilityVersionSchema.parse({...fields,
      publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
      policyValidationHash:`sha256:${'c'.repeat(64)}`});
    await admin.query(`INSERT INTO capability_versions(id,capability_id,version_number,
      publication_state,version_snapshot,worker_manifest_hash,
      policy_validation_hash,published_at) VALUES($1,$2,2,'PUBLISHED',$3,$4,$5,now())`,
    [researchVersion,capability,published,published.workerManifestHash,
      published.policyValidationHash]);
    await admin.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,
      worker_device_id,status,contract_snapshot,payment_reservation_id)
      VALUES($1,$2,$3,$4,'RUNNING','{}',$5)`,
    [researchJob,buyer,researchVersion,worker,reservationId]);
    await admin.query(`INSERT INTO job_executions(id,job_id,attempt_id,
      worker_device_id,control_plane_id,lease_key_version,lease_token_hash,
      lease_expires_at,offer_expires_at,accepted_at)
      VALUES($1,$2,$3,$4,'test-plane','v1',$5,now()+interval '1 hour',
        now()+interval '1 hour',now())`,[executionId,researchJob,attemptId,worker,
      `sha256:${createHash('sha256').update(leaseToken).digest('hex')}`]);
    let paymentSecured=false;
    const repo=new PostgresJobExecutionRepository(admin,{
      async isSecured(_client,jobId,paymentId){
        return paymentSecured&&jobId===researchJob&&paymentId===reservationId;},
      async releaseFailedJobInTransaction(){}},{});
    const binding={jobId:researchJob,executionId,attemptId,workerDeviceId:worker,
      controlPlaneId:'test-plane',leaseToken};
    await assert.rejects(repo.authorizeResearchOperation(binding),
      {code:'PAYMENT_NOT_SECURED'});
    paymentSecured=true;
    for(const changed of [{...binding,workerDeviceId:randomUUID()},
      {...binding,controlPlaneId:'other-plane'},
      {...binding,leaseToken:'x'.repeat(32)},
      {...binding,attemptId:randomUUID()}])
      await assert.rejects(repo.authorizeResearchOperation(changed),
        {code:'NOT_ELIGIBLE'});
    const authorized=await repo.authorizeResearchOperation(binding);
    assert.equal(authorized.capabilityVersionId,researchVersion);
    assert.equal(authorized.policy?.mode,'PUBLIC_WEB_RESEARCH');
    assert.deepEqual(authorized.policy,published.publicResearchPolicy);
    await admin.query("UPDATE jobs SET status='PAUSE_REQUESTED' WHERE id=$1",[researchJob]);
    await assert.rejects(repo.authorizeResearchOperation(binding),
      {code:'PAUSE_PENDING'},'a paused paid job cannot start a new cloud research call');
    paymentSecured=false;
    await assert.rejects(repo.authorizeResearchOperation(binding),
      {code:'PAYMENT_NOT_SECURED'},'pause must never hide loss of financial authorization');
    paymentSecured=true;
    await admin.query("UPDATE jobs SET status='RUNNING' WHERE id=$1",[researchJob]);
    assert.equal((await repo.authorizeResearchOperation(binding)).capabilityVersionId,
      researchVersion);
    await admin.query(`UPDATE job_executions SET completed_at=now()
      WHERE id=$1`,[executionId]);
    await assert.rejects(repo.authorizeResearchOperation(binding),
      {code:'NOT_ELIGIBLE'});
  });

  test('declared API and seller provider budgets are atomic and tied to job/version', async () => {
    const api = new PostgresDeclaredApiUsage(admin);
    const provider = new PostgresProviderUsage(admin);
    const apiIds = [randomUUID(), randomUUID(), randomUUID()];
    const apiOutcomes = await Promise.allSettled(apiIds.map((requestId) => api.begin({ requestId, jobId: job,
      capabilityVersionId: version, connectorId: 'ads.search', host: 'api.example.com', method: 'POST',
      maxRequestsPerJob: 2 })));
    assert.equal(apiOutcomes.filter((item) => item.status === 'fulfilled').length, 2);
    for (const [index, outcome] of apiOutcomes.entries()) if (outcome.status === 'fulfilled') {
      await api.finish({ requestId: apiIds[index], responseBytes: 25, status: 'ALLOWED', reason: null });
    }
    const providerIds = [randomUUID(), randomUUID(), randomUUID()];
    const providerOutcomes = await Promise.allSettled(providerIds.map((requestId) => provider.reserve({
      requestId, jobId: job, capabilityVersionId: version, providerId: 'example', modelId: 'small',
      reserveMicroUsd: 60, maxRequestsPerJob: 3, maxSpendMicroUsdPerJob: 120,
      reservedInputTokens: 20, reservedOutputTokens: 10, maxTokensPerJob: 90,
      maxDailyJobs: 1, maxDailySpendMicroUsd: 120,
    })));
    assert.equal(providerOutcomes.filter((item) => item.status === 'fulfilled').length, 2);
    for (const [index, outcome] of providerOutcomes.entries()) if (outcome.status === 'fulfilled') {
      await provider.settle({ requestId: providerIds[index], accountedMicroUsd: 50, inputTokens: 10,
        outputTokens: 5, status: 'SUCCEEDED' });
    }
    await assert.rejects(provider.reserve({ requestId: randomUUID(), jobId: job, capabilityVersionId: randomUUID(),
      providerId: 'example', modelId: 'small', reserveMicroUsd: 1, maxRequestsPerJob: 3,
      maxSpendMicroUsdPerJob: 120, reservedInputTokens: 20, reservedOutputTokens: 10,
      maxTokensPerJob: 90, maxDailyJobs: 1, maxDailySpendMicroUsd: 120 }), /NETWORK_POLICY_DENIED/);
    const rows = await admin.query('SELECT provider_id,model_id,accounted_micro_usd FROM seller_provider_calls WHERE job_id=$1', [job]);
    assert.equal(rows.rowCount, 2);
    assert.doesNotMatch(JSON.stringify(rows.rows), /provider-secret|prompt|Acme/);
  });

  test('M08 daily seller cost, job and token ceilings serialize across jobs', async () => {
    const secondJob=randomUUID();
    await admin.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,
      status,contract_snapshot,payment_reservation_id)
      VALUES($1,$2,$3,$4,'RUNNING','{}',$5)`,
    [secondJob,buyer,version,worker,randomUUID()]);
    const usage=new PostgresProviderUsage(admin);
    const base={requestId:randomUUID(),jobId:secondJob,capabilityVersionId:version,
      providerId:'example',modelId:'small',reserveMicroUsd:1,maxRequestsPerJob:3,
      maxSpendMicroUsdPerJob:120,reservedInputTokens:20,reservedOutputTokens:10,
      maxTokensPerJob:29,maxDailyJobs:1,maxDailySpendMicroUsd:1000};
    await assert.rejects(usage.reserve(base),/NETWORK_BUDGET_EXCEEDED/);
    await assert.rejects(usage.reserve({...base,maxDailyJobs:2,maxDailySpendMicroUsd:100}),
      /NETWORK_BUDGET_EXCEEDED/);
    await assert.rejects(usage.reserve({...base,maxDailyJobs:2,maxDailySpendMicroUsd:1000}),
      /NETWORK_BUDGET_EXCEEDED/); // maxTokensPerJob 29 < 20+10.
    await usage.reserve({...base,maxTokensPerJob:30,maxDailyJobs:2,
      maxDailySpendMicroUsd:1000});
    await usage.settle({requestId:base.requestId,accountedMicroUsd:1,
      inputTokens:10,outputTokens:5,status:'SUCCEEDED'});
    await usage.settle({requestId:base.requestId,accountedMicroUsd:1,
      inputTokens:10,outputTokens:5,status:'SUCCEEDED'});
    await assert.rejects(usage.settle({requestId:base.requestId,accountedMicroUsd:2,
      inputTokens:10,outputTokens:5,status:'SUCCEEDED'}),/NETWORK_POLICY_DENIED/);
  });

  test('global destination rate ceiling rejects a new call despite a permissive per-job limit', async () => {
    await admin.query(`INSERT INTO research_requests
      (request_id,job_id,capability_version_id,operation,host,reserved_bytes,actual_bytes,completed_at)
      SELECT gen_random_uuid(),$1,$2,'FETCH','rate.example.com',0,0,now()
      FROM generate_series(1,60)`, [job, version]);
    const usage = new PostgresResearchUsage(admin);
    await assert.rejects(usage.begin({ requestId: randomUUID(), jobId: job, capabilityVersionId: version,
      operation: 'FETCH', host: 'rate.example.com', queryHash: null, byteReservation: 100,
      maxTotalBytes: 100000, maxQueries: 100, maxPages: 100, maxDownloads: 1,
      maxDownloadsBytes: 1000, maxConcurrent: 4, maxPerHost: 100, maxDurationMs: 10000 }),
    /NETWORK_BUDGET_EXCEEDED/);
  });

  test('resource broker allows only named SELECT with a dedicated role, row limit and private-read barrier', async () => {
    const usage = new PostgresResearchUsage(admin);
    const audit = new PostgresLocalResourceAudit(admin);
    await assert.rejects(usage.markPrivateResourceRead(job, randomUUID()), /NETWORK_POLICY_DENIED/);
    const readonly = new pg.Pool({ connectionString: process.env.M06_READONLY_URL, max: 1 });
    try {
      const broker = new LocalResourceBroker(new PostgresReadOnlyResourceAdapter(readonly), { resourceId: 'company_db', statementTimeoutMs: 1000,
        operations: [{ id: 'company_get', schema: 'seller_public', table: 'company',
          columns: ['id', 'company_name'], lookupColumn: 'id', maxRows: 1,
          scope: { column: 'tenant', value: 'approved' } }] }, audit, usage);
      const rows = await broker.invoke({ jobId: job, capabilityVersionId: version }, { operationId: 'company_get', lookup: 'acme' });
      assert.deepEqual(rows, [{ id: 'acme', company_name: 'Acme' }]);
      assert.deepEqual(await broker.invoke({ jobId: job, capabilityVersionId: version },
        { operationId: 'company_get', lookup: 'other' }), []);
      await assert.rejects(broker.invoke({ jobId: job, capabilityVersionId: version },
        { operationId: 'postgres.execute', lookup: 'DELETE FROM seller_public.company' }), /RESOURCE_POLICY_DENIED/);
      assert.deepEqual(await broker.invoke({ jobId: job, capabilityVersionId: version },
        { operationId: 'company_get', lookup: "acme' OR 1=1--" }), []);
      const privileges = await readonly.query("SELECT has_table_privilege(current_user,'seller_public.company','SELECT') AS public_read");
      assert.equal(privileges.rows[0].public_read, true);
      await assert.rejects(readonly.query('SELECT * FROM seller_private.secrets'), /permission denied/);
      await assert.rejects(readonly.query("DELETE FROM seller_public.company WHERE id='other'"), /permission denied/);
      const unsafe = new LocalResourceBroker(new PostgresReadOnlyResourceAdapter(admin), {
        resourceId: 'company_db', statementTimeoutMs: 1000,
        operations: [{ id: 'company_get', schema: 'seller_public', table: 'company',
          columns: ['id'], lookupColumn: 'id', maxRows: 1 }],
      }, audit, usage);
      await assert.rejects(unsafe.invoke({ jobId: job, capabilityVersionId: version },
        { operationId: 'company_get', lookup: 'acme' }), /RESOURCE_CREDENTIAL_UNSAFE/);
      const events = await admin.query('SELECT operation_id,status,row_count FROM local_resource_audit WHERE job_id=$1 ORDER BY id', [job]);
      assert.deepEqual(events.rows.map((item) => item.status), ['ALLOWED', 'ALLOWED', 'DENIED', 'ALLOWED', 'DENIED']);
      assert.doesNotMatch(JSON.stringify(events.rows), /do-not-expose|DELETE FROM/);
      await assert.rejects(usage.begin({ requestId: randomUUID(), jobId: job, capabilityVersionId: version,
        operation: 'FETCH', host: 'example.com', queryHash: null, byteReservation: 10,
        maxTotalBytes: 1000, maxQueries: 2, maxPages: 2, maxDownloads: 1, maxDownloadsBytes: 100,
        maxConcurrent: 2, maxPerHost: 2, maxDurationMs: 10000 }), /NETWORK_POLICY_DENIED/);
      const root=mkdtempSync(join(tmpdir(),'kivro-m16-seller-resource-'));
      const localUsage=new WorkerResourceUsage(root);
      try{
        const localPackage=packageFixture(['kivro_resource_read']);
        const researchPolicy=localPackage.permissionPolicy.internet;
        localPackage.permissionPolicy.publicInternet='DENY';
        delete localPackage.permissionPolicy.internet;
        localPackage.capabilityVersionId=version;
        localPackage.workerManifest.capabilityVersionId=version;
        localPackage.permissionPolicy.proprietaryDatabase='READ_ONLY';
        localPackage.permissionPolicy.localResources=[{resourceId:'company_db',
          statementTimeoutMs:1000,operations:[{id:'company_get',schema:'seller_public',
            table:'company',columns:['id','company_name'],lookupColumn:'id',
            maxRows:1,scope:{column:'tenant',value:'approved'}}]}];
        localPackage.permissionPolicy.sellerCredentialRefs.push('seller:company-readonly');
        localPackage.workerManifest.resources.push({id:'company_db',
          type:'local-resource-broker',permissions:['company_get'],
          credentialRef:'seller:company-readonly'});
        localPackage.dependencyGraph.nodes.push({...localPackage.dependencyGraph.nodes[0],
          id:'company_db',name:'Company records',type:'DATABASE',selected:true});
        const vault={async exists(ref){return ref==='seller:company-readonly'||
          ref==='seller:provider';},
          async resolve(ref){if(ref!=='seller:company-readonly')throw new Error('MISSING');
            return process.env.M06_READONLY_URL;}};
        assert.equal(await checkWorkerResourceReadiness(localPackage,vault),true);
        const ports=createWorkerResourcePorts(localPackage,vault,localUsage);
        const router=new WorkerBrokerRouter(localPackage,job,{completion:{},...ports});
        const signal=new AbortController().signal;
        const invoke=(operationId,lookup)=>router.dispatch({type:'REQUEST',
          id:randomUUID(),kind:'RESOURCE_READ',payload:{resourceId:'company_db',
            operationId,lookup}},signal);
        assert.deepEqual(await invoke('company_get','acme'),
          [{id:'acme',company_name:'Acme'}]);
        assert.deepEqual(await invoke('company_get','other'),[]);
        await assert.rejects(invoke('seller_private.secrets','acme'),
          {code:'UNDECLARED_TOOL'});
        assert.deepEqual(await invoke('company_get',"acme' OR 1=1--"),[]);
        const researchedPackage={...localPackage,permissionPolicy:{
          ...localPackage.permissionPolicy,publicInternet:'PUBLIC_RESEARCH_BROKER',
          internet:researchPolicy}};
        const guarded=createWorkerResourcePorts(researchedPackage,vault,localUsage);
        await assert.rejects(guarded.localResources.get('company_db').invoke(
          {jobId:job,capabilityVersionId:version},
          {operationId:'company_get',lookup:'acme'}),
        /RESEARCH_PRIVATE_READ_BARRIER_UNAVAILABLE/);
        const mediated=createWorkerResourcePorts(researchedPackage,vault,localUsage,
          (readJob,readVersion)=>usage.markPrivateResourceRead(readJob,readVersion));
        assert.deepEqual(await mediated.localResources.get('company_db').invoke(
          {jobId:job,capabilityVersionId:version},
          {operationId:'company_get',lookup:'acme'}),
        [{id:'acme',company_name:'Acme'}]);
        assert.equal(await checkWorkerResourceReadiness(localPackage,{...vault,
          async resolve(){return process.env.M06_DATABASE_URL;}}),false,
        'a privileged seller DB credential cannot make the capability ready');
      }finally{localUsage.close();rmSync(root,{recursive:true,force:true});}
    } finally { await readonly.end(); }
  });

  test('M16 synthetic private database runs through real Docker/OpenClaw and the reviewed Worker broker',
    {skip:process.env.M16_RESOURCE_DOCKER!=='1',timeout:120_000},async()=>{
      const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
      const image=JSON.parse(execFileSync(docker,['image','inspect',
        'kivro-openclaw-runtime:m07','--format','{{json .RepoDigests}}'],
      {encoding:'utf8'})).find((value)=>
        value.startsWith('kivro-openclaw-runtime@sha256:'));
      assert.ok(image);
      const root=mkdtempSync(join(realpathSync(tmpdir()),'kivro-m16-db-review-'));
      const stateDir=join(root,'state'),attemptRoot=join(root,'attempts');
      mkdirSync(stateDir,{mode:0o700});mkdirSync(attemptRoot,{mode:0o700});
      const runtimeRoot=resolve('runtime/openclaw'),approval=join(root,'approval.json');
      writeFileSync(approval,JSON.stringify({schemaVersion:1,image,
        openClawVersion:'2026.8.2',
        runtimeSourceHash:await hashOpenClawRuntimeSource(runtimeRoot),
        conformanceSuite:'m07-openclaw-execution/1',
        conformancePassedAt:new Date().toISOString()}),{mode:0o600});
      const selectedPath=join(root,'company.txt');
      writeFileSync(selectedPath,'SELECTED_COMPANY_ONLY');
      writeFileSync(join(root,'unselected.txt'),'UNSELECTED_SELLER_SECRET');
      const selectedBinding=await captureSelectedLocalBinding({
        resourceId:'company_dataset',kind:'FILE',absolutePath:selectedPath});
      const pkg=packageFixture(['kivro_research_fetch','kivro_resource_read',
        'kivro_selected_file_read','kivro_declared_api']);
      const dbCapabilityId=randomUUID(),dbVersionId=randomUUID();
      pkg.capabilityId=dbCapabilityId;
      pkg.capabilityVersionId=dbVersionId;
      pkg.workerDeviceId=worker;
      pkg.workerManifest.workerId=worker;
      pkg.workerManifest.capabilityVersionId=dbVersionId;
      pkg.permissionPolicy.internet.search.enabled=false;
      pkg.permissionPolicy.internet.fetch.enabled=true;
      pkg.permissionPolicy.internet.fetch.allowedContentTypes=['text/html'];
      pkg.permissionPolicy.internet.domains={mode:'ONLY_DECLARED_DOMAINS',
        hosts:['example.com']};
      pkg.permissionPolicy.providerBudget.maxRequestsPerJob=6;
      pkg.permissionPolicy.privateApi='READ_ONLY';
      pkg.permissionPolicy.declaredApiPolicy={version:1,mode:'DECLARED_API_ACCESS',
        connectors:[{id:'company-api',host:'example.com',method:'HEAD',path:'/',
          maxRequestsPerJob:1,maxRequestBytes:1024,maxResponseBytes:4096}]};
      pkg.selectedLocalBindings=[selectedBinding];
      pkg.permissionPolicy.selectedFileResourceIds=['company_dataset'];
      pkg.permissionPolicy.proprietaryDatabase='READ_ONLY';
      pkg.permissionPolicy.localResources=[{resourceId:'company_db',
        statementTimeoutMs:1000,operations:[{id:'company_get',schema:'seller_public',
          table:'company',columns:['id','company_name'],lookupColumn:'id',
          maxRows:1,scope:{column:'tenant',value:'approved'}}]}];
      pkg.permissionPolicy.sellerCredentialRefs.push('seller:company-readonly');
      pkg.workerManifest.resources.push({id:'company_db',type:'local-resource-broker',
        permissions:['company_get'],credentialRef:'seller:company-readonly'});
      pkg.workerManifest.resources.push({id:'company_dataset',type:'selected-file',
        permissions:['READ']});
      pkg.workerManifest.resources.push({id:'company-api',type:'declared-api',
        permissions:['HEAD']});
      pkg.dependencyGraph.inference={mode:'REMOTE_PROVIDER',dependencyId:'model',
        provider:'synthetic',model:'broker',credentialRef:'credential',
        billingOwner:'SELLER'};
      const node=(id,type,dependsOn=[])=>({id,type,name:id,
        requirement:'REQUIRED',sensitivity:'LOW',discoveredFrom:['SELLER_DECLARATION'],
        dependsOn,marketplaceSupport:'UNDETERMINED',confidence:'CONFIRMED',
        selected:true,health:'UNKNOWN'});
      pkg.dependencyGraph.nodes=[node('skill','SKILL',['model','company_db',
        'company_dataset','company-api','kivro_research_fetch']),
        node('model','AI_MODEL',['provider','credential']),node('provider','AI_PROVIDER'),
        node('credential','CREDENTIAL'),node('company_db','DATABASE'),
        node('company_dataset','LOCAL_FILE'),node('company-api','PRIVATE_API'),
        node('kivro_research_fetch','TOOL')];
      const vault={async exists(ref){return ['seller:company-readonly',
        'seller:provider'].includes(ref);},async resolve(ref){
        if(ref==='seller:company-readonly')return process.env.M06_READONLY_URL;
        if(ref==='seller:provider')return 'fixture-provider-key';
        throw new Error('UNDECLARED_CREDENTIAL');}};
      const usage=new WorkerResourceUsage(stateDir);
      const researchUsage=new WorkerReviewResearchUsage(stateDir);
      let publicFetches=0;
      const research=new ResearchBroker({async search(){throw Error('SEARCH_DENIED');}},
        {async lookupAll(){return ['8.8.8.8'];}},
        {async request({url}){publicFetches++;if(url.pathname==='/robots.txt')
          return {status:200,headers:{'content-type':'text/plain'},
            body:Buffer.from('User-agent: *\nAllow: /\n')};
          return {status:200,
          headers:{'content-type':'text/html'},
          body:Buffer.from('<h1>Public company</h1><script>unsafe()</script>')};}},
        researchUsage);
      const local=new WorkerLocalState(stateDir,{async check(){return {
        ready:false,checkedAt:new Date().toISOString(),
        blockingReasons:['REVIEW_ONLY']};}});
      const control=new DockerJobControlAdapter(docker);
      const jobs=new WorkerJobControl(stateDir,control,{async check(){return {
        ready:false,checkedAt:new Date().toISOString(),
        blockingReasons:['REVIEW_ONLY']};}},{maxPauseDurationMs:60_000});
      let calls=0,sawDeclaredRow=false,sawSelectedBytes=false,sawDeclaredApi=false;
      const completion=new SellerCompletionBroker(vault,{providerId:'synthetic',
        async complete(request){calls++;
          const visible=JSON.stringify(request);
          assert.doesNotMatch(visible,/do-not-expose|seller_private|fixture-provider-key|UNSELECTED_SELLER_SECRET/);
          assert.equal(visible.includes(process.env.M06_READONLY_URL),false);
          if(calls>2){assert.match(visible,/Acme/);sawDeclaredRow=true;}
          if(calls>3)sawSelectedBytes ||= visible.includes(
            Buffer.from('SELECTED_COMPANY_ONLY').toString('base64'));
          if(calls>4)sawDeclaredApi ||= visible.includes('status');
          const invocation=calls===1?{name:'kivro_research_fetch',
            arguments:JSON.stringify({url:'https://example.com/'})}:
            calls===2?{name:'kivro_resource_read',
            arguments:JSON.stringify({resourceId:'company_db',operationId:'company_get',
              lookup:'acme'})}:calls===3?{name:'kivro_selected_file_read',
            arguments:JSON.stringify({resourceId:'company_dataset',
              fileId:selectedBinding.files[0].fileId,offset:0,length:64})}:
            calls===4?{name:'kivro_declared_api',arguments:JSON.stringify({
              connectorId:'company-api',input:{}})}:
            {name:'kivro_submit_result',arguments:JSON.stringify({
                fields:{answer:{type:'SHORT_TEXT',value:'Acme'}}})};
          return {id:randomUUID(),object:'chat.completion',
            created:Math.floor(Date.now()/1000),model:'broker',choices:[{index:0,
              finish_reason:calls<6?'tool_calls':'stop',message:calls<6?{
                role:'assistant',content:null,tool_calls:[{id:`call_${calls}`,
                  type:'function',function:invocation}]}:{role:'assistant',
                    content:'Submitted.'}}],usage:{prompt_tokens:12,
                      completion_tokens:4,total_tokens:16}};
        }},{async reserve(){},async settle(){}});
      try{
        assert.equal(await checkWorkerResourceReadiness(pkg,vault),true);
        const ports=createWorkerResourcePorts(pkg,vault,usage,
          (jobId,versionId)=>researchUsage.markPrivateResourceRead(jobId,versionId));
        const reviewed=await runRepresentativePackageTest(pkg,[],{
          values:{question:'Name the approved company'},assets:{}},{attemptRoot,
          dockerExecutable:docker,approvedImage:image,
          imageApproval:new OpenClawImageApproval(approval,runtimeRoot,docker),
          sandbox:new DockerSandboxAdapter({dockerExecutable:docker,
            approvedImage:image,collectorImage:image,attemptRoot}),docker:control,
          jobControl:jobs,localState:local,brokerPorts:{completion,research,...ports},
          async checkDependencies(){return {ready:true,
            verifiedNodeIds:pkg.dependencyGraph.nodes.map((item)=>item.id),
            evidence:{dedicatedReadOnlyDatabase:true}};}});
        assert.equal(calls,6);assert.equal(sawDeclaredRow,true);
        assert.equal(sawSelectedBytes,true);
        assert.equal(sawDeclaredApi,true);
        assert.equal(publicFetches,2,
          'robots policy and public research must run before any seller-private resource is read');
        assert.equal(reviewed.reviewedPackage.permissionPolicy.localResources[0]
          .operations[0].table,'company');
        const audits=usage.db?.prepare?.('SELECT * FROM local_resource_audit')
          ?.all?.()??[];
        assert.equal(audits.length,1);
        assert.equal(audits[0].status,'ALLOWED');
        assert.doesNotMatch(JSON.stringify(audits),/do-not-expose/);
        const fileAudits=usage.db?.prepare?.('SELECT * FROM selected_file_audit')
          ?.all?.()??[];
        assert.equal(fileAudits.length,1);
        assert.equal(fileAudits[0].status,'ALLOWED');
        assert.equal(JSON.stringify(fileAudits).includes(selectedPath),false);
        const apiAudits=usage.db?.prepare?.('SELECT * FROM declared_api_usage')
          ?.all?.()??[];
        assert.equal(apiAudits.length,1);
        assert.equal(apiAudits[0].status,'ALLOWED');
        process.env.BETTER_AUTH_SECRET ??='m16-database-publication-test-secret-32-characters';
        process.env.AUTH_OUTBOX_KEY_BASE64 ??=Buffer.alloc(32,17).toString('base64');
        process.env.KIVRO_STRIPE_MODE='test';
        process.env.KIVRO_CONTROL_PLANE_ID='m16-db-plane';
        await admin.query(`UPDATE accounts SET auth_email_verified=true,
          email_verified_at=now() WHERE id=$1`,[sellerAccount]);
        await admin.query(`UPDATE seller_profiles SET payout_status='READY' WHERE id=$1`,[seller]);
        await admin.query(`INSERT INTO seller_connect_profiles(seller_profile_id,
          stripe_account_id,stripe_mode,onboarding_status,transfers_enabled,
          payouts_enabled,last_reconciled_at)
          VALUES($1,'acct_M16DBFIXTURE','test','READY',true,true,now())`,[seller]);
        const {revision:priceRevision,...selectedPrice}=await new PostgresPriceTierCatalog(admin)
          .selected('USD_999');
        assert.ok(priceRevision>0);
        const review=buildWorkerCapabilityReview(reviewed,{versionNumber:1,
          selectedPrice,externalProcessors:['synthetic','example.com']},{workerDeviceId:worker,
          controlPlaneId:'m16-db-plane',providerUsage:{requests:calls,
            estimatedMicroUsd:0,unsettled:0}});
        const publication=new PostgresSellerPublicationRepository(admin);
        const staged=await publication.stageFromAuthenticatedWorker(review,worker);
        const slug=`m16-private-db-${dbCapabilityId.slice(0,8)}`;
        await publication.createDraftFromReview(sellerAccount,{reviewId:staged.reviewId,
          slug,name:'Private database lookup',description:'Read-only approved company lookup.'});
        await publishInAuthenticatedSellerBrowser({pool:admin,sellerAccount,seller,
          review,slug,versionId:dbVersionId,screenshotTag:'database'});
        await inspectPublicProcessorDisclosure({slug,expectedProcessors:[
          'synthetic','example.com'],expectedDatabaseState:'READ_ONLY',
          expectedFileState:'SELECTED_ONLY',
          expectedInternetState:'PUBLIC_RESEARCH_ONLY',
          expectedPermissionStates:{AI_INFERENCE:'USED',BROWSER:'NOT_USED',
            SHELL:'NOT_USED',PRIVATE_API:'READ_ONLY',
            EXTERNAL_SIDE_EFFECTS:'NOT_USED'},
          forbiddenPublicText:[
            'company_db','company-api','seller:company-readonly','seller_private','do-not-expose',
            process.env.M06_READONLY_URL,selectedPath,'UNSELECTED_SELLER_SECRET']});
      }finally{jobs.close();local.close();usage.close();researchUsage.close();
        rmSync(root,{recursive:true,force:true});}
    });
}
