import { el, toast, haptic, confirmDialog } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { store } from '../store.js';
import { typeInfo } from '../types.js';

/**
 * Saved workouts you start from again — the few you rotate through.
 *
 * A routine holds the exercise list, not a fixed prescription: applying one
 * pulls each exercise's sets from the last time you did it, so a rotation
 * carries your progress forward rather than resetting it.
 */
export function openSaveRoutine(draft, onDone) {
  const suggestion = draft.title?.trim()
    || `${typeInfo(draft.type).label} routine`;
  const nameInput = el('input', { type: 'text', value: suggestion, placeholder: 'e.g. Lower body A' });
  const existing = store.routines;

  const sheet = openSheet({
    title: 'Save as a routine',
    subtitle: `${draft.exercises.length} exercise${draft.exercises.length === 1 ? '' : 's'}`,
    body: el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'Name'), nameInput),
      el('ul', { class: 'tiny muted', style: { paddingLeft: '18px', lineHeight: '1.7' } },
        ...draft.exercises.map((e) => el('li', {}, store.lookupExercise(e.exerciseId)?.name || e.name))),
      el('p', { class: 'tiny muted', style: { marginTop: '14px' } },
        'Starting from a routine fills in each exercise from the last time you '
        + 'did it, so your weights carry over. Saving under a name you already '
        + 'have updates that routine.'),
      existing.length
        ? el('p', { class: 'tiny muted' }, `You have ${existing.length}: ${existing.map((r) => r.name).join(', ')}.`)
        : null,
    ),
  });
  sheet.setFooter([
    el('button', { class: 'btn btn-ghost', onclick: () => sheet.close() }, 'Cancel'),
    el('button', {
      class: 'btn btn-primary',
      onclick: () => {
        if (!nameInput.value.trim()) { toast('Give it a name', 'error'); return; }
        const saved = store.saveRoutine({
          name: nameInput.value,
          type: draft.type,
          title: draft.title,
          exercises: draft.exercises,
        });
        haptic(12);
        toast(`Saved “${saved.name}”`, 'success');
        sheet.close();
        onDone?.(saved);
      },
    }, 'Save routine'),
  ]);
  return sheet;
}

/** A horizontal row of routine chips. Returns null when there are none. */
export function routineChips(onPick, { label = 'Start from a routine' } = {}) {
  const routines = store.routines;
  if (!routines.length) return null;
  return el('div', { class: 'field' },
    el('span', { class: 'field-label' }, label),
    el('div', { class: 'chip-row' },
      ...routines.map((r) => el('button', {
        type: 'button',
        class: 'chip',
        style: { '--pick': typeInfo(r.type).color },
        onclick: () => { haptic(); store.touchRoutine(r.id); onPick(r); },
      },
        el('span', {}, typeInfo(r.type).icon),
        r.name,
        el('span', { class: 'chip-n' }, String(r.exercises.length)),
      )),
    ),
  );
}

/** Settings card: rename by re-saving, or delete. */
export function routinesCard(rerender) {
  const routines = store.routines;
  const card = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, `Routines${routines.length ? ` · ${routines.length}` : ''}`));

  if (!routines.length) {
    card.append(el('div', { class: 'empty' },
      'Log a workout with exercises, then tap “Save as a routine” to reuse it.'));
    return card;
  }

  for (const r of routines) {
    card.append(el('div', { class: 'row' },
      el('span', { class: 'emo', style: { background: typeInfo(r.type).color } }, typeInfo(r.type).icon),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, r.name),
        el('div', { class: 'row-sub' },
          r.exercises.map((e) => store.lookupExercise(e.exerciseId)?.name || e.name).join(', ')),
      ),
      el('button', {
        class: 'icon-btn',
        'aria-label': `Delete ${r.name}`,
        onclick: async () => {
          const ok = await confirmDialog({
            title: `Delete “${r.name}”?`,
            body: 'Workouts you already logged from it stay put.',
            confirmText: 'Delete', danger: true,
          });
          if (!ok) return;
          store.deleteRoutine(r.id);
          toast('Routine deleted');
          rerender();
        },
      }, '🗑'),
    ));
  }
  return card;
}
