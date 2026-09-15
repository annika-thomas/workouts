import { parseCsv, toObjects } from './csv.js';
import { parseLooseDate, parseLooseTime } from '../util/date.js';
import { mapSportType } from '../types.js';
import { KM_PER_MI, KG_PER_LB } from '../util/units.js';

/**
 * Target fields a CSV column can be mapped onto. `group` decides whether a
 * mapped value becomes part of a workout record or that day's metrics.
 */
export const FIELDS = [
  { key: 'date',        label: 'Date',            group: 'both' },
  { key: 'time',        label: 'Time of day',     group: 'workout' },
  { key: 'type',        label: 'Activity type',   group: 'workout' },
  { key: 'title',       label: 'Title / name',    group: 'workout' },
  { key: 'durationMin', label: 'Duration',        group: 'workout' },
  { key: 'distance',    label: 'Distance',        group: 'workout' },
  { key: 'elevation',   label: 'Elevation gain',  group: 'workout' },
  { key: 'avgHr',       label: 'Average HR',      group: 'workout' },
  { key: 'calories',    label: 'Calories',        group: 'workout' },
  { key: 'workoutNotes',label: 'Workout notes',   group: 'workout' },
  { key: 'sleepHours',  label: 'Sleep duration',  group: 'day' },
  { key: 'restingHr',   label: 'Resting HR',      group: 'day' },
  { key: 'weight',      label: 'Body weight',     group: 'day' },
  { key: 'bodyFatPct',  label: 'Body fat %',      group: 'day' },
  { key: 'steps',       label: 'Steps',           group: 'day' },
  { key: 'drinks',      label: 'Drinks',          group: 'day' },
  { key: 'dayNotes',    label: 'Day notes',       group: 'day' },
];

