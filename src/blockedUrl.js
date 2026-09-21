// Block page URL: <base>?site=<enc>[&swept=1][&title=<enc>]&url=<raw original URL>
// `url` is always last and unencoded, because declarativeNetRequest's regexSubstitution
// cannot encode, so readers take everything after `url=` verbatim.
export const BLOCKED_PAGE_PATH = 'src/blocked/blocked.html';

export function buildBlockedUrl(base, { site, url, title = '', swept = false }) {
  const params = new URLSearchParams({ site });
  if (swept) params.set('swept', '1');
  if (title) params.set('title', title);
  return `${base}?${params}&url=${url}`;
}

export function redirectSubstitution(base, site) {
  return `${base}?${new URLSearchParams({ site })}&url=\\1`;
}

export function parseBlockedUrl(href) {
  const queryStart = href.indexOf('?');
  if (queryStart === -1) return null;
  const query = href.slice(queryStart + 1);
  // Encoded params never contain a raw "&" or "=", so the first "url=" at a
  // param boundary is the start of the raw URL.
  const marker = /(^|&)url=/.exec(query);
  const head = marker ? query.slice(0, marker.index) : query;
  const url = marker ? query.slice(marker.index + marker[0].length) : '';
  const params = new URLSearchParams(head);
  const site = params.get('site');
  if (!site) return null;
  return { site, title: params.get('title') ?? '', swept: params.get('swept') === '1', url };
}
