import { el, haptic, toast } from '../util/dom.js';
import { store } from '../store.js';
import { MUSCLES, muscleInfo, searchExercises, newCustomExercise } from '../exercises.js';

/**
 * Swaps the given sheet over to a searchable exercise list, then hands the
 * chosen exercise back. Reuses the sheet rather than stacking a second one,
 * so the back gesture still means "back to the workout".
 */
export function openExercisePicker(sheet, { onPick, onCancel }) {
  let query = '';
  let muscleFilter = null;

  const search = el('input', {
    type: 'text', placeholder: 'Search exercises…', autocomplete: 'off',
    oninput: (e) => { query = e.target.value; draw(); },
  });

  const filterRow = el('div', { class: 'chip-row' });
  const list = el('div', { class: 'ex-list' });

  function drawFilters() {
    filterRow.replaceChildren(...MUSCLES.map((m) => el('button', {
      class: 'chip',
      'aria-pressed': String(muscleFilter === m.key),
      style: { '--pick': m.color },
      onclick: () => { muscleFilter = muscleFilter === m.key ? null : m.key; haptic(4); drawFilters(); draw(); },
    }, m.label)));
  }

  function draw() {
    const custom = store.customExercises;
    let results = searchExercises(query, custom);
    if (muscleFilter) {
      // Exercises that target the muscle come before ones that merely assist —
      // filtering by Glutes should open with hip thrusts, not back squats.
      results = results
        .filter((e) => e.muscles.includes(muscleFilter))
        .sort((a, b) => a.muscles.indexOf(muscleFilter) - b.muscles.indexOf(muscleFilter));
    }

    list.replaceChildren();
    if (!results.length) {
      list.append(el('div', { class: 'empty' }, `Nothing matching “${query}”.`));
    }
    for (const ex of results.slice(0, 120)) {
      const primary = muscleInfo(ex.muscles[0]);
      list.append(el('button', {
        class: 'ex-row',
        onclick: () => { haptic(); onPick(ex); },
      },
        el('span', { class: 'ex-dot', style: { background: primary.color } }),
        el('span', { class: 'ex-body' },
          el('span', { class: 'ex-name' }, ex.name),
          el('span', { class: 'ex-muscles' }, ex.muscles.map((m) => muscleInfo(m).label).join(' · ')),
        ),
        ex.custom ? el('span', { class: 'src' }, 'yours') : null,
      ));
    }

    // Anything not in the library can be added on the spot.
    if (query.trim() && !results.some((e) => e.name.toLowerCase() === query.trim().toLowerCase())) {
      list.append(el('button', {
        class: 'ex-row is-new',
        onclick: () => openCustomForm(query.trim()),
      },
        el('span', { class: 'ex-dot', style: { background: 'var(--accent)' } }, '+'),
        el('span', { class: 'ex-body' },
          el('span', { class: 'ex-name' }, `Create “${query.trim()}”`),
          el('span', { class: 'ex-muscles' }, 'Add your own exercise'),
        ),
      ));
    }
  }

  function openCustomForm(name) {
    const picked = new Set(muscleFilter ? [muscleFilter] : []);
    const nameInput = el('input', { type: 'text', value: name, placeholder: 'Exercise name' });
    const grid = el('div', { class: 'chip-row' });
    const drawGrid = () => grid.replaceChildren(...MUSCLES.map((m) => el('button', {
      class: 'chip',
      'aria-pressed': String(picked.has(m.key)),
      style: { '--pick': m.color },
      onclick: () => { picked.has(m.key) ? picked.delete(m.key) : picked.add(m.key); haptic(4); drawGrid(); },
    }, m.label)));
    drawGrid();

    sheet.setTitle('New exercise', 'Pick the muscles it works');
    sheet.setBody(el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'Name'), nameInput),
      el('div', { class: 'field' },
        el('span', { class: 'field-label' }, 'Muscles — tap the main one first'),
        grid),
      el('p', { class: 'tiny muted' },
        'The first muscle you pick counts as the primary one. Progress gives it '
        + 'full credit for each set and counts the rest as half.'),
    ));
    sheet.setFooter([
      el('button', { class: 'btn btn-ghost', onclick: () => show() }, 'Back'),
      el('button', {
        class: 'btn btn-primary',
        onclick: () => {
          if (!nameInput.value.trim()) { toast('Give it a name', 'error'); return; }
          if (!picked.size) { toast('Pick at least one muscle', 'error'); return; }
          const ex = store.addCustomExercise(newCustomExercise(nameInput.value, [...picked]));
          onPick(ex);
        },
      }, 'Add exercise'),
    ]);
  }

  function show() {
    drawFilters();
    draw();
    sheet.setTitle('Add an exercise', '');
    sheet.setBody(el('div', {},
      el('div', { class: 'field' }, search),
      filterRow,
      list,
    ));
    sheet.setFooter([
      el('button', { class: 'btn btn-ghost', onclick: () => onCancel() }, 'Back'),
    ]);
  }

  show();
}