/** Header patterns -> field key. First match wins, so order matters. */
const GUESSES = [
  [/^activity\s*date$|^start[_\s]?date|^date[_\s]?time|^datetime$|^date$|^time$|^measurement\s*time|^time\s*of\s*measurement|^measure(ment)?\s*date|^local\s*time|^day$|^recorded\s*(at|on)/i, 'date'],
  [/^activity\s*type$|^sport|^type$|^workout\s*type|^exercise(\s*type)?$/i, 'type'],
  [/^activity\s*name$|^name$|^title$|^description$/i, 'title'],
  [/elapsed\s*time|moving\s*time|^duration|^time\b.*\(|^total\s*time/i, 'durationMin'],
  [/^distance/i, 'distance'],
  [/elevation\s*gain|^elev|total\s*ascent|^ascent/i, 'elevation'],
  [/average\s*heart\s*rate|avg.*hr|^heart\s*rate$/i, 'avgHr'],
  [/calor|^kcal|energy/i, 'calories'],
  [/sleep.*(hour|duration|time|h$)|^asleep|time\s*asleep/i, 'sleepHours'],
  [/resting\s*(heart|hr)|^rhr$/i, 'restingHr'],
  [/^weight|body\s*weight|^mass/i, 'weight'],
  [/body\s*fat|^fat\s*%|^bodyfat/i, 'bodyFatPct'],
  [/^steps|step\s*count/i, 'steps'],
  [/^drinks?$|alcohol|standard\s*drinks|^units$/i, 'drinks'],
  [/^notes?$|^comment/i, 'workoutNotes'],
];

export function guessMapping(headers) {
  const mapping = {};
  const used = new Set();
  for (const h of headers) {
    for (const [re, field] of GUESSES) {
      if (re.test(h) && !used.has(field)) { mapping[h] = field; used.add(field); break; }
    }
  }
  // Nothing matched a date pattern: fall back to the first column that even
  // mentions a date or time, since an import without one is useless.
  if (!used.has('date')) {
    const fallback = headers.find((h) => !mapping[h] && /date|time|day/i.test(h));
    if (fallback) mapping[fallback] = 'date';
  }
  return mapping;
}

export function readCsvFile(text) {
  const rows = parseCsv(text);
  const { headers, records } = toObjects(rows);
  return { headers, records, mapping: guessMapping(headers) };
}

/**
 * Turn mapped rows into { workouts, days } ready for the store.
 * `opts.distanceUnit` / `opts.weightUnit` say how to read the source numbers;
 * `opts.durationUnit` covers CSVs that record seconds rather than minutes.
 */
export function buildRecords(records, mapping, opts = {}) {
  const {
    distanceUnit = 'km', weightUnit = 'kg', durationUnit = 'auto',
    defaultType = 'other', source = 'import',
  } = opts;

  const byField = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field) (byField[field] ||= []).push(header);
  }
  const get = (row, field) => {
    for (const h of byField[field] || []) {
      const v = row[h];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  };

  const workouts = [];
  const days = {};
  const skipped = [];

  const hasWorkoutCols = FIELDS.some((f) => f.group === 'workout' && byField[f.key]);
  const hasDayCols = FIELDS.some((f) => f.group === 'day' && byField[f.key]);

  records.forEach((row, i) => {
    const rawDate = get(row, 'date');
    const date = parseLooseDate(rawDate);
    if (!date) { skipped.push({ row: i + 2, reason: 'no readable date' }); return; }

    if (hasDayCols) {
      const patch = {};
      const sleep = parseSleep(get(row, 'sleepHours'));
      if (sleep != null) patch.sleepHours = sleep;
      const rhr = num(get(row, 'restingHr'));
      if (rhr != null) patch.restingHr = rhr;
      const w = num(get(row, 'weight'));
      if (w != null) patch.weightKg = weightUnit === 'lb' ? w * KG_PER_LB : w;
      const bf = num(get(row, 'bodyFatPct'));
      if (bf != null) patch.bodyFatPct = bf;
      const steps = num(get(row, 'steps'));
      if (steps != null) patch.steps = steps;
      const drinks = num(get(row, 'drinks'));
      if (drinks != null) patch.drinks = drinks;
      const notes = get(row, 'dayNotes');
      if (notes) patch.notes = notes;
      if (Object.keys(patch).length) days[date] = { ...(days[date] || {}), ...patch };
    }

    if (hasWorkoutCols) {
      const typeRaw = get(row, 'type');
      const dist = num(get(row, 'distance'));
      const elev = num(get(row, 'elevation'));
      const dur = parseDuration(get(row, 'durationMin'), durationUnit);
      const title = get(row, 'title');

      // A row with a date but nothing that looks like a session isn't a workout.
      if (typeRaw == null && dist == null && dur == null && title == null) return;

      workouts.push({
        date,
        time: parseLooseTime(get(row, 'time')) || parseLooseTime(rawDate),
        type: typeRaw ? mapSportType(typeRaw) : defaultType,
        title: title || '',
        durationMin: dur,
        distanceKm: dist == null ? null : (distanceUnit === 'mi' ? dist * KM_PER_MI : distanceUnit === 'm' ? dist / 1000 : dist),
        elevationM: elev == null ? null : (distanceUnit === 'mi' ? elev / 3.280839895 : elev),
        avgHr: num(get(row, 'avgHr')),
        calories: num(get(row, 'calories')),
        notes: get(row, 'workoutNotes') || '',
        source,
        externalId: get(row, 'externalId') || null,
      });
    }
  });

  return { workouts, days, skipped };
}

function num(v) {
  if (v == null) return null;
  const cleaned = String(v).replace(/[^0-9.,+-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== '' ? n : null;
}

/** Accepts 45, "45", "1:23:45", "1h 23m", or raw seconds when told to. */
function parseDuration(v, unit) {
  if (v == null) return null;
  const s = String(v).trim();

  const clock = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    return clock[3]
      ? +clock[1] * 60 + +clock[2] + +clock[3] / 60   // h:mm:ss
      : +clock[1] + +clock[2] / 60;                   // mm:ss
  }

  const human = s.match(/(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?/i);
  if (human && (human[1] || human[2])) return (+(human[1] || 0)) * 60 + (+(human[2] || 0));

  const n = num(s);
  if (n == null) return null;
  if (unit === 'sec') return n / 60;
  // Strava exports elapsed time in seconds; a bare number over 600 is almost
  // certainly seconds rather than a 10-hour session.
  if (unit === 'auto' && n > 600) return n / 60;
  return n;
}

function parseSleep(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const clock = s.match(/^(\d+):(\d{2})/);
  if (clock) return +clock[1] + +clock[2] / 60;
  const human = s.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
  if (human && (human[1] || human[2])) return (+(human[1] || 0)) + (+(human[2] || 0)) / 60;
  const n = num(s);
  if (n == null) return null;
  return n > 24 ? n / 60 : n;  // minutes vs hours
}
