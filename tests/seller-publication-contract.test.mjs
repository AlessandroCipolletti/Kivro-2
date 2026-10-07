import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { WorkerCapabilityReviewSchema, SellerPublicationApprovalSchema,
  workerReviewContentHash } from
  '../dist/packages/contracts/src/seller-publication.js';
import { buildVersionCandidate } from '../dist/packages/domain/src/capability-version.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { buildWorkerCapabilityReview } from
  '../dist/apps/worker/src/import-review.js';

const digest=`sha256:${'a'.repeat(64)}`;
export function fixtureParts(){
  const capabilityId=randomUUID(),versionId=randomUUID(),workerDeviceId=randomUUID();
  const skillBody=Buffer.from('# Research\nReturn one concise answer to the buyer question.\n');
  const skills=[{name:'research',files:[{path:'SKILL.md',bytesBase64:skillBody.toString('base64')}]}];
  const skillHash=hashCanonicalJson([{path:'SKILL.md',
    sha256:`sha256:${createHash('sha256').update(skillBody).digest('hex')}`}]);
  const manifest={manifestVersion:1,workerId:randomUUID(),capabilityVersionId:versionId,
    runtime:{type:'openclaw',supportedVersionRange:'>=2026.8.2 <2026.9.0'},
    skills:[{name:'research',contentHash:skillHash}],tools:{allow:[],deny:['browser','exec']},
    resources:[],network:{default:'deny',allow:[]},
    limits:{timeoutSeconds:120,memoryMb:1024,cpu:1,maxPids:128,
      maxInputBytes:1024,maxOutputBytes:1024}};
  const credentialRef='seller:provider';
  const budget={providerId:'synthetic',modelId:'test-model',credentialRef,
    maxRequestsPerJob:2,maxInputTokensPerRequest:100,maxOutputTokensPerRequest:100,
    maxEstimatedSpendMicroUsdPerJob:1000,inputPriceMicroUsdPerMillionTokens:100,
    outputPriceMicroUsdPerMillionTokens:100};
  const pkg={packageVersion:1,capabilityId,capabilityVersionId:versionId,workerDeviceId,
    workerManifest:manifest,dependencyGraph:{graphVersion:1,rootId:'skill',
      inference:{mode:'REMOTE_PROVIDER',dependencyId:'model',provider:'synthetic',
        model:'test-model',credentialRef:'credential',billingOwner:'SELLER'},alternatives:[],
      nodes:[]},permissionPolicy:{policyVersion:1,aiInference:'SELLER',
      publicInternet:'DENY',browser:false,proprietaryDatabase:'NONE',privateApi:'NONE',
      selectedFileResourceIds:[],selectedDirectoryResourceIds:[],localSoftware:false,
      shell:false,externalSideEffects:false,buyerFileAccess:false,
      sellerCredentialRefs:[credentialRef],providerBudget:budget},
    sellerInferenceConfigHash:digest,ioContract:{contractVersion:1,
      input:{schemaVersion:1,fields:[{key:'question',label:'Question',order:0,
        required:true,type:'SHORT_TEXT'}]},
      output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
        required:true,type:'SHORT_TEXT'}]}},priceTier:'USD_999',dependencySnapshot:[],
    concurrencyLimit:1,pauseSupport:'NOT_SUPPORTED',exampleRefs:[],testRefs:[]};
  const node=(id,type,dependsOn=[])=>({id,type,name:id,requirement:'REQUIRED',
    sensitivity:'MEDIUM',discoveredFrom:['SELLER_DECLARATION'],dependsOn,
    marketplaceSupport:'SUPPORTED',confidence:'CONFIRMED',selected:true,health:'READY'});
  pkg.dependencyGraph.nodes=[node('skill','SKILL',['model']),
    node('model','AI_MODEL',['provider','credential']),node('provider','AI_PROVIDER'),
    node('credential','CREDENTIAL')];
  const candidate=buildVersionCandidate({id:versionId,capabilityId,versionNumber:1,
    workerDeviceId,requestedAt:new Date().toISOString(),localPackage:pkg,
    selectedPrice:{tier:'USD_999',currency:'USD',buyerAmountMinor:999,
      platformFeeMinor:199,sellerEarningMinor:800},externalProcessors:['Synthetic provider']});
  const requiredConsents=pkg.dependencyGraph.nodes.map((item)=>({dependencyId:item.id,
    permissionType:item.type,permissionValueRef:item.id,sellerLabel:item.name}));
  const tests={testedPackageHash:candidate.localPackageHash,
    testedManifestHash:candidate.workerManifestHash,
    testedPermissionPolicyHash:candidate.permissionPolicyHash,
    testedDependencyGraphHash:candidate.dependencyGraphHash,
    observedDependencyGraphHash:candidate.dependencyGraphHash,
    dependencyHealth:digest,representativeJob:digest,observedVsDeclared:digest,
    securityProbes:digest,outputContract:digest,testedAt:new Date().toISOString(),
    approvedImageDigest:digest,openClawVersion:'2026.8.2'};
  const review={type:'CAPABILITY_REVIEW',protocolVersion:'kivro-worker/1',messageId:randomUUID(),
    controlPlaneId:'test-plane',workerDeviceId,candidate,inferenceMode:'REMOTE_PROVIDER',
    requiredConsents,providerCost:{estimatedMicroUsd:null,estimateSource:'UNKNOWN',
      maxMicroUsdPerJob:1000,maxRequestsPerJob:2,maxDailyMicroUsd:null},tests};
  return {review,pkg,skills};
}
export function fixture(){return fixtureParts().review;}

