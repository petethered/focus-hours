import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_ENGINE_DOMAINS,
  sectionScope,
  sectionPattern,
  isWithinScope,
} from '../src/searchPass.js';

const THREAD = 'https://www.reddit.com/r/programming/comments/abc/tabs_vs_spaces/';
const VIDEO = 'https://www.youtube.com/watch?v=abc';

test('SEARCH_ENGINE_DOMAINS lists search hosts, not whole properties', () => {
  assert.ok(SEARCH_ENGINE_DOMAINS.includes('www.google.com'));
  assert.ok(SEARCH_ENGINE_DOMAINS.includes('duckduckgo.com'));
  // docs.google.com is a subdomain of google.com, so the bare domain must not be listed.
  assert.ok(!SEARCH_ENGINE_DOMAINS.includes('google.com'));
  assert.ok(!SEARCH_ENGINE_DOMAINS.includes('yahoo.com'));
  for (const domain of SEARCH_ENGINE_DOMAINS) {
    assert.match(domain, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  }
});

test('sectionScope ignores parameters that change on the same page', () => {
  const video = sectionScope('https://www.youtube.com/watch?v=abc');
  assert.deepEqual(sectionScope('https://www.youtube.com/watch?v=abc&t=30&list=PL1'), video);
  assert.deepEqual(sectionScope('https://www.youtube.com/watch?t=30&v=abc'), video);
  assert.notDeepEqual(sectionScope('https://www.youtube.com/watch?v=other'), video);
});

test('sectionPattern matches page loads inside the section only', () => {
  const pattern = new RegExp(sectionPattern(sectionScope(THREAD)));
  assert.match('https://www.reddit.com/r/programming', pattern);
  assert.match('https://www.reddit.com/r/programming/', pattern);
  assert.match('https://www.reddit.com/r/programming/comments/xyz/t/', pattern);
  assert.match('https://www.reddit.com/r/programming?sort=new', pattern);
  assert.doesNotMatch('https://www.reddit.com/r/programming2/', pattern);
  assert.doesNotMatch('https://www.reddit.com/r/cats/', pattern);
  assert.doesNotMatch('https://www.reddit.com/', pattern);
});

test('sectionPattern escapes regular expression characters in the path', () => {
  const scope = sectionScope('https://example.com/a+b/c.d/page');
  assert.match('https://example.com/a+b/c.d/page', new RegExp(sectionPattern(scope)));
  assert.doesNotMatch('https://example.com/aXb/cZd/page', new RegExp(sectionPattern(scope)));
});

test('sectionPattern has nothing to match for a one-page scope', () => {
  assert.equal(sectionPattern(sectionScope(VIDEO)), null);
  assert.equal(sectionPattern(null), null);
});

test('sectionScope takes the first two path segments', () => {
  assert.deepEqual(sectionScope(THREAD), {
    host: 'www.reddit.com',
    path: '/r/programming',
    exact: false,
  });
});

test('sectionScope falls back to the exact page without a section', () => {
  assert.deepEqual(sectionScope(VIDEO), {
    host: 'www.youtube.com',
    path: '/watch?v=abc',
    exact: true,
  });
  assert.deepEqual(sectionScope('https://reddit.com/'), {
    host: 'reddit.com',
    path: '/',
    exact: true,
  });
});

test('sectionScope rejects non-http and unparseable URLs', () => {
  assert.equal(sectionScope('chrome://extensions'), null);
  assert.equal(sectionScope('not a url'), null);
});

test('isWithinScope keeps the whole section open', () => {
  const scope = sectionScope(THREAD);
  assert.equal(isWithinScope(THREAD, scope), true);
  assert.equal(isWithinScope('https://www.reddit.com/r/programming', scope), true);
  assert.equal(isWithinScope('https://www.reddit.com/r/programming/', scope), true);
  assert.equal(isWithinScope('https://www.reddit.com/r/programming/comments/xyz/other/', scope), true);
  assert.equal(isWithinScope('https://www.reddit.com/r/programming/?sort=new', scope), true);
});

test('isWithinScope shuts out the rest of the site', () => {
  const scope = sectionScope(THREAD);
  assert.equal(isWithinScope('https://www.reddit.com/', scope), false);
  assert.equal(isWithinScope('https://www.reddit.com/r/cats/', scope), false);
  assert.equal(isWithinScope('https://www.reddit.com/r/programming2/', scope), false);
  assert.equal(isWithinScope('https://old.reddit.com/r/programming/', scope), false);
});

test('isWithinScope on an exact scope allows only that page', () => {
  const scope = sectionScope(VIDEO);
  assert.equal(isWithinScope(VIDEO, scope), true);
  assert.equal(isWithinScope('https://www.youtube.com/watch?v=abc&t=120', scope), true);
  assert.equal(isWithinScope('https://www.youtube.com/watch?v=other', scope), false);
  assert.equal(isWithinScope('https://www.youtube.com/', scope), false);
  assert.equal(isWithinScope('https://www.youtube.com/watch/extra/path', scope), false);
});

test('isWithinScope is false without a scope or for junk URLs', () => {
  assert.equal(isWithinScope(THREAD, null), false);
  assert.equal(isWithinScope('not a url', sectionScope(THREAD)), false);
});
