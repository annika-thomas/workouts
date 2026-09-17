import { el, haptic, confirmDialog } from '../util/dom.js';
import { store } from '../store.js';
import { muscleInfo, summariseEntry, entryVolume, hasUnpricedBodyweight } from '../exercises.js';
import { openExercisePicker } from './exercisePicker.js';
import { kgToDisplay, displayToKg, weightLabel, round } from '../util/units.js';

/**
 * The exercise list for a lift: each exercise expands into rows of sets you
 * type reps and weight into.
 *
 * Returns a node plus a read() the editor calls on save, so this owns its own
 * draft state and the editor stays unaware of the shape of a set.
 */
export function liftSection({ workoutId, entries, date, getSheet, restore, onChange }) {
  const units = store.settings.units;
  const draft = entries.map((e) => ({ ...e, sets: (e.sets || []).map((s) => ({ ...s })) }));
  // Bodyweight sets are priced at whatever you weighed around then.
  const bodyWeight = store.bodyWeightOn(date || new Date().toISOString().slice(0, 10));
  // Which exercise is open for editing. New ones open automatically.
  let openIndex = draft.length === 1 ? 0 : -1;

  const root = el('div', { class: 'lift' });

  function totals() {
    const sets = draft.reduce((n, e) => n + e.sets.length, 0);
    const volume = draft.reduce((n, e) => n + entryVolume(e, bodyWeight), 0);
    const unpriced = draft.some((e) => hasUnpricedBodyweight(e, bodyWeight));
    return { sets, volume, unpriced };
  }

  function draw() {
    onChange?.();
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
          el('span', { class: 'ex-muscles' }, summariseEntry(entry, ex, units, bodyWeight)),
        ),
        entry.next ? el('span', { class: `nextmark is-${entry.next}` }, entry.next === 'up' ? '+' : '−') : null,
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
              el('span', {}, 'BW'),
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
                placeholder: set.bw ? '+' : '—',
                value: set.weightKg != null ? String(round(kgToDisplay(set.weightKg, units), 1)) : '',
                onchange: (e) => { set.weightKg = displayToKg(e.target.value, units); refreshHead(); },
              });
              return el('div', { class: 'set-row' },
                el('span', { class: 'set-n' }, String(si + 1)),
                repInput,
                wInput,
                el('button', {
                  class: 'set-bw',
                  'aria-pressed': String(Boolean(set.bw)),
                  'aria-label': `Bodyweight for set ${si + 1}`,
                  onclick: () => {
                    set.bw = !set.bw;
                    haptic();
                    drawRows();
                    refreshHead();
                  },
                }, 'BW'),
                el('button', {
                  class: 'set-x', 'aria-label': `Remove set ${si + 1}`,
                  onclick: () => { entry.sets.splice(si, 1); haptic(); drawRows(); refreshHead(); },
                }, '×'),
              );
            }),
          );
        };

        const refreshHead = () => {
          head.querySelector('.ex-muscles').textContent = summariseEntry(entry, ex, units, bodyWeight);
          updateSummary();
        };

        drawRows();

        const nextRow = el('div', { class: 'next-row' });
        const drawNext = () => nextRow.replaceChildren(
          el('span', { class: 'next-label' }, 'Next time'),
          ...[['down', '−', 'Less'], ['up', '+', 'More']].map(([v, sign, label]) => el('button', {
            class: `next-btn is-${v}`,
            'aria-pressed': String(entry.next === v),
            onclick: () => {
              entry.next = entry.next === v ? null : v;
              haptic();
              drawNext();
              draw();
            },
          }, sign, ' ', label)),
        );
        drawNext();

        // What you told yourself last time you did this.
        const prior = store.historyFor(entry.exerciseId).find((h) => h.workoutId !== workoutId);
        const priorNote = prior?.entry?.next
          ? el('div', { class: 'next-hint' },
            `Last time you marked: ${prior.entry.next === 'up' ? 'go heavier' : 'ease off'}`)
          : null;

        // Node.append stringifies null, so drop the hint when there isn't one.
        if (priorNote) card.append(rows, nextRow, priorNote);
        else card.append(rows, nextRow);
        card.append(el('div', { class: 'ex-actions' },
          el('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => {
              // Copy the previous set — the usual case is another set the same.
              const prev = entry.sets.at(-1);
              entry.sets.push(prev ? { ...prev } : { reps: null, weightKg: null, bw: Boolean(ex?.bodyweight) });
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
    const { sets, volume, unpriced } = totals();
    summaryEl.hidden = !sets;
    const base = `${sets} set${sets === 1 ? '' : 's'}`;
    const moved = volume
      ? `${base} · ${Math.round(kgToDisplay(volume, units)).toLocaleString()} ${weightLabel(units)} moved`
      : base;
    summaryEl.textContent = unpriced
      ? `${moved} · log a weigh-in to count bodyweight`
      : moved;
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
          next: null,
          sets: previous || [{ reps: null, weightKg: null, bw: Boolean(ex.bodyweight) }],
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
    /** Swap the whole list, for applying a routine. */
    replaceAll(next) {
      draft.length = 0;
      draft.push(...next.map((e) => ({ ...e, sets: (e.sets || []).map((x) => ({ ...x })) })));
      openIndex = -1;
      draw();
    },
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
