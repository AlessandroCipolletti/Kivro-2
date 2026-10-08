import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DockerSandboxAdapter} from
  '../dist/packages/sandbox-adapter/src/docker.js';

const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
function inventory(){return execFileSync(docker,['ps','-a','--filter',
  'name=kivro-sbx-','--format','{{.ID}}'],{encoding:'utf8'}).trim()
  .split('\n').filter(Boolean).sort();}

test('real pinned sandbox stops process-fanout and memory exhaustion at cgroup boundaries',
  {timeout:45_000},async()=>{
    // The OpenClaw runtime entrypoint intentionally rejects arbitrary shell
    // commands. This test-only derivative removes that entrypoint while keeping
    // the exact inspected runtime layers and the production Docker adapter.
    const base=JSON.parse(execFileSync(docker,['image','inspect',
      'kivro-openclaw-runtime:m07','--format','{{json .RepoDigests}}'],
    {encoding:'utf8'})).find((value)=>
      value.startsWith('kivro-openclaw-runtime@sha256:'));
    assert.ok(base);
    execFileSync(docker,['build','-f','tests/fixtures/m16-resource-probe/Dockerfile',
      '-t','kivro-m16-resource-probe:local','tests/fixtures/m16-resource-probe'],
    {stdio:'ignore',timeout:60_000});
    const image=JSON.parse(execFileSync(docker,['image','inspect',
      'kivro-m16-resource-probe:local','--format','{{json .RepoDigests}}'],
    {encoding:'utf8'})).find((value)=>
      value.startsWith('kivro-m16-resource-probe@sha256:'));
    assert.ok(image);
    const layers=(reference)=>JSON.parse(execFileSync(docker,['image','inspect',
      reference,'--format','{{json .RootFS.Layers}}'],{encoding:'utf8'}));
    assert.deepEqual(layers(image),layers(base),
      'test-only entrypoint change must preserve the pinned runtime filesystem');
    const root=mkdtempSync(join(tmpdir(),'kivro-m16-resource-limits-'));
    const adapter=new DockerSandboxAdapter({dockerExecutable:docker,
      approvedImage:image,attemptRoot:root});
    const plan={planVersion:1,image,networkMode:'none',readOnlyRoot:true,
      capDrop:['ALL'],noNewPrivileges:true,seccomp:'builtin',
      runAs:'65532:65532',maxRuntimeSeconds:12,memoryMb:128,cpu:1,
      maxPids:16,maxOutputBytes:4096};
    const before=inventory();
    const attempt=()=>{const id=randomUUID();mkdirSync(join(root,id,'input'),{
      recursive:true,mode:0o700});return id;};
    try{
      const fanout=`const {spawn}=require('node:child_process');(async()=>{
        let denied=0,completed=0;const wait=[];
        for(let i=0;i<80;i++){const child=spawn('/bin/sleep',['2']);
          wait.push(new Promise(resolve=>{child.once('error',error=>{
            if(error.code==='EAGAIN')denied++;else process.exitCode=3;
            resolve();});child.once('exit',()=>{completed++;resolve();});}));}
        await Promise.all(wait);console.log(JSON.stringify({denied,completed}));
      })().catch(()=>process.exit(4));`;
      const pids=await adapter.run(plan,attempt(),['node','-e',fanout]);
      assert.equal(pids.exitCode,0,pids.stderr);
      const count=JSON.parse(pids.stdout.trim());
      assert.ok(count.denied>0,'cgroup PID ceiling must reject process fanout');
      assert.ok(count.completed<80,'the sandbox cannot spawn the full attack');
      const allocation=`const bytes=Buffer.allocUnsafe(300*1024*1024);
        for(let i=0;i<bytes.length;i+=4096)bytes[i]=1;
        console.log('MEMORY_ESCAPE');`;
      const memory=await adapter.run(plan,attempt(),['node','-e',allocation]);
      assert.notEqual(memory.exitCode,0,'memory overrun must kill sandbox process');
      assert.doesNotMatch(memory.stdout,/MEMORY_ESCAPE/);
      assert.deepEqual(inventory(),before,'both hostile containers must be removed');
    }finally{rmSync(root,{recursive:true,force:true});}
  });
