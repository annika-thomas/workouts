import { el, clear } from '../util/dom.js';
import { store } from '../store.js';
import { typeInfo } from '../types.js';
import { todayKey, addDays, fromKey, monthShort, weekStartKey } from '../util/date.js';
import {
  formatDuration, formatDistance, formatSleep, kmToDisplay, distanceLabel,
  weightLabel, kgToDisplay, round,
} from '../util/units.js';
import { DIET } from '../metrics.js';

const RANGES = [
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: '365', label: 'Year', days: 365 },
  { key: 'all', label: 'All', days: null },
];

export function statsView(root, ctx) {
  ctx.statsRange ||= '30';

  function render() {
    clear(root);
    const units = store.settings.units;
    const range = RANGES.find((r) => r.key === ctx.statsRange) || RANGES[0];
    const to = todayKey();
    const from = range.days ? addDays(to, -(range.days - 1)) : earliestDate();
    const s = store.summary(from, to);

    // Range switcher
    root.append(el('div', { class: 'seg', style: { marginBottom: '14px' } },
      ...RANGES.map((r) => el('button', {
        'aria-pressed': String(r.key === ctx.statsRange),
        onclick: () => { ctx.statsRange = r.key; render(); },
      }, r.label)),
    ));

    // Headline numbers
    root.append(el('div', { class: 'stat-row' },
      box(s.sessions, '', 'sessions'),
      box(s.activeDays, '', 'active'),
      box(formatDuration(s.minutes) || '0m', '', 'time'),
      s.km > 0 ? box(round(kmToDisplay(s.km, units), 1), distanceLabel(units), 'distance') : null,
    ));

    root.append(el('div', { class: 'stat-row', style: { marginTop: '8px' } },
      box(store.currentStreak(), '', 'streak'),
      box(store.longestStreak(), '', 'best'),
      box(perWeek(s.sessions, from, to), '', 'per week'),
      s.avgSleep != null ? box(formatSleep(s.avgSleep), '', 'sleep') : null,
    ));

    for (const card of [
      weeklyChart(),
      typeBreakdown(s, units),
      consistencyCard(),
      weightCard(from, to),
      drinksCard(from, to),
      foodCard(from, to),
      sleepCard(from, to),
    ]) {
      if (card) root.append(card);
    }
  }

  render();
  return render;
}

function earliestDate() {
  const dates = [
    ...store.workouts.map((w) => w.date),
    ...Object.keys(store.state.days),
  ].sort();
  return dates[0] || todayKey();
}

function perWeek(sessions, from, to) {
  const days = Math.max(1, (fromKey(to) - fromKey(from)) / 86400000 + 1);
  return round((sessions / days) * 7, 1);
}

function box(value, unit, label) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return el('div', { class: 'stat' },
    el('div', { class: `v${text.length >= 6 ? ' is-long' : ''}` }, text, unit ? el('small', {}, unit) : null),
    el('div', { class: 'k' }, label),
  );
}

function weeklyChart() {
  const weeks = store.weeklyCounts(12);
  const goal = store.settings.weeklyGoal || 0;
  const max = Math.max(goal, ...weeks.map((w) => w.count), 1);

  const bars = el('div', { class: 'bars' },
    ...weeks.map((w, i) => {
      const pct = (w.count / max) * 100;
      const d = fromKey(w.start);
      const isCurrent = i === weeks.length - 1;
      return el('div', { class: 'bar-col' },
        el('div', { class: 'bar-val' }, w.count ? String(w.count) : ''),
        el('div', {
          class: w.count ? 'bar' : 'bar dim',
          style: {
            height: `${Math.max(pct, w.count ? 6 : 2)}%`,
            opacity: isCurrent ? '.65' : '1',
            // Goal met is solid; short of it stays a softer green.
            background: w.count === 0 ? 'var(--surface-2)'
              : !goal || w.count >= goal ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 40%, var(--surface))',
          },
          title: `${w.count} sessions, week of ${w.start}`,
        }),
        el('div', { class: 'bar-lbl' }, `${monthShort(d.getMonth()).slice(0, 1)}${d.getDate()}`),
      );
    }),
  );

  return el('div', { class: 'card', style: { marginTop: '14px' } },
    el('div', { class: 'card-title' }, `Sessions per week${goal ? ` · goal ${goal}` : ''}`),
    bars,
    el('div', { class: 'tiny muted', style: { marginTop: '6px' } },
      'Last 12 weeks. The final bar is the week in progress.'),
  );
}

