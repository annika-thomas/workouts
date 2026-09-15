/**
 * The little faces that fill each calendar day.
 *
 * Colour says *what* you did (the activity's pastel), the expression says
 * *how it went* — so a glance at the month reads as both a log and a mood.
 */

const EYES = '<circle cx="8.6" cy="9.6" r="1.45"/><circle cx="15.4" cy="9.6" r="1.45"/>';
const SLEEPY_EYES =
  '<path d="M6.9 9.5q1.7 1.9 3.4 0M13.7 9.5q1.7 1.9 3.4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';

const FACES = {
  // An easy day: a small, contented curve.
  content: EYES + '<path d="M9 14.4q3 3 6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // A good session: full open grin.
  happy: EYES + '<path d="M7.6 13.4h8.8a4.4 4.4 0 0 1-8.8 0Z"/>',
  // A hard one: flat mouth, getting on with it.
  focused: EYES + '<path d="M9.6 15h4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // Rest day: eyes shut.
  sleepy: SLEEPY_EYES + '<path d="M10.2 14.6q1.8 1.7 3.6 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  // Middle of the road: flat mouth, no verdict either way.
  neutral: EYES + '<path d="M9.6 15h4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // Slipping: a shallow frown.
  unsure: EYES + '<path d="M9.2 15.6q2.8-2.3 5.6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  // Rough: a clear one.
  sad: EYES + '<path d="M8.8 16q3.2-3.2 6.4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
};

export const FACE_KINDS = Object.keys(FACES);

export function faceSvg(kind = 'content') {
  return `<svg class="face" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${FACES[kind] || FACES.content}</svg>`;
}

export function faceEl(kind) {
  const wrap = document.createElement('span');
  wrap.innerHTML = faceSvg(kind);
  return wrap.firstElementChild;
}

/**
 * Pick an expression for a day's workouts.
 * Rest days sleep; long or maximal sessions look focused; a decent session
 * grins; anything lighter is content.
 */
export function faceForDay(workouts) {
  const real = workouts.filter((w) => w.type !== 'rest');
  if (!real.length) return workouts.length ? 'sleepy' : null;

  const minutes = real.reduce((sum, w) => sum + (w.durationMin || 0), 0);
  const topRpe = Math.max(0, ...real.map((w) => w.rpe || 0));

  if (topRpe >= 8 || minutes >= 100) return 'focused';
  if (real.length > 1 || topRpe >= 6 || minutes >= 50) return 'happy';
  return 'content';
}

/** The workout whose colour the day takes: the longest one of the day. */
export function primaryWorkout(workouts) {
  const real = workouts.filter((w) => w.type !== 'rest');
  const list = real.length ? real : workouts;
  return list.slice().sort((a, b) => (b.durationMin || 0) - (a.durationMin || 0))[0] || null;
}
