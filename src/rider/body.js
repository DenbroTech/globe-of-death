import * as THREE from 'three';
import { V3 } from '../core/constants.js';

/* ---------- anatomical body: continuous skins instead of separate capsules ----------
   The old rider was an "action figure": each body part its own rounded capsule, overlapped at the joints.
   Here the torso is ONE skin from crotch to neck, and each limb is ONE skin swept along a centre line that
   curves through the joint, with a cross-section that follows the anatomy (deltoid, biceps, elbow point,
   forearm belly, wrist / quad, kneecap, calf, ankle). Protection is moulded into the suit as low raised
   panels (`patch`), not balls stuck on.

   A ring is { c, X, Z, T, rx, rf, rb, n, s }: centre, side axis, front axis, tangent, half-width, depth to the
   front / back, superellipse exponent, and its position along the part (0..1). */

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => {
  x = cl((x - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/* smooth (Catmull-Rom) lookup in a table of rows [s, v1, v2, …] */
function table(rows) {
  return s => {
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1][0] < s) i++;
    const p1 = rows[i],
      p2 = rows[i + 1],
      p0 = rows[Math.max(0, i - 1)],
      p3 = rows[Math.min(rows.length - 1, i + 2)],
      u = cl((s - p1[0]) / (p2[0] - p1[0] || 1));
    return p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u * u * u));
  };
}
const ringPoint = (r, th, lift = 0, out = new V3()) => {
  const cs = Math.cos(th),
    sn = Math.sin(th),
    e = 2 / (r.n || 2),
    px = (r.rx + lift) * Math.sign(cs) * Math.pow(Math.abs(cs), e),
    pz = ((sn >= 0 ? r.rf : r.rb) + lift) * Math.sign(sn) * Math.pow(Math.abs(sn), e);
  return out.copy(r.c).addScaledVector(r.X, px).addScaledVector(r.Z, pz);
};
/* the way a strip of the surface faces (used for colour panels: constant along the part, so seams run straight) */
const ringDir = (r, th, out = new V3()) => out.copy(r.X).multiplyScalar(Math.cos(th)).addScaledVector(r.Z, Math.sin(th));

/* skin: a smooth-shaded surface through a list of rings.
   colorAt(s, th, ring) → THREE.Color-like or grey number. flat = one colour per quad (crisp panel edges).
   chevAt(s, th, ring) → [a, b, c, d] optional per-vertex data (the torso's drawn chevron). */
