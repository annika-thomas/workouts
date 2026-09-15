import { el, toast, download } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { store } from '../store.js';
import { TYPES } from '../types.js';
import { readCsvFile, buildRecords, FIELDS } from '../integrations/importer.js';
import { toCsv } from '../integrations/csv.js';

/**
 * Two-step CSV import: map the file's columns onto our fields, then preview
 * the result before anything touches the database.
 */
export function openImportSheet(file, onDone) {
  const sheet = openSheet({ title: 'Import', subtitle: file.name });
  sheet.setBody(el('div', { class: 'empty' }, 'Reading file…'));

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = readCsvFile(String(reader.result));
    } catch (err) {
      sheet.setBody(el('div', { class: 'empty' }, `Could not read that file: ${err.message}`));
      return;
    }
    if (!parsed.headers.length || !parsed.records.length) {
      sheet.setBody(el('div', { class: 'empty' }, 'That file has no rows I can read.'));
      return;
    }
    step1(sheet, parsed, onDone);
  };
  reader.onerror = () => sheet.setBody(el('div', { class: 'empty' }, 'Could not read that file.'));
  reader.readAsText(file);
}

function step1(sheet, parsed, onDone) {
  const mapping = { ...parsed.mapping };
  const opts = { distanceUnit: 'km', weightUnit: 'kg', durationUnit: 'auto', defaultType: 'other', source: 'import' };

  const optionEls = () => [
    el('option', { value: '' }, '— ignore —'),
    ...FIELDS.map((f) => el('option', { value: f.key }, f.label)),
  ];

  const rows = parsed.headers.map((h) => {
    const sample = parsed.records.find((r) => r[h])?.[h] || '';
    const select = el('select', {
      onchange: (e) => { mapping[h] = e.target.value; },
    }, ...optionEls());
    select.value = mapping[h] || '';
    return el('div', { class: 'map-row' },
      el('div', { class: 'col' }, h, el('small', {}, sample ? `e.g. ${sample.slice(0, 26)}` : 'empty')),
      select,
    );
  });

  const unitSeg = (label, key, choices) => el('div', { class: 'field' },
    el('span', { class: 'field-label' }, label),
    el('div', { class: 'seg' }, ...choices.map(([v, txt]) => {
      const b = el('button', {
        'aria-pressed': String(opts[key] === v),
        onclick: () => {
          opts[key] = v;
          b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
        },
      }, txt);
      return b;
    })),
  );

  const typeSelect = el('select', { onchange: (e) => { opts.defaultType = e.target.value; } },
    ...TYPES.map((t) => el('option', { value: t.key }, `${t.icon} ${t.label}`)));
  typeSelect.value = 'other';

  sheet.setTitle('Match your columns', `${parsed.records.length} rows found`);
  sheet.setBody(el('div', {},
    el('p', { class: 'tiny muted' },
      'I guessed where I could. Change anything that looks wrong, and set unmatched columns to "ignore".'),
    ...rows,
    el('div', { style: { marginTop: '18px' } },
      unitSeg('Distance in the file is', 'distanceUnit', [['km', 'km'], ['mi', 'miles'], ['m', 'metres']]),
      unitSeg('Weight in the file is', 'weightUnit', [['kg', 'kg'], ['lb', 'lb']]),
      unitSeg('Duration numbers are', 'durationUnit', [['auto', 'Auto'], ['min', 'Minutes'], ['sec', 'Seconds']]),
      el('div', { class: 'field' },
        el('span', { class: 'field-label' }, 'Type for rows with no activity type'),
        typeSelect),
    ),
  ));
  sheet.setFooter([
    el('button', {
      class: 'btn btn-primary',
      onclick: () => {
        const built = buildRecords(parsed.records, mapping, opts);
        if (!built.workouts.length && !Object.keys(built.days).length) {
          toast('Nothing importable — did you map a date column?', 'error');
          return;
        }
        step2(sheet, built, onDone);
      },
    }, 'Preview'),
  ]);
}

