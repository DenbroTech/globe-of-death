import * as THREE from 'three';
import { cv, tex } from '../render/textures.js';
import { makeFigure } from '../rider/rider.js';
import { V3 } from '../core/constants.js';

/* ---------- second detail pass for the premium arenas ----------
   Each moreX(g) adds extra scenery and life to the group built in premium.js and chains onto its tick. */

const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, o));
const seeded = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const addTick = (g, f) => {
  const p = g.userData.tick;
  g.userData.tick = t => {
    if (p) p(t);
    f(t);
  };
};
const glowCache = {};
function glowTex(col) {
  if (glowCache[col]) return glowCache[col];
  const [c, x] = cv(64, 64),
    gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col);
  gr.addColorStop(0.35, col + '88');
  gr.addColorStop(1, col + '00');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return (glowCache[col] = tex(c, true));
}
const glow = (col, s, op = 1) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(col), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
  sp.scale.setScalar(s);
  return sp;
};
const canvasTex = (w, h, draw) => {
  const [c, x] = cv(w, h);
  draw(x, w, h);
  return tex(c, true);
};
function instances(geo, mat, n, f) {
  const im = new THREE.InstancedMesh(geo, mat, n),
    o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    f(o, i);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  return im;
}
/* floating particles (fireflies, dust, data rain): N points that drift via fn(i, t, out) */
function drifters(g, n, col, size, place) {
  const pos = new Float32Array(n * 3),
    geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  g.add(pts);
  const v = new V3();
  return t => {
    for (let i = 0; i < n; i++) {
      place(i, t, v);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
}
const figure = (cid, paint, suit) => {
  try {
    return makeFigure(cid, paint, suit ?? null, null, null, null);
  } catch (e) {
    return new THREE.Group();
  }
};

/* ---------- Crystal cavern ---------- */
function moreCavern(g) {
  const rnd = seeded(111);
  // glowing toadstools in clumps
  const stem = new THREE.CylinderGeometry(0.12, 0.18, 1, 8);
  stem.translate(0, 0.5, 0);
  const cap = new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const spots = Array.from({ length: 9 }, () => {
    const a = rnd() * 6.28,
      r = 18 + rnd() * 30;
    return [Math.cos(a) * r, Math.sin(a) * r, rnd() < 0.5 ? 0x3ff2c8 : 0xff9a3c];
  });
  const N = spots.length * 6,
    pl = [];
  for (let i = 0; i < N; i++) {
    const [x, z] = spots[(i / 6) | 0];
    pl.push([x + (rnd() - 0.5) * 3, z + (rnd() - 0.5) * 3, 0.6 + rnd() * 1.6]);
  }
  g.add(instances(stem, std(0xe8e0d0), N, (o, i) => (o.position.set(pl[i][0], 0, pl[i][1]), o.scale.set(1, pl[i][2], 1))));
  [0x3ff2c8, 0xff9a3c].forEach(c => {
    const list = pl.filter((_, i) => spots[(i / 6) | 0][2] === c);
    g.add(instances(cap, std(c, { emissive: c, emissiveIntensity: 0.9 }), list.length, (o, i) => (o.position.set(list[i][0], list[i][2], list[i][1]), o.scale.setScalar(0.7 + list[i][2] * 0.4))));
  });
  spots.forEach(([x, z, c]) => {
    const s = glow(c === 0x3ff2c8 ? '#3ff2c8' : '#ff9a3c', 6, 0.35);
    s.position.set(x, 1.2, z);
    g.add(s);
  });
  // mine-cart track on an arc, with a cart trundling along it
  const R = 30,
    a0 = 0.6,
    a1 = 2.9;
  const iron = std(0x55565c, { metalness: 0.7, roughness: 0.4 }),
    timber = std(0x5a3c22);
  for (const off of [-0.6, 0.6]) {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / 23;
      return new V3(Math.cos(a) * (R + off), 0.25, Math.sin(a) * (R + off));
    }));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.07, 5), iron));
  }
  g.add(instances(new THREE.BoxGeometry(1.8, 0.15, 0.35), timber, 60, (o, i) => {
    const a = a0 + ((a1 - a0) * i) / 59;
    o.position.set(Math.cos(a) * R, 0.1, Math.sin(a) * R);
    o.rotation.y = -a;
  }));
  const cart = new THREE.Group();
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1, 4, 1, true), std(0x6b4a2a, { side: THREE.DoubleSide }));
  tub.rotation.y = Math.PI / 4;
  tub.scale.set(1.3, 1, 0.9);
  tub.position.y = 1;
  const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), std(0x9a5cff, { emissive: 0x7a3cff, emissiveIntensity: 0.8, flatShading: true }));
  ore.position.y = 1.35;
  cart.add(tub, ore);
  for (const [x, z] of [
    [0.7, 0.55],
    [-0.7, 0.55],
    [0.7, -0.55],
    [-0.7, -0.55],
  ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 12), iron);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.32, z);
    cart.add(w);
  }
  g.add(cart);
  // a waterfall pouring into the lake
  const fallTex = canvasTex(64, 256, (x, w, h) => {
    x.fillStyle = 'rgba(120,200,255,.35)';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      x.fillStyle = `rgba(220,245,255,${0.2 + Math.random() * 0.5})`;
      x.fillRect(Math.random() * w, Math.random() * h, 2, 10 + Math.random() * 30);
    }
  });
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(6, 34), new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  fall.position.set(-34, 17, -42);
  fall.lookAt(0, 17, 0);
  const mist = glow('#bfeaff', 16, 0.4);
  mist.position.set(-33, 1.5, -40);
  g.add(fall, mist);
  // fireflies
  const ff = drifters(g, 90, 0xbaffc8, 0.35, (i, t, v) => {
    const a = i * 2.39 + t * 0.05 * ((i % 3) + 1),
      r = 16 + ((i * 37) % 40);
    v.set(Math.cos(a) * r + Math.sin(t + i) * 1.5, 2 + ((i * 13) % 14) + Math.sin(t * 0.8 + i) * 1.2, Math.sin(a) * r);
  });
  addTick(g, t => {
    const k = (Math.sin(t * 0.25) * 0.5 + 0.5),
      a = a0 + (a1 - a0) * k;
    cart.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    cart.rotation.y = -a;
    fallTex.offset.y = (t * 0.9) % 1;
    ff(t);
  });
  return g;
}

