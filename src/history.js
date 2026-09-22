// Day-by-day record of what each blocked site cost you: the times you reached for
// it, and the times you unblocked it anyway.
//
// history: { "2026-09-22": { attempts: { "reddit.com": 7 }, unblocks: { "reddit.com": 1 } } }

export const RETAINED_DAYS = 90;
export const CHART_DAYS = 14;

export function localDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dayCount(history, kind, site, date) {
  return history?.[localDateKey(date)]?.[kind]?.[site] ?? 0;
}

// Returns the updated history and the new count for that site today.
export function recordEvent(history, kind, site, date) {
  const key = localDateKey(date);
  const day = history?.[key] ?? { attempts: {}, unblocks: {} };
  const counts = { ...day[kind], [site]: (day[kind]?.[site] ?? 0) + 1 };
  return {
    history: { ...history, [key]: { ...day, [kind]: counts } },
    count: counts[site],
  };
}

export function pruneHistory(history, date, days = RETAINED_DAYS) {
  const oldest = new Date(date.getFullYear(), date.getMonth(), date.getDate() - days + 1);
  const cutoff = localDateKey(oldest);
  return Object.fromEntries(Object.entries(history ?? {}).filter(([key]) => key >= cutoff));
}

const sum = (counts) => Object.values(counts).reduce((total, n) => total + n, 0);

// Everything the stats section shows, worked out in one pass: a bar per day
// (including the quiet ones), the sites that make up those bars, and the numbers
// that sit beside the chart.
export function summarize(history = {}, date, days = CHART_DAYS) {
  const span = Math.max(1, days);
  const series = [];
  for (let offset = span - 1; offset >= 0; offset--) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
    const key = localDateKey(day);
    const bySite = history[key]?.attempts ?? {};
    series.push({ date: key, day, total: sum(bySite), bySite });
  }

  const totals = {};
  let unblocks = 0;
  for (const { bySite, date: key } of series) {
    for (const [site, count] of Object.entries(bySite)) {
      totals[site] = (totals[site] ?? 0) + count;
    }
    unblocks += sum(history[key]?.unblocks ?? {});
  }

  const total = sum(totals);
  const sites = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
  const withAttempts = series.filter((entry) => entry.total > 0);
  const busiest = withAttempts.reduce(
    (best, entry) => (best === null || entry.total > best.total ? entry : best),
    null,
  );
  const quietest = withAttempts.reduce(
    (best, entry) => (best === null || entry.total < best.total ? entry : best),
    null,
  );

  return {
    series,
    sites,
    totals,
    total,
    unblocks,
    today: series[series.length - 1].total,
    average: total === 0 ? 0 : Math.round((total / withAttempts.length) * 10) / 10,
    topSite: sites.length === 0 ? null : { site: sites[0], count: totals[sites[0]] },
    busiest,
    quietest,
  };
}
