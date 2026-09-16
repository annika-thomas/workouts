/**
 * Muscle groups and the built-in exercise library.
 *
 * Each exercise lists the muscles it works with the PRIMARY one first. That
 * ordering is what muscle-group progress leans on: a primary muscle takes the
 * full set, a secondary one counts half, so accessory work shows up without
 * drowning out the lift it came from.
 */

export const MUSCLES = [
  { key: 'chest',      label: 'Chest',      color: '#be7043' },
  { key: 'back',       label: 'Back',       color: '#5f8296' },
  { key: 'shoulders',  label: 'Shoulders',  color: '#d4a368' },
  { key: 'traps',      label: 'Traps',      color: '#7f91a9' },
  { key: 'biceps',     label: 'Biceps',     color: '#7e7093' },
  { key: 'triceps',    label: 'Triceps',    color: '#6e9478' },
  { key: 'forearms',   label: 'Forearms',   color: '#a3b076' },
  { key: 'core',       label: 'Core',       color: '#c0a455' },
  { key: 'glutes',     label: 'Glutes',     color: '#ae6b75' },
  { key: 'quads',      label: 'Quads',      color: '#5f9089' },
  { key: 'hamstrings', label: 'Hamstrings', color: '#7d8f4e' },
  { key: 'calves',     label: 'Calves',     color: '#b5ac93' },
];

const MUSCLE_BY_KEY = Object.fromEntries(MUSCLES.map((m) => [m.key, m]));

export function muscleInfo(key) {
  return MUSCLE_BY_KEY[key] || { key, label: key, color: '#b5ac93' };
}