/* ---------- Back garden ---------- */
function moreGarden(g) {
  const rnd = seeded(121);
  // giant sunflowers facing the arena
  for (let i = 0; i < 4; i++) {
    const a = 1.1 + i * 0.5,
      r = 50 + i * 4,
      f = new THREE.Group(),
      h = 22 + i * 3;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, h, 10), std(0x4f8f2a));
    stem.position.y = h / 2;
    f.add(stem);
    const head = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 28), std(0x5a3418, { roughness: 1 }));
    disc.rotation.x = Math.PI / 2;
    head.add(disc);
    const petal = new THREE.SphereGeometry(1, 10, 6);
    petal.scale(1.5, 0.5, 0.12);
    petal.translate(3.6, 0, 0);
    head.add(instances(petal, std(0xffc61a), 22, (o, k) => (o.rotation.z = (k / 22) * 6.28)));
    head.position.y = h;
    f.add(head);
    f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    f.lookAt(0, 0, 0);
    head.rotation.x = -0.25;
    g.add(f);
  }
  // pond with lily pads and a frog
  const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 40), std(0x2f6f7a, { roughness: 0.1, metalness: 0.3 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(30, 0.06, -26);
  g.add(pond);
  const pad = new THREE.CircleGeometry(1.4, 16, 0.3, 5.9);
  pad.rotateX(-Math.PI / 2);
  g.add(instances(pad, std(0x3f9a3a), 7, (o, i) => o.position.set(30 + Math.cos(i * 0.9) * (3 + (i % 3) * 1.8), 0.12, -26 + Math.sin(i * 0.9) * (3 + (i % 3) * 1.8))));
  const frog = new THREE.Group();
  const fb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), std(0x4fb83a));
  fb.scale.set(1, 0.7, 1.2);
  frog.add(fb);
  for (const x of [-0.5, 0.5]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), std(0xffffff));
    e.position.set(x, 0.6, 0.6);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), std(0x111111));
    p.position.set(x, 0.65, 0.85);
    frog.add(e, p);
  }
  frog.position.set(32, 0.6, -25);
  g.add(frog);
  // a tipped watering can and a coiled hose
  const can = new THREE.Group(),
    canM = std(0x2f8fd8, { metalness: 0.4, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 6, 24), canM);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 10), canM);
  spout.rotation.z = -1;
  spout.position.set(4.6, 1.8, 0);
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.4, 0.8, 14), canM);
  rose.rotation.z = -1;
  rose.position.set(7.6, 3.9, 0);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 8, 20, Math.PI), canM);
  handle.position.y = 3;
  can.add(body, spout, rose, handle);
  can.position.set(-26, 3, -36);
  can.rotation.set(0, 0.6, 0.15);
  g.add(can);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(3, 0.45, 8, 40), std(0x3fae3a));
  hose.rotation.x = Math.PI / 2;
  hose.position.set(-38, 0.5, 8);
  const hose2 = hose.clone();
  hose2.position.y = 1.3;
  hose2.scale.setScalar(0.85);
  g.add(hose, hose2);
  // a giant football
  const ballTex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#f4f4f4';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#111';
    for (let i = 0; i < 12; i++) {
      x.beginPath();
      const cx = (i % 6) * 44 + (i > 5 ? 22 : 0),
        cy = i > 5 ? 90 : 36;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.28;
        x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
      }
      x.fill();
    }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(4, 28, 18), std(0xffffff, { map: ballTex, roughness: 0.5 }));
  ball.position.set(22, 4, 34);
  g.add(ball);
  // daisies scattered in the lawn
  const daisy = new THREE.CircleGeometry(0.5, 8);
  daisy.rotateX(-Math.PI / 2);
  const daisyTex = canvasTex(32, 32, (x, w) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, w);
    x.fillStyle = '#ffc61a';
    x.beginPath();
    x.arc(16, 16, 6, 0, 7);
    x.fill();
  });
  g.add(instances(daisy, std(0xffffff, { map: daisyTex }), 140, o => {
    const a = rnd() * 6.28,
      r = 18 + rnd() * 50;
    o.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
  }));
  // bees with buzzing wings
  const stripe = canvasTex(64, 16, (x, w, h) => {
    for (let i = 0; i < 4; i++) {
      x.fillStyle = i % 2 ? '#111' : '#ffc61a';
      x.fillRect(i * 16, 0, 16, h);
    }
  });
  const bees = Array.from({ length: 5 }, (_, i) => {
    const b = new THREE.Group();
    const bb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), std(0xffffff, { map: stripe }));
    bb.scale.set(1.5, 1, 1);
    const wg = new THREE.CircleGeometry(0.6, 10);
    const wm = new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const w1 = new THREE.Mesh(wg, wm),
      w2 = new THREE.Mesh(wg, wm);
    w1.position.set(0, 0.5, 0.5);
    w2.position.set(0, 0.5, -0.5);
    b.add(bb, w1, w2);
    b.userData = { w1, w2, r: 30 + i * 4, h: 5 + i * 1.5, s: 0.25 + i * 0.05, ph: i * 1.3, bee: 1 };
    g.add(b);
    return b;
  });
  // puffy clouds
  for (let i = 0; i < 8; i++) {
    const c = glow('#ffffff', 30 + rnd() * 20, 0.5),
      a = rnd() * 6.28;
    c.position.set(Math.cos(a) * 80, 55 + rnd() * 15, Math.sin(a) * 80);
    g.add(c);
  }
  // a column of ants marching round the lawn, carrying crumbs
  const NA = 18,
    seg = new THREE.SphereGeometry(0.22, 10, 8),
    antM = std(0x1a0f0a, { roughness: 0.35, metalness: 0.2 }),
    antBody = new THREE.InstancedMesh(seg, antM, NA * 3),
    antLeg = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 4), antM, NA * 6),
    crumbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.25, 0.3), std(0xe8c27a), NA);
  g.add(antBody, antLeg, crumbs);
  g.userData.antParts = [antBody, antLeg, crumbs];
  const _o = new THREE.Object3D(),
    _m = new THREE.Matrix4();
  const ants = t => {
    for (let i = 0; i < NA; i++) {
      const a = t * 0.06 - i * 0.045,
        r = 10.5 + Math.sin(a * 5) * 0.6,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        heading = -a - Math.PI / 2;
      _o.rotation.set(0, heading, 0);
      // head, thorax, abdomen along the heading
      [
        [0.42, 0.24, 1],
        [0, 0.26, 0.8],
        [-0.5, 0.3, 1.35],
      ].forEach(([f, y, sc], k) => {
        _o.position.set(x + Math.sin(heading + Math.PI / 2) * f, y, z + Math.cos(heading + Math.PI / 2) * f);
        _o.scale.set(sc, sc * 0.8, sc * (k === 2 ? 1.4 : 1));
        _o.updateMatrix();
        antBody.setMatrixAt(i * 3 + k, _o.matrix);
      });
      // six legs scurrying
      for (let k = 0; k < 6; k++) {
        const side = k % 2 ? 1 : -1,
          f = (Math.floor(k / 2) - 1) * 0.22,
          sw = Math.sin(t * 18 + i + k * 1.7) * 0.4;
        _o.position.set(x + Math.sin(heading + Math.PI / 2) * f + Math.sin(heading) * side * 0.25, 0.15, z + Math.cos(heading + Math.PI / 2) * f + Math.cos(heading) * side * 0.25);
        _o.rotation.set(0, heading + sw, side * 1.1);
        _o.scale.set(1, 1, 1);
        _o.updateMatrix();
        antLeg.setMatrixAt(i * 6 + k, _o.matrix);
      }
      // every other ant carries a crumb
      _o.rotation.set(0, heading, 0);
      _o.position.set(x, i % 2 ? 0.62 : -5, z);
      _o.updateMatrix();
      crumbs.setMatrixAt(i, _o.matrix);
    }
    antBody.instanceMatrix.needsUpdate = antLeg.instanceMatrix.needsUpdate = crumbs.instanceMatrix.needsUpdate = true;
  };
  let hopAt = 0;
  addTick(g, t => {
    bees.forEach(b => {
      const u = b.userData,
        a = t * u.s + u.ph;
      b.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 3) * 1.5, Math.sin(a) * u.r);
      b.rotation.y = -a;
      u.w1.rotation.x = Math.sin(t * 40) * 0.8;
      u.w2.rotation.x = -Math.sin(t * 40) * 0.8;
    });
    // the frog hops between lily pads every few seconds
    const k = (t % 4) / 4;
    if (t - hopAt > 4) hopAt = t;
    const h = k < 0.15 ? Math.sin((k / 0.15) * Math.PI) * 2.5 : 0;
    frog.position.y = 0.6 + h;
    frog.rotation.y = Math.floor(t / 4) * 1.3;
    ball.rotation.y = t * 0.1;
    ants(t);
  });
  return g;
}

