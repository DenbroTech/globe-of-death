import { Capacitor } from '@capacitor/core';

/* ---------- native app shell (Capacitor) ----------
   Runs only inside the iOS/Android app; in a browser it does nothing.
   This is where AdMob and the "Remove ads" purchase will plug in later. */
const isApp = Capacitor.isNativePlatform();

async function initApp() {
  if (!isApp) return;
  document.documentElement.classList.add('app');
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.hide();
  } catch (e) {}
}

export { initApp, isApp };
