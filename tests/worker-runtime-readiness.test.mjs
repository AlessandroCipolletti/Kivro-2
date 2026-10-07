import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerRuntimeReadiness } from
  '../dist/apps/worker/src/runtime-readiness.js';
import { WorkerCapabilityPackageStore } from
  '../dist/apps/worker/src/capability-package-store.js';
import { WorkerImportReviewOutbox } from
  '../dist/apps/worker/src/import-review-outbox.js';
import { WorkerProviderUsage } from
  '../dist/apps/worker/src/provider-usage.js';
import { WorkerLocalState } from '../dist/apps/worker/src/local-state.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { fixtureParts } from './seller-publication-contract.test.mjs';

test('paid Worker readiness requires the exact sent review, credential and approved images',
  async()=>{
    const root=mkdtempSync(join(tmpdir(),'kivro-runtime-ready-'));
    const seller=randomUUID(),{pkg,review,skills}=fixtureParts();
    const packages=new WorkerCapabilityPackageStore(root);
    const reviews=new WorkerImportReviewOutbox(root);
    const usage=new WorkerProviderUsage(root);
    const local=new WorkerLocalState(root,{check:async()=>({ready:false,
      checkedAt:new Date().toISOString(),blockingReasons:['TEST']})});
    const image=`kivro-openclaw-runtime@sha256:${'a'.repeat(64)}`;
    const collector=image;
    let credential=true,imageAvailable=true,occupied=false,providerPublic=true;
    const deps={deviceId:pkg.workerDeviceId,
      sellerAccountId:seller,packages,reviews,usage,localState:local,
      vault:{async exists(){return credential;}},
      imageApproval:{async assertApprovedImage(){if(!imageAvailable)throw Error('IMAGE_MISSING');
        return {openClawVersion:'2026.8.2'};}},
      approvedImage:image,collectorImage:collector,
      checkProviderDestination:async()=>{if(!providerPublic)throw Error('PRIVATE_DNS');},
      jobControl:{snapshots(){return occupied?[{capabilityVersionId:pkg.capabilityVersionId,
        status:'RUNNING'}]:[];}}};
    const readiness=new WorkerRuntimeReadiness(deps);
    try{
      packages.installReviewed(pkg,{actorId:'local:seller',
        approvedAt:review.tests.testedAt,
        reviewEvidenceHash:hashCanonicalJson(review.tests)},skills);
      reviews.record(review,seller,'https://api.example.com/v1');
      assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false,
        'a review that Cloud has not acknowledged cannot admit paid work');
      reviews.markSent(pkg.capabilityVersionId,seller);
      const ready=await readiness.check(pkg.capabilityVersionId);
      assert.equal(ready.ready,true);
      assert.equal(ready.sandboxVerified,true);
      assert.ok(ready.policyValidationHash);
      assert.equal((await new WorkerRuntimeReadiness({...deps,
        collectorImage:`kivro-output-collector@sha256:${'b'.repeat(64)}`})
        .check(pkg.capabilityVersionId)).ready,false,
      'the output collector must use the approved runtime digest');
      credential=false;
      assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false);
      credential=true;imageAvailable=false;
      assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false);
      imageAvailable=true;providerPublic=false;
      assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false);
      providerPublic=true;occupied=true;
      assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false,
        'a capability at its concurrency ceiling cannot admit a second job');
      occupied=false;
      local.pauseAll('local:seller','LOCAL_CLI','emergency');
      assert.equal((await readiness.check(pkg.capabilityVersionId)).ready,false,
        'local emergency pause cannot be bypassed by a stale cloud offer');
      assert.equal((await readiness.check(randomUUID())).ready,false);
    }finally{packages.close();reviews.close();usage.close();local.close();
      rmSync(root,{recursive:true,force:true});}
  });