/* ---------- Solar system ---------- */
function moreSolar(g) {
  const rnd = seeded(131);
  // nebula clouds far away
  [
    ['#7a3cff', -70, 30, 60, 90],
    ['#ff4fa3', 60, 45, -70, 80],
    ['#3fb8ff', 80, 10, 50, 70],
  ].forEach(([c, x, y, z, s]) => {
    const n = glow(c, s, 0.35);
    n.position.set(x, y, z);
    g.add(n);
  });
  // a rotating space station
  const st = new THREE.Group(),
    metal = std(0xcfd4dc, { metalness: 0.7, roughness: 0.35 });
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(7, 0.9, 10, 40), metal);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 16), metal);
  hub.rotation.x = Math.PI / 2;
  st.add(ringM, hub);
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), metal);
    sp.rotation.z = (i / 4) * Math.PI * 2;
    sp.position.set(Math.cos((i / 4) * 6.28 + Math.PI / 2) * 3.5, Math.sin((i / 4) * 6.28 + Math.PI / 2) * 3.5, 0);
    st.add(sp);
  }
  const panelM = std(0x1d3f8f, { metalness: 0.5, roughness: 0.3, emissive: 0x0a1a40, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 3), panelM);
    p.position.set(0, 0, s * 4.5);
    p.rotation.x = Math.PI / 2;
    st.add(p);
  }
  for (let i = 0; i < 8; i++) {
    const l = glow(i % 2 ? '#ff4040' : '#40ff80', 1.2, 1);
    l.position.set(Math.cos((i / 8) * 6.28) * 7.9, Math.sin((i / 8) * 6.28) * 7.9, 0);
    st.add(l);
  }
  st.position.set(40, 30, -48);
  st.rotation.y = -0.7;
  g.add(st);
  // satellites orbiting closer in
  const sats = Array.from({ length: 3 }, (_, i) => {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.6), std(0xd8b04a, { metalness: 0.8, roughness: 0.3 })));
    for (const x of [-1.8, 1.8]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.1), panelM);
      p.position.x = x;
      s.add(p);
    }
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 14, 1, true), std(0xffffff, { side: THREE.DoubleSide }));
    dish.position.y = 1;
    s.add(dish);
    s.userData = { r: 16 + i * 4, s: 0.18 - i * 0.04, ph: i * 2, tilt: 0.3 + i * 0.2 };
    g.add(s);
    return s;
  });
  // an astronaut drifting by
  const astro = figure('leathers', 0xf2f2f2, 0xf2f2f2);
  astro.scale.setScalar(1.4);
  g.add(astro);
  // a blue-green world close by
  const worldTex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#1f5fbf';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
      x.fillStyle = i % 4 ? '#3fae5a' : '#d8c27a';
      x.beginPath();
      x.ellipse(rnd() * w, 20 + rnd() * (h - 40), 8 + rnd() * 26, 5 + rnd() * 14, rnd() * 3, 0, 7);
      x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 18; i++) x.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 40, 2 + rnd() * 3);
  });
  const world = new THREE.Mesh(new THREE.SphereGeometry(14, 40, 28), std(0xffffff, { map: worldTex, roughness: 0.7 }));
  world.position.set(-50, -20, 55);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(14.8, 32, 20), new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: 0.15, side: THREE.BackSide }));
  atm.position.copy(world.position);
  g.add(world, atm);
  addTick(g, t => {
    st.rotation.z = t * 0.15;
    sats.forEach(s => {
      const u = s.userData,
        a = t * u.s + u.ph;
      s.position.set(Math.cos(a) * u.r, 8 + Math.sin(a) * u.r * u.tilt, Math.sin(a) * u.r);
      s.rotation.y = -a;
    });
    const k = (t * 0.02) % 1;
    astro.position.set(-40 + k * 80, 18 + Math.sin(t * 0.4) * 3, -26);
    astro.rotation.set(t * 0.2, t * 0.13, t * 0.17);
    world.rotation.y = t * 0.03;
  });
  return g;
}

