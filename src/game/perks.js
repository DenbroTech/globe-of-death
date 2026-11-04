import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { garage, saveGarage } from './save.js';
import { ACT_START, FINAL, GW, PW, bpmOfAct, lat, now, timeAt } from '../audio/clock.js';
import { drawHearts, ov, toast } from '../ui/hud.js';
import { freeClock, holdClock, ridersFor } from './judging.js';
import { resetInput } from './run.js';
import { kindOf, statMul } from '../bikes/stats.js';
import { SONGS, songFor } from '../audio/songs.js';
import { showAd } from '../platform/ads.js';
import { tutEv } from '../ui/tutorial.js';
import { $ } from '../core/constants.js';
import { useBoost } from './boost.js';

/* ---------- perks (picked between acts, reset every run) ----------
   `act: 1` perks only last for the act about to start (game.actFx, cleared at the next act). */
const PERKS = [
  { id: 'lockNos', name: 'Locked NOS', desc: "A charged NOS isn't lost when you miss.", once: 1 },
  { id: 'doubleNos', name: 'Double NOS', desc: 'Your next NOS lasts twice as long.' },
  { id: 'hot', name: 'Hot NOS', desc: "NOS normally only charges at full balance. Now it charges at any balance.", once: 1 },
  { id: 'shield', name: 'Shield', desc: 'Your next 3 misses cost nothing.' },
  { id: 'comboSave', name: 'Combo saver', desc: 'Your first combo break every act is saved. Pick it again to save the first 2.' },
  { id: 'anyDir', name: 'Any way', desc: 'For the next act, any direction swipe counts for any direction move.', act: 1 },
  { id: 'slowmo', name: 'Slow-mo', desc: 'Next act plays 10 BPM slower.', act: 1 },
  { id: 'overheal', name: 'Double balance', desc: 'Your balance bar fills to double, right now.' },
  { id: 'bigTank', name: 'Big tank', desc: 'Your balance bar can grow to double size.', once: 1 },
  { id: 'showtime', name: 'Showtime', desc: 'Double points for the next act.', act: 1 },
  { id: 'wide', name: 'Wide window', desc: 'Much easier timing for the rest of the show.', once: 1 },
  { id: 'armor', name: 'Thick skin', desc: 'Misses knock 25% less off your balance.' },
  { id: 'score', name: 'Showman', desc: 'Every point you score is worth 25% more.' },
  { id: 'nitro', name: 'Nitro tank', desc: 'NOS charges 50% faster.' },
  { id: 'revive', name: 'Second wind', desc: 'Next time you would crash, bounce back to half balance.' },
  // stored perks: kept in your one action slot, used with a quick swipe down
  { id: 'refill', name: 'Pit stop', desc: 'Stored. Quick swipe down for full balance and +50% NOS.', stored: 1 },
  { id: 'spareNos', name: 'Spare NOS', desc: 'Stored. Quick swipe down for a 6-second NOS, any time.', stored: 1 },
  { id: 'rewind', name: 'Rewind', desc: 'Stored. Quick swipe down to go back 5 moves and try them again.', stored: 1 },
  { id: 'teaBreak', name: 'Tea break', desc: 'Stored. Quick swipe down to pause, then 3-2-1 back in with +20 balance.', stored: 1 },
];
/* ---------- curses: sometimes after the perk (from act 3). Pick the least bad; it lasts one act, ×2 points ---------- */
const CURSES = [
  { id: 'mirror', name: 'Mirror', desc: 'Left is right and right is left.' },
  { id: 'wheelies', name: 'Wheelie mania', desc: 'Long press (wheelie) between every move. Let go just before each move, then go back into it.' },
  { id: 'blind', name: 'Blind spot', desc: 'Moves vanish just before the circle.' },
  { id: 'fast', name: 'Fast forward', desc: '+15 BPM.' },
  { id: 'glass', name: 'Glass bones', desc: 'Misses cost double balance.' },
  { id: 'noNos', name: 'No NOS', desc: 'NOS is jammed.' },
  { id: 'decoys', name: 'Decoys', desc: "Don't hit the red crossed-out moves." },
  { id: 'dark', name: 'Lights out', desc: 'The arena goes dark.' },
  { id: 'dizzy', name: 'Dizzy', desc: 'The world rolls round.' },
  { id: 'double', name: 'Double time', desc: 'Much busier moves.' },
  { id: 'reverse', name: 'Reverse', desc: 'Your bike rides backwards round the globe, and moves come from the left.' },
  { id: 'mystery', name: 'Mystery moves', desc: 'Moves stay blank until 1 second before you press.' },
  // score curses: ride as normal, but your points suffer (no ×2 on these)
  { id: 'pickpocket', name: 'Pickpocket', desc: 'Points are worth 10%.', score: 1 },
  { id: 'coldCrowd', name: 'Cold crowd', desc: 'No combo bonus.', score: 1 },
  { id: 'taxman', name: 'Taxman', desc: 'Lose 20% of your score when the act ends.', score: 1 },
  { id: 'judges', name: 'Tough judges', desc: 'Perfects only count as Good.', score: 1 },
  // these hit right away when picked
  { id: 'fine', name: 'Fine', desc: 'Lose 10,000 points now.', score: 1 },
  { id: 'comboBreak', name: 'Combo breaker', desc: 'Your combo goes back to 0.', score: 1 },
  { id: 'halfPerfect', name: 'Half marks', desc: 'Your perfect count is cut in half.', score: 1 },
];
const curseOf = id => CURSES.find(x => x.id === id);
/* fair Fisher–Yates shuffle (sorting with a random comparator favoured the first items in each list) */
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pk = id => game.perks[id] || 0,
  fx = id => (game.actFx && game.actFx[id]) || 0,
  cursed = id => !game.TUT && game.curse === id;
