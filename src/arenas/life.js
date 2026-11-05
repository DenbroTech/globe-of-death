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
/* a jointed wing for one side: an arm panel (shoulder -> wrist) and a swept hand panel hinged at the wrist.
   Built pointing along +x in the x/z plane, leading edge toward +z. Returns { root, sh, wr }. */
function wingGeo(pts) {
  const g = new THREE.BufferGeometry(),
    v = [];
  for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
function mkWing(m, { span = 1, chord = 0.3, arm = 0.45, sweep = 0.35, mirror = false } = {}) {
  const root = new THREE.Group(),
    sh = new THREE.Group(),
    wr = new THREE.Group();
  const A = span * arm,
    H = span - A;
  sh.add(new THREE.Mesh(wingGeo([[0, 0, chord * 0.6], [A, 0, chord * 0.45], [A, 0, -chord * 0.5], [0, 0, -chord * 0.7]]), m));
  wr.position.x = A;
  // the hand: tapered and swept back to a pointed tip
  wr.add(new THREE.Mesh(wingGeo([[0, 0, chord * 0.45], [H * 0.55, 0, chord * 0.3], [H, 0, -sweep * H], [H * 0.6, 0, -chord * 0.75], [0, 0, -chord * 0.5]]), m));
  sh.add(wr);
  root.add(sh);
  if (mirror) root.scale.x = -1;
  return { root, sh, wr };
}
/* flap a pair of jointed wings: p = phase (radians), amp = stroke size. The downstroke is quicker than the
   upstroke, the hand lags the arm, and on the upstroke the hand folds back (like a real wing beat). */
function flap(o, p, amp = 0.7) {
  const W = o.wings || (o.userData && o.userData.wings);
  if (!W) return;
  const q = p + 0.45 * Math.cos(p), // skewed: faster down, slower up
    shoulder = Math.sin(q) * amp + amp * 0.15,
    hand = Math.sin(q - 0.9) * amp * 0.8,
    fold = Math.max(0, Math.cos(q)) * 0.55; // upstroke: tuck the hand back
  W.forEach(w => {
    if (!w.sh) {
      // a plain one-piece wing
      w.rotation.z = shoulder * (w.scale.x < 0 ? -1 : 1);
      return;
    }
    w.sh.rotation.z = shoulder;
    w.wr.rotation.z = hand - shoulder * 0.35;
    w.wr.rotation.y = fold;
  });
}
function mkBird(col = 0xffffff, s = 1) {
  const b = new THREE.Group(),
    m = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
  const L = mkWing(m, { span: 0.95 * s, chord: 0.24 * s }),
    Rw = mkWing(m, { span: 0.95 * s, chord: 0.24 * s, mirror: true });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.6 * s, 5), m);
  body.rotation.x = Math.PI / 2;
  // a little fanned tail
  const tail = new THREE.Mesh(wingGeo([[0, 0, -0.2 * s], [0.09 * s, 0, -0.42 * s], [-0.09 * s, 0, -0.42 * s]]), m);
  b.add(L.root, Rw.root, body, tail);
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

export { clock2, flap, flyRound, mkBird, mkBursts, mkWing, rand };
