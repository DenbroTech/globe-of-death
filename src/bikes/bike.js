import * as THREE from 'three';
import { cv, glowTex, tex } from '../render/textures.js';
import { neonify } from '../render/neon.js';
import { RIDER_GLTF, buildRiderModel, riderWaiting } from '../rider/riderModel.js';
import { V3, YAX } from '../core/constants.js';
import { applyFinish, deep } from './finishes.js';
import { findItem } from './catalog.js';
import { envify } from '../render/envmap.js';
import { buildRider } from '../rider/rider.js';

let _bv1, _bv2;

/* ---------- bikes v2: built like real bikes (frame, engine, controls), then merged per material ---------- */
const BSPEC = {
  classic: {
    rf: 0.3,
    tf: 0.075,
    rr: 0.3,
    tr: 0.085,
    zf: 0.57,
    zr: -0.55,
    head: [0.84, 0.34],
    bar: [0.95, 0.27, 0.33],
    seat: [0.7, -0.24],
    pivot: [0.34, -0.12],
    peg: [0.3, -0.06],
    eng: 'twin',
    E: [0.36, 0.04],
    frame: 'cradle',
    spokes: 36,
    tank: [
      [-0.02, 0.7],
      [0.02, 0.79],
      [0.14, 0.86],
      [0.3, 0.86],
      [0.39, 0.79],
      [0.36, 0.71],
      [0.2, 0.69],
    ],
    tankW: 0.27,
    seatP: [
      [-0.04, 0.7],
      [-0.08, 0.76],
      [-0.3, 0.76],
      [-0.52, 0.73],
      [-0.56, 0.69],
      [-0.3, 0.68],
    ],
    seatW: 0.24,
    ex: 'low',
    fend: 'both',
    light: 'round',
    lean: 0.5,
  },
  vintage: {
    rf: 0.33,
    tf: 0.055,
    rr: 0.33,
    tr: 0.06,
    zf: 0.58,
    zr: -0.55,
    head: [0.86, 0.33],
    bar: [0.97, 0.25, 0.34],
    seat: [0.72, -0.2],
    pivot: [0.36, -0.12],
    peg: [0.3, -0.05],
    eng: 'single',
    E: [0.37, 0.03],
    frame: 'cradle',
    spokes: 40,
    tank: [
      [0, 0.72],
      [0.03, 0.81],
      [0.16, 0.87],
      [0.32, 0.86],
      [0.38, 0.79],
      [0.34, 0.72],
      [0.18, 0.7],
    ],
    tankW: 0.25,
    seatP: [
      [-0.05, 0.72],
      [-0.1, 0.8],
      [-0.3, 0.8],
      [-0.36, 0.74],
      [-0.2, 0.7],
    ],
    seatW: 0.22,
    ex: 'low',
    fend: 'deep',
    light: 'round',
    lean: 0.35,
  },
  chopper: {
    rf: 0.3,
    tf: 0.06,
    rr: 0.31,
    tr: 0.12,
    zf: 0.9,
    zr: -0.6,
    head: [0.84, 0.4],
    bar: [1.16, 0.3, 0.35],
    seat: [0.56, -0.2],
    pivot: [0.33, -0.12],
    peg: [0.32, 0.36],
    eng: 'vtwin',
    E: [0.36, 0.03],
    frame: 'cradle',
    spokes: 40,
    tank: [
      [0.02, 0.68],
      [0.06, 0.76],
      [0.2, 0.8],
      [0.34, 0.78],
      [0.4, 0.72],
      [0.3, 0.67],
      [0.14, 0.66],
    ],
    tankW: 0.22,
    seatP: [
      [-0.05, 0.56],
      [-0.12, 0.62],
      [-0.26, 0.63],
      [-0.34, 0.6],
      [-0.3, 0.55],
      [-0.15, 0.54],
    ],
    seatW: 0.26,
    ex: 'drag',
    fend: 'rear',
    light: 'round',
    lean: -0.05,
  },
  sport: {
    rf: 0.29,
    tf: 0.085,
    rr: 0.29,
    tr: 0.1,
    zf: 0.6,
    zr: -0.55,
    head: [0.8, 0.36],
    bar: [0.8, 0.3, 0.27],
    seat: [0.74, -0.24],
    pivot: [0.38, -0.12],
    peg: [0.4, -0.18],
    eng: 'four',
    E: [0.38, 0.05],
    frame: 'beam',
    spokes: 0,
    tank: [
      [-0.06, 0.72],
      [-0.02, 0.84],
      [0.14, 0.9],
      [0.3, 0.88],
      [0.36, 0.78],
      [0.3, 0.72],
      [0.1, 0.7],
    ],
    tankW: 0.32,
    seatP: [
      [-0.08, 0.73],
      [-0.14, 0.78],
      [-0.32, 0.82],
      [-0.6, 0.92],
      [-0.66, 0.86],
      [-0.5, 0.78],
      [-0.25, 0.72],
    ],
    seatW: 0.24,
    ex: 'under',
    fend: 'hug',
    light: 'fair',
    lean: 0.95,
  },
  dirt: {
    rf: 0.34,
    tf: 0.07,
    rr: 0.32,
    tr: 0.085,
    zf: 0.62,
    zr: -0.58,
    head: [0.93, 0.36],
    bar: [1.04, 0.27, 0.38],
    seat: [0.82, -0.26],
    pivot: [0.42, -0.12],
    peg: [0.38, -0.04],
    eng: 'mx',
    E: [0.42, 0.04],
    frame: 'mx',
    spokes: 32,
    knobs: 1,
    tank: [
      [-0.02, 0.8],
      [0.02, 0.88],
      [0.14, 0.93],
      [0.3, 0.9],
      [0.36, 0.82],
      [0.2, 0.78],
    ],
    tankW: 0.26,
    seatP: [
      [-0.04, 0.86],
      [0.08, 0.92],
      [-0.1, 0.92],
      [-0.5, 0.9],
      [-0.66, 0.88],
      [-0.6, 0.85],
      [-0.2, 0.84],
    ],
    seatW: 0.18,
    ex: 'high',
    fend: 'mx',
    light: 'plate',
    lean: 0.55,
  },
  rocket: {
    rf: 0.28,
    tf: 0.08,
    rr: 0.28,
    tr: 0.09,
    zf: 0.6,
    zr: -0.56,
    head: [0.82, 0.38],
    bar: [0.86, 0.32, 0.3],
    seat: [0.74, -0.22],
    pivot: [0.36, -0.12],
    peg: [0.36, -0.12],
    eng: 'jet',
    E: [0.48, -0.1],
    frame: 'shell',
    spokes: 0,
    tank: [
      [-0.3, 0.6],
      [-0.2, 0.82],
      [0.1, 0.9],
      [0.42, 0.82],
      [0.62, 0.66],
      [0.46, 0.56],
      [0, 0.5],
    ],
    tankW: 0.36,
    seatP: [
      [-0.24, 0.76],
      [-0.3, 0.82],
      [-0.5, 0.84],
      [-0.62, 0.8],
      [-0.5, 0.75],
    ],
    seatW: 0.24,
    ex: 'jet',
    fend: 'hug',
    light: 'jet',
    lean: 0.8,
  },
};
function bAlign(mesh, a, b) {
  _bv1.copy(a);
  _bv2.copy(b);
  mesh.position.copy(_bv1).add(_bv2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(YAX, _bv2.clone().sub(_bv1).normalize());
  return mesh;
}
function mergeGroup(grp) {
  grp.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(),
    buckets = new Map(),
    kill = [];
  grp.traverse(o => {
    if (!o.isMesh || o.userData.keep) return;
    let p = o.parent,
      skip = false;
    while (p && p !== grp) {
      if (p.userData.keep) {
        skip = true;
        break;
      }
      p = p.parent;
    }
    if (skip) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.uv)
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) {
      const c = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    const k = o.material.uuid;
    if (!buckets.has(k)) buckets.set(k, { m: o.material, gs: [], shadow: o.castShadow });
    buckets.get(k).gs.push(g);
    kill.push(o);
  });
  kill.forEach(o => o.parent.remove(o));
  for (const { m, gs, shadow } of buckets.values()) {
    let n = 0;
    gs.forEach(g => (n += g.attributes.position.count));
    const P = new Float32Array(n * 3),
      N = new Float32Array(n * 3),
      U = new Float32Array(n * 2),
      CC = new Float32Array(n * 3),
      // optional per-vertex rider data (sharp suit chevron), zero where a part doesn't have it
      CH = gs.some(g => g.attributes.chev) ? new Float32Array(n * 4) : null;
    let o = 0;
    gs.forEach(g => {
      if (CH && g.attributes.chev) CH.set(g.attributes.chev.array.subarray(0, g.attributes.position.count * 4), o * 4);
      P.set(g.attributes.position.array, o * 3);
      N.set(g.attributes.normal.array, o * 3);
      U.set(g.attributes.uv.array.subarray(0, g.attributes.position.count * 2), o * 2);
      CC.set(g.attributes.color.array.subarray(0, g.attributes.position.count * 3), o * 3);
      o += g.attributes.position.count;
      g.dispose();
    });
    const G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.BufferAttribute(P, 3));
    G.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    G.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    G.setAttribute('color', new THREE.BufferAttribute(CC, 3));
    if (CH) G.setAttribute('chev', new THREE.BufferAttribute(CH, 4));
    const me = new THREE.Mesh(G, m);
    me.castShadow = shadow !== false;
    me.receiveShadow = false;
    grp.add(me);
  }
}
function makeBike(o) {
  if (typeof o === 'number') o = { paintHex: o };
  o = Object.assign({ style: 'classic', paint: 'red', costume: 'leathers' }, o);
  const st = BSPEC[o.style] ? o.style : 'classic',
    S = BSPEC[st],
    P = o.paintHex != null ? { c: o.paintHex } : findItem('paint', o.paint),
    C = findItem('costume', o.costume);
  const g = new THREE.Group(),
    m = new THREE.Group(),
    rider = new THREE.Group();
  g.add(m);
  m.scale.setScalar(0.85);
  const SM = (c, r, mt, x = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: mt }, x));
  const paint = applyFinish(SM(deep(P.c), P.rough ?? 0.28, P.metal ?? 0.55), P.id ? P : null),
    black = SM(0x141417, 0.7, 0.2),
    rubber = SM(0x0d0d0f, 0.92, 0),
    chrome = SM(0xe9ebef, 0.12, 1),
    alu = SM(0xb9bec6, 0.32, 0.85),
    dark = SM(0x2a2c31, 0.45, 0.7),
    frameM =
      st === 'dirt'
        ? SM(0x2b2d33, 0.35, 0.6)
        : st === 'chopper'
          ? SM(0x111114, 0.3, 0.6)
          : st === 'sport'
            ? alu
            : SM(0x151518, 0.35, 0.5),
    gold = SM(0xd4a017, 0.3, 0.85),
    red = SM(0xc81e2a, 0.35, 0.4),
    leather = SM(0x1a1614, 0.8, 0.05),
    lens = SM(0xfff6d8, 0.1, 0, { emissive: 0xfff0c0, emissiveIntensity: 1.2 }),
    tailM = SM(0xff2030, 0.3, 0, { emissive: 0xff1020, emissiveIntensity: 0.9 }),
    orangeL = SM(0xff9a1a, 0.3, 0, { emissive: 0xff7a00, emissiveIntensity: 0.5 }),
    glass = new THREE.MeshStandardMaterial({
      color: 0x9fc4e0,
      transparent: true,
      opacity: 0.42,
      metalness: 0.9,
      roughness: 0.04,
      side: THREE.DoubleSide,
    });
  const SG = new THREE.Group();
  m.add(SG);
  const V = (x, y, z) => new V3(x, y, z);
  const mesh = (geo, mat, par = SG) => {
    const e = new THREE.Mesh(geo, mat);
    e.castShadow = true;
    par.add(e);
    return e;
  };
  const box = (w, h, d, mat, x, y, z, rx = 0, par = SG) => {
    const e = mesh(new THREE.BoxGeometry(w, h, d), mat, par);
    e.position.set(x, y, z);
    e.rotation.x = rx;
    return e;
  };
  const cyl = (r0, r1, len, mat, a, b, seg = 12, par = SG) =>
    bAlign(mesh(new THREE.CylinderGeometry(r1, r0, len ?? a.distanceTo(b), seg), mat, par), a, b);
  const rod = (a, b, r, mat, seg = 10, par = SG) => cyl(r, r, a.distanceTo(b), mat, a, b, seg, par);
  const tube = (pts, r, mat, seg, rad = 8, par = SG) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts.map(p => (p.isVector3 ? p : V(...p)))),
        seg || pts.length * 10,
        r,
        rad,
        false,
      ),
      mat,
      par,
    );
  const disc = (r, th, mat, pos, seg = 24, par = SG) => {
    const e = mesh(new THREE.CylinderGeometry(r, r, th, seg), mat, par);
    e.rotation.z = Math.PI / 2;
    e.position.copy(pos);
    return e;
  };
  const sph = (sx, sy, sz, mat, x, y, z, seg = 16, par = SG) => {
    const e = mesh(new THREE.SphereGeometry(1, seg, Math.max(8, (seg * 0.7) | 0)), mat, par);
    e.scale.set(sx, sy, sz);
    e.position.set(x, y, z);
    return e;
  };
  /* extrude a side profile (z,y) across the bike's width, then pinch the ends so it reads as a rounded volume */
  const sideX = (pts, w, mat, pinch = 0.55, bev = 0.025, par = SG, x0 = 0) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    sh.splineThru(pts.slice(1).map(p => new THREE.Vector2(p[0], p[1])));
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth: Math.max(0.005, w - 2 * bev),
      bevelEnabled: true,
      bevelThickness: bev,
      bevelSize: bev * 0.9,
      bevelSegments: 3,
      curveSegments: 14,
    });
    geo.rotateY(-Math.PI / 2);
    geo.computeBoundingBox();
    const bb = geo.boundingBox,
      cx = (bb.min.x + bb.max.x) / 2;
    geo.translate(-cx, 0, 0);
    const zs = pts.map(p => p[0]),
      ys = pts.map(p => p[1]),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys),
      pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const z = pa.getZ(i),
        y = pa.getY(i),
        u = (z - z0) / (z1 - z0 || 1),
        v = (y - y0) / (y1 - y0 || 1);
      const f =
        1 -
        pinch +
        pinch *
          Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, u))))) *
          (1 - 0.25 * Math.pow(Math.abs(v - 0.6) * 1.6, 2));
      pa.setX(i, pa.getX(i) * f + x0);
    }
    geo.computeVertexNormals();
    return mesh(geo, mat, par);
  };
  const wheels = [],
    AF = V(0, S.rf, S.zf),
    AR = V(0, S.rr, S.zr);
  /* ---- wheels ---- */
  const wheel = (c, r, t, front) => {
    const wg = new THREE.Group();
    wg.position.copy(c);
    m.add(wg);
    const R0 = r - t;
    const tire = mesh(new THREE.TorusGeometry(R0, t, 12, 44), rubber, wg);
    tire.rotation.y = Math.PI / 2;
    tire.scale.set(1, 1, 0.92);
    if (S.knobs) {
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * 6.283;
        for (const sx of [-1, 1]) {
          const k = mesh(new THREE.BoxGeometry(0.035, 0.03, 0.04), rubber, wg);
          k.position.set(sx * t * 0.45 * (i % 2 ? 1 : 0.4), Math.cos(a) * (r - 0.004), Math.sin(a) * (r - 0.004));
          k.rotation.x = -a;
        }
      }
    } else {
      for (const sx of [-1, 1]) {
        const gr = mesh(new THREE.TorusGeometry(R0, t * 0.995, 4, 48), black, wg);
        gr.rotation.y = Math.PI / 2;
        gr.scale.set(1, 1, 0.05);
        gr.position.x = sx * t * 0.32;
      }
    }
    const rimR = R0 - t * 0.62;
    const rb = mesh(new THREE.CylinderGeometry(rimR, rimR, t * 1.05, 40, 1, true), S.spokes ? chrome : dark, wg);
    rb.rotation.z = Math.PI / 2;
    rb.material.side = THREE.DoubleSide;
    for (const sx of [-1, 1]) {
      const lip = mesh(new THREE.TorusGeometry(rimR + 0.004, 0.008, 6, 40), S.spokes ? chrome : dark, wg);
      lip.rotation.y = Math.PI / 2;
      lip.position.x = sx * t * 0.5;
    }
    const hubL = 0.13;
    cyl(0.045, 0.045, hubL, alu, V(-hubL / 2, 0, 0), V(hubL / 2, 0, 0), 16, wg);
    [-1, 1].forEach(sx => disc(0.06, 0.012, alu, V(sx * 0.045, 0, 0), 18, wg));
    if (S.spokes) {
      for (let i = 0; i < S.spokes; i++) {
        const a = (i / S.spokes) * 6.283,
          sx = i % 2 ? 1 : -1,
          a2 = a + (i % 4 < 2 ? 0.35 : -0.35);
        rod(
          V(sx * 0.045, Math.cos(a) * 0.055, Math.sin(a) * 0.055),
          V(sx * 0.01, Math.cos(a2) * (rimR - 0.006), Math.sin(a2) * (rimR - 0.006)),
          0.0035,
          chrome,
          4,
          wg,
        );
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283;
        for (const da of [-0.1, 0.1]) {
          const e = rod(
            V(0, Math.cos(a) * 0.06, Math.sin(a) * 0.06),
            V(0, Math.cos(a + da) * (rimR - 0.01), Math.sin(a + da) * (rimR - 0.01)),
            0.016,
            dark,
            8,
            wg,
          );
          e.scale.set(1, 1, 0.6);
        }
      }
    }
    if ((st !== 'vintage' && st !== 'chopper') || front) {
      const dr = r * 0.55,
        sh = new THREE.Shape();
      sh.absarc(0, 0, dr, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, dr * 0.55, 0, Math.PI * 2, true);
      sh.holes.push(hole);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * 6.283,
          hp = new THREE.Path();
        hp.absarc(Math.cos(a) * dr * 0.78, Math.sin(a) * dr * 0.78, 0.008, 0, Math.PI * 2, true);
        sh.holes.push(hp);
      }
      const dg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false, curveSegments: 20 });
      dg.rotateY(Math.PI / 2);
      const d = mesh(dg, SM(0xa9afb8, 0.28, 0.95), wg);
      d.position.x = front ? 0.075 : -0.075;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.283;
        const b = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6), alu, wg);
        b.rotation.z = Math.PI / 2;
        b.position.set(front ? 0.07 : -0.07, Math.cos(a) * dr * 0.45, Math.sin(a) * dr * 0.45);
      }
    }
    if (!front && S.eng !== 'jet') {
      const sp = new THREE.Shape(),
        n = 38,
        ro = r * 0.42,
        ri = ro - 0.014;
      for (let k = 0; k < n * 2; k++) {
        const a = (k / (n * 2)) * 6.283,
          rr = k % 2 ? ri : ro;
        k ? sp.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sp.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      sp.closePath();
      const hp = new THREE.Path();
      hp.absarc(0, 0, ro * 0.45, 0, Math.PI * 2, true);
      sp.holes.push(hp);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.283,
          lp = new THREE.Path();
        lp.absarc(Math.cos(a) * ro * 0.72, Math.sin(a) * ro * 0.72, ro * 0.14, 0, Math.PI * 2, true);
        sp.holes.push(lp);
      }
      const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.008, bevelEnabled: false });
      sg.rotateY(Math.PI / 2);
      const s2 = mesh(sg, st === 'dirt' ? gold : dark, wg);
      s2.position.x = -0.06;
    }
    mergeGroup(wg);
    wheels.push(wg);
    return wg;
  };
  const fw = wheel(AF, S.rf, S.tf, true),
    rw = wheel(AR, S.rr, S.tr, false);
  /* ---- steering head, fork, clamps ---- */
  const H = V(0, S.head[0], S.head[1]),
    ax = H.clone().sub(AF).normalize(),
    Ht = H.clone().addScaledVector(ax, 0.08),
    Hb = H.clone().addScaledVector(ax, -0.09);
  cyl(0.042, 0.042, null, frameM, Hb, Ht, 14);
  const fx = st === 'chopper' ? 0.07 : 0.085,
    lowerL = st === 'dirt' ? 0.42 : st === 'chopper' ? 0.28 : 0.3,
    usd = st === 'dirt' || st === 'sport';
  [1, -1].forEach(sx => {
    const top = Ht.clone()
        .addScaledVector(ax, 0.04)
        .setX(sx * fx),
      bot = AF.clone().setX(sx * fx),
      mid = bot.clone().addScaledVector(ax, lowerL);
    if (usd) {
      cyl(0.034, 0.034, null, gold, top, mid.clone().addScaledVector(ax, 0.05), 14);
      cyl(0.022, 0.022, null, chrome, mid, bot.clone().addScaledVector(ax, 0.03), 12);
      sph(0.03, 0.03, 0.03, dark, bot.x, bot.y, bot.z, 10);
    } else {
      cyl(0.021, 0.021, null, chrome, top, mid, 12);
      cyl(0.03, 0.034, null, st === 'chopper' ? chrome : alu, mid, bot.clone().addScaledVector(ax, -0.02), 14);
      if (st === 'vintage') {
        for (let k = 0; k < 6; k++) {
          const p = mid.clone().addScaledVector(ax, 0.03 + k * 0.025);
          const tr = mesh(new THREE.TorusGeometry(0.027, 0.006, 6, 14), black);
          tr.position.copy(p);
          tr.quaternion.setFromUnitVectors(V(0, 0, 1), ax);
        }
      }
    }
    const nut = disc(0.022, 0.02, chrome, V(sx * (fx + 0.03), AF.y, AF.z), 8);
  });
  [Ht.clone().addScaledVector(ax, 0.03), Hb.clone().addScaledVector(ax, -0.01)].forEach((p, i) => {
    const cl = mesh(new THREE.BoxGeometry(2 * fx + 0.07, 0.03, 0.07), i ? frameM : alu);
    cl.position.copy(p);
    cl.quaternion.setFromUnitVectors(YAX, ax);
  });
  /* ---- frame ---- */
  const PV = V(0, S.pivot[0], S.pivot[1]),
    E = V(0, S.E[0], S.E[1]),
    tankRearZ = Math.min(...S.tank.map(p => p[0])) - 0.02,
    seatTop = S.seat[0];
  if (S.frame === 'cradle' || S.frame === 'mx') {
    tube(
      [
        Ht.clone().add(V(0, -0.02, -0.03)),
        V(0, seatTop - 0.04, tankRearZ + 0.12),
        V(0, seatTop - 0.06, tankRearZ - 0.04),
      ],
      S.frame === 'mx' ? 0.03 : 0.024,
      frameM,
      30,
    );
    [1, -1].forEach(sx => {
      const w = S.frame === 'mx' ? 0.055 : 0.06;
      tube(
        [
          Hb.clone().add(V(sx * 0.02, -0.02, -0.02)),
          V(sx * w, E.y - 0.02, E.z + 0.22),
          V(sx * w, 0.13, E.z + 0.08),
          V(sx * w, 0.12, E.z - 0.12),
          V(sx * w, PV.y - 0.06, PV.z - 0.03),
          V(sx * 0.08, seatTop - 0.06, tankRearZ - 0.06),
        ],
        0.019,
        frameM,
        60,
      );
      tube(
        [
          V(sx * 0.09, seatTop - 0.06, tankRearZ),
          V(sx * 0.1, seatTop - 0.05, S.zr * 0.55),
          V(sx * 0.08, seatTop - 0.03, S.zr * 0.95),
        ],
        0.014,
        frameM,
        30,
      );
      tube([V(sx * 0.08, PV.y, PV.z), V(sx * 0.09, seatTop - 0.06, S.zr * 0.6)], 0.013, frameM, 20);
    });
  } else if (S.frame === 'beam') {
    [1, -1].forEach(sx => {
      const e = tube(
        [
          Hb.clone().add(V(sx * 0.05, 0.02, 0)),
          V(sx * 0.14, E.y + 0.22, E.z + 0.08),
          V(sx * 0.13, PV.y + 0.06, PV.z + 0.04),
          V(sx * 0.1, PV.y - 0.06, PV.z),
        ],
        0.04,
        alu,
        40,
      );
      e.scale.set(1, 1, 1);
      tube([V(sx * 0.11, PV.y + 0.12, PV.z), V(sx * 0.09, seatTop + 0.02, S.zr * 0.7)], 0.014, alu, 20);
    });
  }
  /* ---- swingarm, chain, shocks ---- */
  [1, -1].forEach(sx => {
    const p0 = V(sx * 0.085, PV.y, PV.z),
      p1 = V(sx * 0.085, AR.y, AR.z);
    if (st === 'sport' || st === 'dirt') {
      const e = cyl(0.032, 0.024, null, alu, p0, p1, 4);
      e.rotation.y += Math.PI / 4;
      const brace = rod(
        p0
          .clone()
          .lerp(p1, 0.2)
          .add(V(0, -0.02, 0)),
        p0
          .clone()
          .lerp(p1, 0.75)
          .add(V(0, -0.03, 0)),
        0.012,
        alu,
        6,
      );
    } else rod(p0, p1, 0.019, frameM, 10);
    disc(0.025, 0.03, chrome, V(sx * 0.1, AR.y, AR.z), 10);
  });
  disc(0.03, 0.24, alu, PV, 12);
  if (S.eng !== 'jet') {
    const fs = V(-0.075, E.y - 0.02, E.z - 0.1),
      rsR = S.rr * 0.42,
      top0 = fs.clone().add(V(0, 0.035, 0)),
      bot0 = fs.clone().add(V(0, -0.035, 0)),
      top1 = V(-0.075, AR.y + rsR, AR.z),
      bot1 = V(-0.075, AR.y - rsR, AR.z);
    rod(top0, top1, 0.006, dark, 5);
    rod(bot0, bot1, 0.006, dark, 5);
    disc(0.035, 0.012, dark, fs, 14);
    if (st !== 'chopper') {
      const cg = sideX(
        [
          [top0.z - 0.03, top0.y + 0.03],
          [top0.z - 0.25, top1.y + 0.04],
          [top1.z + 0.12, top1.y + 0.04],
          [top1.z + 0.1, top1.y + 0.015],
          [top0.z - 0.25, top0.y + 0.015],
        ],
        0.006,
        black,
        0,
        0.002,
        SG,
        -0.075,
      );
    }
  }
  const spring = (a, b, rad, turns, mat) => {
    const len = a.distanceTo(b),
      pts = [];
    for (let i = 0; i <= turns * 10; i++) {
      const t = i / (turns * 10),
        an = t * turns * 6.283;
      pts.push(V(Math.cos(an) * rad, t * len - len / 2, Math.sin(an) * rad));
    }
    const e = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 10, 0.007, 5, false), mat);
    e.position.copy(a).add(b).multiplyScalar(0.5);
    e.quaternion.setFromUnitVectors(YAX, b.clone().sub(a).normalize());
    return e;
  };
  if (S.frame === 'cradle' && st !== 'chopper')
    [1, -1].forEach(sx => {
      const a = V(sx * 0.11, AR.y + 0.05, AR.z + 0.06),
        b = V(sx * 0.11, seatTop - 0.04, S.zr * 0.55);
      rod(a, b, 0.011, chrome, 8);
      spring(a.clone().lerp(b, 0.15), b.clone().lerp(a, 0.25), 0.027, 7, st === 'vintage' ? chrome : red);
      cyl(0.022, 0.022, null, chrome, b.clone().lerp(a, 0.25), b, 12);
      sph(0.018, 0.018, 0.018, chrome, a.x, a.y, a.z, 8);
      sph(0.018, 0.018, 0.018, chrome, b.x, b.y, b.z, 8);
    });
  else if (S.eng !== 'jet') {
    const a = V(0, PV.y + 0.03, PV.z - 0.04),
      b = V(0, seatTop - 0.05, PV.z + 0.02);
    rod(a, b, 0.012, alu, 8);
    spring(a.clone().lerp(b, 0.12), b.clone().lerp(a, 0.3), 0.032, 6, st === 'dirt' ? gold : red);
    cyl(0.03, 0.03, null, dark, b.clone().lerp(a, 0.3), b, 12);
  }
  if (st === 'chopper')
    [1, -1].forEach(sx => {
      const a = V(sx * 0.1, AR.y + 0.06, AR.z + 0.08),
        b = V(sx * 0.1, seatTop - 0.1, AR.z + 0.32);
      rod(a, b, 0.011, chrome, 8);
      spring(a.clone().lerp(b, 0.15), b.clone().lerp(a, 0.2), 0.025, 6, chrome);
    });
  /* ---- engines ---- */
  const fins = (base, axis, n, w, d, gap, mat, round) => {
    for (let k = 0; k < n; k++) {
      const p = base.clone().addScaledVector(axis, k * gap);
      const f = round
        ? mesh(new THREE.CylinderGeometry(w, w, 0.012, 20), mat)
        : mesh(new THREE.BoxGeometry(w, 0.012, d), mat);
      f.position.copy(p);
      f.quaternion.setFromUnitVectors(YAX, axis);
    }
  };
  const crank = w => {
    const pts = [
      [E.z + 0.16, E.y - 0.04],
      [E.z + 0.12, E.y + 0.06],
      [E.z - 0.02, E.y + 0.09],
      [E.z - 0.16, E.y + 0.06],
      [E.z - 0.2, E.y - 0.04],
      [E.z - 0.12, E.y - 0.15],
      [E.z + 0.08, E.y - 0.15],
    ];
    sideX(pts, w, st === 'chopper' ? chrome : alu, 0.25, 0.02);
  };
  if (S.eng === 'twin') {
    crank(0.24);
    const axv = V(0, 1, 0.25).normalize();
    [1, -1].forEach(sx => {
      const b0 = V(sx * 0.05, E.y + 0.08, E.z + 0.03);
      fins(b0, axv, 8, 0.105, 0.13, 0.024, alu);
      cyl(0.045, 0.045, null, dark, b0.clone().addScaledVector(axv, -0.02), b0.clone().addScaledVector(axv, 0.2), 14);
      disc(0.08, 0.025, chrome, V(sx * 0.125, E.y - 0.02, E.z), 26);
      disc(0.04, 0.03, alu, V(sx * 0.135, E.y - 0.02, E.z), 16);
      const cb = V(sx * 0.05, E.y + 0.17, E.z - 0.1);
      cyl(0.022, 0.022, null, alu, cb, cb.clone().add(V(0, 0, -0.08)), 12);
      sph(0.04, 0.045, 0.05, chrome, sx * 0.05, cb.y, cb.z - 0.12, 14);
    });
    const head = V(0, E.y + 0.27, E.z + 0.07);
    box(0.24, 0.05, 0.15, alu, head.x, head.y, head.z, 0.25);
    box(0.2, 0.02, 0.1, chrome, head.x, head.y + 0.03, head.z, 0.25);
  }
  if (S.eng === 'single') {
    crank(0.2);
    const axv = V(0, 1, 0.22).normalize(),
      b0 = V(0, E.y + 0.08, E.z + 0.03);
    fins(b0, axv, 9, 0.12, 0.15, 0.022, alu);
    cyl(0.05, 0.05, null, dark, b0, b0.clone().addScaledVector(axv, 0.22), 14);
    box(0.15, 0.05, 0.16, chrome, 0, E.y + 0.31, E.z + 0.09, 0.22);
    disc(0.075, 0.025, chrome, V(0.11, E.y - 0.03, E.z), 24);
    disc(0.075, 0.025, chrome, V(-0.11, E.y - 0.03, E.z - 0.03), 24);
    const cb = V(0.03, E.y + 0.2, E.z - 0.1);
    cyl(0.024, 0.024, null, alu, cb, cb.clone().add(V(0, -0.01, -0.08)), 12);
    box(0.12, 0.15, 0.1, black, 0, E.y + 0.2, E.z - 0.22);
  }
  if (S.eng === 'vtwin') {
    crank(0.22);
    [
      [0.45, 1],
      [-0.45, -1],
    ].forEach(([tilt, k]) => {
      const axv = V(0, Math.cos(tilt), Math.sin(tilt)),
        b0 = V(0, E.y + 0.07, E.z + k * 0.04);
      fins(b0, axv, 9, 0.07, 0, 0.024, chrome, true);
      cyl(0.05, 0.05, null, dark, b0.clone().addScaledVector(axv, -0.02), b0.clone().addScaledVector(axv, 0.22), 14);
      const hp = b0.clone().addScaledVector(axv, 0.25);
      box(0.12, 0.07, 0.13, chrome, hp.x, hp.y, hp.z, -tilt);
      sph(0.05, 0.03, 0.06, chrome, hp.x, hp.y + 0.04, hp.z, 12);
    });
    disc(0.1, 0.04, chrome, V(0.1, E.y + 0.2, E.z), 28);
    disc(0.06, 0.045, chrome, V(0.12, E.y + 0.2, E.z), 20);
    sideX(
      [
        [E.z + 0.02, E.y - 0.02],
        [E.z - 0.04, E.y + 0.06],
        [E.z - 0.42, E.y + 0.05],
        [E.z - 0.46, E.y - 0.06],
        [E.z - 0.3, E.y - 0.12],
        [E.z - 0.04, E.y - 0.11],
      ],
      0.05,
      chrome,
      0.15,
      0.02,
      SG,
      -0.13,
    );
  }
  if (S.eng === 'mx') {
    crank(0.2);
    const axv = V(0, 1, 0.3).normalize(),
      b0 = V(0, E.y + 0.08, E.z + 0.04);
    cyl(0.06, 0.055, null, dark, b0, b0.clone().addScaledVector(axv, 0.2), 16);
    box(0.14, 0.07, 0.14, alu, 0, E.y + 0.3, E.z + 0.1, 0.3);
    disc(0.07, 0.025, SM(0x3a5ad8, 0.4, 0.4), V(0.11, E.y - 0.03, E.z), 22);
    disc(0.07, 0.025, alu, V(-0.11, E.y - 0.03, E.z - 0.03), 22);
    const rad = V(0, E.y + 0.2, E.z + 0.24);
    [1, -1].forEach(sx => {
      box(0.03, 0.2, 0.14, dark, sx * 0.1, rad.y, rad.z, -0.2);
      for (let k = 0; k < 8; k++)
        box(0.004, 0.18, 0.12, alu, sx * (0.1 + (k - 3.5) * 0.0035 * 0), rad.y, rad.z + (k - 3.5) * 0.015, -0.2);
    });
    [1, -1].forEach(sx =>
      sideX(
        [
          [0.38, 0.86],
          [0.14, 0.84],
          [0.04, 0.62],
          [0.16, 0.56],
          [0.34, 0.68],
        ],
        0.012,
        paint,
        0,
        0.006,
        SG,
        sx * 0.14,
      ),
    );
  }
  if (S.eng === 'four') {
    crank(0.3);
    const axv = V(0, 1, 0.35).normalize();
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.055,
        b0 = V(x, E.y + 0.1, E.z + 0.04);
      cyl(0.03, 0.03, null, dark, b0, b0.clone().addScaledVector(axv, 0.2), 12);
      tube(
        [
          b0
            .clone()
            .addScaledVector(axv, 0.12)
            .add(V(0, 0, 0.06)),
          V(x * 0.9, E.y + 0.02, E.z + 0.24),
          V(x * 0.5, 0.12, E.z + 0.12),
          V(0, 0.12, E.z - 0.08),
        ],
        0.016,
        chrome,
        30,
      );
    }
    box(0.26, 0.08, 0.18, dark, 0, E.y + 0.32, E.z + 0.12, 0.35);
    disc(0.08, 0.025, dark, V(0.17, E.y - 0.02, E.z), 24);
    disc(0.08, 0.025, dark, V(-0.17, E.y - 0.02, E.z), 24);
  }
  if (S.eng === 'jet') {
    const a = V(0, E.y, E.z + 0.3),
      b = V(0, E.y, E.z - 0.7);
    cyl(0.13, 0.17, null, chrome, a, b, 28);
    for (let k = 0; k < 6; k++) {
      const p = a.clone().lerp(b, k / 5);
      const t = mesh(new THREE.TorusGeometry(0.13 + k * 0.008, 0.012, 6, 28), dark);
      t.position.copy(p);
    }
    cyl(0.17, 0.1, null, dark, b, b.clone().add(V(0, 0, -0.18)), 28);
  }
  /* ---- exhaust ---- */
  const can = (a, b, r) => {
    const len = a.distanceTo(b),
      pr = [
        [0, 0],
        [r * 0.7, 0],
        [r, len * 0.12],
        [r, len * 0.82],
        [r * 0.8, len],
        [r * 0.5, len],
        [r * 0.5, len * 1.03],
      ].map(p => new THREE.Vector2(p[0], p[1]));
    const e = mesh(new THREE.LatheGeometry(pr, 20), chrome);
    e.position.copy(a);
    e.quaternion.setFromUnitVectors(YAX, b.clone().sub(a).normalize());
    const tp = disc(r * 0.45, 0.02, black, b, 14);
    tp.quaternion.copy(e.quaternion);
    tp.rotation.set(0, 0, 0);
    tp.quaternion.setFromUnitVectors(YAX, b.clone().sub(a).normalize());
    return e;
  };
  if (S.ex === 'low') {
    const pts =
      S.eng === 'single'
        ? [[0, E.y + 0.18, E.z + 0.12]]
        : [
            [0.05, E.y + 0.2, E.z + 0.13],
            [-0.05, E.y + 0.2, E.z + 0.13],
          ];
    pts.forEach(([x, y, z]) => {
      const sx = x < 0 ? -1 : 1;
      tube(
        [V(x, y, z), V(x + sx * 0.03, y - 0.08, z + 0.1), V(sx * 0.13, 0.2, E.z + 0.1), V(sx * 0.15, 0.22, E.z - 0.2)],
        0.019,
        chrome,
        40,
      );
      can(V(sx * 0.15, 0.22, E.z - 0.2), V(sx * 0.155, 0.27, S.zr - 0.1), 0.045);
    });
  }
  if (S.ex === 'drag')
    [
      [0.12, 0.34, 0.1],
      [0.12, 0.22, -0.08],
    ].forEach(([x, y, z], i) => {
      tube(
        [
          V(0.04, E.y + 0.3 + (i ? -0.05 : 0), E.z + (i ? -0.12 : 0.12)),
          V(x, y + 0.02, E.z + z),
          V(x + 0.01, y, S.zr - 0.25),
        ],
        0.022,
        chrome,
        40,
      );
      disc(0.026, 0.01, black, V(x + 0.01, y, S.zr - 0.25), 12).rotation.set(Math.PI / 2, 0, 0);
    });
  if (S.ex === 'high') {
    tube(
      [
        V(0, E.y + 0.3, E.z + 0.2),
        V(0.06, E.y + 0.12, E.z + 0.32),
        V(0.12, E.y + 0.06, E.z + 0.1),
        V(0.13, S.seat[0] - 0.12, S.zr * 0.35),
      ],
      0.022,
      chrome,
      40,
    );
    can(V(0.13, S.seat[0] - 0.12, S.zr * 0.35), V(0.12, S.seat[0] - 0.02, S.zr * 1.05), 0.05);
  }
  if (S.ex === 'under') {
    tube(
      [V(0, 0.12, E.z - 0.08), V(0, 0.14, PV.z - 0.08), V(0, 0.3, S.zr * 0.4), V(0, S.seat[0] - 0.12, S.zr * 0.85)],
      0.03,
      dark,
      30,
    );
    [1, -1].forEach(sx =>
      can(V(sx * 0.07, S.seat[0] - 0.12, S.zr * 0.85), V(sx * 0.07, S.seat[0] - 0.04, S.zr * 1.2), 0.04),
    );
  }
  /* ---- tank, seat, bodywork ---- */
  if (st !== 'rocket') {
    sideX(S.tank, S.tankW, paint, 0.5, 0.04);
    const tt = S.tank.reduce((a, p) => (p[1] > a[1] ? p : a));
    const cap = disc(0.03, 0.02, chrome, V(0, tt[1] + 0.01, tt[0] - 0.02), 16);
    cap.rotation.set(0, 0, 0);
    [1, -1].forEach(sx => {
      const kp = mesh(new THREE.CircleGeometry(0.05, 16), black);
      kp.position.set(sx * (S.tankW * 0.48), tt[1] - 0.07, tt[0]);
      kp.rotation.y = (sx * Math.PI) / 2;
    });
  }
  sideX(S.seatP, S.seatW, leather, 0.45, 0.03);
  if (st === 'classic') {
    sideX(
      [
        [-0.36, 0.74],
        [-0.5, 0.78],
        [-0.66, 0.66],
        [-0.6, 0.6],
        [-0.4, 0.66],
      ],
      0.2,
      paint,
      0.35,
      0.025,
    );
    sideX(
      [
        [-0.12, 0.6],
        [-0.12, 0.7],
        [-0.3, 0.7],
        [-0.3, 0.58],
      ],
      0.22,
      paint,
      0.2,
      0.02,
    );
  }
  if (st === 'vintage') {
    const rf = mesh(new THREE.CylinderGeometry(S.rr + 0.05, S.rr + 0.05, 0.13, 28, 1, true, 1.0, 2.3), paint);
    rf.rotation.z = Math.PI / 2;
    rf.position.copy(AR);
    rf.material.side = THREE.DoubleSide;
    const ff = mesh(new THREE.CylinderGeometry(S.rf + 0.05, S.rf + 0.05, 0.11, 28, 1, true, 0.25, 2.0), paint);
    ff.rotation.z = Math.PI / 2;
    ff.rotation.x = 0;
    ff.position.copy(AF);
    box(0.12, 0.12, 0.04, SM(0xf2efe6, 0.6, 0), 0, 0.62, S.zr - 0.32, 0.5);
  }
  if (st === 'classic') {
    const ff = mesh(new THREE.CylinderGeometry(S.rf + 0.035, S.rf + 0.035, 0.1, 24, 1, true, 0.3, 1.9), paint);
    ff.rotation.z = Math.PI / 2;
    ff.position.copy(AF);
    ff.material.side = THREE.DoubleSide;
    const rf = mesh(new THREE.CylinderGeometry(S.rr + 0.035, S.rr + 0.035, 0.12, 24, 1, true, 1.3, 1.8), paint);
    rf.rotation.z = Math.PI / 2;
    rf.position.copy(AR);
  }
  if (st === 'chopper') {
    const rf = mesh(new THREE.CylinderGeometry(S.rr + 0.04, S.rr + 0.04, 0.17, 28, 1, true, 1.1, 2.3), paint);
    rf.rotation.z = Math.PI / 2;
    rf.position.copy(AR);
    rf.material.side = THREE.DoubleSide;
    [1, -1].forEach(sx =>
      tube(
        [
          V(sx * 0.11, AR.y + 0.02, AR.z),
          V(sx * 0.11, AR.y + 0.3, AR.z + 0.12),
          V(sx * 0.09, seatTop + 0.25, AR.z + 0.18),
        ],
        0.012,
        chrome,
        20,
      ),
    );
    tube(
      [V(-0.09, seatTop + 0.25, AR.z + 0.18), V(0, seatTop + 0.32, AR.z + 0.16), V(0.09, seatTop + 0.25, AR.z + 0.18)],
      0.012,
      chrome,
      20,
    );
  }
  if (st === 'sport') {
    sideX(
      [
        [0.68, 0.48],
        [0.62, 0.66],
        [0.5, 0.86],
        [0.36, 0.92],
        [0.2, 0.88],
        [0.12, 0.64],
        [0.2, 0.36],
        [0.46, 0.34],
      ],
      0.36,
      paint,
      0.6,
      0.04,
    );
    sideX(
      [
        [0.52, 0.88],
        [0.4, 1.02],
        [0.33, 1.02],
        [0.36, 0.9],
      ],
      0.24,
      glass,
      0.4,
      0.006,
    );
    sideX(
      [
        [0.44, 0.22],
        [0.2, 0.12],
        [-0.1, 0.12],
        [-0.12, 0.24],
        [0.3, 0.3],
      ],
      0.24,
      paint,
      0.4,
      0.03,
    );
    const hf = mesh(new THREE.CylinderGeometry(S.rf + 0.03, S.rf + 0.03, 0.09, 24, 1, true, 0.6, 1.3), paint);
    hf.rotation.z = Math.PI / 2;
    hf.position.copy(AF);
  }
  if (st === 'dirt') {
    sideX(
      [
        [S.zf + 0.02, S.rf + S.tf + 0.08],
        [S.zf + 0.25, S.rf + S.tf + 0.14],
        [S.zf + 0.3, S.rf + S.tf + 0.11],
        [S.zf - 0.1, S.rf + S.tf + 0.09],
      ],
      0.12,
      paint,
      0.3,
      0.01,
    );
    sideX(
      [
        [-0.66, 0.88],
        [-0.86, 0.94],
        [-0.84, 0.86],
        [-0.5, 0.82],
      ],
      0.16,
      paint,
      0.25,
      0.012,
    );
    [1, -1].forEach(sx =>
      sideX(
        [
          [-0.18, 0.84],
          [-0.48, 0.86],
          [-0.5, 0.66],
          [-0.24, 0.6],
        ],
        0.01,
        SM(0xf2f2f2, 0.5, 0),
        0,
        0.004,
        SG,
        sx * 0.13,
      ),
    );
  }
  if (st === 'rocket') {
    sideX(S.tank, S.tankW, paint, 0.55, 0.05);
    sideX(
      [
        [0.62, 0.66],
        [0.52, 0.86],
        [0.4, 0.96],
        [0.34, 0.84],
      ],
      0.26,
      glass,
      0.4,
      0.006,
    );
    [1, -1].forEach(sx =>
      sideX(
        [
          [-0.36, 0.7],
          [-0.62, 1.0],
          [-0.7, 0.96],
          [-0.6, 0.72],
        ],
        0.02,
        paint,
        0,
        0.008,
        SG,
        sx * 0.17,
      ),
    );
    for (let k = 0; k < 3; k++)
      box(
        0.38 - k * 0.02,
        0.012,
        0.02,
        SM(0x6fd3ff, 0.3, 0, { emissive: 0x6fd3ff, emissiveIntensity: 1.4 }),
        0,
        0.6 + k * 0.09,
        0.55 - k * 0.06,
      );
  }
  /* ---- handlebars, controls, dash ---- */
  const B = V(0, S.bar[0], S.bar[1]),
    bh = S.bar[2],
    cl = Ht.clone().addScaledVector(ax, 0.05);
  if (st === 'sport' || st === 'rocket') {
    [1, -1].forEach(sx =>
      tube(
        [V(sx * 0.09, cl.y - 0.04, cl.z), V(sx * (bh * 0.6), B.y, B.z), V(sx * bh, B.y - 0.02, B.z - 0.04)],
        0.014,
        alu,
        16,
      ),
    );
  } else if (st === 'chopper') {
    [1, -1].forEach(sx =>
      tube(
        [
          V(sx * 0.06, cl.y, cl.z),
          V(sx * 0.09, B.y - 0.08, cl.z + 0.02),
          V(sx * 0.12, B.y, B.z + 0.02),
          V(sx * (bh - 0.02), B.y - 0.02, B.z - 0.08),
        ],
        0.015,
        chrome,
        30,
      ),
    );
  } else
    tube(
      [
        V(-bh, B.y - 0.02, B.z - 0.06),
        V(-bh * 0.55, B.y, B.z),
        V(-0.08, cl.y + 0.06, cl.z + 0.02),
        V(0.08, cl.y + 0.06, cl.z + 0.02),
        V(bh * 0.55, B.y, B.z),
        V(bh, B.y - 0.02, B.z - 0.06),
      ],
      0.014,
      st === 'dirt' ? SM(0x2b2b30, 0.4, 0.7) : chrome,
      50,
    );
  const gripP = sx =>
    st === 'chopper'
      ? V(sx * (bh - 0.02), B.y - 0.02, B.z - 0.08)
      : st === 'sport' || st === 'rocket'
        ? V(sx * bh, B.y - 0.02, B.z - 0.04)
        : V(sx * bh, B.y - 0.02, B.z - 0.06);
  [1, -1].forEach(sx => {
    const gp = gripP(sx),
      gi = gp.clone().add(V(-sx * 0.1, 0, 0));
    cyl(0.026, 0.026, null, rubber, gi, gp, 12);
    for (let k = 0; k < 6; k++) disc(0.028, 0.006, black, gi.clone().lerp(gp, (k + 0.5) / 6), 12);
    disc(0.027, 0.012, chrome, gp.clone().add(V(sx * 0.008, 0, 0)), 12);
    const perch = gi.clone().add(V(-sx * 0.02, 0, 0));
    box(0.03, 0.03, 0.04, alu, perch.x, perch.y, perch.z);
    tube(
      [
        perch.clone().add(V(0, 0, 0.02)),
        perch.clone().add(V(sx * 0.05, -0.01, 0.07)),
        perch.clone().add(V(sx * 0.12, -0.025, 0.06)),
      ],
      0.006,
      alu,
      12,
    );
    if (sx > 0) box(0.035, 0.03, 0.04, dark, perch.x - 0.035, perch.y + 0.02, perch.z - 0.01);
    tube(
      [
        perch.clone().add(V(0, -0.01, -0.01)),
        perch.clone().add(V(-sx * 0.05, -0.12, 0.04)),
        V(sx * 0.05, H.y - 0.02, H.z + 0.06),
        V(sx * 0.03, H.y - 0.15, H.z - 0.05),
      ],
      0.005,
      black,
      20,
    );
    if (st === 'classic' || st === 'vintage' || st === 'chopper') {
      const ms = gi.clone().add(V(sx * 0.02, 0, -0.01));
      tube([ms, ms.clone().add(V(sx * 0.03, 0.1, -0.02)), ms.clone().add(V(sx * 0.06, 0.2, -0.03))], 0.005, chrome, 10);
      const mr = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 18), chrome);
      mr.position.copy(ms.clone().add(V(sx * 0.07, 0.23, -0.035)));
      mr.rotation.x = Math.PI / 2 - 0.25;
      disc(0.04, 0.002, SM(0x8fb2d0, 0.05, 1), mr.position.clone().add(V(0, 0, -0.007)), 16).rotation.set(
        Math.PI / 2 - 0.25,
        0,
        0,
      );
    }
    if (st === 'sport' || st === 'rocket') {
      const ms = V(sx * 0.2, 0.86, 0.44);
      box(0.08, 0.04, 0.05, paint, ms.x, ms.y, ms.z);
    }
  });
  const dialTex = (() => {
      const [c, x] = cv(64, 64);
      x.fillStyle = '#f2efe6';
      x.beginPath();
      x.arc(32, 32, 30, 0, 7);
      x.fill();
      x.strokeStyle = '#222';
      x.lineWidth = 2;
      for (let k = 0; k < 11; k++) {
        const a = Math.PI * 0.75 + (k / 10) * Math.PI * 1.5;
        x.beginPath();
        x.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22);
        x.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28);
        x.stroke();
      }
      x.strokeStyle = '#e63946';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(32, 32);
      x.lineTo(32 + Math.cos(2.4) * 24, 32 + Math.sin(2.4) * 24);
      x.stroke();
      return tex(c, true);
    })(),
    dialM = new THREE.MeshBasicMaterial({ map: dialTex });
  const pods =
    st === 'dirt'
      ? []
      : st === 'sport' || st === 'rocket'
        ? [[0, 0.0]]
        : [
            [-0.055, 0],
            [0.055, 0],
          ];
  pods.forEach(([dx]) => {
    const p = cl.clone().add(V(dx, 0.07, -0.03)),
      dir = V(0, 0.8, -0.6).normalize();
    const pod = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.05, 20), black);
    pod.position.copy(p);
    pod.quaternion.setFromUnitVectors(YAX, dir);
    const f = mesh(new THREE.CircleGeometry(0.038, 20), dialM);
    f.position.copy(p.clone().addScaledVector(dir, 0.026));
    f.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    const rg = mesh(new THREE.TorusGeometry(0.041, 0.005, 6, 20), chrome);
    rg.position.copy(f.position);
    rg.quaternion.copy(f.quaternion);
  });
  /* ---- lights ---- */
  const hlY = st === 'sport' ? 0.62 : st === 'dirt' ? 0.82 : st === 'rocket' ? 0.72 : H.y - 0.08,
    hlZ = st === 'sport' ? 0.66 : st === 'dirt' ? 0.6 : st === 'rocket' ? 0.66 : H.z + 0.16;
  if (S.light === 'round') {
    const bucket = mesh(new THREE.SphereGeometry(0.08, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), chrome);
    bucket.position.set(0, hlY, hlZ);
    bucket.rotation.x = -Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(0.078, 0.01, 8, 24), chrome);
    ring.position.set(0, hlY, hlZ + 0.002);
    const l = mesh(new THREE.CircleGeometry(0.072, 24), lens);
    l.position.set(0, hlY, hlZ + 0.004);
    [1, -1].forEach(sx => {
      rod(V(sx * 0.07, hlY, hlZ - 0.04), V(sx * fx, hlY + 0.06, H.z + 0.06), 0.008, chrome, 6);
      const ind = sph(0.02, 0.02, 0.03, orangeL, sx * 0.13, hlY - 0.02, hlZ - 0.06, 10);
    });
  }
  if (S.light === 'fair') {
    [1, -1].forEach(sx => {
      const l = mesh(new THREE.CircleGeometry(0.045, 16), lens);
      l.position.set(sx * 0.06, 0.66, 0.705);
      l.rotation.y = sx * 0.35;
      l.rotation.x = -0.3;
    });
  }
  if (S.light === 'plate') {
    const pl = sideX(
      [
        [0.56, 0.66],
        [0.66, 0.72],
        [0.6, 0.98],
        [0.5, 0.9],
      ],
      0.18,
      SM(0xf2f2f2, 0.5, 0),
      0.15,
      0.012,
    );
    const l = mesh(new THREE.CircleGeometry(0.035, 16), lens);
    l.position.set(0, 0.8, 0.66);
    l.rotation.x = -0.4;
  }
  if (S.light === 'jet') {
    const l = mesh(new THREE.CircleGeometry(0.05, 16), lens);
    l.position.set(0, 0.66, 0.66);
    l.rotation.x = -0.5;
  }
  const tY =
      st === 'chopper'
        ? seatTop + 0.06
        : st === 'dirt'
          ? 0.86
          : S.seatP.reduce((a, p) => (p[0] < a[0] ? p : a))[1] - 0.02,
    tZ = (st === 'chopper' ? AR.z + 0.2 : Math.min(...S.seatP.map(p => p[0]))) - 0.04;
  box(0.1, 0.035, 0.03, tailM, 0, tY, tZ);
  if (st !== 'dirt' && st !== 'rocket') {
    box(0.16, 0.1, 0.008, SM(0xf2d23a, 0.5, 0), 0, tY - 0.12, tZ + 0.01, 0.25);
    [1, -1].forEach(sx => sph(0.018, 0.018, 0.025, orangeL, sx * 0.12, tY - 0.03, tZ + 0.02, 8));
  }
  /* ---- footpegs, levers, stand ---- */
  [1, -1].forEach(sx => {
    const pg = V(sx * 0.17, S.peg[0], S.peg[1]);
    cyl(0.016, 0.016, null, black, V(sx * 0.08, pg.y, pg.z), pg, 8);
    for (let k = 0; k < 4; k++) disc(0.019, 0.006, dark, V(sx * (0.1 + k * 0.02), pg.y, pg.z), 8);
    tube(
      [
        V(sx * 0.09, pg.y + 0.02, pg.z + 0.02),
        V(sx * 0.13, pg.y + 0.04, pg.z + 0.12),
        V(sx * 0.15, pg.y + 0.07, pg.z + 0.16),
      ],
      0.007,
      alu,
      10,
    );
  });
  if (st !== 'rocket')
    tube([V(-0.1, PV.y - 0.12, PV.z + 0.1), V(-0.12, 0.12, PV.z + 0.02), V(-0.13, 0.03, PV.z - 0.12)], 0.009, dark, 12);
  /* ---- glow sprites ---- */
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfff0c0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
    }),
  );
  glow.scale.setScalar(0.36);
  glow.position.set(0, hlY, hlZ + 0.06);
  m.add(glow);
  const tl = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xff2030,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    }),
  );
  tl.scale.setScalar(0.2);
  tl.position.set(0, tY, tZ - 0.03);
  m.add(tl);
  if (st === 'rocket') {
    const fl = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x6fd3ff,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    fl.scale.setScalar(0.55);
    fl.position.set(0, E.y, E.z - 0.9);
    m.add(fl);
  }
  mergeGroup(SG);
  // patterns that have a direction (flames) start at the front of the tank
  if (paint.userData.triOff) paint.userData.triOff.value.z = -(Math.max(...S.tank.map(p => p[0])) + 0.03);
  /* ---- rider ---- */
  m.add(rider);
  const RA = [S, st, C, o, P, { fx, gripP, cl }],
    R_ = RIDER_GLTF ? buildRiderModel(rider, ...RA) : buildRider(rider, ...RA);
  neonify(g);
  envify(g);
  const out = {
    g,
    m,
    rider,
    wheels,
    glow,
    flutter: R_.flutter,
    trick: R_.trick,
    limbs: R_.limbs,
    poseTrick: R_.poseTrick,
    riderArgs: RA,
    riderBase: rider.position.clone(),
  };
  if (!RIDER_GLTF) riderWaiting.add(out);
  return out;
}

export function initBike() {
  _bv1 = new V3();
  _bv2 = new V3();
}

export { makeBike, mergeGroup };
