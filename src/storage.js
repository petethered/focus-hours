import { normalizeSites } from './domains.js';

export const DEFAULT_MESSAGE = 'This site is blocked during focus hours. Get back to it.';

export const DEFAULT_SETTINGS = Object.freeze({
  sites: [
    { domain: 'reddit.com', searchPass: true },
    { domain: 'youtube.com', searchPass: false },
  ],
  schedule: { days: [1, 2, 3, 4, 5], start: '10:00', end: '16:00' },
  message: DEFAULT_MESSAGE,
});

export async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const defaults = structuredClone(DEFAULT_SETTINGS);
  return {
    ...defaults,
    ...settings,
    sites: normalizeSites(settings.sites ?? defaults.sites),
    schedule: { ...defaults.schedule, ...settings.schedule },
  };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getUnblocks() {
  const { unblocks = {} } = await chrome.storage.local.get('unblocks');
  return unblocks;
}

export async function saveUnblocks(unblocks) {
  await chrome.storage.local.set({ unblocks });
}

// Installs from before day-by-day history kept only today's counts, under `attempts`.
export async function getHistory() {
  const { history, attempts } = await chrome.storage.local.get(['history', 'attempts']);
  if (history) return history;
  if (attempts?.date) return { [attempts.date]: { attempts: attempts.counts, unblocks: {} } };
  return {};
}

export async function saveHistory(history) {
  await chrome.storage.local.set({ history });
}

// What each blocked tab was showing, so a tab dying does not take the page with it.
export async function getBlockedTabs() {
  const { blockedTabs = {} } = await chrome.storage.local.get('blockedTabs');
  return blockedTabs;
}

export async function saveBlockedTabs(blockedTabs) {
  await chrome.storage.local.set({ blockedTabs });
}

export async function getLostPages() {
  const { lostPages = [] } = await chrome.storage.local.get('lostPages');
  return lostPages;
}

export async function saveLostPages(lostPages) {
  await chrome.storage.local.set({ lostPages });
}

// Session storage is cleared when the extension reloads or the browser restarts,
// but survives the worker being evicted — exactly the line between "Chrome took
// the tabs" and "the worker just woke up".
export async function isNewExtensionSession() {
  const { sessionStarted } = await chrome.storage.session.get('sessionStarted');
  if (sessionStarted) return false;
  await chrome.storage.session.set({ sessionStarted: true });
  return true;
}

// Search passes live in session storage: they belong to one tab and one browsing
// session, and are never worth keeping across a browser restart.
const passKey = (tabId) => `pass:${tabId}`;

export async function getPass(tabId) {
  const key = passKey(tabId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] ?? null;
}

export async function savePass(tabId, pass) {
  await chrome.storage.session.set({ [passKey(tabId)]: pass });
}

export async function clearPass(tabId) {
  await chrome.storage.session.remove(passKey(tabId));
}

export async function clearAllPasses() {
  const stored = await chrome.storage.session.get(null);
  const keys = Object.keys(stored).filter((key) => key.startsWith('pass:'));
  if (keys.length > 0) await chrome.storage.session.remove(keys);
}
