import { AvailabilityScheduleSchema, minuteOfDay,
  type AvailabilitySchedule, type WeeklyWindow } from '../../contracts/src/availability.js';

const MS_MINUTE = 60_000;
const MAX_SCAN_MINUTES = 15 * 24 * 60;
const weekdays: Readonly<Record<string, number>> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};
const formatters = new Map<string, Intl.DateTimeFormat>();

type LocalMinute = { date: string; dayOfWeek: number; minute: number };
type Occurrence = { key: string; localDate: string; window: WeeklyWindow | null };
export interface UtcWindow {
  readonly startAt: string;
  readonly endAt: string;
  readonly localDate: string;
  readonly timezone: string;
}

function formatter(timezone: string): Intl.DateTimeFormat {
  let value = formatters.get(timezone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
      hour: '2-digit', minute: '2-digit' });
    formatters.set(timezone, value);
  }
  return value;
}

function localAt(timestamp: number, timezone: string): LocalMinute {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(new Date(timestamp))
    .map((part) => [part.type, part.value]));
  const weekday = weekdays[parts.weekday ?? ''];
  const hour = Number(parts.hour); const minute = Number(parts.minute);
  if (!weekday || !Number.isInteger(hour) || !Number.isInteger(minute) ||
    !parts.year || !parts.month || !parts.day) throw new Error('INVALID_LOCAL_TIME');
  return { date: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek: weekday, minute: hour * 60 + minute };
}

function previousDate(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function occurrenceAt(schedule: AvailabilitySchedule, timestamp: number): Occurrence | null {
  const local = localAt(timestamp, schedule.timezone);
  if (schedule.mode === 'ALWAYS_AVAILABLE') {
    return { key: `${local.date}:always`, localDate: local.date, window: null };
  }
  for (const [index, window] of schedule.weeklyWindows.entries()) {
    const start = minuteOfDay(window.startLocalTime);
    const end = minuteOfDay(window.endLocalTime);
    if (window.dayOfWeek === local.dayOfWeek && local.minute >= start &&
      (end > start ? local.minute < end : true)) {
      return { key: `${local.date}:${index}`, localDate: local.date, window };
    }
    const previousWeekday = local.dayOfWeek === 1 ? 7 : local.dayOfWeek - 1;
    if (end <= start && window.dayOfWeek === previousWeekday && local.minute < end) {
      const date = previousDate(local.date);
      return { key: `${date}:${index}`, localDate: date, window };
    }
  }
  return null;
}

function minuteFloor(timestamp: number): number {
  return Math.floor(timestamp / MS_MINUTE) * MS_MINUTE;
}

function segmentBounds(schedule: AvailabilitySchedule, point: number,
  occurrence: Occurrence): UtcWindow {
  let start = minuteFloor(point);
  for (let i = 0; i < 27 * 60; i++) {
    const previous = occurrenceAt(schedule, start - MS_MINUTE);
    if (!previous || previous.key !== occurrence.key) break;
    start -= MS_MINUTE;
  }
  let end = minuteFloor(point) + MS_MINUTE;
  for (let i = 0; i < 27 * 60; i++) {
    const next = occurrenceAt(schedule, end);
    if (!next || next.key !== occurrence.key) break;
    end += MS_MINUTE;
  }
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(),
    localDate: occurrence.localDate, timezone: schedule.timezone };
}

/** Membership is evaluated from UTC instants in the seller's IANA zone. Skipped wall minutes
 * never exist; repeated fall-back minutes are eligible on both occurrences. */
export function isInsideSchedule(input: AvailabilitySchedule, at: Date | string): boolean {
  const schedule = AvailabilityScheduleSchema.parse(input);
  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError('INVALID_INSTANT');
  return occurrenceAt(schedule, timestamp) !== null;
}

/** Returns a real UTC segment, not a guessed fixed-offset conversion. */
export function nextScheduleWindow(input: AvailabilitySchedule, after: Date | string,
  includeCurrent = true, horizonDays = 14): UtcWindow | null {
  const schedule = AvailabilityScheduleSchema.parse(input);
  const timestamp = new Date(after).getTime();
  if (!Number.isFinite(timestamp) || !Number.isSafeInteger(horizonDays) ||
    horizonDays < 1 || horizonDays > 14) throw new RangeError('INVALID_WINDOW_HORIZON');
  if (schedule.mode === 'CUSTOM_SCHEDULE' && schedule.weeklyWindows.length === 0) return null;
  const origin = minuteFloor(timestamp);
  let skippedKey: string | null = null;
  for (let i = 0; i <= Math.min(MAX_SCAN_MINUTES, horizonDays * 1440); i++) {
    const candidateAt = origin + i * MS_MINUTE;
    const occurrence = occurrenceAt(schedule, candidateAt);
    if (i === 0 && occurrence && !includeCurrent) {
      skippedKey = occurrence.key;
    }
    if (skippedKey && occurrence?.key === skippedKey) {
      continue;
    }
    skippedKey = null;
    if (occurrence) {
      const bounds = segmentBounds(schedule, candidateAt, occurrence);
      if (Date.parse(bounds.endAt) > timestamp &&
        (includeCurrent || Date.parse(bounds.startAt) > timestamp)) return bounds;
    }
  }
  return null;
}

export function previewScheduleWindows(schedule: AvailabilitySchedule, after: Date | string,
  count: number): readonly UtcWindow[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 28) throw new RangeError('INVALID_PREVIEW_COUNT');
  const result: UtcWindow[] = [];
  let cursor = new Date(after).getTime();
  for (let index = 0; index < count; index++) {
    const next = nextScheduleWindow(schedule, new Date(cursor), true);
    if (!next) break;
    result.push(next);
    cursor = Date.parse(next.endAt);
  }
  return result;
}
