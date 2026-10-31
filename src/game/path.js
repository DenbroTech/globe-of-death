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
function rebakeTurns(from) {
  for (let i = from; i < game.turns.length; i++) {
    const t = game.turns[i],
      prev = i ? game.turns[i - 1].C : IDQ;
    t.ax = baseAt(t.beat, new V3()).applyQuaternion(prev).normalize();
    t.C = new THREE.Quaternion().setFromAxisAngle(t.ax, t.rad).multiply(prev);
  }
}
function addTurn(beat, type) {
  const deg = TURN_ANG[type];
  if (!deg) return;
  beat = Math.max(beat, INTRO);
  const t = { beat, deg, rad: deg * D };
  let k = game.turns.length;
  while (k > 0 && game.turns[k - 1].beat > beat) k--;
  game.turns.splice(k, 0, t);
  rebakeTurns(k);
}
function qAt(B, out) {
  let m = game.turns.length - 1;
  while (m >= 0 && game.turns[m].beat > B) m--;
  let j = m;
  while (j >= 0 && B - game.turns[j].beat < 1) j--;
  out.copy(j >= 0 ? game.turns[j].C : IDQ);
  for (let i = j + 1; i <= m; i++) {
    const t = game.turns[i];
    out.premultiply(_q1.setFromAxisAngle(t.ax, t.rad * smooth(clamp(B - t.beat, 0, 1))));
  }
  return out;
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
