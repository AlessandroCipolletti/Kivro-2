import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { PostgresResearchUsage } from '../dist/packages/persistence/src/research-usage.js';
import { PostgresLocalResourceAudit } from '../dist/packages/persistence/src/local-resource-audit.js';
import { LocalResourceBroker } from '../dist/packages/application/src/local-resource-broker.js';
import { PostgresReadOnlyResourceAdapter } from '../dist/packages/persistence/src/postgres-readonly-resource.js';
import { PostgresDeclaredApiUsage } from '../dist/packages/persistence/src/declared-api-usage.js';
import { PostgresProviderUsage } from '../dist/packages/persistence/src/provider-usage.js';

if (!process.env.M06_DATABASE_URL) {
  test('M06 PostgreSQL integration requires the Docker test script', { skip: true }, () => {});
} else {
  const admin = new pg.Pool({ connectionString: process.env.M06_DATABASE_URL });
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
    } finally { await readonly.end(); await admin.end(); }
  });
}