const winMul = () => 1 + (pk('wide') ? 0.6 : 0);
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
const STASH_NAME = { refill: 'Pit stop', spareNos: 'Spare NOS', teaBreak: 'Tea break', rewind: 'Rewind' };
function drawStash() {
  const el = $('#stash');
  if (!el) return;
  el.hidden = !game.stash;
  if (game.stash) el.textContent = '▼ ' + STASH_NAME[game.stash] + ' · quick swipe down';
}
/* the action slot: a quick swipe down (flick and let go) fires whatever is stored */
function useStash() {
  const id = game.stash;
  if (!id || !game.running || game.paused || game.over) return false;
  if (id === 'spareNos') {
    if (cursed('noNos')) {
      toast('NOS JAMMED', 900);
      return true;
    }
    useBoost(6);
    toast('SPARE NOS!', 900);
  } else if (id === 'rewind') {
    if (!rewind()) {
      toast('NOTHING TO REWIND YET', 900);
      return true; // keep it stored
    }
    game.stash = null;
    drawStash();
    return true;
  } else if (id === 'teaBreak') {
    game.stash = null;
    drawStash();
    teaBreak();
    return true;
  } else {
    game.balance = Math.max(game.balance, game.balMax || 100);
    game.boostCharge = Math.min(100, game.boostCharge + 50);
    drawHearts();
    toast('PIT STOP!', 900);
  }
  game.stash = null;
  drawStash();
  tutEv('action');
  return true;
}
/* Rewind: back to just before the 5th-last judged move (not past the start of this act), with score,
   combo, balance and stats as they were then; those moves come round again. Then a 3-2-1 back in. */
