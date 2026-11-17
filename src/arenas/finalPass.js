import * as THREE from 'three';
import { cv, glowTex, tex } from '../render/textures.js';
import { mergeGeos, rockGeo, seeded } from './reef.js';
import { model } from './models.js';

/* ---------- detail pass for Beach, Sky crane and the Pirate ship (hand-built) ----------
   moreBeach(g): lifeguard tower, a long wooden pier with lamps and a kiosk, a row of striped beach huts,
     surfboards, a volleyball court, dune grass and shore rocks, a lighthouse on a rocky islet.
   moreCrane(g): rooftop life on the real towers (aircraft warning lights, antenna masts, water tanks,
     plant rooms), neon billboards on the faces looking at the arena, sweeping searchlights, and a parapet
     with an LED strip round our own roof.
   morePirateSea(g): a kraken whose tentacles rise out of the sea now and then, a lighthouse on the island
     we sail past, floating barrels and crates. */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const YA = V(0, 1, 0);
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
const basic = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
function rod(par, a, b, r, m, seg = 6) {
  const e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg), m);
  e.position.copy(a).add(b).multiplyScalar(0.5);
  e.quaternion.setFromUnitVectors(YA, b.clone().sub(a).normalize());
  par.add(e);
  return e;
}
const glow = (c, s, op = 1) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
  sp.scale.setScalar(s);
  return sp;
};
const addTick = (g, f) => {
  const p = g.userData.tick;
  g.userData.tick = t => {
    if (p) p(t);
    f(t);
  };
};
const box = (par, w, h, d, m, x, y, z) => {
  const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  e.position.set(x, y, z);
  par.add(e);
  return e;
};
/* a pitched roof: a triangular prism with a little overhang (ridge along x) */
function roofGeo(w, d, h, over = 0.2) {
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2 - over, 0);
  sh.lineTo(d / 2 + over, 0);
  sh.lineTo(0, h);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: w + over * 2, bevelEnabled: false });
  g.translate(0, 0, -(w + over * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
/* vertical stripes canvas (beach huts, awnings) */
function stripes(a, b, n = 8, w = 128, h = 128) {
  const [c, x] = cv(w, h);
  for (let i = 0; i < n; i++) {
    x.fillStyle = i % 2 ? b : a;
    x.fillRect((i * w) / n, 0, w / n + 1, h);
  }
  return tex(c, true);
}

/* ---- a lighthouse: tapered red-and-white tower, gallery with railing, glass lantern room, dome, turning beams ---- */
function lighthouse(H = 16, withBeams = true) {
  // many rings, with a pair at each band edge, so the red and white bands are crisp
  const prof = [];
  for (let i = 0; i <= 5; i++) {
    const y0 = (i / 5) * H,
      r = y => 3.0 - 1.1 * (y / H) - 0.25 * Math.sin((Math.PI * y) / H);
    if (i > 0) prof.push(new THREE.Vector2(r(y0 - 0.02), y0 - 0.02));
    prof.push(new THREE.Vector2(r(y0), y0));
  }
  prof.push(new THREE.Vector2(0.01, H));
  const L = new THREE.Group(),
    tg = new THREE.LatheGeometry(prof, 28),
    p = tg.attributes.position,
    col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const band = Math.floor(((p.getY(i) + 0.01) / H) * 5) % 2;
    band ? col.set([0.78, 0.1, 0.12], i * 3) : col.set([0.96, 0.95, 0.92], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  L.add(new THREE.Mesh(tg, std(0xffffff, { vertexColors: true, roughness: 0.6 })));
  const dark = std(0x23262c, { metalness: 0.6, roughness: 0.4 }),
    red = std(0xa8141e, { roughness: 0.4, metalness: 0.3 });
  // a door and two little windows up the tower
  box(L, 1.0, 1.8, 0.2, dark, 0, 0.9, 2.92);
  [0.35, 0.65].forEach(f => box(L, 0.45, 0.7, 0.2, basic(0xffe9b0), 0, H * f, 2.95 - f * 0.95));
  // gallery deck + railing
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.4, 0.35, 24), dark);
  deck.position.y = H + 0.17;
  L.add(deck);
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    rod(L, V(Math.cos(a) * 2.6, H + 0.3, Math.sin(a) * 2.6), V(Math.cos(a) * 2.6, H + 1.3, Math.sin(a) * 2.6), 0.04, dark, 4);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 6, 32), dark);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = H + 1.3;
  L.add(rail);
  // lantern room: glowing glass between mullions
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.2, 16, 1, true), basic(0xfff1b0, { transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  glass.position.y = H + 1.5;
  L.add(glass);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    rod(L, V(Math.cos(a) * 1.52, H + 0.4, Math.sin(a) * 1.52), V(Math.cos(a) * 1.52, H + 2.6, Math.sin(a) * 1.52), 0.06, dark, 4);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = H + 2.6;
  L.add(dome);
  rod(L, V(0, H + 4.2, 0), V(0, H + 5.2, 0), 0.06, dark, 4);
  const halo = glow(0xfff0b0, 9, 0.9);
  halo.position.y = H + 1.5;
  L.add(halo);
  // two long beams turning round
  const beamM = new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    beams = new THREE.Group();
  beams.position.y = H + 1.5;
  [0, Math.PI].forEach(a => {
    // short enough that it never sweeps over the arena itself
    const cone = new THREE.ConeGeometry(3.2, 26, 16, 1, true);
    cone.translate(0, -13, 0);
    const b = new THREE.Mesh(cone, beamM);
    b.rotation.z = Math.PI / 2;
    b.rotation.y = a;
    beams.add(b);
  });
  if (withBeams) L.add(beams);
  L.userData.spin = t => (beams.rotation.y = t * 0.6);
  return L;
}

/* ======================= BEACH ======================= */
function moreBeach(g) {
  const rnd = seeded(91),
    P = (a, r, y = 0) => V(Math.cos(a) * r, y, Math.sin(a) * r),
    white = std(0xf4f1ea, { roughness: 0.6 }),
    wood = std(0x9a6a3e, { roughness: 0.85 }),
    darkWood = std(0x5e3d22, { roughness: 0.9 }),
    o = new THREE.Object3D(),
    col = new THREE.Color();
  const face = (grp, a, r) => {
    grp.position.copy(P(a, r));
    grp.lookAt(0, 0, 0); // +z toward the arena
    g.add(grp);
    return grp;
  };

  /* --- lifeguard tower --- */
  {
    const T = new THREE.Group(),
      blue = std(0x2f7fd0, { roughness: 0.55 }),
      redM = std(0xd8262f, { roughness: 0.5 });
    for (const [x, z] of [
      [-1.15, -1.15],
      [1.15, -1.15],
      [-1.15, 1.15],
      [1.15, 1.15],
    ])
      rod(T, V(x * 1.15, 0, z * 1.15), V(x, 3.3, z), 0.11, white, 8);
    // cross braces on each side
    for (const s of [-1, 1]) {
      rod(T, V(-1.25 * 1.0, 0.3, s * 1.25), V(1.1, 3.0, s * 1.1), 0.05, white);
      rod(T, V(1.25, 0.3, s * 1.25), V(-1.1, 3.0, s * 1.1), 0.05, white);
      rod(T, V(s * 1.25, 0.3, -1.25), V(s * 1.1, 3.0, 1.1), 0.05, white);
    }
    box(T, 3.2, 0.16, 3.2, wood, 0, 3.38, 0);
    // the hut: blue clapboard with white trim, a wide front window and a pitched red roof
    const hut = box(T, 2.4, 1.9, 2.2, blue, 0, 4.4, -0.2);
    void hut;
    for (let k = 0; k < 6; k++) box(T, 2.44, 0.03, 2.24, std(0x2668b0), 0, 3.6 + k * 0.3, -0.2);
    box(T, 1.9, 0.8, 0.05, basic(0x1a2a3a), 0, 4.7, 0.92);
    box(T, 2.0, 0.08, 0.1, white, 0, 4.28, 0.95);
    box(T, 2.0, 0.08, 0.1, white, 0, 5.12, 0.95);
    const roof = new THREE.Mesh(roofGeo(2.4, 2.2, 0.9, 0.25), redM);
    roof.position.set(0, 5.35, -0.2);
    T.add(roof);
    // railing round the front of the deck
    for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) rod(T, V(x, 3.45, 1.5), V(x, 4.3, 1.5), 0.04, white, 4);
    rod(T, V(-1.55, 4.3, 1.5), V(1.55, 4.3, 1.5), 0.05, white, 6);
    // a ramp down to the sand, with treads
    const ramp = box(T, 0.9, 0.08, 4.4, wood, 1.1, 1.75, 3.4);
    ramp.rotation.x = 0.85;
    for (let k = 0; k < 9; k++) {
      const tr = box(T, 0.9, 0.06, 0.06, darkWood, 1.1, 0.3 + k * 0.33, 4.9 - k * 0.37);
      void tr;
    }
    // flag pole with a red and yellow flag, and a life ring on the wall
    rod(T, V(-1.3, 5.3, -1.1), V(-1.3, 8.2, -1.1), 0.04, white, 6);
    const [fc, fx] = cv(64, 32);
    fx.fillStyle = '#d8262f';
    fx.fillRect(0, 0, 64, 16);
    fx.fillStyle = '#f4c20d';
    fx.fillRect(0, 16, 64, 16);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75, 6, 1), basic(0xffffff, { map: tex(fc, true), side: THREE.DoubleSide }));
    flag.position.set(-0.62, 7.75, -1.1);
    T.add(flag);
    T.userData.flag = flag;
    const ringG = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const seg = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 10, Math.PI / 2), k % 2 ? white : std(0xff6a1a));
      seg.rotation.z = (k * Math.PI) / 2;
      ringG.add(seg);
    }
    ringG.position.set(0.9, 4.3, 0.95);
    T.add(ringG);
    face(T, -0.25, 27.5);
    g.userData.lgFlag = flag;
  }

  /* --- the pier: planks on piles, rails, lamps, and a kiosk at the end --- */
  {
    const pier = new THREE.Group(),
      LEN = 46,
      W = 3.2,
      DY = 0.95;
    pier.position.copy(P(-Math.PI / 2, 31));
    pier.rotation.y = Math.PI; // +z runs out to sea (−z in the world)
    g.add(pier);
    const NP = Math.floor(LEN / 0.34),
      planks = new THREE.InstancedMesh(new THREE.BoxGeometry(W, 0.09, 0.3), std(0xffffff, { roughness: 0.9 }), NP);
    for (let i = 0; i < NP; i++) {
      o.position.set((rnd() - 0.5) * 0.05, DY, 0.2 + i * 0.34);
      o.rotation.set(0, (rnd() - 0.5) * 0.02, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      planks.setMatrixAt(i, o.matrix);
      const v = 0.62 + rnd() * 0.22;
      planks.setColorAt(i, col.setRGB(v * 0.8, v * 0.6, v * 0.42));
    }
    pier.add(planks);
    // piles in pairs, with cross bracing under the deck
    const NPile = Math.floor(LEN / 3) + 1,
      piles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.2, 4.2, 8), darkWood, NPile * 2);
    for (let i = 0; i < NPile; i++)
      for (const s of [-1, 1]) {
        o.position.set(s * (W / 2 - 0.05), DY - 2.0, 0.3 + i * 3);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        piles.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), o.matrix);
      }
    pier.add(piles);
    for (let i = 0; i < NPile - 1; i++) {
      rod(pier, V(-W / 2, DY - 0.15, 0.3 + i * 3), V(W / 2, DY - 1.4, 0.3 + i * 3 + 1.5), 0.05, darkWood, 4);
      rod(pier, V(W / 2, DY - 0.15, 0.3 + i * 3), V(-W / 2, DY - 1.4, 0.3 + i * 3 + 1.5), 0.05, darkWood, 4);
    }
    // rails and balusters
    for (const s of [-1, 1]) {
      rod(pier, V(s * (W / 2 - 0.05), DY + 1.0, 0), V(s * (W / 2 - 0.05), DY + 1.0, LEN), 0.05, white, 6);
      const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), white, Math.floor(LEN / 1.2));
      for (let i = 0; i < bal.count; i++) {
        o.position.set(s * (W / 2 - 0.05), DY + 0.5, i * 1.2);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        bal.setMatrixAt(i, o.matrix);
      }
      pier.add(bal);
    }
    // lamp posts with warm lanterns
    for (let i = 1; i * 9 < LEN; i++)
      for (const s of [-1, 1]) {
        const x = s * (W / 2 - 0.05),
          z = i * 9;
        rod(pier, V(x, DY, z), V(x, DY + 3.2, z), 0.06, std(0x1d1f24, { metalness: 0.5 }), 6);
        const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.42, 6), basic(0xffe2a0));
        lan.position.set(x, DY + 3.35, z);
        pier.add(lan);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 6), std(0x1d1f24));
        cap.position.set(x, DY + 3.68, z);
        pier.add(cap);
        const gl = glow(0xffd890, 2.4, 0.8);
        gl.position.set(x, DY + 3.35, z);
        pier.add(gl);
      }
    // the kiosk at the end: a striped awning over a little hut, a bench, a fishing rod leaning on the rail
    const K = new THREE.Group();
    K.position.set(0, DY, LEN - 2.2);
    pier.add(K);
    box(K, 2.4, 2.1, 1.8, std(0xf7f2e4), 0, 1.05, 0);
    box(K, 1.4, 0.7, 0.05, basic(0x1f2f3a), 0, 1.35, -0.92);
    box(K, 2.6, 0.12, 0.6, wood, 0, 0.95, -1.15);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.1, 1, 1), std(0xffffff, { map: stripes('#e8453a', '#f7f2e4', 10), side: THREE.DoubleSide }));
    awn.position.set(0, 2.15, -1.25);
    awn.rotation.x = -0.6;
    K.add(awn);
    const roofK = new THREE.Mesh(roofGeo(2.4, 1.8, 0.7, 0.2), std(0x2a6fb0));
    roofK.position.set(0, 2.1, 0);
    K.add(roofK);
    const [sc, sx] = cv(256, 64);
    sx.fillStyle = '#123a6e';
    sx.fillRect(0, 0, 256, 64);
    sx.fillStyle = '#ffd23f';
    sx.font = '900 40px Impact, "Arial Black", sans-serif';
    sx.textAlign = 'center';
    sx.textBaseline = 'middle';
    sx.fillText('SURF SHACK', 128, 34);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), basic(0xffffff, { map: tex(sc, true) }));
    sign.position.set(0, 2.65, -0.95);
    sign.rotation.y = Math.PI;
    K.add(sign);
    rod(K, V(1.45, 0, -2.6), V(1.3, 3.2, -4.8), 0.03, darkWood, 4);
  }

  /* --- a row of striped beach huts, each its own colours, doors and number --- */
  {
    const pairs = [
      ['#e8453a', '#f7f2e4'],
      ['#2f7fd0', '#f7f2e4'],
      ['#f4c20d', '#f7f2e4'],
      ['#2fa86a', '#f7f2e4'],
      ['#ff7aa8', '#f7f2e4'],
      ['#7a4ad0', '#f7f2e4'],
      ['#ff8f1a', '#f7f2e4'],
    ];
    pairs.forEach(([a, b], i) => {
      const H = new THREE.Group(),
        body = std(0xffffff, { map: stripes(a, b, 8), roughness: 0.7 });
      box(H, 2.2, 2.3, 2.0, body, 0, 1.4, 0);
      box(H, 2.4, 0.2, 2.3, darkWood, 0, 0.15, 0.1); // little raised floor
      box(H, 2.5, 0.12, 0.5, wood, 0, 0.32, 1.25); // front step
      const roof = new THREE.Mesh(roofGeo(2.2, 2.0, 0.95, 0.22), white);
      roof.position.y = 2.55;
      H.add(roof);
      box(H, 0.9, 1.6, 0.05, std(new THREE.Color(a).multiplyScalar(0.75).getHex()), 0, 1.25, 1.02);
      box(H, 1.05, 0.08, 0.08, white, 0, 2.08, 1.04);
      [-0.5, 0.5].forEach(x => box(H, 0.06, 1.7, 0.08, white, x, 1.25, 1.04));
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0xd4a017, { metalness: 0.9, roughness: 0.3 }));
      kn.position.set(0.3, 1.2, 1.08);
      H.add(kn);
      // number plaque
      const [nc, nx] = cv(64, 64);
      nx.fillStyle = '#f7f2e4';
      nx.beginPath();
      nx.arc(32, 32, 30, 0, 7);
      nx.fill();
      nx.fillStyle = '#1d1f24';
      nx.font = '900 40px Impact, "Arial Black", sans-serif';
      nx.textAlign = 'center';
      nx.textBaseline = 'middle';
      nx.fillText(String(i + 1), 32, 35);
      const plq = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), basic(0xffffff, { map: tex(nc, true) }));
      plq.position.set(0, 2.32, 1.03);
      H.add(plq);
      face(H, Math.PI - 0.48 + i * 0.16, 27.5);
    });
  }

  /* --- surfboards stuck upright in the sand by the huts --- */
  {
    const geo = new THREE.SphereGeometry(1, 24, 14),
      p = geo.attributes.position,
      vc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      x *= 1 - Math.pow(Math.max(0, y), 2.2) * 0.75; // pointed nose
      p.setXYZ(i, x * 0.3, y * 1.15, z * 0.045);
      const stripe = Math.abs(x) < 0.12;
      vc.set(stripe ? [0.1, 0.1, 0.12] : [1, 1, 1], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(vc, 3));
    geo.computeVertexNormals();
    geo.translate(0, 1.0, 0);
    const boards = new THREE.InstancedMesh(geo, std(0xffffff, { vertexColors: true, roughness: 0.25, metalness: 0.1 }), 9),
      cols = [0xff5a3d, 0x2fb8e8, 0xf4c20d, 0x7ad04a, 0xff7ad0, 0xffffff, 0x2f5fd0, 0xff9a2a, 0x3ad0b0];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i < 5 ? -0.66 - i * 0.035 : 0.62 + (i - 5) * 0.035),
        r = 26 + (i % 2) * 0.6;
      o.position.copy(P(a, r, -0.15));
      o.rotation.set(0, -a + Math.PI / 2, (rnd() - 0.5) * 0.3);
      o.rotateX((rnd() - 0.5) * 0.2);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      boards.setMatrixAt(i, o.matrix);
      boards.setColorAt(i, col.setHex(cols[i]));
    }
    g.add(boards);
  }

  /* --- volleyball court: posts, a real net, boundary rope, the ball --- */
  {
    const C = new THREE.Group(),
      [nc, nx] = cv(128, 32);
    nx.strokeStyle = '#fff';
    nx.lineWidth = 2;
    for (let x = 0; x <= 128; x += 8) {
      nx.beginPath();
      nx.moveTo(x, 0);
      nx.lineTo(x, 32);
      nx.stroke();
    }
    for (let y = 0; y <= 32; y += 8) {
      nx.beginPath();
      nx.moveTo(0, y);
      nx.lineTo(128, y);
      nx.stroke();
    }
    nx.fillStyle = '#fff';
    nx.fillRect(0, 0, 128, 4);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.0), basic(0x111111, { alphaMap: tex(nc), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
    net.material.color.setHex(0x222222);
    net.position.y = 2.0;
    C.add(net);
    for (const s of [-1, 1]) rod(C, V(s * 3.7, 0, 0), V(s * 3.7, 2.55, 0), 0.07, std(0xe8e8e8, { metalness: 0.6 }), 8);
    const rope = std(0x2f7fd0);
    for (const [a, b] of [
      [V(-4, 0.04, -4.5), V(4, 0.04, -4.5)],
      [V(4, 0.04, -4.5), V(4, 0.04, 4.5)],
      [V(4, 0.04, 4.5), V(-4, 0.04, 4.5)],
      [V(-4, 0.04, 4.5), V(-4, 0.04, -4.5)],
    ])
      rod(C, a, b, 0.04, rope, 4);
    const bc = cv(128, 64),
      bx = bc[1];
    ['#f4c20d', '#2f7fd0', '#ffffff'].forEach((c, k) => {
      bx.fillStyle = c;
      bx.fillRect((k * 128) / 3, 0, 128 / 3 + 1, 64);
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), std(0xffffff, { map: tex(bc[0], true), roughness: 0.5 }));
    ball.position.set(1.4, 0.22, 2);
    C.add(ball);
    face(C, 0.36 * Math.PI, 27);
  }

  /* --- dune grass in tufts along the back of the beach, rocks at the waterline --- */
  {
    const blades = [];
    for (let k = 0; k < 9; k++) {
      const b = new THREE.PlaneGeometry(0.07, 1, 1, 3);
      b.translate(0, 0.5, 0);
      const p = b.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        p.setX(i, p.getX(i) * (1 - y));
        p.setZ(i, y * y * 0.35);
      }
      b.rotateY((k / 9) * Math.PI * 2);
      b.rotateX(0);
      blades.push(b);
    }
    const tuft = mergeGeos(blades),
      gm = std(0x9aa45a, { side: THREE.DoubleSide, roughness: 0.9 }),
      N = 90,
      tufts = new THREE.InstancedMesh(tuft, gm, N);
    for (let i = 0; i < N; i++) {
      let a;
      do a = rnd() * Math.PI * 2;
      while (Math.abs(((a + Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.12); // keep the pier clear
      o.position.copy(P(a, 22 + rnd() * 10));
      o.rotation.set(0, rnd() * 6, 0);
      o.scale.setScalar(0.6 + rnd() * 0.9);
      o.updateMatrix();
      tufts.setMatrixAt(i, o.matrix);
      tufts.setColorAt(i, col.setHSL(0.17 + rnd() * 0.06, 0.4, 0.42 + rnd() * 0.15));
    }
    g.add(tufts);
    const rocks = new THREE.InstancedMesh(rockGeo(5.3, 2), std(0x9a8f80, { vertexColors: true, flatShading: true, roughness: 0.9 }), 14);
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + 0.35 + (i / 14) * 1.6 + (rnd() - 0.5) * 0.1;
      o.position.copy(P(a, 33 + rnd() * 3, -0.2));
      o.rotation.set(0, rnd() * 6, 0);
      const s = 0.8 + rnd() * 1.8;
      o.scale.set(s * 1.2, s * 0.7, s);
      o.updateMatrix();
      rocks.setMatrixAt(i, o.matrix);
    }
    g.add(rocks);
  }

  /* --- a lighthouse on a rocky islet out in the bay --- */
  const LH = lighthouse(17, false); // daytime: no beams
  {
    const islet = new THREE.Group(),
      rm = std(0x7d7468, { vertexColors: true, flatShading: true, roughness: 0.95 });
    [
      [0, 0, 7, 3.2],
      [5, 3, 4, 2],
      [-5, 2, 4.5, 2.4],
      [2, -5, 3.5, 1.8],
    ].forEach(([x, z, s, h], k) => {
      const m = new THREE.Mesh(rockGeo(3 + k * 1.7, 2, true), rm);
      m.position.set(x, -0.6, z);
      m.scale.set(s, h, s * 0.9);
      islet.add(m);
    });
    LH.position.y = 1.4;
    LH.scale.setScalar(0.9);
    islet.add(LH);
    islet.position.copy(P(-Math.PI / 2 + 0.85, 74));
    g.add(islet);
  }

  addTick(g, t => {
    LH.userData.spin(t);
    const f = g.userData.lgFlag;
    if (f) {
      const p = f.geometry.attributes.position;
      if (!f.userData.base) f.userData.base = Float32Array.from(p.array);
      const b = f.userData.base;
      for (let i = 0; i < p.count; i++) p.array[i * 3 + 2] = Math.sin(b[i * 3] * 4 - t * 7) * 0.12 * (b[i * 3] + 0.65);
      p.needsUpdate = true;
    }
  });
  return g;
}

/* ======================= SKY CRANE ======================= */
function moreCrane(g) {
  const rnd = seeded(17),
    o = new THREE.Object3D(),
    col = new THREE.Color(),
    towers = (g.userData.towers || []).filter(t => Math.hypot(t.x, t.z) < 230),
    grey = std(0x3a3d46, { roughness: 0.6, metalness: 0.4 }),
    steel = std(0x8a9099, { metalness: 0.7, roughness: 0.4 });
  const tall = towers.filter(t => t.top > 0).sort((a, b) => b.top - a.top);

  /* aircraft warning lights on every tall tower, blinking together like the real thing */
  const warnM = basic(0xff2030),
    warn = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), warnM, tall.length);
  tall.forEach((t, i) => {
    o.position.set(t.x, t.top + 0.6, t.z);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    warn.setMatrixAt(i, o.matrix);
  });
  g.add(warn);

  /* antenna masts on the tallest few: a tapering lattice spike with a beacon on top */
  tall.slice(0, 14).forEach(t => {
    const h = 10 + rnd() * 14,
      base = V(t.x, t.top, t.z);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      rod(g, base.clone().add(V(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9)), base.clone().add(V(0, h, 0)), 0.09, steel, 4);
    }
    for (let j = 1; j < 5; j++) {
      const y = (j / 5) * h,
        r = 0.9 * (1 - j / 5);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.05, r), 0.05, 4, 3), steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(t.x, t.top + y, t.z);
      g.add(ring);
    }
    const b = glow(0xff3040, 4);
    b.position.set(t.x, t.top + h + 0.4, t.z);
    g.add(b);
    t.mast = b;
  });

  /* old-style wooden water tanks on mid towers, and plant rooms (with vents) on others */
  {
    const mid = towers.filter(t => t.top > -40 && t.top < 30).slice(0, 40),
      tankG = (() => {
        const pr = [
          [1.6, 0],
          [1.6, 3.2],
          [1.7, 3.2],
          [0.05, 4.6],
        ].map(q => new THREE.Vector2(q[0], q[1]));
        const geo = new THREE.LatheGeometry(pr, 16),
          p = geo.attributes.position,
          vc = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i),
            hoop = y < 3.2 && Math.abs((y % 1.0) - 0.5) < 0.06;
          vc.set(y >= 3.2 ? [0.22, 0.2, 0.22] : hoop ? [0.15, 0.14, 0.14] : [0.62, 0.42, 0.28], i * 3);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(vc, 3));
        geo.computeVertexNormals();
        return geo;
      })(),
      tanks = new THREE.InstancedMesh(tankG, std(0xffffff, { vertexColors: true, roughness: 0.9 }), 20),
      legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 5), grey, 80),
      plant = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), grey, 20),
      vents = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12), steel, 40);
    for (let i = 0; i < 20; i++) {
      const t = mid[i * 2] || mid[0],
        u = mid[i * 2 + 1] || mid[0];
      if (!t) break;
      const ox = (rnd() - 0.5) * t.w * 0.3,
        oz = (rnd() - 0.5) * t.w * 0.3;
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.position.set(t.x + ox, t.top + 2.4, t.z + oz);
      o.updateMatrix();
      tanks.setMatrixAt(i, o.matrix);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.78;
        o.position.set(t.x + ox + Math.cos(a) * 1.3, t.top + 1.2, t.z + oz + Math.sin(a) * 1.3);
        o.updateMatrix();
        legs.setMatrixAt(i * 4 + k, o.matrix);
      }
      if (u) {
        o.position.set(u.x, u.top + 1.1, u.z);
        o.scale.set(u.w * 0.5, 2.2, u.w * 0.35);
        o.updateMatrix();
        plant.setMatrixAt(i, o.matrix);
        o.scale.set(1, 1, 1);
        for (let k = 0; k < 2; k++) {
          o.position.set(u.x + (k ? 1 : -1) * u.w * 0.12, u.top + 2.3, u.z);
          o.updateMatrix();
          vents.setMatrixAt(i * 2 + k, o.matrix);
        }
      }
    }
    g.add(tanks, legs, plant, vents);
  }

  /* neon billboards on the tower faces that look at the arena */
  {
    const ADS = [
      ['GLOBE RIDERS', '#ff2e88', '#120018'],
      ['NITRO', '#2ef0ff', '#001418'],
      ['TURBO', '#ffd23f', '#181000'],
      ['MOTO WORLD', '#7cff6b', '#031400'],
      ['APEX', '#ff5a2e', '#180600'],
      ['FULL THROTTLE', '#b98cff', '#0e0018'],
      ['HOT LAP', '#ff3b5c', '#18000a'],
      ['RED LINE', '#ffffff', '#1a0004'],
    ];
    const near = towers
      .filter(t => t.top > 0 && Math.hypot(t.x, t.z) < 150)
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
      .slice(0, 12);
    near.forEach((t, i) => {
      const [txt, fg, bg] = ADS[i % ADS.length],
        [c, x] = cv(512, 256);
      x.fillStyle = bg;
      x.fillRect(0, 0, 512, 256);
      x.strokeStyle = fg;
      x.lineWidth = 8;
      x.shadowColor = fg;
      x.shadowBlur = 24;
      x.strokeRect(14, 14, 484, 228);
      x.fillStyle = fg;
      x.font = `900 ${txt.length > 9 ? 70 : 104}px Impact, "Arial Black", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(txt, 256, 134);
      x.shadowBlur = 0;
      x.fillStyle = '#ffffff';
      x.globalAlpha = 0.85;
      x.fillText(txt, 256, 134);
      const m = basic(0xffffff, { map: tex(c, true) }),
        // the face of the box that points most toward the arena
        ax = Math.abs(t.x) > Math.abs(t.z) ? 'x' : 'z',
        sgn = -Math.sign(ax === 'x' ? t.x : t.z),
        bw = t.w * 0.8,
        bh = bw * 0.5,
        bb = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), m),
        y = t.top - 6 - bh / 2;
      if (ax === 'x') {
        bb.position.set(t.x + sgn * (t.w / 2 + 0.25), y, t.z);
        bb.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        bb.position.set(t.x, y, t.z + sgn * (t.w / 2 + 0.25));
        bb.rotation.y = sgn > 0 ? 0 : Math.PI;
      }
      g.add(bb);
      const gl = glow(new THREE.Color(fg).getHex(), bw * 1.4, 0.35);
      gl.position.copy(bb.position);
      g.add(gl);
      // a steel frame behind it
      const fr = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.6, bh + 0.6, 0.3), grey);
      fr.position.copy(bb.position);
      fr.rotation.copy(bb.rotation);
      fr.translateZ(-0.2);
      g.add(fr);
    });
  }

  /* searchlights sweeping the sky from four rooftops */
  const lights = [];
  {
    const beamM = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    tall.slice(14, 18).forEach((t, i) => {
      const cone = new THREE.ConeGeometry(5, 150, 18, 1, true);
      cone.translate(0, -75, 0);
      const b = new THREE.Mesh(cone, beamM),
        pv = new THREE.Group();
      pv.position.set(t.x, t.top + 1, t.z);
      b.rotation.x = Math.PI; // point up
      pv.add(b);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.2, 12), grey);
      pv.add(lamp);
      g.add(pv);
      pv.userData.ph = i * 1.7;
      lights.push(pv);
    });
  }

  /* our own roof: a parapet wall with a coping rail and an LED strip */
  {
    const par = new THREE.Mesh(new THREE.CylinderGeometry(19.05, 19.05, 1.3, 64, 1, true), std(0x2c2a33, { side: THREE.DoubleSide }));
    par.position.y = -11.4;
    g.add(par);
    const cope = new THREE.Mesh(new THREE.TorusGeometry(19.05, 0.14, 6, 96), steel);
    cope.rotation.x = Math.PI / 2;
    cope.position.y = -10.72;
    g.add(cope);
    const led = new THREE.Mesh(new THREE.TorusGeometry(19.15, 0.06, 4, 96), basic(0x2ef0ff));
    led.rotation.x = Math.PI / 2;
    led.position.y = -11.0;
    g.add(led);
  }

  addTick(g, t => {
    // blink: on 0.6 s, off 1.4 s
    const on = t % 2 < 0.6;
    warnM.color.setHex(on ? 0xff2030 : 0x2a0606);
    tall.forEach(tw => tw.mast && (tw.mast.material.opacity = on ? 1 : 0.15));
    lights.forEach(pv => {
      const ph = pv.userData.ph;
      pv.rotation.set(Math.sin(t * 0.3 + ph) * 0.45, t * 0.2 + ph, Math.cos(t * 0.23 + ph) * 0.35);
    });
  });
  void col;
  return g;
}

/* ======================= PIRATE SHIP ======================= */
function morePirateSea(g) {
  const rnd = seeded(23),
    uT = { value: 0 };
  /* the kraken: six tentacles rising out of the sea now and then, waving, then sinking back */
  const K = new THREE.Group();
  {
    const H = 13,
      geo = new THREE.CylinderGeometry(0.12, 1.15, H, 14, 48, false);
    geo.translate(0, H / 2, 0);
    const p = geo.attributes.position,
      nrm = geo.attributes.normal,
      vc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / H,
        inner = nrm.getZ(i) > 0.35, // the sucker side
        sucker = inner && Math.abs((y * 22) % 1 - 0.5) < 0.24;
      vc.set(sucker ? [0.95, 0.78, 0.74] : inner ? [0.78, 0.45, 0.5] : [0.45 - y * 0.1, 0.12, 0.32 + y * 0.08], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(vc, 3));
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 0.9;
        float y = transformed.y / ${H.toFixed(1)};
        float curl = y * y;
        transformed.z += sin(uT * 1.6 + ph + y * 3.0) * curl * 4.5;
        transformed.x += cos(uT * 1.2 + ph * 1.7 + y * 2.4) * curl * 2.0;
        transformed.y -= curl * 1.5;`,
      );
    };
    const N = 6,
      tent = new THREE.InstancedMesh(geo, m, N),
      o = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rnd() * 0.4;
      o.position.set(Math.cos(a) * 4, -1, Math.sin(a) * 4);
      o.rotation.set(0, -a + Math.PI / 2, 0);
      o.rotateX(-0.35);
      o.scale.setScalar(0.75 + rnd() * 0.5);
      o.updateMatrix();
      tent.setMatrixAt(i, o.matrix);
    }
    K.add(tent);
    // the churning water where it surfaces
    const foam = new THREE.Mesh(new THREE.CircleGeometry(10, 32), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.05;
    K.userData.foam = foam;
    g.add(foam);
    K.position.set(52, -16, -26);
    g.userData.kraken = K;
    foam.position.x = 52;
    foam.position.z = -26;
    g.add(K);
  }

  /* a lighthouse on the island we sail past */
  const isl = g.userData.island,
    LH = lighthouse(14);
  if (isl) {
    LH.position.set(-6, -0.8, 6);
    LH.scale.setScalar(0.9);
    isl.add(LH);
  }

  /* barrels and crates bobbing in the water */
  const flot = [];
  ['barrel', 'crate', 'barrel', 'crate-bottles', 'barrel', 'crate'].forEach((name, i) => {
    const w = new THREE.Group(),
      a = rnd() * Math.PI * 2,
      r = 24 + rnd() * 30;
    w.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    w.userData = { ph: rnd() * 6, base: w.position.clone(), dr: 0.3 + rnd() * 0.3 };
    model(name)
      .then(mdl => {
        mdl.scale.setScalar(1.3);
        mdl.position.y = -0.7;
        w.add(mdl);
      })
      .catch(() => {});
    g.add(w);
    flot.push(w);
    void i;
  });

  addTick(g, t => {
    uT.value = t;
    LH.userData.spin(t);
    // kraken cycle: 34 s: up over 4 s, wave 9 s, down over 4 s, then hidden
    const k = t % 34,
      up = k < 4 ? k / 4 : k < 13 ? 1 : k < 17 ? 1 - (k - 13) / 4 : 0,
      e = up * up * (3 - 2 * up);
    K.position.y = -16 + e * 15.5;
    K.userData.foam.material.opacity = e * 0.55 * (0.8 + 0.2 * Math.sin(t * 6));
    K.userData.foam.scale.setScalar(0.8 + e * 0.4 + Math.sin(t * 3) * 0.05);
    flot.forEach(w => {
      const u = w.userData;
      w.position.y = Math.sin(t * 1.1 + u.ph) * 0.18;
      w.rotation.set(Math.sin(t * 0.9 + u.ph) * 0.15, t * 0.05 + u.ph, Math.cos(t * 0.8 + u.ph) * 0.12);
      w.position.z = u.base.z + ((t * u.dr) % 60) - 30; // drifting astern
    });
  });
  return g;
}

export { moreBeach, moreCrane, morePirateSea };