/* ---------- Pirate ship ---------- */
function morePirate(g) {
  const rnd = seeded(141);
  const wood = std(0x5e3a1e),
    brass = std(0xc9952a, { metalness: 0.8, roughness: 0.3 });
  const ship = g.userData.ship || g;
  // the ship's wheel at the stern
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 8, 28), wood));
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6), wood);
    sp.rotation.z = (i / 8) * Math.PI;
    wheel.add(sp);
  }
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12).rotateX(Math.PI / 2), brass));
  wheel.position.set(0, 3, 36);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 0.8), wood);
  post.position.set(0, 1.5, 36.6);
  ship.add(wheel, post);
  // lanterns hanging along the rails
  for (let i = 0; i < 8; i++) {
    const z = -30 + i * 9,
      x = (i % 2 ? 1 : -1) * 15.2,
      lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), std(0xffc061, { emissive: 0xffa53a, emissiveIntensity: 1.6 })),
      gl = glow('#ffb347', 3.2, 0.85);
    lamp.position.set(x, 3.1, z);
    gl.position.set(x, 3.1, z);
    ship.add(lamp, gl);
  }
  // coiled ropes, crates and a pile of gold coins by the chest
  ship.add(instances(new THREE.TorusGeometry(0.9, 0.25, 6, 16).rotateX(Math.PI / 2), std(0xb08a50), 6, (o, i) => o.position.set(-12 + (i % 3) * 1.2, 0.25 + Math.floor(i / 3) * 0.4, -30 + (i % 3) * 0.5)));
  ship.add(instances(new THREE.BoxGeometry(1.6, 1.6, 1.6), std(0x8a5a2e), 5, (o, i) => (o.position.set(9 + (i % 3) * 1.7, 0.8 + (i > 2 ? 1.6 : 0), 20), o.rotation.y = i * 0.3)));
  const coin = new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12);
  ship.add(instances(coin, brass, 60, o => {
    o.position.set(11 + (rnd() - 0.5) * 3, 0.05 + rnd() * 0.5, -10 + rnd() * 2);
    o.rotation.set(rnd() * 3, rnd() * 3, 0);
  }));
  const sparkles = Array.from({ length: 5 }, (_, i) => {
    const s = glow('#fff2a8', 1.5, 1);
    s.position.set(10 + i * 0.6, 0.6, -9.5 + (i % 2));
    ship.add(s);
    return s;
  });
  // a parrot circling the main mast
  const parrot = new THREE.Group();
  const pb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), std(0xd8202a));
  pb.scale.set(0.8, 0.8, 1.6);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 6), std(0x2a6fd8));
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -1.1;
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 6), std(0xffd040));
  beak.rotation.x = Math.PI / 2;
  beak.position.z = 0.85;
  const wg = new THREE.PlaneGeometry(1.4, 0.6);
  wg.translate(0.7, 0, 0);
  const wm = new THREE.MeshStandardMaterial({ color: 0x2fae3a, side: THREE.DoubleSide });
  const wl = new THREE.Mesh(wg, wm),
    wr = new THREE.Mesh(wg, wm);
  wr.rotation.y = Math.PI;
  parrot.add(pb, tail, beak, wl, wr);
  ship.add(parrot);
  // shark fins circling the ship
  const finG = new THREE.ConeGeometry(0.9, 2.2, 3);
  finG.scale(0.25, 1, 1);
  const fins = Array.from({ length: 3 }, (_, i) => {
    const f = new THREE.Mesh(finG, std(0x4a5a66));
    f.userData = { r: 30 + i * 6, s: 0.12 + i * 0.03, ph: i * 2 };
    g.add(f);
    return f;
  });
  // a rival galleon on the horizon: every so often our cannons fire, a ball arcs over, it bursts into
  // flame and sinks; a new one sails in later
  const rival = new THREE.Group(),
    dark = std(0x2a1a10);
  const rhull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dark);
  rhull.scale.set(9, 3.5, 3);
  rival.add(rhull);
  const rdeck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 5.2), std(0x5e3a1e));
  rival.add(rdeck);
  const blackSail = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, side: THREE.DoubleSide });
  for (const [x, h] of [
    [-3.5, 13],
    [3.5, 15],
  ]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, h, 6), wood);
    m.position.set(x, h / 2, 0);
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1).scale(1, 1, 1), blackSail);
    sl.geometry = new THREE.PlaneGeometry(6, 6);
    sl.position.set(x, h * 0.55, 0);
    sl.rotation.y = Math.PI / 2;
    rival.add(m, sl);
  }
  const rflag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xc7202c, side: THREE.DoubleSide }));
  rflag.position.set(3.5, 15.6, 1.2);
  rflag.rotation.y = Math.PI / 2;
  rival.add(rflag);
  g.add(rival);
  g.userData.rival = rival;
  const fireGlow = glow('#ff7a2a', 14, 0);
  g.add(fireGlow);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), std(0x111111, { metalness: 0.6 }));
  g.add(ball);
  const flash = glow('#ffd27a', 5, 0),
    smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#cfcfcf'), transparent: true, depthWrite: false, opacity: 0 })),
    boom = glow('#ffb040', 20, 0),
    splash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#ffffff'), transparent: true, depthWrite: false, opacity: 0 }));
  g.add(flash, smoke, boom, splash);
  const RIV = new V3(62, -0.8, -30),
    gun = new V3(),
    P_ = 26; // seconds per battle
  const battle = t => {
    const k = t % P_;
    // the cannon on our starboard side, in world space (the ship rocks)
    gun.set(3.9, 1.1, 3.6).applyMatrix4(ship.matrixWorld);
    // rival: sails in, gets hit at 7.5 s, burns and sinks, gone until the next battle
    const sink = Math.max(0, Math.min(1, (k - 7.5) / 7));
    rival.visible = k < 16;
    rival.position.set(RIV.x, RIV.y - sink * sink * 14 + Math.sin(t * 0.8) * 0.3, RIV.z + (k < 7.5 ? (7.5 - k) * 3 : 0));
    rival.rotation.set(sink * 0.5, -0.4, Math.sin(t * 0.6) * 0.04 + sink * 0.7);
    fireGlow.position.copy(rival.position).add(new V3(0, 5, 0));
    fireGlow.material.opacity = k > 7.5 && k < 13 ? 0.9 * (1 - (k - 7.5) / 5.5) * (0.8 + 0.2 * Math.sin(t * 20)) : 0;
    // FIRE at 6 s: muzzle flash + smoke at the gun, ball arcs over 1.5 s
    const fk = k - 6;
    flash.position.copy(gun);
    flash.material.opacity = fk > 0 && fk < 0.25 ? 1 - fk / 0.25 : 0;
    smoke.position.copy(gun).add(new V3(fk * 1.5, fk * 1.2, 0));
    smoke.scale.setScalar(2 + Math.max(0, fk) * 5);
    smoke.material.opacity = fk > 0 && fk < 2.5 ? 0.75 * (1 - fk / 2.5) : 0;
    ball.visible = fk > 0 && fk < 1.5;
    if (ball.visible) {
      const f = fk / 1.5,
        tgt = rival.position.clone().add(new V3(0, 2, 0));
      ball.position.copy(gun).lerp(tgt, f);
      ball.position.y += Math.sin(f * Math.PI) * 12;
    }
    // hit: a fireball and a big splash
    const hk = k - 7.5;
    boom.position.copy(rival.position).add(new V3(0, 3, 0));
    boom.material.opacity = hk > 0 && hk < 0.8 ? 1 - hk / 0.8 : 0;
    boom.scale.setScalar(10 + Math.max(0, hk) * 25);
    splash.position.copy(rival.position).add(new V3(-2, 2 + Math.max(0, hk) * 6, 3));
    splash.scale.set(6, 4 + Math.max(0, hk) * 14, 1);
    splash.material.opacity = hk > 0 && hk < 1.2 ? 0.8 * (1 - hk / 1.2) : 0;
  };
  // foam streaming back along both sides of the hull: we're under way
  const foam = Array.from({ length: 22 }, () => {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#ffffff'), transparent: true, depthWrite: false, opacity: 0 }));
    g.add(f);
    return f;
  });
  // pink sunset clouds
  for (let i = 0; i < 7; i++) {
    const c = glow(i % 2 ? '#ffb08a' : '#ffd0b0', 30 + rnd() * 20, 0.35),
      a = rnd() * 6.28;
    c.position.set(Math.cos(a) * 90, 30 + rnd() * 20, Math.sin(a) * 90);
    g.add(c);
  }
  addTick(g, t => {
    wheel.rotation.z = Math.sin(t * 0.4) * 0.6;
    sparkles.forEach((s, i) => (s.material.opacity = Math.max(0, Math.sin(t * 3 + i * 1.7))));
    const a = t * 0.45;
    parrot.position.set(Math.cos(a) * 8, 30 + Math.sin(t) * 2, -26 + Math.sin(a) * 8);
    parrot.rotation.y = -a;
    wl.rotation.z = Math.sin(t * 12) * 0.7;
    wr.rotation.z = -Math.sin(t * 12) * 0.7;
    fins.forEach(f => {
      const u = f.userData,
        b = t * u.s + u.ph;
      f.position.set(Math.cos(b) * u.r, -1.3, Math.sin(b) * u.r);
      f.rotation.y = -b;
    });
    battle(t);
    foam.forEach((f, i) => {
      const k = ((t * 0.35 + i / foam.length) % 1);
      f.position.set((i % 2 ? 1 : -1) * (4.2 + k * 2.5), -0.9, -6 + k * 26);
      f.material.opacity = 0.55 * Math.sin(k * Math.PI);
      f.scale.setScalar(1.2 + k * 2.5);
    });
  });
  return g;
}

