import { el, clear, haptic } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { store } from '../store.js';
import { MUSCLES, muscleInfo, bestSet, formatSet, entryVolume } from '../exercises.js';
import { lineChart } from './chart.js';
import { todayKey, addDays, fromKey, weekStartKey, monthShort, formatDay, relativeDay } from '../util/date.js';
import { kgToDisplay, weightLabel, round } from '../util/units.js';

const RANGES = [
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: '365', label: 'Year', days: 365 },
  { key: 'all', label: 'All', days: null },
];

/** Strength progress, read one muscle group at a time. */
export function musclesView(root, ctx) {
  ctx.muscle ||= 'glutes';
  ctx.muscleRange ||= '90';

  function render() {
    clear(root);
    const units = store.settings.units;
    const range = RANGES.find((r) => r.key === ctx.muscleRange) || RANGES[1];
    const to = todayKey();
    const from = range.days ? addDays(to, -(range.days - 1)) : earliest();
    const totals = store.muscleTotals(from, to);

    root.append(el('div', { class: 'seg', style: { marginBottom: '14px' } },
      ...RANGES.map((r) => el('button', {
        'aria-pressed': String(r.key === ctx.muscleRange),
        onclick: () => { ctx.muscleRange = r.key; render(); },
      }, r.label)),
    ));

    // --- muscle picker ----------------------------------------------------
    root.append(el('div', { class: 'chip-row chip-wrap' },
      ...MUSCLES.map((m) => {
        const n = Math.round(totals[m.key] || 0);
        return el('button', {
          class: 'chip',
          'aria-pressed': String(ctx.muscle === m.key),
          style: { '--pick': m.color },
          onclick: () => { ctx.muscle = m.key; haptic(4); render(); },
        }, m.label, n ? el('span', { class: 'chip-n' }, String(n)) : null);
      }),
    ));

    const muscle = muscleInfo(ctx.muscle);
    const series = store.muscleSeries(ctx.muscle, from, to);
    const exercises = store.muscleExercises(ctx.muscle, from, to);

    if (!series.length) {
      root.append(el('div', { class: 'card', style: { marginTop: '14px' } },
        el('div', { class: 'empty' },
          el('div', { style: { fontSize: '30px', marginBottom: '8px' } }, '🏋️'),
          `Nothing logged for ${muscle.label.toLowerCase()} in this range.`,
          el('br'),
          el('span', { class: 'tiny' },
            'Log a lift with exercises and it will show up here.'),
        )));
      return;
    }

    // --- headline numbers -------------------------------------------------
    const totalSets = series.reduce((n, d) => n + d.sets, 0);
    const totalVolume = series.reduce((n, d) => n + d.volume, 0);
    const allBest = bestOverall(ctx.muscle, from, to);

    root.append(el('div', { class: 'stat-row', style: { marginTop: '14px' } },
      stat(Math.round(totalSets), '', 'sets'),
      stat(series.length, '', 'sessions'),
      // compact() already abbreviates ("88k"), so the unit belongs in the label
      // rather than suffixed onto the number.
      totalVolume ? stat(compact(kgToDisplay(totalVolume, units)), '', `${weightLabel(units)} moved`) : null,
      stat(round(totalSets / weeksIn(from, to), 1), '', 'sets/week'),
    ));

    // --- sets per week ----------------------------------------------------
    root.append(weeklyCard(series, muscle));

    // --- volume over time -------------------------------------------------
    const volPoints = series.filter((d) => d.volume > 0)
      .map((d) => ({ date: d.date, value: kgToDisplay(d.volume, units) }));
    if (volPoints.length > 1) {
      root.append(el('div', { class: 'card' },
        el('div', { class: 'card-title' }, `Load per session · ${weightLabel(units)}`),
        lineChart(volPoints, { format: (v) => compact(v), color: muscle.color }),
      ));
    }

    // --- the exercises doing the work -------------------------------------
    const card = el('div', { class: 'card' },
      el('div', { class: 'card-title' }, `Exercises · ${exercises.length}`));
    for (const a of exercises) {
      const best = bestAcross(a.exerciseId, from, to);
      card.append(el('button', {
        class: 'ex-row',
        onclick: () => { haptic(); openExerciseDetail(a.exerciseId); },
      },
        el('span', { class: 'ex-dot', style: { background: muscleInfo(a.exercise?.muscles?.[0] || ctx.muscle).color } }),
        el('span', { class: 'ex-body' },
          el('span', { class: 'ex-name' }, a.exercise?.name || a.exerciseId),
          el('span', { class: 'ex-muscles' },
            [`${a.sets} set${a.sets === 1 ? '' : 's'}`,
              best ? formatSet(best, a.exercise?.unit, units) : null,
              relativeDay(a.lastDate) || formatDay(a.lastDate)].filter(Boolean).join(' · ')),
        ),
        // Exercises that only assist this muscle say so, since their set count
        // counts half toward the totals above.
        a.primary ? null : el('span', { class: 'src assists' }, 'assists'),
        el('span', { class: 'ex-caret' }, '▸'),
      ));
    }
    root.append(card);

    if (allBest) {
      root.append(el('p', { class: 'tiny muted', style: { textAlign: 'center' } },
        'Sets and load are share-weighted: an exercise counts fully toward its '
        + 'main muscle and half toward the others.'));
    }
  }

  render();
  return render;
}