test('publication review is bound to one Worker, exact package and observed dependency graph',()=>{
  const review=fixture();
  assert.equal(workerReviewContentHash(review),workerReviewContentHash({...review,
    messageId:randomUUID(),controlPlaneId:'new-active-plane'}));
  assert.notEqual(workerReviewContentHash(review),workerReviewContentHash({...review,
    providerCost:{...review.providerCost,maxRequestsPerJob:3}}));
  assert.deepEqual(WorkerCapabilityReviewSchema.parse(review),review);
  assert.throws(()=>WorkerCapabilityReviewSchema.parse({...review,
    workerDeviceId:randomUUID()}));
  assert.throws(()=>WorkerCapabilityReviewSchema.parse({...review,
    tests:{...review.tests,testedPackageHash:`sha256:${'b'.repeat(64)}`}}));
  assert.throws(()=>WorkerCapabilityReviewSchema.parse({...review,
    tests:{...review.tests,observedDependencyGraphHash:`sha256:${'b'.repeat(64)}`}}));
  assert.throws(()=>WorkerCapabilityReviewSchema.parse({...review,
    requiredConsents:review.requiredConsents.slice(0,1)}));
  assert.throws(()=>WorkerCapabilityReviewSchema.parse({...review,
    requiredConsents:[...review.requiredConsents,review.requiredConsents[0]]}));
  assert.throws(()=>WorkerCapabilityReviewSchema.parse({...review,
    candidate:{...review.candidate,sellerInferenceConfigHash:null}}));
});

test('seller final approval carries exact candidate, price and consent identifiers',()=>{
  const review=fixture();
  const approval={reviewId:randomUUID(),capabilityVersionId:review.candidate.id,
    candidateHash:hashCanonicalJson(review.candidate),
    manifestHash:review.candidate.workerManifestHash,
    packageHash:review.candidate.localPackageHash,
    policyValidationHash:hashCanonicalJson({candidateHash:hashCanonicalJson(review.candidate),
      tests:review.tests}),slug:'research-brief',name:'Research brief',
    description:'A reviewed research brief for a stated company and question.',
    category:'RESEARCH',shortDescription:'A reviewed research brief for company questions.',
    tags:['research'],strengths:['Structured summary'],limitations:['No browser session'],
    visibility:'PRIVATE',availability:{schedule:null,concurrencyLimit:1,queueLimit:0,
      futureReservationLimit:0,estimatedRuntimeSeconds:120,maxWaitSeconds:3600},
    consentDependencyIds:review.requiredConsents.map((item)=>item.dependencyId),
    providerCostAcknowledged:true,localPermissionReviewAcknowledged:true,
    approvedAt:new Date().toISOString()};
  assert.deepEqual(SellerPublicationApprovalSchema.parse(approval),approval);
  assert.throws(()=>SellerPublicationApprovalSchema.parse({...approval,
    localPermissionReviewAcknowledged:false}));
  assert.throws(()=>SellerPublicationApprovalSchema.parse({...approval,
    consentDependencyIds:[...approval.consentDependencyIds,'skill']}));
  assert.throws(()=>SellerPublicationApprovalSchema.parse({...approval,
    availability:{...approval.availability,concurrencyLimit:0}}));
});

test('real review builder binds observed provider cost and refuses unaccounted execution',()=>{
  const {pkg}=fixtureParts();
  const tested={reviewedPackage:pkg,testedAt:new Date().toISOString(),
    dependencyHealth:digest,representativeJob:digest,observedVsDeclared:digest,
    securityProbes:digest,outputContract:digest,approvedImageDigest:digest,
    openClawVersion:'2026.8.2'};
  const price={tier:'USD_999',currency:'USD',buyerAmountMinor:999,
    platformFeeMinor:199,sellerEarningMinor:800};
  const config={versionNumber:1,selectedPrice:price,
    externalProcessors:['synthetic']};
  const context={workerDeviceId:pkg.workerDeviceId,controlPlaneId:'test-plane',
    providerUsage:{requests:1,estimatedMicroUsd:100,unsettled:0}};
  const review=buildWorkerCapabilityReview(tested,config,context);
  assert.equal(review.tests.testedPackageHash,hashCanonicalJson(pkg));
  assert.equal(review.providerCost.estimatedMicroUsd,100);
  assert.equal(review.providerCost.estimateSource,'SELLER_ENTERED');
  assert.throws(()=>buildWorkerCapabilityReview(tested,config,{...context,
    providerUsage:{...context.providerUsage,unsettled:1}}),/REVIEW_NOT_READY/);
  assert.throws(()=>buildWorkerCapabilityReview(tested,{...config,
    selectedPrice:{...price,buyerAmountMinor:1000}},context));
});