/* ---------- Royal court ---------- */
function moreCastle(g) {
  const rnd = seeded(151);
  // royal guards lining the carpet (the game's Hero outfit: shield and armour)
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1,
      z = -12 - Math.floor(i / 2) * 6,
      f = figure('hero', 0x7a7f8a);
    f.position.set(side * 4.2, 0, z);
    f.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    f.scale.setScalar(1.4);
    g.add(f);
  }
  // a tiered fountain with water spray
  const stone = std(0x9a9286),
    water = std(0x5fb8e8, { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 });
  const ft = new THREE.Group();
  [
    [5, 0.8, 0.4],
    [3, 0.5, 2.2],
    [1.6, 0.4, 3.8],
  ].forEach(([r, h, y]) => {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 28), stone);
    bowl.position.y = y;
    const wt = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.05, 28), water);
    wt.position.y = y + h / 2;
    ft.add(bowl, wt);
  });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 10), stone);
  col.position.y = 2;
  ft.add(col);
  ft.position.set(26, 0, 18);
  g.add(ft);
  const spray = drifters(g, 70, 0xcfefff, 0.4, (i, t, v) => {
    const k = ((t * 0.9 + i / 70) % 1),
      a = i * 2.4;
    v.set(26 + Math.cos(a) * k * 3, 4.6 + Math.sin(k * Math.PI) * 2.6 - k * 1.5, 18 + Math.sin(a) * k * 3);
  });
  // tapestries with a crest on the wall
  const crest = canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#7a0f1b';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#d7a72e';
    x.fillRect(6, 6, w - 12, 6);
    x.fillRect(6, h - 12, w - 12, 6);
    x.beginPath();
    x.moveTo(64, 70);
    x.lineTo(100, 90);
    x.lineTo(100, 140);
    x.quadraticCurveTo(64, 190, 64, 190);
    x.quadraticCurveTo(28, 160, 28, 140);
    x.lineTo(28, 90);
    x.closePath();
    x.fill();
    x.fillStyle = '#2a4fb8';
    x.beginPath();
    x.moveTo(64, 85);
    x.lineTo(88, 98);
    x.lineTo(88, 136);
    x.quadraticCurveTo(64, 172, 64, 172);
    x.quadraticCurveTo(40, 150, 40, 136);
    x.lineTo(40, 98);
    x.closePath();
    x.fill();
    x.fillStyle = '#d7a72e';
    x.font = 'bold 40px serif';
    x.textAlign = 'center';
    x.fillText('♛', 64, 145);
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28 + 0.65,
      tp = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), new THREE.MeshStandardMaterial({ map: crest, side: THREE.DoubleSide }));
    tp.position.set(Math.cos(a) * 43.5, 8, Math.sin(a) * 43.5);
    tp.lookAt(0, 8, 0);
    g.add(tp);
  }
  const flags = []; // (tower flags now come with the Kenney castle)
  // doves circling
  const doveG = new THREE.BufferGeometry();
  doveG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.9, 0.25, 0, -0.2, 0, 0.3, 0, 0, 0, 0.9, 0.25, 0, 0.2, 0, 0.3]), 3));
  const doves = Array.from({ length: 6 }, () => {
    const d = new THREE.Mesh(doveG, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    d.userData = { r: 15 + rnd() * 20, h: 20 + rnd() * 10, s: 0.2 + rnd() * 0.15, ph: rnd() * 6 };
    g.add(d);
    return d;
  });
  addTick(g, t => {
    spray(t);
    flags.forEach((f, j) => {
      const b = f.userData.base,
        p = f.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.array[i * 3 + 2] = Math.sin(b[i * 3] * 1.4 - t * 5 + j) * 0.3 * (b[i * 3] / 4);
      p.needsUpdate = true;
    });
    doves.forEach(d => {
      const u = d.userData,
        a = t * u.s + u.ph;
      d.position.set(Math.cos(a) * u.r, u.h, Math.sin(a) * u.r);
      d.rotation.y = -a;
      d.scale.y = 1 + Math.sin(t * 9 + u.ph) * 0.7;
    });
  });
  return g;
}

