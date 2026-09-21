import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTime,
  timeOnDate,
  isBlockedNow,
  nextBoundary,
  validateSchedule,
} from '../src/schedule.js';

const WORK_HOURS = { days: [1, 2, 3, 4, 5], start: '10:00', end: '16:00' };
const at = (day, hour, minute = 0, second = 0) => new Date(2026, 8, day, hour, minute, second);

test('parseTime converts HH:MM to minutes since midnight', () => {
  assert.equal(parseTime('00:00'), 0);
  assert.equal(parseTime('10:30'), 630);
  assert.equal(parseTime('16:00'), 960);
});

test('timeOnDate places the time on the same local day', () => {
  assert.deepEqual(timeOnDate('16:00', at(21, 9, 15)), at(21, 16, 0));
});

test('isBlockedNow is true inside the window on a scheduled day', () => {
  assert.equal(isBlockedNow(WORK_HOURS, at(21, 12)), true);
});

test('isBlockedNow includes the start minute', () => {
  assert.equal(isBlockedNow(WORK_HOURS, at(21, 10, 0)), true);
});

test('isBlockedNow excludes the end minute', () => {
  assert.equal(isBlockedNow(WORK_HOURS, at(21, 15, 59, 59)), true);
  assert.equal(isBlockedNow(WORK_HOURS, at(21, 16, 0)), false);
});

test('isBlockedNow is false just before start', () => {
  assert.equal(isBlockedNow(WORK_HOURS, at(21, 9, 59, 59)), false);
});

test('isBlockedNow is false on unscheduled days', () => {
  assert.equal(isBlockedNow(WORK_HOURS, at(26, 12)), false); // Saturday
  assert.equal(isBlockedNow(WORK_HOURS, at(27, 12)), false); // Sunday
});

test('nextBoundary before the window is today\'s start', () => {
  assert.deepEqual(nextBoundary(WORK_HOURS, at(21, 8)), at(21, 10));
});

test('nextBoundary inside the window is today\'s end', () => {
  assert.deepEqual(nextBoundary(WORK_HOURS, at(21, 12)), at(21, 16));
});

test('nextBoundary exactly at start is strictly later (today\'s end)', () => {
  assert.deepEqual(nextBoundary(WORK_HOURS, at(21, 10)), at(21, 16));
});

test('nextBoundary after Friday\'s end is Monday\'s start', () => {
  assert.deepEqual(nextBoundary(WORK_HOURS, at(25, 16, 30)), at(28, 10));
});

test('nextBoundary with a single day wraps a full week', () => {
  const wednesdays = { days: [3], start: '10:00', end: '16:00' };
  assert.deepEqual(nextBoundary(wednesdays, at(23, 17)), at(30, 10));
});

test('nextBoundary returns null when no days are scheduled', () => {
  assert.equal(nextBoundary({ days: [], start: '10:00', end: '16:00' }, at(21, 8)), null);
});

test('validateSchedule accepts the default schedule', () => {
  assert.equal(validateSchedule(WORK_HOURS), null);
});

test('validateSchedule rejects no days', () => {
  assert.match(validateSchedule({ ...WORK_HOURS, days: [] }), /at least one day/);
});

test('validateSchedule rejects missing times', () => {
  assert.match(validateSchedule({ ...WORK_HOURS, start: '' }), /start and end time/);
});

test('validateSchedule rejects start not before end', () => {
  assert.match(validateSchedule({ ...WORK_HOURS, start: '16:00' }), /before end/);
  assert.match(validateSchedule({ ...WORK_HOURS, start: '17:00' }), /before end/);
});
