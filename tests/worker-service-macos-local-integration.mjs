import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir,userInfo} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import {renderLaunchAgent} from '../tools/kivro-worker-service.mjs';

test('macOS launchd keeps a private user agent alive without a terminal',
  {skip:process.platform!=='darwin'||process.env.M16_LAUNCHD!=='1'},async()=>{
    const root=mkdtempSync(join(tmpdir(),'kivro-m16-launchd-'));
    const name=`ai.kivro.worker.m16.${randomUUID()}`;
    const domain=`gui/${userInfo().uid}`,target=`${domain}/${name}`;
    const script=join(root,'probe.mjs'),heartbeat=join(root,'heartbeat');
    const environment=join(root,'.env.local'),plist=join(root,'probe.plist');
    writeFileSync(environment,`M16_HEARTBEAT=${heartbeat}\n`,{mode:0o600});
    writeFileSync(script,`import {writeFileSync} from 'node:fs';\n`+
      `setInterval(()=>writeFileSync(process.env.M16_HEARTBEAT,`+
      `String(Date.now())),150);\n`,{mode:0o600});
    writeFileSync(plist,renderLaunchAgent({nodePath:process.execPath,
      repositoryPath:root,environmentPath:environment,
      stdoutPath:join(root,'stdout.log'),stderrPath:join(root,'stderr.log'),
      serviceLabel:name,entrypointPath:script}),{mode:0o600});
    let bootstrapped=false;
    try{
      execFileSync('plutil',['-lint',plist]);
      execFileSync('launchctl',['bootstrap',domain,plist],{timeout:10_000});
      bootstrapped=true;
      let first=null;
      for(let attempt=0;attempt<60;attempt++){
        if(existsSync(heartbeat)){first=Number(readFileSync(heartbeat,'utf8'));break;}
        await delay(100);
      }
      assert.ok(first&&Number.isFinite(first),'launchd should start the detached process');
      execFileSync('launchctl',['print',target],{timeout:10_000});
      await delay(450);
      assert.ok(Number(readFileSync(heartbeat,'utf8'))>first,
        'launchd agent should stay alive after bootstrap returns');
      execFileSync('launchctl',['bootout',target],{timeout:10_000});
      bootstrapped=false;
      const stopped=Number(readFileSync(heartbeat,'utf8'));
      await delay(450);
      assert.equal(Number(readFileSync(heartbeat,'utf8')),stopped,
        'bootout should stop the detached process');
    }finally{
      if(bootstrapped){try{execFileSync('launchctl',['bootout',target],
        {timeout:10_000});}catch{/* best-effort cleanup */}}
      rmSync(root,{recursive:true,force:true});
    }
  });
