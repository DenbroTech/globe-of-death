import * as THREE from 'three';
import { cv, glowTex, tex } from '../render/textures.js';

/* ---------- detail pass for the classic arenas (hand-built, no imported models) ----------
   moreStadium(g): cantilever roof with trusses and LED strip, hospitality boxes, big screens, sponsor boards,
   goals. moreMoon(g): a lunar base round the arena: domes, lander, rover, solar field, comms tower, pad. */

const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o));
const basic = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));
const YA = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rod(g, a, b, r, m, seg = 6) {
  const e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg), m);
  e.position.copy(a).add(b).multiplyScalar(0.5);
  e.quaternion.setFromUnitVectors(YA, b.clone().sub(a).normalize());
  g.add(e);
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

function moreStadium(g) {
  const o = new THREE.Object3D(),
    col = new THREE.Color(),
    steel = std(0xd9dde4, { metalness: 0.6, roughness: 0.4 }),
    dark = std(0x23262c, { metalness: 0.5, roughness: 0.5 });
  // the roof: a white canopy cantilevered over the stands, sloping up toward the pitch
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(25.5, 37, 2.6, 96, 1, true),
    std(0xe8ecf2, { side: THREE.DoubleSide, roughness: 0.6, emissive: 0x30343c }),
  );
  canopy.position.y = 17.6;
  g.add(canopy);
  // truss ribs under it, and the columns at the back
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.7, 12), steel, 48),
    cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.36, 17, 8), steel, 48);
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    o.position.set(Math.cos(a) * 31.2, 17.2, Math.sin(a) * 31.2);
    o.rotation.set(0, -a + Math.PI / 2, 0);
    o.rotateX(-0.22);
    o.updateMatrix();
    ribs.setMatrixAt(k, o.matrix);
    o.rotation.set(0, 0, 0);
    o.position.set(Math.cos(a) * 36.6, 8.5, Math.sin(a) * 36.6);
    o.updateMatrix();
    cols.setMatrixAt(k, o.matrix);
  }
  g.add(ribs, cols);
  // a ring of LED floodlights along the roof's inner edge
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.28, 0.3), basic(0xf4f8ff), 120);
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    o.position.set(Math.cos(a) * 25.7, 18.55, Math.sin(a) * 25.7);
    o.rotation.set(0, -a + Math.PI / 2, 0);
    o.updateMatrix();
    leds.setMatrixAt(k, o.matrix);
  }
  g.add(leds);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2,
      gl = glow(0xdfe9ff, 7, 0.5);
    gl.position.set(Math.cos(a) * 25.7, 18.4, Math.sin(a) * 25.7);
    g.add(gl);
  }
  // the back wall above the top tier: a strip of lit hospitality boxes over a sponsor band
  {
    const [c, x] = cv(2048, 128);
    x.fillStyle = '#15171c';
    x.fillRect(0, 0, 2048, 128);
    for (let i = 0; i < 64; i++) {
      const x0 = i * 32 + 3;
      x.fillStyle = ['#ffe7b0', '#cfe6ff', '#ffd9a0', '#e8f0ff'][i % 4];
      x.fillRect(x0, 14, 26, 44);
      // people in the boxes
      x.fillStyle = 'rgba(20,20,30,.75)';
      for (let p = 0; p < 3; p++) {
        const px = x0 + 4 + p * 8 + Math.random() * 2;
        x.beginPath();
        x.arc(px, 40, 3, 0, 7);
        x.fill();
        x.fillRect(px - 3, 43, 6, 15);
      }
      x.fillStyle = '#2b2f37';
      x.fillRect(x0 - 3, 58, 32, 5);
    }
    const names = ['GLOBE RIDERS', 'NITRO', 'TURBO TYRES', 'MOTO', 'FULL THROTTLE', 'APEX'];
    x.font = '900 34px Impact, "Arial Black", sans-serif';
    x.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      x.fillStyle = ['#e63946', '#1d4ed8', '#f4c20d', '#111318'][i % 4];
      x.fillRect(i * 170.7, 72, 171, 56);
      x.fillStyle = i % 4 === 2 ? '#111' : '#fff';
      x.textAlign = 'center';
      x.fillText(names[i % names.length], i * 170.7 + 85, 101);
    }
    const t = tex(c, true);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1; // seen from inside the bowl: flip so the wording reads the right way round
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(36.3, 36.3, 5.4, 96, 1, true), basic(0xffffff, { map: t, side: THREE.BackSide }));
    wall.position.y = 14.2;
    g.add(wall);
  }
  // LED sponsor boards round the pitch
  {
    const [c, x] = cv(2048, 64);
    const names = ['GLOBE RIDERS', 'NITRO BOOST', 'APEX OILS', 'TURBO TYRES', 'MOTO WORLD', 'FULL THROTTLE', 'RED LINE', 'HOT LAP'];
    x.font = '900 40px Impact, "Arial Black", sans-serif';
    x.textBaseline = 'middle';
    x.textAlign = 'center';
    for (let i = 0; i < 16; i++) {
      x.fillStyle = ['#0b1a4a', '#b3151f', '#111318', '#0d5a2a'][i % 4];
      x.fillRect(i * 128, 0, 128, 64);
      x.fillStyle = ['#ffd23f', '#ffffff', '#4cc9f0', '#ffffff'][i % 4];
      x.save();
      x.translate(i * 128 + 64, 34);
      x.scale(0.55, 1);
      x.fillText(names[i % names.length], 0, 0);
      x.restore();
    }
    const t = tex(c, true),
      ad = new THREE.Mesh(new THREE.CylinderGeometry(17.62, 17.62, 0.95, 96, 1, true), basic(0xffffff, { map: t, side: THREE.DoubleSide }));
    ad.position.y = 0.47;
    g.add(ad);
    g.userData.adTex = t;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1; // read from the pitch side
  }
  // two big screens hung under the roof at either end
  {
    const [c, x] = cv(512, 256);
    const bgd = x.createLinearGradient(0, 0, 0, 256);
    bgd.addColorStop(0, '#0b1a4a');
    bgd.addColorStop(1, '#050a20');
    x.fillStyle = bgd;
    x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#ffd23f';
    x.font = '900 70px Impact, "Arial Black", sans-serif';
    x.textAlign = 'center';
    x.fillText('GLOBE RIDERS', 256, 96);
    x.fillStyle = '#fff';
    x.font = '900 44px Impact, "Arial Black", sans-serif';
    x.fillText('LIVE  ·  TONIGHT', 256, 168);
    x.fillStyle = '#e63946';
    x.fillRect(40, 200, 432, 10);
    const t = tex(c, true);
    for (const a of [0, Math.PI]) {
      const s = new THREE.Group(),
        scr = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), basic(0xffffff, { map: t })),
        frame = new THREE.Mesh(new THREE.BoxGeometry(13.8, 7.3, 0.6), dark);
      frame.position.z = -0.35;
      s.add(scr, frame);
      s.position.set(Math.cos(a) * 30, 13.2, Math.sin(a) * 30);
      s.lookAt(0, 6, 0);
      g.add(s);
      const gl = glow(0x6f9aff, 16, 0.25);
      gl.position.copy(s.position);
      g.add(gl);
    }
  }
  // goals with nets at both ends of the pitch
  {
    const white = std(0xf4f4f4, { roughness: 0.4 }),
      [c, x] = cv(64, 64);
    x.strokeStyle = 'rgba(255,255,255,.9)';
    x.lineWidth = 2;
    x.strokeRect(0, 0, 64, 64);
    const nt = tex(c, true);
    nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
    nt.repeat.set(12, 5);
    const netM = basic(0xffffff, { map: nt, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    for (const sz of [-1, 1]) {
      const gp = new THREE.Group(),
        W = 5.2,
        H = 2.1,
        D = 1.6;
      rod(gp, V(-W / 2, 0, 0), V(-W / 2, H, 0), 0.07, white, 8);
      rod(gp, V(W / 2, 0, 0), V(W / 2, H, 0), 0.07, white, 8);
      rod(gp, V(-W / 2, H, 0), V(W / 2, H, 0), 0.07, white, 8);
      for (const sx of [-1, 1]) {
        rod(gp, V((sx * W) / 2, H, 0), V((sx * W) / 2, 0.9, -D), 0.035, white);
        rod(gp, V((sx * W) / 2, 0.9, -D), V((sx * W) / 2, 0, -D), 0.035, white);
        const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), netM);
        side.rotation.y = Math.PI / 2;
        side.position.set((sx * W) / 2, H / 2, -D / 2);
        gp.add(side);
      }
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H * 1.15), netM);
      back.position.set(0, H / 2 - 0.05, -D * 0.72);
      back.rotation.x = 0.42;
      gp.add(back);
      gp.position.set(0, 0, sz * 15.4);
      gp.rotation.y = sz > 0 ? Math.PI : 0;
      g.add(gp);
    }
  }
  // the sponsor boards scroll
  addTick(g, t => (g.userData.adTex.offset.x = (t * 0.012) % 1));
  return g;
}

