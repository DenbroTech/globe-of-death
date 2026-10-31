# Globe of Death

Phone-first 3D rhythm motorbike stunt game (three.js r128 + Vite), packaged as an iOS/Android app with Capacitor.

```bash
npm install
npm run dev          # http://localhost:5173 — also reachable from a phone on the same Wi-Fi
npm run build        # web build in dist/
npm run build:single # one self-contained HTML (dist-single/index.html)
npm test             # headless play-test (needs `npm run dev` running)
```

## Run it on your iPhone (needs a Mac)

1. Install **Xcode** from the Mac App Store and open it once.
2. In this folder: `npm install`, then `npm run ios` (builds the game, copies it into the iOS project and opens Xcode).
3. In Xcode: select the **App** target → **Signing & Capabilities** → tick *Automatically manage signing* and pick your **Team** (add your Apple ID under Xcode → Settings → Accounts; a free Apple ID works).
   If it complains the bundle id is taken, change `com.globeofdeath.game` to something unique (e.g. `com.yourname.globeofdeath`).
4. Plug in the iPhone, choose it as the run destination, press **▶ Run**.
5. First time only, on the phone: Settings → General → VPN & Device Management → trust your developer certificate. Also turn on Settings → Privacy & Security → Developer Mode if asked.

With a free Apple ID the app runs for 7 days before it needs re-installing from Xcode; a paid Apple Developer account ($99/yr) removes that and enables TestFlight.

## Android

`npm run android` opens Android Studio; press Run with a phone connected (USB debugging on).

## App bits

- `capacitor.config.json` — app id/name, splash, status bar. Native projects: `ios/`, `android/` (portrait only, full screen).
- `src/platform/app.js` — native-only setup (status bar). AdMob + "Remove ads" purchase plug in here.
- `assets/` — icon and splash sources (rendered from the game); regenerate all sizes with `npx capacitor-assets generate`.
- After changing game code: `npm run app:sync` (or `npm run ios` / `npm run android`).

See `CLAUDE.md` for the game design, code map and working notes. `original/globe-of-death.html` is the single-file version this project was split from.
