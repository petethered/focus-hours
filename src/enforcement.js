import { isBlockedNow, nextBoundary } from './schedule.js';
import { matchesDomain } from './domains.js';
import { buildBlockedUrl, redirectSubstitution, parseBlockedUrl } from './blockedUrl.js';

export function activeUnblocks(unblocks, now) {
  return Object.fromEntries(
    Object.entries(unblocks).filter(([, expiry]) => expiry > now.getTime()),
  );
}

export function computeBlockedSet(settings, unblocks, now) {
  if (!isBlockedNow(settings.schedule, now)) return [];
  const active = activeUnblocks(unblocks, now);
  return settings.sites.filter((site) => !(site in active));
}

export function nextWakeTime(settings, unblocks, now) {
  const times = Object.values(activeUnblocks(unblocks, now));
  const boundary = nextBoundary(settings.schedule, now);
  if (boundary) times.push(boundary.getTime());
  return times.length > 0 ? Math.min(...times) : null;
}

export function buildRedirectRules(domains, base) {
  return domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { regexSubstitution: redirectSubstitution(base, domain) },
    },
    condition: {
      regexFilter: '^(.*)$',
      requestDomains: [domain],
      resourceTypes: ['main_frame'],
    },
  }));
}

export function tabRedirect({ url, title }, blocked, base) {
  if (!url) return null;
  if (url.startsWith(base)) {
    const page = parseBlockedUrl(url);
    if (!page || blocked.includes(page.site)) return null;
    return /^https?:\/\//i.test(page.url) ? page.url : null;
  }
  const site = blocked.find((domain) => matchesDomain(url, domain));
  return site ? buildBlockedUrl(base, { site, url, title, swept: true }) : null;
}
