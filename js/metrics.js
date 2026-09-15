/**
 * Daily (non-workout) metrics: what you ate, what you drank, and the colour
 * ramps that let the calendar be read through each of them.
 *
 * The rule across every lens: green reads as the good end, warm as the less
 * good end, and an untracked day stays an empty ring.
 */

export const DIET = [
  { value: 1, icon: '🍩', label: 'Indulgent', color: '#f2a3c0' },
  { value: 2, icon: '🍟', label: 'Heavy',     color: '#f6a58e' },
  { value: 3, icon: '🥪', label: 'Normal',    color: '#f0d97e' },
  { value: 4, icon: '🥗', label: 'Good',      color: '#cde39a' },
  { value: 5, icon: '🥦', label: 'Clean',     color: '#8fd6b4' },
];

export function dietInfo(value) {
  return DIET.find((d) => d.value === value) || null;
}

/** Standard drinks. 6 is stored for "5+", which the UI labels as such. */
export const DRINK_STEPS = [0, 1, 2, 3, 4, 5];
export const DRINK_COLORS = ['#b9dd9f', '#cde39a', '#f0d97e', '#f7c987', '#f6a58e', '#ef8f94'];

export function drinksColor(n) {
  if (n == null) return null;
  return DRINK_COLORS[Math.min(Math.round(n), DRINK_COLORS.length - 1)];
}

export function drinksLabel(n) {
  if (n == null) return '';
  return n >= 5 ? '5+' : String(n);
}

const SLEEP_BANDS = [
  [5, '#f6a58e'], [6, '#f7c987'], [7, '#f0d97e'],
  [8, '#cde39a'], [9, '#8fd6b4'], [Infinity, '#8fc9ee'],
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
  { key: 'workouts', label: 'Workouts' },
  { key: 'food',     label: 'Food' },
  { key: 'drinks',   label: 'Drinks' },
  { key: 'sleep',    label: 'Sleep' },
];

export function lensLegend(key) {
  switch (key) {
    case 'food':   return DIET.map((d) => ({ color: d.color, label: `${d.icon} ${d.label}` }));
    case 'drinks': return DRINK_COLORS.map((color, i) => ({ color, label: i >= 5 ? '5+' : String(i) }));
    case 'sleep':  return [
      { color: '#f6a58e', label: 'under 5h' }, { color: '#f0d97e', label: '6–7h' },
      { color: '#cde39a', label: '7–8h' }, { color: '#8fd6b4', label: '8–9h' },
      { color: '#8fc9ee', label: '9h+' },
    ];
    default: return null;
  }
}
