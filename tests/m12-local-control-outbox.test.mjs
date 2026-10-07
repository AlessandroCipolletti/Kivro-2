import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerJobControl,newLocalJobCommand } from '../dist/apps/worker/src/job-control.js';
import { flushLocalJobControls } from '../dist/apps/worker/src/local-control-outbox.js';

test('confirmed offline CLI cancellation replays until cloud acknowledges, then stops',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'kivro-m12-outbox-'));
  const jobId=randomUUID(),executionId=randomUUID(),attemptId=randomUUID();
  let stopped=false,attempts=0;
  const docker={async status(){return stopped?'exited':'running';},
    async stop(){stopped=true;},async pause(){},async resume(){}};
  const control=new WorkerJobControl(directory,docker,{async check(){return {ready:true,
    checkedAt:new Date().toISOString(),blockingReasons:[]};}},
  {maxPauseDurationMs:60_000});
  try{
    control.register({jobId,executionId,attemptId,capabilityVersionId:randomUUID(),
      containerId:'a'.repeat(64),controlPlaneId:'m12-plane',pauseSupport:'NOT_SUPPORTED',
      leaseExpiresAt:new Date(Date.now()+60_000).toISOString()});
    control.markRunning(jobId);
    const command=newLocalJobCommand(jobId,'local:1000','CLI','Stop now');
    assert.equal((await control.cancel(command)).status,'CANCELLED');
    const sent=[];
    const transport={controlPlaneId:'m12-plane',async send(report){
      sent.push(report);attempts++;
      if(attempts===1)throw new Error('ACK_LOST');
    }};
    await assert.rejects(flushLocalJobControls(control,transport,randomUUID()),/ACK_LOST/);
    assert.equal(control.snapshot(jobId).cloudSyncPending,true);
    const workerId=randomUUID();
    assert.equal(await flushLocalJobControls(control,transport,workerId),1);
    assert.equal(sent[1].type,'LOCAL_JOB_CONTROL_REPORT');
    assert.equal(sent[1].commandId,command.id);
    assert.equal(sent[1].workerDeviceId,workerId);
    assert.equal(sent[1].status,'CANCELLED');
    assert.equal(control.snapshot(jobId).cloudSyncPending,false);
    assert.equal(await flushLocalJobControls(control,transport,workerId),0);
  }finally{control.close();rmSync(directory,{recursive:true,force:true});}
});
