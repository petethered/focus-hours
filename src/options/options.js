import { DEFAULT_MESSAGE, DEFAULT_SETTINGS, getSettings, saveSettings, getHistory } from '../storage.js';
import { CHART_DAYS, summarize } from '../history.js';
import { renderChart, renderLegend, renderTable, renderTiles } from './chart.js';
import { addSite, addSearchSource } from '../domains.js';
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
  await renderStats();
  renderSites();
  renderSources();
  renderSchedule();
  byId('message').value = settings.message;

  byId('lost-reopen').addEventListener('click', () => resolveLostPages('reopen'));
  byId('lost-dismiss').addEventListener('click', () => resolveLostPages('dismiss'));
  byId('add-site').addEventListener('submit', onAddSite);
  byId('add-source').addEventListener('submit', onAddSource);
  byId('reset-sources').addEventListener('click', onResetSources);
  byId('schedule-form').addEventListener('input', renderScheduleValidation);
  byId('schedule-form').addEventListener('submit', onSaveSchedule);
  byId('message-form').addEventListener('submit', onSaveMessage);
  byId('reset-message').addEventListener('click', onResetMessage);

  // Keep the list and status current if settings change elsewhere (e.g. another options tab).
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.history) await renderStats();
    if (!changes.settings) return;
    settings = await getSettings();
    renderSites();
    renderSources();
    renderStatus();
  });
  setInterval(renderStatus, STATUS_REFRESH_MS);
  await renderLostPages();
}

async function updateSettings(changes) {
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

// Pages that were open when the extension reloaded: Chrome closes every tab
// showing one of its pages, so they are offered back here.
async function renderLostPages(action = 'list') {
  const { pages = [] } = (await chrome.runtime.sendMessage({ type: 'lostPages', action })) ?? {};
  const banner = byId('lost');
  banner.hidden = pages.length === 0;
  if (pages.length === 0) return;
  const sites = [...new Set(pages.map((page) => page.site))].join(' and ');
  byId('lost-text').textContent =
    `${pages.length} ${pages.length === 1 ? 'page was' : 'pages were'} closed when the extension reloaded (${sites}).`;
}

async function resolveLostPages(action) {
  byId('lost-reopen').disabled = true;
  byId('lost-dismiss').disabled = true;
  try {
    await renderLostPages(action);
  } finally {
    byId('lost-reopen').disabled = false;
    byId('lost-dismiss').disabled = false;
  }
}

async function renderStats() {
  const stats = summarize(await getHistory(), new Date(), CHART_DAYS);
  const empty = stats.total === 0 && stats.unblocks === 0;
  byId('stats-empty').hidden = !empty;
  byId('stats-chart').hidden = empty;
  byId('stats-table-view').hidden = empty;
  if (empty) {
    byId('stats-tiles').replaceChildren();
    return;
  }

  byId('stats-tiles').replaceChildren(renderTiles(stats));

  const readout = byId('chart-readout');
  byId('chart-caption').textContent =
    stats.sites.length === 1
      ? `Attempts at ${stats.sites[0]} per day, over the last ${CHART_DAYS} days.`
      : `Attempts per day over the last ${CHART_DAYS} days, by site.`;
  byId('chart-plot').replaceChildren(
    renderChart({
      stats,
      onHover: (text) => {
        readout.textContent = text ?? '';
      },
    }),
    renderLegend(stats) ?? '',
  );

  byId('stats-table-view').replaceChildren(
    Object.assign(document.createElement('summary'), { textContent: 'Show the numbers' }),
    renderTable(stats),
  );
}

function renderSites() {
  const list = byId('sites');
  list.replaceChildren(
    ...settings.sites.map((site) => {
      const item = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = site.domain;

      const pass = document.createElement('input');
      pass.type = 'checkbox';
      pass.checked = site.searchPass;
      pass.id = `from-search-${site.domain}`;
      pass.addEventListener('change', () => setSearchPass(site.domain, pass.checked));

      const passLabel = document.createElement('label');
      passLabel.className = 'chip';
      passLabel.htmlFor = pass.id;
      passLabel.append(pass, `from search: ${site.domain}`);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${site.domain}`);
      remove.addEventListener('click', () => removeSite(site.domain));

      item.append(name, passLabel, remove);
      return item;
    }),
  );
}

function removeSite(domain) {
  return updateSettings({ sites: settings.sites.filter((site) => site.domain !== domain) });
}

function setSearchPass(domain, searchPass) {
  return updateSettings({
    sites: settings.sites.map((site) => (site.domain === domain ? { ...site, searchPass } : site)),
  });
}

async function onAddSite(event) {
  event.preventDefault();
  const input = byId('site-input');
  const result = addSite(settings.sites, input.value);
  showError('site-error', result.error);
  if (result.error) return;
  input.value = '';
  await updateSettings({ sites: result.sites });
  renderSites();
}

function renderSources() {
  const count = settings.searchSources.length;
  byId('sources-summary').textContent =
    count === 0 ? 'No search sources, so from search lets nothing through.' : `Show all ${count} ${count === 1 ? 'source' : 'sources'}`;
  byId('sources').replaceChildren(
    ...settings.searchSources.map((host) => {
      const item = document.createElement('li');

      const name = document.createElement('span');
      name.textContent = host;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${host}`);
      remove.addEventListener('click', () => removeSource(host));

      item.append(name, remove);
      return item;
    }),
  );
}

function removeSource(host) {
  return updateSettings({ searchSources: settings.searchSources.filter((source) => source !== host) });
}

async function onAddSource(event) {
  event.preventDefault();
  const input = byId('source-input');
  const result = addSearchSource(settings.searchSources, input.value);
  showError('source-error', result.error);
  if (result.error) return;
  input.value = '';
  await updateSettings({ searchSources: result.sources });
  renderSources();
}

async function onResetSources() {
  showError('source-error', null);
  byId('source-input').value = '';
  await updateSettings({ searchSources: [...DEFAULT_SETTINGS.searchSources] });
  renderSources();
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
  await updateSettings({ schedule });
  flash('schedule-saved');
}

async function onSaveMessage(event) {
  event.preventDefault();
  const message = byId('message').value.trim() || DEFAULT_MESSAGE;
  byId('message').value = message;
  await updateSettings({ message });
  flash('message-saved');
}

async function onResetMessage() {
  byId('message').value = DEFAULT_MESSAGE;
  await updateSettings({ message: DEFAULT_MESSAGE });
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
