# Training App — climbing + fitness logger

## Context

`/Users/elake/Research/GitHub/training-app` is an empty repo (one commit, just a README). The goal is a minimal personal app for logging bouldering, sport climbing, and weightlifting, plus an analysis view showing progress over time. It must be usable on both phone and computer, with a clear/minimal aesthetic.

Decisions already made:
- **Delivery:** PWA deployed to GitHub Pages. Add-to-home-screen on the phone, browser tab on the computer, works offline.
- **Sync:** local `localStorage` on each device + JSON export/import. No accounts, no backend, no cost.
- **Stack:** React + Vite + Tailwind.
- **Logging model:** one boulder entry = grade + tags (no send/attempt status, no count field). Weights in pounds. Sessions auto-open for today — no start/stop.


## Data model

One versioned blob in `localStorage` under key `training-app/v1`:

```js
{
  version: 1,
  sessions: [
    { id, type: 'climb', date: '2026-07-21',
      boulders: [{ id, grade: 6, tags: ['power','moon'] }],
      routes:   [{ id, grade: '11c', tags: ['outdoor'] }],
      notes: '' },
    { id, type: 'lift', date: '2026-07-21',
      sets: [{ id, exercise: 'deadlift', weight: 275, reps: 5, rpe: 8 }],
      notes: '' }
  ],
  customBoulderTags: [],
  customExercises: []
}
```

At most one `climb` and one `lift` session per date; `getOrCreateToday(type)` resolves it. Every write goes through one `save()` that serializes the whole blob — the dataset is small enough (years of use ≈ tens of KB) that partial updates are not worth the complexity.

## Files to create

- `package.json`, `vite.config.js` — Vite + `@vitejs/plugin-react` + `@tailwindcss/vite` (Tailwind v4, no separate config file) + `vite-plugin-pwa`. `base: '/training-app/'` for Pages.
- `index.html`, `src/main.jsx`, `src/index.css`
- `src/lib/storage.js` — `load()`, `save()`, `getOrCreateToday()`, `exportJson()`, `importJson()`, schema-version guard. Import shows a confirm dialog and offers merge-by-date vs replace.
- `src/lib/grades.js` — boulder grades V4–V12; sport grades `.10a`–`.13d` (16 values) with ordinal helpers for sorting/charting.
- `src/lib/stats.js` — pure aggregation functions over `sessions`, all taking a date window: grade histograms, per-week volume, max/median grade per month, per-exercise estimated 1RM (Epley: `w * (1 + reps/30)`), tag frequency, streaks.
- `src/App.jsx` — three tabs (Climb / Lift / Analysis) via a bottom bar on mobile, top bar on desktop. No router; tab state in `useState`.
- `src/components/ClimbTab.jsx` — today's date header; boulder adder (grade row of V4–V12 buttons + tag chips: power, dynamic, slab, coordo, moon, tension, plus `+` to define a custom tag persisted in `customBoulderTags`); list of today's boulders with tap-to-delete; a collapsed "Sport route" section (grade select + indoor/outdoor chips) so it stays out of the way; session notes textarea autosaving on blur.
- `src/components/LiftTab.jsx` — exercise picker (deadlift, bench press, front squat, split squats, overhead press, bicep curl, pullup, + custom), numeric weight (lb) and reps inputs, 1–10 RPE selector, add-set button; today's sets grouped by exercise; notes textarea. New sets prefill from the last set of that exercise.
- `src/components/AnalysisTab.jsx` — window selector (week / month / year / all) driving: boulder grade histogram, sport grade histogram, sessions-per-week bars, max-and-median boulder grade trend, estimated-1RM trend per exercise, tag distribution, plus summary stats (total boulders, hardest grade, current streak).
- `src/components/SessionLog.jsx` + `SessionDetail.jsx` — reverse-chronological session list; tapping one opens full detail including notes, with edit and delete.
- `src/components/charts/` — small hand-rolled SVG `BarChart` and `LineChart` (~60 lines each). No charting dependency; keeps the bundle and the visual language minimal.
- `src/components/Settings.jsx` — export JSON (download), import JSON (file picker), storage size, wipe-all with confirm.
- `public/manifest.webmanifest` + icons; PWA config in `vite.config.js`.
- `.github/workflows/deploy.yml` — build on push to `main`, deploy to Pages via `actions/deploy-pages`.

## Aesthetics

Near-monochrome: one neutral gray scale, a single accent used only for the active tab and chart fills. System font stack. Generous whitespace, no cards-in-cards, no icons except where a glyph beats a word. Respects `prefers-color-scheme` for dark mode. Tap targets ≥44px; `env(safe-area-inset-bottom)` padding on the bottom bar.

## Verification

1. `npm install && npm run dev`, then drive the dev server in the browser at both desktop (1280×800) and mobile (375×812) viewports.
2. Log a full climbing session (several boulders across grades, a custom tag, a sport route, notes) and a lifting session; reload the page and confirm everything persists.
3. Check the Analysis tab renders with real data, and that the week/month/year/all switch changes the charts. Seed a few backdated sessions via the console to exercise the trend charts.
4. Open a past session from the log; confirm notes and all entries show, and that edit/delete work.
5. Export JSON, wipe storage, re-import, confirm a byte-identical round trip.
6. `npm run build && npm run preview` — confirm no console errors and the service worker registers.
7. Manual steps for the user afterward: create the GitHub repo, push, enable Pages (source: GitHub Actions), then open the URL on the phone and Add to Home Screen.
