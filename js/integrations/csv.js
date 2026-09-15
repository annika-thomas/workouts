/** RFC-4180-ish CSV parser: handles quotes, embedded commas/newlines, BOM, CRLF. */
export function parseCsv(text, delimiter = null) {
  let src = text.replace(/^﻿/, '');
  const delim = delimiter || sniffDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function sniffDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c in counts) counts[c]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';
}

/** Rows -> array of objects keyed by header, with blank headers dropped. */
export function toObjects(rows) {
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = (r[i] ?? '').trim(); });
    return o;
  });
  return { headers: headers.filter(Boolean), records };
}

export function toCsv(rows) {
  return rows.map((r) => r.map((cell) => {
    const s = cell == null ? '' : String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
