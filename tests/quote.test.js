import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchQuote, QUOTE_API_URL } from '../src/quote.js';
import { FALLBACK_QUOTES } from '../src/content.js';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const first = () => 0;
const FALLBACK = { ...FALLBACK_QUOTES[0], source: 'fallback' };

test('fetchQuote returns the API quote', async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return jsonResponse([{ q: ' Keep going. ', a: ' Someone ', h: '<b>…</b>' }]);
  };
  assert.deepEqual(await fetchQuote({ fetchImpl }), { text: 'Keep going.', author: 'Someone', source: 'api' });
  assert.equal(requestedUrl, QUOTE_API_URL);
});

test('fetchQuote falls back on a network error', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await fetchQuote({ fetchImpl, random: first }), FALLBACK);
});

test('fetchQuote falls back on a non-200 response', async () => {
  const fetchImpl = async () => jsonResponse({}, 503);
  assert.deepEqual(await fetchQuote({ fetchImpl, random: first }), FALLBACK);
});

test('fetchQuote falls back on an unexpected shape', async () => {
  const fetchImpl = async () => jsonResponse({ quote: 'nope' });
  assert.deepEqual(await fetchQuote({ fetchImpl, random: first }), FALLBACK);
});

test('fetchQuote falls back on the rate-limit placeholder', async () => {
  const fetchImpl = async () =>
    jsonResponse([{ q: 'Too many requests. Obtain an auth key for unlimited access.', a: 'zenquotes.io' }]);
  assert.deepEqual(await fetchQuote({ fetchImpl, random: first }), FALLBACK);
});

test('fetchQuote falls back when the request times out', async () => {
  const fetchImpl = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
  assert.deepEqual(await fetchQuote({ fetchImpl, timeoutMs: 10, random: first }), FALLBACK);
});
