import { el, haptic } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { openEditor } from './editor.js';
import { openCheckin } from './checkin.js';
import { store } from '../store.js';
import { todayKey } from '../util/date.js';
import { hasCheckin } from '../metrics.js';
import { routineChips } from './routines.js';

/**
 * What the centre button opens: two big targets, because the app does two
 * things and neither should be buried under the other.
 */
export function openLogChooser(onDone) {
  const day = store.day(todayKey());
  const checkedIn = hasCheckin(day);
  const workouts = store.workoutsOn(todayKey()).length;

  const option = (icon, tint, title, sub, run) => el('button', {
    class: 'choice',
    onclick: () => { haptic(); sheet.close(); run(); },
  },
    el('span', { class: 'choice-ic', style: { background: tint } }, icon),
    el('span', { class: 'choice-body' },
      el('span', { class: 'choice-title' }, title),
      el('span', { class: 'choice-sub' }, sub),
    ),
  );

  const body = el('div', { class: 'choices' },
    option('🏃', '#f6d5cb', 'A workout',
      workouts ? `${workouts} already logged today` : 'Type, duration, distance, effort',
      () => openEditor({ date: todayKey(), onDone })),
    option('🌿', '#d9eecf', 'How today went',
      checkedIn ? 'Checked in — tap to edit' : 'Weight, food, drinks, sleep',
      () => openCheckin(todayKey(), { onDone })),
  );

  // The fastest path for a rotation: straight from here into a filled-in editor.
  const chips = routineChips((r) => {
    sheet.close();
    openEditor({ date: todayKey(), routineId: r.id, onDone });
  }, { label: 'Or pick up a routine' });
  if (chips) body.append(chips);

  const sheet = openSheet({ title: 'Log something', subtitle: 'Today', body });
  return sheet;
}
