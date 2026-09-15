import { el, haptic, toast } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { store } from '../store.js';
import { DIET, DRINK_STEPS } from '../metrics.js';
import { formatDay, relativeDay, todayKey } from '../util/date.js';
import { weightLabel, kgToDisplay, displayToKg, round } from '../util/units.js';

/**
 * The daily check-in: everything about a day that isn't a workout.
 *
 * Deliberately tap-first — food and drinks are single taps, and the numbers
 * you'd type (weight, sleep) sit right at the top, so a daily weigh-in is
 * two taps from opening the app.
 */
export function openCheckin(dayKey = todayKey(), { sheet = null, onDone } = {}) {
  const units = store.settings.units;
  const day = store.day(dayKey) || {};
  const draft = {
    diet: day.diet ?? null,
    drinks: day.drinks ?? null,
    sleepQuality: day.sleepQuality ?? null,
    energy: day.energy ?? null,
    soreness: day.soreness ?? null,
  };

  const weightInput = el('input', {
    type: 'number', inputmode: 'decimal', step: '0.1', min: '0', placeholder: '—',
    value: day.weightKg != null ? String(round(kgToDisplay(day.weightKg, units), 1)) : '',
  });
  const sleepInput = el('input', {
    type: 'number', inputmode: 'decimal', step: '0.25', min: '0', max: '24', placeholder: '7.5',
    value: day.sleepHours ?? '',
  });
  const rhrInput = el('input', {
    type: 'number', inputmode: 'numeric', step: '1', min: '20', max: '200', placeholder: '—',
    value: day.restingHr ?? '',
  });
  const stepsInput = el('input', {
    type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: '—',
    value: day.steps ?? '',
  });
  const notesInput = el('textarea', {
    placeholder: 'Anything worth remembering about today.',
  }, day.notes || '');

  // --- food: one tap across a five-step ramp ------------------------------
  const dietRow = el('div', { class: 'pick-row' });
  function drawDiet() {
    dietRow.replaceChildren(...DIET.map((d) => el('button', {
      type: 'button',
      class: 'pick',
      'aria-pressed': String(draft.diet === d.value),
      'aria-label': d.label,
      style: { '--pick': d.color },
      onclick: () => { draft.diet = draft.diet === d.value ? null : d.value; haptic(); drawDiet(); },
    }, el('span', { class: 'e' }, d.icon))));
  }

  // --- drinks: a plain count, no judgement in the glyph -------------------
  const drinkRow = el('div', { class: 'rating' });
  function drawDrinks() {
    drinkRow.replaceChildren(...DRINK_STEPS.map((n) => el('button', {
      type: 'button',
      'aria-pressed': String(draft.drinks === n),
      onclick: () => { draft.drinks = draft.drinks === n ? null : n; haptic(); drawDrinks(); },
    }, n === 5 ? '5+' : String(n))));
  }

  function ratingField(key, label, low, high) {
    const row = el('div', { class: 'rating' });
    const draw = () => row.replaceChildren(...[1, 2, 3, 4, 5].map((n) => el('button', {
      type: 'button',
      'aria-pressed': String(draft[key] === n),
      onclick: () => { draft[key] = draft[key] === n ? null : n; haptic(); draw(); },
    }, String(n))));
    draw();
    return el('div', { class: 'field' },
      el('span', { class: 'field-label' }, label),
      row,
      el('div', { class: 'rating-legend' }, el('span', {}, low), el('span', {}, high)),
    );
  }

  drawDiet();
  drawDrinks();

  const body = el('div', {},
    el('div', { class: 'field' },
      el('div', { class: 'grid-2' },
        el('div', {}, el('span', { class: 'field-label' }, `Weight (${weightLabel(units)})`), weightInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Sleep (hours)'), sleepInput),
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
    el('div', { class: 'field' },
      el('div', { class: 'grid-2' },
        el('div', {}, el('span', { class: 'field-label' }, 'Resting HR'), rhrInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Steps'), stepsInput),
      ),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Notes'), notesInput),
  );

  function save() {
    store.saveDay(dayKey, {
      weightKg: displayToKg(weightInput.value, units),
      sleepHours: numOrNull(sleepInput.value),
      restingHr: numOrNull(rhrInput.value),
      steps: numOrNull(stepsInput.value),
      diet: draft.diet,
      drinks: draft.drinks,
      sleepQuality: draft.sleepQuality,
      energy: draft.energy,
      soreness: draft.soreness,
      notes: notesInput.value.trim() || null,
    });
  }

  const rel = relativeDay(dayKey);
  const title = rel === 'Today' ? 'How was today?' : 'Daily check-in';
  const subtitle = rel && rel !== 'Today' ? `${rel} · ${formatDay(dayKey, true)}` : formatDay(dayKey, true);
  // A caller that lent us its sheet (the day view) re-renders it instead of
  // having it closed out from under them.
  const owned = !sheet;
  const footer = [el('button', {
    class: 'btn btn-primary',
    onclick: () => {
      save();
      haptic(12);
      toast('Saved', 'success');
      if (owned) target.close();
      onDone?.();
    },
  }, 'Save')];

  const target = sheet || openSheet({ title, subtitle });
  target.setTitle(title, subtitle);
  target.setBody(body);
  target.setFooter(footer);
  return target;
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
