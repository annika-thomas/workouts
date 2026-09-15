// Display-side unit conversion. Everything is *stored* metric (km, m, kg);
// imperial is purely a presentation choice so switching never mutates data.

export const KM_PER_MI = 1.609344;
export const KG_PER_LB = 0.45359237;

export function distanceLabel(units) { return units === 'imperial' ? 'mi' : 'km'; }
export function weightLabel(units) { return units === 'imperial' ? 'lb' : 'kg'; }
export function elevLabel(units) { return units === 'imperial' ? 'ft' : 'm'; }

export function kmToDisplay(km, units) {
  if (km == null) return null;
  return units === 'imperial' ? km / KM_PER_MI : km;
}
export function displayToKm(value, units) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return units === 'imperial' ? n * KM_PER_MI : n;
}
export function kgToDisplay(kg, units) {
  if (kg == null) return null;
  return units === 'imperial' ? kg / KG_PER_LB : kg;
}
export function displayToKg(value, units) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return units === 'imperial' ? n * KG_PER_LB : n;
}
export function mToElev(m, units) {
  if (m == null) return null;
  return units === 'imperial' ? m * 3.280839895 : m;
}
export function elevToM(value, units) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return units === 'imperial' ? n / 3.280839895 : n;
}

export function round(n, places = 1) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** 95 -> "1h 35m", 45 -> "45m" */
export function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatDistance(km, units, places = 1) {
  const v = kmToDisplay(km, units);
  if (v == null) return '';
  return `${round(v, places)} ${distanceLabel(units)}`;
}

/** Pace per km/mi from distance + duration, e.g. "5:12 /km". */
export function formatPace(km, minutes, units) {
  if (!km || !minutes) return '';
  const dist = kmToDisplay(km, units);
  if (!dist) return '';
  const perUnit = minutes / dist;
  if (!Number.isFinite(perUnit) || perUnit > 120) return '';
  const m = Math.floor(perUnit);
  const s = Math.round((perUnit - m) * 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')} /${distanceLabel(units)}`;
}

export function formatSleep(hours) {
  if (hours == null) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Average speed, for activities where pace-per-km isn't the natural read. */
export function formatSpeed(km, minutes, units) {
  if (!km || !minutes) return '';
  const dist = kmToDisplay(km, units);
  const speed = dist / (minutes / 60);
  if (!Number.isFinite(speed) || speed <= 0) return '';
  return `${round(speed, 1)} ${distanceLabel(units)}/h`;
}

/** Swim pace, which is read per 100 m rather than per km. */
export function formatSwimPace(km, minutes) {
  if (!km || !minutes) return '';
  const per100 = minutes / (km * 10);
  if (!Number.isFinite(per100) || per100 > 20) return '';
  const m = Math.floor(per100);
  const s = Math.round((per100 - m) * 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')} /100m`;
}

/** The right speed/pace string for a workout, or '' when it doesn't apply. */
export function formatEffortRate(workout, paceStyle, units) {
  if (!workout.distanceKm || !workout.durationMin) return '';
  if (paceStyle === 'speed') return formatSpeed(workout.distanceKm, workout.durationMin, units);
  if (paceStyle === 'swim') return formatSwimPace(workout.distanceKm, workout.durationMin);
  if (paceStyle === 'pace') return formatPace(workout.distanceKm, workout.durationMin, units);
  return '';
}
