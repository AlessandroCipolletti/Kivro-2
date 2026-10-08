import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { BrokerSidecar } from '../dist/apps/worker/src/broker-sidecar.js';
import { DockerJobControlAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';
import {WorkerBrokerRouter} from '../dist/apps/worker/src/broker-router.js';
import {WorkerReviewResearchUsage} from '../dist/apps/worker/src/review-research-usage.js';
import {ResearchBroker} from '../dist/packages/application/src/research-broker.js';
import {pkg} from './fixtures/worker-package.mjs';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'kivro-openclaw-runtime:m07';
const execFileAsync = promisify(execFile);

test('offline sandbox reaches only the authenticated Worker broker sidecar', async () => {
  const jobId = randomUUID(), attemptId = randomUUID();
  const id = execFileSync(docker, ['create', '--pull=never', '--network=none', '--read-only',
    '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--security-opt=seccomp=builtin',
    '--user=65532:65532', '--pids-limit=32', '--memory=256m', '--cpus=1',
    `--label=kivro.job-id=${jobId}`, `--label=kivro.attempt-id=${attemptId}`,
    '--entrypoint=/bin/sleep', image, '60'], { encoding: 'utf8' }).trim();
  const control = new DockerJobControlAdapter(docker);
  let permitted = true, calls = 0;
  const sidecar = new BrokerSidecar(docker, control, jobId, attemptId,
    async () => { if (!permitted) throw new Error('LEASE_OR_JOB_NOT_ACTIVE'); },
    async (request) => {
      calls++;
      assert.equal(request.kind, 'RESEARCH_SEARCH');
      return { results: [{ title: 'bounded' }] };
    });
  try {
    execFileSync(docker, ['start', id]);
    await sidecar.start(id);
    assert.equal(sidecar.healthy, true);
    const invoke = `fetch('http://127.0.0.1:8787/broker/research/search', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'public'})}).then(async r=>console.log(JSON.stringify({status:r.status,body:await r.json()})))`;
    const first = JSON.parse((await execFileAsync(docker, ['exec', id, 'node', '-e', invoke],
      { encoding: 'utf8', timeout: 10_000 })).stdout);
    assert.equal(first.status, 200);
    assert.equal(first.body.results[0].title, 'bounded');
    for (const route of ['/broker/control/schedule', '/broker/control/resume',
      '/broker/control/concurrency', '/seller/operations/capability/pause']) {
      const status = Number((await execFileAsync(docker, ['exec', id, 'node', '-e',
        `fetch('http://127.0.0.1:8787${route}',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>process.stdout.write(String(r.status)))`],
      { encoding: 'utf8', timeout: 10_000 })).stdout);
      assert.equal(status, 403, `sandbox broker exposed operational route ${route}`);
    }
    permitted = false;
    const denied = JSON.parse((await execFileAsync(docker, ['exec', id, 'node', '-e', invoke],
      { encoding: 'utf8', timeout: 10_000 })).stdout);
    assert.equal(denied.status, 403);
    assert.equal(calls, 1);
    const internet = execFileSync(docker, ['exec', id, 'node', '-e',
      `fetch('https://example.com',{signal:AbortSignal.timeout(1000)}).then(()=>process.stdout.write('LEAK'),()=>process.stdout.write('DENIED'))`],
      { encoding: 'utf8', timeout: 5_000 });
    assert.equal(internet, 'DENIED');
  } finally {
    await sidecar.close();
    execFileSync(docker, ['rm', '-f', id]);
  }
});

test('offline Docker research tool uses the bounded review broker and blocks private destinations',async()=>{
  const jobId=randomUUID(),attemptId=randomUUID();
  const root=mkdtempSync(join(tmpdir(),'kivro-docker-research-'));
  const usage=new WorkerReviewResearchUsage(root);
  const packageData=pkg(['kivro_research_fetch']);
  packageData.permissionPolicy.internet.search.enabled=false;
  packageData.permissionPolicy.internet.fetch.enabled=true;
  packageData.permissionPolicy.internet.fetch.maxPagesPerJob=3;
  packageData.permissionPolicy.internet.fetch.maxResponseBytes=4096;
  packageData.permissionPolicy.internet.fetch.allowedContentTypes=['text/html'];
  packageData.permissionPolicy.internet.limits.maxNetworkBytesPerJob=100_000;
  let outbound=0;
  const research=new ResearchBroker({async search(){throw Error('SEARCH_DENIED');}},
    {async lookupAll(){return ['8.8.8.8'];}},
    {async request(input){
      if(input.url.pathname==='/robots.txt')return {status:200,
        headers:{'content-type':'text/plain'},body:Buffer.from('User-agent: KivroResearch\nDisallow: /hidden\n')};
      outbound++;return {status:200,
      headers:{'content-type':'text/html'},
      body:Buffer.from('<h1>Public company</h1><script>secret()</script>')};}},usage);
  const router=new WorkerBrokerRouter(packageData,jobId,{completion:{},research});
  const id=execFileSync(docker,['create','--pull=never','--network=none',
    '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true',
    '--security-opt=seccomp=builtin','--user=65532:65532','--pids-limit=32',
    '--memory=256m','--cpus=1',`--label=kivro.job-id=${jobId}`,
    `--label=kivro.attempt-id=${attemptId}`,'--entrypoint=/bin/sleep',
    image,'60'],{encoding:'utf8'}).trim();
  const control=new DockerJobControlAdapter(docker);
  const sidecar=new BrokerSidecar(docker,control,jobId,attemptId,
    async()=>undefined,(request,signal)=>router.dispatch(request,signal));
  try{
    execFileSync(docker,['start',id]);await sidecar.start(id);
    const invoke=(url)=>`fetch('http://127.0.0.1:8787/broker/research/fetch',
      {method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({url:${JSON.stringify(url)}})})
      .then(async r=>console.log(JSON.stringify({status:r.status,body:await r.json()})))`;
    const publicPage=JSON.parse((await execFileAsync(docker,['exec',id,'node','-e',
      invoke('https://example.com/')],{encoding:'utf8',timeout:10_000})).stdout);
    assert.equal(publicPage.status,200);
    assert.match(publicPage.body.text,/Public company/);
    assert.doesNotMatch(JSON.stringify(publicPage.body),/secret\(\)|<script>/);
    const restricted=JSON.parse((await execFileAsync(docker,['exec',id,'node','-e',
      invoke('https://example.com/hidden')],{encoding:'utf8',timeout:10_000})).stdout);
    assert.equal(restricted.status,403);
    assert.equal(restricted.body.error.code,'SOURCE_UNAVAILABLE',
      'a blocked source reaches OpenClaw as a sanitized limitation');
    assert.equal(outbound,1,'robots denial occurs before the page request');
    const privatePage=JSON.parse((await execFileAsync(docker,['exec',id,'node','-e',
      invoke('http://169.254.169.254/latest')],
    {encoding:'utf8',timeout:10_000})).stdout);
    assert.notEqual(privatePage.status,200);
    assert.equal(outbound,1);
    await usage.markPrivateResourceRead(jobId,packageData.capabilityVersionId);
    const afterPrivate=JSON.parse((await execFileAsync(docker,['exec',id,'node','-e',
      invoke('https://example.com/again')],
    {encoding:'utf8',timeout:10_000})).stdout);
    assert.notEqual(afterPrivate.status,200);
    assert.equal(outbound,1);
  }finally{await sidecar.close();usage.close();
    execFileSync(docker,['rm','-f',id]);rmSync(root,{recursive:true,force:true});}
});
