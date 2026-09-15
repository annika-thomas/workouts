// Single source of truth. Everything lives in localStorage under one key so a
// backup is literally one JSON blob you can email yourself.

import { todayKey, monthKey, addDays, daysBetween, weekStartKey } from './util/date.js';
import { findExercise, muscleShare, entryVolume, bestSet } from './exercises.js';

const STORAGE_KEY = 'workouts.v1';
const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  units: 'metric',        // 'metric' | 'imperial'
  weekStart: 1,           // 0 = Sunday, 1 = Monday
  weeklyGoal: 4,          // sessions per week
  theme: 'auto',          // 'auto' | 'dark' | 'light'
  name: '',
  strava: {
    clientId: '', clientSecret: '', refreshToken: '',
    accessToken: '', expiresAt: 0, athlete: null, lastSync: null,
  },
  sync: { gistId: '', token: '', lastPush: null, lastPull: null },
};

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    workouts: {},   // id -> workout
    days: {},       // 'YYYY-MM-DD' -> daily metrics
    exercises: {},  // id -> user-created exercise definitions
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

function deepDefaults(target, defaults) {
  const out = { ...defaults, ...target };
  for (const [k, v] of Object.entries(defaults)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepDefaults(target?.[k] || {}, v);
    }
  }
  return out;
}

export function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

