const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/)[0];
  host = host.replace(/:\d*$/, '');
  host = host.replace(/^www\./, '');
  host = host.replace(/\.$/, '');
  if (!HOSTNAME_PATTERN.test(host)) return null;
  const labels = host.split('.');
  if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return null;
  return host;
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

export function addSite(sites, input) {
  const domain = normalizeDomain(input);
  if (!domain) {
    return { sites, error: `"${input.trim()}" doesn't look like a website.` };
  }
  if (sites.includes(domain)) {
    return { sites, error: `${domain} is already on the list.` };
  }
  return { sites: [...sites, domain], error: null };
}
