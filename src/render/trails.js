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
function pushTrail(l, pos) {
  const a = l.geometry.attributes.position,
    arr = a.array;
  arr.copyWithin(3, 0, (TRAIL - 1) * 3);
  arr[0] = pos.x;
  arr[1] = pos.y;
  arr[2] = pos.z;
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

export { _M, _a, _b, _c, aimRing, fillTrail, glowSprite, makeRing, makeTrail, pushTrail };
