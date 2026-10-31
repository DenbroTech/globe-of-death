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

function initApp() {
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

export { initApp, isApp, toNative };