function typeBreakdown(summary, units) {
  const entries = Object.entries(summary.byType).sort((a, b) => b[1].count - a[1].count);
  if (!entries.length) {
    return el('div', { class: 'card' }, el('div', { class: 'empty' }, 'No workouts in this range yet.'));
  }
  const max = Math.max(...entries.map(([, v]) => v.count));
  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'What you did'),
    el('div', { class: 'breakdown' },
      ...entries.map(([key, v]) => {
        const t = typeInfo(key);
        const detail = v.km > 0
          ? `${v.count} · ${formatDistance(v.km, units, 0)}`
          : v.minutes > 0 ? `${v.count} · ${formatDuration(v.minutes)}` : `${v.count}`;
        return el('div', { class: 'bd' },
          el('span', { class: 'e', style: { background: t.color } }, t.icon),
          el('span', { class: 'nm' }, t.label),
          el('span', { class: 'track' },
            el('span', { class: 'fill', style: { width: `${(v.count / max) * 100}%`, background: t.color } })),
          el('span', { class: 'n' }, detail),
        );
      }),
    ),
  );
}

const CONSISTENCY_WEEKS = 26;

/**
 * A GitHub-style dot grid: one column per week, one row per weekday.
 *
 * Deliberately fixed to half a year rather than following the range selector —
 * over 30 days it would be five columns of oversized dots, and the whole point
 * of this view is the long horizon.
 */
function consistencyCard() {
  const ws = store.settings.weekStart;
  const to = todayKey();
  const start = weekStartKey(addDays(to, -(CONSISTENCY_WEEKS * 7 - 1)), ws);
  const cols = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= to && guard++ < 400) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const key = addDays(cursor, i);
      const items = store.workoutsOn(key).filter((w) => w.type !== 'rest');
      week.push({ key, n: items.length, color: items[0] ? typeInfo(items[0].type).color : null, future: key > todayKey() });
    }
    cols.push(week);
    cursor = addDays(cursor, 7);
  }
  const shown = cols.slice(-CONSISTENCY_WEEKS);

  const grid = el('div', { class: 'dotgrid' });
  for (const week of shown) {
    for (const d of week) {
      grid.append(el('span', {
        title: `${d.key}: ${d.n} workout${d.n === 1 ? '' : 's'}`,
        style: {
          background: d.future ? 'transparent' : d.n ? d.color : 'var(--surface-2)',
        },
      }));
    }
  }

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Consistency'),
    grid,
    el('div', { class: 'tiny muted', style: { marginTop: '8px' } },
      `The last ${CONSISTENCY_WEEKS} weeks — one dot per day, coloured by activity. Rows are weekdays.`),
  );
}

function sleepCard(from, to) {
  const days = Object.values(store.state.days)
    .filter((d) => d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const sleeps = days.filter((d) => d.sleepHours != null);
  const rhr = days.filter((d) => d.restingHr != null);
  if (!sleeps.length && !rhr.length) return null;

  const rows = [];
  if (sleeps.length) {
    const avg = sleeps.reduce((a, d) => a + d.sleepHours, 0) / sleeps.length;
    rows.push(['🌙', '#e3ecfa', 'Average sleep', `${formatSleep(avg)} over ${sleeps.length} nights`]);
  }
  if (rhr.length) {
    const avg = rhr.reduce((a, d) => a + d.restingHr, 0) / rhr.length;
    rows.push(['❤️', '#fbe2e4', 'Resting HR', `${Math.round(avg)} bpm average`]);
  }

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Body & recovery'),
    ...rows.map(([icon, tint, title, sub]) => el('div', { class: 'row' },
      el('span', { class: 'emo', style: { background: tint } }, icon),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, title),
        el('div', { class: 'row-sub' }, sub),
      ),
    )),
  );
}

/**
 * A small line chart. Rendered at a nominal 320-wide viewBox and scaled to
 * the card, so strokes stay even without a layout pass.
 */
