import { fromKey, monthShort } from '../util/date.js';

/**
 * A small line chart. Rendered at a nominal 320-wide viewBox and scaled to
 * the card, so strokes stay even without a layout pass.
 */
export function lineChart(points, { format = (v) => String(v), color = 'var(--accent)' } = {}) {
  const W = 320, H = 130, padL = 34, padR = 8, padT = 12, padB = 20;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'linechart');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;

  const x = (i) => padL + (points.length === 1 ? (W - padL - padR) / 2
    : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const add = (tag, attrs, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    svg.append(n);
    return n;
  };

  // Gridlines and value labels at the top and bottom of the plotted band.
  for (const v of [max - span * 0.12, min + span * 0.12]) {
    add('line', { class: 'gl', x1: padL, x2: W - padR, y1: y(v), y2: y(v) });
    add('text', { x: 2, y: y(v) + 3.5 }, format(v));
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  if (points.length > 1) {
    add('path', { class: 'ar', d: `${d} L${x(points.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z` });
    add('path', { class: 'ln', d, style: `stroke:${color}` });
  }
  // Dots only while they stay legible.
  if (points.length <= 40) {
    for (const [i, p] of points.entries()) {
      add('circle', { class: 'pt', cx: x(i), cy: y(p.value), r: points.length > 20 ? 1.8 : 2.6, style: `fill:${color}` });
    }
  }

  add('text', { x: padL, y: H - 5 }, shortDate(points[0].date));
  if (points.length > 1) {
    add('text', { x: W - padR, y: H - 5, 'text-anchor': 'end' }, shortDate(points.at(-1).date));
  }
  return svg;
}

function shortDate(key) {
  const d = fromKey(key);
  return `${monthShort(d.getMonth())} ${d.getDate()}`;
}
