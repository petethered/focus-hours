import { FALLBACK_QUOTES, pickRandom } from './content.js';

export const QUOTE_API_URL = 'https://zenquotes.io/api/random';
const RATE_LIMIT_AUTHOR = 'zenquotes.io';

export async function fetchQuote({
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 1500,
  random = Math.random,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(QUOTE_API_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Quote API returned ${response.status}`);
    const data = await response.json();
    const quote = Array.isArray(data) ? data[0] : undefined;
    if (!isUsable(quote)) throw new Error('Unusable quote');
    return { text: quote.q.trim(), author: quote.a.trim(), source: 'api' };
  } catch {
    return { ...pickRandom(FALLBACK_QUOTES, random), source: 'fallback' };
  } finally {
    clearTimeout(timer);
  }
}

function isUsable(quote) {
  return (
    typeof quote?.q === 'string' &&
    typeof quote?.a === 'string' &&
    quote.q.trim() !== '' &&
    quote.a.trim().toLowerCase() !== RATE_LIMIT_AUTHOR
  );
}
