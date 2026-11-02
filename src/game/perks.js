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
import { $ } from '../core/constants.js';

/* ---------- perks (picked between acts, reset every run) ----------
   `act: 1` perks only last for the act about to start (game.actFx, cleared at the next act). */
const PERKS = [
  { id: 'lockNos', name: 'Locked NOS', desc: "A charged NOS isn't lost when you miss.", once: 1 },
  { id: 'doubleNos', name: 'Double NOS', desc: 'Your next NOS lasts twice as long.' },
  { id: 'hot', name: 'Hot NOS', desc: "NOS charges even when your balance isn't full.", once: 1 },
  { id: 'shield', name: 'Shield', desc: 'Your next 3 misses cost nothing.' },
  { id: 'comboSave', name: 'Combo saver', desc: 'Your combo survives one miss every act.' },
  { id: 'slowmo', name: 'Slow-mo', desc: 'Next act plays 10 BPM slower.', act: 1 },
  { id: 'perfHeal', name: 'Perfect heal', desc: 'Perfects give back double balance.' },
  { id: 'showtime', name: 'Showtime', desc: 'Double points for the next act.', act: 1 },
  { id: 'wide', name: 'Wide window', desc: 'Much easier timing for the next act.', act: 1 },
  { id: 'armor', name: 'Thick skin', desc: 'Misses knock 25% less off your balance.' },
  { id: 'score', name: 'Showman', desc: 'Every point you score is worth 25% more.' },
  { id: 'nitro', name: 'Nitro tank', desc: 'NOS charges 50% faster.' },
  { id: 'revive', name: 'Second wind', desc: 'Next time you would crash, bounce back to half balance.' },
  { id: 'refill', name: 'Pit stop', desc: 'Full balance and +50% NOS, right now.' },
];
/* ---------- curses: sometimes after the perk (from act 3). Pick the least bad; it lasts one act, ×2 points ---------- */
const CURSES = [
  { id: 'mirror', name: 'Mirror', desc: 'Left is right and right is left.' },
  { id: 'wheelies', name: 'Wheelie mania', desc: 'A long press in every bar.' },
  { id: 'blind', name: 'Blind spot', desc: 'Moves vanish just before the circle.' },
  { id: 'fast', name: 'Fast forward', desc: '+15 BPM.' },
  { id: 'glass', name: 'Glass bones', desc: 'Misses cost double balance.' },
  { id: 'noNos', name: 'No NOS', desc: 'NOS is jammed.' },
  { id: 'decoys', name: 'Decoys', desc: "Don't hit the red crossed-out moves." },
  { id: 'dark', name: 'Lights out', desc: 'The arena goes dark.' },
  { id: 'dizzy', name: 'Dizzy', desc: 'The world rolls round.' },
  { id: 'double', name: 'Double time', desc: 'Much busier moves.' },
  // score curses: ride as normal, but your points suffer (no ×2 on these)
  { id: 'pickpocket', name: 'Pickpocket', desc: 'Points are worth 10%.', score: 1 },
  { id: 'coldCrowd', name: 'Cold crowd', desc: 'No combo bonus.', score: 1 },
  { id: 'taxman', name: 'Taxman', desc: 'Lose 20% of your score when the act ends.', score: 1 },
  { id: 'judges', name: 'Tough judges', desc: 'Perfects only count as Good.', score: 1 },
];
const curseOf = id => CURSES.find(x => x.id === id);
const pk = id => game.perks[id] || 0,
  fx = id => (game.actFx && game.actFx[id]) || 0,
  cursed = id => !game.TUT && game.curse === id;
const winMul = () => 1 + (fx('wide') ? 0.6 : 0);
const pw = t => PW * winMul() * statMul(kindOf(t)),
  gw = t => GW * winMul() * statMul(kindOf(t));
