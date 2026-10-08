import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRequiredExecutionHealth } from '../dist/packages/domain/src/worker-operational-health.js';

const healthy = [
  { code: 'DEVICE_IDENTITY', state: 'HEALTHY' },
  { code: 'DOCKER_DAEMON', state: 'HEALTHY' },
  { code: 'APPROVED_SANDBOX_IMAGE', state: 'HEALTHY' },
  { code: 'SANDBOX_SELF_TEST', state: 'HEALTHY' },
];

test('paid dispatch requires complete positive signed operational health', () => {
  assert.equal(hasRequiredExecutionHealth(healthy), true);
  assert.equal(hasRequiredExecutionHealth(null), false);
  assert.equal(hasRequiredExecutionHealth([...healthy,
    {code:'DOCKER_DAEMON',state:'BLOCKING'}]),false,
  'contradictory signed checks cannot be interpreted optimistically');
  for (const check of healthy) {
    assert.equal(hasRequiredExecutionHealth(healthy.filter((item) => item !== check)), false);
    assert.equal(hasRequiredExecutionHealth(healthy.map((item) => item === check ?
      { ...item, state: 'UNKNOWN' } : item)), false);
    assert.equal(hasRequiredExecutionHealth(healthy.map((item) => item === check ?
      { ...item, state: 'BLOCKING' } : item)), false);
  }
});
