import { DEFAULT_MESSAGE, getSettings, saveSettings } from '../storage.js';
import { addSite } from '../domains.js';
import { isBlockedNow, nextBoundary, validateSchedule, formatTime } from '../schedule.js';

const STATUS_REFRESH_MS = 30_000;
const SAVED_FLASH_MS = 1500;

const byId = (id) => document.getElementById(id);
const dayBoxes = () => [...byId('days').querySelectorAll('input[type="checkbox"]')];

let settings;

init();

async function init() {
  settings = await getSettings();
  renderStatus();
  renderSites();
  renderSchedule();
  byId('message').value = settings.message;

  byId('add-site').addEventListener('submit', onAddSite);
  byId('schedule-form').addEventListener('input', renderScheduleValidation);
  byId('schedule-form').addEventListener('submit', onSaveSchedule);
  byId('message-form').addEventListener('submit', onSaveMessage);
  byId('reset-message').addEventListener('click', onResetMessage);

  // Keep the list and status current if settings change elsewhere (e.g. another options tab).
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    settings = await getSettings();
    renderSites();
    renderStatus();
  });
  setInterval(renderStatus, STATUS_REFRESH_MS);
}

async function update(changes) {
  settings = { ...settings, ...changes };
  await saveSettings(settings);
  renderStatus();
}

function renderStatus() {
  const now = new Date();
  const next = nextBoundary(settings.schedule, now);
  let text = 'No blocking scheduled.';
  if (isBlockedNow(settings.schedule, now)) {
    text = `Blocking active until ${formatTime(next)}.`;
  } else if (next) {
    const weekday = next.toLocaleDateString([], { weekday: 'short' });
    text = `Next block starts ${weekday} ${formatTime(next)}.`;
  }
  byId('status').textContent = text;
}

function renderSites() {
  const list = byId('sites');
  list.replaceChildren(
    ...settings.sites.map((site) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = site;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${site}`);
      remove.addEventListener('click', () => update({ sites: settings.sites.filter((s) => s !== site) }));
      item.append(name, remove);
      return item;
    }),
  );
}

async function onAddSite(event) {
  event.preventDefault();
  const input = byId('site-input');
  const result = addSite(settings.sites, input.value);
  showError('site-error', result.error);
  if (result.error) return;
  input.value = '';
  await update({ sites: result.sites });
  renderSites();
}

function renderSchedule() {
  const { days, start, end } = settings.schedule;
  for (const box of dayBoxes()) box.checked = days.includes(Number(box.value));
  byId('start').value = start;
  byId('end').value = end;
  renderScheduleValidation();
}

function readScheduleForm() {
  return {
    days: dayBoxes().filter((box) => box.checked).map((box) => Number(box.value)).sort(),
    start: byId('start').value,
    end: byId('end').value,
  };
}

function renderScheduleValidation() {
  const error = validateSchedule(readScheduleForm());
  showError('schedule-error', error);
  byId('save-schedule').disabled = Boolean(error);
}

async function onSaveSchedule(event) {
  event.preventDefault();
  const schedule = readScheduleForm();
  if (validateSchedule(schedule)) return;
  await update({ schedule });
  flash('schedule-saved');
}

async function onSaveMessage(event) {
  event.preventDefault();
  const message = byId('message').value.trim() || DEFAULT_MESSAGE;
  byId('message').value = message;
  await update({ message });
  flash('message-saved');
}

async function onResetMessage() {
  byId('message').value = DEFAULT_MESSAGE;
  await update({ message: DEFAULT_MESSAGE });
  flash('message-saved');
}

function showError(id, error) {
  byId(id).textContent = error ?? '';
  byId(id).hidden = !error;
}

function flash(id) {
  byId(id).hidden = false;
  setTimeout(() => { byId(id).hidden = true; }, SAVED_FLASH_MS);
}
