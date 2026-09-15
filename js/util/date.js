// Date helpers. Everything in the app keys off a local "YYYY-MM-DD" day string
// so that a workout logged at 11pm doesn't jump to the next day via UTC.

export const MS_DAY = 86400000;

export function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function daysBetween(aKey, bKey) {
  return Math.round((fromKey(bKey) - fromKey(aKey)) / MS_DAY);
}

export function monthKey(key) {
  return key.slice(0, 7);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function monthName(y, m) { return MONTHS[m]; }
export function monthShort(m) { return MONTHS_SHORT[m]; }
export function weekdayLabels(weekStart) {
  const base = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return base.slice(weekStart).concat(base.slice(0, weekStart));
}

// "Mon, 15 Sep" / "Monday, 15 September 2026"
export function formatDay(key, long = false) {
  const d = fromKey(key);
  const wd = DAYS_SHORT[d.getDay()];
  const mo = long ? MONTHS[d.getMonth()] : MONTHS_SHORT[d.getMonth()];
  const wdFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  return long
    ? `${wdFull}, ${mo} ${d.getDate()}`
    : `${wd} ${mo} ${d.getDate()}`;
}

export function relativeDay(key) {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return null;
}

// Grid of 42 day-keys covering the month, padded to whole weeks.
export function monthGrid(year, month, weekStart = 1) {
  const first = new Date(year, month, 1);
  let lead = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - lead);
  const cells = [];
  const last = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((lead + last) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ key: toKey(d), inMonth: d.getMonth() === month, day: d.getDate() });
  }
  return cells;
}

// Monday-anchored (or weekStart-anchored) start of the week containing key.
export function weekStartKey(key, weekStart = 1) {
  const d = fromKey(key);
  const back = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - back);
  return toKey(d);
}

// Parse loose date input from CSV/JSON imports into a day key, or null.
export function parseLooseDate(value) {
  if (value == null) return null;
  if (value instanceof Date && !isNaN(value)) return toKey(value);
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);            // ISO first
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);  // D/M/YYYY or M/D/YYYY
  if (m) {
    let a = +m[1], b = +m[2];
    // Ambiguous: assume month-first unless that's impossible.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(s);                              // "12 Sep 2026, 7:04:12"
  if (!isNaN(parsed)) return toKey(parsed);
  return null;
}

export function parseLooseTime(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  const min = m[2];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${min}`;
}
