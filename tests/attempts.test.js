import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, attemptCount, recordAttempt } from '../src/attempts.js';

const MONDAY = new Date(2026, 8, 21, 11, 0);
const TUESDAY = new Date(2026, 8, 22, 11, 0);

test('localDateKey pads month and day', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('recordAttempt starts at 1 with no prior data', () => {
  assert.deepEqual(recordAttempt(null, 'reddit.com', MONDAY), {
    attempts: { date: '2026-09-21', counts: { 'reddit.com': 1 } },
    count: 1,
  });
});

test('recordAttempt increments on the same day and leaves other sites alone', () => {
  const prior = { date: '2026-09-21', counts: { 'reddit.com': 6, 'youtube.com': 2 } };
  const result = recordAttempt(prior, 'reddit.com', MONDAY);
  assert.equal(result.count, 7);
  assert.deepEqual(result.attempts.counts, { 'reddit.com': 7, 'youtube.com': 2 });
  assert.equal(prior.counts['reddit.com'], 6, 'input is not mutated');
});

test('recordAttempt resets counts on a new day', () => {
  const prior = { date: '2026-09-21', counts: { 'reddit.com': 6, 'youtube.com': 2 } };
  assert.deepEqual(recordAttempt(prior, 'reddit.com', TUESDAY), {
    attempts: { date: '2026-09-22', counts: { 'reddit.com': 1 } },
    count: 1,
  });
});

test('attemptCount reads today\'s count without changing it', () => {
  const attempts = { date: '2026-09-21', counts: { 'reddit.com': 3 } };
  assert.equal(attemptCount(attempts, 'reddit.com', MONDAY), 3);
  assert.equal(attemptCount(attempts, 'youtube.com', MONDAY), 0);
});

test('attemptCount is 0 for a stale day or missing data', () => {
  assert.equal(attemptCount({ date: '2026-09-21', counts: { 'reddit.com': 3 } }, 'reddit.com', TUESDAY), 0);
  assert.equal(attemptCount(null, 'reddit.com', MONDAY), 0);
});
