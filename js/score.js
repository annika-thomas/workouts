/**
 * The day score behind the calendar's faces.
 *
 * A weighted blend of three things you control: how you ate, how little you
 * drank, and whether you moved. Two deliberate pieces of fairness sit on top:
 *
 *   - A rest day isn't a failure if you earned it. Training hard yesterday (or
 *     waking up sore) credits today's activity, so a sensible recovery day
 *     doesn't read as a bad one.
 *   - Weekend drinks are judged more gently than a Tuesday's.
 *
 * Only components you actually logged count; the weights re-normalise over
 * what's present, so a day where you logged one thing isn't punished for the
 * other two being blank.
 */

import { fromKey, addDays } from './util/date.js';

export const WEIGHTS = { activity: 0.40, food: 0.35, drink: 0.25 };

/** Score bands, best first. `min` is inclusive. */
export const BANDS = [
  { key: 'great', min: 0.82, label: 'Great day', face: 'happy',   color: '#3f5637' },
  { key: 'good',  min: 0.64, label: 'Good day',  face: 'content', color: '#7c9a5e' },
  { key: 'ok',    min: 0.45, label: 'Fine',      face: 'neutral', color: '#dccf93' },
  { key: 'meh',   min: 0.27, label: 'Off day',   face: 'unsure',  color: '#d19a5c' },
  { key: 'poor',  min: -1,   label: 'Rough day', face: 'sad',     color: '#a85c2f' },
];

export function bandFor(score) {
  return BANDS.find((b) => score >= b.min) || BANDS.at(-1);
}

// --- components -------------------------------------------------------------

/** Diet 1–5 onto 0–1. */
export function foodScore(diet) {
  return (diet - 1) / 4;
}

// Index by number of drinks, capped at 5+. The weekend curve is shifted, not
// switched off — a heavy Saturday still costs you, just less than a Tuesday.
const DRINK_WEEKDAY = [1, 0.80, 0.55, 0.30, 0.15, 0.05];
const DRINK_WEEKEND = [1, 0.95, 0.85, 0.60, 0.35, 0.15];

/** Friday and Saturday — the nights the slack is actually for. */
export function isWeekend(dayKey) {
  const d = fromKey(dayKey).getDay();
  return d === 5 || d === 6;
}

export function drinkScore(drinks, weekend) {
  const curve = weekend ? DRINK_WEEKEND : DRINK_WEEKDAY;
  return curve[Math.min(Math.max(Math.round(drinks), 0), curve.length - 1)];
}

/** How demanding a day's training was, 0–1. Drives tomorrow's rest credit. */
export function hardness(workouts) {
  const real = workouts.filter((w) => w.type !== 'rest');
  if (!real.length) return 0;
  const minutes = real.reduce((n, w) => n + (w.durationMin || 0), 0);
  const topRpe = Math.max(0, ...real.map((w) => w.rpe || 0));
  if (topRpe >= 8 || minutes >= 90) return 1;
  if (topRpe >= 6 || minutes >= 45) return 0.75;
  return 0.5;
}

/** Soreness 1–5 as evidence that today ought to be a rest day. */
function sorenessCredit(soreness) {
  if (soreness == null) return 0;
  if (soreness >= 5) return 1;
  if (soreness === 4) return 0.9;
  if (soreness === 3) return 0.5;
  return 0;
}

// Recovery fades: the day after a hard session is fully earned, the one after
// that only half. A third straight rest day is back on you.
const LOOKBACK = [1, 0.5];

/**
 * Activity credit for a day, 0–1: 1 for training, otherwise whatever rest you
 * earned. Returns the reason too, so the day sheet can explain itself.
 */
export function activityScore(dayKey, lookup) {
  const { workouts } = lookup(dayKey);
  const trained = workouts.some((w) => w.type !== 'rest');
  if (trained) return { value: 1, why: 'trained' };

  const today = lookup(dayKey);
  let best = { value: sorenessCredit(today.day?.soreness), why: 'sore' };

  if (workouts.length) {                       // an explicit rest day was logged
    const v = 0.7;
    if (v > best.value) best = { value: v, why: 'rest day' };
  }

  LOOKBACK.forEach((decay, i) => {
    const prev = lookup(addDays(dayKey, -(i + 1)));
    const v = hardness(prev.workouts) * decay;
    if (v > best.value) best = { value: v, why: i === 0 ? 'earned rest' : 'still recovering' };
  });

  return best.value > 0 ? best : { value: 0, why: 'no movement' };
}

// --- the score ---------------------------------------------------------------

/**
 * Score one day, or null when nothing at all was logged.
 * `lookup(key)` returns `{ workouts, day }`.
 */
export function scoreDay(dayKey, lookup) {
  const { workouts, day } = lookup(dayKey);
  const hasAnything = workouts.length
    || (day && ['diet', 'drinks', 'sleepHours', 'weightKg', 'soreness', 'energy', 'notes']
      .some((k) => day[k] !== null && day[k] !== undefined && day[k] !== ''));
  if (!hasAnything) return null;

  const weekend = isWeekend(dayKey);
  const parts = [];

  const activity = activityScore(dayKey, lookup);
  parts.push({
    key: 'activity', label: 'Movement', weight: WEIGHTS.activity,
    value: activity.value, detail: activity.why,
  });

  if (day?.diet != null) {
    parts.push({
      key: 'food', label: 'Food', weight: WEIGHTS.food,
      value: foodScore(day.diet), detail: `ate ${day.diet}/5`,
    });
  }
  if (day?.drinks != null) {
    parts.push({
      key: 'drink', label: 'Drinks', weight: WEIGHTS.drink,
      value: drinkScore(day.drinks, weekend),
      detail: day.drinks === 0
        ? 'none'
        : `${day.drinks >= 5 ? '5+' : day.drinks}${weekend ? ', weekend' : ''}`,
    });
  }

  const totalWeight = parts.reduce((n, p) => n + p.weight, 0);
  const score = parts.reduce((n, p) => n + p.value * p.weight, 0) / totalWeight;

  return {
    score,
    parts,
    band: bandFor(score),
    weekend,
    // How much of the picture you actually logged, for the "based on" note.
    coverage: parts.length / 3,
  };
}
