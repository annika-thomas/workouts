/**
 * Strava connector.
 *
 * Strava has no public browser-only auth flow, so this runs the standard
 * OAuth code exchange from the page itself using a client secret you paste in
 * Settings. That secret never leaves this device (localStorage, excluded from
 * exports) — which is fine for a personal app on your own phone, but it is
 * why you should not host this page somewhere other people sign into.
 *
 * If the token exchange is blocked by CORS on your network, everything still
 * works via Settings → Import, using Strava's bulk data export.
 */

import { store } from '../store.js';
import { mapSportType } from '../types.js';
import { toKey } from '../util/date.js';

const AUTH_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API = 'https://www.strava.com/api/v3';
const SCOPE = 'activity:read_all';

export function redirectUri() {
  return location.origin + location.pathname;
}

export function isConfigured() {
  const s = store.settings.strava;
  return Boolean(s.clientId && s.clientSecret);
}

export function isConnected() {
  const s = store.settings.strava;
  return Boolean(s.refreshToken || (s.accessToken && s.expiresAt > Date.now() / 1000));
}

/** Send the browser to Strava's consent screen. */
export function beginAuth() {
  const { clientId } = store.settings.strava;
  if (!clientId) throw new Error('Add your Strava Client ID first.');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  });
  location.href = `${AUTH_URL}?${params}`;
}

/**
 * Called on every page load. If we came back from Strava with ?code=, trade it
 * for tokens and clean the URL. Returns a short status string, or null.
 */
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return null;

  // Strip the query either way so a refresh doesn't replay a spent code.
  history.replaceState({}, '', redirectUri());

  if (error) return { ok: false, message: `Strava authorisation was ${error}.` };

  const granted = params.get('scope') || '';
  if (!granted.includes('activity:read')) {
    return { ok: false, message: 'Strava needs the "view activities" permission to sync.' };
  }

  const { clientId, clientSecret } = store.settings.strava;
  if (!clientId || !clientSecret) return { ok: false, message: 'Strava keys are missing on this device.' };

  try {
    const data = await postToken({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    });
    saveTokens(data);
    return { ok: true, message: `Connected to Strava as ${data.athlete?.firstname || 'you'}.` };
  } catch (err) {
    return { ok: false, message: describeError(err) };
  }
}

async function postToken(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strava returned ${res.status}. ${text.slice(0, 160)}`);
  }
  return res.json();
}

function saveTokens(data) {
  store.updateSettings({
    strava: {
      accessToken: data.access_token || '',
      refreshToken: data.refresh_token || store.settings.strava.refreshToken,
      expiresAt: data.expires_at || 0,
      athlete: data.athlete
        ? { id: data.athlete.id, name: [data.athlete.firstname, data.athlete.lastname].filter(Boolean).join(' ') }
        : store.settings.strava.athlete,
    },
  });
}

/** Returns a valid access token, refreshing it if it's within 5 minutes of expiry. */
async function getAccessToken() {
  const s = store.settings.strava;
  const now = Math.floor(Date.now() / 1000);
  if (s.accessToken && s.expiresAt - 300 > now) return s.accessToken;
  if (!s.refreshToken) throw new Error('Not connected to Strava yet.');
  if (!s.clientId || !s.clientSecret) throw new Error('Strava keys are missing on this device.');

  const data = await postToken({
    client_id: s.clientId,
    client_secret: s.clientSecret,
    refresh_token: s.refreshToken,
    grant_type: 'refresh_token',
  });
  saveTokens(data);
  return data.access_token;
}

/**
 * Pull activities newer than the last sync (or `sinceDays` back on first run)
 * and merge them into the store. Returns { added, updated, total }.
 */
export async function sync({ sinceDays = 365, onProgress } = {}) {
  const token = await getAccessToken();
  const last = store.settings.strava.lastSync;
  const after = last
    ? Math.floor(new Date(last).getTime() / 1000) - 86400   // one day of overlap
    : Math.floor((Date.now() - sinceDays * 86400000) / 1000);

  let page = 1;
  let added = 0, updated = 0, total = 0;

  while (page <= 20) {
    onProgress?.(`Fetching page ${page}…`);
    const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) throw new Error('Strava rate limit reached — try again in 15 minutes.');
    if (!res.ok) throw new Error(`Strava returned ${res.status} fetching activities.`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const activity of batch) {
      const result = upsertActivity(activity);
      if (result === 'added') added++;
      else if (result === 'updated') updated++;
      total++;
    }
    if (batch.length < 100) break;
    page++;
  }

  store.updateSettings({ strava: { lastSync: new Date().toISOString() } });
  return { added, updated, total };
}

/** Map one Strava activity onto a workout, preserving any notes you added here. */
export function upsertActivity(a) {
  const startLocal = a.start_date_local || a.start_date;
  const date = startLocal ? startLocal.slice(0, 10) : toKey(new Date());
  const time = startLocal ? startLocal.slice(11, 16) : null;

  const existing = store.findByExternalId('strava', a.id);
  const record = {
    id: existing?.id || null,
    date,
    time,
    type: mapSportType(a.sport_type || a.type),
    title: a.name || '',
    durationMin: a.moving_time ? Math.round(a.moving_time / 60) : null,
    distanceKm: a.distance ? a.distance / 1000 : null,
    elevationM: a.total_elevation_gain ?? null,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    calories: a.calories ?? existing?.calories ?? null,
    rpe: existing?.rpe ?? (a.perceived_exertion ?? null),
    notes: existing?.notes || '',   // your own notes win over Strava's blank
    source: 'strava',
    externalId: String(a.id),
  };

  if (existing && sameActivity(existing, record)) return 'unchanged';
  store.saveWorkout(record);
  return existing ? 'updated' : 'added';
}

function sameActivity(a, b) {
  return a.date === b.date && a.time === b.time && a.type === b.type && a.title === b.title
    && a.durationMin === b.durationMin && a.distanceKm === b.distanceKm;
}

/** Manual escape hatch: paste tokens obtained outside the browser. */
export function setTokensManually({ accessToken, refreshToken, expiresAt }) {
  store.updateSettings({
    strava: {
      accessToken: accessToken || '',
      refreshToken: refreshToken || '',
      expiresAt: expiresAt || Math.floor(Date.now() / 1000) + 21600,
    },
  });
}

export function disconnect() {
  store.updateSettings({
    strava: { accessToken: '', refreshToken: '', expiresAt: 0, athlete: null, lastSync: null },
  });
}

function describeError(err) {
  const msg = String(err?.message || err);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return 'Could not reach Strava from the browser (likely CORS or offline). Use Settings → Import with a Strava bulk export instead.';
  }
  return msg;
}

export { describeError as describeStravaError };
