import { BLOCKED_PAGE_PATH, buildBlockedUrl } from './blockedUrl.js';
import {
  activeUnblocks,
  allowsSearchPass,
  computeBlockedSet,
  searchPassDomains,
  matchingSite,
  nextWakeTime,
  buildRedirectRules,
  buildSearchAllowRules,
  tabRedirect,
} from './enforcement.js';
import { sectionScope, sectionPattern, isWithinScope } from './searchPass.js';
import { recordEvent, dayCount, pruneHistory } from './history.js';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  getUnblocks,
  saveUnblocks,
  getPass,
  savePass,
  clearPass,
  clearAllPasses,
  getHistory,
  saveHistory,
} from './storage.js';

const ALARM_NAME = 'sync';
const BLOCKED_PAGE_BASE = chrome.runtime.getURL(BLOCKED_PAGE_PATH);
// Session rules are keyed by tab, well clear of the dynamic rule ids.
const PASS_RULE_OFFSET = 1_000_000;

// Syncs and navigation handling are chained so they never interleave: a page load
// and the history update a site fires milliseconds later are handled in order.
let queue = Promise.resolve();

function enqueue(work) {
  queue = queue.then(work).catch((error) => console.error('[focus-hours] failed', error));
  return queue;
}

function sync() {
  return enqueue(runSync);
}

async function runSync() {
  const now = new Date();
  const settings = await getSettings();
  const stored = await getUnblocks();
  const unblocks = activeUnblocks(stored, now);
  if (Object.keys(unblocks).length !== Object.keys(stored).length) {
    await saveUnblocks(unblocks);
  }

  const blocked = computeBlockedSet(settings, unblocks, now);
  blockedSnapshot = null;
  await revokeAllPasses();
  try {
    await replaceRules(blocked, searchPassDomains(settings, blocked));
    await updateTabs(blocked);
  } finally {
    // Always arm the next wake-up, or a failed run would leave stale rules in place indefinitely.
    await scheduleWake(nextWakeTime(settings, unblocks, now));
  }
}

async function replaceRules(domains, searchDomains) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: [
      ...buildRedirectRules(domains, BLOCKED_PAGE_BASE),
      ...buildSearchAllowRules(searchDomains),
    ],
  });
}

// Which sites are blocked right now. The navigation handlers run between syncs,
// so this reads storage, cached until anything changes it.
let blockedSnapshot = null;

async function currentlyBlocked() {
  const now = new Date();
  if (blockedSnapshot && blockedSnapshot.minute === Math.floor(now.getTime() / 60_000)) {
    return blockedSnapshot;
  }
  const settings = await getSettings();
  const unblocks = activeUnblocks(await getUnblocks(), now);
  blockedSnapshot = {
    minute: Math.floor(now.getTime() / 60_000),
    settings,
    blocked: computeBlockedSet(settings, unblocks, now),
  };
  return blockedSnapshot;
}

const isPageUrl = (url) => url.startsWith('http://') || url.startsWith('https://');

// Only a live top-level document counts: not a subframe, not a prerender, and
// not a page restored from history, which never passes the block rules.
function isFreshPageLoad({ frameId, documentLifecycle, frameType, transitionQualifiers = [] }) {
  return (
    frameId === 0 &&
    (documentLifecycle ?? 'active') === 'active' &&
    (frameType ?? 'outermost_frame') === 'outermost_frame' &&
    !transitionQualifiers.includes('forward_back') &&
    !transitionQualifiers.includes('from_address_bar')
  );
}

// A page load on a blocked site can only have got past the block rules by coming
// from a search, so it opens up the section it landed in. Anything else on a
// blocked site — history restored from cache, a tab restored at startup — never
// met those rules and is blocked here instead.
async function onPageLoad(details) {
  const { tabId, url } = details;
  if (!isPageUrl(url)) {
    await revokePass(tabId);
    return;
  }
  const { settings, blocked } = await currentlyBlocked();
  const site = matchingSite(url, blocked);
  if (!site) {
    await revokePass(tabId);
    return;
  }
  const pass = await getPass(tabId);
  if (pass && pass.site === site && isWithinScope(url, pass.scope)) return;
  if (allowsSearchPass(settings, site) && isFreshPageLoad(details)) {
    await grantPass(tabId, site, url);
    return;
  }
  await blockTab(tabId, site, url);
}