/** [id, name, 'primary secondary …', equipment, unit?] */
const RAW = [
  // ---- legs, glutes, posterior chain ----
  ['back-squat', 'Back squat', 'quads glutes core', 'barbell'],
  ['front-squat', 'Front squat', 'quads glutes core', 'barbell'],
  ['goblet-squat', 'Goblet squat', 'quads glutes', 'dumbbell'],
  ['hack-squat', 'Hack squat', 'quads glutes', 'machine'],
  ['leg-press', 'Leg press', 'quads glutes', 'machine'],
  ['bulgarian-split-squat', 'Bulgarian split squat', 'quads glutes', 'dumbbell'],
  ['lunge', 'Lunge', 'quads glutes', 'dumbbell'],
  ['walking-lunge', 'Walking lunge', 'quads glutes', 'dumbbell'],
  ['step-up', 'Step-up', 'quads glutes', 'dumbbell'],
  ['leg-extension', 'Leg extension', 'quads', 'machine'],
  ['deadlift', 'Deadlift', 'hamstrings glutes back', 'barbell'],
  ['romanian-deadlift', 'Romanian deadlift', 'hamstrings glutes', 'barbell'],
  ['stiff-leg-deadlift', 'Stiff-leg deadlift', 'hamstrings glutes', 'barbell'],
  ['sumo-deadlift', 'Sumo deadlift', 'glutes hamstrings quads', 'barbell'],
  ['trap-bar-deadlift', 'Trap bar deadlift', 'quads glutes back', 'barbell'],
  ['hip-thrust', 'Hip thrust', 'glutes hamstrings', 'barbell'],
  ['glute-bridge', 'Glute bridge', 'glutes', 'bodyweight'],
  ['single-leg-hip-thrust', 'Single-leg hip thrust', 'glutes', 'bodyweight'],
  ['cable-kickback', 'Cable glute kickback', 'glutes', 'cable'],
  ['hip-abduction', 'Hip abduction', 'glutes', 'machine'],
  ['good-morning', 'Good morning', 'hamstrings glutes back', 'barbell'],
  ['leg-curl', 'Lying leg curl', 'hamstrings', 'machine'],
  ['seated-leg-curl', 'Seated leg curl', 'hamstrings', 'machine'],
  ['nordic-curl', 'Nordic curl', 'hamstrings', 'bodyweight'],
  ['back-extension', 'Back extension', 'glutes hamstrings back', 'bodyweight'],
  ['calf-raise', 'Standing calf raise', 'calves', 'machine'],
  ['seated-calf-raise', 'Seated calf raise', 'calves', 'machine'],

  // ---- chest ----
  ['bench-press', 'Bench press', 'chest triceps shoulders', 'barbell'],
  ['incline-bench-press', 'Incline bench press', 'chest shoulders triceps', 'barbell'],
  ['decline-bench-press', 'Decline bench press', 'chest triceps', 'barbell'],
  ['dumbbell-bench-press', 'Dumbbell bench press', 'chest triceps shoulders', 'dumbbell'],
  ['incline-dumbbell-press', 'Incline dumbbell press', 'chest shoulders', 'dumbbell'],
  ['chest-fly', 'Dumbbell fly', 'chest', 'dumbbell'],
  ['cable-fly', 'Cable fly', 'chest', 'cable'],
  ['pec-deck', 'Pec deck', 'chest', 'machine'],
  ['push-up', 'Push-up', 'chest triceps core', 'bodyweight'],
  ['chest-dip', 'Chest dip', 'chest triceps', 'bodyweight'],

  // ---- back ----
  ['pull-up', 'Pull-up', 'back biceps', 'bodyweight'],
  ['chin-up', 'Chin-up', 'back biceps', 'bodyweight'],
  ['lat-pulldown', 'Lat pulldown', 'back biceps', 'cable'],
  ['barbell-row', 'Barbell row', 'back biceps', 'barbell'],
  ['pendlay-row', 'Pendlay row', 'back biceps', 'barbell'],
  ['dumbbell-row', 'Dumbbell row', 'back biceps', 'dumbbell'],
  ['seated-cable-row', 'Seated cable row', 'back biceps', 'cable'],
  ['t-bar-row', 'T-bar row', 'back biceps', 'barbell'],
  ['inverted-row', 'Inverted row', 'back biceps', 'bodyweight'],
  ['straight-arm-pulldown', 'Straight-arm pulldown', 'back', 'cable'],
  ['rack-pull', 'Rack pull', 'back traps hamstrings', 'barbell'],

  // ---- shoulders & traps ----
  ['overhead-press', 'Overhead press', 'shoulders triceps', 'barbell'],
  ['dumbbell-shoulder-press', 'Dumbbell shoulder press', 'shoulders triceps', 'dumbbell'],
  ['arnold-press', 'Arnold press', 'shoulders', 'dumbbell'],
  ['push-press', 'Push press', 'shoulders triceps', 'barbell'],
  ['lateral-raise', 'Lateral raise', 'shoulders', 'dumbbell'],
  ['front-raise', 'Front raise', 'shoulders', 'dumbbell'],
  ['rear-delt-fly', 'Rear delt fly', 'shoulders back', 'dumbbell'],
  ['face-pull', 'Face pull', 'shoulders traps back', 'cable'],
  ['upright-row', 'Upright row', 'shoulders traps', 'barbell'],
  ['shrug', 'Shrug', 'traps', 'dumbbell'],

  // ---- arms ----
  ['barbell-curl', 'Barbell curl', 'biceps', 'barbell'],
  ['dumbbell-curl', 'Dumbbell curl', 'biceps', 'dumbbell'],
  ['hammer-curl', 'Hammer curl', 'biceps forearms', 'dumbbell'],
  ['preacher-curl', 'Preacher curl', 'biceps', 'barbell'],
  ['cable-curl', 'Cable curl', 'biceps', 'cable'],
  ['incline-curl', 'Incline dumbbell curl', 'biceps', 'dumbbell'],
  ['concentration-curl', 'Concentration curl', 'biceps', 'dumbbell'],
  ['tricep-pushdown', 'Tricep pushdown', 'triceps', 'cable'],
  ['skullcrusher', 'Skullcrusher', 'triceps', 'barbell'],
  ['overhead-tricep-extension', 'Overhead tricep extension', 'triceps', 'dumbbell'],
  ['close-grip-bench', 'Close-grip bench press', 'triceps chest', 'barbell'],
  ['tricep-dip', 'Tricep dip', 'triceps chest', 'bodyweight'],
  ['wrist-curl', 'Wrist curl', 'forearms', 'dumbbell'],
  ['farmer-carry', 'Farmer carry', 'forearms traps core', 'dumbbell', 'time'],

  // ---- core ----
  ['plank', 'Plank', 'core', 'bodyweight', 'time'],
  ['side-plank', 'Side plank', 'core', 'bodyweight', 'time'],
  ['hollow-hold', 'Hollow hold', 'core', 'bodyweight', 'time'],
  ['hanging-leg-raise', 'Hanging leg raise', 'core', 'bodyweight'],
  ['crunch', 'Crunch', 'core', 'bodyweight'],
  ['cable-crunch', 'Cable crunch', 'core', 'cable'],
  ['russian-twist', 'Russian twist', 'core', 'bodyweight'],
  ['ab-wheel', 'Ab wheel rollout', 'core', 'bodyweight'],
  ['dead-bug', 'Dead bug', 'core', 'bodyweight'],
  ['bird-dog', 'Bird dog', 'core glutes', 'bodyweight'],
  ['mountain-climber', 'Mountain climber', 'core', 'bodyweight'],

  // ---- full body ----
  ['power-clean', 'Power clean', 'quads glutes traps back', 'barbell'],
  ['power-snatch', 'Power snatch', 'shoulders quads traps back', 'barbell'],
  ['thruster', 'Thruster', 'quads shoulders glutes', 'barbell'],
  ['kettlebell-swing', 'Kettlebell swing', 'glutes hamstrings core', 'kettlebell'],
  ['burpee', 'Burpee', 'chest quads core', 'bodyweight'],
  ['box-jump', 'Box jump', 'quads glutes calves', 'bodyweight'],
];

