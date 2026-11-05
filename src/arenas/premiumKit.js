import * as THREE from 'three';
import { dino, model } from './models.js';

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
  // the grand keep behind the thrones: a tall hexagonal tower with a blue spire
  {
    const a = -Math.PI / 2,
      R = 41,
      x = Math.cos(a) * R,
      z = Math.sin(a) * R,
      K = 11;
    put(g, 'tower-hexagon-base', x, 0, z, 0, K);
    put(g, 'tower-hexagon-mid', x, K * 1.31, z, 0, K);
    put(g, 'tower-hexagon-mid', x, K * 2.31, z, 0, K);
    put(g, 'tower-hexagon-top', x, K * 3.31, z, 0, K);
    put(g, 'tower-hexagon-roof', x, K * 3.6, z, 0, K * 1.05);
    put(g, 'flag-banner-long', x, K * 1.6, z + K * 0.42, Math.PI / 2, K * 0.75);
  }
  // a grass ring between the stands and the walls
  {
    const grass = new THREE.Mesh(new THREE.RingGeometry(23, 46, 64), new THREE.MeshStandardMaterial({ color: 0x5e9a3c, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.03;
    g.add(grass);
  }
  // stairs up to the walls and pennants along the battlements
  [0.6, 2.2, 3.9, 5.5].forEach(a => put(g, 'stairs-stone', Math.cos(a) * 43, 0, Math.sin(a) * 43, -a - Math.PI / 2, [5, 5, 5]));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.17;
    put(g, 'flag-pennant', Math.cos(a) * 47, S * 1.31, Math.sin(a) * 47, -a, S * 0.6);
  }
  // siege engines and trees in the courtyard, behind the stands
  put(g, 'siege-trebuchet', Math.cos(2.2) * 33, 0, Math.sin(2.2) * 33, 1.2, 4.5);
  put(g, 'siege-catapult', Math.cos(4.1) * 33, 0, Math.sin(4.1) * 33, -0.6, 4.5);
  put(g, 'siege-tower', Math.cos(1.2) * 36, 0, Math.sin(1.2) * 36, 2, 5);
  put(g, 'siege-ram', Math.cos(3.3) * 34, 0, Math.sin(3.3) * 34, 0.5, 4.5);
  put(g, 'siege-ballista', Math.cos(5.0) * 33, 0, Math.sin(5.0) * 33, -1.2, 4.5);
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
      m.scale.setScalar(0.5);
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

/* drop the triangles of the two built-in masts (and their tops) from the galleon's hull mesh */
function cutMasts(geo) {
  const p = geo.attributes.position,
    idx = geo.index.array,
    keep = [];
  const mastV = i => {
    const x = Math.abs(p.getX(i)),
      y = p.getY(i),
      z = p.getZ(i),
      // the mast poles run from the deck (y≈2.1) to the top in single long faces, so take everything thin
      // above the deck, plus the wider crow's nests and yards higher up (measured from the model)
      inMain = z > -0.95 && z < 0.25,
      inFore = z > -6.4 && z < -4.15;
    return (inMain && ((x < 0.3 && y > 1.95) || (x < 0.55 && y > 3.8))) || (inFore && ((x < 0.3 && y > 1.95) || (x < 0.95 && y > 4.4)));
  };
  for (let i = 0; i < idx.length; i += 3) if (!(mastV(idx[i]) && mastV(idx[i + 1]) && mastV(idx[i + 2]))) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  geo.setIndex(keep);
}

/* ---------- Pirate ship: Kenney Pirate Kit galleon (the globe stands on the open deck between the masts) ---------- */
function kitPirate(g) {
  const ship = g.userData.ship;
  if (ship) {
    ship.clear(); // drop the old hand-built hull, masts and deck props
    ship.scale.setScalar(1);
    // ×1.6: deck ≈ the globe's width; deck height 2.1 → sits at 0. The ship's own masts and sails would block the
    // view, so they're cut out; the globe stands mid-deck (model z −0.75) clear of the raised bow and stern decks,
    // and a single mast rises out of the top of the cage carrying the skull sail.
    put(ship, 'ship-pirate-large', 0, -3.36, 1.2, 0, 1.6, m => {
      let sail = null;
      m.traverse(o => {
        if (/^(sail|flag)/.test(o.name)) {
          if (o.name === 'sail-a' && !sail) sail = o;
          o.visible = false;
        }
        if (o.isMesh && o.name !== 'sail-a' && o.geometry.index) cutMasts(o.geometry);
      });
      if (sail) {
        const s2 = sail.clone();
        s2.visible = true;
        s2.position.set(0, 11.6, 0);
        s2.scale.setScalar(1.6);
        ship.add(s2);
      }
    });
    // the mast out of the top of the cage
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4223, roughness: 0.8 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 13, 10), wood);
    mast.position.y = 7.4 + 6.5; // starts clear above the cage top (7.05): nothing goes through the globe
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 7, 8), wood);
    yard.rotation.z = Math.PI / 2;
    yard.position.y = 17.4;
    ship.add(mast, yard);
    put(ship, 'flag-pirate-high', 0, 19.6, 0, 0, 1.4);
    for (const side of [-1, 1]) put(ship, 'cannon', side * 3.3, 0, 3.6, side * Math.PI / 2, 1.2);
    put(ship, 'barrel', -2.9, 0, -4.2, 0, 1);
    put(ship, 'crate-bottles', 2.9, 0, -4, 0.4, 1);
  }
  // the rival galleon that gets sunk
  const rival = g.userData.rival;
  if (rival) {
    rival.clear();
    put(rival, 'ship-pirate-medium', 0, -2.6, 0, Math.PI / 2, 1.6);
  }
  // the island we sail past: sand, palms, rocks and a watchtower
  const isl = g.userData.island;
  if (isl) {
    isl.clear();
    put(isl, 'patch-sand-foliage', 0, -1.4, 0, 0, 7);
    put(isl, 'rocks-sand-a', 8, -1.2, 4, 1, 2.5);
    put(isl, 'rocks-sand-b', -7, -1.2, -5, 2, 2.5);
    put(isl, 'tower-complete-large', 3, -1, -6, 0.5, 2.2);
    [
      [-4, 3, 0],
      [5, -3, 2],
      [-1, 7, 4],
    ].forEach(([x, z, r]) => put(isl, 'palm-detailed-bend', x, -0.6, z, r, 2.6));
    put(isl, 'boat-row-large', 10, -1.3, 9, 0.6, 2);
  }
  return g;
}

