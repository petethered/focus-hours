import { BLOCKED_PAGE_PATH } from './blockedUrl.js';
import {
  activeUnblocks,
  computeBlockedSet,
  nextWakeTime,
  buildRedirectRules,
  tabRedirect,
} from './enforcement.js';
import { DEFAULT_SETTINGS, getSettings, saveSettings, getUnblocks, saveUnblocks } from './storage.js';

const ALARM_NAME = 'sync';
const BLOCKED_PAGE_BASE = chrome.runtime.getURL(BLOCKED_PAGE_PATH);

// Runs are chained so two triggers never interleave rule and tab updates.
let queue = Promise.resolve();

function sync() {
  queue = queue.then(runSync).catch((error) => console.error('[focus-hours] sync failed', error));
  return queue;
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
  await replaceRules(blocked);
  await updateTabs(blocked);
  await scheduleWake(nextWakeTime(settings, unblocks, now));
}

async function replaceRules(domains) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: buildRedirectRules(domains, BLOCKED_PAGE_BASE),
  });
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
  sync();
});

chrome.runtime.onStartup.addListener(sync);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.settings || changes.unblocks)) sync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) sync();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
