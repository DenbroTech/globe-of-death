import * as THREE from 'three';
import { glowTex } from './textures.js';
import { globe } from '../arenas/globe.js';
import { D, R, V3, YAX } from '../core/constants.js';

let _a, _b, _c, _p, _t, ZAX;

const _M = new THREE.Matrix4();
/* Every rider (you included) rides a great-circle loop. tilt 0 = flat ring round the middle, 90 = vertical loop.
   Changing tilt hinges the loop about a horizontal axis set by yaw, so the bike slides smoothly to the new loop. */
function setOrbit(b) {
  const a = b.tilt * D,
    y = b.yaw * D;
  const n = new V3(0, Math.cos(a), Math.sin(a)).applyAxisAngle(YAX, y),
    down = new V3(0, -1, 0);
  const u = down.clone().addScaledVector(n, -down.dot(n));
  if (u.lengthSq() < 1e-6) u.set(Math.sin(y), 0, Math.cos(y));
  u.normalize();
  b.n = n;
  b.u = u;
  b.w = new V3().crossVectors(n, u).multiplyScalar(b.dir);
}
function orbitPoint(b, th, p, t) {
  const c = Math.cos(th),
    s = Math.sin(th);
  p.copy(b.u).multiplyScalar(c).addScaledVector(b.w, s);
  if (t) t.copy(b.u).multiplyScalar(-s).addScaledVector(b.w, c);
}
const TRAIL = 22;
function makeTrail(hex) {
  const pos = new Float32Array(TRAIL * 3),
    col = new Float32Array(TRAIL * 3),
    c = new THREE.Color(hex);
  for (let i = 0; i < TRAIL; i++) {
    const f = Math.pow(1 - i / TRAIL, 1.6);
    col[i * 3] = c.r * f;
    col[i * 3 + 1] = c.g * f;
    col[i * 3 + 2] = c.b * f;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const l = new THREE.Line(
    g,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  l.frustumCulled = false;
  l.visible = false;
  globe.add(l);
  return l;
}
function fillTrail(l, pos) {
  const a = l.geometry.attributes.position;
  for (let i = 0; i < TRAIL; i++) a.setXYZ(i, pos.x, pos.y, pos.z);
  a.needsUpdate = true;
}
/* trail computed from the rider's own path: f(i, out) puts the unit position i steps behind into out,
   so it always lies on the wall right behind the rider, whatever the frame rate */
const TRAIL_STEP = 0.04;
function arcTrail(l, f) {
  const a = l.geometry.attributes.position;
  for (let i = 0; i < TRAIL; i++) {
    f(i, _p);
    _p.multiplyScalar(R - 0.04);
    a.setXYZ(i, _p.x, _p.y, _p.z);
  }
  a.needsUpdate = true;
}
function pushTrail(l, pos) {
  const a = l.geometry.attributes.position,
    arr = a.array;
  arr.copyWithin(3, 0, (TRAIL - 1) * 3);
  arr[0] = pos.x;
  arr[1] = pos.y;
  arr[2] = pos.z;
  a.needsUpdate = true;
}
/* the path you've ridden, painted on the inside of the globe: a ribbon that only ever runs back from
   the bike (points are dropped every few degrees of travel, the head follows the bike every frame) */
const RIB = 140,
  RIB_STEP = 0.03;
function makeRibbon(hex, width, opacity) {
  const pos = new Float32Array(RIB * 2 * 3),
    col = new Float32Array(RIB * 2 * 3),
    c = new THREE.Color(hex),
    idx = [];
  for (let i = 0; i < RIB; i++) {
    const f = Math.pow(1 - i / (RIB - 1), 1.3);
    for (let k = 0; k < 2; k++) col.set([c.r * f, c.g * f, c.b * f], (i * 2 + k) * 3);
    if (i < RIB - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  m.frustumCulled = false;
  m.renderOrder = 2;
  m.visible = false;
  m.userData = { pts: [], w: width };
  globe.add(m);
  return m;
}
function resetRibbon(rb, p) {
  rb.userData.pts = [p.clone().normalize(), p.clone().normalize()];
  drawRibbon(rb);
}
function pushRibbon(rb, p) {
  const P = rb.userData.pts;
  if (!P.length) return resetRibbon(rb, p);
  P[0].copy(p).normalize();
  if (P[0].angleTo(P[1]) > RIB_STEP) {
    P.unshift(P[0].clone());
    if (P.length > RIB) P.length = RIB;
  }
  drawRibbon(rb);
}
function drawRibbon(rb) {
  const P = rb.userData.pts,
    a = rb.geometry.attributes.position,
    w = rb.userData.w;
  for (let i = 0; i < RIB; i++) {
    const j = Math.min(i, P.length - 1),
      p = P[j],
      q0 = P[Math.max(0, j - 1)],
      q1 = P[Math.min(P.length - 1, j + 1)];
    _t.subVectors(q0, q1);
    _p.crossVectors(p, _t);
    if (_p.lengthSq() < 1e-12) _p.set(0, 0, 0);
    else _p.normalize().multiplyScalar(w * (i >= P.length ? 0 : 1));
    const r = R - 0.03;
    a.setXYZ(i * 2, p.x * r + _p.x, p.y * r + _p.y, p.z * r + _p.z);
    a.setXYZ(i * 2 + 1, p.x * r - _p.x, p.y * r - _p.y, p.z * r - _p.z);
  }
  a.needsUpdate = true;
}
/* loop rings painted on the inside of the globe */
function makeRing(hex, tube, opacity, glow) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(R - 0.025, tube, 6, 160),
    new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  m.renderOrder = 2;
  globe.add(m);
  return m;
}
function aimRing(ring, n) {
  ring.quaternion.setFromUnitVectors(ZAX, n);
}
const glowSprite = (hex, scale) => {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: hex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    }),
  );
  s.scale.setScalar(scale);
  s.renderOrder = 3;
  return s;
};

export function initTrails() {
  _a = new V3();
  _b = new V3();
  _c = new V3();
  _p = new V3();
  _t = new V3();
  ZAX = new V3(0, 0, 1);
}

export { TRAIL_STEP, _M, _a, _b, _c, aimRing, arcTrail, fillTrail, glowSprite, makeRibbon, makeRing, makeTrail, pushRibbon, pushTrail, resetRibbon };
