/**
 * Picking readable ink for a coloured fill.
 *
 * The palette now runs from deep forest green to rust, so a single charcoal
 * face no longer works everywhere — the dark end needs cream. Rather than
 * hand-maintaining a colour for every fill, derive it from luminance.
 */

const INK_DARK = '#242C1A';
const INK_LIGHT = '#F6F3E4';

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

function contrast(a, b) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Whichever of the two inks reads better on this fill. A fixed luminance
 * threshold gets mid-tones like tan and sage wrong; comparing actual contrast
 * ratios doesn't.
 */
export function inkFor(hex) {
  const l = luminance(hex);
  return contrast(l, luminance(INK_LIGHT)) > contrast(l, luminance(INK_DARK))
    ? INK_LIGHT : INK_DARK;
}

/**
 * The palette is deliberately light enough that dark ink reads on every fill,
 * against both the cream and the dark ground — so nothing needs swapping per
 * theme. inkFor stays as the guardrail for any colour added later.
 */
export function resolveFill(hex) {
  return { fill: hex, ink: inkFor(hex) };
}
