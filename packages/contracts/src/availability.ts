import { z } from 'zod';
import { PriceSnapshotSchema } from './pricing.js';

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const localEndTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const timezone = z.string().min(1).max(120).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}, 'Invalid IANA timezone');

/** ISO weekday: Monday=1 through Sunday=7. An end before the start crosses midnight. */
export const WeeklyWindowSchema = z.strictObject({
  dayOfWeek: z.number().int().min(1).max(7),
  startLocalTime: localTime,
  endLocalTime: localEndTime,
});
export type WeeklyWindow = z.infer<typeof WeeklyWindowSchema>;

export function minuteOfDay(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function overlaps(windows: readonly WeeklyWindow[]): boolean {
  const occupied = new Uint8Array(7 * 1440);
  for (const window of windows) {
    const start = minuteOfDay(window.startLocalTime);
    const end = minuteOfDay(window.endLocalTime);
    if (end === start) return true;
    const duration = end > start ? end - start : end + 1440 - start;
    if (duration < 1 || duration > 1440) return true;
    for (let offset = 0; offset < duration; offset++) {
      const index = (((window.dayOfWeek - 1) * 1440 + start + offset) % occupied.length);
      if (occupied[index]) return true;
      occupied[index] = 1;
    }
  }
  return false;
}

export const AvailabilityScheduleSchema = z.strictObject({
  mode: z.enum(['ALWAYS_AVAILABLE', 'CUSTOM_SCHEDULE']),
  timezone,
  weeklyWindows: z.array(WeeklyWindowSchema).max(28),
}).superRefine((schedule, ctx) => {
  if (schedule.mode === 'ALWAYS_AVAILABLE' && schedule.weeklyWindows.length > 0) {
    ctx.addIssue({ code: 'custom', message: 'Always available has no windows' });
  }
  for (let day = 1; day <= 7; day++) {
    if (schedule.weeklyWindows.filter((window) => window.dayOfWeek === day).length > 4) {
      ctx.addIssue({ code: 'custom', message: 'At most four windows per day' });
    }
  }
  if (overlaps(schedule.weeklyWindows)) {
    ctx.addIssue({ code: 'custom', message: 'Overlapping windows are ambiguous' });
  }
});
export type AvailabilitySchedule = z.infer<typeof AvailabilityScheduleSchema>;

export const AvailabilityPolicySchema = z.strictObject({
  schedule: AvailabilityScheduleSchema.nullable(), // null inherits the Worker schedule.
  concurrencyLimit: z.number().int().min(1).max(64),
  queueLimit: z.number().int().min(0).max(64),
  futureReservationLimit: z.number().int().min(0).max(64),
  estimatedRuntimeSeconds: z.number().int().min(60).max(86_400).nullable(),
  maxWaitSeconds: z.number().int().min(60).max(7 * 86_400),
});
export type AvailabilityPolicy = z.infer<typeof AvailabilityPolicySchema>;

export const ExecutionPreferenceSchema = z.enum(['IMMEDIATE_ONLY', 'EARLIEST_AVAILABLE']);
export type ExecutionPreference = z.infer<typeof ExecutionPreferenceSchema>;
export const AvailabilityStatusSchema = z.enum([
  'ONLINE', 'BUSY', 'SCHEDULED_OFFLINE', 'OFFLINE', 'PAUSED', 'READINESS_BLOCKED',
  'UNAVAILABLE',
]);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;

export const PublicAvailabilitySchema = z.strictObject({
  status: AvailabilityStatusSchema,
  scheduleOpen: z.boolean(),
  workerReachable: z.boolean(),
  readinessReady: z.boolean(),
  acceptingImmediate: z.boolean(),
  acceptingQueue: z.boolean(),
  canSchedule: z.boolean(),
  nextAvailableAt: z.iso.datetime().nullable(),
  maintenanceUntil: z.iso.datetime().nullable().optional(),
  nextScheduleWindowAt: z.iso.datetime().nullable(),
  reason: z.enum(['NONE', 'NOT_VISIBLE', 'NOT_PUBLISHED', 'SELLER_PAUSED', 'PLATFORM_BLOCKED',
    'SCHEDULE_CLOSED', 'WORKER_OFFLINE', 'READINESS_STALE', 'DEPENDENCY_BLOCKED',
    'CAPACITY_FULL', 'QUEUE_FULL', 'NO_FUTURE_WINDOW', 'RECONCILIATION_PENDING']),
});
export type PublicAvailability = z.infer<typeof PublicAvailabilitySchema>;

export const ScheduleQuoteSchema = z.strictObject({
  id: z.uuid(),
  buyerAccountId: z.uuid(),
  capabilityId: z.uuid(),
  capabilityVersionId: z.uuid(),
  executionMode: ExecutionPreferenceSchema,
  price: PriceSnapshotSchema,
  workerStateAtQuote: z.enum(['ONLINE','BUSY','OFFLINE','PAUSED','READINESS_BLOCKED']),
  startIsGuaranteed: z.literal(false),
  earliestEligibleAt: z.iso.datetime(),
  windowStartAt: z.iso.datetime(),
  latestStartAt: z.iso.datetime(),
  quoteExpiresAt: z.iso.datetime(),
  capabilityScheduleRevision: z.number().int().positive(),
  workerScheduleRevision: z.number().int().positive(),
  estimatedStartAt: z.iso.datetime().nullable(),
  estimatedDeliveryAt: z.iso.datetime().nullable(),
});
export type ScheduleQuote = z.infer<typeof ScheduleQuoteSchema>;

export const ScheduledJobTimingSchema = z.strictObject({
  jobId: z.uuid(),
  createdAt: z.iso.datetime(),
  executionMode: ExecutionPreferenceSchema,
  scheduledForEarliestAt: z.iso.datetime(),
  nextEligibleAt: z.iso.datetime(),
  eligibleAt: z.iso.datetime().nullable(),
  queuedAt: z.iso.datetime().nullable(),
  startedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  latestStartAt: z.iso.datetime(),
});
export type ScheduledJobTiming = z.infer<typeof ScheduledJobTimingSchema>;
