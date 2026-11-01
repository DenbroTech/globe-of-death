import * as THREE from 'three';
import { game } from '../core/state.js';
import { _M } from '../render/trails.js';
import { INTRO } from '../audio/clock.js';
import { D, R, V3, YAX, clamp } from '../core/constants.js';

let _o1, _o2, _o3;

/* ---------- your path is a pure function of the beat ---------- */
const TH0 = 0,
  smooth = x => x * x * (3 - 2 * x);
const _pose = { tilt: 0, yaw: 0 };
const IDQ = new THREE.Quaternion(),
  _q1 = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion();
const TURN_ANG = { left: 30, ul: 15, dl: 50, right: -30, ur: -15, dr: -50 };
const baseAt = (B, out) => {
  const th = TH0 + (Math.PI / 2) * B;
  return out.set(Math.sin(th), 0, Math.cos(th));
};
/* The bike's frame Q(B) (Z = where it is on the sphere, Y = its loop's axis) turns at a body-frame rate
   (0, pi/2, wh): pi/2 per beat round the loop plus a heading rate wh about its own position. Between
   turns wh = 0, so it runs dead straight round a great circle; a turn spreads its angle over one beat
   (smoothstep, K constant-rate slices), so each slice is an exact constant-curvature arc: no wobble. */
const K = 12,
  WF = Math.PI / 2,
  _ax = new V3(),
  _qr = new THREE.Quaternion(),
  _qy = new THREE.Quaternion();
let knots = [],
  bakedFor = null,
  bakedN = -1;
function rebakeTurns() {
  const ev = [];
  for (const t of game.turns)
    for (let k = 0; k < K; k++) {
      const w = t.rad * (smooth((k + 1) / K) - smooth(k / K)) * K;
      ev.push([t.beat + k / K, w], [t.beat + (k + 1) / K, -w]);
    }
  ev.sort((a, b) => a[0] - b[0]);
  knots = [];
  let wh = 0;
  for (const [beat, dw] of ev) {
    const last = knots[knots.length - 1];
    if (last && beat - last.beat < 1e-6) {
      last.wh = wh += dw;
      continue;
    }
    const Q = last ? advance(last, beat, new THREE.Quaternion()) : new THREE.Quaternion().setFromAxisAngle(YAX, WF * beat);
    wh += dw;
    knots.push({ beat, Q, wh });
  }
  for (const k of knots) if (Math.abs(k.wh) < 1e-9) k.wh = 0;
  bakedFor = game.turns;
  bakedN = game.turns.length;
}
function advance(k, B, out) {
  const dt = B - k.beat;
  _ax.set(0, WF, k.wh);
  const w = _ax.length();
  return out.copy(k.Q).multiply(_qr.setFromAxisAngle(_ax.divideScalar(w), w * dt));
}
function addTurn(beat, type) {
  const deg = TURN_ANG[type];
  if (!deg) return;
  beat = Math.max(beat, INTRO);
  const t = { beat, deg, rad: deg * D };
  let k = game.turns.length;
  while (k > 0 && game.turns[k - 1].beat > beat) k--;
  game.turns.splice(k, 0, t);
  bakedN = -1;
}
// C(B): the rotation applied to the plain starting loop, so posAt = C · baseAt
function qAt(B, out) {
  if (bakedFor !== game.turns || bakedN !== game.turns.length) rebakeTurns();
  let lo = 0,
    hi = knots.length - 1;
  if (hi < 0 || B < knots[0].beat) return out.identity();
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (knots[m].beat <= B) lo = m;
    else hi = m - 1;
  }
  advance(knots[lo], B, out);
  return out.multiply(_qy.setFromAxisAngle(YAX, -WF * B));
}
function turnRate(B) {
  let r = 0;
  for (let i = game.turns.length - 1; i >= 0 && game.turns[i].beat > B - 1.2; i--) {
    const t = game.turns[i];
    r += (t.deg * (smooth(clamp(B - t.beat, 0, 1)) - smooth(clamp(B - 0.12 - t.beat, 0, 1)))) / 0.12;
  }
  return r;
}
const normalAt = (B, out) => out.set(0, 1, 0).applyQuaternion(qAt(B, _q2));
function poseAt(B, o) {
  o.tilt = 0;
  o.yaw = 0;
  return o;
}
function posAt(B, out) {
  const th = TH0 + (Math.PI / 2) * B;
  if (B < INTRO) {
    const f = -84 * (1 - smooth(clamp(B / INTRO, 0, 1))) * D;
    return out.set(Math.cos(f) * Math.sin(th), Math.sin(f), Math.cos(f) * Math.cos(th));
  }
  return baseAt(B, out).applyQuaternion(qAt(B, _q2));
}
function tanAt(B, out) {
  posAt(B + 0.02, out);
  return out.sub(posAt(B, _o3)).normalize();
}
function orientOnWall(obj, p, t, roll) {
  const up = _o1.copy(p).negate(),
    side = _o2.crossVectors(up, t);
  _M.makeBasis(side, up, t);
  obj.quaternion.setFromRotationMatrix(_M);
  if (roll) obj.rotateZ(roll);
  obj.position.copy(p).multiplyScalar(R);
}
const loopNormal = (tilt, yaw, out) => out.set(0, Math.cos(tilt * D), Math.sin(tilt * D)).applyAxisAngle(YAX, yaw * D);

export function initPath() {
  game.posePlan = [];
  game.FREE = false;
  game.gameMode = 'show';
  try {
    if (localStorage.getItem('god-mode') === 'free') game.gameMode = 'free';
  } catch (e) {}
  game.turns = [];
  _o1 = new V3();
  _o2 = new V3();
  _o3 = new V3();
}

export { _o2, addTurn, normalAt, orientOnWall, posAt, tanAt, turnRate };
