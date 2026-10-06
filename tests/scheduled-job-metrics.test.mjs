import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { scheduledJobMetrics } from '../dist/packages/domain/src/scheduled-job-metrics.js';

test('seller delivery clock excludes scheduled availability wait', () => {
  const t={ jobId:randomUUID(),createdAt:'2026-10-07T12:00:00.000Z',
    executionMode:'EARLIEST_AVAILABLE',scheduledForEarliestAt:'2026-10-07T20:00:00.000Z',
    nextEligibleAt:'2026-10-07T20:00:00.000Z',eligibleAt:'2026-10-07T20:00:00.000Z',
    queuedAt:'2026-10-07T20:00:00.000Z',startedAt:'2026-10-07T20:10:00.000Z',
    deliveredAt:'2026-10-07T20:30:00.000Z',latestStartAt:'2026-10-08T20:00:00.000Z' };
  assert.deepEqual(scheduledJobMetrics(t),{availabilityWaitMs:8*3600000,
    eligibleToStartMs:10*60000,executionToDeliveryMs:20*60000,
    sellerEligibleToDeliveryMs:30*60000});
  assert.deepEqual(scheduledJobMetrics({...t,eligibleAt:null,queuedAt:null,
    startedAt:null,deliveredAt:null}),{availabilityWaitMs:null,eligibleToStartMs:null,
    executionToDeliveryMs:null,sellerEligibleToDeliveryMs:null});
});
