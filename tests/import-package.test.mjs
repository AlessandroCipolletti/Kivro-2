import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SellerImportDraftStore } from '../dist/apps/worker/src/import-drafts.js';
import { prepareSelectedPackage, WorkerUnreviewedPackageStore } from
  '../dist/apps/worker/src/import-package.js';
import { runRepresentativePackageTest } from
  '../dist/apps/worker/src/import-review-runner.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { buildVersionCandidate } from '../dist/packages/domain/src/capability-version.js';

test('seller selection creates only a local unreviewed package with exact skill bytes', async () => {
  const root=mkdtempSync(join(tmpdir(),'kivro-import-package-'));
  const sellerAccountId=randomUUID(),workerDeviceId=randomUUID();
  const drafts=new SellerImportDraftStore(root);
  const packages=new WorkerUnreviewedPackageStore(root);
  try{
    let draft=drafts.createDraft(randomUUID(),sellerAccountId,{graphVersion:1,
      rootId:'dep:skill',inference:null,alternatives:[],nodes:[{
        id:'dep:skill',type:'SKILL',name:'selected',requirement:'REQUIRED',
        sensitivity:'MEDIUM',discoveredFrom:['SKILL_METADATA'],dependsOn:[],
        marketplaceSupport:'UNDETERMINED',confidence:'CONFIRMED',selected:false,
        health:'UNKNOWN'}]});
    draft=drafts.configureInference({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      mode:'REMOTE_PROVIDER',provider:'example',model:'model-one',
      credentialRef:'seller:dedicated'});
    const bytes=Buffer.from('---\nname: selected\n---\nOnly approved work.\n');
    const contentHash=hashCanonicalJson([{path:'SKILL.md',
      sha256:`sha256:${createHash('sha256').update(bytes).digest('hex')}`}]);
    const skill={name:'selected',contentHash,files:[{path:'SKILL.md',
      bytesBase64:bytes.toString('base64')}]};
    const discovery={async snapshotSelectedSkill(){return skill;}};
    const authored={capabilityId:randomUUID(),
      capabilityVersionId:randomUUID(),supportedOpenClawVersionRange:'>=2026.8.2 <2026.9.0',
      ioContract:{contractVersion:1,
        input:{schemaVersion:1,fields:[{key:'question',label:'Question',order:0,
          required:true,type:'SHORT_TEXT'}]},
        output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
          required:true,type:'SHORT_TEXT'}]}},
      priceTier:'USD_999',providerBudget:{providerId:'example',modelId:'model-one',
        credentialRef:'seller:dedicated',maxRequestsPerJob:2,
        maxInputTokensPerRequest:8192,maxOutputTokensPerRequest:1024,
        maxEstimatedSpendMicroUsdPerJob:100_000,
        inputPriceMicroUsdPerMillionTokens:1_000_000,
        outputPriceMicroUsdPerMillionTokens:1_000_000},
      limits:{timeoutSeconds:60,memoryMb:1024,cpu:1,maxPids:128,
        maxInputBytes:1000,maxOutputBytes:65536},
      concurrencyLimit:1,pauseSupport:'FULL_RESUME'};
    const context={sellerAccountId,workerDeviceId};
    await assert.rejects(prepareSelectedPackage(draft,authored,context,discovery),
      {code:'SELECTION_INCOMPLETE'});
    for(const node of draft.graph.nodes){
      draft=drafts.applySelection({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
        dependencyId:node.id,selected:true});
    }
    await assert.rejects(prepareSelectedPackage(draft,{...authored,
      providerBudget:{...authored.providerBudget,credentialRef:'seller:personal'}},
    context,discovery),{code:'INFERENCE_MISMATCH'});
    const prepared=await prepareSelectedPackage(draft,authored,context,discovery);
    const sample={values:{question:'A representative seller test question.'},assets:{}};
    await assert.rejects(runRepresentativePackageTest(prepared.localPackage,
      prepared.reviewedSkills,sample,{localState:{isUnpausedForNewJobOffer:()=>false}}),
    {code:'NOT_READY'},'local emergency pause must stop review before Docker or inference');
    await assert.rejects(runRepresentativePackageTest(prepared.localPackage,
      prepared.reviewedSkills,sample,{localState:{isUnpausedForNewJobOffer:()=>true},
        imageApproval:{async assertApprovedImage(){return {openClawVersion:'2026.8.2'};}},
        approvedImage:`kivro-test@sha256:${'a'.repeat(64)}`,
        async checkDependencies(){return {ready:true,verifiedNodeIds:['dep:skill'],
          evidence:{credentialPresent:true}};}}),{code:'DEPENDENCY_UNHEALTHY'},
    'a claimed healthy graph missing selected provider/model/credential cannot reach Docker');
    assert.equal(prepared.localPackage.workerDeviceId,workerDeviceId);
    assert.equal(prepared.localPackage.workerManifest.workerId,workerDeviceId);
    assert.equal(prepared.localPackage.workerManifest.skills[0].contentHash,contentHash);
    assert.equal(prepared.localPackage.permissionPolicy.publicInternet,'DENY');
    assert.equal(prepared.localPackage.permissionPolicy.sellerCredentialRefs[0],
      'seller:dedicated');
    assert.equal(prepared.localPackage.dependencyGraph.nodes.every((node)=>node.selected),true);
    const staged=packages.stage(draft,prepared);
    assert.equal(staged.packageHash,hashCanonicalJson(prepared.localPackage));
    assert.deepEqual(packages.load(authored.capabilityVersionId,sellerAccountId),prepared);
    assert.equal(packages.stage(draft,prepared).packageHash,staged.packageHash);
    assert.throws(()=>packages.load(authored.capabilityVersionId,randomUUID()),
      {code:'NOT_FOUND'});
    assert.throws(()=>packages.stage(draft,{...prepared,reviewedSkills:[{
      ...prepared.reviewedSkills[0],
      files:[{path:'SKILL.md',bytesBase64:Buffer.from('changed').toString('base64')}]}]}),
    {code:'CORRUPT'});
    assert.equal(packages.load(authored.capabilityVersionId,sellerAccountId)
      .reviewedSkills[0].files[0].bytesBase64,skill.files[0].bytesBase64);
    draft=drafts.declareResource({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      resourceId:'company_db',name:'Company records',type:'DATABASE'});
    draft=drafts.declareResource({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      resourceId:'customer-api',name:'Customer status API',type:'PRIVATE_API'});
    for(const dependencyId of ['company_db','customer-api']){
      draft=drafts.applySelection({actionId:randomUUID(),draftId:draft.id,
        sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
        dependencyId,selected:true});
    }
    const localResources=[{resourceId:'company_db',statementTimeoutMs:500,
      operations:[{id:'lookup',schema:'public',table:'companies',
        columns:['id','name'],lookupColumn:'id',maxRows:1}]}];
    const declaredApis={version:1,mode:'DECLARED_API_ACCESS',connectors:[{
      id:'customer-api',host:'api.example.com',method:'GET',path:'/v1/status',
      maxRequestsPerJob:2,maxRequestBytes:1024,maxResponseBytes:4096}]};
    const resourceAuthored={...authored,capabilityVersionId:randomUUID(),
      localResources,declaredApis,
      databaseCredentialRefs:{company_db:'seller:company-readonly'},
      apiCredentialRefs:{'customer-api':'seller:customer-api'}};
    await assert.rejects(prepareSelectedPackage(draft,{...resourceAuthored,
      databaseCredentialRefs:{}},context,discovery),{code:'DEPENDENCY_UNSUPPORTED'});
    await assert.rejects(prepareSelectedPackage(draft,{...resourceAuthored,
      declaredApis:{...declaredApis,connectors:[{...declaredApis.connectors[0],
        method:'POST'}]}},context,discovery),{code:'DEPENDENCY_UNSUPPORTED'});
    const withResources=await prepareSelectedPackage(draft,resourceAuthored,context,discovery);
    assert.deepEqual(withResources.localPackage.workerManifest.tools.allow,
      ['kivro_resource_read','kivro_declared_api']);
    assert.deepEqual(withResources.localPackage.workerManifest.resources.map((item)=>item.id),
      ['company_db','customer-api']);
    assert.equal(withResources.localPackage.permissionPolicy.proprietaryDatabase,'READ_ONLY');
    assert.equal(withResources.localPackage.permissionPolicy.privateApi,'READ_ONLY');
    assert.equal(withResources.localPackage.permissionPolicy.internet.connectors[0].host,
      'api.example.com');
    assert.equal(packages.stage(draft,withResources).capabilityVersionId,
      resourceAuthored.capabilityVersionId);
    draft=drafts.declareResource({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      resourceId:'selected-dataset',name:'Company dataset',type:'LOCAL_FILE'});
    draft=drafts.applySelection({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      dependencyId:'selected-dataset',selected:true});
    const dataset=join(root,'selected.txt');
    writeFileSync(dataset,'Company-only data');
    const withFile=await prepareSelectedPackage(draft,{...resourceAuthored,
      capabilityVersionId:randomUUID(),selectedLocalPaths:[{
        resourceId:'selected-dataset',absolutePath:realpathSync(dataset)}]},
    context,discovery);
    assert.deepEqual(withFile.localPackage.permissionPolicy.selectedFileResourceIds,
      ['selected-dataset']);
    assert.ok(withFile.localPackage.workerManifest.tools.allow.includes(
      'kivro_selected_file_read'));
    assert.equal(withFile.localPackage.selectedLocalBindings[0].absolutePath,
      realpathSync(dataset));
    assert.equal(withFile.localPackage.workerManifest.resources.at(-1).type,
      'selected-file');
    assert.equal(packages.stage(draft,withFile).capabilityVersionId,
      withFile.localPackage.capabilityVersionId);
    const publicCandidate=buildVersionCandidate({id:withFile.localPackage.capabilityVersionId,
      capabilityId:withFile.localPackage.capabilityId,versionNumber:1,
      workerDeviceId,requestedAt:new Date().toISOString(),
      localPackage:withFile.localPackage,externalProcessors:['example'],
      selectedPrice:{tier:'USD_999',currency:'USD',buyerAmountMinor:999,
        platformFeeMinor:199,sellerEarningMinor:800}});
    assert.equal(JSON.stringify(publicCandidate).includes(realpathSync(dataset)),false,
      'the cloud and buyer projection must never contain a seller host path');
    assert.equal(publicCandidate.publicPermissionManifest.entries.find((entry)=>
      entry.category==='LOCAL_FILES').state,'SELECTED_ONLY');
    draft=drafts.declareResource({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      resourceId:'kivro_research_fetch',name:'kivro_research_fetch',type:'TOOL'});
    draft=drafts.applySelection({actionId:randomUUID(),draftId:draft.id,
      sellerAccountId,expectedRevision:draft.revision,actedAt:new Date().toISOString(),
      dependencyId:'kivro_research_fetch',selected:true});
    const publicResearch={version:1,mode:'PUBLIC_WEB_RESEARCH',
      domains:{mode:'ANY_PUBLIC_DOMAIN'},
      search:{enabled:false,maxQueriesPerJob:1,maxResults:3},
      fetch:{enabled:true,maxPagesPerJob:2,maxResponseBytes:4096,maxRedirects:1,
        timeoutMs:2000,allowedContentTypes:['text/html']},
      download:{enabled:false,maxDownloadsPerJob:1,maxFileBytes:4096,
        maxBytesPerJob:100_000,allowedMimeTypes:[]},
      limits:{maxNetworkBytesPerJob:100_000,maxDurationMs:60_000,
        maxConcurrentRequests:1,maxRequestsPerHost:2}};
    const researched=await prepareSelectedPackage(draft,{...resourceAuthored,
      capabilityVersionId:randomUUID(),
      publicResearch,selectedLocalPaths:[{resourceId:'selected-dataset',
        absolutePath:realpathSync(dataset)}]},context,discovery);
    assert.equal(researched.localPackage.permissionPolicy.publicInternet,
      'PUBLIC_RESEARCH_BROKER');
    assert.deepEqual(researched.localPackage.workerManifest.tools.allow,
      ['kivro_research_fetch','kivro_resource_read','kivro_declared_api',
        'kivro_selected_file_read']);
    assert.equal(researched.localPackage.permissionPolicy.declaredApiPolicy.mode,
      'DECLARED_API_ACCESS');
    const researchCandidate=buildVersionCandidate({
      id:researched.localPackage.capabilityVersionId,
      capabilityId:researched.localPackage.capabilityId,versionNumber:1,
      workerDeviceId,requestedAt:new Date().toISOString(),
      localPackage:researched.localPackage,externalProcessors:['example'],
      selectedPrice:{tier:'USD_999',currency:'USD',buyerAmountMinor:999,
        platformFeeMinor:199,sellerEarningMinor:800}});
    assert.equal(researchCandidate.publicPermissionManifest.entries.find((entry)=>
      entry.category==='PUBLIC_INTERNET').state,'PUBLIC_RESEARCH_ONLY');
    assert.equal(JSON.stringify(researchCandidate).includes(realpathSync(dataset)),false);
    await assert.rejects(prepareSelectedPackage(draft,{...resourceAuthored,
      capabilityVersionId:randomUUID(),
      publicResearch:{...publicResearch,fetch:{...publicResearch.fetch,enabled:false}},
      selectedLocalPaths:[{resourceId:'selected-dataset',absolutePath:realpathSync(dataset)}]},
    context,discovery),{code:'DEPENDENCY_UNSUPPORTED'});
  }finally{packages.close();drafts.close();rmSync(root,{recursive:true,force:true});}
});
