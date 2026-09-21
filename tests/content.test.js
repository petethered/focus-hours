import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADLINES,
  FALLBACK_QUOTES,
  pickRandom,
  displayName,
  fillHeadline,
  attemptMessage,
} from '../src/content.js';

test('HEADLINES is a non-empty list of strings', () => {
  assert.ok(HEADLINES.length >= 15);
  for (const headline of HEADLINES) assert.equal(typeof headline, 'string');
});

test('FALLBACK_QUOTES entries have text and author', () => {
  assert.ok(FALLBACK_QUOTES.length >= 25);
  for (const quote of FALLBACK_QUOTES) {
    assert.ok(quote.text.length > 0);
    assert.ok(quote.author.length > 0);
  }
});

test('pickRandom uses the supplied random source', () => {
  assert.equal(pickRandom(['a', 'b', 'c'], () => 0), 'a');
  assert.equal(pickRandom(['a', 'b', 'c'], () => 0.99), 'c');
});

test('displayName capitalizes the first label', () => {
  assert.equal(displayName('reddit.com'), 'Reddit');
  assert.equal(displayName('youtube.com'), 'Youtube');
});

test('fillHeadline substitutes every {site}', () => {
  assert.equal(fillHeadline('Not today, {site}.', 'reddit.com'), 'Not today, Reddit.');
  assert.equal(fillHeadline('{site}? {site}!', 'reddit.com'), 'Reddit? Reddit!');
});

test('fillHeadline leaves templates without {site} unchanged', () => {
  assert.equal(fillHeadline('Nope.', 'reddit.com'), 'Nope.');
});

test('attemptMessage is null for zero', () => {
  assert.equal(attemptMessage(0, 'reddit.com'), null);
});

test('attemptMessage words the first attempt', () => {
  assert.equal(attemptMessage(1, 'reddit.com'), "That's your first attempt at reddit.com today.");
});

test('attemptMessage uses ordinals after the first', () => {
  assert.equal(attemptMessage(2, 'reddit.com'), "That's your 2nd attempt at reddit.com today.");
  assert.equal(attemptMessage(3, 'reddit.com'), "That's your 3rd attempt at reddit.com today.");
  assert.equal(attemptMessage(7, 'reddit.com'), "That's your 7th attempt at reddit.com today.");
  assert.equal(attemptMessage(11, 'reddit.com'), "That's your 11th attempt at reddit.com today.");
  assert.equal(attemptMessage(12, 'reddit.com'), "That's your 12th attempt at reddit.com today.");
  assert.equal(attemptMessage(21, 'reddit.com'), "That's your 21st attempt at reddit.com today.");
  assert.equal(attemptMessage(113, 'reddit.com'), "That's your 113th attempt at reddit.com today.");
});