function skin(rings, seg, { colorAt = null, flat = true, capA = false, capB = false, chevAt = null, lift = 0, th0 = 0, th1 = Math.PI * 2 } = {}) {
  const R = rings.length,
    full = th1 - th0 >= Math.PI * 2 - 1e-6,
    cols = full ? seg : seg + 1,
    P = new Float32Array(R * cols * 3),
    v = new V3(),
    ths = [];
  for (let j = 0; j < cols; j++) ths.push(th0 + ((th1 - th0) * j) / seg);
  for (let i = 0; i < R; i++)
    for (let j = 0; j < cols; j++) {
      const lf = typeof lift === 'function' ? lift(rings[i].s, ths[j], i / (R - 1), j / seg) : lift;
      ringPoint(rings[i], ths[j], lf, v);
      P.set([v.x, v.y, v.z], (i * cols + j) * 3);
    }
  const idx = [],
    quads = [];
  for (let i = 0; i < R - 1; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j,
        b = i * cols + ((j + 1) % cols),
        c = a + cols,
        d = b + cols;
      quads.push([a, b, c, d, i, j]);
    }
  // which way round is "outside"? test one quad against its ring centre
  const q0 = quads[Math.floor(quads.length / 2)],
    pa = new V3().fromArray(P, q0[0] * 3),
    pb = new V3().fromArray(P, q0[1] * 3),
    pc = new V3().fromArray(P, q0[2] * 3),
    nrm = pb.clone().sub(pa).cross(pc.clone().sub(pa)),
    flip = nrm.dot(pa.clone().sub(rings[q0[4]].c)) < 0;
  quads.forEach(([a, b, c, d]) => (flip ? idx.push(a, c, b, b, c, d) : idx.push(a, b, c, b, d, c)));
  const gi = new THREE.BufferGeometry();
  gi.setAttribute('position', new THREE.BufferAttribute(P, 3));
  gi.setIndex(idx);
  gi.computeVertexNormals();
  const N = gi.attributes.normal.array,
    pos = [],
    nor = [],
    colr = [],
    chev = chevAt ? [] : null,
    put = (vi, c, i, j) => {
      pos.push(P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]);
      nor.push(N[vi * 3], N[vi * 3 + 1], N[vi * 3 + 2]);
      if (colorAt) typeof c === 'number' ? colr.push(c, c, c) : colr.push(c.r, c.g, c.b);
      if (chev) chev.push(...chevAt(rings[i].s, ths[j % cols] ?? ths[0], rings[i]));
    };
  quads.forEach(([a, b, c, d, i, j]) => {
    const thA = ths[j],
      thB = ths[(j + 1) % cols] + (full && j + 1 === cols ? 0 : 0),
      thM = th0 + ((th1 - th0) * (j + 0.5)) / seg,
      sM = (rings[i].s + rings[i + 1].s) / 2;
    let cq = null;
    if (colorAt && flat) cq = colorAt(sM, thM, rings[i]);
    const C = (ii, th) => (flat ? cq : colorAt ? colorAt(rings[ii].s, th, rings[ii]) : null);
    const va = [a, C(i, thA), i, j],
      vb = [b, C(i, thB), i, j + 1],
      vc = [c, C(i + 1, thA), i + 1, j],
      vd = [d, C(i + 1, thB), i + 1, j + 1];
    (flip ? [va, vc, vb, vb, vc, vd] : [va, vb, vc, vb, vd, vc]).forEach(x => put(...x));
  });
  // end caps (a fan to the ring's centre)
  [
    [capA, 0],
    [capB, R - 1],
  ].forEach(([on, i], e) => {
    if (!on) return;
    const r = rings[i],
      nn = r.T.clone().multiplyScalar(e ? 1 : -1),
      c = colorAt ? colorAt(r.s, 0, r) : null;
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j,
        b = i * cols + ((j + 1) % cols),
        tri = (e ? !flip : flip) ? [a, b] : [b, a];
      [tri[0], tri[1]].forEach(vi => put(vi, c, i, j));
      pos.push(r.c.x, r.c.y, r.c.z);
      nor.push(nn.x, nn.y, nn.z);
      if (colorAt) typeof c === 'number' ? colr.push(c, c, c) : colr.push(c.r, c.g, c.b);
      if (chev) chev.push(0, 0, 0, 0);
    }
  });
  gi.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  if (chev) g.setAttribute('chev', new THREE.Float32BufferAttribute(chev, 4));
  return g;
}

/* a limb: one centre line through a joint (A → B → C), curving round B instead of meeting at a ball.
   zSign = +1: the ring's front (Z) is the inside of the bend (arm: biceps / crease side);
   zSign = −1: the front is the outside of the bend (leg: kneecap side). `hint` is used when it's straight. */
function limb(A, B, C, hint, zSign, sect) {
  const d1 = B.clone().sub(A),
    d2 = C.clone().sub(B),
    Lu = d1.length(),
    Ll = d2.length();
  d1.normalize();
  d2.normalize();
  const bend = Math.acos(cl(d1.dot(d2), -1, 1)),
    inner = A.clone().sub(B).normalize().add(C.clone().sub(B).normalize()),
    il = inner.length(),
    Zb = hint.clone().normalize();
  if (il > 1e-4) Zb.lerp(inner.multiplyScalar(zSign / il), sstep(0.12, 0.6, il)).normalize();
  const k = Math.min(0.3 * Math.min(Lu, Ll), 0.02 + 0.055 * sstep(0, 1.2, bend)),
    P0 = B.clone().addScaledVector(d1, -k),
    P2 = B.clone().addScaledVector(d2, k),
    L1 = Lu - k,
    L2 = Ll - k,
    bez = u => P0.clone().multiplyScalar((1 - u) * (1 - u)).addScaledVector(B, 2 * u * (1 - u)).addScaledVector(P2, u * u),
    bezT = u => B.clone().sub(P0).multiplyScalar(2 * (1 - u)).addScaledVector(P2.clone().sub(B), 2 * u).normalize();
  let Lb = 0;
  for (let i = 0, p = P0; i < 8; i++) {
    const q = bez((i + 1) / 8);
    Lb += p.distanceTo(q);
    p = q;
  }
  const half = L1 + Lb / 2,
    rest = Lb / 2 + L2,
    S = table(sect);
  const ring = s => {
    const a = s <= 0.5 ? (s / 0.5) * half : half + ((s - 0.5) / 0.5) * rest;
    let c, T;
    if (a < L1) {
      c = A.clone().addScaledVector(d1, a);
      T = d1.clone();
    } else if (a > L1 + Lb) {
      c = P2.clone().addScaledVector(d2, a - L1 - Lb);
      T = d2.clone();
    } else {
      const u = (a - L1) / (Lb || 1);
      c = bez(u);
      T = bezT(u);
    }
    const Z = Zb.clone().addScaledVector(T, -Zb.dot(T)).normalize(),
      X = new V3().crossVectors(T, Z).normalize(),
      [, rx, rf, rb] = S(s);
    return { c, T, X, Z, rx, rf, rb, n: 2.15, s };
  };
  return {
    ring,
    rings: (n, s0 = 0, s1 = 1) => Array.from({ length: n }, (_, i) => ring(s0 + ((s1 - s0) * i) / (n - 1))),
    /* the angle round the limb that faces world direction `dir`, measured at position s */
    angleOf(dir, s = 0.25) {
      const r = ring(s);
      return Math.atan2(dir.dot(r.Z), dir.dot(r.X));
    },
    point(s, th, lift = 0) {
      return ringPoint(ring(s), th, lift);
    },
  };
}

