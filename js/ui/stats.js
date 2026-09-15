import { el, clear } from '../util/dom.js';
import { store } from '../store.js';
import { typeInfo } from '../types.js';
import { todayKey, addDays, fromKey, monthShort, weekStartKey } from '../util/date.js';
import {
  formatDuration, formatDistance, formatSleep, kmToDisplay, distanceLabel, round,
} from '../util/units.js';

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

    root.append(weeklyChart());
    root.append(typeBreakdown(s, units));
    root.append(consistencyCard(from, to));
    root.append(sleepCard(from, to));
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

/** A GitHub-style dot grid: one column per week, one row per weekday. */
function consistencyCard(from, to) {
  const ws = store.settings.weekStart;
  const start = weekStartKey(from, ws);
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
  // Keep it readable on a phone: at most the last 26 weeks.
  const shown = cols.slice(-26);

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
      'One square per day, coloured by activity. Rows are weekdays.'),
  );
}

function sleepCard(from, to) {
  const days = Object.values(store.state.days)
    .filter((d) => d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const sleeps = days.filter((d) => d.sleepHours != null);
  const weights = days.filter((d) => d.weightKg != null);
  const rhr = days.filter((d) => d.restingHr != null);
  if (!sleeps.length && !weights.length && !rhr.length) return el('span', {});

  const units = store.settings.units;
  const rows = [];
  if (sleeps.length) {
    const avg = sleeps.reduce((a, d) => a + d.sleepHours, 0) / sleeps.length;
    rows.push(['🌙', '#e3ecfa', 'Average sleep', `${formatSleep(avg)} over ${sleeps.length} nights`]);
  }
  if (rhr.length) {
    const avg = rhr.reduce((a, d) => a + d.restingHr, 0) / rhr.length;
    rows.push(['❤️', '#fbe2e4', 'Resting HR', `${Math.round(avg)} bpm average`]);
  }
  if (weights.length) {
    const first = weights[0], last = weights[weights.length - 1];
    const delta = last.weightKg - first.weightKg;
    const cur = round(units === 'imperial' ? last.weightKg / 0.45359237 : last.weightKg, 1);
    const lbl = units === 'imperial' ? 'lb' : 'kg';
    const d = round(Math.abs(units === 'imperial' ? delta / 0.45359237 : delta), 1);
    rows.push(['⚖️', '#eae6f8', 'Weight', `${cur} ${lbl}${weights.length > 1 && d > 0 ? ` (${delta > 0 ? '+' : '−'}${d} over range)` : ''}`]);
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
