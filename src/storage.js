export const DEFAULT_MESSAGE = 'This site is blocked during focus hours. Get back to it.';

export const DEFAULT_SETTINGS = Object.freeze({
  sites: ['reddit.com', 'youtube.com'],
  schedule: { days: [1, 2, 3, 4, 5], start: '10:00', end: '16:00' },
  message: DEFAULT_MESSAGE,
});

export async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const defaults = structuredClone(DEFAULT_SETTINGS);
  return {
    ...defaults,
    ...settings,
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
