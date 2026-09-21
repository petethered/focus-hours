import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeUnblocks,
  computeBlockedSet,
  nextWakeTime,
  buildRedirectRules,
  tabRedirect,
} from '../src/enforcement.js';
import { buildBlockedUrl } from '../src/blockedUrl.js';

const BASE = 'chrome-extension://abc/src/blocked/blocked.html';
const SETTINGS = {
  sites: ['reddit.com', 'youtube.com'],
  schedule: { days: [1, 2, 3, 4, 5], start: '10:00', end: '16:00' },
  message: 'Back to work.',
};
const MONDAY_NOON = new Date(2026, 8, 21, 12, 0);
const MONDAY_EVENING = new Date(2026, 8, 21, 18, 0);
const inMinutes = (date, minutes) => date.getTime() + minutes * 60_000;

test('activeUnblocks drops expired entries', () => {
  const unblocks = { 'reddit.com': inMinutes(MONDAY_NOON, 5), 'youtube.com': inMinutes(MONDAY_NOON, -1) };
  assert.deepEqual(activeUnblocks(unblocks, MONDAY_NOON), { 'reddit.com': unblocks['reddit.com'] });
});

test('computeBlockedSet blocks every site inside the window', () => {
  assert.deepEqual(computeBlockedSet(SETTINGS, {}, MONDAY_NOON), ['reddit.com', 'youtube.com']);
});

test('computeBlockedSet skips actively unblocked sites', () => {
  const unblocks = { 'reddit.com': inMinutes(MONDAY_NOON, 5) };
  assert.deepEqual(computeBlockedSet(SETTINGS, unblocks, MONDAY_NOON), ['youtube.com']);
});

test('computeBlockedSet ignores expired unblocks', () => {
  const unblocks = { 'reddit.com': inMinutes(MONDAY_NOON, -5) };
  assert.deepEqual(computeBlockedSet(SETTINGS, unblocks, MONDAY_NOON), ['reddit.com', 'youtube.com']);
});

test('computeBlockedSet is empty outside the window', () => {
  assert.deepEqual(computeBlockedSet(SETTINGS, {}, MONDAY_EVENING), []);
});

test('nextWakeTime is the next boundary with no unblocks', () => {
  assert.equal(nextWakeTime(SETTINGS, {}, MONDAY_NOON), new Date(2026, 8, 21, 16, 0).getTime());
});

test('nextWakeTime prefers an earlier unblock expiry', () => {
  const unblocks = { 'reddit.com': inMinutes(MONDAY_NOON, 10) };
  assert.equal(nextWakeTime(SETTINGS, unblocks, MONDAY_NOON), inMinutes(MONDAY_NOON, 10));
});

test('nextWakeTime is null with no days and no unblocks', () => {
  const noDays = { ...SETTINGS, schedule: { ...SETTINGS.schedule, days: [] } };
  assert.equal(nextWakeTime(noDays, {}, MONDAY_NOON), null);
});

test('buildRedirectRules creates one main-frame redirect per domain', () => {
  assert.deepEqual(buildRedirectRules(['reddit.com'], BASE), [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: `${BASE}?site=reddit.com&url=\\1` },
      },
      condition: {
        regexFilter: '^(.*)$',
        requestDomains: ['reddit.com'],
        resourceTypes: ['main_frame'],
      },
    },
  ]);
  assert.deepEqual(buildRedirectRules(['a.com', 'b.com'], BASE).map((rule) => rule.id), [1, 2]);
});

test('tabRedirect sweeps a tab on a blocked site, keeping title and url', () => {
  const tab = { url: 'https://www.reddit.com/r/cats', title: 'r/cats' };
  assert.equal(
    tabRedirect(tab, ['reddit.com'], BASE),
    buildBlockedUrl(BASE, { site: 'reddit.com', url: tab.url, title: 'r/cats', swept: true }),
  );
});

test('tabRedirect leaves unrelated tabs alone', () => {
  assert.equal(tabRedirect({ url: 'https://example.com/', title: 'x' }, ['reddit.com'], BASE), null);
  assert.equal(tabRedirect({}, ['reddit.com'], BASE), null);
});

test('tabRedirect keeps a block page whose site is still blocked', () => {
  const url = buildBlockedUrl(BASE, { site: 'reddit.com', url: 'https://reddit.com/' });
  assert.equal(tabRedirect({ url }, ['reddit.com'], BASE), null);
});

test('tabRedirect restores a block page whose site is no longer blocked', () => {
  const original = 'https://www.youtube.com/watch?v=abc&t=30';
  const url = buildBlockedUrl(BASE, { site: 'youtube.com', url: original, swept: true, title: 'Video' });
  assert.equal(tabRedirect({ url }, ['reddit.com'], BASE), original);
});

test('tabRedirect refuses to restore to a non-http url', () => {
  const url = `${BASE}?site=reddit.com&url=javascript:alert(1)`;
  assert.equal(tabRedirect({ url }, [], BASE), null);
});
