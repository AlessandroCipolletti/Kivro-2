/* global AbortController */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync,
  symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { captureSelectedLocalBinding, SelectedLocalFileBroker,
  verifySelectedLocalBinding } from '../dist/apps/worker/src/selected-local-file.js';
import { WorkerResourceUsage,checkWorkerResourceReadiness } from
  '../dist/apps/worker/src/resource-ports.js';
import { WorkerBrokerRouter } from '../dist/apps/worker/src/broker-router.js';
import { LocalCapabilityPackageSchema } from
  '../dist/packages/contracts/src/capability-package.js';
import { pkg } from './fixtures/worker-package.mjs';

function selectedPackage(binding) {
  const value=pkg(['kivro_selected_file_read']);
  value.selectedLocalBindings=[binding];
  value.permissionPolicy.selectedFileResourceIds=binding.kind==='FILE'?[binding.resourceId]:[];
  value.permissionPolicy.selectedDirectoryResourceIds=
    binding.kind==='DIRECTORY'?[binding.resourceId]:[];
  value.workerManifest.resources=[{id:binding.resourceId,type:'selected-file',
    permissions:['READ']}];
  value.dependencyGraph.nodes.push({...value.dependencyGraph.nodes[0],
    id:binding.resourceId,type:binding.kind==='FILE'?'LOCAL_FILE':'LOCAL_DIRECTORY',
    selected:true});
  return LocalCapabilityPackageSchema.parse(value);
}

test('seller-selected file is version-pinned, read-only, audited and opaque to the sandbox',
  async()=>{
    const root=mkdtempSync(join(realpathSync(tmpdir()),'kivro-selected-file-'));
    const path=join(root,'company.csv'),other=join(root,'private.txt');
    writeFileSync(path,'company,amount\nA,12\n');
    writeFileSync(other,'DO_NOT_DISCLOSE');
    const usage=new WorkerResourceUsage(root);
    try{
      const binding=await captureSelectedLocalBinding({resourceId:'company-dataset',
        kind:'FILE',absolutePath:path});
      const packageData=selectedPackage(binding);
      const vault={async exists(){return true;}};
      assert.equal(await checkWorkerResourceReadiness(packageData,vault),true,
        'a reviewed selected file is ready before paid offer admission');
      const jobId=randomUUID();
      const broker=new SelectedLocalFileBroker(binding,usage);
      const router=new WorkerBrokerRouter(packageData,jobId,{completion:{},
        selectedFiles:new Map([[binding.resourceId,broker]])});
      const input={resourceId:binding.resourceId,fileId:binding.files[0].fileId,
        offset:0,length:65_536};
      assert.ok(router.allowedToolNames.includes('kivro_selected_file_read'));
      const result=await router.dispatch({type:'REQUEST',id:randomUUID(),
        kind:'SELECTED_FILE_READ',payload:input},new AbortController().signal);
      assert.equal(Buffer.from(result.bytesBase64,'base64').toString(),
        readFileSync(path,'utf8'));
      assert.equal(JSON.stringify(result).includes(path),false);
      const auditDb=new DatabaseSync(join(root,'resource-usage.sqlite'));
      try{
        assert.equal(auditDb.prepare(`SELECT count(*) AS n FROM private_resource_reads
          WHERE job_id=? AND capability_version_id=?`).get(jobId,
            packageData.capabilityVersionId).n,1,
        'the private-read barrier must be durable before selected bytes leave the Worker');
      }finally{auditDb.close();}
      await assert.rejects(router.dispatch({type:'REQUEST',id:randomUUID(),
        kind:'SELECTED_FILE_READ',payload:{...input,fileId:'other'}},
      new AbortController().signal),{code:'SELECTED_FILE_DENIED'});
      await assert.rejects(router.dispatch({type:'REQUEST',id:randomUUID(),
        kind:'SELECTED_FILE_READ',payload:{...input,resourceId:'other'}},
      new AbortController().signal),{code:'UNDECLARED_TOOL'});
      writeFileSync(path,'company,amount\nA,13\n');
      assert.equal(await verifySelectedLocalBinding(binding),false);
      assert.equal(await checkWorkerResourceReadiness(packageData,vault),false,
        'a changed seller file blocks readiness before paid offer admission');
      await assert.rejects(router.dispatch({type:'REQUEST',id:randomUUID(),
        kind:'SELECTED_FILE_READ',payload:input},new AbortController().signal),
      {code:'SELECTED_FILE_CHANGED'});
      assert.equal(readFileSync(other,'utf8'),'DO_NOT_DISCLOSE');
      const invalid={...packageData,permissionPolicy:{...packageData.permissionPolicy,
        selectedFileResourceIds:['other']}};
      assert.equal(LocalCapabilityPackageSchema.safeParse(invalid).success,false,
        'a stale version or changed seller authorization cannot execute');
    }finally{usage.close();rmSync(root,{recursive:true,force:true});}
  });