/* patch: a low moulded panel (armour) raised out of a limb's surface between s0..s1 and th0..th1, its edges
   melting back into the suit. */
function patch(lb, s0, s1, thC, thW, lift, colorAt, ns = 10, nt = 8) {
  const rings = lb.rings(ns, s0, s1);
  return skin(rings, nt, {
    th0: thC - thW,
    th1: thC + thW,
    colorAt,
    flat: true,
    lift: (s, th, u, v) => 0.0015 + lift * Math.pow(Math.sin(Math.PI * cl(u)), 0.45) * Math.pow(Math.sin(Math.PI * cl(v)), 0.45),
  });
}

/* ---- anatomy tables (metres; an adult about 1.8 m in fitted leathers) ---- */
// arm: [s, half-width, inside of the bend (biceps / flexors), outside (triceps / elbow point)]
const ARM = [
  [0.0, 0.048, 0.048, 0.052],
  [0.08, 0.055, 0.052, 0.056],
  [0.22, 0.048, 0.052, 0.049],
  [0.4, 0.041, 0.042, 0.043],
  [0.5, 0.04, 0.037, 0.046],
  [0.6, 0.043, 0.045, 0.042],
  [0.8, 0.035, 0.035, 0.033],
  [0.94, 0.029, 0.027, 0.027],
  [1.0, 0.028, 0.025, 0.026],
];
// leg: [s, half-width, front (quad / kneecap / shin), back (hamstring / calf)]
const LEG = [
  [0.0, 0.074, 0.082, 0.088],
  [0.08, 0.084, 0.09, 0.094],
  [0.25, 0.078, 0.086, 0.082],
  [0.42, 0.06, 0.066, 0.06],
  [0.5, 0.054, 0.06, 0.052],
  [0.58, 0.052, 0.05, 0.06],
  [0.68, 0.052, 0.046, 0.068],
  [0.85, 0.04, 0.04, 0.044],
  [1.0, 0.036, 0.038, 0.038],
];
// torso: [q = height along the spine as a fraction of hip→neck, half-width, depth front, depth back, exponent]
const TORSO = [
  [-0.22, 0.045, 0.05, 0.06, 2.0],
  [-0.15, 0.124, 0.086, 0.102, 2.15],
  [-0.05, 0.16, 0.096, 0.116, 2.2],
  [0.08, 0.158, 0.1, 0.106, 2.2],
  [0.25, 0.134, 0.09, 0.088, 2.15],
  [0.42, 0.152, 0.104, 0.096, 2.2],
  [0.6, 0.182, 0.122, 0.108, 2.25],
  [0.74, 0.2, 0.114, 0.112, 2.25],
  [0.83, 0.192, 0.094, 0.102, 2.15],
  [0.9, 0.136, 0.078, 0.088, 2.05],
  [0.97, 0.07, 0.06, 0.066, 2.0],
  [1.06, 0.058, 0.055, 0.058, 2.0],
];

function torsoRings(H, N, f, n = 34) {
  const u = N.clone().sub(H).normalize(),
    L = H.distanceTo(N),
    X = new V3().crossVectors(u, f).normalize(),
    S = table(TORSO),
    out = [];
  for (let i = 0; i < n; i++) {
    const q = -0.22 + (1.28 * i) / (n - 1),
      [, w, dF, dB, e] = S(q);
    out.push({ c: H.clone().addScaledVector(u, q * L), T: u, X, Z: f, rx: w, rf: dF, rb: dB, n: e, s: q });
  }
  return { rings: out, u, L, X };
}

export { ARM, LEG, limb, patch, ringDir, ringPoint, skin, sstep, torsoRings };
