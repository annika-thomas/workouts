import { el, clear } from '../util/dom.js';
import { iconEl } from './icons.js';

/**
 * Bottom sheet. Returns a handle so callers can swap the body in place
 * (e.g. day view -> workout editor -> back) without stacking scrims.
 */
export function openSheet({ title, subtitle, body, footer, onClose }) {
  const bodyWrap = el('div', { class: 'sheet-body' });
  const footWrap = el('div', { class: 'sheet-foot' });
  const titleEl = el('h2', {}, title || '');
  const subEl = el('div', { class: 'date-sub' }, subtitle || '');

  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    el('div', { class: 'sheet-grip' }),
    el('div', { class: 'sheet-head' },
      el('div', { style: { flex: '1', minWidth: '0' } }, titleEl, subtitle ? subEl : null),
      el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => handle.close() }, iconEl('x')),
    ),
    bodyWrap,
    footWrap,
  );

  const scrim = el('div', { class: 'scrim' }, sheet);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) handle.close(); });

  const onKey = (e) => { if (e.key === 'Escape') handle.close(); };
  document.addEventListener('keydown', onKey);

  const handle = {
    scrim,
    close() {
      document.removeEventListener('keydown', onKey);
      scrim.style.animation = 'fade .15s ease reverse';
      sheet.style.animation = 'slide-up .18s ease reverse';
      setTimeout(() => scrim.remove(), 150);
      onClose?.();
    },
    setTitle(t, s) {
      titleEl.textContent = t;
      if (s !== undefined) {
        subEl.textContent = s;
        if (!subEl.isConnected && s) titleEl.after(subEl);
      }
    },
    setBody(node) {
      clear(bodyWrap);
      bodyWrap.append(node);
      bodyWrap.scrollTop = 0;
    },
    setFooter(nodes) {
      clear(footWrap);
      const list = [nodes].flat().filter(Boolean);
      footWrap.hidden = list.length === 0;
      footWrap.append(...list);
    },
  };

  if (body) handle.setBody(body);
  handle.setFooter(footer);
  document.body.append(scrim);
  return handle;
}
