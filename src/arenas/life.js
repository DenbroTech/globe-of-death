import * as THREE from 'three';
import { V3 } from '../core/constants.js';

/* ---------- arena life: things that move in every arena ---------- */
function mkBursts(g, N = 900, size = 0.45) {
  const pos = new Float32Array(N * 3),
    col = new Float32Array(N * 3),
    P = [];
  for (let i = 0; i < N; i++) P.push({ life: 0, vx: 0, vy: 0, vz: 0, c: [0, 0, 0], fade: 0.7, gr: 4 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  pts.frustumCulled = false;
  g.add(pts);
  let head = 0,
    live = 0;
  const c = new THREE.Color(),
    v = new V3();
  return {
    burst(x, y, z, hex, n = 70, sp = 6, o = {}) {
      for (let k = 0; k < n; k++) {
        const p = P[head],
          i = head;
        head = (head + 1) % N;
        c.setHex(Array.isArray(hex) ? hex[k % hex.length] : hex);
        v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(sp * (0.55 + Math.random() * 0.45));
        if (o.up) v.y = Math.abs(v.y) * o.up;
        p.vx = v.x;
        p.vy = v.y;
        p.vz = v.z;
        p.life = 1;
        p.fade = o.fade || 0.7;
        p.gr = o.gr ?? 4;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        p.c = [c.r, c.g, c.b];
      }
      live = 3;
    },
    tick(dt) {
      if (live <= 0) return;
      let any = false;
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (p.life <= 0) continue;
        any = true;
        p.life -= dt * p.fade;
        p.vy -= p.gr * dt;
        const d = Math.pow(0.4, dt);
        p.vx *= d;
        p.vy *= d;
        p.vz *= d;
        pos[i * 3] += p.vx * dt;
        pos[i * 3 + 1] += p.vy * dt;
        pos[i * 3 + 2] += p.vz * dt;
        const l = Math.max(0, p.life);
        col[i * 3] = p.c[0] * l;
        col[i * 3 + 1] = p.c[1] * l;
        col[i * 3 + 2] = p.c[2] * l;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      if (!any) live -= 1;
    },
  };
}
function mkBird(col = 0xffffff, s = 1) {
  const b = new THREE.Group(),
    m = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }),
    wg = new THREE.BufferGeometry();
  wg.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, -0.22 * s, 0, 0, 0.22 * s, 0.95 * s, 0, -0.05 * s]), 3),
  );
  wg.computeVertexNormals();
  const L = new THREE.Mesh(wg, m),
    Rw = new THREE.Mesh(wg, m);
  Rw.scale.x = -1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.6 * s, 5), m);
  body.rotation.x = Math.PI / 2;
  b.add(L, Rw, body);
  b.wings = [L, Rw];
  return b;
}
function flyRound(o, t, r, h, w, ph, bob = 0.6) {
  const a = t * w + ph;
  o.position.set(Math.cos(a) * r, h + Math.sin(t * 0.7 + ph) * bob, Math.sin(a) * r);
  o.lookAt(Math.cos(a + 0.05 * Math.sign(w)) * r, o.position.y, Math.sin(a + 0.05 * Math.sign(w)) * r);
}
const rand = (a, b) => a + Math.random() * (b - a);
function clock2() {
  let last = null;
  return t => {
    const d = last == null ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    return d;
  };
}

export { clock2, flyRound, mkBird, mkBursts, rand };