function moreMoon(g) {
  const o = new THREE.Object3D(),
    white = std(0xe9ecf0, { roughness: 0.5, metalness: 0.2 }),
    grey = std(0x8f949c, { roughness: 0.5, metalness: 0.5 }),
    dark = std(0x2a2d33, { roughness: 0.6, metalness: 0.4 }),
    foil = std(0xd9a520, { roughness: 0.35, metalness: 0.9 }),
    panel = std(0x16307a, { roughness: 0.25, metalness: 0.7, emissive: 0x06102a }),
    lit = basic(0xffe9b0),
    cyan = basic(0x7fe0ff);
  /* habitat domes: ribbed pressure domes with lit windows, an airlock, joined by tunnels */
  const dome = (x, z, r) => {
    const d = new THREE.Group();
    d.position.set(x, 0, z);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), white);
    d.add(shell);
    for (let k = 0; k < 8; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, r * 0.022, 5, 20, Math.PI), grey);
      rib.rotation.y = (k / 8) * Math.PI;
      d.add(rib);
    }
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.1, r * 0.16, 28), grey);
    skirt.position.y = r * 0.08;
    d.add(skirt);
    // a band of windows
    const N = 14,
      wins = new THREE.InstancedMesh(new THREE.SphereGeometry(r * 0.085, 8, 6), lit, N);
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2,
        el = 0.42;
      o.position.set(Math.cos(a) * Math.cos(el) * r * 0.985, Math.sin(el) * r * 0.985, Math.sin(a) * Math.cos(el) * r * 0.985);
      o.scale.set(1, 1, 1);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      wins.setMatrixAt(k, o.matrix);
    }
    d.add(wins);
    // airlock facing the arena
    const toC = Math.atan2(-z, -x),
      lock = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, r * 0.5, 14), grey);
    lock.rotation.z = Math.PI / 2;
    lock.rotation.y = -toC;
    lock.position.set(Math.cos(toC) * r * 0.95, r * 0.3, Math.sin(toC) * r * 0.95);
    d.add(lock);
    const door = new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 14), cyan);
    door.position.set(Math.cos(toC) * r * 1.21, r * 0.3, Math.sin(toC) * r * 1.21);
    door.lookAt(d.position.clone().negate().setY(r * 0.3).add(door.position));
    door.rotation.set(0, -toC + Math.PI / 2, 0);
    d.add(door);
    // top hatch with a beacon
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.2, r * 0.1, 12), grey);
    cap.position.y = r;
    d.add(cap);
    g.add(d);
    return d;
  };
  const D1 = [-36, -32, 10],
    D2 = [-52, -14, 7],
    D3 = [-20, -48, 6];
  [D1, D2, D3].forEach(d => dome(...d));
  // tunnels between the domes
  for (const [a, b] of [
    [D1, D2],
    [D1, D3],
  ]) {
    const t = rod(g, V(a[0], 1.1, a[1]), V(b[0], 1.1, b[1]), 1.0, white, 12);
    for (let k = 1; k < 4; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.09, 5, 16), grey);
      ring.position.set(a[0] + ((b[0] - a[0]) * k) / 4, 1.1, a[1] + ((b[1] - a[1]) * k) / 4);
      ring.lookAt(b[0], 1.1, b[1]);
      g.add(ring);
    }
  }
  /* the lander: gold-foil descent stage on four legs, a grey cabin, engine bell, ladder and dish */
  {
    const L = new THREE.Group();
    L.position.set(36, 0, -26);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.7, 8), foil);
    body.position.y = 2.6;
    L.add(body);
    const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.7, 1.9, 10), grey);
    cabin.position.y = 4.4;
    L.add(cabin);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 8, 0, 6.3, 0, 1.57), grey);
    top.position.y = 5.35;
    L.add(top);
    for (const [wx, wz] of [
      [0.9, 0.95],
      [-0.9, 0.95],
    ]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.34, 3), lit);
      w.position.set(wx, 4.7, wz + 0.42);
      w.rotation.y = wx * 0.5;
      L.add(w);
    }
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.0, 1.1, 14, 1, true), dark);
    bell.position.y = 1.3;
    bell.material.side = THREE.DoubleSide;
    L.add(bell);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4,
        foot = V(Math.cos(a) * 4.3, 0.12, Math.sin(a) * 4.3);
      rod(L, V(Math.cos(a) * 2.2, 3.2, Math.sin(a) * 2.2), foot, 0.1, grey);
      rod(L, V(Math.cos(a) * 2.2, 1.9, Math.sin(a) * 2.2), foot.clone().lerp(V(Math.cos(a) * 2.2, 3.2, Math.sin(a) * 2.2), 0.45), 0.07, grey);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.16, 12), foil);
      pad.position.copy(foot).setY(0.1);
      L.add(pad);
    }
    // ladder down one leg
    for (let k = 0; k < 7; k++) rod(L, V(2.75 + k * 0.2, 2.9 - k * 0.42, 2.45 + k * 0.2), V(2.45 + k * 0.2, 2.9 - k * 0.42, 2.75 + k * 0.2), 0.035, grey, 4);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 8, 0, 6.3, 0, 0.9), white);
    dish.material.side = THREE.DoubleSide;
    dish.position.set(-1.2, 6.9, 0);
    dish.rotation.set(Math.PI + 0.6, 0, 0.5);
    L.add(dish);
    rod(L, V(-0.8, 5.6, 0), V(-1.2, 6.4, 0), 0.05, grey);
    g.add(L);
  }
  /* a landing pad ringed with lights, and fuel tanks beside it */
  {
    const [c, x] = cv(256, 256);
    x.fillStyle = '#3a3d44';
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#f4c20d';
    x.lineWidth = 10;
    x.beginPath();
    x.arc(128, 128, 104, 0, 7);
    x.stroke();
    x.fillStyle = '#f4c20d';
    x.font = '900 150px Impact, "Arial Black", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('H', 128, 138);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(8, 32), std(0xffffff, { map: tex(c, true), roughness: 0.8 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(36, 0.05, -26);
    g.add(pad);
    const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), cyan, 16);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      o.position.set(36 + Math.cos(a) * 8.4, 0.2, -26 + Math.sin(a) * 8.4);
      o.scale.set(1, 1, 1);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      lights.setMatrixAt(k, o.matrix);
    }
    g.add(lights);
    g.userData.padLights = lights;
    for (let k = 0; k < 3; k++) {
      const tk = new THREE.Group(),
        cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4, 16), white);
      cyl.rotation.z = Math.PI / 2;
      tk.add(cyl);
      for (const sx of [-1, 1]) {
        const end = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), white);
        end.position.x = sx * 2;
        end.scale.x = 0.6;
        tk.add(end);
        const band = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.07, 5, 18), k === 1 ? std(0xe63946) : grey);
        band.rotation.y = Math.PI / 2;
        band.position.x = sx * 1.1;
        tk.add(band);
        rod(tk, V(sx * 1.3, -1.1, 0.7), V(sx * 1.3, -1.7, 0.9), 0.08, grey);
        rod(tk, V(sx * 1.3, -1.1, -0.7), V(sx * 1.3, -1.7, -0.9), 0.08, grey);
      }
      tk.position.set(50, 1.7, -14 + k * 3.2);
      tk.rotation.y = 0.5;
      g.add(tk);
    }
  }
  /* a field of solar panels tracking the sun */
  {
    const N = 24,
      pan = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 0.08, 2), panel, N),
      post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), grey, N);
    for (let k = 0; k < N; k++) {
      const x = -30 + (k % 6) * 4.2,
        z = 34 + Math.floor(k / 6) * 3.6;
      o.scale.set(1, 1, 1);
      o.rotation.set(0, 0, 0);
      o.position.set(x, 0.8, z);
      o.updateMatrix();
      post.setMatrixAt(k, o.matrix);
      o.position.set(x, 1.75, z);
      o.rotation.set(-0.6, 0.3, 0);
      o.updateMatrix();
      pan.setMatrixAt(k, o.matrix);
    }
    g.add(pan, post);
  }
  /* comms tower: lattice mast, a big dish that slowly scans, a blinking beacon */
  const tower = new THREE.Group();
  {
    tower.position.set(30, 0, 34);
    const H = 16;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4,
        a2 = a + Math.PI / 2,
        P = (t, y) => V(Math.cos(t) * (1.5 - (y / H) * 1.1), y, Math.sin(t) * (1.5 - (y / H) * 1.1));
      rod(tower, P(a, 0), P(a, H), 0.07, grey);
      for (let j = 0; j < 6; j++) {
        const y0 = (j / 6) * H,
          y1 = ((j + 1) / 6) * H;
        rod(tower, P(a, y0), P(a2, y1), 0.04, grey, 4);
        rod(tower, P(a, y1), P(a2, y1), 0.04, grey, 4);
      }
    }
    const dishG = new THREE.Group();
    dishG.position.y = 11;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 10, 0, 6.3, 0, 0.85), white);
    dish.material.side = THREE.DoubleSide;
    dish.rotation.x = -Math.PI / 2 - 0.5;
    dish.position.z = 2.6;
    dishG.add(dish);
    rod(dishG, V(0, 0, 0), V(0, 1.2, 1.3), 0.06, grey);
    rod(dishG, V(0, 0.6, 1.0), V(0, 2.2, -0.2), 0.04, grey, 4);
    tower.add(dishG);
    tower.userData.dish = dishG;
    const beacon = glow(0xff2030, 2.4);
    beacon.position.y = H + 0.5;
    tower.add(beacon);
    tower.userData.beacon = beacon;
    g.add(tower);
  }
  /* a six-wheeled rover trundling round the base, leaving the odd puff of dust */
  const rover = new THREE.Group();
  {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.8), white);
    chassis.position.y = 1.05;
    rover.add(chassis);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 2.2), panel);
    deck.position.set(0, 1.36, -0.3);
    rover.add(deck);
    const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.34, 14);
    wg.rotateZ(Math.PI / 2);
    rover.userData.wheels = [];
    for (const sx of [-1, 1])
      for (const z of [-1.1, 0, 1.1]) {
        const w = new THREE.Mesh(wg, dark);
        w.position.set(sx * 1.1, 0.45, z);
        rover.add(w);
        rover.userData.wheels.push(w);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8), grey);
        hub.rotation.z = Math.PI / 2;
        hub.position.copy(w.position);
        rover.add(hub);
        rod(rover, V(sx * 0.8, 0.95, z * 0.6), V(sx * 1.0, 0.5, z), 0.05, grey, 4);
      }
    rod(rover, V(0.4, 1.3, 1.0), V(0.4, 2.5, 1.0), 0.05, grey);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.3), white);
    head.position.set(0.4, 2.6, 1.0);
    rover.add(head);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), cyan);
      eye.position.set(0.4 + sx * 0.16, 2.6, 1.16);
      rover.add(eye);
    }
    const ant = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, 6.3, 0, 0.9), foil);
    ant.material.side = THREE.DoubleSide;
    ant.position.set(-0.5, 1.9, -0.9);
    ant.rotation.x = Math.PI + 0.5;
    rover.add(ant);
    rod(rover, V(-0.5, 1.36, -0.9), V(-0.5, 1.6, -0.9), 0.04, grey, 4);
    g.add(rover);
  }
  /* a flag planted by the pad (stiffened along the top, as there's no air) */
  {
    rod(g, V(26, 0, -14), V(26, 3.4, -14), 0.05, grey);
    rod(g, V(26, 3.35, -14), V(27.9, 3.35, -14), 0.03, grey, 4);
    const [c, x] = cv(96, 64);
    x.fillStyle = '#b3151f';
    x.fillRect(0, 0, 96, 64);
    x.fillStyle = '#ffd23f';
    x.beginPath();
    x.arc(48, 32, 18, 0, 7);
    x.fill();
    x.strokeStyle = '#b3151f';
    x.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      x.ellipse(48, 32, 18, 5 + k * 4, 0, 0, 7);
      x.stroke();
    }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.25), basic(0xffffff, { map: tex(c, true), side: THREE.DoubleSide }));
    fl.position.set(26.95, 2.72, -14);
    g.add(fl);
  }
  addTick(g, t => {
    const a = t * 0.045;
    rover.position.set(Math.cos(a) * 27, 0, Math.sin(a) * 27);
    rover.rotation.y = -a;
    rover.position.y = Math.abs(Math.sin(t * 2.3)) * 0.05;
    rover.userData.wheels.forEach(w => (w.rotation.x = t * 2.7));
    tower.userData.dish.rotation.y = Math.sin(t * 0.15) * 1.2;
    tower.userData.beacon.material.opacity = Math.sin(t * 2.5) > 0.5 ? 1 : 0.08;
  });
  return g;
}

export { moreMoon, moreStadium };
