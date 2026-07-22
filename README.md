# training-app

Simple training app for climbing and fitness. A PWA — install it to the home
screen on a phone, or keep it in a browser tab on a computer. Works offline.

Three tabs: **Climb** (boulders and sport routes), **Lift** (sets), and
**Analysis** (histograms, trends, streaks). A session opens automatically for
today; there is no start/stop.

## Install it on a phone

Open the deployed URL and install it — **Android/Chrome**: menu → *Install app*.
**iOS/Safari**: Share → *Add to Home Screen*. Launch it from the icon afterward,
not from a browser tab: installed apps get persistent storage (the app requests
it on launch, and Settings reports whether it was granted), while an ordinary tab
can have its data evicted by the browser.

On iOS an installed app keeps storage separate from Safari's, so install first
and log second, or the app will look empty. To move data across, export and
import.

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
npm run verify   # end-to-end checks against a running server
```

`npm run verify` drives a real Chrome through the whole app — logging, charts,
the session log, the back gesture, and an export/import round trip. It needs a
server already running, and targets the dev server by default:

```sh
APP_URL=http://localhost:4173/training-app/ npm run verify   # against the build
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. One-time setup: in the repo's
**Settings → Pages**, set the source to **GitHub Actions**.

The Vite `base` is `/training-app/`, so the app expects to be served from
`https://<user>.github.io/training-app/`. Renaming the repo means changing
`base` in `vite.config.js` and `start_url`/`scope` in its PWA manifest block.
