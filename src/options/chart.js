// A stacked bar per day: how many times each blocked site was reached for.
// Plain SVG, sized by viewBox, coloured from the --series-* tokens so the chart
// follows the page's light and dark themes.

const SVG_NS = 'http://www.w3.org/2000/svg';

const VIEW = { width: 560, height: 180 };
const PAD = { top: 10, right: 6, bottom: 24, left: 30 };
const PLOT = {
  width: VIEW.width - PAD.left - PAD.right,
  height: VIEW.height - PAD.top - PAD.bottom,
};
const BAR_SHARE = 0.62; // of each day's slot, leaving the rest as breathing room
const SEGMENT_GAP = 2; // surface showing between stacked segments
const CORNER = 4; // rounded data end, at the top of each bar

export const SERIES_LIMIT = 6; // hues in the token set; the rest share "other"
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const element = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

export function seriesColor(sites, site) {
  const index = sites.indexOf(site);
  return index >= 0 && index < SERIES_LIMIT
    ? `var(--series-${index + 1})`
    : 'var(--series-other)';
}

// Sites past the hue set are folded into one "other" series rather than given a
// colour of their own.
export function seriesFor(sites) {
  const named = sites.slice(0, SERIES_LIMIT).map((site) => ({ site, label: site }));
  return sites.length > SERIES_LIMIT
    ? [...named, { site: null, label: `${sites.length - SERIES_LIMIT} other sites` }]
    : named;
}

// An even number above the tallest bar: the halfway tick stays whole, and the
// direct label above that bar always has room.
export function niceMaximum(value) {
  const even = Math.max(4, Math.ceil(value / 2) * 2);
  return even === value ? even + 2 : even;
}

const formatDay = (day) =>
  day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

// The topmost segment of a bar carries the rounded end; the ones below are square.
function barSegment({ x, y, width, height, radius }) {
  if (radius === 0) return element('rect', { x, y, width, height });
  const r = Math.min(radius, width / 2, height);
  const path = [
    `M${x} ${y + height}`,
    `V${y + r}`,
    `a${r} ${r} 0 0 1 ${r} ${-r}`,
    `h${width - 2 * r}`,
    `a${r} ${r} 0 0 1 ${r} ${r}`,
    `V${y + height}`,
    'Z',
  ].join(' ');
  return element('path', { d: path });
}

export function renderChart({ stats, onHover }) {
  const svg = element('svg', {
    viewBox: `0 0 ${VIEW.width} ${VIEW.height}`,
    class: 'chart',
    role: 'img',
    'aria-label': `Attempts per day over the last ${stats.series.length} days, by site. ${stats.total} in total.`,
  });

  const maximum = niceMaximum(Math.max(...stats.series.map((day) => day.total), 1));
  const scale = (value) => (value / maximum) * PLOT.height;
  const slot = PLOT.width / stats.series.length;
  const barWidth = slot * BAR_SHARE;

  for (const value of [0, maximum / 2, maximum]) {
    const y = PAD.top + PLOT.height - scale(value);
    svg.append(
      element('line', {
        class: 'chart-grid',
        x1: PAD.left,
        x2: PAD.left + PLOT.width,
        y1: y,
        y2: y,
      }),
      Object.assign(element('text', { class: 'chart-tick', x: PAD.left - 8, y: y + 4 }), {
        textContent: String(value),
      }),
    );
  }

  const busiest = stats.busiest?.date ?? null;

  stats.series.forEach((day, index) => {
    const x = PAD.left + index * slot + (slot - barWidth) / 2;
    const stack = stats.sites
      .map((site) => ({ site, count: day.bySite[site] ?? 0 }))
      .filter(({ count }) => count > 0);
    let top = PAD.top + PLOT.height;

    stack.forEach(({ site, count }, position) => {
      const full = scale(count);
      const height = Math.max(full - SEGMENT_GAP, 1);
      top -= full;
      const segment = barSegment({
        x,
        y: top,
        width: barWidth,
        height,
        radius: position === stack.length - 1 ? CORNER : 0,
      });
      segment.setAttribute('fill', seriesColor(stats.sites, site));
      segment.setAttribute('class', 'chart-bar');
      segment.append(
        Object.assign(element('title'), {
          textContent: `${formatDay(day.day)}: ${count} × ${site}`,
        }),
      );
      if (onHover) {
        segment.addEventListener('mouseenter', () =>
          onHover(`${formatDay(day.day)}: ${count} × ${site}`),
        );
        segment.addEventListener('mouseleave', () => onHover(null));
      }
      svg.append(segment);
    });

    svg.append(
      Object.assign(
        element('text', {
          class: 'chart-day',
          x: x + barWidth / 2,
          y: VIEW.height - 8,
          'text-anchor': 'middle',
        }),
        {
          textContent:
            index === stats.series.length - 1
              ? 'today'
              : WEEKDAY_INITIALS[day.day.getDay()],
        },
      ),
    );

    // One direct label, on the day that stands out.
    if (day.date === busiest && day.total > 0) {
      svg.append(
        Object.assign(
          element('text', {
            class: 'chart-value',
            x: x + barWidth / 2,
            y: PAD.top + PLOT.height - scale(day.total) - 5,
            'text-anchor': 'middle',
          }),
          { textContent: String(day.total) },
        ),
      );
    }
  });

  return svg;
}

