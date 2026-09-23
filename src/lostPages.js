// A blocked tab's original page lives in the tab's own URL, which disappears
// with the tab — and Chrome closes every tab showing an extension page when the
// extension reloads. So each blocked tab is also written down in storage, and
// what those records point at can be offered back afterwards.

import { buildBlockedUrl, parseBlockedUrl } from './blockedUrl.js';

export const LOST_PAGE_LIMIT = 50;

// Matched on what the tabs actually show rather than on tab ids, which Chrome
// hands out again after a restart. A page still on a block page somewhere keeps
// its record (re-keyed to that tab); a page open at the site itself needs no
// record and was not lost; anything else is gone.
export function reconcile(records, tabs, base) {
  const onBlockPage = new Map();
  const openPages = new Set();
  for (const tab of tabs) {
    if (!tab.url) continue;
    if (tab.url.startsWith(base)) {
      const page = parseBlockedUrl(tab.url);
      if (page?.url) onBlockPage.set(page.url, tab.id);
    } else {
      openPages.add(tab.url);
    }
  }

  const active = {};
  const lost = [];
  for (const record of Object.values(records)) {
    if (onBlockPage.has(record.url)) {
      active[onBlockPage.get(record.url)] = record;
    } else if (!openPages.has(record.url)) {
      lost.push(record);
    }
  }
  return { active, lost };
}

export function mergeLostPages(existing, found) {
  const merged = [...existing];
  for (const page of found) {
    if (merged.some((known) => known.url === page.url)) continue;
    merged.push(page);
  }
  return merged.slice(-LOST_PAGE_LIMIT);
}

// Recovery, never a way in: while the site is blocked the page comes back as the
// block page, holding the address for when the window ends.
export function reopenTarget(page, blocked, base) {
  if (!/^https?:\/\//i.test(page.url)) return null;
  return blocked.includes(page.site)
    ? buildBlockedUrl(base, { site: page.site, url: page.url, title: page.title, swept: true })
    : page.url;
}