// Sites that switch pages without a page load (Reddit, YouTube) never hit the
// block rules, so the section is enforced here instead.
async function onInPageNavigation({ tabId, frameId, url }) {
  if (frameId !== 0) return;
  const pass = await getPass(tabId);
  if (pass && isWithinScope(url, pass.scope)) return;
  const { blocked } = await currentlyBlocked();
  const site = matchingSite(url, blocked);
  if (!site) {
    if (pass) await revokePass(tabId);
    return;
  }
  await blockTab(tabId, site, url);
}

async function grantPass(tabId, site, url) {
  const scope = sectionScope(url);
  await savePass(tabId, { site, scope });
  const pattern = sectionPattern(scope);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [PASS_RULE_OFFSET + tabId],
    // A section also has to survive reloads and ordinary link clicks within it,
    // which carry no search initiator. A one-page scope gets no rule: it lasts
    // for this document only.
    addRules: pattern
      ? [
          {
            id: PASS_RULE_OFFSET + tabId,
            priority: 3,
            action: { type: 'allow' },
            condition: {
              tabIds: [tabId],
              requestDomains: [site],
              regexFilter: pattern,
              resourceTypes: ['main_frame'],
            },
          },
        ]
      : [],
  });
}

async function revokePass(tabId) {
  await clearPass(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [PASS_RULE_OFFSET + tabId],
  });
}

async function blockTab(tabId, site, url) {
  await revokePass(tabId);
  try {
    await chrome.tabs.update(tabId, { url: buildBlockedUrl(BLOCKED_PAGE_BASE, { site, url }) });
  } catch {
    // Tab closed or moved on; the next navigation in it starts from scratch.
  }
}

// A blocking window starting or ending voids every pass, the same way it sweeps
// every tab.
async function revokeAllPasses() {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map((rule) => rule.id),
  });
  await clearAllPasses();
}

async function updateTabs(blocked) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      const target = tabRedirect(tab, blocked, BLOCKED_PAGE_BASE);
      if (!target) return;
      try {
        await chrome.tabs.update(tab.id, { url: target });
      } catch {
        // Tab closed or navigated away mid-sweep; the next sync will reconcile.
      }
    }),
  );
}

async function scheduleWake(when) {
  await chrome.alarms.clear(ALARM_NAME);
  if (when !== null) await chrome.alarms.create(ALARM_NAME, { when });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') await saveSettings(structuredClone(DEFAULT_SETTINGS));
  await migrateHistory();
  sync();
});

// Carry a pre-history install's single day of counts over, then drop the old key.
async function migrateHistory() {
  const { attempts } = await chrome.storage.local.get('attempts');
  if (!attempts) return;
  await saveHistory(await getHistory());
  await chrome.storage.local.remove('attempts');
}

chrome.runtime.onStartup.addListener(sync);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(changes.settings || changes.unblocks)) return;
  blockedSnapshot = null;
  sync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) sync();
});

// The block page asks the worker to record, so simultaneous tabs queue behind
// each other instead of overwriting one another's history.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'history') return false;
  enqueue(async () => {
    const now = new Date();
    const history = await getHistory();
    if (!message.record) {
      sendResponse({ count: dayCount(history, message.kind, message.site, now) });
      return;
    }
    const result = recordEvent(history, message.kind, message.site, now);
    await saveHistory(pruneHistory(result.history, now));
    sendResponse({ count: result.count });
  });
  return true; // the response goes out asynchronously
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) enqueue(() => onPageLoad(details));
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) enqueue(() => onInPageNavigation(details));
});

chrome.tabs.onRemoved.addListener((tabId) => enqueue(() => revokePass(tabId)));

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) =>
  enqueue(() => revokePass(removedTabId)),
);

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
