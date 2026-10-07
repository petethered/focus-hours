import { isBlockedNow, nextBoundary } from './schedule.js';
import { matchesDomain, exemptHosts } from './domains.js';
import { buildBlockedUrl, redirectSubstitution, parseBlockedUrl } from './blockedUrl.js';

export function activeUnblocks(unblocks, now) {
  return Object.fromEntries(
    Object.entries(unblocks).filter(([, expiry]) => expiry > now.getTime()),
  );
}

export function computeBlockedSet(settings, unblocks, now) {
  if (!isBlockedNow(settings.schedule, now)) return [];
  const active = activeUnblocks(unblocks, now);
  return settings.sites.map((site) => site.domain).filter((domain) => !(domain in active));
}

export function searchPassDomains(settings, blocked) {
  return blocked.filter((domain) => allowsSearchPass(settings, domain));
}

export function allowsSearchPass(settings, domain) {
  return settings.sites.some((site) => site.domain === domain && site.searchPass);
}

export function matchingSite(url, domains) {
  return domains.find((domain) => matchesDomain(url, domain)) ?? null;
}

export function nextWakeTime(settings, unblocks, now) {
  const times = Object.values(activeUnblocks(unblocks, now));
  const boundary = nextBoundary(settings.schedule, now);
  if (boundary) times.push(boundary.getTime());
  return times.length > 0 ? Math.min(...times) : null;
}

export function buildRedirectRules(domains, base) {
  return domains.map((domain, index) => {
    const exempt = exemptHosts(domain);
    return {
      id: index + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: redirectSubstitution(base, domain) },
      },
      condition: {
        regexFilter: '^(.*)$',
        requestDomains: [domain],
        ...(exempt.length > 0 && { excludedRequestDomains: exempt }),
        resourceTypes: ['main_frame'],
      },
    };
  });
}

// Allow rules outrank the block rules, so a page opened from a search result loads.
// Staying inside the section it opened is enforced per tab in background.js.
// A site never counts as its own search source, or every link on a passed page
// would hand out a fresh pass for wherever it led.
const SEARCH_ALLOW_RULE_OFFSET = 1000;

// No sources means no allow rules: Chrome rejects an empty initiatorDomains.
export function buildSearchAllowRules(domains, sources) {
  if (sources.length === 0) return [];
  return domains.map((domain, index) => ({
    id: SEARCH_ALLOW_RULE_OFFSET + index + 1,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      requestDomains: [domain],
      initiatorDomains: sources,
      excludedInitiatorDomains: [domain],
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
  const site = matchingSite(url, blocked);
  return site ? buildBlockedUrl(base, { site, url, title, swept: true }) : null;
}
