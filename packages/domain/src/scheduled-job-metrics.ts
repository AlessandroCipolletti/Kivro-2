import { ScheduledJobTimingSchema, type ScheduledJobTiming } from
  '../../contracts/src/availability.js';

/** Metrics use execution eligibility/start, never scheduled purchase time as seller runtime. */
export function scheduledJobMetrics(raw: ScheduledJobTiming): {
  availabilityWaitMs: number | null;
  eligibleToStartMs: number | null;
  executionToDeliveryMs: number | null;
  sellerEligibleToDeliveryMs: number | null;
} {
  const t=ScheduledJobTimingSchema.parse(raw);
  const diff=(end: string|null,start: string|null): number|null => {
    if (!end||!start) return null;
    const value=Date.parse(end)-Date.parse(start);
    if (value<0) throw new RangeError('INCONSISTENT_JOB_TIMING');
    return value;
  };
  return { availabilityWaitMs:diff(t.eligibleAt,t.createdAt),
    eligibleToStartMs:diff(t.startedAt,t.eligibleAt),
    executionToDeliveryMs:diff(t.deliveredAt,t.startedAt),
    sellerEligibleToDeliveryMs:diff(t.deliveredAt,t.eligibleAt) };
}
