# training-app

Simple training app for climbing and fitness. A PWA — install it to the home
screen on a phone, or keep it in a browser tab on a computer. Works offline.

Three tabs: **Climb** (boulders and sport routes), **Lift** (sets), and
**Analysis** (histograms, trends, streaks). A session opens automatically for
today; there is no start/stop.

## Data

Everything lives in `localStorage` under `training-app/v1` on the device that
logged it. There is no account and no backend, so **the only backup is the one
you make**: Settings → Export JSON. To move data between devices, export on one
and import on the other (import offers merge or replace).

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/training-app/
npm run build
npm run preview  # serves the built app, service worker included
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. One-time setup: in the repo's
**Settings → Pages**, set the source to **GitHub Actions**.

The Vite `base` is `/training-app/`, so the app expects to be served from
`https://<user>.github.io/training-app/`. Renaming the repo means changing
`base` in `vite.config.js` and `start_url`/`scope` in its PWA manifest block.
