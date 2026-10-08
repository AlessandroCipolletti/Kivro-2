import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {WorkerReviewResearchUsage} from
  '../dist/apps/worker/src/review-research-usage.js';
import {WorkerResourceUsage} from '../dist/apps/worker/src/resource-ports.js';

test('review research is durable, budgeted, replay-safe and blocked by private reads',async()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-review-research-'));
  const jobId=randomUUID(),capabilityVersionId=randomUUID();
  let usage=new WorkerReviewResearchUsage(root);
  const local=new WorkerResourceUsage(root);
  const base={jobId,capabilityVersionId,operation:'FETCH',host:'example.com',
    queryHash:null,byteReservation:100,maxTotalBytes:200,maxQueries:1,
    maxPages:2,maxDownloads:1,maxDownloadsBytes:100,maxConcurrent:1,
    maxPerHost:2,maxDurationMs:60_000};
  const requestId=randomUUID();
  try{
    await usage.begin({...base,requestId});
    await assert.rejects(usage.begin({...base,requestId}),
      /NETWORK_POLICY_DENIED/);
    await assert.rejects(usage.markPrivateResourceRead(jobId,capabilityVersionId),
      /NETWORK_POLICY_DENIED/);
    await usage.finish({requestId,bytes:12,contentType:'text/plain',
      status:200,blockedReason:null});
    usage.close();
    usage=new WorkerReviewResearchUsage(root);
    await usage.markPrivateResourceRead(jobId,capabilityVersionId);
    await local.markPrivateResourceRead(jobId,capabilityVersionId);
    await assert.rejects(usage.begin({...base,requestId:randomUUID()}),
      /NETWORK_POLICY_DENIED/);
    await assert.rejects(usage.finish({requestId,bytes:12,
      contentType:'text/plain',status:200,blockedReason:null}),
    /NETWORK_POLICY_DENIED/);
  }finally{usage.close();local.close();rmSync(root,{recursive:true,force:true});}
});
