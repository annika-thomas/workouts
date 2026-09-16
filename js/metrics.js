import { BANDS } from './score.js';

/**
 * Daily (non-workout) metrics: what you ate, what you drank, and the colour
 * ramps that let the calendar be read through each of them.
 *
 * The rule across every lens: green reads as the good end, warm as the less
 * good end, and an untracked day stays an empty ring.
 */

export const DIET = [
  { value: 1, icon: '🍩', label: 'Indulgent', color: '#cf8360' },
  { value: 2, icon: '🍟', label: 'Heavy',     color: '#dfa974' },
  { value: 3, icon: '🥪', label: 'Normal',    color: '#d9cb85' },
  { value: 4, icon: '🥗', label: 'Good',      color: '#a3c07f' },
  { value: 5, icon: '🥦', label: 'Clean',     color: '#779c5e' },
];

export function dietInfo(value) {
  return DIET.find((d) => d.value === value) || null;
}

/** Standard drinks. 6 is stored for "5+", which the UI labels as such. */
export const DRINK_STEPS = [0, 1, 2, 3, 4, 5];
export const DRINK_COLORS = ['#779c5e', '#8fb06a', '#bccb87', '#d9cb85', '#dfa974', '#cf8360'];

export function drinksColor(n) {
  if (n == null) return null;
  return DRINK_COLORS[Math.min(Math.round(n), DRINK_COLORS.length - 1)];
}

export function drinksLabel(n) {
  if (n == null) return '';
  return n >= 5 ? '5+' : String(n);
}

const SLEEP_BANDS = [
  [5, '#cf8360'], [6, '#dfa974'], [7, '#d9cb85'],
  [8, '#a3c07f'], [9, '#779c5e'], [Infinity, '#7897a9'],
];

export function sleepColor(hours) {
  if (hours == null) return null;
  return (SLEEP_BANDS.find(([max]) => hours < max) || SLEEP_BANDS.at(-1))[1];
}

/** Compact enough to sit inside a 44px calendar bubble. */
export function sleepLabel(hours) {
  if (hours == null) return '';
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** Has anything at all been logged for this day beyond its workouts? */
export function hasCheckin(day) {
  if (!day) return false;
  return ['sleepHours', 'sleepQuality', 'restingHr', 'weightKg', 'steps',
    'energy', 'soreness', 'diet', 'drinks', 'notes']
    .some((k) => day[k] !== null && day[k] !== undefined && day[k] !== '');
}

/**
 * The lenses the calendar can be read through. Each returns what to paint in
 * a day's bubble, or null when that day has nothing for this metric.
 */
export const LENSES = [
  { key: 'day',      label: 'Day' },
  { key: 'workouts', label: 'Moved' },
  { key: 'food',     label: 'Food' },
  { key: 'drinks',   label: 'Drinks' },
  { key: 'sleep',    label: 'Sleep' },
];

export function lensLegend(key) {
  switch (key) {
    case 'day': return BANDS.map((b) => ({ color: b.color, label: b.label }));
    case 'food':   return DIET.map((d) => ({ color: d.color, label: `${d.icon} ${d.label}` }));
    case 'drinks': return DRINK_COLORS.map((color, i) => ({ color, label: i >= 5 ? '5+' : String(i) }));
    case 'sleep':  return [
      { color: '#cf8360', label: 'under 5h' }, { color: '#d9cb85', label: '6–7h' },
      { color: '#a3c07f', label: '7–8h' }, { color: '#779c5e', label: '8–9h' },
      { color: '#7897a9', label: '9h+' },
    ];
    default: return null;
  }
}