/* ---------- Dino valley ---------- */
function trex() {
  const d = new THREE.Group(),
    m = std(0x5a6a3a, { roughness: 0.75 }),
    belly = std(0xc8b88a);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m);
  body.scale.set(4, 2.6, 2.2);
  body.position.set(0, 7, 0);
  body.rotation.z = 0.25;
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), m);
  skull.scale.set(2.2, 1.3, 1.1);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), belly);
  jaw.scale.set(1.9, 0.5, 0.9);
  jaw.position.set(0.2, -0.9, 0);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 1.6), std(0xf4f0e0));
  teeth.position.set(0.5, -0.55, 0);
  for (const z of [-0.6, 0.6]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), std(0xffd040, { emissive: 0x553300 }));
    eye.position.set(1, 0.45, z);
    head.add(eye);
  }
  head.add(skull, jaw, teeth);
  head.position.set(4.6, 10.5, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 3.4, 12), m);
  neck.position.set(3.2, 9, 0);
  neck.rotation.z = -0.9;
  const tailC = new THREE.CatmullRomCurve3([new V3(-3, 7.5, 0), new V3(-7, 7, 0), new V3(-11, 6, 0), new V3(-14, 5, 0)]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailC, 16, 1, 8), m);
  d.add(body, neck, head, tail);
  for (const z of [-0.8, 0.8]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 1.4, 6), m);
    arm.position.set(3, 7, z * 1.5);
    arm.rotation.z = 1.2;
    d.add(arm);
  }
  const legs = [];
  for (const z of [-1.3, 1.3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 6, 10), m);
    leg.geometry.translate(0, -3, 0);
    leg.position.set(-0.5, 6.5, z);
    d.add(leg);
    legs.push(leg);
  }
  d.userData = { legs, head };
  return d;
}
function moreDino(g) {
  const rnd = seeded(161);
  const rex = trex();
  rex.scale.setScalar(1.4);
  g.add(rex);
  // small raptors darting around
  const raptors = Array.from({ length: 3 }, (_, i) => {
    const r = trex();
    r.scale.setScalar(0.45);
    r.traverse(o => o.isMesh && (o.material = std(0x8a6a3a)));
    r.userData.r = 26 + i * 4;
    r.userData.ph = i * 2;
    g.add(r);
    return r;
  });
  // a nest of speckled eggs
  const nest = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.9, 8, 20), std(0x7a5a32, { roughness: 1 }));
  nest.rotation.x = Math.PI / 2;
  nest.position.set(-22, 0.6, 16);
  g.add(nest);
  const eggTex = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#efe6cf';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      x.fillStyle = '#8a7a5a';
      x.beginPath();
      x.arc(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 0, 7);
      x.fill();
    }
  });
  g.add(instances(new THREE.SphereGeometry(0.8, 14, 10).scale(1, 1.35, 1), std(0xffffff, { map: eggTex }), 5, (o, i) => o.position.set(-22 + Math.cos(i * 1.3) * 1.1, 1, 16 + Math.sin(i * 1.3) * 1.1)));
  // fossil bones half-buried
  const bone = std(0xe8e0c8);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(2.4 - i * 0.15, 0.18, 6, 16, Math.PI), bone);
    rib.position.set(28 + i * 1.1, 0, -20);
    rib.rotation.y = Math.PI / 2;
    g.add(rib);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 9, 8), bone);
  spine.rotation.z = Math.PI / 2;
  spine.position.set(31, 2.2, -20);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), bone);
  skull.scale.set(1.6, 1, 1);
  skull.position.set(25.5, 1.5, -20);
  g.add(spine, skull);
  // a glowing lava river down the volcano's flank
  const lavaC = new THREE.CatmullRomCurve3([new V3(-30, 40, -85), new V3(-24, 25, -72), new V3(-20, 10, -60), new V3(-14, 0.2, -48), new V3(-6, 0.2, -40)]);
  const lavaTex = canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#ff5a1a';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = i % 2 ? '#ffd040' : '#a02000';
      x.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 10, 3);
    }
  });
  lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
  lavaTex.repeat.set(8, 1);
  const lava = new THREE.Mesh(new THREE.TubeGeometry(lavaC, 60, 1.2, 6), new THREE.MeshBasicMaterial({ map: lavaTex }));
  lava.scale.y = 1;
  g.add(lava);
  // dragonflies
  const dfs = Array.from({ length: 4 }, (_, i) => {
    const d = glow('#7fe8ff', 1.4, 0.9);
    d.userData = { r: 15 + i * 3, ph: i * 1.7 };
    g.add(d);
    return d;
  });
  addTick(g, t => {
    const a = t * 0.05;
    rex.position.set(Math.cos(a) * 60, 0, Math.sin(a) * 60);
    rex.rotation.y = -a - Math.PI / 2;
    rex.userData.legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 2 + i * Math.PI) * 0.35));
    rex.userData.head.rotation.z = Math.sin(t * 0.7) * 0.15;
    raptors.forEach(r => {
      const b = t * 0.3 + r.userData.ph;
      r.position.set(Math.cos(b) * r.userData.r, 0, Math.sin(b) * r.userData.r);
      r.rotation.y = -b - Math.PI / 2;
      r.userData.legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 8 + i * Math.PI) * 0.5));
    });
    lavaTex.offset.x = -(t * 0.08) % 1;
    dfs.forEach(d => {
      const u = d.userData,
        b = t * 0.6 + u.ph;
      d.position.set(Math.cos(b) * u.r + Math.sin(t * 5 + u.ph), 3 + Math.sin(t * 2 + u.ph), Math.sin(b * 1.3) * u.r);
    });
  });
  return g;
}

