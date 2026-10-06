import assert from 'node:assert/strict';
import test from 'node:test';
import { applyJobTransition, initialJobLifecycle } from '../dist/packages/domain/src/job-lifecycle.js';

const jobId = 'b3451661-a538-4907-8acc-b1cf00e04899';
const attemptId = '48ed805a-d11a-4f3a-a601-35014a39e810';
const reservationId = '76a985b7-5132-4f9e-ae97-64018021d7b1';
const resultId = '12e59250-8afc-4ab9-9189-f41c4cfdc8c9';
const eventIds = [jobId, attemptId, reservationId, resultId,
  '38512236-0583-4a24-93e0-0ef0249e9ab8', '1793f95e-091c-45bf-8c75-0887df5d6a39',
  '57887a53-0350-4f8f-9c88-b58518f5028e', 'd9af2ae9-0f02-43f4-8062-ae5c2f542177'];

function event(from, to, index, actor = 'CLOUD', overrides = {}) {
  return {
    id: eventIds[index], jobId, from, to, at: `2026-10-06T12:00:0${index}Z`,
    actor, reason: `transition-${index}`, attemptId: null, correlationId: jobId,
    paymentReservationId: null, resultManifestId: null, ...overrides,
  };
}

test('payment and cloud-finalization evidence gate the legal happy-path reducer', () => {
  let job = initialJobLifecycle(jobId);
  assert.throws(() => applyJobTransition(job, event('CREATED', 'QUEUED', 0)), { code: 'FORBIDDEN_TRANSITION' });
  assert.throws(() => applyJobTransition(job, event('CREATED', 'PAYMENT_RESERVED', 0, 'PAYMENT')), { code: 'MISSING_EVIDENCE' });
  const reserve = event('CREATED', 'PAYMENT_RESERVED', 0, 'PAYMENT', { paymentReservationId: reservationId });
  job = applyJobTransition(job, reserve);
  assert.equal(applyJobTransition(job, reserve), job);
  job = applyJobTransition(job, event('PAYMENT_RESERVED', 'QUEUED', 1));
  job = applyJobTransition(job, event('QUEUED', 'DISPATCHED', 2, 'CLOUD', { attemptId }));
  job = applyJobTransition(job, event('DISPATCHED', 'ACCEPTED', 3, 'WORKER', { attemptId }));
  job = applyJobTransition(job, event('ACCEPTED', 'STARTING', 4, 'WORKER', { attemptId }));
  job = applyJobTransition(job, event('STARTING', 'RUNNING', 5, 'WORKER', { attemptId }));
  job = applyJobTransition(job, event('RUNNING', 'UPLOADING_RESULT', 6, 'WORKER', { attemptId }));
  assert.throws(() => applyJobTransition(job, event('UPLOADING_RESULT', 'COMPLETED', 7, 'WORKER', { resultManifestId: resultId })), { code: 'MISSING_EVIDENCE' });
  job = applyJobTransition(job, event('UPLOADING_RESULT', 'COMPLETED', 7, 'CLOUD', { resultManifestId: resultId }));
  assert.equal(job.status, 'COMPLETED');
  assert.equal(job.transitions.length, 8);
  assert.ok(Object.isFrozen(job.transitions));
  assert.throws(() => applyJobTransition(job, event('COMPLETED', 'QUEUED', 0, 'CLOUD', {
    id: '62939296-d665-40c0-a364-ab250cbf9312',
  })), { code: 'FORBIDDEN_TRANSITION' });
});

test('cancellation winning the state race prevents later delivery', () => {
  let job = initialJobLifecycle(jobId);
  job = applyJobTransition(job, event('CREATED', 'PAYMENT_RESERVED', 0, 'PAYMENT', { paymentReservationId: reservationId }));
  job = applyJobTransition(job, event('PAYMENT_RESERVED', 'QUEUED', 1));
  job = applyJobTransition(job, event('QUEUED', 'DISPATCHED', 2, 'CLOUD', { attemptId }));
  job = applyJobTransition(job, event('DISPATCHED', 'CANCEL_REQUESTED', 3, 'BUYER', { attemptId }));
  assert.throws(() => applyJobTransition(job, event('CANCEL_REQUESTED', 'COMPLETED', 4, 'CLOUD', { resultManifestId: resultId })), { code: 'FORBIDDEN_TRANSITION' });
  job = applyJobTransition(job, event('CANCEL_REQUESTED', 'CANCELLED', 4, 'CLOUD', { attemptId }));
  assert.equal(job.status, 'CANCELLED');
});

test('duplicate event IDs with altered effects are rejected', () => {
  const job = applyJobTransition(initialJobLifecycle(jobId), event('CREATED', 'PAYMENT_RESERVED', 0, 'PAYMENT', { paymentReservationId: reservationId }));
  assert.throws(() => applyJobTransition(job, event('CREATED', 'PAYMENT_RESERVED', 0, 'PAYMENT', { paymentReservationId: resultId })), { code: 'CONFLICT' });
});

test('an accepted running job needs Worker stop evidence before CANCELLED', () => {
  let job = initialJobLifecycle(jobId);
  job = applyJobTransition(job, event('CREATED', 'PAYMENT_RESERVED', 0, 'PAYMENT', { paymentReservationId: reservationId }));
  job = applyJobTransition(job, event('PAYMENT_RESERVED', 'QUEUED', 1));
  job = applyJobTransition(job, event('QUEUED', 'DISPATCHED', 2, 'CLOUD', { attemptId }));
  job = applyJobTransition(job, event('DISPATCHED', 'ACCEPTED', 3, 'WORKER', { attemptId }));
  job = applyJobTransition(job, event('ACCEPTED', 'CANCEL_REQUESTED', 4, 'BUYER', { attemptId }));
  assert.throws(() => applyJobTransition(job, event('CANCEL_REQUESTED', 'CANCELLED', 5, 'CLOUD',
    { attemptId })), { code: 'FORBIDDEN_TRANSITION' });
  job = applyJobTransition(job, event('CANCEL_REQUESTED', 'CANCELLED', 5, 'WORKER', { attemptId }));
  assert.equal(job.status, 'CANCELLED');
});
