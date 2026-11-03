import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { prog, saveProg } from './progress.js';
import { arenaId } from '../arenas/current.js';
import { _b } from '../render/trails.js';
import { burst } from '../render/particles.js';
import { ac, initAudio, sfxNoise } from '../audio/synth.js';
import { FINAL, beatAt, lat, now, timeAt } from '../audio/clock.js';
import { frNear, frTime, freeSteer } from './freeride.js';
import { ARENAS } from '../arenas/arenas.js';
import { player, pool } from './objects.js';
import { DIRS } from './chart.js';
import { addBal, ov, showJudge, toast } from '../ui/hud.js';
import { chargeBoost, useBoost } from './boost.js';
import { addScore, cursed, drawCurse, gw, pk, pw } from './perks.js';
import { countPlay, recordRun, showOver } from '../ui/leaderboard.js';
import { tutEv } from '../ui/tutorial.js';
import { resetInput } from './run.js';
import { $, G, R, V3 } from '../core/constants.js';
import { bst } from '../bikes/stats.js';
import { recordCareer } from './unlocks.js';
import { hitSound } from '../audio/songs.js';

const MIR = { left: 'right', right: 'left', ul: 'ur', ur: 'ul', dl: 'dr', dr: 'dl' };
function release(type) {
  if (cursed('mirror') && MIR[type]) type = MIR[type];
  if (type === 'left' || type === 'ul' || type === 'dl') type = 'standl';
  else if (type === 'right' || type === 'ur' || type === 'dr') type = 'standr';
  if (type !== 'wheelie' && type !== 'nose' && type !== 'standl' && type !== 'standr') return;
  if (type === 'wheelie') game.wheelieDown = false;
  if (type === 'nose') game.noseDown = false;
  const n = game.holdNote;
  if (!n || game.over || n.type !== type) return;
  game.holdNote = null;
  n.el.classList.remove('holding');
  const end = timeAt(n.beat + n.len),
    t = now() - lat();
  if (t >= end - gw(n.type)) finishHold(n);
  else {
    showJudge('m', 'DROPPED IT');
    n.el.classList.add('miss');
    tutEv('drop', n.type);
  }
}
const ridersFor = a => Math.max(0, Math.min(a - 1, pool.length)),
  missCost = () =>
    (cursed('glass') ? 2 : 1) *
    Math.min(55, 18 + 4 * game.act) *
    Math.max(0.35, 1 - 0.25 * pk('armor')) *
    Math.max(0.5, 1 - (bst('grip') - 3) * 0.13);