/* ---------- Digital grid ---------- */
function moreMatrix(g) {
  const rnd = seeded(171);
  // binary rain all round
  const rain = drifters(g, 500, 0x3dff8a, 0.35, (i, t, v) => {
    const a = i * 2.399,
      r = 18 + ((i * 53) % 60),
      sp = 4 + (i % 7);
    v.set(Math.cos(a) * r, 40 - ((t * sp + i * 3.1) % 40), Math.sin(a) * r);
  });
  // glowing pillars pulsing in a ring
  const pillarM = new THREE.MeshBasicMaterial({ color: 0x1aff6a, transparent: true, opacity: 0.5 });
  const pillars = instances(new THREE.BoxGeometry(0.6, 1, 0.6), pillarM, 24, (o, i) => {
    const a = (i / 24) * 6.28,
      h = 8 + (i % 4) * 5;
    o.position.set(Math.cos(a) * 36, h / 2, Math.sin(a) * 36);
    o.scale.y = h;
  });
  g.add(pillars);
  // floating screens showing the game's name and scrolling data
  const screen = canvasTex(256, 144, (x, w, h) => {
    x.fillStyle = '#021a0a';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#1aff6a';
    x.lineWidth = 4;
    x.strokeRect(2, 2, w - 4, h - 4);
    x.fillStyle = '#7dffb0';
    x.font = 'bold 30px monospace';
    x.textAlign = 'center';
    x.fillText('GLOBE', w / 2, 62);
    x.fillText('RIDERS', w / 2, 98);
    x.font = '12px monospace';
    x.fillStyle = '#1aff6a';
    x.fillText('> SYSTEM ONLINE_', w / 2, 128);
  });
  const screens = Array.from({ length: 4 }, (_, i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ map: screen, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    const a = (i / 4) * 6.28 + 0.8;
    s.position.set(Math.cos(a) * 26, 16, Math.sin(a) * 26);
    s.lookAt(0, 16, 0);
    s.userData.ph = i;
    g.add(s);
    return s;
  });
  // light pulses racing along the grid lines
  const pulses = Array.from({ length: 16 }, (_, i) => {
    const p = glow('#9dffc8', 2.2, 1);
    p.userData = { axis: i % 2, lane: (((i * 7) % 15) - 7) * 4, s: 8 + (i % 5) * 3, ph: i * 10 };
    g.add(p);
    return p;
  });
  // hex rings turning overhead
  const hexes = [12, 16, 20].map((r, i) => {
    const h = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 4, 6), new THREE.MeshBasicMaterial({ color: 0x29ff7a, transparent: true, opacity: 0.6 }));
    h.rotation.x = Math.PI / 2;
    h.position.y = 26 + i * 4;
    g.add(h);
    return h;
  });
  addTick(g, t => {
    rain(t);
    pillarM.opacity = 0.35 + 0.25 * Math.sin(t * 2);
    screens.forEach(s => (s.position.y = 16 + Math.sin(t * 0.8 + s.userData.ph) * 1.2));
    pulses.forEach(p => {
      const u = p.userData,
        k = (((t * u.s + u.ph) % 160) + 160) % 160 - 80;
      if (u.axis) p.position.set(k, 0.3, u.lane);
      else p.position.set(u.lane, 0.3, k);
    });
    hexes.forEach((h, i) => (h.rotation.z = t * (0.1 + i * 0.05) * (i % 2 ? -1 : 1)));
  });
  return g;
}

export { moreCastle, moreCavern, moreDino, moreGarden, moreMatrix, morePirate, moreSolar };
