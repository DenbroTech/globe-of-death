# Globe Riders

(Formerly "Globe of Death"; renamed so it suits every age group. The repo, Play package `com.denbro.globeofdeath.app` and Expo slug keep the old name.)

Phone-first 3D rhythm motorbike stunt game (three.js r128 + Vite), packaged as an Android app (Expo + WebView, built with EAS).

```bash
npm install
npm run dev          # http://localhost:5173 — also reachable from a phone on the same Wi-Fi
npm run build        # web build in dist/
npm run build:single # one self-contained HTML (dist-single/index.html)
npm test             # headless play-test (needs `npm run dev` running)
```

## The Android app (Expo, built in the cloud with EAS — same as Flippy Mat)

`mobile/` is a small Expo app that shows the game full screen in a WebView (immersive, kept awake, back button pauses).
The game is bundled as one HTML file, `mobile/assets/game.html`.

After changing the game, refresh that file (repo root): `npm run mobile:sync`

Build an installable APK on your PC (after `git clone https://github.com/DenbroTech/globe-of-death.git` into `C:\`; later just `git pull`):

```
cd mobile
npm install
npx eas-cli build --platform android --profile preview
```

First time: log in with your Expo account, say **yes** to creating the project and to generating a new Android keystore.
The build runs on Expo's servers (~10–20 min) and ends with a link / QR code: open it on the phone to install.
`--profile production` makes the `.aab` for the Play Store.

App bits: `mobile/App.js` (WebView shell), `mobile/app.json` (name, package `com.denbro.globeofdeath.app`, icons, splash),
`mobile/eas.json` (build profiles), `src/platform/app.js` (game side: back button, pause on background; AdMob/"Remove ads" will hook in here).
App icon source: `art/app-icon-source.jpg` (cleaned 1024px: `art/app-icon-1024.png`); the icon/adaptive/splash files in `mobile/assets/` are made from it.

See `CLAUDE.md` for the game design, code map and working notes. `original/globe-of-death.html` is the single-file version this project was split from.