function finishHold(n) {
  tutEv('hold', n.type);
  if (n.auto) {
    game.wheelieDown = false;
    game.noseDown = false;
  }
  chargeBoost(15);
  game.holdNote = null;
  n.el.classList.remove('holding');
  n.el.classList.add('ok');
  const mult = cursed('coldCrowd') ? 1 : 1 + Math.min(3, Math.floor(game.combo / 8));
  addScore(400 * mult);
  showJudge('p', n.type === 'nose' ? 'STOPPIE!' : n.type.startsWith('stand') ? 'SEAT STAND!' : 'WHEELIE!');
  game.cheer = 1;
  crowd.wave();
  addBal(10);
  sfxNoise(1.2, 1300, 0.22, 'cheer');
}
function press(type, tAt, soft) {
  if (window.__presses) window.__presses.push(type);
  initAudio();
  if (!game.running || game.paused || game.over) return;
  const t = tAt ?? now() - lat();
  if (cursed('mirror') && MIR[type]) type = MIR[type];
  if (type === 'jump') player.hopT0 = t;
  if (type === 'wheelie') game.wheelieDown = true;
  if (type === 'nose') game.noseDown = true;
  if (game.FREE) {
    if (type === 'jump') hitSound('jump');
    return;
  }
  let best = null,
    bd = 9;
  for (const n of game.notes) {
    if (n.judged) continue;
    const d = Math.abs(timeAt(n.beat) - t);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  const isL = type === 'left' || type === 'ul' || type === 'dl',
    isR = type === 'right' || type === 'ur' || type === 'dr',
    okT = n =>
      n &&
      (n.type === type ||
        (n.type === 'standl' && isL) ||
        (n.type === 'standr' && isR) ||
        // while holding a long press, any left-ish swipe counts for any left move (same for right)
        (game.holdNote &&
          !n.len &&
          ((isL && ['left', 'ul', 'dl'].includes(n.type)) || (isR && ['right', 'ur', 'dr'].includes(n.type)))));
  const W = soft ? 2 : game.holdNote ? 1.5 : 1;
  if (soft && !(best && bd <= gw(best.type) * W && okT(best))) return;
  if (best && best.decoy && bd <= gw(best.type) * W && okT(best)) {
    // Decoys curse: hitting a crossed-out move is a mistake
    best.judged = 'm';
    best.el.classList.add('miss');
    loseCombo();
    showJudge('m', 'DECOY!');
    if (!game.TUT && !pk('lockNos')) game.boostCharge = 0;
    addBal(-missCost() * 0.6);
    return;
  }
  if (best && bd <= gw(best.type) * W && okT(best)) {
    const g = bd <= pw(best.type) * W && !cursed('judges') ? 'p' : 'g';
    best.judged = g;
    best.el.classList.add('ok');
    game.combo++;
    game.stats.maxCombo = Math.max(game.stats.maxCombo, game.combo);
    const mult = cursed('coldCrowd') ? 1 : 1 + Math.min(3, Math.floor(game.combo / 8)),
      both = game.holdNote && !best.len;
    addScore((g === 'p' ? 300 : 120) * mult * (both ? 2 : 1));
    game.stats[g === 'p' ? 'perfect' : 'good']++;
    addBal(g === 'p' ? 7 : 3);
    chargeBoost(g === 'p' ? 14 : 7);
    if (best.type === 'jump') {
      game.cheer = 1;
      crowd.wave();
      sfxNoise(1.1, 1500, 0.2, 'cheer');
    }
    showJudge(g, both ? 'DOUBLE!' : g === 'p' ? 'PERFECT!' : 'GOOD');
    tutEv(both ? 'double' : 'hit', best.type);
    if (both) tutEv('hit', best.type);
    if (both) {
      game.cheer = 1;
      crowd.wave();
    }
    if (best.len) {
      game.holdNote = best;
      best.el.classList.remove('ok');
      best.el.classList.add('holding');
      best.lastTick = best.beat;
    }
    hitSound(best.type, 0, g);
    if (game.combo % 8 === 0) {
      game.cheer = 1;
      sfxNoise(1.1, 1400, 0.18, 'cheer');
    }
  } else if (best && bd <= gw(best.type)) {
    loseCombo();
    showJudge('m', 'WRONG BUTTON');
    if (!game.TUT && !pk('lockNos')) game.boostCharge = 0;
    addBal(-(6 + game.act));
    if (DIRS.includes(type)) freeSteer(type, t);
  } else if (DIRS.includes(type)) {
    freeSteer(type, t);
    game.combo = 0;
    game.score = Math.max(0, game.score - 100);
    addBal(-4);
    showJudge('m', 'OFF SCRIPT -100');
  } else if (type !== 'wheelie' && type !== 'nose') {
    if (game.combo > 0) showJudge('m', 'OFF BEAT');
    game.combo = 0;
    addBal(-5);
  }
}
function miss(n) {
  tutEv('miss', n.type);
  n.judged = 'm';
  n.el.classList.add('miss');
  loseCombo();
  if (!game.TUT && !pk('lockNos')) game.boostCharge = 0; // a miss empties the NOS (unless Locked NOS)
  if (n.len) {
    showJudge(
      'm',
      n.type === 'nose' ? 'MISSED STOPPIE' : n.type.startsWith('stand') ? 'MISSED SEAT STAND' : 'MISSED WHEELIE',
    );
    return;
  }
  if (game.shield > 0 && !game.TUT) {
    game.shield--;
    drawCurse();
    showJudge('g', 'SHIELD');
    if (n.slot && n.type === 'jump') player.hopT0 = now() - lat() - 0.2;
    return;
  }
  game.stats.miss++;
  showJudge('m', 'MISS');
  player.shake = 0.5;
  $('#vig').style.opacity = 0.9;
  setTimeout(() => ($('#vig').style.opacity = 0), 250);
  if (n.type === 'jump' && n.slot) {
    // they never get knocked off: the other rider hops clear of you (you just lose balance)
    n.slot.dodgeB = beatAt(now() - lat());
  } else sfxNoise(0.4, 300, 0.4, 'crash');
  addBal(-missCost());
}
/* a mistake breaks the combo, unless Combo saver has one left this act */
function loseCombo() {
  if (game.combo > 0 && game.comboSaves > 0 && !game.TUT) {
    game.comboSaves--;
    setTimeout(() => toast('COMBO SAVED', 900), 350);
    return;
  }
  game.combo = 0;
}
/* pausing (perk / curse / ad / pause menu) freezes the show on the exact beat it was on; resuming
   re-anchors the tempo map so it carries on from that beat, whatever the audio clock did meanwhile
   (suspended, rebuilt, jumped) — never a fast-forward to catch up */
function holdClock() {
  if (game.heldAt == null) {
    game.heldAt = now();
    game.heldB = game.tempos && game.tempos.length ? beatAt(now() - lat()) : null;
  }
  if (game.engineOsc && ac) game.engineOsc.g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
}
function freeClock() {
  if (ac && ac.state !== 'running') ac.resume().catch(() => {});
  if (game.heldAt == null) return;
  let d = now() - game.heldAt;
  if (game.heldB != null) {
    d = now() - lat() - timeAt(game.heldB);
    game.lastB = game.heldB;
  }
  game.heldAt = null;
  game.heldB = null;
  game.tempos.forEach(x => (x.time += d));
  game.boostEnd += d;
  player.hopT0 += d;
  if (game.engineOsc && ac) game.engineOsc.g.gain.setTargetAtTime(0.035, ac.currentTime, 0.1);
}
function finale() {
  resetInput();
  game.paused = true;
  holdClock();
  game.cheer = 1;
  crowd.wave();
  ov.hidden = false;
  ov.innerHTML = `<div class="card"><h1><small>Act ${FINAL} complete</small>Show stopper!</h1><p>You rode all ten acts without going down. The crowd wants more.</p>
  <div class="res"><div><span>Score</span><b>${Math.floor(game.score).toLocaleString()}</b></div><div><span>Best combo</span><b>${game.stats.maxCombo}</b></div><div><span>Perfect</span><b>${game.stats.perfect}</b></div></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="go" id="enc">Encore</button><button class="go" id="bow" style="background:transparent;color:var(--ink);border:1px solid var(--line)">Take a bow</button></div>
  <div class="best">Encore keeps going at top speed until you crash.</div></div>`;
  $('#enc').onclick = () => {
    game.encore = true;
    game.paused = false;
    ov.hidden = true;
    freeClock();
  };
  $('#bow').onclick = () => {
    game.paused = false;
    game.over = { score: Math.floor(game.score), win: true };
    countPlay(true);
    prog.won = true;
    prog.maxAct = Math.max(prog.maxAct, FINAL);
    saveProg();
    recordRun();
    game.over.unlocked = careerRun(true);
    game.over.newBest = game.over.score > game.best;
    if (game.over.newBest) {
      game.best = game.over.score;
      try {
        localStorage.setItem('god-beat-best', game.best);
      } catch (e) {}
    }
    if (game.engineOsc) {
      try {
        game.engineOsc.o.stop();
      } catch (e) {}
      game.engineOsc = null;
    }
    freeClock();
    showOver();
  };
}
/* fold this run into the lifetime stats that drive unlocks (tutorial runs don't count) */
function careerRun(win) {
  if (game.TUT) return [];
  const run = game.FREE
    ? { free: true, time: frTime, near: frNear }
    : { act: game.act, win, score: game.score, combo: game.stats.maxCombo, perfect: game.stats.perfect };
  return recordCareer(run, id => ARENAS[id].name);
}
function gameOver() {
  game.over = { score: Math.floor(game.score) };
  countPlay();
  if (!game.FREE && !game.TUT) {
    prog.maxAct = Math.max(prog.maxAct, game.act);
    saveProg();
  }
  recordRun();
  game.over.unlocked = careerRun(false);
  game.over.newBest = game.over.score > game.best;
  if (game.over.newBest) {
    game.best = game.over.score;
    try {
      localStorage.setItem('god-beat-best', game.best);
    } catch (e) {}
  }
  game.slow = 1.8;
  player.cp = player.p.clone().multiplyScalar(R);
  player.cv = player.t
    .clone()
    .multiplyScalar(6)
    .add(new V3(0, 2, 0));
  player.sa = new V3(0.3, 1, 0.2).normalize();
  player.sw = 9;
  burst(player.cp.clone());
  sfxNoise(1.4, 700, 0.9, 'crash');
  player.trail.visible = false;
  if (game.engineOsc) {
    try {
      game.engineOsc.o.stop();
    } catch (e) {}
    game.engineOsc = null;
  }
}
function tumble(b, dt) {
  b.cv.y -= G * (arenaId === 'moon' ? 0.35 : 1) * dt;
  b.cp.addScaledVector(b.cv, dt);
  const L = b.cp.length(),
    lim = R - 0.35;
  if (L > lim) {
    const n = _b.copy(b.cp).divideScalar(L);
    b.cp.copy(n).multiplyScalar(lim);
    const vn = b.cv.dot(n);
    if (vn > 0) b.cv.addScaledVector(n, -1.35 * vn);
    b.cv.multiplyScalar(0.985);
    b.sw *= 0.985;
  }
}

export function initJudging() {
  game.heldAt = null;
  /* ---------- input ---------- */
  addEventListener('keydown', e => {
    if (e.code === 'KeyB') useBoost();
  });
}

export { finale, finishHold, freeClock, gameOver, holdClock, miss, press, release, ridersFor, tumble };