// One series names itself in the caption; a legend starts at two.
export function renderLegend(stats) {
  if (stats.sites.length < 2) return null;
  const list = document.createElement('ul');
  list.className = 'legend';
  for (const { site, label } of seriesFor(stats.sites)) {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = site ? seriesColor(stats.sites, site) : 'var(--series-other)';
    const text = document.createElement('span');
    text.textContent = label;
    item.append(swatch, text);
    list.append(item);
  }
  return list;
}

// The same numbers as a table, for anyone who would rather read them.
export function renderTiles(stats) {
  const day = (entry) =>
    entry === null
      ? '—'
      : `${entry.day.toLocaleDateString([], { weekday: 'short' })} ${entry.day.getDate()}`;
  const oneActiveDay = stats.busiest !== null && stats.busiest.date === stats.quietest.date;

  const tiles = [
    ['Today', String(stats.today), `${stats.average} a day on the days you tried`],
    [
      'Reached for most',
      stats.topSite ? stats.topSite.site : '—',
      stats.topSite
        ? `${stats.topSite.count} of ${stats.total} attempts (${Math.round((stats.topSite.count / stats.total) * 100)}%)`
        : 'nothing yet',
    ],
    [
      'Unblocked',
      String(stats.unblocks),
      stats.unblocks === 0 ? 'you never caved' : `out of ${stats.total} attempts`,
    ],
    [
      'Busiest day',
      day(stats.busiest),
      oneActiveDay
        ? 'your only day so far'
        : stats.quietest
          ? `quietest ${day(stats.quietest)} (${stats.quietest.total})`
          : '',
    ],
  ];

  const list = document.createElement('div');
  list.className = 'tiles';
  for (const [label, value, note] of tiles) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.append(
      Object.assign(document.createElement('span'), { className: 'tile-label', textContent: label }),
      Object.assign(document.createElement('strong'), { className: 'tile-value', textContent: value }),
      Object.assign(document.createElement('span'), { className: 'tile-note', textContent: note }),
    );
    list.append(tile);
  }
  return list;
}

export function renderTable(stats) {
  const table = document.createElement('table');
  table.className = 'chart-table';

  const head = table.createTHead().insertRow();
  for (const heading of ['Day', ...stats.sites, 'Total']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = heading;
    head.append(cell);
  }

  const body = table.createTBody();
  for (const day of stats.series) {
    const row = body.insertRow();
    const header = document.createElement('th');
    header.scope = 'row';
    header.textContent = formatDay(day.day);
    row.append(header);
    for (const site of stats.sites) {
      row.insertCell().textContent = String(day.bySite[site] ?? 0);
    }
    row.insertCell().textContent = String(day.total);
  }

  return table;
}
