import { el, clear, haptic } from '../util/dom.js';
import { iconEl } from './icons.js';
import { store } from '../store.js';
import { typeInfo } from '../types.js';
import {
  monthGrid, monthName, weekdayLabels, todayKey, toKey, formatDay, relativeDay,
} from '../util/date.js';
import { formatDuration, formatDistance, distanceLabel, kmToDisplay, round } from '../util/units.js';
import { openDay } from './day.js';

const MAX_DOTS = 3;

export function calendarView(root, ctx) {
  const today = new Date();
  // Cursor persists across tab switches within a session.
  ctx.cal ||= { year: today.getFullYear(), month: today.getMonth() };

  function render() {
    clear(root);
    const { year, month } = ctx.cal;
    const settings = store.settings;
    const mKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const byDay = store.workoutsByDay(mKey);

    // --- header ----------------------------------------------------------
    const isThisMonth = year === today.getFullYear() && month === today.getMonth();
    root.append(el('div', { class: 'cal-head' },
      el('button', {
        class: 'icon-btn', 'aria-label': 'Previous month',
        onclick: () => { shift(-1); },
      }, iconEl('chevronLeft')),
      el('h2', { class: 'month' }, monthName(year, month), ' ', el('span', {}, String(year))),
      !isThisMonth
        ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ctx.cal = { year: today.getFullYear(), month: today.getMonth() }; render(); } }, 'Today')
        : null,
      el('button', {
        class: 'icon-btn', 'aria-label': 'Next month',
        onclick: () => { shift(1); },
      }, iconEl('chevronRight')),
    ));

    // --- weekday header + grid -------------------------------------------
    root.append(el('div', { class: 'cal-dow' },
      ...weekdayLabels(settings.weekStart).map((d, i) => el('span', { key: i }, d)),
    ));

    const grid = el('div', { class: 'cal-grid' });
    const tKey = todayKey();
    for (const cell of monthGrid(year, month, settings.weekStart)) {
      const items = byDay[cell.key] || (cell.inMonth ? [] : store.workoutsOn(cell.key));
      const real = items.filter((w) => w.type !== 'rest');
      const dayMeta = store.day(cell.key);
      const classes = ['cal-cell'];
      if (!cell.inMonth) classes.push('is-out');
      if (real.length) classes.push('is-active');
      if (cell.key === tKey) classes.push('is-today');

      const dots = el('div', { class: 'cal-dots' });
      for (const w of items.slice(0, MAX_DOTS)) {
        dots.append(el('i', { style: { background: typeInfo(w.type).color }, title: typeInfo(w.type).label }));
      }
      if (items.length > MAX_DOTS) dots.append(el('i', { class: 'more' }, `+${items.length - MAX_DOTS}`));

      grid.append(el('button', {
        class: classes.join(' '),
        'aria-label': `${formatDay(cell.key, true)}, ${items.length} workout${items.length === 1 ? '' : 's'}`,
        onclick: () => { haptic(); openDay(cell.key); },
      },
        dayMeta ? el('span', { class: 'mark', title: dayMeta.notes ? 'Has a note' : 'Sleep / body logged' }) : null,
        el('span', { class: 'num' }, String(cell.day)),
        dots,
      ));
    }
    root.append(grid);

    // Swipe between months.
    attachSwipe(grid, (dir) => shift(dir));

    // --- legend for the types actually used this month --------------------
    const used = [...new Set(Object.values(byDay).flat().map((w) => w.type))];
    if (used.length) {
      root.append(el('div', { class: 'cal-legend' },
        ...used.map((k) => {
          const t = typeInfo(k);
          return el('span', { class: 'lg' }, el('i', { style: { background: t.color } }), t.label);
        }),
      ));
    }

    // --- month summary ----------------------------------------------------
    const lastDay = new Date(year, month + 1, 0);
    const s = store.summary(`${mKey}-01`, toKey(lastDay));
    root.append(el('div', { class: 'stat-row', style: { marginTop: '14px' } },
      stat(s.sessions, '', 'sessions'),
      stat(s.activeDays, '', 'active'),
      stat(formatDuration(s.minutes) || '0m', '', 'time'),
      s.km > 0 ? stat(round(kmToDisplay(s.km, settings.units), 1), distanceLabel(settings.units), 'distance') : null,
    ));

    root.append(streakCard());
    root.append(recentCard());
  }

  function shift(dir) {
    let { year, month } = ctx.cal;
    month += dir;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    ctx.cal = { year, month };
    haptic(5);
    render();
  }

  render();
  return render;
}

function stat(value, unit, label) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return el('div', { class: 'stat' },
    el('div', { class: `v${text.length >= 6 ? ' is-long' : ''}` }, text, unit ? el('small', {}, unit) : null),
    el('div', { class: 'k' }, label),
  );
}

function streakCard() {
  const current = store.currentStreak();
  const best = store.longestStreak();
  const weekly = store.weeklyCounts(1)[0];
  const goal = store.settings.weeklyGoal || 0;
  return el('div', { class: 'card', style: { marginTop: '12px' } },
    el('div', { class: 'row', style: { paddingTop: '0' } },
      el('span', { style: { fontSize: '22px' } }, '🔥'),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, current ? `${current} day${current === 1 ? '' : 's'} in a row` : 'No streak going'),
        el('div', { class: 'row-sub' }, best ? `Longest: ${best} day${best === 1 ? '' : 's'}` : 'Log a workout to start one'),
      ),
    ),
    el('div', { class: 'row' },
      el('span', { style: { fontSize: '22px' } }, weekly.count >= goal && goal ? '✅' : '🎯'),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, `${weekly.count}${goal ? ` / ${goal}` : ''} this week`),
        el('div', { class: 'row-sub' },
          goal
            ? (weekly.count >= goal ? 'Weekly goal hit.' : `${goal - weekly.count} to go`)
            : 'No weekly goal set'),
      ),
    ),
  );
}

function recentCard() {
  const units = store.settings.units;
  const recent = store.workouts
    .filter((w) => w.date <= todayKey())
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
    .slice(0, 5);
  if (!recent.length) {
    return el('div', { class: 'card' },
      el('div', { class: 'empty' },
        el('div', { style: { fontSize: '28px', marginBottom: '6px' } }, '📔'),
        'Tap a day, or the + button, to log your first workout.',
      ));
  }
  const card = el('div', { class: 'card' }, el('div', { class: 'card-title' }, 'Recent'));
  for (const w of recent) {
    const t = typeInfo(w.type);
    const bits = [
      relativeDay(w.date) || formatDay(w.date),
      w.durationMin ? formatDuration(w.durationMin) : null,
      w.distanceKm ? formatDistance(w.distanceKm, units) : null,
    ].filter(Boolean);
    card.append(el('button', {
      class: 'wo', style: { marginBottom: '6px' },
      onclick: () => openDay(w.date),
    },
      el('div', { class: 'ic', style: { background: `color-mix(in srgb, ${t.color} 20%, transparent)` } }, t.icon),
      el('div', { class: 'body' },
        el('div', { class: 'name' }, w.title || t.label),
        el('div', { class: 'meta' }, ...bits.map((b) => el('span', {}, b))),
      ),
      w.source && w.source !== 'manual' ? el('span', { class: 'src' }, w.source) : null,
    ));
  }
  return card;
}

/** Horizontal swipe on the grid flips months; vertical scroll is left alone. */
function attachSwipe(node, onSwipe) {
  let x0 = null, y0 = null;
  node.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
}
