# Workouts

A personal workout calendar that runs in the browser. Open it on your phone,
tap a day, log what you did. Nothing to install, no account, no server — your
data lives on your device.

![The month view, a day sheet, and the stats tab](assets/screenshot.png)

## What it does

**Calendar** — every day is a face, on a spectrum from green through sage,
wheat and tan to terracotta. The score behind it is a weighted blend of three things you control:
whether you moved (40%), how you ate (35%), and how little you drank (25%).

Two pieces of fairness sit on top, because a flat average would lie:

- **A rest day isn't a failure if you earned it.** Train hard yesterday — or
  wake up sore — and today's movement still counts. The credit fades: the day
  after a hard session is fully earned, the one after that half, and a third
  straight day off is back on you.
- **Weekend drinks are judged more gently.** The same three drinks cost you
  noticeably less on a Friday or Saturday than on a Tuesday.

Only what you logged counts — the weights re-normalise over what's there, so a
day isn't punished for the blanks. Days scored from just one of the three show
faded, and days with nothing at all stay empty circles. Tap any day for the
breakdown: which component scored what, and why (*earned rest*, *3, weekend*).

Swipe left and right between months.

**Two things to log.** The centre button asks which: a **workout**, or a
**daily check-in** — weight, how you ate, drinks, sleep. The check-in is
tap-first, so a daily weigh-in is two taps from opening the app, and the
Calendar carries a "How was today?" card that becomes a summary once you've
filled it in.

**Five lenses on the month.** Past the **Day** score, the same grid re-reads by
**Moved** (coloured by activity), **Food**, **Drinks** or **Sleep**. The glyph
is whatever is fastest to read: a face, a food icon, a drinks count, hours
slept. Flip to Drinks and a month's pattern is just *there*.

**Logging a workout** — type, title, duration,
distance, elevation, average HR, calories and effort (RPE 1–10), plus free
notes. Distance and elevation only appear for activities where they make
sense, and pace is shown the way each sport reads it: `/km` for runs, `km/h`
for rides, `/100m` for swims.

**Lifting gets its own interface.** Pick **Lift** and the editor grows an
exercise list: search 89 built-in movements (or add your own), then type reps
and weight per set. Tap **BW** on a set for bodyweight — it's on by default for
pull-ups and the like, and the weight box becomes added load, so
`8 @ BW +10 kg` reads as it should. Each exercise also takes a **+ More / −
Less** note for next time, which surfaces as a hint the next session you do it. Adding an exercise prefills the sets you did last time, and
"+ Add set" copies the row above — a repeat session is a handful of taps. Each
exercise summarises as you go (`3 × 8 @ 60 kg`) and the workout totals its sets
and load.

**Routines for the ones you rotate.** Built a session you'll do again? Tap
**Save as a routine** and name it. It then sits in the log chooser — tap
*Lower body A* and the editor opens with the whole exercise list in place.
Applying a routine fills each exercise from the *last time you did it*, not
from whatever the routine was saved with, so your weights carry forward
instead of resetting. Saving under a name you already have updates that
routine; **Settings → Routines** lists and deletes them.

**Progress by muscle group.** The **Muscles** tab takes a muscle — glutes, say —
and shows sets per week, load per session, and every exercise hitting it, ranked
by how much it actually contributes. Tap an exercise for its own progression:
top set over time, best set, and every session you've logged. Each exercise
names the muscles it works with the *primary* one first; sets and load count
fully toward that one and half toward the rest, so accessory work registers
without drowning out the lift that earned it. Exercises that only assist the
muscle you're viewing are marked.

**How the day felt** — sleep hours and quality, resting HR, weight, steps, how
you ate (five steps, indulgent to clean), standard drinks, energy, soreness and
notes. These are what turn "did I train?" into "why did that week feel
awful?".

**Stats** — sessions, active days, total time and distance over 30/90/365 days
or all time; current and longest streak; sessions per week against a goal you
set; a breakdown by activity; a six-month consistency grid; a weight chart with
the change across the range; drinks totals, per-week rate, alcohol-free days and
days since your last one; how you ate as a distribution; and sleep and
resting-HR averages.

