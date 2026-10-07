import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHost,
  normalizeDomain,
  matchesDomain,
  addSite,
  addSearchSource,
  normalizeSites,
  normalizeSearchSources,
} from '../src/domains.js';

test('normalizeDomain strips scheme, www, path and lowercases', () => {
  assert.equal(normalizeDomain('https://www.Reddit.com/r/foo'), 'reddit.com');
});

test('normalizeDomain trims whitespace', () => {
  assert.equal(normalizeDomain('  YouTube.com  '), 'youtube.com');
});

test('normalizeDomain strips port, query and fragment', () => {
  assert.equal(normalizeDomain('reddit.com:443'), 'reddit.com');
  assert.equal(normalizeDomain('http://old.reddit.com/?x=1#top'), 'old.reddit.com');
});

test('normalizeDomain keeps multi-part TLDs', () => {
  assert.equal(normalizeDomain('www.bbc.co.uk'), 'bbc.co.uk');
});

test('normalizeDomain rejects invalid input', () => {
  assert.equal(normalizeDomain(''), null);
  assert.equal(normalizeDomain('reddit'), null);
  assert.equal(normalizeDomain('localhost'), null);
  assert.equal(normalizeDomain('not a site'), null);
  assert.equal(normalizeDomain('-bad.com'), null);
  assert.equal(normalizeDomain('bad..com'), null);
});

test('normalizeHost keeps www and drops the rest of a pasted URL', () => {
  assert.equal(normalizeHost(' https://www.Google.com:443/search?q=x '), 'www.google.com');
  assert.equal(normalizeHost('news.ycombinator.com/'), 'news.ycombinator.com');
});

test('normalizeHost rejects invalid input', () => {
  assert.equal(normalizeHost('localhost'), null);
  assert.equal(normalizeHost('-bad.com'), null);
  assert.equal(normalizeHost(42), null);
});

test('normalizeDomain rejects a host that is only www and a TLD', () => {
  assert.equal(normalizeDomain('www.com'), null);
});

test('matchesDomain matches the exact host', () => {
  assert.equal(matchesDomain('https://reddit.com/r/foo', 'reddit.com'), true);
});

test('matchesDomain matches subdomains', () => {
  assert.equal(matchesDomain('https://old.reddit.com/', 'reddit.com'), true);
  assert.equal(matchesDomain('https://www.youtube.com/watch?v=1', 'youtube.com'), true);
});

test('matchesDomain never matches the Google sign-in hop through YouTube', () => {
  const signIn = 'https://accounts.youtube.com/accounts/SetSID?continue=https://mail.google.com/mail';
  assert.equal(matchesDomain(signIn, 'youtube.com'), false);
  assert.equal(matchesDomain('https://www.youtube.com/', 'youtube.com'), true);
});

test('matchesDomain rejects look-alike hosts', () => {
  assert.equal(matchesDomain('https://notreddit.com/', 'reddit.com'), false);
  assert.equal(matchesDomain('https://reddit.com.evil.io/', 'reddit.com'), false);
});

test('matchesDomain rejects non-http URLs and garbage', () => {
  assert.equal(matchesDomain('chrome://extensions', 'reddit.com'), false);
  assert.equal(matchesDomain('not a url', 'reddit.com'), false);
  assert.equal(matchesDomain(undefined, 'reddit.com'), false);
});

test('normalizeSites converts plain domain strings to entries', () => {
  assert.deepEqual(normalizeSites(['reddit.com', { domain: 'youtube.com', searchPass: true }]), [
    { domain: 'reddit.com', searchPass: false },
    { domain: 'youtube.com', searchPass: true },
  ]);
});

test('normalizeSites defaults a missing or odd searchPass to false', () => {
  assert.deepEqual(normalizeSites([{ domain: 'reddit.com' }, { domain: 'x.com', searchPass: 'yes' }]), [
    { domain: 'reddit.com', searchPass: false },
    { domain: 'x.com', searchPass: false },
  ]);
});

test('addSite appends a normalized entry', () => {
  assert.deepEqual(addSite([{ domain: 'reddit.com', searchPass: true }], 'https://www.twitter.com/home'), {
    sites: [
      { domain: 'reddit.com', searchPass: true },
      { domain: 'twitter.com', searchPass: false },
    ],
    error: null,
  });
});

test('addSite rejects duplicates', () => {
  const sites = [{ domain: 'reddit.com', searchPass: false }];
  const result = addSite(sites, 'www.reddit.com');
  assert.equal(result.sites, sites);
  assert.match(result.error, /already on the list/);
});

test('addSite rejects invalid input', () => {
  const sites = [{ domain: 'reddit.com', searchPass: false }];
  const result = addSite(sites, 'nope');
  assert.equal(result.sites, sites);
  assert.match(result.error, /doesn't look like a website/);
});

test('normalizeSearchSources drops bad entries and duplicates', () => {
  assert.deepEqual(normalizeSearchSources(['www.google.com', 'WWW.Google.com', '', 42, 'kagi.com']), [
    'www.google.com',
    'kagi.com',
  ]);
  assert.deepEqual(normalizeSearchSources('kagi.com'), []);
});

test('addSearchSource appends the host as typed, www included', () => {
  assert.deepEqual(addSearchSource(['kagi.com'], 'https://www.google.se/'), {
    sources: ['kagi.com', 'www.google.se'],
    error: null,
  });
});

test('addSearchSource rejects duplicates', () => {
  const sources = ['news.ycombinator.com'];
  const result = addSearchSource(sources, 'News.YCombinator.com');
  assert.equal(result.sources, sources);
  assert.equal(result.error, 'news.ycombinator.com is already on the list.');
});

test('addSearchSource rejects invalid input', () => {
  const result = addSearchSource([], ' not a site ');
  assert.deepEqual(result, { sources: [], error: '"not a site" doesn\'t look like a website.' });
});
