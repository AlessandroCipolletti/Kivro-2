import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SellerImportDraftStore } from '../dist/apps/worker/src/import-drafts.js';
import { prepareSelectedPackage, WorkerUnreviewedPackageStore } from
  '../dist/apps/worker/src/import-package.js';
import { runRepresentativePackageTest } from
  '../dist/apps/worker/src/import-review-runner.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';

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
  }finally{packages.close();drafts.close();rmSync(root,{recursive:true,force:true});}
});