## Get it on your phone

**One time**, switch Pages on: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. This step has to be done by hand — creating a Pages
site needs repo-admin rights that a workflow's token isn't allowed to have, so
the deploy fails with *"Get Pages site failed"* until you do it.

Then **Actions → Deploy to GitHub Pages → Run workflow**. After that every push
to the default branch deploys on its own; the workflow reads whichever branch
that is, so renaming it to `main` later changes nothing.

The site lands at `https://annika-thomas.github.io/workouts/`.

*Source: Deploy from a branch* (branch, folder `/`) works just as well — there's
no build step, the repo root is the site.

### Add it to your home screen

- **iPhone** — open the URL in **Safari** (this doesn't work from Chrome), tap
  Share, then **Add to Home Screen**.
- **Android** — open it in Chrome, tap ⋮, then **Install app**.

It gets its own icon, opens full-screen with no browser chrome, and works
offline.

Updates apply on the next launch: when a new version's worker takes over, the
app reloads itself once. If a sheet is open it holds off and says so rather
than discarding what you were typing.

> On iOS the installed app gets a **separate storage box from Safari**. Anything
> you logged in Safari beforehand won't appear in it. Either start logging after
> you've installed it, or move your entries across with Settings → Backup JSON
> and then Restore inside the installed app.

It then opens full-screen with its own icon, works offline, and keeps its data
between launches.

### Running it locally

No build, no dependencies — but it does need to be *served*, not opened as a
`file://` URL, because it uses ES modules:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Where your data lives

Everything is in `localStorage` under a single key, on the device you used.
That means it is private by default and works offline — and also that clearing
your browser data deletes it. So:

- **Settings → Your data → Backup JSON** downloads the whole database.
  Worth doing now and then.
- **Restore** merges a backup back in. Conflicts resolve by "last edited
  wins", so restoring an older file never overwrites newer entries.
- **Workouts CSV / Days CSV** export flat tables for a spreadsheet.

Tokens and secrets are stripped out of every export, so a backup file is safe
to email yourself.

### Syncing phone and laptop

Optional, in **Settings → Sync across devices**. It keeps a copy of the
database in a *secret* GitHub gist:

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens)
   with only the **gist** scope.
2. Paste it in, leave Gist ID blank, tap **Back up now** — it creates the gist
   and fills in the ID.
3. On your other device, paste the same token *and* gist ID, then
   **Restore from gist**.

It is manual on purpose: you press back up, you press restore. Nothing syncs
behind your back.

## Connecting Strava

**Settings → Strava → Set up Strava.** One-time setup:

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) and
   create an application (any name will do).
2. Set **Authorization Callback Domain** to your Pages host exactly —
   `yourusername.github.io`, no `https://`, no path.
3. Copy the **Client ID** and **Client Secret** into the app and tap
   *Save & authorise*.

After that, **Sync now** pulls in new activities: type, name, time, distance,
elevation, moving time and average HR. Activities are matched on their Strava
ID, so re-syncing updates rather than duplicates, and any notes or RPE you
added here are kept.

A caveat worth knowing: Strava has no browser-only auth flow, so the client
secret is stored in this browser's localStorage and the token exchange happens
from the page. For a personal tracker on your own phone that is a reasonable
trade; it is why you should not host this page somewhere other people sign in.
If your browser or network blocks the exchange, the app says so and the import
route below works just as well.

## Importing from anything else

**Settings → Your data → Choose CSV.** The importer reads the file, guesses
which column is which, and shows you the mapping to correct before anything is
saved. Then it previews what it will add — including how many rows it will skip
as duplicates — and only writes when you confirm.

It handles dates in ISO, `D/M/YYYY` and `Sep 12, 2026, 7:04:12` forms;
durations as minutes, seconds, `1:23:45` or `1h 23m`; and distance in km,
miles or metres (you pick). So it works with:

- **Strava** — request your archive at *Settings → My Account → Download or
  Delete Your Account → Request your archive*, then import `activities.csv`.
- **Smart scales (Renpho and similar)** — export from the app, import the
  weight and body-fat columns into your daily metrics.
