import { game } from '../core/state.js';
import { ov } from '../ui/hud.js';
import { holdClock } from '../game/judging.js';
import { resetInput } from '../game/run.js';
import { $ } from '../core/constants.js';

function showAd(next) {
  resetInput();
  game.paused = true;
  holdClock();
  ov.hidden = false;
  let n = 5;
  ov.innerHTML = `<div class="adwrap"><div class="adtag">Ad</div><button class="adx" id="adx" disabled aria-label="Close in 5 seconds">5</button><div class="adbox"><b>Test ad</b><span>A real ad plays here once the game is an app.</span></div></div>`;
  const t = setInterval(() => {
    n--;
    const x = $('#adx');
    if (!x) {
      clearInterval(t);
      return;
    }
    if (n > 0) {
      x.textContent = n;
    } else {
      clearInterval(t);
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
