import { el, haptic, confirmDialog } from '../util/dom.js';
import { store } from '../store.js';
import { muscleInfo, summariseEntry, entryVolume } from '../exercises.js';
import { openExercisePicker } from './exercisePicker.js';
import { kgToDisplay, displayToKg, weightLabel, round } from '../util/units.js';

/**
 * The exercise list for a lift: each exercise expands into rows of sets you
 * type reps and weight into.
 *
 * Returns a node plus a read() the editor calls on save, so this owns its own
 * draft state and the editor stays unaware of the shape of a set.
 */
export function liftSection({ workoutId, entries, getSheet, restore }) {
  const units = store.settings.units;
  const draft = entries.map((e) => ({ ...e, sets: (e.sets || []).map((s) => ({ ...s })) }));
  // Which exercise is open for editing. New ones open automatically.
  let openIndex = draft.length === 1 ? 0 : -1;

  const root = el('div', { class: 'lift' });

  function totals() {
    const sets = draft.reduce((n, e) => n + e.sets.length, 0);
    const volume = draft.reduce((n, e) => n + entryVolume(e), 0);
    return { sets, volume };
  }

  function draw() {
    root.replaceChildren();

    for (const [i, entry] of draft.entries()) {
      const ex = store.lookupExercise(entry.exerciseId);
      const name = ex?.name || entry.name || 'Exercise';
      const primary = muscleInfo(ex?.muscles?.[0] || 'core');
      const isOpen = i === openIndex;

      const head = el('button', {
        class: `ex-head${isOpen ? ' is-open' : ''}`,
        onclick: () => { openIndex = isOpen ? -1 : i; haptic(4); draw(); },
      },
        el('span', { class: 'ex-dot', style: { background: primary.color } }),
        el('span', { class: 'ex-body' },
          el('span', { class: 'ex-name' }, name),
          el('span', { class: 'ex-muscles' }, summariseEntry(entry, ex, units)),
        ),
        el('span', { class: 'ex-caret' }, isOpen ? '▾' : '▸'),
      );

      const card = el('div', { class: `ex-card${isOpen ? ' is-open' : ''}` }, head);

      if (isOpen) {
        const rows = el('div', { class: 'set-rows' });
        const timed = ex?.unit === 'time';

        const drawRows = () => {
          rows.replaceChildren(
            el('div', { class: 'set-row set-head' },
              el('span', {}, 'Set'),
              el('span', {}, timed ? 'Seconds' : 'Reps'),
              el('span', {}, weightLabel(units)),
              el('span', {}),
            ),
            ...entry.sets.map((set, si) => {
              const repInput = el('input', {
                type: 'number', inputmode: 'numeric', min: '0', step: '1',
                value: set.reps ?? '', placeholder: timed ? '30' : '8',
                onchange: (e) => { set.reps = toNum(e.target.value); refreshHead(); },
              });
              const wInput = el('input', {
                type: 'number', inputmode: 'decimal', min: '0', step: '0.5',
                placeholder: ex?.bodyweight ? 'body' : '—',
                value: set.weightKg != null ? String(round(kgToDisplay(set.weightKg, units), 1)) : '',
                onchange: (e) => { set.weightKg = displayToKg(e.target.value, units); refreshHead(); },
              });
              return el('div', { class: 'set-row' },
                el('span', { class: 'set-n' }, String(si + 1)),
                repInput,
                wInput,
                el('button', {
                  class: 'set-x', 'aria-label': `Remove set ${si + 1}`,
                  onclick: () => { entry.sets.splice(si, 1); haptic(); drawRows(); refreshHead(); },
                }, '×'),
              );
            }),
          );
        };

        const refreshHead = () => {
          head.querySelector('.ex-muscles').textContent = summariseEntry(entry, ex, units);
          updateSummary();
        };

        drawRows();

        card.append(rows, el('div', { class: 'ex-actions' },
          el('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => {
              // Copy the previous set — the usual case is another set the same.
              const prev = entry.sets.at(-1);
              entry.sets.push(prev ? { ...prev } : { reps: null, weightKg: null });
              haptic();
              drawRows();
              refreshHead();
            },
          }, '+ Add set'),
          el('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: async () => {
              const ok = await confirmDialog({
                title: `Remove ${name}?`, body: 'Its sets go with it.',
                confirmText: 'Remove', danger: true,
              });
              if (!ok) return;
              draft.splice(i, 1);
              openIndex = -1;
              draw();
            },
          }, 'Remove'),
        ));
      }

      root.append(card);
    }

    if (!draft.length) {
      root.append(el('div', { class: 'empty' }, 'No exercises yet — add your first below.'));
    }

    root.append(el('button', {
      class: 'btn btn-ghost btn-block btn-sm',
      style: { marginTop: '6px' },
      onclick: () => pick(),
    }, '+ Add exercise'));

    root.append(summaryEl);
    updateSummary();
  }

  const summaryEl = el('div', { class: 'lift-total' });
  function updateSummary() {
    const { sets, volume } = totals();
    summaryEl.hidden = !sets;
    summaryEl.textContent = volume
      ? `${sets} set${sets === 1 ? '' : 's'} · ${Math.round(kgToDisplay(volume, units)).toLocaleString()} ${weightLabel(units)} moved`
      : `${sets} set${sets === 1 ? '' : 's'}`;
  }

  function pick() {
    haptic();
    openExercisePicker(getSheet(), {
      onCancel: () => restore(),
      onPick: (ex) => {
        // Start from last time's sets so a repeat session is a couple of taps.
        const previous = store.lastSetsFor(ex.id, workoutId);
        draft.push({
          exerciseId: ex.id,
          name: ex.name,
          notes: '',
          sets: previous || [{ reps: null, weightKg: null }],
        });
        openIndex = draft.length - 1;
        restore();
        draw();
      },
    });
  }

  draw();

  return {
    node: root,
    read: () => draft
      .map((e) => ({ ...e, sets: e.sets.filter((s) => toNum(s.reps) > 0) }))
      .filter((e) => e.sets.length),
    totals,
  };
}

function toNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
