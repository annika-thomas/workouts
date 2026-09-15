/** Tiny DOM helpers — enough structure to avoid innerHTML string soup. */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') applyStyle(node, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  append(node, children);
  return node;
}

/**
 * Object.assign skips CSS custom properties (`--fill`), so set those through
 * setProperty and let the rest go through the normal style object.
 */
function applyStyle(node, styles) {
  for (const [prop, value] of Object.entries(styles)) {
    if (value === null || value === undefined) continue;
    if (prop.startsWith('--')) node.style.setProperty(prop, value);
    else node.style[prop] = value;
  }
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* not supported, no matter */ }
}

let toastTimer;
export function toast(message, kind = 'info') {
  let host = document.querySelector('.toast');
  if (!host) {
    host = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  host.textContent = message;
  host.dataset.kind = kind;
  host.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove('is-visible'), 2600);
}

/** Promise-based confirm so destructive actions read linearly at the call site. */
export function confirmDialog({ title, body, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dialog = el('div', { class: 'scrim' });
    const close = (result) => { dialog.remove(); resolve(result); };
    dialog.append(el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
      el('h3', {}, title),
      body ? el('p', {}, body) : null,
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-ghost', onclick: () => close(false) }, 'Cancel'),
        el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) }, confirmText),
      ),
    ));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(false); });
    document.body.append(dialog);
  });
}

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept = '.json') {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}
