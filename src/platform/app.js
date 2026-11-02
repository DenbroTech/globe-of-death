import { game } from '../core/state.js';
import { quitToMenu, setPause } from '../game/run.js';
import { leaveGarage, showroom } from '../ui/garage.js';
import { showStart } from '../ui/menus.js';
import { ac } from '../audio/synth.js';

/* ---------- native app shell (Expo app in mobile/, game runs in a WebView) ----------
   In a browser this does nothing. Inside the app, window.ReactNativeWebView exists and the
   app calls window.__nativeBack() when the Android back button is pressed.
   AdMob and the "Remove ads" purchase will plug in here (messages to the native side). */
const isApp = !!window.ReactNativeWebView;
const toNative = msg => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));

/* back button: pause a ride, otherwise step back to the home screen, and only leave the app from there */
function nativeBack() {
  const ov = document.getElementById('ov');
  if (game.running && !game.over) return setPause(!game.paused); // ride: pause / resume
  if (game.running && game.over) return quitToMenu(); // crash screen: back to the menu
  if (showroom) {
    leaveGarage();
    return showStart();
  }
  const home = ov && !ov.hidden && document.getElementById('start') && document.getElementById('lvBtn');
  if (!home && !game.running) return showStart();
  toNative({ type: 'exit' });
}

/* Android can throw away the 3D context while the app is in the background, which left a black screen
   until the app was closed. If that happens: keep the fans from the ride, then reload the game as soon as
   it's on screen again (you land on the home screen instead of a black one). */
function watchGL() {
  const c = document.getElementById('c');
  if (!c) return;
  let lost = false;
  const reload = () => {
    if (lost && !document.hidden) setTimeout(() => location.reload(), 150);
  };
  c.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (lost) return;
    lost = true;
    try {
      if (game.running) quitToMenu();
    } catch (err) {}
    reload();
  });
  document.addEventListener('visibilitychange', reload);
}
function initApp() {
  watchGL();
  if (!isApp) return;
  document.documentElement.classList.add('app');
  window.__nativeBack = nativeBack;
  // app sent to the background: pause the ride and silence the audio; resume sound on return
  window.__appPause = () => {
    if (game.running && !game.over) setPause(true);
    if (ac) ac.suspend().catch(() => {});
  };
  window.__appResume = () => {
    if (ac) ac.resume().catch(() => {});
  };
}

/* Google Play Games leaderboards (only when the app has Play Games switched on: window.__playGames) */
const playGamesOn = () => isApp && !!window.__playGames;
function submitScores(run) {
  if (!playGamesOn()) return;
  for (const [board, value] of Object.entries(run))
    if (value > 0) toNative({ type: 'score', board, value: Math.floor(value) });
}
const showPlayLeaderboards = () => toNative({ type: 'leaderboards' });

export { initApp, isApp, playGamesOn, showPlayLeaderboards, submitScores, toNative };
