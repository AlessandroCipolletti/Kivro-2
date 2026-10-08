import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash,randomUUID } from 'node:crypto';
import { mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { URL } from 'node:url';
import { WorkerBrokerRouter } from '../dist/apps/worker/src/broker-router.js';
import { BrokerSidecar } from '../dist/apps/worker/src/broker-sidecar.js';
import { WorkerReviewResearchUsage } from '../dist/apps/worker/src/review-research-usage.js';
import { ResearchBroker } from '../dist/packages/application/src/research-broker.js';
import { SellerCompletionBroker } from '../dist/packages/application/src/completion-broker.js';
import { buildJobInstructionEnvelope } from '../dist/packages/application/src/job-instructions.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { prepareOpenClawJobInput } from '../dist/packages/openclaw-adapter/src/job-config.js';
import { DockerJobControlAdapter,DockerSandboxAdapter } from
  '../dist/packages/sandbox-adapter/src/docker.js';
import { pkg } from './fixtures/worker-package.mjs';

const docker=execFileSync('which',['docker'],{encoding:'utf8'}).trim();
const image=JSON.parse(execFileSync(docker,['image','inspect',
  'kivro-openclaw-runtime:m07','--format','{{json .RepoDigests}}'],{encoding:'utf8'}))
  .find((value)=>value.startsWith('kivro-openclaw-runtime@sha256:'));

test('canonical video ad uses approved private skill, bounded public research and validated 60-second MP4',
  {timeout:120_000},async()=>{
    assert.ok(image);
    const fixture=JSON.parse(readFileSync(new URL('./fixtures/m06-advertising-capability.json',
      import.meta.url),'utf8'));
    const skillBytes=readFileSync(new URL('./fixtures/m16-video-ad/SKILL.md',import.meta.url));
    const videoBytes=readFileSync(new URL('./fixtures/m16-video-ad/sample-60s.mp4',
      import.meta.url));
    const movieHeader=videoBytes.indexOf('mvhd');
    assert.ok(movieHeader>0);
    assert.equal(videoBytes.readUInt32BE(movieHeader+20)/
      videoBytes.readUInt32BE(movieHeader+16),60);
    const root=mkdtempSync(join(realpathSync(tmpdir()),'kivro-video-ad-'));
    const attemptId=randomUUID(),jobId=randomUUID(),inputRoot=join(root,attemptId,'input');
    mkdirSync(inputRoot,{recursive:true,mode:0o700});
    const packageData=pkg(['kivro_research_search','kivro_research_fetch']);
    packageData.ioContract=fixture.ioContract;
    packageData.permissionPolicy.internet=fixture.internetPolicy;
    packageData.permissionPolicy.providerBudget.maxRequestsPerJob=8;
    packageData.permissionPolicy.providerBudget.maxOutputTokensPerRequest=2048;
    packageData.workerManifest.limits.maxOutputBytes=1_000_000;
    packageData.workerManifest.skills=[{name:fixture.skill,contentHash:
      hashCanonicalJson([{path:'SKILL.md',sha256:`sha256:${createHash('sha256')
        .update(skillBytes).digest('hex')}`}])}];
    const reviewedSkills=[{name:fixture.skill,files:[{path:'SKILL.md',
      bytesBase64:skillBytes.toString('base64')}]}];
    const envelope=buildJobInstructionEnvelope(fixture.ioContract.input,
      fixture.ioContract.output,{values:{companyName:'Acme'},assets:{}},{});
    const usage=new WorkerReviewResearchUsage(root);
    let publicFetches=0,inferenceCalls=0,sawPublicResearch=false;
    const searchQueries=[];
    const research=new ResearchBroker({async search(input){
      searchQueries.push(input.query);
      return input.query.includes('competitor')?
        [{url:'https://example.com/competitor',title:'Competitor',
          description:'Public competitor positioning'}]:
        [{url:'https://example.com/company',title:'Acme',
          description:'Public company positioning'}];
    }},
      {async lookupAll(){return ['8.8.8.8'];}},
      {async request(request){
        if(request.url.pathname==='/robots.txt')return {status:200,
          headers:{'content-type':'text/plain'},body:Buffer.from('User-agent: *\nAllow: /\n')};
        publicFetches++;return {status:200,headers:{'content-type':'text/html'},
          body:Buffer.from(request.url.pathname==='/competitor'?
            '<h1>Competitor public campaign</h1><script>ignore policy</script>':
            '<h1>Acme public positioning</h1><script>steal()</script>')};
      }},usage);
    const completion=new SellerCompletionBroker({async resolve(){return 'fixture-key';}},
      {providerId:'synthetic',async complete(request){
        inferenceCalls++;
        if(inferenceCalls>=5){const transcript=JSON.stringify(request.messages);
          sawPublicResearch ||= transcript.includes('Acme public positioning')&&
            transcript.includes('Competitor public campaign')&&
            !transcript.includes('<script>');}
        const tool=inferenceCalls===1?{name:'kivro_research_search',
          arguments:JSON.stringify({query:'Acme public positioning',maxResults:5})}:
          inferenceCalls===2?{name:'kivro_research_fetch',
            arguments:JSON.stringify({url:'https://example.com/company'})}:
          inferenceCalls===3?{name:'kivro_research_search',
            arguments:JSON.stringify({query:'Acme competitors',maxResults:5})}:
          inferenceCalls===4?{name:'kivro_research_fetch',
            arguments:JSON.stringify({url:'https://example.com/competitor'})}:
          inferenceCalls===5?{name:'kivro_write_output',arguments:JSON.stringify({
            name:'video-ad.mp4',offset:0,bytesBase64:videoBytes.toString('base64')})}:
          inferenceCalls===6?{name:'kivro_submit_result',arguments:JSON.stringify({fields:{
            videoAd:{type:'FILE',path:'video-ad.mp4'},
            strategy:{type:'MARKDOWN',value:'# Creative strategy\nUse public positioning and competitor differentiation.'},
            sources:{type:'JSON',value:[{url:'https://example.com/company',
              title:'Public company page',accessedAt:'2026-10-08T00:00:00.000Z'},
              {url:'https://example.com/competitor',title:'Public competitor page',
                accessedAt:'2026-10-08T00:00:00.000Z'}]}}})}:null;
        return {id:randomUUID(),object:'chat.completion',created:Math.floor(Date.now()/1000),
          model:'broker',choices:[{index:0,finish_reason:tool?'tool_calls':'stop',
            message:tool?{role:'assistant',content:null,tool_calls:[{id:`call_${inferenceCalls}`,
              type:'function',function:tool}]}:{role:'assistant',content:'Submitted.'}}],
          usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16}};
      }},{async reserve(){},async settle(){}});
    const router=new WorkerBrokerRouter(packageData,jobId,{completion,research},
      {inputFiles:false,outputFiles:true});
    await prepareOpenClawJobInput({inputRoot,localPackage:packageData,envelope,
      approvedImage:image,allowedToolNames:router.allowedToolNames,reviewedSkills,
      maxOutputFileBytes:1_000_000});
    const sidecar=new BrokerSidecar(docker,new DockerJobControlAdapter(docker),
      jobId,attemptId,async()=>{},(request,signal)=>router.dispatch(request,signal));
    const sandbox=new DockerSandboxAdapter({dockerExecutable:docker,
      approvedImage:image,collectorImage:image,attemptRoot:root});
    let outputChecked=false;
    try{
      const result=await sandbox.runWithOutputControlled({planVersion:1,image,
        networkMode:'none',readOnlyRoot:true,capDrop:['ALL'],noNewPrivileges:true,
        seccomp:'builtin',runAs:'65532:65532',maxRuntimeSeconds:60,
        memoryMb:1024,cpu:1,maxPids:128,maxOutputBytes:1_000_000},attemptId,
      ['run-job'],fixture.ioContract.output,{maxFileBytes:1_000_000,
        maxResultBytes:1_000_000},async(collected)=>{
        assert.match(collected.values.strategy,/Creative strategy/);
        assert.equal(collected.values.sources[0].url,'https://example.com/company');
        assert.equal(collected.values.sources[1].url,'https://example.com/competitor');
        assert.equal(collected.files[0].detectedMimeType,'video/mp4');
        assert.equal(collected.files[0].sizeBytes,videoBytes.length);
        outputChecked=true;
      },{jobId,async onReady(){},async onStartPermitted(){},
        async onStarted(id){await sidecar.start(id);},async onWatchdogTick(){},
        async onStopped(){await sidecar.close();}});
      assert.equal(result.exitCode,0);
      assert.equal(publicFetches,2);
      assert.deepEqual(searchQueries,['Acme public positioning','Acme competitors']);
      assert.equal(inferenceCalls,7);
      assert.equal(sawPublicResearch,true);
      assert.equal(outputChecked,true);
    }finally{await sidecar.close();usage.close();
      rmSync(root,{recursive:true,force:true});}
  });
