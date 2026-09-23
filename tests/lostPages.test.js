import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, mergeLostPages, reopenTarget, LOST_PAGE_LIMIT } from '../src/lostPages.js';
import { buildBlockedUrl } from '../src/blockedUrl.js';

const BASE = 'chrome-extension://abc/src/blocked/blocked.html';
const THREAD = 'https://www.reddit.com/r/programming/comments/abc/tabs/';
const VIDEO = 'https://www.youtube.com/watch?v=abc';

const record = (url, site, title = '') => ({ url, site, title, at: 1790000000000 });
const blockTab = (id, url, site) => ({ id, url: buildBlockedUrl(BASE, { site, url }) });

test('reconcile keeps records whose block page is still open', () => {
  const records = { 7: record(THREAD, 'reddit.com') };
  const result = reconcile(records, [blockTab(7, THREAD, 'reddit.com')], BASE);
  assert.deepEqual(result.active, records);
  assert.deepEqual(result.lost, []);
});

test('reconcile reports the record whose page nothing is showing', () => {
  const records = { 7: record(THREAD, 'reddit.com'), 9: record(VIDEO, 'youtube.com') };
  const result = reconcile(records, [blockTab(9, VIDEO, 'youtube.com')], BASE);
  assert.deepEqual(Object.keys(result.active), ['9']);
  assert.deepEqual(result.lost, [records[7]]);
});

test('reconcile follows a page into the tab that now shows it', () => {
  // The browser came back with the block page under a new tab id: nothing lost.
  const records = { 7: record(THREAD, 'reddit.com') };
  const result = reconcile(records, [blockTab(31, THREAD, 'reddit.com')], BASE);
  assert.deepEqual(result.lost, []);
  assert.deepEqual(result.active, { 31: records[7] });
});

test('reconcile does not trust a reused tab id', () => {
  // Tab 7 exists again after a restart, but it is showing something else.
  const records = { 7: record(THREAD, 'reddit.com') };
  const result = reconcile(records, [{ id: 7, url: 'https://example.com/' }], BASE);
  assert.deepEqual(result.active, {});
  assert.deepEqual(result.lost, [records[7]]);
});

test('reconcile counts nothing lost when the page itself is open', () => {
  // The tab was restored to the site before we could drop the record.
  const records = { 7: record(THREAD, 'reddit.com') };
  const result = reconcile(records, [{ id: 7, url: THREAD }], BASE);
  assert.deepEqual(result.active, {});
  assert.deepEqual(result.lost, []);
});

test('reconcile reports a page when no tab shows it at all', () => {
  const records = { 7: record(THREAD, 'reddit.com') };
  const tabs = [{ id: 3, url: 'https://example.com/' }, { id: 4 }];
  assert.deepEqual(reconcile(records, tabs, BASE).lost, [records[7]]);
});

test('reconcile handles an empty record set', () => {
  assert.deepEqual(reconcile({}, [blockTab(1, THREAD, 'reddit.com')], BASE), { active: {}, lost: [] });
});

test('mergeLostPages appends without duplicating a page', () => {
  const existing = [record(THREAD, 'reddit.com')];
  const merged = mergeLostPages(existing, [record(THREAD, 'reddit.com'), record(VIDEO, 'youtube.com')]);
  assert.deepEqual(
    merged.map((page) => page.url),
    [THREAD, VIDEO],
  );
});

test('mergeLostPages keeps what it already had for a page it sees twice', () => {
  const existing = [record(THREAD, 'reddit.com', 'the original title')];
  const merged = mergeLostPages(existing, [record(THREAD, 'reddit.com', 'a later title')]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'the original title');
});

test('mergeLostPages keeps the most recent within the limit', () => {
  const existing = Array.from({ length: LOST_PAGE_LIMIT }, (_, i) =>
    record(`https://example.com/${i}`, 'example.com'),
  );
  const merged = mergeLostPages(existing, [record(THREAD, 'reddit.com')]);
  assert.equal(merged.length, LOST_PAGE_LIMIT);
  assert.equal(merged.at(-1).url, THREAD);
  assert.equal(merged[0].url, 'https://example.com/1', 'the oldest page falls off');
});

test('reopenTarget sends a page back to the block page while its site is blocked', () => {
  const page = record(THREAD, 'reddit.com', 'r/programming');
  const target = reopenTarget(page, ['reddit.com'], BASE);
  assert.equal(
    target,
    // swept, so bringing a page back does not count as reaching for the site.
    buildBlockedUrl(BASE, { site: 'reddit.com', url: THREAD, title: 'r/programming', swept: true }),
  );
  assert.ok(target.includes('swept=1'));
});

test('reopenTarget opens the page itself once its site is not blocked', () => {
  assert.equal(reopenTarget(record(THREAD, 'reddit.com'), [], BASE), THREAD);
  assert.equal(reopenTarget(record(THREAD, 'reddit.com'), ['youtube.com'], BASE), THREAD);
});

test('reopenTarget refuses anything that is not an ordinary page', () => {
  assert.equal(reopenTarget(record('javascript:alert(1)', 'reddit.com'), [], BASE), null);
  assert.equal(reopenTarget(record('', 'reddit.com'), [], BASE), null);
});
