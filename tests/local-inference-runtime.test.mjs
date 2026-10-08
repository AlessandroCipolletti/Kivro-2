/* global AbortController */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalOpenAiCompatibleConnector } from
  '../dist/packages/infrastructure/adapters/src/local-openai-compatible.js';
import { SellerCompletionBroker } from
  '../dist/packages/application/src/completion-broker.js';
import { WorkerLocalInferenceUsage } from
  '../dist/apps/worker/src/local-inference-usage.js';
import { WorkerRuntimeReadiness } from
  '../dist/apps/worker/src/runtime-readiness.js';
import { WorkerCapabilityPackageStore } from
  '../dist/apps/worker/src/capability-package-store.js';
import { WorkerImportReviewOutbox } from
  '../dist/apps/worker/src/import-review-outbox.js';
import { WorkerProviderUsage } from
  '../dist/apps/worker/src/provider-usage.js';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';
import { localHealth } from '../dist/apps/worker/src/health.js';
import { buildWorkerCapabilityReview } from
  '../dist/apps/worker/src/import-review.js';
import { hashCanonicalJson } from
  '../dist/packages/contracts/src/canonical-json.js';
import { fixtureParts } from './seller-publication-contract.test.mjs';

test('local inference is loopback only, model exact, durable and replay bounded',async()=>{
  const stateDir=mkdtempSync(join(tmpdir(),'kivro-local-model-'));
  let calls=0;
  const server=createServer((request,response)=>{
    response.setHeader('content-type','application/json');
    if(request.method==='GET'&&request.url==='/v1/models'){
      response.end(JSON.stringify({data:[{id:'seller-local-model'}]}));return;
    }
    if(request.method==='POST'&&request.url==='/v1/chat/completions'){
      calls++;
      response.end(JSON.stringify({id:randomUUID(),object:'chat.completion',
        created:1,model:'seller-local-model',choices:[{index:0,
          finish_reason:'stop',message:{role:'assistant',content:'local answer'}}],
        usage:{prompt_tokens:4,completion_tokens:2,total_tokens:6}}));return;
    }
    response.statusCode=404;response.end('{}');
  });
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const endpoint=`http://127.0.0.1:${server.address().port}/v1`;
  const connector=new LocalOpenAiCompatibleConnector('seller-local',endpoint);
  const policy={providerId:'seller-local',modelId:'seller-local-model',
    endpointRef:'dep:local-service',maxRequestsPerJob:1,
    maxInputTokensPerRequest:100,maxOutputTokensPerRequest:20,
    maxTokensPerJob:120,maxDailyJobs:1};
  const jobId=randomUUID(),capabilityVersionId=randomUUID();
  let usage=new WorkerLocalInferenceUsage(stateDir);
  try{
    await connector.checkModel(policy.modelId);
    await assert.rejects(connector.checkModel('invented-model'),
      {code:'BROKER_UNAVAILABLE'});
    const broker=new SellerCompletionBroker(null,connector,null,usage);
    const binding={jobId,capabilityVersionId,localInference:policy,
      allowedToolNames:[]};
    const request={model:policy.modelId,stream:true,max_tokens:20,
      messages:[{role:'user',content:'Answer from the local service.'}]};
    const requestId=randomUUID();
    const answer=await broker.invoke(binding,request,requestId,
      new AbortController().signal);
    assert.equal(answer.choices[0].message.content,'local answer');
    assert.equal(calls,1);
    assert.deepEqual(usage.summary(jobId),{requests:1,inputTokens:4,
      outputTokens:2,unsettled:0});
    usage.close();usage=new WorkerLocalInferenceUsage(stateDir);
    const restarted=new SellerCompletionBroker(null,connector,null,usage);
    await assert.rejects(restarted.invoke(binding,request,requestId,
      new AbortController().signal),{code:'NETWORK_POLICY_DENIED'});
    await assert.rejects(restarted.invoke(binding,request,randomUUID(),
      new AbortController().signal),{code:'NETWORK_BUDGET_EXCEEDED'});
    assert.equal(calls,1,'replay and capacity denial cannot invoke the model');
    await assert.rejects(restarted.invoke({...binding,providerBudget:{}},request,
      randomUUID(),new AbortController().signal),{code:'NETWORK_POLICY_DENIED'});
    assert.throws(()=>new LocalOpenAiCompatibleConnector('seller-local',
      'http://169.254.169.254/v1'),{code:'NETWORK_POLICY_DENIED'});
    assert.throws(()=>new LocalOpenAiCompatibleConnector('seller-local',
      'http://127.0.0.1:1234/v1?redirect=http://example.com'),
    {code:'NETWORK_POLICY_DENIED'});
  }finally{
    usage.close();await new Promise((resolve)=>server.close(resolve));
    await assert.rejects(connector.checkModel(policy.modelId),
      {code:'BROKER_UNAVAILABLE'},'stopped local service blocks new readiness');
    rmSync(stateDir,{recursive:true,force:true});
  }
});

