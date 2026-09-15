// Single source of truth. Everything lives in localStorage under one key so a
// backup is literally one JSON blob you can email yourself.

import { todayKey, monthKey, addDays, daysBetween, weekStartKey } from './util/date.js';

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
    if (replace) { this.state.workouts = {}; this.state.days = {}; }

    let added = 0, updated = 0;
    for (const [id, w] of Object.entries(incomingWorkouts)) {
      const mine = this.state.workouts[id];
      if (!mine) { this.state.workouts[id] = w; added++; }
      else if ((w.updatedAt || '') > (mine.updatedAt || '')) { this.state.workouts[id] = w; updated++; }
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
