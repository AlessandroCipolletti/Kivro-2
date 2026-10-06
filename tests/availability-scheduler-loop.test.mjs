import assert from 'node:assert/strict';
import test from 'node:test';
import { runAvailabilityScheduler } from '../dist/packages/application/src/scheduler-loop.js';

test('scheduler resumes persisted work after a transient failure and stops on abort', async () => {
  const controller=new globalThis.AbortController();
  let calls=0, failures=0;
  const run=runAvailabilityScheduler({signal:controller.signal,intervalMs:100,batchSize:3,
    repository:{async reconcile(limit){assert.equal(limit,3);calls++;
      if(calls===1) throw new Error('temporary database restart');
      controller.abort();return {checked:1,queued:1,waiting:0,expired:0};}},
    onError(){failures++;}});
  await run;
  assert.equal(calls,2);
  assert.equal(failures,1);
});
