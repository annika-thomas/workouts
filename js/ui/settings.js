import { el, clear, toast, download, pickFile, confirmDialog } from '../util/dom.js';
import { openSheet } from './sheet.js';
import { store } from '../store.js';
import { applyTheme } from '../theme.js';
import { openImportSheet, exportWorkoutsCsv, exportDaysCsv } from './importSheet.js';
import { routinesCard } from './routines.js';
import * as strava from '../integrations/strava.js';
import * as gist from '../integrations/gist.js';

export function settingsView(root) {
  function render() {
    clear(root);
    const s = store.settings;

    // ---- preferences ----------------------------------------------------
    const prefs = el('div', { class: 'card' }, el('div', { class: 'card-title' }, 'Preferences'));

    prefs.append(rowWith('Units', 'Distances and body weight',
      select([['metric', 'km / kg'], ['imperial', 'mi / lb']], s.units, (v) => {
        store.updateSettings({ units: v });
        toast(`Showing ${v === 'metric' ? 'km and kg' : 'miles and pounds'}`);
      })));

    prefs.append(rowWith('Week starts on', 'Affects the calendar and weekly totals',
      select([['1', 'Monday'], ['0', 'Sunday']], String(s.weekStart), (v) => {
        store.updateSettings({ weekStart: Number(v) });
      })));

    prefs.append(rowWith('Weekly goal', 'Sessions per week you are aiming for',
      el('input', {
        type: 'number', min: '0', max: '21', inputmode: 'numeric', value: s.weeklyGoal,
        onchange: (e) => store.updateSettings({ weeklyGoal: Number(e.target.value) || 0 }),
      })));

    prefs.append(rowWith('Theme', 'Follows your phone by default',
      select([['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']], s.theme, (v) => {
        store.updateSettings({ theme: v });
        applyTheme(v);
        render();
      })));

    root.append(prefs);

    // ---- routines -------------------------------------------------------
    root.append(routinesCard(render));

    // ---- Strava ---------------------------------------------------------
    root.append(stravaCard(render));

    // ---- import / export ------------------------------------------------
    const data = el('div', { class: 'card' }, el('div', { class: 'card-title' }, 'Your data'));
    data.append(el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, 'Import a CSV'),
        el('div', { class: 'row-sub' }, 'Strava bulk export, a smart scale, a sleep tracker — anything with a date column.'),
      ),
    ));
    data.append(el('div', { class: 'btn-row', style: { marginBottom: '12px' } },
      el('button', {
        class: 'btn btn-sm',
        onclick: async () => {
          const file = await pickFile('.csv,.txt,text/csv');
          if (file) openImportSheet(file, render);
        },
      }, 'Choose CSV…'),
    ));

    data.append(el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, 'Backup'),
        el('div', { class: 'row-sub' }, summariseData()),
      ),
    ));
    data.append(el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn btn-sm',
        onclick: () => {
          download(`workouts-backup-${new Date().toISOString().slice(0, 10)}.json`,
            JSON.stringify(store.exportData(), null, 2));
          toast('Backup downloaded');
        },
      }, 'Backup JSON'),
      el('button', {
        class: 'btn btn-sm',
        onclick: async () => {
          const file = await pickFile('.json,application/json');
          if (!file) return;
          try {
            const text = await file.text();
            const result = store.importData(JSON.parse(text));
            toast(`Restored ${result.added + result.updated} workouts`, 'success');
            render();
          } catch (err) {
            toast(`Could not restore: ${err.message}`, 'error');
          }
        },
      }, 'Restore'),
      el('button', { class: 'btn btn-sm', onclick: exportWorkoutsCsv }, 'Workouts CSV'),
      el('button', { class: 'btn btn-sm', onclick: exportDaysCsv }, 'Days CSV'),
    ));
    root.append(data);

    // ---- sync -----------------------------------------------------------
    root.append(syncCard(render));

    // ---- danger ---------------------------------------------------------
    const danger = el('div', { class: 'card' },
      el('div', { class: 'card-title' }, 'Danger zone'),
      el('button', {
        class: 'btn btn-ghost btn-block btn-sm',
        onclick: async () => {
          const ok = await confirmDialog({
            title: 'Delete all workouts and notes?',
            body: 'Your preferences and connections stay. Everything else is gone unless you have a backup.',
            confirmText: 'Delete everything',
            danger: true,
          });
          if (!ok) return;
          store.clearAll();
          toast('All entries deleted');
          render();
        },
      }, 'Erase all entries'),
    );
    root.append(danger);

    root.append(el('p', { class: 'tiny muted', style: { textAlign: 'center', marginTop: '18px' } },
      'Everything lives on this device unless you turn on gist sync. ',
      el('br'),
      'Add to your home screen to use it like an app.'));
  }

  render();
  return render;
}

// ---------------------------------------------------------------------------

function rowWith(title, sub, control) {
  return el('div', { class: 'row' },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title' }, title),
      sub ? el('div', { class: 'row-sub' }, sub) : null,
    ),
    control,
  );
}

function select(options, value, onChange) {
  const sel = el('select', { onchange: (e) => onChange(e.target.value) },
    ...options.map(([v, label]) => el('option', { value: v }, label)));
  sel.value = value;
  return sel;
}

function summariseData() {
  const w = store.workouts.length;
  const d = Object.keys(store.state.days).length;
  if (!w && !d) return 'Nothing logged yet';
  return `${w} workout${w === 1 ? '' : 's'}, ${d} day note${d === 1 ? '' : 's'}`;
}

