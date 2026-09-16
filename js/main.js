import { el, clear, toast, haptic } from './util/dom.js';
import { iconEl } from './ui/icons.js';
import { faceEl } from './ui/face.js';
import { store } from './store.js';
import { applyTheme, watchSystemTheme } from './theme.js';
import { calendarView } from './ui/calendar.js';
import { statsView } from './ui/stats.js';
import { settingsView } from './ui/settings.js';
import { musclesView } from './ui/muscles.js';
import { openLogChooser } from './ui/chooser.js';
import * as strava from './integrations/strava.js';

const TABS = [
  { key: 'calendar', label: 'Calendar', icon: 'calendar', render: calendarView },
  { key: 'stats',    label: 'Stats',    icon: 'chart',    render: statsView },
  { key: 'muscles',  label: 'Muscles',  icon: 'muscle',   render: musclesView },
  { key: 'settings', label: 'Settings', icon: 'settings', render: settingsView },
];

const ctx = {};            // per-tab view state that survives tab switches
let current = 'calendar';
let rerenderCurrent = null;

function boot() {
  store.load();
  applyTheme(store.settings.theme);
  watchSystemTheme(() => store.settings.theme, () => rerenderCurrent?.());

  const app = el('div', { id: 'app' });
  const bar = el('header', { class: 'appbar' },
    el('div', { class: 'brand' },
      el('span', { class: 'bubble' }, faceEl('content')),
      el('h1', {}, 'Workouts'),
    ),
    el('div', { class: 'sub' }, todayLabel()),
  );
  const main = el('main', { class: 'view' });
  app.append(bar, main);

  // Two tabs, the log button, then the rest — the notch keeps the button clear.
  const tabButton = (t) => el('button', {
    class: 'tab',
    role: 'tab',
    'data-tab': t.key,
    'aria-current': t.key === current ? 'page' : null,
    onclick: () => { haptic(5); show(t.key); },
  }, iconEl(t.icon), t.label);

  const tabbar = el('nav', { class: 'tabbar', role: 'tablist' },
    tabButton(TABS[0]),
    tabButton(TABS[1]),
    el('span', { class: 'notch', 'aria-hidden': 'true' }),
    tabButton(TABS[2]),
    tabButton(TABS[3]),
  );

  const fab = el('button', {
    class: 'logbtn',
    'aria-label': 'Log a workout',
    onclick: () => {
      haptic(10);
      openLogChooser(() => rerenderCurrent?.());
    },
  }, faceEl('happy'), el('span', { class: 'plus' }, iconEl('plus')));

  document.body.append(app, tabbar, fab);

  function show(key) {
    current = key;
    const tab = TABS.find((t) => t.key === key) || TABS[0];
    bar.querySelector('.brand h1').textContent = tab.key === 'calendar' ? 'Workouts' : tab.label;
    bar.querySelector('.sub').textContent = tab.key === 'calendar' ? todayLabel() : '';
    for (const b of tabbar.querySelectorAll('button')) {
      if (b.dataset.tab === key) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    clear(main);
    rerenderCurrent = tab.render(main, ctx);
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  // Any change to the data re-renders the visible tab.
  store.addEventListener('change', (e) => {
    if (e.detail?.kind === 'settings' && current !== 'settings') return;
    rerenderCurrent?.();
  });
  store.addEventListener('error', (e) => toast(e.detail.message, 'error'));

  show(current);

  // Coming back from Strava's consent screen.
  strava.handleRedirect().then((result) => {
    if (!result) return;
    toast(result.message, result.ok ? 'success' : 'error');
    if (result.ok) {
      strava.sync()
        .then((r) => { toast(`Synced ${r.added} workouts from Strava`, 'success'); rerenderCurrent?.(); })
        .catch((err) => toast(strava.describeStravaError(err), 'error'));
    }
  });

  // Handy for debugging from the console, and for the test harness.
  window.__store = store;

  registerServiceWorker();
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: './' })
      .catch((err) => console.warn('Offline mode unavailable', err));
  });
}

boot();
