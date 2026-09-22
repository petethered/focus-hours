import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  localDateKey,
  dayCount,
  recordEvent,
  pruneHistory,
  summarize,
} from '../src/history.js';

const MONDAY = new Date(2026, 8, 21, 11, 0);
const TUESDAY = new Date(2026, 8, 22, 11, 0);

test('localDateKey pads month and day', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('recordEvent starts a day at 1', () => {
  const result = recordEvent({}, 'attempts', 'reddit.com', MONDAY);
  assert.equal(result.count, 1);
  assert.deepEqual(result.history, {
    '2026-09-21': { attempts: { 'reddit.com': 1 }, unblocks: {} },
  });
});

test('recordEvent increments without touching other sites, days or kinds', () => {
  const history = {
    '2026-09-21': { attempts: { 'reddit.com': 6, 'youtube.com': 2 }, unblocks: { 'reddit.com': 1 } },
  };
  const result = recordEvent(history, 'attempts', 'reddit.com', MONDAY);
  assert.equal(result.count, 7);
  assert.deepEqual(result.history['2026-09-21'], {
    attempts: { 'reddit.com': 7, 'youtube.com': 2 },
    unblocks: { 'reddit.com': 1 },
  });
  assert.equal(history['2026-09-21'].attempts['reddit.com'], 6, 'input is not mutated');
});

test('recordEvent keeps each day separate', () => {
  const monday = recordEvent({}, 'attempts', 'reddit.com', MONDAY).history;
  const both = recordEvent(monday, 'attempts', 'reddit.com', TUESDAY).history;
  assert.equal(both['2026-09-21'].attempts['reddit.com'], 1);
  assert.equal(both['2026-09-22'].attempts['reddit.com'], 1);
});

test('recordEvent records unblocks alongside attempts', () => {
  const attempted = recordEvent({}, 'attempts', 'reddit.com', MONDAY).history;
  const unblocked = recordEvent(attempted, 'unblocks', 'reddit.com', MONDAY).history;
  assert.deepEqual(unblocked['2026-09-21'], {
    attempts: { 'reddit.com': 1 },
    unblocks: { 'reddit.com': 1 },
  });
});

test('dayCount reads a single day without changing it', () => {
  const history = { '2026-09-21': { attempts: { 'reddit.com': 3 }, unblocks: {} } };
  assert.equal(dayCount(history, 'attempts', 'reddit.com', MONDAY), 3);
  assert.equal(dayCount(history, 'attempts', 'youtube.com', MONDAY), 0);
  assert.equal(dayCount(history, 'unblocks', 'reddit.com', MONDAY), 0);
  assert.equal(dayCount(history, 'attempts', 'reddit.com', TUESDAY), 0);
  assert.equal(dayCount(undefined, 'attempts', 'reddit.com', MONDAY), 0);
});

test('pruneHistory keeps the retention window and drops what falls out', () => {
  const history = {
    '2026-09-22': { attempts: { 'a.com': 1 }, unblocks: {} },
    '2026-09-20': { attempts: { 'a.com': 1 }, unblocks: {} },
    '2026-09-19': { attempts: { 'a.com': 1 }, unblocks: {} },
  };
  assert.deepEqual(Object.keys(pruneHistory(history, TUESDAY, 3)).sort(), [
    '2026-09-20',
    '2026-09-22',
  ]);
  assert.deepEqual(pruneHistory({}, TUESDAY, 3), {});
});

const RANGE_HISTORY = {
  '2026-09-18': { attempts: { 'reddit.com': 2 }, unblocks: {} },
  '2026-09-21': { attempts: { 'reddit.com': 6, 'youtube.com': 3 }, unblocks: { 'reddit.com': 1 } },
  '2026-09-22': { attempts: { 'youtube.com': 1 }, unblocks: { 'youtube.com': 2 } },
};

test('summarize returns one entry per day, including quiet ones', () => {
  const stats = summarize(RANGE_HISTORY, TUESDAY, 7);
  assert.equal(stats.series.length, 7);
  assert.deepEqual(
    stats.series.map((entry) => entry.date),
    ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'],
  );
  assert.deepEqual(
    stats.series.map((entry) => entry.total),
    [0, 0, 2, 0, 0, 9, 1],
  );
});

test('summarize counts totals, unblocks and today', () => {
  const stats = summarize(RANGE_HISTORY, TUESDAY, 7);
  assert.equal(stats.total, 12);
  assert.equal(stats.today, 1);
  assert.equal(stats.unblocks, 3);
  assert.deepEqual(stats.totals, { 'reddit.com': 8, 'youtube.com': 4 });
});

test('summarize orders sites by how often they were reached for', () => {
  const stats = summarize(RANGE_HISTORY, TUESDAY, 7);
  assert.deepEqual(stats.sites, ['reddit.com', 'youtube.com']);
  assert.deepEqual(stats.topSite, { site: 'reddit.com', count: 8 });
});

test('summarize averages over the days that had attempts', () => {
  const stats = summarize(RANGE_HISTORY, TUESDAY, 7);
  assert.equal(stats.average, 4); // 12 attempts across 3 active days
});

test('summarize names the busiest and quietest active days', () => {
  const stats = summarize(RANGE_HISTORY, TUESDAY, 7);
  assert.equal(stats.busiest.date, '2026-09-21');
  assert.equal(stats.busiest.total, 9);
  assert.equal(stats.quietest.date, '2026-09-22');
  assert.equal(stats.quietest.total, 1);
});

test('summarize ignores days outside the range', () => {
  const stats = summarize(RANGE_HISTORY, TUESDAY, 2);
  assert.equal(stats.total, 10);
  assert.equal(stats.unblocks, 3);
  assert.deepEqual(
    stats.series.map((entry) => entry.date),
    ['2026-09-21', '2026-09-22'],
  );
});

test('summarize copes with an empty history', () => {
  const stats = summarize({}, TUESDAY, 7);
  assert.equal(stats.total, 0);
  assert.equal(stats.today, 0);
  assert.equal(stats.average, 0);
  assert.equal(stats.topSite, null);
  assert.equal(stats.busiest, null);
  assert.equal(stats.quietest, null);
  assert.equal(stats.series.length, 7);
  assert.equal(summarize(undefined, TUESDAY, 7).total, 0);
});

test('summarize covers a single day of data, the first-day case', () => {
  const stats = summarize({ '2026-09-22': { attempts: { 'reddit.com': 4 }, unblocks: {} } }, TUESDAY, 14);
  assert.equal(stats.total, 4);
  assert.equal(stats.today, 4);
  assert.equal(stats.average, 4);
  assert.equal(stats.busiest.date, stats.quietest.date);
});