function rewind() {
  const S = game.snaps || [],
    actB = (ACT_START[game.act - 1] || 0) * 4;
  let k = Math.max(0, S.length - 5);
  while (k < S.length && S[k].beat < actB + 2) k++;
  if (k >= S.length) return false;
  const s = S[k],
    target = Math.max(actB + 1, s.beat - 1.5);
  Object.assign(game, { score: s.score, combo: s.combo, balance: s.balance, boostCharge: s.boostCharge });
  Object.assign(game.stats, s.stats);
  game.snaps = S.slice(0, k);
  game.boostEnd = 0;
  game.holdNote = null;
  game.wheelieDown = game.noseDown = false;
  for (const n of game.notes)
    if (n.beat >= target - 0.01 && n.judged) {
      n.judged = null;
      n.el.classList.remove('ok', 'miss', 'holding');
      n.el.style.opacity = '';
      if (n.slot) n.slot.dodgeB = null;
      if (n.len) n.lastTick = n.beat;
    }
  // move the show clock back so `target` is now
  const d = now() - lat() - timeAt(target);
  game.tempos.forEach(x => (x.time += d));
  game.lastB = target;
  game.schedStep = Math.ceil(target * 2);
  drawHearts();
  resetInput();
  game.paused = true;
  holdClock();
  ov.hidden = false;
  let c = 3;
  ov.innerHTML = `<div class="card" style="align-items:center"><h1><small>Rewind</small><span id="rwN">3</span></h1></div>`;
  const t = setInterval(() => {
    c--;
    if (c > 0) $('#rwN').textContent = c;
    else {
      clearInterval(t);
      game.paused = false;
      ov.hidden = true;
      freeClock();
    }
  }, 600);
  return true;
}
/* Tea break: a proper pause when you're under the cosh, then a 3-2-1 back in with +20 balance */
function teaBreak() {
  resetInput();
  game.paused = true;
  holdClock();
  ov.hidden = false;
  ov.innerHTML = `<div class="card"><h1><small>Tea break</small>Take a breather</h1>
    <div class="perks"><button class="perk" id="teaGo"><b>Back on the bike</b></button></div></div>`;
  $('#teaGo').onclick = () => {
    let n = 3;
    ov.innerHTML = `<div class="card" style="align-items:center"><h1 id="teaN">3</h1></div>`;
    const t = setInterval(() => {
      n--;
      if (n > 0) $('#teaN').textContent = n;
      else {
        clearInterval(t);
        game.balance = Math.min(game.balance + 20, Math.max(game.balMax || 100, game.balance));
        drawHearts();
        game.paused = false;
        ov.hidden = true;
        freeClock();
        tutEv('action');
      }
    }, 700);
  };
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
    acts = shuffle([3, 4, 5, 6, 7, 8, 9, 10]);
  game.curseActs = acts.slice(0, n);
  game.cursesSurvived = 0;
}
function offerCurse(a) {
  // always one ride-as-normal score curse in the three
  const play = shuffle(CURSES.filter(c => !c.score)),
    sc = shuffle(CURSES.filter(c => c.score));
  const pool3 = shuffle([play[0], play[1], sc[0]]);
  ov.innerHTML = `<div class="card cursed"><h1><small>${game.TUT ? 'Sometimes you get' : `Act ${a} · cursed!`}</small>Pick your curse</h1>
    <div class="nextup"><span>Lasts 1 act</span><span>Pick the least bad</span><span>Survive it: ☠</span></div>
    <div class="perks">${pool3.map(c => `<button class="perk" data-id="${c.id}"><b>${c.name}</b><span>${c.desc}</span></button>`).join('')}</div></div>`;
  ov.querySelectorAll('.perk').forEach(
    b =>
      (b.onclick = () => {
        if (!game.TUT) {
          const id = (game.curse = b.dataset.id);
          if (id === 'fine') game.score = Math.max(0, game.score - 10000);
          if (id === 'comboBreak') game.combo = 0;
          if (id === 'halfPerfect') game.stats.perfect = Math.floor(game.stats.perfect / 2);
        }
        startAct(a);
      }),
  );
}
const have = id => (id === 'shield' ? game.shield || 0 : pk(id));
function offerPerks(a, skipAd) {
  if (!skipAd && !game.TUT && (a - 1) % 3 === 0) {
    showAd(() => offerPerks(a, true));
    return;
  }
  // a curse act gets the curse card INSTEAD of a perk (the Lesson shows both, one after the other)
  if (!game.TUT && a <= FINAL && (window.__curse || (game.curseActs || []).includes(a))) {
    resetInput();
    game.paused = true;
    holdClock();
    ov.hidden = false;
    return offerCurse(a);
  }
  resetInput();
  game.paused = true;
  holdClock();
  game.cheer = 1;
  crowd.wave();
  const pool3 = shuffle(PERKS.filter(p => !(p.once && pk(p.id))))
    .slice(0, 3);
  ov.hidden = false;
  ov.innerHTML = `<div class="card"><h1><small>${game.TUT ? 'Act complete' : `Act ${a - 1} complete`}</small>Pick a perk</h1>
    ${game.TUT ? '' : `<div class="nextup"><span>Act ${a}</span><span>${ridersFor(a) ? '+' + ridersFor(a) + ' rider' + (ridersFor(a) > 1 ? 's' : '') : 'Solo'}</span><span>${bpmOfAct(a)} BPM</span></div>`}
    <div class="perks">${pool3.map(p => `<button class="perk" data-id="${p.id}"><b>${p.name}</b><span>${p.desc}</span>${have(p.id) && !p.act ? `<i>You have ${have(p.id)}${p.id === 'shield' ? ' left' : ''}</i>` : ''}</button>`).join('')}</div></div>`;
  ov.querySelectorAll('.perk').forEach(
    b =>
      (b.onclick = () => {
        const id = b.dataset.id,
          p = PERKS.find(x => x.id === id);
        // one action slot: picking a different stored perk asks before replacing
        if (p.stored && game.stash && game.stash !== id) {
          const old = PERKS.find(x => x.id === game.stash);
          ov.innerHTML = `<div class="card"><h1><small>One slot only</small>Replace it?</h1>
            <p>You have a ${old.name} stored. Swap it for ${p.name}?</p>
            <div class="perks"><button class="perk" id="swapY"><b>Take ${p.name}</b></button><button class="perk" id="swapN"><b>Keep ${old.name}</b></button></div></div>`;
          $('#swapY').onclick = () => {
            game.stash = id;
            drawStash();
            startAct(a);
          };
          $('#swapN').onclick = () => startAct(a);
          return;
        }
        if (p.stored) {
          game.stash = id;
          drawStash();
          if (game.TUT) return offerCurse(a);
          return startAct(a);
        }
        if (p.act) game.actFx[id] = 1;
        else game.perks[id] = pk(id) + 1;
        if (id === 'shield') game.shield = (game.shield || 0) + 3;
        if (id === 'overheal') game.balance = 200;
        if (id === 'bigTank') game.balMax = 200;
        drawHearts();
        if (id === 'comboSave') game.comboSaves = pk('comboSave');
        if (game.TUT) offerCurse(a);
        else startAct(a);
      }),
  );
}
export function initPerks() {
  game.perks = {};
  game.actFx = {};
  game.curse = null;
  game.stash = null;
  game.shield = 0;
  game.comboSaves = 0;
}

export { drawStash, useStash, planCurses, CURSES, actBpm, addScore, cursed, drawCurse, endActFx, fx, gw, offerPerks, pk, pw };
