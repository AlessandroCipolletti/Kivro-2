/* global AbortController, URL */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DockerSandboxAdapter,DockerJobControlAdapter } from
  '../dist/packages/sandbox-adapter/src/docker.js';
import { BrokerSidecar } from '../dist/apps/worker/src/broker-sidecar.js';
import { WorkerLocalInferenceUsage } from
  '../dist/apps/worker/src/local-inference-usage.js';
import { SellerCompletionBroker } from
  '../dist/packages/application/src/completion-broker.js';
import { LocalOpenAiCompatibleConnector } from
  '../dist/packages/infrastructure/adapters/src/local-openai-compatible.js';

test('pinned offline OpenClaw uses a host-side local model with durable quotas',
  {timeout:120_000},async()=>{
    const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
    const image=JSON.parse(execFileSync(docker,['image','inspect',
      'kivro-openclaw-runtime:m07','--format','{{json .RepoDigests}}'],
    {encoding:'utf8'})).find((value)=>value.startsWith(
      'kivro-openclaw-runtime@sha256:'));
    assert.ok(image);
    const root=mkdtempSync(join(tmpdir(),'kivro-local-docker-'));
    const jobId=randomUUID(),attemptId=randomUUID(),versionId=randomUUID();
    const input=join(root,attemptId,'input');
    mkdirSync(input,{recursive:true,mode:0o700});
    const config=JSON.parse(readFileSync(new URL('./fixtures/openclaw-m07-config.json',
      import.meta.url),'utf8'));
    config.agents.defaults.sandbox.docker.image=image;
    writeFileSync(join(input,'config.json'),JSON.stringify(config));
    writeFileSync(join(input,'message.txt'),
      'Submit answer "local-ready" using kivro_submit_result.');
    writeFileSync(join(input,'kivro-run.json'),JSON.stringify({version:1,
      modelRef:'kivro/broker',timeoutSeconds:40}));
    writeFileSync(join(input,'kivro-files.json'),JSON.stringify({version:1,
      inputs:[],maxOutputFileBytes:65536,maxToolCalls:64}));
    let modelCalls=0;
    const server=createServer((request,response)=>{
      response.setHeader('content-type','application/json');
      if(request.method==='GET'&&request.url==='/v1/models'){
        response.end(JSON.stringify({data:[{id:'broker'}]}));return;
      }
      if(request.method==='POST'&&request.url==='/v1/chat/completions'){
        modelCalls++;
        const first=modelCalls===1;
        response.end(JSON.stringify({id:randomUUID(),object:'chat.completion',
          created:Math.floor(Date.now()/1000),model:'broker',choices:[{
            index:0,finish_reason:first?'tool_calls':'stop',
            message:first?{role:'assistant',content:null,tool_calls:[{
              id:'call_local_result',type:'function',function:{
                name:'kivro_submit_result',arguments:JSON.stringify({fields:{
                  answer:{type:'SHORT_TEXT',value:'local-ready'}}})}}]}:
              {role:'assistant',content:'Submitted.'}}],
          usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16}}));return;
      }
      response.statusCode=404;response.end('{}');
    });
    await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
    const endpoint=`http://127.0.0.1:${server.address().port}/v1`;
    const connector=new LocalOpenAiCompatibleConnector('local',endpoint);
    const usage=new WorkerLocalInferenceUsage(root);
    const policy={providerId:'local',modelId:'broker',
      endpointRef:'dep:local-model',maxRequestsPerJob:4,
      maxInputTokensPerRequest:8192,maxOutputTokensPerRequest:2048,
      maxTokensPerJob:40_000,maxDailyJobs:10};
    const completion=new SellerCompletionBroker(null,connector,null,usage);
    const sidecar=new BrokerSidecar(docker,new DockerJobControlAdapter(docker),
      jobId,attemptId,async()=>{},async(request)=>{
        assert.equal(request.kind,'INFERENCE');
        return completion.invoke({jobId,capabilityVersionId:versionId,
          localInference:policy,allowedToolNames:['kivro_submit_result']},
        request.payload,request.id,new AbortController().signal);
      });
    const sandbox=new DockerSandboxAdapter({dockerExecutable:docker,
      approvedImage:image,collectorImage:image,attemptRoot:root});
    const contract={schemaVersion:1,fields:[{key:'answer',label:'Answer',
      order:0,required:true,type:'SHORT_TEXT'}]};
    try{
      await connector.checkModel('broker');
      const result=await sandbox.runWithOutputControlled({planVersion:1,image,
        networkMode:'none',readOnlyRoot:true,capDrop:['ALL'],
        noNewPrivileges:true,seccomp:'builtin',runAs:'65532:65532',
        maxRuntimeSeconds:60,memoryMb:1024,cpu:1,maxPids:128,
        maxOutputBytes:65536},attemptId,['run-job'],contract,
      {maxFileBytes:65536,maxResultBytes:65536},async(collected)=>{
        assert.equal(collected.values.answer,'local-ready');
      },{jobId,async onReady(){},async onStartPermitted(){},
        async onStarted(containerId){
          execFileSync(docker,['exec','--user=65532:65532',containerId,
            'node','-e',`fetch(${JSON.stringify(`${endpoint}/models`)},{signal:
              AbortSignal.timeout(800)}).then(()=>process.exit(17),()=>process.exit(0))`],
          {timeout:3_000});
          await sidecar.start(containerId);
        },
        async onWatchdogTick(){},
        async onStopped(){await sidecar.close();}});
      assert.equal(result.exitCode,0);
      assert.equal(modelCalls,2);
      assert.deepEqual(usage.summary(jobId),{requests:2,inputTokens:24,
        outputTokens:8,unsettled:0});
    }finally{
      await sidecar.close();usage.close();
      await new Promise((resolve)=>server.close(resolve));
      rmSync(root,{recursive:true,force:true});
    }
  });
