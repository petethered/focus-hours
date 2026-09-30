const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// A hostname as typed or pasted, www. and all: "https://www.google.com/search" gives
// "www.google.com".
export function normalizeHost(input) {
  if (typeof input !== 'string') return null;
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/)[0];
  host = host.replace(/:\d*$/, '');
  host = host.replace(/\.$/, '');
  return isHostname(host) ? host : null;
}

// A site to block. www. is dropped so the rule covers the whole site.
export function normalizeDomain(input) {
  const host = normalizeHost(input)?.replace(/^www\./, '');
  return host && isHostname(host) ? host : null;
}

function isHostname(host) {
  if (!HOSTNAME_PATTERN.test(host)) return false;
  return !host.split('.').some((label) => label.startsWith('-') || label.endsWith('-'));
}

export function matchesDomain(url, domain) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return host === domain || host.endsWith(`.${domain}`);
}

// A site entry is { domain, searchPass }; older settings stored a bare domain string.
export function normalizeSites(sites) {
  if (!Array.isArray(sites)) return [];
  return sites
    .map((entry) => (typeof entry === 'string' ? { domain: entry, searchPass: false } : entry))
    .filter((entry) => entry && typeof entry.domain === 'string')
    .map((entry) => ({ domain: entry.domain, searchPass: entry.searchPass === true }));
}

// Stored sources go straight into a declarativeNetRequest rule, and one bad
// entry would make Chrome reject the whole rule update.
export function normalizeSearchSources(sources) {
  if (!Array.isArray(sources)) return [];
  return [...new Set(sources.map(normalizeHost).filter(Boolean))];
}

export function addSite(sites, input) {
  const domain = normalizeDomain(input);
  if (!domain) {
    return { sites, error: `"${input.trim()}" doesn't look like a website.` };
  }
  if (sites.some((site) => site.domain === domain)) {
    return { sites, error: `${domain} is already on the list.` };
  }
  return { sites: [...sites, { domain, searchPass: false }], error: null };
}

// Search sources keep their www.: subdomains of a source count too, so trimming
// www.google.com to google.com would let links from Docs and Sites through.
export function addSearchSource(sources, input) {
  const host = normalizeHost(input);
  if (!host) {
    return { sources, error: `"${input.trim()}" doesn't look like a website.` };
  }
  if (sources.includes(host)) {
    return { sources, error: `${host} is already on the list.` };
  }
  return { sources: [...sources, host], error: null };
}
