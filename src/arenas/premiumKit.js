import * as THREE from 'three';
import { model } from './models.js';

/* ---------- arenas dressed with imported models (see models.js) ----------
   Models load asynchronously; each piece is placed as soon as it arrives. */

const addTick = (g, f) => {
  const p = g.userData.tick;
  g.userData.tick = t => {
    if (p) p(t);
    f(t);
  };
};
/* place a model: name, position, rotation y, scale (number or [x,y,z]) */
function put(g, name, x, y, z, ry = 0, s = 1, then) {
  return model(name)
    .then(m => {
      m.position.set(x, y, z);
      m.rotation.y = ry;
      Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s);
      g.add(m);
      if (then) then(m);
      return m;
    })
    .catch(() => null);
}

/* ---------- Royal court: Kenney Castle Kit curtain wall, towers and gatehouse ---------- */
function kitCastle(g) {
  const S = 7, // kit tiles are 1 unit: 7 m per tile
    RW = 48.5, // wall centre radius (inner face ~45, behind the torches and tapestries)
    N = Math.round((2 * Math.PI * RW) / S),
    step = (2 * Math.PI) / N,
    tileW = (2 * Math.PI * RW) / N / S + 0.02; // stretch a hair so the tiles close up round the circle
  const TOWERS = new Set();
  for (let k = 1; k < 6; k++) TOWERS.add(Math.round((k * N) / 6));
  for (let i = 0; i < N; i++) {
    const a = i * step,
      x = Math.cos(a) * RW,
      z = Math.sin(a) * RW,
      ry = -a - Math.PI / 2; // tile faces the middle
    if (i === 0) {
      // the gatehouse: an arched gate wall, an iron portcullis and the drawbridge lowered outside
      put(g, 'wall-narrow-gate', x, 0, z, ry, [tileW * S, S, S]);
      put(g, 'metal-gate', Math.cos(a) * (RW - 0.6), 0, Math.sin(a) * (RW - 0.6), ry + Math.PI / 2, S * 1.05, m => (g.userData.portcullis = m));
      put(g, 'bridge-draw', Math.cos(a) * (RW + S * 0.95), 0.05, Math.sin(a) * (RW + S * 0.95), ry + Math.PI / 2, S);
      for (const off of [-1, 1]) {
        const b = a + off * step * 0.75;
        put(g, 'tower-square-base', Math.cos(b) * RW, 0, Math.sin(b) * RW, ry, S * 0.8);
        put(g, 'tower-square-mid-windows', Math.cos(b) * RW, S * 0.8, Math.sin(b) * RW, ry, S * 0.8);
        put(g, 'tower-square-top-roof-high', Math.cos(b) * RW, S * 1.6, Math.sin(b) * RW, ry, S * 0.8);
        put(g, 'flag-banner-long', Math.cos(b) * (RW - S * 0.42), S * 0.9, Math.sin(b) * (RW - S * 0.42), ry + Math.PI / 2, S * 0.7);
      }
      continue;
    }
    put(g, TOWERS.has(i) ? 'wall' : 'wall', x, 0, z, ry, [tileW * S, S, S]);
    if (TOWERS.has(i)) {
      // a tall tower with a spire and a banner on the inside face
      const R = RW + 0.5;
      put(g, 'tower-square-base', Math.cos(a) * R, 0, Math.sin(a) * R, ry, S * 1.25);
      put(g, 'tower-square-mid-windows', Math.cos(a) * R, S * 1.25, Math.sin(a) * R, ry, S * 1.25);
      put(g, 'tower-square-mid', Math.cos(a) * R, S * 2.5, Math.sin(a) * R, ry, S * 1.25);
      put(g, 'tower-square-top-roof-high', Math.cos(a) * R, S * 3.75, Math.sin(a) * R, ry, S * 1.25);
      put(g, 'flag-banner-long', Math.cos(a) * (R - S * 0.66), S * 1.6, Math.sin(a) * (R - S * 0.66), ry + Math.PI / 2, S * 0.9);
    }
  }
  // a moat beyond the drawbridge (seen through the gate)
  const moat = new THREE.Mesh(new THREE.RingGeometry(RW + 4.5, RW + 10, 64, 1, -0.35, 0.7), new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.1, metalness: 0.3 }));
  moat.rotation.x = -Math.PI / 2;
  moat.position.y = 0.04;
  g.add(moat);
  // siege engines and trees in the courtyard, behind the stands
  put(g, 'siege-trebuchet', Math.cos(2.2) * 33, 0, Math.sin(2.2) * 33, 1.2, 4.5);
  put(g, 'siege-catapult', Math.cos(4.1) * 33, 0, Math.sin(4.1) * 33, -0.6, 4.5);
  [0.9, 2.6, 3.7, 5.3].forEach((a, i) => put(g, i % 2 ? 'tree-large' : 'tree-small', Math.cos(a) * 38, 0, Math.sin(a) * 38, a, 6));
  addTick(g, t => {
    const p = g.userData.portcullis;
    if (!p) return;
    const k = (t % 16) / 16,
      up = k < 0.5 ? 1 : k < 0.6 ? 1 - (k - 0.5) * 10 : k < 0.85 ? 0 : (k - 0.85) / 0.15;
    p.position.y = up * S * 0.7;
  });
  return g;
}

/* ---------- South pole: polar bears padding round ---------- */
function kitArctic(g) {
  const bears = [0, 1].map(i => {
    const b = new THREE.Group();
    model('polarbear').then(m => {
      m.scale.setScalar(1.4);
      b.add(m);
    });
    b.userData = { r: 30 + i * 8, s: 0.035 + i * 0.01, ph: i * 3 };
    g.add(b);
    return b;
  });
  addTick(g, t => {
    bears.forEach(b => {
      const u = b.userData,
        a = t * u.s + u.ph;
      b.position.set(Math.cos(a) * u.r, Math.abs(Math.sin(t * 2.4 + u.ph)) * 0.08, Math.sin(a) * u.r);
      b.rotation.y = -a; // walking along the circle
    });
  });
  return g;
}

export { kitArctic, kitCastle };
