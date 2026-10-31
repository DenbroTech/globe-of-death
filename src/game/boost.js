import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { ac, initAudio, tone } from '../audio/synth.js';
import { beatAt, lat, now, timeAt } from '../audio/clock.js';
import { player } from './objects.js';
import { addBal, toast } from '../ui/hud.js';
import { addScore, pk } from './perks.js';
import { tutEv } from '../ui/tutorial.js';
import { $ } from '../core/constants.js';
import { statMul } from '../bikes/stats.js';
import { hitSound } from '../audio/songs.js';

let boostBtn;

let boostB0 = 0;
function chargeBoost(v) {
  if ((game.balance < 100 && !pk('hot')) || boostActive()) return;
  game.boostCharge = Math.min(
    100,
    game.boostCharge + v * (1 + 0.5 * pk('nitro')) * statMul('boost', 0.2) * (game.balance < 100 ? 0.5 : 1),
  );
}
const boostActive = () => now() < game.boostEnd;
function useBoost() {
  initAudio();
  if (!game.running || game.paused || game.over || game.boostCharge < 100 || boostActive()) return;
  tutEv('nos');
  game.boostEnd = now() + 3 + 1.5 * pk('longBoost');
  game.boostCharge = 0;
  {
    const eb = beatAt(game.boostEnd - lat());
    for (const n of game.notes)
      if (n.len && n.beat < eb && n.beat + n.len > eb)
        game.boostEnd = Math.max(game.boostEnd, timeAt(n.beat + n.len) + lat() + 0.05);
    boostB0 = beatAt(now() - lat());
    game.boostB1 = beatAt(game.boostEnd - lat());
  }
  toast('BOOST!', 900);
  game.cheer = 1;
  crowd.wave();
  if (ac) {
    const t = ac.currentTime;
    tone(t, 220, 'sawtooth', 0.2, 0.5, 2400);
    tone(t + 0.05, 440, 'sawtooth', 0.12, 0.45, 3000);
  }
}
function autoHit(n) {
  n.judged = 'p';
  n.el.classList.add('ok');
  game.combo++;
  game.stats.maxCombo = Math.max(game.stats.maxCombo, game.combo);
  game.stats.perfect++;
  const mult = 1 + Math.min(3, Math.floor(game.combo / 8));
  addScore(300 * mult);
  addBal(7);
  if (n.type === 'jump') {
    player.hopT0 = timeAt(n.beat) - 0.18;
    game.cheer = 1;
    crowd.wave();
  }
  if (n.len) {
    game.holdNote = n;
    n.auto = true;
    if (n.type === 'nose') game.noseDown = true;
    else game.wheelieDown = true;
    n.el.classList.remove('ok');
    n.el.classList.add('holding');
    n.lastTick = n.beat;
  }
  hitSound(n.type, 0, 'p');
}

export function initBoost() {
  game.boostB1 = 0;
  game.boostCharge = 0;
  game.boostEnd = 0;
  game.boostWasReady = false;
  boostBtn = $('#boost');
  boostBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    useBoost();
  });
}

export { autoHit, boostActive, boostB0, boostBtn, chargeBoost, useBoost };
