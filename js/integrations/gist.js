/**
 * Optional backup/sync through a secret GitHub Gist.
 *
 * This is how the same data reaches your phone and your laptop without any
 * server: the whole database is one JSON file in a gist only you can see.
 * Needs a fine-grained or classic token with the `gist` scope, stored on this
 * device only (and stripped out of file exports).
 */

import { store } from '../store.js';

const FILENAME = 'workouts.json';
const API = 'https://api.github.com';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function call(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers: headers(token) });
  if (res.status === 401) throw new Error('GitHub rejected that token. Check it has the "gist" scope.');
  if (res.status === 404) throw new Error('Gist not found — check the ID, or create a new one.');
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  return res.json();
}

/** Create the secret gist that will hold the data. Returns its id. */
export async function createGist(token) {
  const data = await call('/gists', token, {
    method: 'POST',
    body: JSON.stringify({
      description: 'Workout tracker data (private)',
      public: false,
      files: { [FILENAME]: { content: JSON.stringify(store.exportData(), null, 2) } },
    }),
  });
  store.updateSettings({ sync: { gistId: data.id, lastPush: new Date().toISOString() } });
  return data.id;
}

/** Overwrite the gist with what's on this device. */
export async function push() {
  const { gistId, token } = store.settings.sync;
  if (!token) throw new Error('Add a GitHub token in Settings first.');
  if (!gistId) return createGist(token);

  await call(`/gists/${gistId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      files: { [FILENAME]: { content: JSON.stringify(store.exportData(), null, 2) } },
    }),
  });
  store.updateSettings({ sync: { lastPush: new Date().toISOString() } });
  return gistId;
}

/** Merge the gist's contents into this device (newest edit per record wins). */
export async function pull() {
  const { gistId, token } = store.settings.sync;
  if (!token || !gistId) throw new Error('Add a GitHub token and gist ID in Settings first.');

  const data = await call(`/gists/${gistId}`, token);
  const file = data.files?.[FILENAME];
  if (!file) throw new Error(`That gist has no ${FILENAME}.`);

  // Large gists come back truncated with a raw_url to fetch instead.
  const content = file.truncated
    ? await fetch(file.raw_url).then((r) => r.text())
    : file.content;

  const result = store.importData(JSON.parse(content));
  store.updateSettings({ sync: { lastPull: new Date().toISOString() } });
  return result;
}
