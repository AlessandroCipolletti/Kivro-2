import { z } from 'zod';
import {
  JobLifecycleSchema, JobTransitionSchema,
  type JobStatus, type JobTransition,
} from '../../contracts/src/job-lifecycle.js';
import { canonicalJson } from '../../contracts/src/canonical-json.js';

const allowed: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  CREATED: ['PAYMENT_RESERVED', 'CANCELLED', 'EXPIRED'],
  PAYMENT_RESERVED: ['QUEUED', 'CANCELLED', 'EXPIRED'],
  QUEUED: ['DISPATCHED', 'WAITING_FOR_WORKER', 'CANCELLED', 'EXPIRED'],
  WAITING_FOR_WORKER: ['QUEUED', 'CANCELLED', 'EXPIRED', 'WORKER_OFFLINE'],
  DISPATCHED: ['ACCEPTED', 'QUEUED', 'REJECTED', 'CANCEL_REQUESTED', 'EXPIRED', 'WORKER_OFFLINE'],
  ACCEPTED: ['STARTING', 'CANCEL_REQUESTED', 'FAILED_POLICY', 'WORKER_OFFLINE'],
  STARTING: ['RUNNING', 'FAILED_STARTUP', 'FAILED_POLICY', 'CANCEL_REQUESTED', 'TIMED_OUT'],
  RUNNING: ['UPLOADING_RESULT', 'FAILED_EXECUTION', 'FAILED_POLICY', 'CANCEL_REQUESTED', 'TIMED_OUT'],
  UPLOADING_RESULT: ['COMPLETED', 'RESULT_REJECTED', 'CANCEL_REQUESTED', 'TIMED_OUT'],
  CANCEL_REQUESTED: ['CANCELLED', 'TIMED_OUT'],
  COMPLETED: [], REJECTED: [], EXPIRED: [], CANCELLED: [], FAILED_STARTUP: [],
  FAILED_POLICY: [], FAILED_EXECUTION: [], TIMED_OUT: [], WORKER_OFFLINE: [], RESULT_REJECTED: [],
};

export class JobTransitionError extends Error {
  constructor(readonly code: 'INVALID_EVENT' | 'CONFLICT' | 'FORBIDDEN_TRANSITION' | 'MISSING_EVIDENCE') {
    super(code);
    this.name = 'JobTransitionError';
  }
}

export interface JobLifecycleView {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly transitions: readonly Readonly<JobTransition>[];
}

export function initialJobLifecycle(jobId: string): JobLifecycleView {
  return Object.freeze({ jobId: z.uuid().parse(jobId), status: 'CREATED', transitions: Object.freeze([]) });
}

/** Pure transition reducer. M07 must call this inside an atomic durable transaction. */
export function applyJobTransition(current: JobLifecycleView, input: unknown): JobLifecycleView {
  const event = JobTransitionSchema.safeParse(input);
  if (!event.success) throw new JobTransitionError('INVALID_EVENT');
  const lifecycle = JobLifecycleSchema.parse(current);
  const transition = event.data;
  if (transition.jobId !== lifecycle.jobId) throw new JobTransitionError('CONFLICT');
  const duplicate = lifecycle.transitions.find((existing) => existing.id === transition.id);
  if (duplicate) {
    if (canonicalJson(duplicate) === canonicalJson(transition)) return current;
    throw new JobTransitionError('CONFLICT');
  }
  if (transition.from !== lifecycle.status || !allowed[lifecycle.status].includes(transition.to)) {
    throw new JobTransitionError('FORBIDDEN_TRANSITION');
  }
  const previous = lifecycle.transitions.at(-1);
  if (previous && Date.parse(transition.at) < Date.parse(previous.at)) throw new JobTransitionError('CONFLICT');
  if (transition.to === 'PAYMENT_RESERVED' &&
    (transition.actor !== 'PAYMENT' || transition.paymentReservationId === null)) {
    throw new JobTransitionError('MISSING_EVIDENCE');
  }
  if (transition.to === 'COMPLETED' &&
    (transition.actor !== 'CLOUD' || transition.resultManifestId === null)) {
    throw new JobTransitionError('MISSING_EVIDENCE');
  }
  if (['QUEUED', 'DISPATCHED'].includes(transition.to) && transition.actor !== 'CLOUD') {
    throw new JobTransitionError('FORBIDDEN_TRANSITION');
  }
  if (['DISPATCHED', 'ACCEPTED', 'STARTING', 'RUNNING', 'UPLOADING_RESULT'].includes(transition.to) &&
    transition.attemptId === null) {
    throw new JobTransitionError('MISSING_EVIDENCE');
  }
  if (transition.to === 'CANCEL_REQUESTED' &&
    !['BUYER', 'SELLER', 'CLOUD'].includes(transition.actor)) {
    throw new JobTransitionError('FORBIDDEN_TRANSITION');
  }
  return Object.freeze({
    jobId: lifecycle.jobId,
    status: transition.to,
    transitions: Object.freeze([...lifecycle.transitions, Object.freeze(transition)]),
  });
}