function earliest() {
  const dates = store.workouts.filter((w) => (w.exercises || []).length).map((w) => w.date).sort();
  return dates[0] || todayKey();
}

function weeksIn(from, to) {
  return Math.max(1, ((fromKey(to) - fromKey(from)) / 86400000 + 1) / 7);
}

function compact(n) {
  if (n == null) return '0';
  return n >= 10000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
}

function stat(value, unit, label) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return el('div', { class: 'stat' },
    el('div', { class: `v${text.length >= 6 ? ' is-long' : ''}` }, text, unit ? el('small', {}, unit) : null),
    el('div', { class: 'k' }, label),
  );
}

/** Sets per week for this muscle over the last 12 weeks. */
function weeklyCard(series, muscle) {
  const ws = store.settings.weekStart;
  const thisWeek = weekStartKey(todayKey(), ws);
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    const sets = series.filter((d) => d.date >= start && d.date <= end)
      .reduce((n, d) => n + d.sets, 0);
    weeks.push({ start, sets: Math.round(sets) });
  }
  const max = Math.max(1, ...weeks.map((w) => w.sets));

  return el('div', { class: 'card' },
    el('div', { class: 'card-title' }, `${muscle.label} sets per week`),
    el('div', { class: 'bars' },
      ...weeks.map((w, i) => {
        const d = fromKey(w.start);
        return el('div', { class: 'bar-col' },
          el('div', { class: 'bar-val' }, w.sets ? String(w.sets) : ''),
          el('div', {
            class: w.sets ? 'bar' : 'bar dim',
            style: {
              height: `${Math.max((w.sets / max) * 100, w.sets ? 6 : 2)}%`,
              background: w.sets ? muscle.color : 'var(--surface-2)',
              opacity: i === weeks.length - 1 ? '.65' : '1',
            },
          }),
          el('div', { class: 'bar-lbl' }, `${monthShort(d.getMonth()).slice(0, 1)}${d.getDate()}`),
        );
      }),
    ),
    el('div', { class: 'tiny muted', style: { marginTop: '6px' } },
      'Last 12 weeks. The final bar is the week in progress.'),
  );
}

function bestAcross(exerciseId, from, to) {
  const sets = store.historyFor(exerciseId)
    .filter((h) => h.date >= from && h.date <= to)
    .flatMap((h) => h.entry.sets);
  return bestSet(sets);
}

function bestOverall(muscle, from, to) {
  return store.muscleExercises(muscle, from, to).length > 0;
}

/** One exercise's progression: top set over time, plus every session. */
export function openExerciseDetail(exerciseId) {
  const units = store.settings.units;
  const ex = store.lookupExercise(exerciseId);
  const history = store.historyFor(exerciseId);

  const points = history.slice().reverse()
    .map((h) => ({ date: h.date, best: bestSet(h.entry.sets), volume: entryVolume(h.entry) }))
    .filter((p) => p.best);

  const loaded = points.filter((p) => p.best.weightKg);
  const pr = bestSet(history.flatMap((h) => h.entry.sets));

  const body = el('div', {},
    el('div', { class: 'stat-row', style: { marginBottom: '14px' } },
      el('div', { class: 'stat' },
        el('div', { class: 'v is-long' }, pr ? formatSet(pr, ex?.unit, units) : '—'),
        el('div', { class: 'k' }, 'best set')),
      el('div', { class: 'stat' },
        el('div', { class: 'v' }, String(history.length)),
        el('div', { class: 'k' }, 'sessions')),
      el('div', { class: 'stat' },
        el('div', { class: 'v' }, String(history.reduce((n, h) => n + h.entry.sets.length, 0))),
        el('div', { class: 'k' }, 'sets')),
    ),
  );

  if (loaded.length > 1) {
    body.append(el('div', { class: 'card' },
      el('div', { class: 'card-title' }, `Top set · ${weightLabel(units)}`),
      lineChart(loaded.map((p) => ({ date: p.date, value: kgToDisplay(p.best.weightKg, units) })), {
        format: (v) => String(Math.round(v)),
        color: muscleInfo(ex?.muscles?.[0] || 'core').color,
      }),
    ));
  }

  const log = el('div', { class: 'card' }, el('div', { class: 'card-title' }, 'Every session'));
  for (const h of history) {
    log.append(el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, relativeDay(h.date) || formatDay(h.date, true)),
        el('div', { class: 'row-sub' },
          h.entry.sets.map((s) => formatSet(s, ex?.unit, units)).join('  ·  ')),
      ),
    ));
  }
  body.append(log);

  const sheet = openSheet({
    title: ex?.name || 'Exercise',
    subtitle: (ex?.muscles || []).map((m) => muscleInfo(m).label).join(' · '),
    body,
  });
  sheet.setFooter([el('button', { class: 'btn btn-primary', onclick: () => sheet.close() }, 'Done')]);
  return sheet;
}