test('selected file read fails closed if the private-resource barrier is unavailable',async()=>{
  const root=mkdtempSync(join(realpathSync(tmpdir()),'kivro-selected-barrier-'));
  const path=join(root,'selected.txt');writeFileSync(path,'PRIVATE_BYTES');
  try{
    const binding=await captureSelectedLocalBinding({resourceId:'selected',
      kind:'FILE',absolutePath:path});
    const broker=new SelectedLocalFileBroker(binding,{
      async markPrivateResourceRead(){throw new Error('BARRIER_UNAVAILABLE');},
      async recordSelectedFile(){},
    });
    await assert.rejects(broker.read({jobId:randomUUID(),
      capabilityVersionId:randomUUID()},{resourceId:'selected',
      fileId:binding.files[0].fileId,offset:0,length:32},
    new AbortController().signal),{code:'SELECTED_FILE_DENIED'});
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('selected directory snapshots reject traversal, symlinks, replacement and special names',
  async()=>{
    const root=mkdtempSync(join(realpathSync(tmpdir()),'kivro-selected-dir-'));
    const folder=join(root,'dataset'),outside=join(root,'secret.txt');
    mkdirSync(folder);writeFileSync(outside,'SECRET');
    writeFileSync(join(folder,'one.txt'),'ONE');
    const usage=new WorkerResourceUsage(root);
    try{
      let binding=await captureSelectedLocalBinding({resourceId:'dataset',
        kind:'DIRECTORY',absolutePath:folder});
      const broker=new SelectedLocalFileBroker(binding,usage);
      const context={jobId:randomUUID(),capabilityVersionId:randomUUID()};
      const input={resourceId:'dataset',fileId:binding.files[0].fileId,
        offset:0,length:3};
      assert.equal(Buffer.from((await broker.read(context,input,
        new AbortController().signal)).bytesBase64,'base64').toString(),'ONE');
      for(const malformed of ['../secret.txt','/etc/passwd','sibling/../../secret.txt',
        'one.txt/../secret.txt','\\etc\\passwd']){
        await assert.rejects(broker.read(context,{...input,fileId:malformed},
          new AbortController().signal));
      }
      symlinkSync(outside,join(folder,'link.txt'));
      await assert.rejects(captureSelectedLocalBinding({resourceId:'dataset',
        kind:'DIRECTORY',absolutePath:folder}),{code:'SELECTED_FILE_DENIED'});
      rmSync(join(folder,'link.txt'));
      rmSync(join(folder,'one.txt'));
      symlinkSync(outside,join(folder,'one.txt'));
      assert.equal(await verifySelectedLocalBinding(binding),false);
      await assert.rejects(broker.read(context,input,new AbortController().signal),
        {code:'SELECTED_FILE_DENIED'});
      rmSync(join(folder,'one.txt'));
      writeFileSync(join(folder,'one.txt'),'ONE');
      assert.equal(await verifySelectedLocalBinding(binding),false,
        'replacing the same bytes still changes the immutable file identity');
      await assert.rejects(captureSelectedLocalBinding({resourceId:'dataset',
        kind:'DIRECTORY',absolutePath:join(root,'..')}),
      {code:'SELECTED_FILE_DENIED'});
      mkdirSync(join(root,'.ssh'));
      writeFileSync(join(root,'.ssh','id_rsa'),'PRIVATE');
      await assert.rejects(captureSelectedLocalBinding({resourceId:'ssh',kind:'FILE',
        absolutePath:join(root,'.ssh','id_rsa')}),{code:'SELECTED_FILE_DENIED'});
      await assert.rejects(captureSelectedLocalBinding({resourceId:'etc',kind:'FILE',
        absolutePath:'/etc/passwd'}),{code:'SELECTED_FILE_DENIED'});
      binding=null;
    }finally{usage.close();rmSync(root,{recursive:true,force:true});}
  });
