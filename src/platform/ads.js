import { game } from '../core/state.js';
import { ov } from '../ui/hud.js';
import { holdClock } from '../game/judging.js';
import { resetInput } from '../game/run.js';
import { $ } from '../core/constants.js';
import { isApp, toNative } from './app.js';

/* ---------- ads (free game only) ----------
   Called at the natural break between acts (perks.js: before acts 4, 7 and 10). Full-game players never see
   one. In the app it asks the native side for a real AdMob interstitial and carries on when it closes (or
   straight away if none is ready). In a desktop browser (free-test mode) it shows the old placeholder.
   At least MIN_GAP seconds between two ads. */
const MIN_GAP = 90;
let lastAd = -1e9;

function showAd(next) {
  const t = performance.now() / 1000;
  if (game.full || t - lastAd < MIN_GAP) return next();
  lastAd = t;
  resetInput();
  game.paused = true;
  holdClock();
  if (isApp) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.__adDone = null;
      next();
    };
    window.__adDone = finish; // the app calls this when the ad closes, fails or isn't loaded
    setTimeout(finish, 45000); // never get stuck behind an ad that didn't report back
    toNative({ type: 'ad' });
    return;
  }
  placeholder(next);
}

function placeholder(next) {
  ov.hidden = false;
  let n = 5;
  ov.innerHTML = `<div class="adwrap"><div class="adtag">Ad</div><button class="adx" id="adx" disabled aria-label="Close in 5 seconds">5</button><div class="adbox"><b>Test ad</b><span>A real ad plays here in the app.</span></div></div>`;
  const tm = setInterval(() => {
    n--;
    const x = $('#adx');
    if (!x) {
      clearInterval(tm);
      return;
    }
    if (n > 0) {
      x.textContent = n;
    } else {
      clearInterval(tm);
      x.disabled = false;
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Close ad');
      x.onclick = () => {
        ov.innerHTML = '';
        next();
      };
    }
  }, 1000);
}

export { showAd };
