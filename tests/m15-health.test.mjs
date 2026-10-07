import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as live } from '../dist/apps/web/app/health/live/route.js';
import { GET as ready } from '../dist/apps/web/app/health/ready/route.js';

test('cloud liveness reveals no diagnostics and readiness fails closed without services',async()=>{
  const liveness=await live();
  assert.equal(liveness.status,200);
  assert.deepEqual(await liveness.json(),{status:'LIVE'});
  const readiness=await ready();
  assert.equal(readiness.status,503);
  assert.deepEqual(await readiness.json(),{status:'NOT_READY'});
  assert.equal(readiness.headers.get('cache-control'),'no-store');
});
