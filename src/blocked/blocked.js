import { parseBlockedUrl } from '../blockedUrl.js';
import { getSettings, getUnblocks, saveUnblocks, getAttempts, saveAttempts } from '../storage.js';
import { recordAttempt, attemptCount } from '../attempts.js';
import { HEADLINES, pickRandom, fillHeadline, attemptMessage } from '../content.js';
import { fetchQuote } from '../quote.js';
import { timeOnDate, formatTime } from '../schedule.js';

const UNBLOCK_DELAY_SECONDS = 10;
const UNBLOCK_DURATION_MS = 10 * 60 * 1000;

const byId = (id) => document.getElementById(id);
const page = parseBlockedUrl(location.href);

if (page) init();

async function init() {
  fetchQuote().then(renderQuote);
  startCountdown();

  const now = new Date();
  const settings = await getSettings();
  document.title = `${page.site} is blocked`;
  byId('headline').textContent = fillHeadline(pickRandom(HEADLINES), page.site);
  byId('site').textContent = page.site;
  byId('until').textContent = formatTime(timeOnDate(settings.schedule.end, now));
  byId('message').textContent = settings.message;
  renderVisited();
  renderAttempts(await recordAttemptIfNew(now));
}

function renderVisited() {
  if (!page.title && !page.url) return;
  byId('visited-title').textContent = page.title;
  byId('visited-title').hidden = !page.title;
  byId('visited-url').textContent = page.url;
  byId('visited').hidden = false;
}

// Saves and returns today's count, incremented only for a fresh navigation:
// not a tab swept here at a boundary, a reload, or back/forward history.
async function recordAttemptIfNew(now) {
  const attempts = await getAttempts();
  const [navigation] = performance.getEntriesByType('navigation');
  if (page.swept || navigation?.type !== 'navigate') {
    return attemptCount(attempts, page.site, now);
  }
  const result = recordAttempt(attempts, page.site, now);
  await saveAttempts(result.attempts);
  return result.count;
}

function renderAttempts(count) {
  const message = attemptMessage(count, page.site);
  if (!message) return;
  byId('attempts').textContent = message;
  byId('attempts').hidden = false;
}

function renderQuote({ text, author, source }) {
  byId('quote-text').textContent = text;
  byId('quote-author').textContent = `— ${author}`;
  byId('quote-credit').hidden = source !== 'api';
}

function startCountdown() {
  const button = byId('unblock');
  let remaining = UNBLOCK_DELAY_SECONDS;
  const update = () => {
    button.disabled = remaining > 0;
    button.textContent = remaining > 0 ? `Unblock for 10 min (${remaining})` : 'Unblock for 10 min';
  };
  update();
  const timer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    remaining -= 1;
    update();
    if (remaining === 0) clearInterval(timer);
  }, 1000);
  button.addEventListener('click', unblock);
}

// The service worker's sync() sees the storage change and navigates this tab back.
async function unblock() {
  const button = byId('unblock');
  button.disabled = true;
  button.textContent = 'Unblocking…';
  try {
    const unblocks = await getUnblocks();
    await saveUnblocks({ ...unblocks, [page.site]: Date.now() + UNBLOCK_DURATION_MS });
  } catch (error) {
    console.error('[focus-hours] unblock failed', error);
    button.disabled = false;
    button.textContent = 'Unblock failed. Try again';
  }
}
