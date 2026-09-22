// A search pass lets a page reached from a search result load, and keeps the
// visit to the section it landed in (a subreddit, a channel) rather than the
// whole site.

// Hosts whose links count as "came from a search". declarativeNetRequest matches
// these against the navigation's initiator, and subdomains of a listed host count
// too — hence search hosts rather than whole properties, or any link in Google
// Docs, Groups or Sites would hand out a pass.
export const SEARCH_ENGINE_DOMAINS = [
  'www.google.com',
  'www.google.co.uk',
  'www.google.ca',
  'www.google.com.au',
  'www.google.de',
  'www.google.fr',
  'www.google.es',
  'www.google.it',
  'www.google.nl',
  'www.google.co.jp',
  'www.google.co.in',
  'www.google.com.br',
  'www.google.com.mx',
  'www.bing.com',
  'duckduckgo.com',
  'www.ecosia.org',
  'search.brave.com',
  'www.startpage.com',
  'search.yahoo.com',
  'kagi.com',
];

// Query parameters that change while you stay on the same page: a video
// timestamp, a playlist, campaign tags.
const VOLATILE_PARAMS = new Set([
  't', 'list', 'index', 'pp', 'si', 'feature', 'ab_channel', 'start_radio', 'rv',
  'context', 'ref', 'ref_src', 'share_id',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
]);

function stableSearch(parsed) {
  const params = [...parsed.searchParams]
    .filter(([key]) => !VOLATILE_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  return params.length === 0 ? '' : `?${params.map(([key, value]) => `${key}=${value}`).join('&')}`;
}

// The stretch of a site a landing URL opens up: its first two path segments
// (/r/programming), or the exact page when the URL has no section to speak of
// (/watch?v=abc).
export function sectionScope(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    return { host, path: `/${segments[0]}/${segments[1]}`, exact: false };
  }
  return { host, path: parsed.pathname + stableSearch(parsed), exact: true };
}

const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

// A declarativeNetRequest filter for page loads inside a section, so reloads and
// ordinary link clicks within it work on sites that do full page loads.
// Sections only: a scope pinned to one page cannot be matched on query strings,
// whose parameters arrive in any order.
export function sectionPattern(scope) {
  if (!scope || scope.exact) return null;
  const path = scope.path.replace(REGEXP_METACHARACTERS, '\\$&');
  return `^https?://[^/]+${path}(/|\\?|#|$)`;
}

export function isWithinScope(url, scope) {
  if (!scope) return false;
  const target = sectionScope(url);
  if (!target || target.host !== scope.host) return false;
  if (scope.exact) return target.exact && target.path === scope.path;
  return target.path === scope.path;
}
