import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { BrokerSidecar } from '../dist/apps/worker/src/broker-sidecar.js';
import { WorkerBrokerRouter } from '../dist/apps/worker/src/broker-router.js';
import { WorkerResourceUsage, createWorkerResourcePorts } from
  '../dist/apps/worker/src/resource-ports.js';
import { captureSelectedLocalBinding } from
  '../dist/apps/worker/src/selected-local-file.js';
import { DockerJobControlAdapter } from
  '../dist/packages/sandbox-adapter/src/docker.js';
import { pkg } from './fixtures/worker-package.mjs';

const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
const image='kivro-openclaw-runtime:m07';
const execAsync=promisify(execFile);

test('real offline Docker/OpenClaw bridge can read only the seller-approved file via Worker',
  {timeout:60_000},async()=>{
    const root=mkdtempSync(join(realpathSync(tmpdir()),'kivro-selected-docker-'));
    const selected=join(root,'selected.txt'),privatePath=join(root,'private.txt');
    writeFileSync(selected,'APPROVED DATASET',{mode:0o600});
    writeFileSync(privatePath,'PRIVATE SECRET',{mode:0o600});
    const binding=await captureSelectedLocalBinding({resourceId:'dataset',
      kind:'FILE',absolutePath:selected});
    const packageData=pkg(['kivro_selected_file_read']);
    packageData.permissionPolicy.publicInternet='DENY';
    delete packageData.permissionPolicy.internet;
    packageData.selectedLocalBindings=[binding];
    packageData.permissionPolicy.selectedFileResourceIds=['dataset'];
    packageData.workerManifest.resources=[{id:'dataset',type:'selected-file',
      permissions:['READ']}];
    packageData.dependencyGraph.nodes.push({...packageData.dependencyGraph.nodes[0],
      id:'dataset',type:'LOCAL_FILE',selected:true});
    const usage=new WorkerResourceUsage(root);
    const ports=createWorkerResourcePorts(packageData,{async resolve(){throw Error('NO_SECRET');}},usage);
    const jobId=randomUUID(),attemptId=randomUUID();
    const router=new WorkerBrokerRouter(packageData,jobId,{completion:{},...ports});
    const id=execFileSync(docker,['create','--pull=never','--network=none','--read-only',
      '--cap-drop=ALL','--security-opt=no-new-privileges:true',
      '--security-opt=seccomp=builtin','--user=65532:65532','--pids-limit=32',
      '--memory=256m','--cpus=1',`--label=kivro.job-id=${jobId}`,
      `--label=kivro.attempt-id=${attemptId}`,'--entrypoint=/bin/sleep',image,'60'],
    {encoding:'utf8'}).trim();
    const sidecar=new BrokerSidecar(docker,new DockerJobControlAdapter(docker),
      jobId,attemptId,async()=>{},(request,signal)=>router.dispatch(request,signal));
    const invoke=(input)=>`fetch('http://127.0.0.1:8787/broker/selected-file/read',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(${JSON.stringify(input)})}).then(async r=>
      console.log(JSON.stringify({status:r.status,body:await r.json()})))`;
    try{
      execFileSync(docker,['start',id]);
      await sidecar.start(id);
      const request={resourceId:'dataset',fileId:binding.files[0].fileId,
        offset:0,length:65_536};
      const run=async(input)=>JSON.parse((await execAsync(docker,
        ['exec',id,'node','-e',invoke(input)],{encoding:'utf8',timeout:10_000})).stdout);
      const result=await run(request);
      assert.equal(result.status,200);
      assert.equal(Buffer.from(result.body.bytesBase64,'base64').toString(),'APPROVED DATASET');
      assert.equal(JSON.stringify(result).includes(selected),false);
      assert.equal((await run({...request,fileId:'../private.txt'})).status,403);
      assert.equal((await run({...request,resourceId:'private'})).status,403);
      const writeAttempt=execFileSync(docker,['exec',id,'node','-e',
        `fetch('http://127.0.0.1:8787/broker/selected-file/read',{
          method:'PUT',headers:{'content-type':'application/json'},body:'{}'})
          .then(r=>process.stdout.write(String(r.status)))`],{encoding:'utf8'});
      assert.equal(writeAttempt,'403','the bridge must expose no mutation route');
      const direct=execFileSync(docker,['exec',id,'node','-e',
        `const fs=require('node:fs');process.stdout.write(String(fs.existsSync(process.argv[1])))`,
        selected],{encoding:'utf8'});
      assert.equal(direct,'false','the seller filesystem must not be mounted');
      rmSync(selected);
      symlinkSync(privatePath,selected);
      assert.equal((await run(request)).status,403,'a changed symlink must fail closed');
    }finally{await sidecar.close();execFileSync(docker,['rm','-f',id]);
      usage.close();rmSync(root,{recursive:true,force:true});}
  });