test('a reviewed local model is offered only while the exact service is healthy',async()=>{
  const stateDir=mkdtempSync(join(tmpdir(),'kivro-local-readiness-'));
  const server=createServer((request,response)=>{
    response.setHeader('content-type','application/json');
    response.end(JSON.stringify({data:request.url==='/v1/models'?
      [{id:'seller-local-model'}]:[]}));
  });
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const endpoint=`http://127.0.0.1:${server.address().port}/v1`;
  const seller=randomUUID(),{pkg,skills}=fixtureParts();
  pkg.dependencyGraph.inference={mode:'LOCAL',dependencyId:'model',
    provider:'seller-local',model:'seller-local-model',endpointRef:'service',
    billingOwner:'SELLER'};
  pkg.dependencyGraph.nodes=pkg.dependencyGraph.nodes.map((node)=>{
    if(node.id==='credential')return {...node,id:'service',type:'LOCAL_SERVICE',
      name:'local-model-server'};
    if(node.id==='model')return {...node,name:'seller-local-model',
      dependsOn:['provider','service']};
    if(node.id==='provider')return {...node,name:'seller-local'};
    return node;
  });
  delete pkg.permissionPolicy.providerBudget;
  pkg.permissionPolicy.sellerCredentialRefs=[];
  pkg.permissionPolicy.localInference={providerId:'seller-local',
    modelId:'seller-local-model',endpointRef:'service',maxRequestsPerJob:2,
    maxInputTokensPerRequest:100,maxOutputTokensPerRequest:100,
    maxTokensPerJob:400,maxDailyJobs:10};
  const image=`kivro-openclaw-runtime@sha256:${'a'.repeat(64)}`;
  const tested={reviewedPackage:pkg,testedAt:new Date().toISOString(),
    dependencyHealth:`sha256:${'a'.repeat(64)}`,
    representativeJob:`sha256:${'a'.repeat(64)}`,
    observedVsDeclared:`sha256:${'a'.repeat(64)}`,
    securityProbes:`sha256:${'a'.repeat(64)}`,
    outputContract:`sha256:${'a'.repeat(64)}`,
    approvedImageDigest:`sha256:${'a'.repeat(64)}`,openClawVersion:'2026.8.2'};
  const review=buildWorkerCapabilityReview(tested,{versionNumber:1,
    selectedPrice:{tier:'USD_999',currency:'USD',buyerAmountMinor:999,
      platformFeeMinor:199,sellerEarningMinor:800},externalProcessors:[]},
  {workerDeviceId:pkg.workerDeviceId,controlPlaneId:'test-plane',
    providerUsage:{requests:1,estimatedMicroUsd:0,unsettled:0}});
  const packages=new WorkerCapabilityPackageStore(stateDir);
  const reviews=new WorkerImportReviewOutbox(stateDir);
  const usage=new WorkerProviderUsage(stateDir);
  const localUsage=new WorkerLocalInferenceUsage(stateDir);
  const localState=new WorkerLocalState(stateDir,{check:async()=>({ready:false,
    checkedAt:new Date().toISOString(),blockingReasons:['TEST']})});
  const readiness=new WorkerRuntimeReadiness({deviceId:pkg.workerDeviceId,
    sellerAccountId:seller,packages,reviews,usage,localUsage,localState,
    vault:{async exists(){throw new Error('LOCAL_MUST_NOT_READ_VAULT');}},
    imageApproval:{async assertApprovedImage(){return {openClawVersion:'2026.8.2'};}},
    approvedImage:image,collectorImage:image,jobControl:{snapshots(){return [];}}});
  try{
    packages.installReviewed(pkg,{actorId:'local:seller',
      approvedAt:review.tests.testedAt,
      reviewEvidenceHash:hashCanonicalJson(review.tests)},skills);
    const localReport=await localHealth(stateDir,localState.snapshot(),
      'METADATA_PRESENT',0,false,pkg.workerDeviceId);
    assert.equal(localReport.checks.some((check)=>
      check.code==='SELLER_INFERENCE_CREDENTIALS'),false,
      'a seller local model requires service health, not a remote provider key');
    reviews.record(review,seller,endpoint);
    assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false,
      'review must be acknowledged before admission');
    reviews.markSent(pkg.capabilityVersionId,seller);
    assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,true);
    await new Promise((resolve)=>server.close(resolve));
    assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false,
      'a stopped local service cannot admit another offer');
  }finally{
    if(server.listening)await new Promise((resolve)=>server.close(resolve));
    packages.close();reviews.close();usage.close();localUsage.close();localState.close();
    rmSync(stateDir,{recursive:true,force:true});
  }
});