function step2(sheet, built, onDone) {
  const { workouts, days, skipped } = built;

  // Skip anything already imported with the same date+type+duration, so
  // re-importing a fuller export doesn't double up your history.
  const existingKeys = new Set(store.workouts.map(signature));
  const fresh = workouts.filter((w) => !existingKeys.has(signature(w)));
  const dupes = workouts.length - fresh.length;

  const preview = fresh.slice(0, 8);
  const dayCount = Object.keys(days).length;

  sheet.setTitle('Ready to import', '');
  sheet.setBody(el('div', {},
    el('div', { class: 'stat-row', style: { marginBottom: '14px' } },
      el('div', { class: 'stat' }, el('div', { class: 'v' }, String(fresh.length)), el('div', { class: 'k' }, 'workouts')),
      el('div', { class: 'stat' }, el('div', { class: 'v' }, String(dayCount)), el('div', { class: 'k' }, 'day records')),
      dupes ? el('div', { class: 'stat' }, el('div', { class: 'v' }, String(dupes)), el('div', { class: 'k' }, 'duplicates')) : null,
      skipped.length ? el('div', { class: 'stat' }, el('div', { class: 'v' }, String(skipped.length)), el('div', { class: 'k' }, 'skipped')) : null,
    ),
    dupes ? el('p', { class: 'tiny muted' }, `${dupes} row${dupes === 1 ? '' : 's'} already in your history will be skipped.`) : null,
    preview.length ? el('div', { class: 'card-title' }, 'First few') : null,
    ...preview.map((w) => el('div', { class: 'wo' },
      el('div', { class: 'body' },
        el('div', { class: 'name' }, w.title || w.type),
        el('div', { class: 'meta' },
          el('span', {}, w.date),
          w.durationMin ? el('span', {}, `${Math.round(w.durationMin)} min`) : null,
          w.distanceKm ? el('span', {}, `${w.distanceKm.toFixed(1)} km`) : null,
        ),
      ),
    )),
    skipped.length
      ? el('p', { class: 'tiny muted', style: { marginTop: '12px' } },
        `Skipped rows had no readable date (first: row ${skipped[0].row}).`)
      : null,
  ));

  sheet.setFooter([
    el('button', { class: 'btn btn-ghost', onclick: () => sheet.close() }, 'Cancel'),
    el('button', {
      class: 'btn btn-primary',
      onclick: () => {
        for (const w of fresh) store.saveWorkout(w);
        for (const [date, patch] of Object.entries(days)) store.saveDay(date, patch);
        toast(`Imported ${fresh.length} workouts${dayCount ? ` and ${dayCount} days` : ''}`, 'success');
        sheet.close();
        onDone?.();
      },
    }, `Import ${fresh.length + dayCount} record${fresh.length + dayCount === 1 ? '' : 's'}`),
  ]);
}

function signature(w) {
  return [w.date, w.type, Math.round(w.durationMin || 0), Math.round((w.distanceKm || 0) * 100)].join('|');
}

/** Flat CSV of every workout, for spreadsheets or a different app later. */
export function exportWorkoutsCsv() {
  const header = ['date', 'time', 'type', 'title', 'duration_min', 'distance_km',
    'elevation_m', 'avg_hr', 'calories', 'rpe', 'source', 'notes'];
  const rows = store.workouts
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => [w.date, w.time || '', w.type, w.title, w.durationMin ?? '', w.distanceKm ?? '',
      w.elevationM ?? '', w.avgHr ?? '', w.calories ?? '', w.rpe ?? '', w.source, w.notes]);
  download(`workouts-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]), 'text/csv');
}

/** Flat CSV of daily metrics. */
export function exportDaysCsv() {
  const header = ['date', 'sleep_hours', 'sleep_quality', 'resting_hr', 'weight_kg',
    'body_fat_pct', 'steps', 'energy', 'soreness', 'notes'];
  const rows = Object.values(store.state.days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => [d.date, d.sleepHours ?? '', d.sleepQuality ?? '', d.restingHr ?? '', d.weightKg ?? '',
      d.bodyFatPct ?? '', d.steps ?? '', d.energy ?? '', d.soreness ?? '', d.notes || '']);
  download(`daily-metrics-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]), 'text/csv');
}
