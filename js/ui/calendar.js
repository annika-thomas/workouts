import { el, clear, haptic } from '../util/dom.js';
import { iconEl } from './icons.js';
import { faceEl, faceForDay, primaryWorkout } from './face.js';
import { store } from '../store.js';
import { typeInfo } from '../types.js';
import {
  monthGrid, monthName, weekdayLabels, todayKey, toKey, formatDay, relativeDay,
} from '../util/date.js';
import { formatDuration, formatDistance, distanceLabel, kmToDisplay, round } from '../util/units.js';
import { openDay } from './day.js';

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
    const tKey = todayKey();
    const isThisMonth = year === today.getFullYear() && month === today.getMonth();

    // --- header ----------------------------------------------------------
    root.append(el('div', { class: 'cal-head-wrap' },
      el('div', { class: 'cal-head' },
        el('button', { class: 'icon-btn', 'aria-label': 'Previous month', onclick: () => shift(-1) }, iconEl('chevronLeft')),
        el('h2', { class: 'month' }, monthName(year, month), ' ', el('span', {}, String(year))),
        el('button', { class: 'icon-btn', 'aria-label': 'Next month', onclick: () => shift(1) }, iconEl('chevronRight')),
      ),
      !isThisMonth
        ? el('button', {
          class: 'btn btn-ghost btn-sm cal-today-btn',
          onclick: () => { ctx.cal = { year: today.getFullYear(), month: today.getMonth() }; render(); },
        }, 'Today')
        : null,
    ));

    // --- weekday header + grid -------------------------------------------
    root.append(el('div', { class: 'cal-dow' },
      ...weekdayLabels(settings.weekStart).map((d) => el('span', {}, d)),
    ));

    const grid = el('div', { class: 'cal-grid' });
    for (const cell of monthGrid(year, month, settings.weekStart)) {
      // Leading/trailing cells stay as empty space — the faces read better
      // without faded neighbours crowding them.
      if (!cell.inMonth) { grid.append(el('div', { class: 'day is-blank' })); continue; }
      grid.append(dayCell(cell, byDay[cell.key] || [], tKey));
    }
    root.append(grid);
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
    root.append(el('div', { class: 'stat-row', style: { marginTop: '16px' } },
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

/** One day: a pastel bubble with a face, and the date underneath. */
function dayCell(cell, items, tKey) {
  const dayMeta = store.day(cell.key);
  const face = faceForDay(items);
  const primary = primaryWorkout(items);
  const secondary = items.find((w) => w !== primary && w.type !== primary?.type);

  const classes = ['day'];
  if (!face) classes.push('is-empty');
  if (cell.key > tKey) classes.push('is-future');
  if (cell.key === tKey) classes.push('is-today');

  const bubble = el('div', {
    class: 'bubble',
    style: primary ? { '--fill': typeInfo(primary.type).color } : null,
  }, face ? faceEl(face) : null);

  if (items.length > 1) {
    bubble.append(el('span', {
      class: 'extra',
      style: { '--extra': typeInfo((secondary || items[1]).type).color },
      title: `${items.length} workouts`,
    }, items.length > 2 ? String(items.length) : ''));
  }

  const label = [
    formatDay(cell.key, true),
    items.length ? items.map((w) => typeInfo(w.type).label).join(', ') : 'nothing logged',
  ].join(' — ');

  return el('button', {
    class: classes.join(' '),
    'aria-label': label,
    onclick: () => { haptic(); openDay(cell.key); },
  },
    bubble,
    el('span', { class: 'num' },
      String(cell.day),
      dayMeta ? el('i', { title: 'Sleep or notes logged' }) : null,
    ),
  );
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
  const hit = goal && weekly.count >= goal;
  return el('div', { class: 'card', style: { marginTop: '12px' } },
    el('div', { class: 'row', style: { paddingTop: '0' } },
      el('span', { class: 'emo', style: { background: '#fdeacc' } }, '🔥'),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, current ? `${current} day${current === 1 ? '' : 's'} in a row` : 'No streak going'),
        el('div', { class: 'row-sub' }, best ? `Longest: ${best} day${best === 1 ? '' : 's'}` : 'Log a workout to start one'),
      ),
    ),
    el('div', { class: 'row', style: { paddingBottom: '0' } },
      el('span', { class: 'emo', style: { background: hit ? '#d9efd4' : '#e3ecfa' } }, hit ? '🎉' : '🎯'),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, `${weekly.count}${goal ? ` of ${goal}` : ''} this week`),
        el('div', { class: 'row-sub' },
          goal
            ? (hit ? 'Weekly goal hit. Nice.' : `${goal - weekly.count} to go`)
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
        el('div', { style: { fontSize: '30px', marginBottom: '8px' } }, '🌱'),
        'Tap a day, or the button below, to log your first workout.',
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
      class: 'wo', style: { marginBottom: '6px', boxShadow: 'none', background: 'var(--surface-2)' },
      onclick: () => openDay(w.date),
    },
      el('div', { class: 'ic', style: { background: t.color } }, t.icon),
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
