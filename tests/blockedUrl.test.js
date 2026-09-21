import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBlockedUrl, redirectSubstitution, parseBlockedUrl } from '../src/blockedUrl.js';

const BASE = 'chrome-extension://abc/src/blocked/blocked.html';
const ORIGINAL = 'https://www.youtube.com/watch?v=abc&t=30#comments';

test('buildBlockedUrl puts url last and raw', () => {
  assert.equal(
    buildBlockedUrl(BASE, { site: 'youtube.com', url: ORIGINAL }),
    `${BASE}?site=youtube.com&url=${ORIGINAL}`,
  );
});

test('buildBlockedUrl encodes title and adds swept flag', () => {
  const href = buildBlockedUrl(BASE, {
    site: 'youtube.com',
    url: ORIGINAL,
    title: 'Cats & dogs = chaos?',
    swept: true,
  });
  assert.ok(href.startsWith(`${BASE}?site=youtube.com&swept=1&title=`));
  assert.ok(href.endsWith(`&url=${ORIGINAL}`));
});

test('parseBlockedUrl round-trips everything, including & and # in the url', () => {
  const href = buildBlockedUrl(BASE, {
    site: 'youtube.com',
    url: ORIGINAL,
    title: 'Cats & dogs = chaos? url=nope',
    swept: true,
  });
  assert.deepEqual(parseBlockedUrl(href), {
    site: 'youtube.com',
    title: 'Cats & dogs = chaos? url=nope',
    swept: true,
    url: ORIGINAL,
  });
});

test('parseBlockedUrl handles a redirect-rule URL with no title', () => {
  assert.deepEqual(parseBlockedUrl(`${BASE}?site=reddit.com&url=https://old.reddit.com/r/a?b=c&d=e`), {
    site: 'reddit.com',
    title: '',
    swept: false,
    url: 'https://old.reddit.com/r/a?b=c&d=e',
  });
});

test('parseBlockedUrl returns null without a site', () => {
  assert.equal(parseBlockedUrl(BASE), null);
  assert.equal(parseBlockedUrl(`${BASE}?url=https://x.com/`), null);
});

test('redirectSubstitution matches the buildBlockedUrl shape with a backreference', () => {
  assert.equal(redirectSubstitution(BASE, 'reddit.com'), `${BASE}?site=reddit.com&url=\\1`);
});
