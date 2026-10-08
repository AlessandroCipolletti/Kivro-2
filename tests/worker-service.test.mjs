import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync,mkdtempSync,readFileSync,rmSync,symlinkSync,
  writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {installLaunchAgent,renderLaunchAgent} from
  '../tools/kivro-worker-service.mjs';

test('macOS LaunchAgent is private, restartable and has no inline credentials',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-worker-service-'));
  try{
    const paths={agentDirectory:join(root,'agents'),logDirectory:join(root,'logs'),
      environmentPath:join(root,'.env.local'),agentPath:join(root,'agents','ai.kivro.worker.plist'),
      stdoutPath:join(root,'logs','stdout.log'),stderrPath:join(root,'logs','stderr.log')};
    writeFileSync(paths.environmentPath,'KIVRO_CLOUD_URL=https://example.invalid\n',
      {mode:0o600});
    const installed=installLaunchAgent(paths);
    assert.equal(installed,paths.agentPath);
    const xml=readFileSync(installed,'utf8');
    assert.match(xml,/<key>KeepAlive<\/key><true\/>/);
    assert.match(xml,/<key>ThrottleInterval<\/key><integer>30<\/integer>/);
    assert.match(xml,/kivro-worker-run\.mjs/);
    assert.match(xml,/--env-file=/);
    assert.doesNotMatch(xml,/https:\/\/example\.invalid/);
    if(process.platform==='darwin')execFileSync('plutil',['-lint',installed]);
    chmodSync(paths.environmentPath,0o644);
    assert.throws(()=>installLaunchAgent(paths),/SERVICE_PRIVATE_ENV_REQUIRED/);
    rmSync(paths.environmentPath);
    symlinkSync(paths.stderrPath,paths.environmentPath);
    assert.throws(()=>installLaunchAgent(paths),/SERVICE_PRIVATE_ENV_REQUIRED/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('LaunchAgent XML safely escapes path characters',()=>{
  const xml=renderLaunchAgent({nodePath:'/tmp/node&tool',repositoryPath:'/tmp/owner<repo>',
    environmentPath:'/tmp/.env"local',stdoutPath:'/tmp/out',stderrPath:'/tmp/err'});
  assert.match(xml,/node&amp;tool/);
  assert.match(xml,/owner&lt;repo&gt;/);
  assert.match(xml,/.env&quot;local/);
  assert.doesNotMatch(xml,/owner<repo>/);
});