class Store extends EventTarget {
  constructor() {
    super();
    this.state = emptyState();
    this._saveTimer = null;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.state = this.migrate(JSON.parse(raw));
    } catch (err) {
      console.error('Could not read saved data, starting fresh', err);
    }
    this.state.settings = deepDefaults(this.state.settings, DEFAULT_SETTINGS);
    return this.state;
  }

  migrate(data) {
    const state = { ...emptyState(), ...data };
    state.version = SCHEMA_VERSION;
    return state;
  }

  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveNow(), 120);
  }

  saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.error('Save failed', err);
      this.emit('error', { message: 'Could not save — device storage may be full.' });
    }
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  changed(detail) {
    this.save();
    this.emit('change', detail);
  }

  get settings() { return this.state.settings; }

  updateSettings(patch) {
    this.state.settings = deepDefaults(patch, this.state.settings);
    this.changed({ kind: 'settings' });
  }

  // ---- workouts ---------------------------------------------------------

  get workouts() { return Object.values(this.state.workouts); }

  workoutsOn(dayKey) {
    return this.workouts
      .filter((w) => w.date === dayKey)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }

  // dayKey -> workout[] for a whole month, built once per render.
  workoutsByDay(month /* 'YYYY-MM' */) {
    const out = {};
    for (const w of this.workouts) {
      if (month && monthKey(w.date) !== month) continue;
      (out[w.date] ||= []).push(w);
    }
    for (const list of Object.values(out)) {
      list.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    }
    return out;
  }

  saveWorkout(workout) {
    const now = new Date().toISOString();
    const id = workout.id || newId();
    const existing = this.state.workouts[id];
    const record = {
      id,
      date: workout.date || todayKey(),
      time: workout.time || null,
      type: workout.type || 'other',
      title: (workout.title || '').trim(),
      durationMin: numOrNull(workout.durationMin),
      distanceKm: numOrNull(workout.distanceKm),
      elevationM: numOrNull(workout.elevationM),
      rpe: numOrNull(workout.rpe),
      avgHr: numOrNull(workout.avgHr),
      calories: numOrNull(workout.calories),
      notes: (workout.notes || '').trim(),
      exercises: normaliseEntries(workout.exercises ?? existing?.exercises),
      source: workout.source || existing?.source || 'manual',
      externalId: workout.externalId || existing?.externalId || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.state.workouts[id] = record;
    this.changed({ kind: 'workout', id, date: record.date });
    return record;
  }

  deleteWorkout(id) {
    const w = this.state.workouts[id];
    delete this.state.workouts[id];
    this.changed({ kind: 'workout', id, date: w?.date });
  }

  findByExternalId(source, externalId) {
    if (!externalId) return null;
    const ext = String(externalId);
    return this.workouts.find((w) => w.source === source && String(w.externalId) === ext) || null;
  }

  // ---- exercise library -------------------------------------------------

  get customExercises() { return this.state.exercises; }

  addCustomExercise(exercise) {
    this.state.exercises[exercise.id] = exercise;
    this.changed({ kind: 'exercise', id: exercise.id });
    return exercise;
  }

  lookupExercise(id) {
    return findExercise(id, this.state.exercises);
  }

  /** Every lift entry for one exercise, newest first, with its workout's date. */
  historyFor(exerciseId) {
    const out = [];
    for (const w of this.workouts) {
      for (const entry of w.exercises || []) {
        if (entry.exerciseId === exerciseId && (entry.sets || []).length) {
          out.push({ date: w.date, workoutId: w.id, entry });
        }
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }

  /** The sets you did last time, to prefill today's. */
  lastSetsFor(exerciseId, beforeWorkoutId = null) {
    const prior = this.historyFor(exerciseId).find((h) => h.workoutId !== beforeWorkoutId);
    return prior ? prior.entry.sets.map((s) => ({ ...s })) : null;
  }

  /**
   * Per-day work for one muscle across a range. `sets` and `volume` are both
   * share-weighted, so an exercise that only assists counts half.
   */
  muscleSeries(muscle, fromKeyStr, toKeyStr) {
    const byDate = {};
    for (const w of this.workouts) {
      if (w.date < fromKeyStr || w.date > toKeyStr) continue;
      for (const entry of w.exercises || []) {
        const ex = this.lookupExercise(entry.exerciseId);
        const share = muscleShare(ex, muscle);
        if (!share || !(entry.sets || []).length) continue;
        const d = (byDate[w.date] ||= { date: w.date, sets: 0, volume: 0, reps: 0 });
        d.sets += entry.sets.length * share;
        d.volume += entryVolume(entry) * share;
        d.reps += entry.sets.reduce((n, x) => n + (x.reps || 0), 0) * share;
      }
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Exercises hitting a muscle, with how recently and how heavily. */
  muscleExercises(muscle, fromKeyStr, toKeyStr) {
    const agg = {};
    for (const w of this.workouts) {
      if (w.date < fromKeyStr || w.date > toKeyStr) continue;
      for (const entry of w.exercises || []) {
        const ex = this.lookupExercise(entry.exerciseId);
        if (!muscleShare(ex, muscle) || !(entry.sets || []).length) continue;
        const share = muscleShare(ex, muscle);
        const a = (agg[entry.exerciseId] ||= {
          exerciseId: entry.exerciseId, exercise: ex, sets: 0, weightedSets: 0,
          volume: 0, sessions: 0, lastDate: null, primary: share === 1, best: null,
        });
        // Carry the best set through this pass rather than re-scanning every
        // workout once per exercise when the list renders.
        a.best = bestSet([a.best, ...entry.sets].filter(Boolean));
        a.sets += entry.sets.length;
        a.weightedSets += entry.sets.length * share;
        a.volume += entryVolume(entry);
        a.sessions += 1;
        if (!a.lastDate || w.date > a.lastDate) a.lastDate = w.date;
      }
    }
    // Rank by what each exercise actually contributes to THIS muscle, so a
    // quad lift that merely assists can't outrank the movement doing the work.
    return Object.values(agg).sort((a, b) => b.weightedSets - a.weightedSets);
  }

  /** Muscles worked in a range, most-worked first. Powers the picker's badges. */
  muscleTotals(fromKeyStr, toKeyStr) {
    const totals = {};
    for (const w of this.workouts) {
      if (w.date < fromKeyStr || w.date > toKeyStr) continue;
      for (const entry of w.exercises || []) {
        const ex = this.lookupExercise(entry.exerciseId);
        if (!ex || !(entry.sets || []).length) continue;
        for (const m of ex.muscles) {
          totals[m] = (totals[m] || 0) + entry.sets.length * muscleShare(ex, m);
        }
      }
    }
    return totals;
  }

  // ---- daily metrics ----------------------------------------------------

  day(dayKey) {
    return this.state.days[dayKey] || null;
  }

  saveDay(dayKey, patch) {
    const existing = this.state.days[dayKey] || { date: dayKey };
    const merged = { ...existing, ...patch, date: dayKey, updatedAt: new Date().toISOString() };
    // Drop the record entirely if every field is empty — keeps the blob small
    // and stops "logged nothing" days from looking tracked.
    const meaningful = Object.entries(merged).some(([k, v]) =>
      !['date', 'updatedAt'].includes(k) && v !== null && v !== undefined && v !== '');
    if (meaningful) this.state.days[dayKey] = merged;
    else delete this.state.days[dayKey];
    this.changed({ kind: 'day', date: dayKey });
  }

  // ---- derived stats ----------------------------------------------------

  /** Active = at least one workout that isn't a rest day. */
  isActive(dayKey) {
    return this.workoutsOn(dayKey).some((w) => w.type !== 'rest');
  }

  /** Consecutive active days ending today (or yesterday, so today isn't a failure yet). */
  currentStreak() {
    let cursor = todayKey();
    if (!this.isActive(cursor)) {
      cursor = addDays(cursor, -1);
      if (!this.isActive(cursor)) return 0;
    }
    let n = 0;
    while (this.isActive(cursor) && n < 5000) { n++; cursor = addDays(cursor, -1); }
    return n;
  }

  longestStreak() {
    const active = [...new Set(this.workouts.filter((w) => w.type !== 'rest').map((w) => w.date))].sort();
    let best = 0, run = 0, prev = null;
    for (const key of active) {
      run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1;
      prev = key;
      best = Math.max(best, run);
    }
    return best;
  }

  /**
   * Days since the most recent drinking day. Deliberately not a "streak":
   * a day you forgot to log shouldn't reset it, and this is the number that
   * actually means something.
   */
  daysSinceLastDrink() {
    const drinking = Object.values(this.state.days)
      .filter((d) => d.drinks > 0)
      .map((d) => d.date)
      .sort();
    const last = drinking.at(-1);
    if (!last) return null;
    return Math.max(0, daysBetween(last, todayKey()));
  }

  /** Daily records in an inclusive range, oldest first. */
  daysIn(fromKeyStr, toKeyStr) {
    return Object.values(this.state.days)
      .filter((d) => d.date >= fromKeyStr && d.date <= toKeyStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Aggregate totals over an inclusive day-key range. */
  summary(fromKeyStr, toKeyStr) {
    const list = this.workouts.filter((w) => w.date >= fromKeyStr && w.date <= toKeyStr && w.type !== 'rest');
    const byType = {};
    let minutes = 0, km = 0, elev = 0;
    for (const w of list) {
      minutes += w.durationMin || 0;
      km += w.distanceKm || 0;
      elev += w.elevationM || 0;
      const t = (byType[w.type] ||= { count: 0, minutes: 0, km: 0 });
      t.count++; t.minutes += w.durationMin || 0; t.km += w.distanceKm || 0;
    }
    const days = new Set(list.map((w) => w.date));
    const sleeps = Object.values(this.state.days)
      .filter((d) => d.date >= fromKeyStr && d.date <= toKeyStr && d.sleepHours != null)
      .map((d) => d.sleepHours);
    return {
      sessions: list.length,
      activeDays: days.size,
      minutes,
      km,
      elev,
      byType,
      avgSleep: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
    };
  }

  /** Sessions per week for the last n weeks, oldest first. */
  weeklyCounts(n = 12) {
    const ws = this.settings.weekStart;
    const thisWeek = weekStartKey(todayKey(), ws);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i);
      const end = addDays(start, 6);
      const s = this.summary(start, end);
      out.push({ start, end, count: s.sessions, minutes: s.minutes });
    }
    return out;
  }

  // ---- bulk data --------------------------------------------------------

  exportData() {
    return {
      app: 'workouts',
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      workouts: this.state.workouts,
      days: this.state.days,
      exercises: this.state.exercises,
      settings: redactSecrets(this.state.settings),
    };
  }

  /**
   * Merge an export back in. Returns counts. Conflicts resolve by updatedAt,
   * so pulling an older backup never clobbers newer edits.
   */
  importData(data, { replace = false } = {}) {
    if (!data || typeof data !== 'object') throw new Error('Not a valid backup file.');
    const incomingWorkouts = data.workouts || {};
    const incomingDays = data.days || {};
    if (replace) { this.state.workouts = {}; this.state.days = {}; this.state.exercises = {}; }

    let added = 0, updated = 0;
    for (const [id, w] of Object.entries(incomingWorkouts)) {
      const mine = this.state.workouts[id];
      if (!mine) { this.state.workouts[id] = w; added++; }
      else if ((w.updatedAt || '') > (mine.updatedAt || '')) { this.state.workouts[id] = w; updated++; }
    }
    // Take the incoming definition: a rename in the backup should win, and on a
    // replace-restore there is nothing here to preserve anyway.
    for (const [id, ex] of Object.entries(data.exercises || {})) {
      this.state.exercises[id] = ex;
    }
    let dayCount = 0;
    for (const [key, d] of Object.entries(incomingDays)) {
      const mine = this.state.days[key];
      if (!mine || (d.updatedAt || '') > (mine.updatedAt || '')) { this.state.days[key] = d; dayCount++; }
    }
    this.changed({ kind: 'bulk' });
    return { added, updated, days: dayCount };
  }

  clearAll() {
    const settings = this.state.settings;
    this.state = emptyState();
    this.state.settings = settings; // keep prefs & connections
    this.changed({ kind: 'bulk' });
  }
}

/** Keep only well-formed sets, so a half-filled row never reaches storage. */
function normaliseEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.name || '',
    notes: (e.notes || '').trim(),
    sets: (e.sets || [])
      .map((s) => ({ reps: numOrNull(s.reps), weightKg: numOrNull(s.weightKg) }))
      .filter((s) => s.reps != null && s.reps > 0),
  })).filter((e) => e.exerciseId);
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Never let tokens ride along in a file you might email or commit. */
function redactSecrets(settings) {
  const s = structuredClone(settings);
  s.strava = { ...s.strava, clientSecret: '', refreshToken: '', accessToken: '', expiresAt: 0 };
  s.sync = { ...s.sync, token: '' };
  return s;
}

export const store = new Store();
