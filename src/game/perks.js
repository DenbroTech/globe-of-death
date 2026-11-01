import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { garage, saveGarage } from './save.js';
import { FINAL, GW, PW, bpmOfAct } from '../audio/clock.js';
import { drawHearts, ov, toast } from '../ui/hud.js';
import { freeClock, holdClock, ridersFor } from './judging.js';
import { resetInput } from './run.js';
import { kindOf, statMul } from '../bikes/stats.js';
import { SONGS, songFor } from '../audio/songs.js';
import { showAd } from '../platform/ads.js';
import { tutEv } from '../ui/tutorial.js';

/* ---------- perks (picked between acts, reset every run) ---------- */
const PERKS = [
  { id: 'window', name: 'Steady hands', desc: 'Your timing window is 25% wider.' },
  { id: 'armor', name: 'Thick skin', desc: 'Misses knock 25% less off your balance.' },
  { id: 'score', name: 'Showman', desc: 'Every point you score is worth 25% more.' },
  { id: 'nitro', name: 'Nitro tank', desc: 'Boost charges 50% faster.' },
  { id: 'longBoost', name: 'Long burn', desc: 'Boost lasts 1.5 seconds longer.' },
  { id: 'net', name: 'Safety net', desc: 'Your first miss in each act costs nothing.' },
  { id: 'pleaser', name: 'Crowd pleaser', desc: 'Jumps and wheelies give back extra balance.' },
  {
    id: 'revive',
    name: 'Second wind',
    desc: 'The next time you would crash, you bounce back to half balance instead.',
  },
  { id: 'hot', name: 'Hot start', desc: "Boost charges at half speed even when your balance isn't full.", once: 1 },
  { id: 'refill', name: 'Pit stop', desc: 'Balance back to full and +50% boost, right now.' },
];
const pk = id => game.perks[id] || 0;
const pw = t => PW * (1 + 0.25 * pk('window')) * statMul(kindOf(t)),
  gw = t => GW * (1 + 0.25 * pk('window')) * statMul(kindOf(t));
function addScore(v) {
  game.score += v * (1 + 0.25 * pk('score'));
}
function offerPerks(a, skipAd) {
  if (!skipAd && !game.TUT && (a - 1) % 3 === 0) {
    showAd(() => offerPerks(a, true));
    return;
  }
  resetInput();
  game.paused = true;
  holdClock();
  game.cheer = 1;
  crowd.wave();
  const pool3 = PERKS.filter(p => !(p.once && pk(p.id)))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  ov.hidden = false;
  ov.innerHTML = `<div class="card"><h1><small>${game.TUT ? 'Act complete' : `Act ${a - 1} complete`}</small>Pick a perk</h1>
    ${game.TUT ? '' : `<div class="nextup"><span>Act ${a}</span><span>${ridersFor(a) ? '+' + ridersFor(a) + ' rider' + (ridersFor(a) > 1 ? 's' : '') : 'Solo'}</span><span>${bpmOfAct(a)} BPM</span></div>`}
    <div class="perks">${pool3.map(p => `<button class="perk" data-id="${p.id}"><b>${p.name}</b><span>${p.desc}</span>${pk(p.id) ? `<i>You have ${pk(p.id)}</i>` : ''}</button>`).join('')}</div></div>`;
  ov.querySelectorAll('.perk').forEach(
    b =>
      (b.onclick = () => {
        const id = b.dataset.id;
        game.perks[id] = pk(id) + 1;
        if (id === 'refill') {
          game.balance = 100;
          game.boostCharge = Math.min(100, game.boostCharge + 50);
          drawHearts();
        }
        game.netLeft = pk('net');
        game.paused = false;
        ov.hidden = true;
        freeClock();
        if (game.TUT) return tutEv('perk');
        toast(a === FINAL ? `Grand finale · ${SONGS[songFor(a)].name}` : `Act ${a} · ${SONGS[songFor(a)].name}`, 1600);
      }),
  );
}
export function initPerks() {
  game.perks = {};
  game.netLeft = 0;
}

export { addScore, gw, offerPerks, pk, pw };
