// Workout taxonomy. `key` is what gets persisted, so don't rename existing keys
// without a migration in store.js.
export const TYPES = [
  { key: 'run',      label: 'Run',       icon: '🏃', color: '#c6835b', distance: true,  pace: 'pace' },
  { key: 'ride',     label: 'Ride',      icon: '🚴', color: '#d4a368', distance: true,  pace: 'speed' },
  { key: 'lift',     label: 'Lift',      icon: '🏋️', color: '#998ea9', distance: false, pace: null },
  { key: 'swim',     label: 'Swim',      icon: '🏊', color: '#7897a9', distance: true,  pace: 'swim' },
  { key: 'climb',    label: 'Climb',     icon: '🧗', color: '#bb848c', distance: false, pace: null },
  { key: 'yoga',     label: 'Yoga',      icon: '🧘', color: '#789b81', distance: false, pace: null },
  { key: 'walk',     label: 'Walk',      icon: '🚶', color: '#9b9c8a', distance: true,  pace: 'pace' },
  { key: 'hike',     label: 'Hike',      icon: '🥾', color: '#879b54', distance: true,  pace: 'pace' },
  { key: 'ski',      label: 'Ski',       icon: '🎿', color: '#8394ac', distance: true,  pace: 'speed' },
  { key: 'row',      label: 'Row',       icon: '🚣', color: '#699c95', distance: true,  pace: 'speed' },
  { key: 'sport',    label: 'Sport',     icon: '⚽', color: '#c0a455', distance: false, pace: null },
  { key: 'mobility', label: 'Mobility',  icon: '🤸', color: '#a3b076', distance: false, pace: null },
  { key: 'rest',     label: 'Rest day',  icon: '😴', color: '#a8a695', distance: false, pace: null },
  { key: 'other',    label: 'Other',     icon: '✨', color: '#b5ac93', distance: false, pace: null },
];

const BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));

export function typeInfo(key) {
  return BY_KEY[key] || { key: key || 'other', label: key || 'Other', icon: '✨', color: '#b5ac93', distance: false, pace: null };
}

// Maps Strava's sport_type / activity-type strings onto our keys.
const STRAVA_MAP = {
  run: 'run', trailrun: 'run', virtualrun: 'run', treadmillrun: 'run',
  ride: 'ride', virtualride: 'ride', mountainbikeride: 'ride', gravelride: 'ride',
  ebikeride: 'ride', emountainbikeride: 'ride', handcycle: 'ride', velomobile: 'ride',
  swim: 'swim', openwaterswim: 'swim',
  weighttraining: 'lift', workout: 'lift', crossfit: 'lift',
  rockclimbing: 'climb', bouldering: 'climb',
  yoga: 'yoga', pilates: 'yoga',
  walk: 'walk', wheelchair: 'walk',
  hike: 'hike', snowshoe: 'hike',
  alpineski: 'ski', backcountryski: 'ski', nordicski: 'ski', rollerski: 'ski', snowboard: 'ski',
  rowing: 'row', virtualrow: 'row', kayaking: 'row', canoeing: 'row', standuppaddling: 'row', surfing: 'row',
  soccer: 'sport', badminton: 'sport', tennis: 'sport', pickleball: 'sport', squash: 'sport',
  tabletennis: 'sport', racquetball: 'sport', golf: 'sport',
  elliptical: 'other', stairstepper: 'other', inlineskate: 'other', iceskate: 'other', skateboard: 'other',
};

export function mapSportType(sport) {
  if (!sport) return 'other';
  return STRAVA_MAP[String(sport).toLowerCase().replace(/[\s_-]/g, '')] || 'other';
}
