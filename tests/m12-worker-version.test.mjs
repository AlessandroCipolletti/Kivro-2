import assert from 'node:assert/strict';
import test from 'node:test';
import { workerVersionStatus } from '../dist/packages/domain/src/worker-version.js';

test('worker version policy blocks known insecure and unknown releases',()=>{
  assert.equal(workerVersionStatus('1.4.1','1.4.2','1.4.3'),'SECURITY_UPDATE_REQUIRED');
  assert.equal(workerVersionStatus('1.4.2','1.4.2','1.4.3'),'UPDATE_RECOMMENDED');
  assert.equal(workerVersionStatus('1.4.3','1.4.2','1.4.3'),'SUPPORTED');
  assert.equal(workerVersionStatus('garbage','1.4.2','1.4.3'),'UNKNOWN');
  assert.equal(workerVersionStatus('1.4.3',null,'1.4.3'),'UNKNOWN');
});
