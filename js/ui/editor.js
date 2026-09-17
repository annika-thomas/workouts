import { el, clear, toast, haptic, confirmDialog } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { store } from '../store.js';
import { TYPES, typeInfo } from '../types.js';
import { liftSection } from './lift.js';
import { openSaveRoutine, routineChips } from './routines.js';
import { formatDay, relativeDay } from '../util/date.js';
import {
  distanceLabel, elevLabel, kmToDisplay, displayToKm, mToElev, elevToM, round,
} from '../util/units.js';

/**
 * Add or edit one workout. `sheet` lets a caller reuse an already-open sheet
 * (the day view does this) instead of stacking a second scrim.
 */
export function openEditor({ date, workout = null, sheet = null, routineId = null, onDone } = {}) {
  const units = store.settings.units;
  const draft = {
    id: workout?.id || null,
    date: workout?.date || date,
    time: workout?.time || '',
    type: workout?.type || 'run',
    title: workout?.title || '',
    durationMin: workout?.durationMin ?? '',
    distanceKm: workout?.distanceKm ?? null,
    elevationM: workout?.elevationM ?? null,
    rpe: workout?.rpe ?? null,
    avgHr: workout?.avgHr ?? '',
    calories: workout?.calories ?? '',
    notes: workout?.notes || '',
    exercises: workout?.exercises || [],
    source: workout?.source || 'manual',
    externalId: workout?.externalId || null,
  };

  // --- type picker -------------------------------------------------------
  const typeGrid = el('div', { class: 'type-grid' });
  const distanceField = el('div', { class: 'field' });

  function renderTypes() {
    typeGrid.replaceChildren(...TYPES.map((t) => el('button', {
      type: 'button',
      class: 'type-opt',
      'aria-pressed': String(t.key === draft.type),
      style: { '--pick': t.color },
      onclick: () => { draft.type = t.key; haptic(); renderTypes(); syncDistance(); },
    }, el('span', { class: 'e' }, t.icon), el('span', {}, t.label))));
  }

  const distInput = el('input', {
    type: 'number', inputmode: 'decimal', step: '0.01', min: '0', placeholder: '0.0',
    value: draft.distanceKm != null ? String(round(kmToDisplay(draft.distanceKm, units), 2)) : '',
  });
  const elevInput = el('input', {
    type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: '0',
    value: draft.elevationM != null ? String(Math.round(mToElev(draft.elevationM, units))) : '',
  });

  const LIFT_TYPES = new Set(['lift', 'mobility', 'other']);
  const liftField = el('div', { class: 'field' },
    el('span', { class: 'field-label' }, 'Exercises'));
  let lift = null;
  let saveRoutineBtn = null;

  function syncDistance() {
    // Distance only makes sense for some types; keep the form short otherwise.
    distanceField.hidden = !typeInfo(draft.type).distance;
    // Sets and reps only make sense for strength work.
    liftField.hidden = !LIFT_TYPES.has(draft.type);
    // Both are still being wired up during the lift section's first draw.
    if (saveRoutineBtn) saveRoutineBtn.hidden = !lift || !lift.read().length;
  }

  distanceField.append(
    el('div', { class: 'grid-2' },
      el('div', {},
        el('span', { class: 'field-label' }, `Distance`),
        el('div', { class: 'input-suffix' }, distInput, el('span', {}, distanceLabel(units))),
      ),
      el('div', {},
        el('span', { class: 'field-label' }, 'Elevation'),
        el('div', { class: 'input-suffix' }, elevInput, el('span', {}, elevLabel(units))),
      ),
    ),
  );

  // --- other inputs ------------------------------------------------------
  const titleInput = el('input', { type: 'text', placeholder: 'e.g. Easy loop by the river', value: draft.title, maxlength: '120' });
  const dateInput = el('input', { type: 'date', value: draft.date });
  const timeInput = el('input', { type: 'time', value: draft.time });
  const durInput = el('input', { type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: '45', value: draft.durationMin });
  const hrInput = el('input', { type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: '—', value: draft.avgHr });
  const calInput = el('input', { type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: '—', value: draft.calories });
  const notesInput = el('textarea', { placeholder: 'How did it feel? What did you do?' }, draft.notes);

  const rpeRow = el('div', { class: 'rating' });
  function renderRpe() {
    rpeRow.replaceChildren(...Array.from({ length: 10 }, (_, i) => i + 1).map((n) => el('button', {
      type: 'button',
      'aria-pressed': String(draft.rpe === n),
      onclick: () => { draft.rpe = draft.rpe === n ? null : n; haptic(); renderRpe(); },
    }, String(n))));
  }

  renderTypes();
  renderRpe();

  // `restore` puts the editor back after the exercise picker borrows the sheet.
  lift = liftSection({
    workoutId: draft.id,
    entries: draft.exercises,
    date: draft.date,
    getSheet: () => host,  // the sheet doesn't exist yet at this point
    restore: () => showForm(),
    onChange: () => syncDistance(),
  });
  saveRoutineBtn = el('button', {
    class: 'btn btn-ghost btn-block btn-sm',
    style: { marginTop: '8px' },
    onclick: () => openSaveRoutine({
      type: draft.type,
      title: titleInput.value,
      exercises: lift.read(),
    }),
  }, '☆ Save as a routine');

  liftField.append(lift.node, saveRoutineBtn);

  // Only offered on a new, still-empty workout — applying one to a workout
  // you're part-way through would quietly discard what you'd typed.
  const routineField = el('div', {});
  function syncRoutines() {
    clear(routineField);
    if (draft.id || lift.read().length) return;
    const chips = routineChips((r) => applyRoutine(r));
    if (chips) routineField.append(chips);
  }

  function applyRoutine(routine) {
    const next = store.draftFromRoutine(routine.id);
    if (!next) return;
    draft.type = next.type;
    if (!titleInput.value.trim()) titleInput.value = next.title;
    renderTypes();
    syncDistance();
    lift.replaceAll(next.exercises);
    syncRoutines();
    toast(`Loaded “${routine.name}”`);
  }

  syncDistance();
  syncRoutines();

  const form = el('div', {},
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Activity'), typeGrid),
    el('div', { class: 'field' },
      el('div', { class: 'grid-2' },
        el('div', {}, el('span', { class: 'field-label' }, 'Date'), dateInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Time'), timeInput),
      ),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Title'), titleInput),
    routineField,
    liftField,
    el('div', { class: 'field' },
      el('div', { class: 'grid-3' },
        el('div', {}, el('span', { class: 'field-label' }, 'Minutes'), durInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Avg HR'), hrInput),
        el('div', {}, el('span', { class: 'field-label' }, 'Calories'), calInput),
      ),
    ),
    distanceField,
    el('div', { class: 'field' },
      el('span', { class: 'field-label' }, 'Effort (RPE)'),
      rpeRow,
      el('div', { class: 'rating-legend' }, el('span', {}, 'easy'), el('span', {}, 'all out')),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Notes'), notesInput),
    draft.source !== 'manual'
      ? el('p', { class: 'tiny muted' }, `Imported from ${draft.source}. Edits stay local and won't be pushed back.`)
      : null,
  );

  function collect() {
    return {
      id: draft.id,
      date: dateInput.value || draft.date,
      time: timeInput.value || null,
      type: draft.type,
      title: titleInput.value,
      durationMin: durInput.value,
      distanceKm: typeInfo(draft.type).distance ? displayToKm(distInput.value, units) : null,
      elevationM: typeInfo(draft.type).distance ? elevToM(elevInput.value, units) : null,
      rpe: draft.rpe,
      avgHr: hrInput.value,
      calories: calInput.value,
      notes: notesInput.value,
      // Mirrors distance/elevation: a type that hides the section doesn't keep
      // its data, otherwise hidden exercises go on counting toward muscle totals.
      exercises: LIFT_TYPES.has(draft.type) ? lift.read() : [],
      source: draft.source,
      externalId: draft.externalId,
    };
  }

  // When the editor opened its own sheet, it also owns closing it. When a
  // caller passed one in (the day view), that caller re-renders it instead.
  let ownSheet = null;
  const finish = (record) => {
    ownSheet?.close();
    onDone?.(record);
  };

  const saveBtn = el('button', {
    class: 'btn btn-primary',
    onclick: () => {
      const record = collect();
      if (!record.date) { toast('Pick a date first', 'error'); return; }
      store.saveWorkout(record);
      haptic(12);
      toast(draft.id ? 'Workout updated' : 'Workout logged', 'success');
      finish(record);
    },
  }, draft.id ? 'Save changes' : 'Log workout');

  const footer = [
    draft.id
      ? el('button', {
        class: 'btn btn-ghost',
        style: { flex: '0 0 auto' },
        'aria-label': 'Delete workout',
        onclick: async () => {
          const ok = await confirmDialog({
            title: 'Delete this workout?',
            body: 'It will be removed from your calendar and totals.',
            confirmText: 'Delete',
            danger: true,
          });
          if (!ok) return;
          store.deleteWorkout(draft.id);
          toast('Deleted');
          finish(null);
        },
      }, '🗑')
      : null,
    saveBtn,
  ];

  const heading = draft.id ? 'Edit workout' : 'Log a workout';
  const sub = relativeDay(draft.date) || formatDay(draft.date, true);

  let host = sheet;
  function showForm() {
    host.setTitle(heading, sub);
    host.setBody(form);
    host.setFooter(footer);
  }

  if (!host) {
    ownSheet = openSheet({ title: heading, subtitle: sub });
    host = ownSheet;
  }
  showForm();
  if (routineId) {
    const routine = store.state.routines[routineId];
    if (routine) applyRoutine(routine);
  }
  return host;
}
