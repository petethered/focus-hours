import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, matchesDomain, addSite } from '../src/domains.js';

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

test('matchesDomain matches the exact host', () => {
  assert.equal(matchesDomain('https://reddit.com/r/foo', 'reddit.com'), true);
});

test('matchesDomain matches subdomains', () => {
  assert.equal(matchesDomain('https://old.reddit.com/', 'reddit.com'), true);
  assert.equal(matchesDomain('https://www.youtube.com/watch?v=1', 'youtube.com'), true);
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

test('addSite appends a normalized domain', () => {
  assert.deepEqual(addSite(['reddit.com'], 'https://www.twitter.com/home'), {
    sites: ['reddit.com', 'twitter.com'],
    error: null,
  });
});

test('addSite rejects duplicates', () => {
  const sites = ['reddit.com'];
  const result = addSite(sites, 'www.reddit.com');
  assert.equal(result.sites, sites);
  assert.match(result.error, /already on the list/);
});

test('addSite rejects invalid input', () => {
  const sites = ['reddit.com'];
  const result = addSite(sites, 'nope');
  assert.equal(result.sites, sites);
  assert.match(result.error, /doesn't look like a website/);
});