/* ---------- Dino valley: animated dinosaurs (Quaternius) replace the hand-built ones ---------- */
function kitDino(g) {
  g.traverse(o => {
    if (o.userData && o.userData.legs) o.visible = false;
  });
  // a forest round the valley: conifers and palms (Kenney kits), thicker further out
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.sin(i * 7.3) * 0.06,
      r = 58 + ((i * 37) % 30),
      kind = i % 3 === 0 ? 'palm-detailed-bend' : i % 3 === 1 ? 'tree-large' : 'palm-detailed-straight';
    put(g, kind, Math.cos(a) * r, 0, Math.sin(a) * r, a * 3, (kind === 'tree-large' ? 9 + (i % 4) : 4 + (i % 3)) * 0.6);
  }
  const herd = [];
  const add = (name, len, r, speed, ph, clip) =>
    dino(name, len)
      .then(d => {
        d.play(clip);
        d.obj.userData = { r, speed, ph, mixer: d.mixer };
        g.add(d.obj);
        herd.push(d.obj);
      })
      .catch(() => {});
  add('Apatosaurus', 24, 78, 0.022, 0, 'Walk');
  add('Apatosaurus', 20, 86, 0.02, 2.4, 'Walk');
  add('Trex', 13, 56, 0.05, 1.2, 'Walk');
  add('Triceratops', 8, 44, 0.05, 3.6, 'Walk');
  add('Triceratops', 7, 47, 0.05, 4.1, 'Walk');
  [0, 1, 2].forEach(i => add('Velociraptor', 3.6, 27 + i * 1.6, 0.22, i * 0.25, 'Run'));
  let last = null;
  addTick(g, t => {
    const dt = last == null ? 0 : Math.min(0.1, t - last);
    last = t;
    herd.forEach(o => {
      const u = o.userData,
        a = u.ph + t * u.speed;
      o.position.set(Math.cos(a) * u.r, 0, Math.sin(a) * u.r);
      o.rotation.y = -a; // facing along the circle
      u.mixer.update(dt);
    });
  });
  return g;
}

/* ---------- Back garden: real ants and wasps ---------- */
function kitGarden(g) {
  (g.userData.antParts || []).forEach(m => (m.visible = false));
  g.traverse(o => {
    if (o.userData && o.userData.bee) o.visible = false;
  });
  const ants = Array.from({ length: 16 }, (_, i) => {
    const a = new THREE.Group();
    model('ant').then(m => {
      m.scale.setScalar(2.2);
      a.add(m);
    });
    g.add(a);
    return a;
  });
  const wasps = Array.from({ length: 4 }, (_, i) => {
    const w = new THREE.Group();
    model('wasp').then(m => {
      m.scale.setScalar(2.4);
      w.add(m);
    });
    w.userData = { r: 28 + i * 5, h: 6 + i * 2, s: 0.3 + i * 0.06, ph: i * 1.6 };
    g.add(w);
    return w;
  });
  addTick(g, t => {
    ants.forEach((a, i) => {
      const ang = t * 0.06 - i * 0.05,
        r = 10.5 + Math.sin(ang * 5) * 0.6;
      a.position.set(Math.cos(ang) * r, Math.abs(Math.sin(t * 14 + i)) * 0.03, Math.sin(ang) * r);
      a.rotation.y = -ang; // marching along the circle
    });
    wasps.forEach(w => {
      const u = w.userData,
        a = t * u.s + u.ph;
      w.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 3 + u.ph) * 1.2, Math.sin(a) * u.r);
      w.rotation.y = -a;
    });
  });
  return g;
}

export { kitArctic, kitCastle, kitDino, kitGarden, kitPirate };
