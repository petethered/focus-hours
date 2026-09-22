import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERIES_LIMIT, seriesColor, seriesFor, niceMaximum } from '../src/options/chart.js';

const sites = (count) => Array.from({ length: count }, (_, i) => `site${i}.com`);

test('seriesColor assigns hues in list order', () => {
  const list = sites(3);
  assert.equal(seriesColor(list, 'site0.com'), 'var(--series-1)');
  assert.equal(seriesColor(list, 'site2.com'), 'var(--series-3)');
});

test('seriesColor sends sites past the hue set to the shared colour', () => {
  const list = sites(SERIES_LIMIT + 2);
  assert.equal(seriesColor(list, `site${SERIES_LIMIT}.com`), 'var(--series-other)');
  assert.equal(seriesColor(list, 'unknown.com'), 'var(--series-other)');
});

test('seriesFor labels each site up to the limit', () => {
  assert.deepEqual(seriesFor(['reddit.com', 'youtube.com']), [
    { site: 'reddit.com', label: 'reddit.com' },
    { site: 'youtube.com', label: 'youtube.com' },
  ]);
  assert.deepEqual(seriesFor([]), []);
});

test('seriesFor folds the rest into one entry', () => {
  const series = seriesFor(sites(SERIES_LIMIT + 3));
  assert.equal(series.length, SERIES_LIMIT + 1);
  assert.deepEqual(series.at(-1), { site: null, label: '3 other sites' });
});

test('niceMaximum leaves headroom above the tallest bar', () => {
  assert.equal(niceMaximum(1), 4);
  assert.equal(niceMaximum(4), 6);
  assert.equal(niceMaximum(5), 6);
  assert.equal(niceMaximum(9), 10);
  assert.equal(niceMaximum(12), 14);
});

test('niceMaximum keeps the halfway tick a whole number', () => {
  for (const value of [1, 3, 4, 7, 9, 15, 23, 48]) {
    assert.equal(niceMaximum(value) % 2, 0, `maximum for ${value} is even`);
    assert.ok(niceMaximum(value) > value, `maximum for ${value} clears the bar`);
  }
});