function addScore(v) {
  const c = !game.TUT && game.curse && curseOf(game.curse);
  game.score +=
    v *
    (1 + 0.25 * pk('score')) *
    (fx('showtime') ? 2 : 1) *
    (c ? (c.score ? 1 : 2) : 1) *
    (cursed('pickpocket') ? 0.1 : 1);
}
/* BPM of an act including Slow-mo / Fast forward (only known once the act's picks are made) */
const actBpm = a => bpmOfAct(a) + (fx('slowmo') ? -10 : 0) + (cursed('fast') ? 15 : 0);
function startAct(a) {
  game.paused = false;
  ov.hidden = true;
  freeClock();
  if (game.TUT) return tutEv('perk');
  drawCurse();
  if (game.curse) {
    const c = curseOf(game.curse);
    toast(c.score ? `CURSE · ${c.name.toUpperCase()}` : `${c.name.toUpperCase()} · ×2 POINTS`, 2200);
  } else toast(a === FINAL ? `Grand finale · ${SONGS[songFor(a)].name}` : `Act ${a} · ${SONGS[songFor(a)].name}`, 1600);
}
function drawCurse() {
  const el = $('#curse');
  if (!el) return;
  const c = !game.TUT && game.curse && curseOf(game.curse);
  el.hidden = !c;
  if (c) el.textContent = c.score ? c.name : c.name + ' ×2';
  const pips = $('#shieldPips');
  if (pips) pips.textContent = '◆'.repeat(Math.min(6, game.shield || 0));
  document.body.classList.toggle('lightsout', !!c && c.id === 'dark');
}
/* a new act begins: act-only perks and the curse end */
function endActFx(survived = true) {
  if (survived && game.curse && game.running && !game.over && !game.TUT) {
    game.cursesSurvived = (game.cursesSurvived || 0) + 1;
    if (game.curse === 'taxman') game.score *= 0.8;
    setTimeout(() => toast('CURSE SURVIVED ☠', 1300), 1700);
  }
  game.actFx = {};
  game.curse = null;
  game.comboSaves = pk('comboSave');
  drawCurse();
}
/* each show gets 0 (25%), 1 (50%) or 2 (25%) curses, on random acts from 3 to 10 */
function planCurses() {
  const r = Math.random(),
    n = r < 0.25 ? 0 : r < 0.75 ? 1 : 2,
    acts = [3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5);
  game.curseActs = acts.slice(0, n);
  game.cursesSurvived = 0;
}
function offerCurse(a) {
  // always one ride-as-normal score curse in the three
  const play = CURSES.filter(c => !c.score).sort(() => Math.random() - 0.5),
    sc = CURSES.filter(c => c.score).sort(() => Math.random() - 0.5);
  const pool3 = [play[0], play[1], sc[0]].sort(() => Math.random() - 0.5);
  ov.innerHTML = `<div class="card cursed"><h1><small>${game.TUT ? 'Sometimes you get' : `Act ${a} · cursed!`}</small>Pick your curse</h1>
    <div class="nextup"><span>Lasts 1 act</span><span>Pick the least bad</span><span>Survive it: ☠</span></div>
    <div class="perks">${pool3.map(c => `<button class="perk" data-id="${c.id}"><b>${c.name}</b><span>${c.desc}</span></button>`).join('')}</div></div>`;
  ov.querySelectorAll('.perk').forEach(
    b =>
      (b.onclick = () => {
        if (!game.TUT) game.curse = b.dataset.id;
        startAct(a);
      }),
  );
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
    <div class="perks">${pool3.map(p => `<button class="perk" data-id="${p.id}"><b>${p.name}</b><span>${p.desc}</span>${pk(p.id) && !p.act ? `<i>You have ${pk(p.id)}</i>` : ''}</button>`).join('')}</div></div>`;
  ov.querySelectorAll('.perk').forEach(
    b =>
      (b.onclick = () => {
        const id = b.dataset.id,
          p = PERKS.find(x => x.id === id);
        if (p.act) game.actFx[id] = 1;
        else game.perks[id] = pk(id) + 1;
        if (id === 'refill') {
          game.balance = 100;
          game.boostCharge = Math.min(100, game.boostCharge + 50);
          drawHearts();
        }
        if (id === 'shield') game.shield = (game.shield || 0) + 3;
        if (id === 'comboSave') game.comboSaves = pk('comboSave');
        if (game.TUT || (a <= FINAL && (window.__curse || (game.curseActs || []).includes(a)))) offerCurse(a);
        else startAct(a);
      }),
  );
}
export function initPerks() {
  game.perks = {};
  game.actFx = {};
  game.curse = null;
  game.shield = 0;
  game.comboSaves = 0;
}

export { planCurses, CURSES, actBpm, addScore, cursed, drawCurse, endActFx, fx, gw, offerPerks, pk, pw };
