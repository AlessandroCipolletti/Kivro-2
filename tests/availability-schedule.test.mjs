import assert from 'node:assert/strict';
import test from 'node:test';
import { AvailabilityScheduleSchema } from '../dist/packages/contracts/src/availability.js';
import { isInsideSchedule, nextScheduleWindow, previewScheduleWindows } from
  '../dist/packages/domain/src/availability-schedule.js';

const zurich = { mode: 'CUSTOM_SCHEDULE', timezone: 'Europe/Zurich',
  weeklyWindows: [{ dayOfWeek: 1, startLocalTime: '20:00', endLocalTime: '07:00' }] };

test('IANA weekly overnight membership and next window are exact UTC instants', () => {
  assert.equal(isInsideSchedule(zurich, '2026-10-05T17:59:00.000Z'), false);
  assert.equal(isInsideSchedule(zurich, '2026-10-05T18:00:00.000Z'), true);
  assert.equal(isInsideSchedule(zurich, '2026-10-06T04:59:00.000Z'), true);
  assert.equal(isInsideSchedule(zurich, '2026-10-06T05:00:00.000Z'), false);
  assert.deepEqual(nextScheduleWindow(zurich, '2026-10-05T12:00:00.000Z'), {
    startAt: '2026-10-05T18:00:00.000Z', endAt: '2026-10-06T05:00:00.000Z',
    localDate: '2026-10-05', timezone: 'Europe/Zurich' });
});

test('seller-local wall time follows spring gap and autumn repeated hour', () => {
  const sunday = { mode: 'CUSTOM_SCHEDULE', timezone: 'Europe/Zurich',
    weeklyWindows: [{ dayOfWeek: 7, startLocalTime: '01:30', endLocalTime: '03:30' }] };
  assert.deepEqual(nextScheduleWindow(sunday, '2026-03-28T20:00:00.000Z'), {
    startAt: '2026-03-29T00:30:00.000Z', endAt: '2026-03-29T01:30:00.000Z',
    localDate: '2026-03-29', timezone: 'Europe/Zurich' });
  assert.deepEqual(nextScheduleWindow(sunday, '2026-10-24T20:00:00.000Z'), {
    startAt: '2026-10-24T23:30:00.000Z', endAt: '2026-10-25T02:30:00.000Z',
    localDate: '2026-10-25', timezone: 'Europe/Zurich' });
  assert.equal(isInsideSchedule(sunday, '2026-10-25T00:15:00.000Z'), true);
  assert.equal(isInsideSchedule(sunday, '2026-10-25T01:15:00.000Z'), true);
});

test('New York wall-clock windows survive both US DST boundaries', () => {
  const sunday={ mode:'CUSTOM_SCHEDULE',timezone:'America/New_York',
    weeklyWindows:[{dayOfWeek:7,startLocalTime:'01:30',endLocalTime:'03:30'}] };
  assert.deepEqual(nextScheduleWindow(sunday,'2026-03-08T00:00:00.000Z'),{
    startAt:'2026-03-08T06:30:00.000Z',endAt:'2026-03-08T07:30:00.000Z',
    localDate:'2026-03-08',timezone:'America/New_York'});
  assert.deepEqual(nextScheduleWindow(sunday,'2026-11-01T00:00:00.000Z'),{
    startAt:'2026-11-01T05:30:00.000Z',endAt:'2026-11-01T06:00:00.000Z',
    localDate:'2026-11-01',timezone:'America/New_York'});
  assert.deepEqual(nextScheduleWindow(sunday,'2026-11-01T06:00:00.000Z'),{
    startAt:'2026-11-01T06:30:00.000Z',endAt:'2026-11-01T08:30:00.000Z',
    localDate:'2026-11-01',timezone:'America/New_York'});
});

test('all-day adjacent windows preview by local calendar day across DST', () => {
  const allDays = { mode: 'CUSTOM_SCHEDULE', timezone: 'Europe/Zurich',
    weeklyWindows: Array.from({ length: 7 }, (_, index) => ({ dayOfWeek: index + 1,
      startLocalTime: '00:00', endLocalTime: '24:00' })) };
  const windows = previewScheduleWindows(allDays, '2026-10-24T20:00:00.000Z', 3);
  assert.equal(windows.length, 3);
  assert.equal((Date.parse(windows[1].endAt)-Date.parse(windows[1].startAt))/3600_000, 25);
});

test('schedule input rejects bad zone, overlapping or ambiguous windows and unbounded days', () => {
  assert.throws(() => AvailabilityScheduleSchema.parse({ ...zurich, timezone: 'UTC+2' }));
  assert.throws(() => AvailabilityScheduleSchema.parse({ ...zurich, weeklyWindows: [
    { dayOfWeek: 1, startLocalTime: '20:00', endLocalTime: '07:00' },
    { dayOfWeek: 2, startLocalTime: '06:30', endLocalTime: '09:00' },
  ] }));
  assert.throws(() => AvailabilityScheduleSchema.parse({ ...zurich, weeklyWindows: [
    { dayOfWeek: 1, startLocalTime: '20:00', endLocalTime: '20:00' },
  ] }));
  assert.throws(() => AvailabilityScheduleSchema.parse({ ...zurich, weeklyWindows: Array.from(
    { length: 5 }, (_, index) => ({ dayOfWeek: 1, startLocalTime: `0${index}:00`,
      endLocalTime: `0${index}:30` })) }));
});
