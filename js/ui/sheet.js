import { el, clear } from '../util/dom.js';
import { iconEl } from './icons.js';

/**
 * Pin a sheet to the *visible* viewport rather than the layout one.
 *
 * On iOS an on-screen keyboard shrinks the visual viewport but leaves the
 * layout viewport alone, so a `position: fixed` sheet stays anchored to the
 * bottom of the screen — underneath the keyboard. visualViewport gives us the
 * area actually on screen; following it keeps the sheet where you can see it.
 */
function trackViewport(scrim) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const apply = () => {
    scrim.style.top = `${vv.offsetTop}px`;
    scrim.style.height = `${vv.height}px`;
    scrim.style.bottom = 'auto';
  };
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
  };
}

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

  const untrack = trackViewport(scrim);

  // With the sheet now bounded by the visible area, keep whatever you're
  // typing in above the keyboard as it opens.
  bodyWrap.addEventListener('focusin', (e) => {
    setTimeout(() => e.target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 250);
  });

  const handle = {
    scrim,
    close() {
      document.removeEventListener('keydown', onKey);
      untrack();
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
