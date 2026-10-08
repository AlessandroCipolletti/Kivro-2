import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runGuidedImport } from '../dist/apps/worker/src/guided-import.js';
import { WorkerUnreviewedPackageStore } from
  '../dist/apps/worker/src/import-package.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';

function fixture(resources={binaries:[],environmentKeys:[],configKeys:[],anyBinaries:[]},
  localInference=[]){
  const bytes=Buffer.from('---\nname: research\n---\nReturn a concise answer.\n');
  const contentHash=hashCanonicalJson([{path:'SKILL.md',
    sha256:`sha256:${createHash('sha256').update(bytes).digest('hex')}`}]);
  return {async scan(){return {status:'ready',issues:[],localInference,skills:[{
    name:'research',metadata:'parsed',ambiguous:false,declaredResources:resources}]};},
  async snapshotSelectedSkill(){return {name:'research',contentHash,
    files:[{path:'SKILL.md',bytesBase64:bytes.toString('base64')}]};}};
}
function question(prompt){
  if(prompt.endsWith('Type yes to continue: '))return 'yes';
  if(prompt==='Choose one skill number: ')return '1';
  if(prompt==='Dedicated inference provider ID: ')return 'example';
  if(prompt==='Exact model ID: ')return 'model-one';
  if(prompt.startsWith('Existing local vault credential ref'))return 'seller:dedicated';
  if(prompt==='Buyer input label: ')return 'Company question';
  if(prompt==='Result output label: ')return 'Research answer';
  if(prompt.startsWith('Representative buyer input'))return 'What does Acme sell?';
  if(prompt==='Choose price tier number: ')return '4';
  if(prompt.includes('million input tokens'))return '1.25';
  if(prompt.includes('million output tokens'))return '2.50';
  if(prompt.includes('USD per job'))return '0.30';
  if(prompt.includes('USD per day'))return '3.00';
  if(prompt.startsWith('Maximum model requests'))return '2';
  if(prompt.startsWith('Maximum model jobs'))return '10';
  if(prompt.startsWith('Provider HTTPS'))return 'https://api.example.com/v1';
  if(prompt.startsWith('Seller instructions'))return 'Answer only the buyer question.';
  if(prompt.startsWith('Version number'))return '1';
  if(prompt.startsWith('Capability ID'))return 'new';
  throw new Error(`Unexpected prompt: ${prompt}`);
}

test('guided seller import requires each selection and stages a private review without hand-authored JSON',
  async()=>{
    const root=mkdtempSync(join(tmpdir(),'kivro-guided-import-'));
    const sellerAccountId=randomUUID(),deviceId=randomUUID();
    const output=[];
    let reviewed=0;
    try{
      const result=await runGuidedImport({stateDir:root,sellerAccountId,
        signer:{deviceId},discovery:fixture(),ask:async(prompt)=>question(prompt),
        write:(line)=>output.push(line),credentialExists:async(ref)=>
          ref==='seller:dedicated',review:async(input)=>{
            reviewed++;
            const store=new WorkerUnreviewedPackageStore(root);
            try{
              const staged=store.load(input.versionId,sellerAccountId);
              assert.equal(staged.localPackage.workerDeviceId,deviceId);
              assert.equal(staged.localPackage.dependencyGraph.nodes.length,4);
              assert.equal(staged.localPackage.dependencyGraph.nodes.every((node)=>node.selected),true);
              assert.equal(staged.localPackage.priceTier,'USD_999');
              assert.equal(staged.localPackage.permissionPolicy.providerBudget
                .maxEstimatedSpendMicroUsdPerJob,300_000);
              assert.equal(input.privateConfig.selectedPrice.buyerAmountMinor,999);
              assert.equal(input.privateConfig.sampleInput.values.question,
                'What does Acme sell?');
              assert.equal(input.privateConfig.providerEndpoint,'https://api.example.com/v1');
              return {capabilityVersionId:input.versionId,
                state:'STAGED_FOR_SELLER_REVIEW',packageHash:hashCanonicalJson(staged.localPackage)};
            }finally{store.close();}
          }});
      assert.equal(reviewed,1);
      assert.match(result.packageHash,/^sha256:[a-f0-9]{64}$/);
      assert.doesNotMatch(output.join('\n'),/What does Acme sell|seller:dedicated|private key/i);
    }finally{rmSync(root,{recursive:true,force:true});}
  });

test('guided import fails closed on declared resource needs and a missing dedicated credential',async()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-guided-deny-'));
  const common={stateDir:root,sellerAccountId:randomUUID(),signer:{deviceId:randomUUID()},
    ask:async(prompt)=>question(prompt),write:()=>{},review:async()=>{throw new Error('REVIEW_CALLED');}};
  try{
    await assert.rejects(runGuidedImport({...common,discovery:fixture({
      binaries:['ffmpeg'],environmentKeys:[],configKeys:[],anyBinaries:[]}),
      credentialExists:async()=>true}),{code:'UNSUPPORTED_DEPENDENCY'});
    await assert.rejects(runGuidedImport({...common,discovery:fixture(),
      credentialExists:async()=>false}),{code:'CREDENTIAL_MISSING'});
    await assert.rejects(runGuidedImport({...common,discovery:fixture(),
      ask:async()=>''}),{code:'SELLER_DECLINED'});
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('guided import keeps discovered local inference unselected until explicit seller consent',
  async()=>{
    const root=mkdtempSync(join(tmpdir(),'kivro-guided-local-'));
    const sellerAccountId=randomUUID(),deviceId=randomUUID();
    let reviewed=0;
    const candidate={provider:'seller-local',model:'private-model',
      endpoint:'http://127.0.0.1:11434/v1',requiredService:'local-model-server',
      estimatedHardware:'unknown',availability:'unknown',consent:'not-granted'};
    try{
      await runGuidedImport({stateDir:root,sellerAccountId,signer:{deviceId},
        discovery:fixture(undefined,[candidate]),write:()=>{},
        ask:async(prompt)=>{
          if(prompt.startsWith('Inference route:'))return '2';
          if(prompt==='Maximum local model tokens per job: ')return '20_000'.replace('_','');
          return question(prompt);
        },review:async(input)=>{
          reviewed++;
          const store=new WorkerUnreviewedPackageStore(root);
          try{
            const staged=store.load(input.versionId,sellerAccountId);
            assert.equal(staged.localPackage.dependencyGraph.inference.mode,'LOCAL');
            assert.equal(staged.localPackage.permissionPolicy.providerBudget,undefined);
            assert.deepEqual(staged.localPackage.permissionPolicy.sellerCredentialRefs,[]);
            assert.equal(staged.localPackage.permissionPolicy.localInference.modelId,
              candidate.model);
            assert.equal(staged.localPackage.dependencyGraph.nodes.every((node)=>
              node.selected),true);
            assert.equal(input.privateConfig.providerEndpoint,candidate.endpoint);
            assert.deepEqual(input.privateConfig.externalProcessors,[]);
          }finally{store.close();}
          return {capabilityVersionId:input.versionId,
            state:'STAGED_FOR_SELLER_REVIEW',packageHash:'unused'};
        }});
      assert.equal(reviewed,1);
    }finally{rmSync(root,{recursive:true,force:true});}
  });
