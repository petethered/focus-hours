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

export async function getAttempts() {
  const { attempts = null } = await chrome.storage.local.get('attempts');
  return attempts;
}

export async function saveAttempts(attempts) {
  await chrome.storage.local.set({ attempts });
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
