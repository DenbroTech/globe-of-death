import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { TRAIL_STEP, _a, _b, _c, arcTrail, fillTrail } from '../render/trails.js';
import { INTRO, beatAt, timeAt } from '../audio/clock.js';
import { _o2, addTurn, orientOnWall, posAt, tanAt } from './path.js';
import { player, pool } from './objects.js';
import { showJudge, toast } from '../ui/hud.js';
import { gameOver } from './judging.js';
import { clock } from './loop.js';
import { $, D, HIT, R, V3, YAX, clamp } from '../core/constants.js';

/* ---------- free ride: dodge riders on their own loops for as long as you can ---------- */
let fr = [],
  frNext = 0,
  frMultShown = -1,
  frLastB = 0,
  frTime = 0,
  frNear = 0,
  frChain = 0,
  frDanger = null,
  frPredT = 0,
  frWarned = false;
const GHOST = 5; // seconds a new rider rides as a see-through ghost before they can hit you
/* see-through look for a newly arrived rider: swap in half-opacity copies of its materials */
function setGhost(s, f) {
  if (f >= 1 && !s.ghostOn) return;
  s.ghostOn = f < 1;
  if (!s.ghost) {
    s.ghost = new Map();
    s.bike.g.traverse(o => {
      if (!o.isMesh && !o.isSprite) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach(m => {
        if (s.ghost.has(m)) return;
        const c = m.clone();
        c.transparent = true;
        c.depthWrite = false;
        c.userData.op = m.opacity;
        s.ghost.set(m, c);
      });
      o.userData.mat0 = o.material;
    });
  }
  s.bike.g.traverse(o => {
    if (!o.userData.mat0) return;
    const m0 = o.userData.mat0;
    if (f >= 1) o.material = m0;
    else {
      o.material = Array.isArray(m0) ? m0.map(m => s.ghost.get(m)) : s.ghost.get(m0);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(c => c && (c.opacity = c.userData.op * f));
    }
  });
}
let freeBest = 0;
const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function freeReset() {
  fr.forEach(r => {
    const s = r.s;
    if (s.ghost) setGhost(s, 1);
    s.busy = false;
    s.state = null;
    s.bike.g.visible = false;
    s.trail.visible = false;
    s.ahead.visible = false;
    s.mark.visible = false;
  });
  fr = [];
  frMultShown = -1;
  frNext = 10; // seconds of free ride (a warm-up, no points) before the first rider's ghost arrives
  frLastB = 0;
  frTime = 0;
  frNear = 0;
  frChain = 0;
  frDanger = null;
  frWarned = false;
}
const frPos = (r, th, out) => out.copy(r.u).multiplyScalar(Math.cos(th)).addScaledVector(r.w, Math.sin(th));
function frHits(r, th, B, beats) {
  const pts = player.fInit ? freeFuture(B, beats, 1 / 8) : null,
    a = new V3(),
    b = new V3();
  for (let k = 1; k <= beats * 8; k++) {
    const db = k / 8;
    if (pts) a.copy(pts[k - 1]);
    else posAt(B + db, a);
    frPos(r, th + r.om * db, b);
    if (a.distanceTo(b) * R < HIT * 1.6) return true;
  }
  return false;
}
function frSpawn(B) {
  const s = pool.find(x => !x.busy);
  if (!s) return;
  const n = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    u = new V3().crossVectors(n, Math.abs(n.y) < 0.9 ? YAX : new V3(1, 0, 0)).normalize(),
    w = new V3().crossVectors(n, u);
  const r = {
    s,
    u,
    w,
    om: (Math.PI / 2) * (0.75 + Math.random() * 0.45 + Math.min(0.5, frTime / 240)) * (Math.random() < 0.5 ? 1 : -1),
    th: 0,
    minD: 9,
    ghost: GHOST,
  };
  setGhost(s, 0.5);
  const pp = player.fInit ? player.fp.clone() : posAt(B, new V3());
  let bestTh = 0,
    bestD = -1;
  for (let k = 0; k < 24; k++) {
    const th = (k / 24) * Math.PI * 2;
    if (frHits(r, th, B, 3)) continue;
    const d = frPos(r, th, new V3()).distanceTo(pp);
    if (d > bestD) {
      bestD = d;
      bestTh = th;
    }
  }
  r.th = bestTh;
  s.busy = true;
  s.state = 'ride';
  s.bike.g.visible = true;
  s.trail.visible = true;
  fillTrail(s.trail, frPos(r, r.th, new V3()).multiplyScalar(R - 0.04));
  fr.push(r);
  game.cheer = Math.max(game.cheer, 0.5);
}
function frPredict(B) {
  let best = null;
  const pts = player.fInit ? freeFuture(B, 4, 1 / 8) : null,
    a = new V3(),
    b = new V3();
  for (const r of fr)
    for (let k = r.ghost > 0 ? 33 : 1; k <= 32; k++) {
      const db = k / 8;
      if (pts) a.copy(pts[k - 1]);
      else posAt(B + db, a);
      frPos(r, r.th + r.om * db, b);
      if (a.distanceTo(b) * R < HIT * 1.1) {
        if (!best || db < best.db) best = { r, db, at: a.clone().add(b).multiplyScalar(0.5) };
        break;
      }
    }
  return best;
}
function freeTick(dt, T, B) {
  const dB = Math.max(0, B - frLastB);
  frLastB = B;
  if (B < INTRO) return;
  const P = player;
  const tNow = T - timeAt(INTRO),
    gain = Math.max(0, tNow - frTime);
  frTime = tNow;
  // points only start once the first rider's ghost arrives (the first 10 s are a warm-up)
  // every rider in the globe adds to the multiplier: 1 rider ×2, 2 riders ×3… (shown by the score)
  const mult = fr.length + 1;
  if (mult !== frMultShown) {
    frMultShown = mult;
    const el = document.getElementById('mult');
    if (el) el.textContent = mult > 1 ? '×' + mult : '';
  }
  if (fr.length) {
    game.score += ((gain * 10 * (P.fs || FR_CRUISE)) / FR_CRUISE) * mult;
    if (game.wheelieDown || game.noseDown) game.score += gain * 45 * mult;
  }
  // riders join at 10 s, then after 30 s, 40 s, 50 s… (each wait 10 s longer)
  if (!frWarned && frTime >= frNext - 3 && fr.length < pool.length) {
    frWarned = true;
    const s = pool.find(x => !x.busy);
    if (s) toast(`${s.name} incoming!`, 1800);
  }
  if (frTime >= frNext && fr.length < pool.length) {
    frSpawn(B);
    frWarned = false;
    frNext = frTime + 20 + 10 * fr.length;
  }
  for (const r of fr) {
    if (r.s.state !== 'ride') continue;
    r.th += r.om * dB;
    const s = r.s;
    frPos(r, r.th, _a);
    _b.copy(r.u).multiplyScalar(-Math.sin(r.th)).addScaledVector(r.w, Math.cos(r.th)).multiplyScalar(Math.sign(r.om));
    orientOnWall(s.bike.g, _a, _b, 0);
    arcTrail(s.trail, (i, o) => frPos(r, r.th - Math.sign(r.om) * i * TRAIL_STEP, o));
    s.bike.wheels.forEach(w => (w.rotation.x += dt * 25));
    s.ahead.visible = true;
    arcTrail(s.ahead, (i, o) => frPos(r, r.th + Math.sign(r.om) * i * 0.085, o));
    if (r.ghost > 0) {
      // ghost: no collisions or near misses yet, fades in over the last half second
      r.ghost -= dt;
      setGhost(s, r.ghost > 0 ? 0.5 + 0.5 * clamp(1 - r.ghost / 0.5, 0, 1) : 1);
      continue;
    }
    const dist = _a.distanceTo(P.p) * R;
    if (dist < HIT) {
      if (P.h > 0.4) {
        if (!r.jumped) {
          r.jumped = true;
          game.score += 300 * (fr.length + 1);
          showJudge('p', 'CLEARED!');
          game.cheer = 1;
          crowd.wave();
        }
      } else {
        freeCrash(r);
        return;
      }
    } else r.jumped = false;
    if (dist < 1.9) r.minD = Math.min(r.minD, dist);
    else if (r.minD < 9) {
      if (r.minD < 1.4) {
        frNear++;
        frChain = Math.min(frChain + 1, 9);
        game.score += 100 * frChain * (fr.length + 1);
        showJudge('g', 'NEAR MISS x' + frChain);
        game.cheer = Math.max(game.cheer, 0.8);
        crowd.wave();
      }
      r.minD = 9;
    }
  }
  frPredT -= dt;
  if (frPredT <= 0) {
    frPredT = 0.1;
    frDanger = frPredict(B);
  }
  for (const s of pool) s.mark.visible = false;
  if (frDanger) {
    const m = frDanger.r.s.mark;
    m.visible = true;
    m.position.copy(frDanger.at).multiplyScalar((R - 0.12) / frDanger.at.length());
    m.scale.setScalar(1 + 0.7 * clamp(1 - frDanger.db / 4, 0, 1) + 0.2 * Math.sin(clock * 16));
    m.material.opacity = 0.95;
  }
  $('#vig').style.opacity = frDanger ? (clamp(1 - frDanger.db / 4, 0, 1) * 0.75).toFixed(2) : 0;
}
function freeFall() {
  game.fSlip = 0;
  if (frTime > freeBest) {
    freeBest = frTime;
    try {
      localStorage.setItem('god-free-best', freeBest);
    } catch (e) {}
  }
  frDanger = null;
  gameOver();
  if (game.over) game.over.fell = true;
}
function freeCrash(r) {
  const s = r.s;
  s.state = 'tumble';
  s.cp = s.bike.g.position.clone();
  s.cv = new V3(Math.random() - 0.5, 2, Math.random() - 0.5).multiplyScalar(3);
  s.sa = new V3(1, 0.3, 0.2).normalize();
  s.sw = 10;
  s.ahead.visible = false;
  s.trail.visible = false;
  frDanger = null;
  $('#vig').style.opacity = 0;
  if (frTime > freeBest) {
    freeBest = frTime;
    try {
      localStorage.setItem('god-free-best', freeBest);
    } catch (e) {}
  }
  gameOver();
}
/* free ride: an analog stick. x steers, pull back = throttle (full = wheelie), push forward = brake (full = stoppie) */
const FR_MIN = 1.1,
  FR_CRUISE = 2.5,
  FR_MAX = 4.4;
