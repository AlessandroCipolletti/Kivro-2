import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {WorkerResourceUsage,checkWorkerResourceReadiness} from
  '../dist/apps/worker/src/resource-ports.js';
import {fixtureParts} from './seller-publication-contract.test.mjs';

test('every declared seller secret must exist before paid Worker admission',async()=>{
  const {pkg}=fixtureParts();
  assert.equal(await checkWorkerResourceReadiness(pkg,{
    async exists(){return false;},async resolve(){throw Error('NOT_USED');}}),false);
  assert.equal(await checkWorkerResourceReadiness(pkg,{
    async exists(ref){return ref==='seller:provider';},
    async resolve(){throw Error('NOT_USED');}}),true);
});

test('seller-local declared API usage is durable, budgeted and replay-denying',async()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-resource-usage-'));
  const jobId=randomUUID(),capabilityVersionId=randomUUID();
  const base={jobId,capabilityVersionId,connectorId:'company-api',
    host:'api.example.com',method:'GET',maxRequestsPerJob:1};
  const requestId=randomUUID();
  try{
    let usage=new WorkerResourceUsage(root);
    await usage.begin({...base,requestId});
    await usage.markPrivateResourceRead(jobId,capabilityVersionId);
    await usage.record({jobId,capabilityVersionId,resourceId:'company_db',
      operationId:'lookup',rowCount:1,status:'ALLOWED',reason:null,
      occurredAt:new Date().toISOString()});
    usage.close();
    usage=new WorkerResourceUsage(root);
    await assert.rejects(usage.begin({...base,requestId}),
      {code:'NETWORK_POLICY_DENIED'},'restart cannot replay a private API call');
    await assert.rejects(usage.begin({...base,requestId:randomUUID()}),
      {code:'NETWORK_BUDGET_EXCEEDED'},'restart cannot reset the job budget');
    await usage.finish({requestId,responseBytes:12,status:'ALLOWED',reason:null});
    await usage.finish({requestId,responseBytes:12,status:'ALLOWED',reason:null});
    usage.close();
  }finally{rmSync(root,{recursive:true,force:true});}
});
