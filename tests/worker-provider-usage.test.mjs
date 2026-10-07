import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerProviderUsage } from '../dist/apps/worker/src/provider-usage.js';

test('seller provider reservations survive restart and prevent duplicate or concurrent spend',async()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-local-provider-'));
  const jobId=randomUUID(),version=randomUUID(),requestId=randomUUID();
  const input={requestId,jobId,capabilityVersionId:version,
    providerId:'example',modelId:'model',reserveMicroUsd:1000,
    maxRequestsPerJob:1,maxSpendMicroUsdPerJob:1000,
    reservedInputTokens:100,reservedOutputTokens:100,maxTokensPerJob:200,
    maxDailyJobs:1,maxDailySpendMicroUsd:1000};
  let usage=new WorkerProviderUsage(root);
  try{
    const attempts=await Promise.allSettled([usage.reserve(input),
      usage.reserve({...input,requestId:randomUUID()})]);
    assert.equal(attempts.filter((item)=>item.status==='fulfilled').length,1);
    assert.equal(attempts.filter((item)=>item.status==='rejected').length,1);
    assert.equal(usage.summary(jobId).requests,1);
    await assert.rejects(usage.reserve(input),{code:'NETWORK_POLICY_DENIED'},
      'retry after an unknown provider response cannot call provider twice');
    usage.close();usage=new WorkerProviderUsage(root);
    assert.deepEqual(usage.summary(jobId),{requests:1,estimatedMicroUsd:1000,
      inputTokens:100,outputTokens:100,unsettled:1});
    await usage.settle({requestId,accountedMicroUsd:800,inputTokens:80,
      outputTokens:50,status:'SUCCEEDED'});
    await usage.settle({requestId,accountedMicroUsd:800,inputTokens:80,
      outputTokens:50,status:'SUCCEEDED'});
    assert.deepEqual(usage.summary(jobId),{requests:1,estimatedMicroUsd:800,
      inputTokens:80,outputTokens:50,unsettled:0});
    await assert.rejects(usage.settle({requestId,accountedMicroUsd:700,inputTokens:80,
      outputTokens:50,status:'SUCCEEDED'}),{code:'NETWORK_POLICY_DENIED'});
    await assert.rejects(usage.reserve({...input,requestId:randomUUID(),
      jobId:randomUUID()}),{code:'NETWORK_BUDGET_EXCEEDED'},
    'a different job cannot bypass the seller daily cap');
    await assert.rejects(usage.reserve({...input,requestId:randomUUID(),
      reserveMicroUsd:Number.MAX_SAFE_INTEGER}),{code:'NETWORK_BUDGET_EXCEEDED'});
    await assert.rejects(usage.reserve({...input,requestId:randomUUID(),
      reserveMicroUsd:0}),{code:'NETWORK_POLICY_DENIED'});
  }finally{usage.close();rmSync(root,{recursive:true,force:true});}
});