- **Sleep and recovery trackers** (Oura, Whoop, AutoSleep, Garmin) — map the
  sleep-duration and resting-HR columns.
- Anything else with a date column, including your own spreadsheet.

Workout rows and daily-metric rows can come from the same file; each column is
mapped independently.

## Layout

```
index.html              markup shell — loads one ES module
manifest.webmanifest    PWA manifest (home-screen name, icons, colours)
sw.js                   service worker: offline cache of the app shell
css/app.css             all styling; design tokens at the top
assets/fonts/           Figtree, self-hosted so type works offline too
js/
  main.js               boot, tab routing, the floating add button
  store.js              the data model, persistence, and derived stats
  types.js              activity taxonomy (colours, icons, Strava mapping)
  theme.js              dark/light/auto
  util/date.js          local-day keys, month grids, loose date parsing
  util/units.js         metric/imperial display, pace, speed, durations
  util/dom.js           element helper, toasts, dialogs, file pick/download
  metrics.js            food and drink scales, colour ramps, calendar lenses
  score.js              the day score: weights, rest credit, weekend slack
  exercises.js          muscle groups, the exercise library, set/volume maths
  ui/calendar.js        month grid, lens switcher, streaks, recent list
  ui/checkin.js         the daily check-in sheet
  ui/chooser.js         what the centre button offers
  ui/lift.js            exercise list and set entry inside the editor
  ui/routines.js        saving, reusing and managing saved workouts
  ui/exercisePicker.js  searchable exercise list, plus custom ones
  ui/muscles.js         the Muscles tab and per-exercise progression
  ui/chart.js           the shared line chart
  ui/day.js             day sheet: workouts + how the day felt
  ui/editor.js          add/edit one workout
  ui/stats.js           ranges, weekly chart, breakdowns, consistency grid
  ui/settings.js        preferences, Strava, import/export, sync
  ui/importSheet.js     CSV column mapping and preview
  ui/sheet.js           bottom-sheet component
  ui/icons.js           inline SVG icons
  ui/face.js            the calendar faces and which one a day gets
  integrations/
    csv.js              CSV parse/serialise
    importer.js         column guessing, unit handling, record building
    strava.js           OAuth, token refresh, activity sync
    gist.js             backup/restore through a secret gist
```

### Making changes

Two things to remember:

- Add an activity type in `js/types.js` — its `color` is the pastel its day
  circles take. The `key` is what gets stored, so renaming an existing one
  needs a migration in `store.js`.
- Load moved counts bodyweight sets at whatever you weighed on or before that
  day, so old sessions keep the load you were actually lifting. With no
  weigh-in on record there's nothing honest to price them at, so they count
  nothing and the summary line says so.
- Add an exercise to `js/exercises.js` as `[id, name, 'primary secondary …',
  equipment]`. Muscle order matters: the first one gets full credit in the
  Muscles tab. You can also add exercises from inside the app — they're stored
  with your data, so they survive and export alongside it.
- Colours all come from the tokens at the top of `css/app.css`, defined once
  for light and again for dark. The palette is olive and cream throughout —
  nothing in it is pure white or pure black.
- Every palette colour is kept light enough that the same dark ink reads on
  it, against both the cream and the dark ground — faces are never inverted.
  `js/util/color.js` holds `inkFor`, which picks lettering by comparing real
  contrast ratios; it's the guardrail if you add a colour later. Adding one
  darker than about 4.5:1 against `#242c1a` will flip its face to cream, so
  lighten it instead.
- The day score lives entirely in `js/score.js` — `WEIGHTS` sets the balance,
  `BANDS` the faces and cutoffs, the drink curves the weekend allowance, and
  `LOOKBACK` how fast rest credit decays. Nothing else needs touching to
  retune it.
- The typeface is Figtree, shipped as a single variable `.woff2` in
  `assets/fonts/` rather than pulled from a CDN, so the app has no external
  dependencies and looks the same offline. Swapping it means replacing that
  file and the `@font-face` and `--font` lines at the top of the stylesheet.
- After editing any file, bump `CACHE` in `sw.js`. That is what tells an
  installed copy there is something new; without it the phone keeps serving
  the old version indefinitely.