export const EXERCISES = RAW.map(([id, name, muscles, equipment, unit = 'reps']) => ({
  id, name, equipment, unit,
  muscles: muscles.split(' '),
  bodyweight: equipment === 'bodyweight',
}));

const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

/** Built-in first, then anything the user added themselves. */
export function findExercise(id, custom = {}) {
  return BY_ID[id] || custom[id] || null;
}

export function allExercises(custom = {}) {
  return [...EXERCISES, ...Object.values(custom)];
}

export function searchExercises(query, custom = {}) {
  const q = query.trim().toLowerCase();
  const list = allExercises(custom);
  if (!q) return list;
  return list
    .filter((e) => e.name.toLowerCase().includes(q) || e.muscles.some((m) => m.includes(q)))
    // Prefix matches first — typing "row" should surface rows before "Barbell row".
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)));
}

export function newCustomExercise(name, muscles) {
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    muscles: muscles.length ? muscles : ['core'],
    equipment: 'other',
    unit: 'reps',
    bodyweight: false,
    custom: true,
  };
}

// ---------------------------------------------------------------------------
// Volume and set maths
// ---------------------------------------------------------------------------

/** How much an exercise counts toward a muscle: 1 if primary, 0.5 if assisting. */
export function muscleShare(exercise, muscle) {
  if (!exercise) return 0;
  const i = exercise.muscles.indexOf(muscle);
  if (i === -1) return 0;
  return i === 0 ? 1 : 0.5;
}

/** Load moved by one exercise entry, in kg. Bodyweight sets contribute nothing. */
export function entryVolume(entry) {
  return (entry.sets || []).reduce(
    (sum, s) => sum + (s.weightKg || 0) * (s.reps || 0), 0);
}

export function entrySets(entry) {
  return (entry.sets || []).length;
}

/** The set with the most load; ties break toward more reps. */
export function bestSet(sets = []) {
  let best = null;
  for (const s of sets) {
    if (!s || !s.reps) continue;
    const w = s.weightKg || 0;
    if (!best || w > (best.weightKg || 0) || (w === (best.weightKg || 0) && s.reps > best.reps)) {
      best = s;
    }
  }
  return best;
}

export function formatSet(set, unit, units) {
  if (!set || !set.reps) return '';
  const rep = unit === 'time' ? `${set.reps}s` : `${set.reps}`;
  if (!set.weightKg) return rep;
  const w = units === 'imperial' ? set.weightKg / 0.45359237 : set.weightKg;
  const lbl = units === 'imperial' ? 'lb' : 'kg';
  return `${rep} @ ${Math.round(w * 10) / 10} ${lbl}`;
}

/** "3 × 8 @ 60 kg" when the sets match, otherwise "4 sets · 1,240 kg". */
export function summariseEntry(entry, exercise, units) {
  // A row you haven't typed reps into yet isn't a set — otherwise a freshly
  // added exercise reads "1 × null".
  const sets = (entry.sets || []).filter((s) => s && s.reps);
  if (!sets.length) return 'No sets yet';
  const unit = exercise?.unit || 'reps';
  const same = sets.every((s) => s.reps === sets[0].reps && (s.weightKg || 0) === (sets[0].weightKg || 0));
  if (same) {
    return `${sets.length} × ${formatSet(sets[0], unit, units)}`;
  }
  const vol = entryVolume({ sets });
  if (!vol) return `${sets.length} sets`;
  // Volume is stored in kg, so imperial needs converting like everywhere else.
  const shown = units === 'imperial' ? vol / 0.45359237 : vol;
  return `${sets.length} sets · ${Math.round(shown).toLocaleString()} ${units === 'imperial' ? 'lb' : 'kg'}`;
}