function lineChart(points, { format = (v) => String(v), color = 'var(--accent)' } = {}) {
  const W = 320, H = 130, padL = 34, padR = 8, padT = 12, padB = 20;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'linechart');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;

  const x = (i) => padL + (points.length === 1 ? (W - padL - padR) / 2
    : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const add = (tag, attrs, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    svg.append(n);
    return n;
  };

  // Gridlines and value labels at the top and bottom of the plotted band.
  for (const v of [max - span * 0.12, min + span * 0.12]) {
    add('line', { class: 'gl', x1: padL, x2: W - padR, y1: y(v), y2: y(v) });
    add('text', { x: 2, y: y(v) + 3.5 }, format(v));
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  if (points.length > 1) {
    add('path', { class: 'ar', d: `${d} L${x(points.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z` });
    add('path', { class: 'ln', d, style: `stroke:${color}` });
  }
  // Dots only while they stay legible.
  if (points.length <= 40) {
    for (const [i, p] of points.entries()) {
      add('circle', { class: 'pt', cx: x(i), cy: y(p.value), r: points.length > 20 ? 1.8 : 2.6, style: `fill:${color}` });
    }
  }

  add('text', { x: padL, y: H - 5 }, shortDate(points[0].date));
  if (points.length > 1) {
    add('text', { x: W - padR, y: H - 5, 'text-anchor': 'end' }, shortDate(points.at(-1).date));
  }
  return svg;
}

function shortDate(key) {
  const d = fromKey(key);
  return `${monthShort(d.getMonth())} ${d.getDate()}`;
}

/** Weight over the selected range, with the change across it. */
function weightCard(from, to) {
  const units = store.settings.units;
  const points = store.daysIn(from, to)
    .filter((d) => d.weightKg != null)
    .map((d) => ({ date: d.date, value: kgToDisplay(d.weightKg, units) }));
  if (!points.length) return null;

  const lbl = weightLabel(units);
  const first = points[0].value;
  const last = points.at(-1).value;
  const delta = last - first;
  const fmt = (v) => round(v, 1).toFixed(1);

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Weight'),
    el('div', { class: 'row', style: { paddingTop: '0', borderBottom: 'none' } },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', style: { fontSize: '22px', fontWeight: '800', letterSpacing: '-.03em' } },
          `${fmt(last)} ${lbl}`),
        el('div', { class: 'row-sub' },
          points.length === 1
            ? 'One weigh-in in this range'
            : `${delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} ${lbl}`} over ${points.length} weigh-ins`),
      ),
    ),
    points.length > 1 ? lineChart(points, { format: fmt }) : null,
  );
}

/** Drinking pattern over the selected range. */
function drinksCard(from, to) {
  const days = store.daysIn(from, to).filter((d) => d.drinks != null);
  if (!days.length) return null;

  const total = days.reduce((sum, d) => sum + d.drinks, 0);
  const free = days.filter((d) => d.drinks === 0).length;
  const spanDays = Math.max(1, (fromKey(to) - fromKey(from)) / 86400000 + 1);
  const perWeek = round((total / spanDays) * 7, 1);
  const since = store.daysSinceLastDrink();

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Drinks'),
    el('div', { class: 'stat-row' },
      box(total, '', 'total'),
      box(perWeek, '', 'per week'),
      box(`${free}/${days.length}`, '', 'free days'),
      since != null ? box(since, '', 'days since') : null,
    ),
  );
}

/** How the eating went, as a distribution across the five steps. */
function foodCard(from, to) {
  const days = store.daysIn(from, to).filter((d) => d.diet != null);
  if (!days.length) return null;

  const counts = DIET.map((d) => ({ ...d, n: days.filter((x) => x.diet === d.value).length }));
  const max = Math.max(...counts.map((c) => c.n));
  const avg = days.reduce((sum, d) => sum + d.diet, 0) / days.length;

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, `How you ate · ${days.length} day${days.length === 1 ? '' : 's'} logged`),
    el('div', { class: 'breakdown' },
      ...counts.slice().reverse().map((c) => el('div', { class: 'bd' },
        el('span', { class: 'e', style: { background: c.color } }, c.icon),
        el('span', { class: 'nm' }, c.label),
        el('span', { class: 'track' },
          el('span', { class: 'fill', style: { width: `${max ? (c.n / max) * 100 : 0}%`, background: c.color } })),
        el('span', { class: 'n' }, String(c.n)),
      )),
    ),
    el('div', { class: 'tiny muted', style: { marginTop: '10px' } },
      `Averaging ${round(avg, 1)} out of 5.`),
  );
}