function stravaCard(rerender) {
  const s = store.settings.strava;
  const connected = strava.isConnected();
  const card = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Strava'),
    el('div', { class: 'row' },
      el('span', { class: `status-dot ${connected ? 'on' : ''}` }),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, connected ? (s.athlete?.name || 'Connected') : 'Not connected'),
        el('div', { class: 'row-sub' },
          connected
            ? (s.lastSync ? `Last synced ${timeAgo(s.lastSync)}` : 'Never synced')
            : 'Pull your runs and rides in automatically'),
      ),
    ),
  );

  if (connected) {
    const syncBtn = el('button', { class: 'btn btn-primary btn-sm' }, 'Sync now');
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Syncing…';
      try {
        const r = await strava.sync({ onProgress: (m) => { syncBtn.textContent = m; } });
        toast(r.added || r.updated
          ? `${r.added} new, ${r.updated} updated`
          : 'Already up to date', 'success');
        rerender();
      } catch (err) {
        toast(strava.describeStravaError(err), 'error');
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync now';
      }
    });
    card.append(el('div', { class: 'btn-row' },
      syncBtn,
      el('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: async () => {
          const ok = await confirmDialog({ title: 'Disconnect Strava?', body: 'Already-synced workouts stay put.', confirmText: 'Disconnect' });
          if (!ok) return;
          strava.disconnect();
          rerender();
        },
      }, 'Disconnect'),
    ));
  } else {
    card.append(el('button', {
      class: 'btn btn-block btn-sm',
      onclick: () => openStravaSetup(rerender),
    }, strava.isConfigured() ? 'Connect to Strava' : 'Set up Strava…'));
  }

  return card;
}

function openStravaSetup(rerender) {
  const s = store.settings.strava;
  const idInput = el('input', { type: 'text', inputmode: 'numeric', placeholder: '123456', value: s.clientId });
  const secretInput = el('input', { type: 'password', placeholder: 'Your client secret', value: s.clientSecret, autocomplete: 'off' });

  const sheet = openSheet({
    title: 'Connect Strava',
    subtitle: 'One-time setup',
    body: el('div', {},
      el('ol', { class: 'tiny muted', style: { paddingLeft: '18px', lineHeight: '1.7' } },
        el('li', {}, 'Open ', el('a', { href: 'https://www.strava.com/settings/api', target: '_blank', rel: 'noopener' }, 'strava.com/settings/api'), ' and create an app (any name).'),
        el('li', {}, 'Set ', el('b', {}, 'Authorization Callback Domain'), ' to exactly: ', el('code', {}, location.hostname)),
        el('li', {}, 'Copy the Client ID and Client Secret below.'),
      ),
      el('div', { class: 'field', style: { marginTop: '14px' } }, el('label', {}, 'Client ID'), idInput),
      el('div', { class: 'field' }, el('label', {}, 'Client Secret'), secretInput),
      el('p', { class: 'tiny muted' },
        'These stay in this browser only and are stripped out of backups. If your browser blocks the connection, ',
        'use Import with a Strava bulk export instead — Settings → Your data.'),
    ),
    footer: [
      el('button', {
        class: 'btn btn-primary',
        onclick: () => {
          const clientId = idInput.value.trim();
          const clientSecret = secretInput.value.trim();
          if (!clientId || !clientSecret) { toast('Both fields are needed', 'error'); return; }
          store.updateSettings({ strava: { clientId, clientSecret } });
          rerender();
          try { strava.beginAuth(); } catch (err) { toast(err.message, 'error'); }
        },
      }, 'Save & authorise'),
    ],
  });
  return sheet;
}

function syncCard(rerender) {
  const s = store.settings.sync;
  const card = el('div', { class: 'card' },
    el('div', { class: 'card-title' }, 'Sync across devices (optional)'),
    el('div', { class: 'row' },
      el('span', { class: `status-dot ${s.gistId && s.token ? 'on' : ''}` }),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, s.gistId && s.token ? 'Secret gist connected' : 'Not set up'),
        el('div', { class: 'row-sub' },
          s.lastPush ? `Last saved ${timeAgo(s.lastPush)}` : 'Keeps a private copy in a GitHub gist'),
      ),
    ),
  );

  const tokenInput = el('input', { type: 'password', placeholder: 'ghp_… (gist scope)', value: s.token, autocomplete: 'off' });
  const gistInput = el('input', { type: 'text', placeholder: 'Gist ID (blank = create one)', value: s.gistId });

  card.append(
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'GitHub token'), tokenInput),
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Gist ID'), gistInput),
    el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn btn-sm',
        onclick: () => {
          store.updateSettings({ sync: { token: tokenInput.value.trim(), gistId: gistInput.value.trim() } });
          toast('Saved on this device');
          rerender();
        },
      }, 'Save keys'),
      el('button', {
        class: 'btn btn-sm btn-primary',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            const id = await gist.push();
            toast('Backed up to your gist', 'success');
            store.updateSettings({ sync: { gistId: id } });
            rerender();
          } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
        },
      }, 'Back up now'),
      el('button', {
        class: 'btn btn-sm',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            const r = await gist.pull();
            toast(`Pulled ${r.added} new, ${r.updated} updated`, 'success');
            rerender();
          } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
        },
      }, 'Restore from gist'),
    ),
    el('p', { class: 'tiny muted', style: { marginTop: '10px' } },
      'Create a token at github.com/settings/tokens with only the ', el('b', {}, 'gist'), ' scope. ',
      'Put the same token and gist ID on your other devices to keep them in step.'),
  );

  return card;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
