import { el, haptic } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { openEditor } from './editor.js';
import { store } from '../store.js';
import { typeInfo } from '../types.js';
import { formatDay, relativeDay } from '../util/date.js';
import { DIET, DRINK_STEPS } from '../metrics.js';
import { entryVolume } from '../exercises.js';
import { faceEl } from './face.js';
import {
  formatDuration, formatDistance, formatEffortRate, weightLabel, kgToDisplay, displayToKg, round,
} from '../util/units.js';

/** Bottom sheet for one calendar day: its workouts plus how the body felt. */
export function openDay(dayKey) {
  const sheet = openSheet({ title: '', subtitle: '' });
  renderDay(sheet, dayKey);
  return sheet;
}

export function renderDay(sheet, dayKey) {
  const units = store.settings.units;
  const workouts = store.workoutsOn(dayKey);
  const day = store.day(dayKey) || {};

  const rel = relativeDay(dayKey);
  sheet.setTitle(rel || formatDay(dayKey, true), rel ? formatDay(dayKey, true) : '');

  // --- workout list ------------------------------------------------------
  const list = el('div', {});
  if (workouts.length) {
    for (const w of workouts) list.append(workoutRow(w, units, () => {
      openEditor({ workout: w, sheet, onDone: () => renderDay(sheet, dayKey) });
    }));
  } else {
    list.append(el('div', { class: 'empty' }, 'Nothing logged yet for this day.'));
  }

  // --- daily metrics -----------------------------------------------------
  const sleepInput = el('input', {
    type: 'number', inputmode: 'decimal', step: '0.25', min: '0', max: '24',
    placeholder: '7.5', value: day.sleepHours ?? '',
  });
  const rhrInput = el('input', {
    type: 'number', inputmode: 'numeric', step: '1', min: '20', max: '200',
    placeholder: '—', value: day.restingHr ?? '',
  });
  const weightInput = el('input', {
    type: 'number', inputmode: 'decimal', step: '0.1', min: '0',
    placeholder: '—', value: day.weightKg != null ? String(round(kgToDisplay(day.weightKg, units), 1)) : '',
  });
  const stepsInput = el('input', {
    type: 'number', inputmode: 'numeric', step: '1', min: '0',
    placeholder: '—', value: day.steps ?? '',
  });
  const notesInput = el('textarea', {
    placeholder: 'Sleep, soreness, travel, life — anything worth remembering.',
  }, day.notes || '');

  // Food and drinks: the same one-tap controls as the standalone check-in.
  const picks = { diet: day.diet ?? null, drinks: day.drinks ?? null };

  const dietRow = el('div', { class: 'pick-row' });
  function drawDiet() {
    dietRow.replaceChildren(...DIET.map((d) => el('button', {
      type: 'button', class: 'pick',
      'aria-pressed': String(picks.diet === d.value),
      'aria-label': d.label,
      style: { '--pick': d.color },
      onclick: () => { picks.diet = picks.diet === d.value ? null : d.value; haptic(); drawDiet(); save(); },
    }, el('span', { class: 'e' }, d.icon))));
  }

  const drinkRow = el('div', { class: 'rating' });
  function drawDrinks() {
    drinkRow.replaceChildren(...DRINK_STEPS.map((n) => el('button', {
      type: 'button',
      'aria-pressed': String(picks.drinks === n),
      onclick: () => { picks.drinks = picks.drinks === n ? null : n; haptic(); drawDrinks(); save(); },
    }, n === 5 ? '5+' : String(n))));
  }

  drawDiet();
  drawDrinks();

  const ratings = {};
  function ratingField(key, label, lowLabel, highLabel) {
    const row = el('div', { class: 'rating' });
    const draw = () => {
      row.replaceChildren(...[1, 2, 3, 4, 5].map((n) => el('button', {
        type: 'button',
        'aria-pressed': String(ratings[key] === n),
        onclick: () => { ratings[key] = ratings[key] === n ? null : n; haptic(); draw(); save(); },
      }, String(n))));
    };
    ratings[key] = day[key] ?? null;
    draw();
    return el('div', { class: 'field' },
      el('span', { class: 'field-label' }, label),
      row,
      el('div', { class: 'rating-legend' }, el('span', {}, lowLabel), el('span', {}, highLabel)),
    );
  }

  function save() {
    store.saveDay(dayKey, {
      sleepHours: numOrNull(sleepInput.value),
      restingHr: numOrNull(rhrInput.value),
      weightKg: displayToKg(weightInput.value, units),
      steps: numOrNull(stepsInput.value),
      sleepQuality: ratings.sleepQuality ?? null,
      energy: ratings.energy ?? null,
      soreness: ratings.soreness ?? null,
      diet: picks.diet,
      drinks: picks.drinks,
      notes: notesInput.value.trim() || null,
    });
  }

  for (const input of [sleepInput, rhrInput, weightInput, stepsInput, notesInput]) {
    input.addEventListener('change', save);
    input.addEventListener('blur', save);
  }

  const body = el('div', {},
    scoreCard(dayKey),
    el('div', { class: 'card-title' }, `Workouts${workouts.length ? ` · ${workouts.length}` : ''}`),
    list,
    el('button', {
      class: 'btn btn-ghost btn-block btn-sm',
      style: { marginTop: '4px' },
      onclick: () => openEditor({ date: dayKey, sheet, onDone: () => renderDay(sheet, dayKey) }),
    }, '+ Add a workout'),

    el('div', { class: 'card-title', style: { marginTop: '22px' } }, 'How the day felt'),
    el('div', { class: 'field' },
      el('div', { class: 'grid-2' },
        el('div', {}, el('span', { class: 'field-label' }, 'Sleep (hours)'), sleepInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Resting HR'), rhrInput),
      ),
    ),
    el('div', { class: 'field' },
      el('div', { class: 'grid-2' },
        el('div', {}, el('span', { class: 'field-label' }, `Weight (${weightLabel(units)})`), weightInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Steps'), stepsInput),
      ),
    ),
    el('div', { class: 'field' },
      el('span', { class: 'field-label' }, 'How I ate'),
      dietRow,
      el('div', { class: 'rating-legend' }, el('span', {}, 'indulgent'), el('span', {}, 'clean')),
    ),
    el('div', { class: 'field' },
      el('span', { class: 'field-label' }, 'Drinks'),
      drinkRow,
      el('div', { class: 'rating-legend' }, el('span', {}, 'standard drinks'), el('span', {}, '')),
    ),
    ratingField('sleepQuality', 'Sleep quality', 'wrecked', 'great'),
    ratingField('energy', 'Energy', 'flat', 'buzzing'),
    ratingField('soreness', 'Soreness', 'fresh', 'wrecked'),
    el('div', { class: 'field' }, el('label', {}, 'Notes'), notesInput),
  );

  sheet.setBody(body);
  sheet.setFooter([
    el('button', { class: 'btn btn-primary', onclick: () => { save(); sheet.close(); } }, 'Done'),
  ]);
}

function workoutRow(w, units, onClick) {
  const t = typeInfo(w.type);
  const bits = [
    w.time || null,
    w.durationMin ? formatDuration(w.durationMin) : null,
    w.distanceKm ? formatDistance(w.distanceKm, units) : null,
    formatEffortRate(w, t.pace, units) || null,
    w.rpe ? `RPE ${w.rpe}` : null,
    liftSummary(w, units),
  ].filter(Boolean);

  return el('button', { class: 'wo', onclick: onClick },
    el('div', { class: 'ic', style: { background: t.color } }, t.icon),
    el('div', { class: 'body' },
      el('div', { class: 'name' }, w.title || t.label),
      bits.length ? el('div', { class: 'meta' }, ...bits.map((b) => el('span', {}, b))) : null,
      w.notes ? el('div', { class: 'meta' }, el('span', {}, truncate(w.notes, 70))) : null,
    ),
    w.source && w.source !== 'manual' ? el('span', { class: 'src' }, w.source) : null,
  );
}

/**
 * Why the day scored what it did. Worth showing rather than leaving the face
 * to be guessed at — the rest credit and weekend allowance are invisible
 * otherwise.
 */
function scoreCard(dayKey) {
  const scored = store.scoreFor(dayKey);
  if (!scored) return el('span', {});

  const bars = el('div', { class: 'breakdown', style: { marginTop: '4px' } },
    ...scored.parts.map((p) => el('div', { class: 'bd' },
      el('span', { class: 'nm', style: { width: '66px' } }, p.label),
      el('span', { class: 'track' },
        el('span', {
          class: 'fill',
          style: { width: `${Math.round(p.value * 100)}%`, background: scored.band.color },
        })),
      el('span', { class: 'n', style: { minWidth: '92px' } }, p.detail),
    )),
  );

  return el('div', { class: 'card score-card' },
    el('div', { class: 'score-head' },
      el('span', {
        class: 'score-face',
        style: { background: scored.band.color },
      }, faceEl(scored.band.face)),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, scored.band.label),
        el('div', { class: 'row-sub' },
          scored.parts.length < 3
            ? `From the ${scored.parts.length} thing${scored.parts.length === 1 ? '' : 's'} you logged — check in for the full picture`
            : 'Movement, food and drinks'),
      ),
    ),
    bars,
  );
}

/** "4 exercises · 12 sets" for a lift, nothing for anything else. */
function liftSummary(w, units) {
  const entries = w.exercises || [];
  if (!entries.length) return null;
  const sets = entries.reduce((n, e) => n + (e.sets || []).length, 0);
  const volume = entries.reduce((n, e) => n + entryVolume(e), 0);
  const bits = [`${entries.length} exercise${entries.length === 1 ? '' : 's'}`,
    `${sets} set${sets === 1 ? '' : 's'}`];
  if (volume) {
    const v = units === 'imperial' ? volume / 0.45359237 : volume;
    bits.push(`${Math.round(v).toLocaleString()} ${units === 'imperial' ? 'lb' : 'kg'}`);
  }
  return bits.join(' · ');
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