let fStick = { x: 0, y: 0 };
const fx = () => (game.fTouchPtr != null ? fStick.x : game.fKeys.r - game.fKeys.l),
  fy = () =>
    game.fTouchPtr != null ? fStick.y : game.fKeys.w ? 1 : game.fKeys.n ? -1 : (game.fKeys.d - game.fKeys.u) * 0.5;
function freeStep(P, dt, x, y) {
  P.ft.applyAxisAngle(P.fp, x * 2.3 * dt);
  if (y > 0.72) {
    if (!P.wOn) {
      P.wOn = true;
      P.sOn = false;
      P.base = P.fs;
      P.surge = 0.45;
    }
    P.surge *= Math.pow(0.15, dt);
    P.fs = clamp(P.base + P.surge, FR_MIN, FR_MAX);
  } else if (y < -0.72) {
    if (!P.sOn) {
      P.sOn = true;
      P.wOn = false;
      P.base = P.fs;
      P.surge = -0.45;
    }
    P.surge *= Math.pow(0.15, dt);
    P.fs = clamp(P.base + P.surge, FR_MIN, FR_MAX);
  } else {
    P.wOn = P.sOn = false;
    const a = Math.abs(y);
    if (a > 0.12) P.fs = clamp(P.fs + ((Math.sign(y) * (a - 0.12)) / 0.6) * (y > 0 ? 1.8 : 2.6) * dt, FR_MIN, FR_MAX);
  }
  const ax = _o2.crossVectors(P.fp, P.ft).normalize();
  P.fp.applyAxisAngle(ax, P.fs * dt).normalize();
  P.ft.applyAxisAngle(ax, P.fs * dt);
  P.ft.addScaledVector(P.fp, -P.ft.dot(P.fp)).normalize();
}
function freeFuture(B, beats, step) {
  const spb = 60 / game.tempos[game.tempos.length - 1].bpm,
    P = player,
    o = { fp: P.fp.clone(), ft: P.ft.clone(), fs: P.fs, wOn: P.wOn, sOn: P.sOn, base: P.base, surge: P.surge },
    pts = [],
    x = fx(),
    y = fy();
  for (let k = 1; k <= beats / step; k++) {
    freeStep(o, step * spb, x, y);
    pts.push(o.fp.clone());
  }
  return pts;
}
function dirDelta(t) {
  return [
    t === 'up' || t === 'ul' || t === 'ur' ? 15 : t === 'down' || t === 'dl' || t === 'dr' ? -15 : 0,
    t === 'left' || t === 'ul' || t === 'dl' ? 20 : t === 'right' || t === 'ur' || t === 'dr' ? -20 : 0,
  ];
}
function setCross(n) {
  const M = posAt(n.beat, new V3()),
    tM = tanAt(n.beat, new V3()),
    sg = n.sg || (n.sg = Math.random() < 0.5 ? -1 : 1),
    al = (n.al || (n.al = 65 + Math.random() * 50)) * D * sg;
  const c = tM.clone().applyAxisAngle(M, al);
  n.M = M;
  n.c = c;
  n.A = new V3().crossVectors(M, c).normalize();
  n.w = (Math.PI / 2) * 1.2;
}
function freeSteer(type, t) {
  addTurn(beatAt(t), type);
  for (const n of game.notes) if (n.type === 'jump' && !n.slot && !n.judged) setCross(n);
}

export function initFreeride() {
  try {
    freeBest = +localStorage.getItem('god-free-best') || 0;
  } catch (e) {}
  game.fSlip = 0;
  game.fKeys = { l: 0, r: 0, u: 0, d: 0 };
  game.fTouchPtr = null;
  /* steering off the script (show mode) */
  game.userOff = [];
}

export {
  FR_CRUISE,
  FR_MIN,
  fStick,
  fmtT,
  fr,
  frNear,
  frTime,
  freeBest,
  freeFall,
  freeReset,
  setGhost,
  freeSteer,
  freeStep,
  freeTick,
  fx,
  fy,
  setCross,
};
