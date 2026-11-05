import * as THREE from 'three';
import { cv, tex } from '../render/textures.js';
import { makePalm } from './props.js';
import { makeFigure } from '../rider/rider.js';
import { V3 } from '../core/constants.js';
import { moreCastle, moreCavern, moreDino, moreGarden, moreMatrix, morePirate, moreSolar } from './premiumMore.js';

/* ---------- the 7 premium arenas ----------
   Free for now; `premium: true` marks them so they can be locked behind an in-app purchase later.
   Each build() returns a group; its userData.tick(t) animates the arena's life every frame.
   Kept light for phones: few lights (glow sprites instead), instanced meshes for anything numerous. */

const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o));
const glowTexCache = {};
function glowTex(col) {
  if (glowTexCache[col]) return glowTexCache[col];
  const [c, x] = cv(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, col);
  g.addColorStop(0.35, col + '88');
  g.addColorStop(1, col + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return (glowTexCache[col] = tex(c, true));
}
const glow = (col, s, op = 1) => {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex(col), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }),
  );
  sp.scale.setScalar(s);
  return sp;
};
function seeded(s) {
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function canvasTex(w, h, draw, rep) {
  const [c, x] = cv(w, h);
  draw(x, w, h);
  const t = tex(c, true);
  if (rep) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
  }
  return t;
}
const ground = (r, mat) => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
};
/* instanced copies of one mesh at given transforms */
function instances(geo, mat, list) {
  const im = new THREE.InstancedMesh(geo, mat, list.length),
    o = new THREE.Object3D();
  list.forEach((f, i) => {
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    f(o, i);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  return im;
}
const ring = (n, r0, r1, rnd) => Array.from({ length: n }, () => [rnd() * Math.PI * 2, r0 + rnd() * (r1 - r0)]);

/* ======================= 1. CRYSTAL CAVERN ======================= */
function buildCavern() {
  const g = new THREE.Group(),
    rnd = seeded(11);
  const rockTex = canvasTex(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = '#2b2630';
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        x.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rnd() * 0.12})`;
        x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 4);
      }
    },
    [6, 6],
  );
  const rock = std(0x4a4350, { map: rockTex, flatShading: true });
  g.add(ground(120, rock));
  // the cave: a lumpy inverted dome all round
  const dome = new THREE.IcosahedronGeometry(78, 3),
    p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new V3().fromBufferAttribute(p, i),
      k = 1 + (Math.sin(v.x * 0.15) * Math.cos(v.z * 0.12) + Math.sin(v.y * 0.2)) * 0.06;
    v.multiplyScalar(k);
    if (v.y < 0) v.y *= 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  dome.computeVertexNormals();
  g.add(new THREE.Mesh(dome, std(0x3b3442, { map: rockTex, side: THREE.BackSide, flatShading: true })));
  // stalactites from the roof and stalagmites from the floor
  const cone = new THREE.ConeGeometry(1, 1, 7);
  g.add(
    instances(cone, rock, Array.from({ length: 70 }, () => (o) => {
      const [a, r] = [rnd() * 6.28, 18 + rnd() * 55],
        h = 4 + rnd() * 14;
      o.position.set(Math.cos(a) * r, 52 - r * 0.25 - h / 2 + rnd() * 4, Math.sin(a) * r);
      o.rotation.x = Math.PI;
      o.scale.set(0.8 + rnd() * 1.8, h, 0.8 + rnd() * 1.8);
    })),
  );
  g.add(
    instances(cone, rock, Array.from({ length: 55 }, () => (o) => {
      const [a, r] = [rnd() * 6.28, 19 + rnd() * 50],
        h = 2 + rnd() * 9;
      o.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      o.scale.set(0.8 + rnd() * 1.6, h, 0.8 + rnd() * 1.6);
    })),
  );
  // glowing crystal clusters
  const crysGeo = new THREE.OctahedronGeometry(1, 0);
  crysGeo.scale(0.45, 1.6, 0.45);
  const glows = [];
  [
    ['#7ef2ff', 0x46d8ff],
    ['#c58cff', 0xa45cff],
    ['#ff7ad9', 0xff4fb8],
  ].forEach(([css, hex], ci) => {
    const mat = std(hex, { emissive: hex, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 });
    const spots = Array.from({ length: 7 }, () => {
      const a = rnd() * 6.28,
        r = 17 + rnd() * 40;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    g.add(
      instances(crysGeo, mat, Array.from({ length: spots.length * 6 }, (_, i) => (o) => {
        const [sx, sz] = spots[(i / 6) | 0];
        o.position.set(sx + (rnd() - 0.5) * 2.5, 0.8, sz + (rnd() - 0.5) * 2.5);
        o.rotation.set((rnd() - 0.5) * 0.9, rnd() * 3, (rnd() - 0.5) * 0.9);
        o.scale.setScalar(0.8 + rnd() * 1.6);
      })),
    );
    spots.forEach(([sx, sz]) => {
      const s = glow(css, 9, 0.55);
      s.position.set(sx, 2.5, sz);
      g.add(s);
      glows.push(s);
    });
  });
  // still underground lake with a sheen
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    std(0x0d3346, { roughness: 0.05, metalness: 0.6, emissive: 0x0a3a50, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-26, 0.05, -30);
  g.add(lake);
  // lanterns on posts round the arena
  const post = std(0x3a2a1c),
    lampM = std(0xffc061, { emissive: 0xffa53a, emissiveIntensity: 2 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 6.28 + 0.3,
      r = 19,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), post);
    pl.position.set(x, 1.5, z);
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), lampM);
    lp.position.set(x, 3.1, z);
    const gl = glow('#ffb347', 3.5, 0.9);
    gl.position.set(x, 3.1, z);
    g.add(pl, lp, gl);
    glows.push(gl);
  }
  // bats flitting overhead
  const batGeo = new THREE.BufferGeometry();
  batGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.9, 0.15, -0.2, -0.4, 0, 0.3, 0, 0, 0, 0.9, 0.15, -0.2, 0.4, 0, 0.3]), 3),
  );
  batGeo.computeVertexNormals();
  const bats = Array.from({ length: 14 }, (_, i) => {
    const b = new THREE.Mesh(batGeo, new THREE.MeshBasicMaterial({ color: 0x0b0a0e, side: THREE.DoubleSide }));
    b.userData = { r: 14 + rnd() * 20, h: 14 + rnd() * 16, s: 0.25 + rnd() * 0.35, ph: rnd() * 6.28 };
    g.add(b);
    return b;
  });
  // falling drips
  const drips = Array.from({ length: 10 }, () => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), std(0x9fe7ff, { emissive: 0x4fb8ff, emissiveIntensity: 1 }));
    const a = rnd() * 6.28,
      r = 16 + rnd() * 30;
    d.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, top: 30 + rnd() * 12, ph: rnd() * 5 };
    g.add(d);
    return d;
  });
  g.userData.tick = t => {
    bats.forEach(b => {
      const u = b.userData,
        a = t * u.s + u.ph;
      b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 2 + u.ph) * 1.5, Math.sin(a) * u.r);
      b.rotation.y = -a;
      b.scale.set(1, 1 + Math.sin(t * 18 + u.ph) * 0.8, 1);
    });
    drips.forEach(d => {
      const u = d.userData,
        k = ((t + u.ph) % 5) / 5;
      d.position.set(u.x, u.top - k * k * u.top, u.z);
    });
    glows.forEach((s, i) => (s.material.opacity = 0.45 + 0.2 * Math.sin(t * 1.3 + i)));
  };
  return g;
}

/* ======================= 2. BACK GARDEN (miniature world) ======================= */
function buildGarden() {
  const g = new THREE.Group(),
    rnd = seeded(21);
  const lawn = canvasTex(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = '#4c8f2f';
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) {
        x.fillStyle = ['#3d7a25', '#5ca23a', '#6bb346', '#447f2a'][i % 4];
        x.fillRect(rnd() * w, rnd() * h, 1.5, 4 + rnd() * 5);
      }
    },
    [10, 10],
  );
  g.add(ground(140, std(0x6aa84a, { map: lawn })));
  // giant grass blades all round (we're tiny): curved, tapering blades with a dark base and a light tip
  const blade = (() => {
    const segs = 5,
      pos = [],
      col = [],
      idx = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs,
        w = 0.5 * (1 - f) + 0.02,
        bend = f * f * 0.8;
      pos.push(-w, f, bend, w, f, bend);
      const c = new THREE.Color(0x2c6b1e).lerp(new THREE.Color(0x9ad25a), f);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  })();
  const gm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });
  // tall blades from just behind the stands out to the fence
  g.add(
    instances(blade, gm, Array.from({ length: 1400 }, () => (o) => {
      const a = rnd() * 6.28,
        r = 42 + rnd() * 52,
        h = 5 + rnd() * rnd() * 16;
      o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      o.rotation.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.3);
      o.scale.set(0.8 + rnd() * 0.9, h, h * 0.35);
    })),
  );
  // a short lawn layer closer in
  g.add(
    instances(blade, gm, Array.from({ length: 1100 }, () => (o) => {
      const a = rnd() * 6.28,
        r = 21.5 + rnd() * 10,
        h = 0.8 + rnd() * 2.2;
      o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      o.rotation.set(0, rnd() * 6.28, 0);
      o.scale.set(0.5 + rnd() * 0.4, h, h * 0.4);
    })),
  );
  // giant flowers: stem, leaves, petals and a centre
  const flowerCols = [0xff4f6d, 0xffc928, 0xffffff, 0xb05cff, 0xff8a2b];
  const petal = new THREE.SphereGeometry(1, 12, 8);
  petal.scale(1.5, 0.22, 0.75);
  petal.translate(1.5, 0, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28 + rnd() * 0.4,
      r = 40 + rnd() * 18,
      h = 9 + rnd() * 12,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      f = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 8), std(0x3f8a2a));
    stem.position.y = h / 2;
    f.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), std(0x4c9c33));
    leaf.scale.set(2.2, 0.15, 0.8);
    leaf.position.set(1.6, h * 0.35, 0);
    leaf.rotation.z = 0.5;
    f.add(leaf);
    const pm = std(flowerCols[i % flowerCols.length], { roughness: 0.6 });
    for (let k = 0; k < 7; k++) {
      const pe = new THREE.Mesh(petal, pm);
      pe.position.y = h;
      pe.rotation.set(0.25, (k / 7) * 6.28, 0.2);
      f.add(pe);
    }
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), std(0xffa31a, { roughness: 1 }));
    ctr.scale.set(1, 0.5, 1);
    ctr.position.y = h + 0.2;
    f.add(ctr);
    f.position.set(x, 0, z);
    f.rotation.z = (rnd() - 0.5) * 0.15;
    g.add(f);
  }
  // wooden fence planks and a shed in the distance
  const plank = std(0x9a6a3e, { map: canvasTex(64, 256, (x, w, h) => {
    x.fillStyle = '#9a6a3e';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(60,35,15,.5)';
    for (let i = 0; i < 18; i++) {
      x.beginPath();
      x.moveTo(rnd() * w, 0);
      x.bezierCurveTo(rnd() * w, h * 0.3, rnd() * w, h * 0.6, rnd() * w, h);
      x.stroke();
    }
  }) });
  for (let i = 0; i < 46; i++) {
    const a = 2.2 + (i / 46) * 2.4,
      r = 82,
      pl = new THREE.Mesh(new THREE.BoxGeometry(5.2, 34, 0.8), plank);
    pl.position.set(Math.cos(a) * r, 17, Math.sin(a) * r);
    pl.lookAt(0, 17, 0);
    g.add(pl);
  }
  const shed = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 20), plank);
  walls.position.y = 11;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 18, 10, 4, 1), std(0x3b4048));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.25, 1, 0.85);
  roof.position.y = 27;
  shed.add(walls, roof);
  shed.position.set(55, 0, 58);
  shed.rotation.y = -0.8;
  g.add(shed);
  // a giant garden gnome watching
  const gnome = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 6.5, 18), std(0x2f62c9));
  body.position.y = 3.25;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.25, 8, 24), std(0x3a2414));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 3.6;
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.7, 18, 14), std(0xf2c2a0));
  face.position.y = 7.3;
  const beard = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.6, 16), std(0xf4f4f4, { roughness: 1 }));
  beard.rotation.x = Math.PI;
  beard.position.set(0, 5.6, 0.9);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), std(0xf09a88));
  nose.position.set(0, 7.2, 1.6);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(2.1, 6, 18), std(0xd92b2b));
  hat.position.y = 10.6;
  hat.rotation.z = 0.25;
  gnome.add(body, belt, face, beard, nose, hat);
  gnome.position.set(-34, 0, 30);
  gnome.rotation.y = 2.4;
  gnome.scale.setScalar(1.6);
  g.add(gnome);
  // ladybirds crawling, butterflies and a bee flying
  const lady = () => {
    const b = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, 6.3, 0, 1.6), std(0xd8141c, { roughness: 0.3 }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), std(0x111111));
    head.position.set(0, 0.1, 1);
    b.add(shell, head);
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), std(0x111111));
      const a = (k / 6) * 6.28;
      s.position.set(Math.cos(a) * 0.55, 0.8, Math.sin(a) * 0.55);
      s.lookAt(Math.cos(a) * 2, 3, Math.sin(a) * 2);
      b.add(s);
    }
    return b;
  };
  const ladies = Array.from({ length: 3 }, (_, i) => {
    const l = lady();
    l.userData = { r: 17 + i * 3, s: 0.05 + i * 0.03, ph: i * 2 };
    g.add(l);
    return l;
  });
  const wing = new THREE.CircleGeometry(1, 12);
  wing.translate(1, 0, 0);
  const flyers = Array.from({ length: 7 }, (_, i) => {
    const b = new THREE.Group(),
      col = [0xff8a1f, 0x4fa8ff, 0xffe14a, 0xff5fb0][i % 4],
      wm = new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.6 });
    const l = new THREE.Mesh(wing, wm),
      r = new THREE.Mesh(wing, wm);
    r.rotation.y = Math.PI;
    const bod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), std(0x222222));
    bod.rotation.x = Math.PI / 2;
    b.add(l, r, bod);
    b.userData = { l, r, rad: 12 + rnd() * 18, h: 6 + rnd() * 10, s: 0.2 + rnd() * 0.3, ph: rnd() * 6 };
    g.add(b);
    return b;
  });
  g.userData.tick = t => {
    ladies.forEach(l => {
      const u = l.userData,
        a = t * u.s + u.ph;
      l.position.set(Math.cos(a) * u.r, 0.1, Math.sin(a) * u.r);
      l.rotation.y = -a;
    });
    flyers.forEach(b => {
      const u = b.userData,
        a = t * u.s + u.ph,
        f = Math.sin(t * 14 + u.ph) * 0.9;
      b.position.set(Math.cos(a) * u.rad, u.h + Math.sin(t * 0.9 + u.ph) * 2, Math.sin(a) * u.rad);
      b.rotation.y = -a;
      u.l.rotation.x = f;
      u.r.rotation.x = -f;
    });
  };
  return g;
}

/* ======================= 3. SOLAR SYSTEM (the globe is a planet) ======================= */
function planetTex(base, bands, rnd) {
  return canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = base;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      x.fillStyle = bands[i % bands.length];
      x.globalAlpha = 0.25 + rnd() * 0.5;
      x.fillRect(0, rnd() * h, w, 2 + rnd() * 10);
    }
    x.globalAlpha = 1;
  });
}
function buildSolar() {
  const g = new THREE.Group(),
    rnd = seeded(31);
  // stars
  const pos = new Float32Array(2500 * 3);
  for (let i = 0; i < 2500; i++) {
    const v = new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(85);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, fog: false })));
  // the arena globe becomes a planet: a ring system round it like Saturn
  const ringTex = canvasTex(256, 8, (x, w) => {
    for (let i = 0; i < w; i++) {
      x.fillStyle = `rgba(${200 + rnd() * 40},${170 + rnd() * 40},${120 + rnd() * 40},${0.25 + rnd() * 0.6})`;
      x.fillRect(i, 0, 1, 8);
    }
  });
  const rg = new THREE.RingGeometry(4.3, 6.8, 96, 1),
    rp = rg.attributes.position,
    uv = rg.attributes.uv;
  for (let i = 0; i < rp.count; i++) {
    const r = Math.hypot(rp.getX(i), rp.getY(i));
    uv.setXY(i, (r - 4.3) / 2.5, 0.5);
  }
  const rings = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  rings.rotation.x = -Math.PI / 2 + 0.12;
  rings.position.y = 4.05;
  g.add(rings);
  // the floor is a slab of asteroid rock the crowd stands on, floating in space
  const rockM = std(0x3a3640, { flatShading: true });
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(22, 12, 6, 24, 2), std(0x24222a, { flatShading: true }));
  slab.position.y = -3;
  g.add(slab);
  // the Sun, glowing far off
  const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffd060, fog: false }));
  sun.position.set(-60, 22, -45);
  const corona = glow('#ffb030', 50, 0.9);
  corona.position.copy(sun.position);
  g.add(sun, corona);
  // planets orbiting the arena
  const P = [
    { r: 1.4, d: 28, s: 0.12, base: '#b5674a', bands: ['#8c4a33', '#d98a64'] },
    { r: 2.6, d: 38, s: 0.08, base: '#d8b27a', bands: ['#b88a50', '#f0d6a2', '#a26c3c'], ring: 1 },
    { r: 2.1, d: 48, s: 0.06, base: '#5fb6d8', bands: ['#4a92b8', '#9fdcf0'] },
    { r: 3.4, d: 60, s: 0.04, base: '#c9a06b', bands: ['#a2683c', '#e8cfa2', '#8a5232', '#d8b083'] },
    { r: 1.1, d: 22, s: 0.2, base: '#9a9aa2', bands: ['#77777f', '#bdbdc4'] },
  ].map((o, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(o.r, 32, 20), std(0xffffff, { map: planetTex(o.base, o.bands, rnd), roughness: 0.9 }));
    if (o.ring) {
      const r2 = new THREE.Mesh(new THREE.RingGeometry(o.r * 1.4, o.r * 2.2, 48), new THREE.MeshBasicMaterial({ color: 0xe8d0a0, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      r2.rotation.x = -1.2;
      m.add(r2);
    }
    m.userData = { ...o, ph: i * 1.7, tilt: (rnd() - 0.5) * 0.3 };
    g.add(m);
    return m;
  });
  // asteroid belt
  const ast = new THREE.IcosahedronGeometry(1, 0);
  const belt = instances(ast, rockM, Array.from({ length: 160 }, () => (o) => {
    const a = rnd() * 6.28,
      r = 66 + rnd() * 10;
    o.position.set(Math.cos(a) * r, (rnd() - 0.5) * 4 + 8, Math.sin(a) * r);
    o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    o.scale.setScalar(0.4 + rnd() * 1.3);
  }));
  g.add(belt);
  // a comet streaking past now and then
  const comet = glow('#bfe8ff', 4, 1),
    tail = glow('#7fc8ff', 10, 0.5);
  g.add(comet, tail);
  g.userData.tick = t => {
    planets.forEach(m => {
      const u = m.userData,
        a = t * u.s + u.ph;
      m.position.set(Math.cos(a) * u.d, 6 + Math.sin(a) * u.d * u.tilt, Math.sin(a) * u.d);
      m.rotation.y = t * 0.3;
    });
    belt.rotation.y = t * 0.01;
    rings.rotation.z = t * 0.05;
    const k = (t % 14) / 14,
      cp = new V3(-80 + k * 160, 40 - k * 20, -50 + k * 30);
    comet.position.copy(cp);
    tail.position.copy(cp).add(new V3(-6, 1.5, -1));
    comet.visible = tail.visible = k < 0.6;
  };
  const planets = P;
  return g;
}

/* ======================= 4. PIRATE SHIP ======================= */
function buildPirate() {
  const g = new THREE.Group(),
    rnd = seeded(41);
  // the sea, gently heaving
  const seaGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, std(0x1f6f93, { roughness: 0.25, metalness: 0.3, flatShading: true }));
  sea.position.y = -2.2;
  g.add(sea);
  const sp = seaGeo.attributes.position,
    base = Float32Array.from(sp.array);
  // the ship is its own group: scaled so the globe sits on a sensibly sized deck, and it rocks on the swell
  const ship = new THREE.Group();
  ship.scale.setScalar(0.6);
  g.add(ship);
  g.userData.ship = ship;
  // the ship's deck: planks, hull sides, rails, masts, sails and rigging
  const planks = canvasTex(
    256,
    256,
    (x, w, h) => {
      for (let i = 0; i < 16; i++) {
        x.fillStyle = ['#8a5a32', '#7a4e2b', '#96643a'][i % 3];
        x.fillRect(0, i * 16, w, 15);
        x.fillStyle = 'rgba(0,0,0,.4)';
        x.fillRect(0, i * 16 + 15, w, 1);
        x.fillRect(((i * 97) % w) | 0, i * 16, 2, 15);
      }
    },
    [0.12, 0.12],
  );
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-16, -40);
  deckShape.quadraticCurveTo(-22, 0, -14, 34);
  deckShape.quadraticCurveTo(0, 52, 14, 34);
  deckShape.quadraticCurveTo(22, 0, 16, -40);
  deckShape.lineTo(-16, -40);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape, 24), std(0xffffff, { map: planks }));
  deck.rotation.x = -Math.PI / 2;
  ship.add(deck);
  const hullGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 9, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.5, bevelSegments: 2, curveSegments: 24 });
  const hull = new THREE.Mesh(hullGeo, std(0x4a2a16, { roughness: 0.8 }));
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -9.05;
  ship.add(hull);
  // gold stripe along the hull
  const stripe = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.6, bevelEnabled: false, curveSegments: 24 }), std(0xc9952a, { metalness: 0.6, roughness: 0.4 }));
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = -2.4;
  stripe.scale.set(1.04, 1.02, 1);
  ship.add(stripe);
  // rail posts round the edge
  const pts = deckShape.getSpacedPoints(70);
  ship.add(
    instances(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), std(0x6b4223), pts.map(p => (o) => o.position.set(p.x, 1.1, -p.y))),
  );
  const railCurve = new THREE.CatmullRomCurve3(pts.map(p => new V3(p.x, 2.2, -p.y)), true);
  ship.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 140, 0.2, 6, true), std(0x6b4223)));
  // masts, yards, sails
  const wood = std(0x5e3a1e),
    sailTex = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#efe6cf';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(120,100,70,.35)';
      for (let i = 0; i < w; i += 16) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i, h);
        x.stroke();
      }
    }),
    sailM = new THREE.MeshStandardMaterial({ map: sailTex, side: THREE.DoubleSide, roughness: 0.9 });
  const sails = [];
  [
    [0, -26, 40],
    [0, 28, 34],
  ].forEach(([x, z, h]) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, h, 10), wood);
    mast.position.set(x, h / 2, z);
    ship.add(mast);
    [0.42, 0.72].forEach((k, i) => {
      const w = 18 - i * 5,
        yard = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, w, 8), wood);
      yard.rotation.z = Math.PI / 2;
      yard.position.set(x, h * k + 7, z);
      ship.add(yard);
      const sg = new THREE.PlaneGeometry(w - 1, 8, 10, 4);
      const sail = new THREE.Mesh(sg, sailM);
      sail.position.set(x, h * k + 3, z + 0.3);
      sail.userData.base = Float32Array.from(sg.attributes.position.array);
      ship.add(sail);
      sails.push(sail);
    });
    // crow's nest
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 1.4, 12, 1, true), std(0x5e3a1e, { side: THREE.DoubleSide }));
    nest.position.set(x, h - 2, z);
    ship.add(nest);
    // rigging lines down to the rails
    const rope = new THREE.LineBasicMaterial({ color: 0x2a1c10 });
    for (const sx of [-14, 14])
      ship.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(x, h - 2, z), new V3(sx, 2.2, z - 4), new V3(x, h * 0.6, z), new V3(sx, 2.2, z + 4)]), rope));
  });
  // the Jolly Roger
  const flagTex = canvasTex(128, 80, (x, w, h) => {
    x.fillStyle = '#101010';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#f2f2f2';
    x.beginPath();
    x.arc(64, 34, 16, 0, 7);
    x.fill();
    x.fillRect(54, 44, 20, 10);
    x.fillStyle = '#101010';
    x.beginPath();
    x.arc(58, 33, 4.5, 0, 7);
    x.arc(70, 33, 4.5, 0, 7);
    x.fill();
    x.strokeStyle = '#f2f2f2';
    x.lineWidth = 6;
    x.beginPath();
    x.moveTo(36, 56);
    x.lineTo(92, 74);
    x.moveTo(92, 56);
    x.lineTo(36, 74);
    x.stroke();
  });
  const flagGeo = new THREE.PlaneGeometry(7, 4.4, 12, 3);
  flagGeo.translate(3.5, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(0, 42, -26);
  flag.userData.base = Float32Array.from(flagGeo.attributes.position.array);
  ship.add(flag);
  // cannons along both sides
  const iron = std(0x232327, { metalness: 0.7, roughness: 0.4 });
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 3.4, 12), iron);
      c.rotation.z = (Math.PI / 2) * side;
      c.position.set(side * 15.5, 1.1, -18 + i * 10);
      const carriage = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1.6), wood);
      carriage.position.set(side * 14.2, 0.4, -18 + i * 10);
      ship.add(c, carriage);
    }
  // barrels and a treasure chest
  const barrel = new THREE.CylinderGeometry(0.9, 0.9, 1.8, 14);
  ship.add(instances(barrel, std(0x7a4a24), Array.from({ length: 8 }, (_, i) => (o) => o.position.set(-11 + (i % 2) * 2, 0.9 + (i > 5 ? 1.8 : 0), 14 + (i % 4)))));
  const chest = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 1.8), std(0x6b3d1b));
  chest.position.set(11, 0.8, -12);
  const gold = glow('#ffcf4a', 4, 0.8);
  gold.position.set(11, 1.9, -12);
  ship.add(chest, gold);
  // a distant island and a rival ship
  const island = new THREE.Group();
  const isl = new THREE.Mesh(new THREE.ConeGeometry(18, 7, 24), std(0xe2c983));
  isl.position.y = -2;
  island.add(isl);
  for (let i = 0; i < 4; i++) {
    const palm = makePalm(8 + rnd() * 4, rnd);
    palm.position.set((rnd() - 0.5) * 14, 1.2, (rnd() - 0.5) * 10);
    island.add(palm);
  }
  island.position.set(-80, 0, -60);
  g.add(island);
  // gulls
  const gullGeo = new THREE.BufferGeometry();
  gullGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -1, 0.3, 0, -0.2, 0, 0.2, 0, 0, 0, 1, 0.3, 0, 0.2, 0, 0.2]), 3));
  const gulls = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(gullGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    m.userData = { r: 20 + rnd() * 30, h: 22 + rnd() * 12, s: 0.15 + rnd() * 0.2, ph: rnd() * 6 };
    g.add(m);
    return m;
  });
  g.userData.tick = t => {
    for (let i = 0; i < sp.count; i++) {
      const x = base[i * 3],
        z = base[i * 3 + 2];
      // waves roll from bow to stern: we're under way
      sp.array[i * 3 + 1] = Math.sin(x * 0.08 + t * 1.2) * 0.6 + Math.cos((z - t * 7) * 0.1) * 0.55;
    }
    sp.needsUpdate = true;
    sails.forEach(s => {
      const b = s.userData.base,
        a = s.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = b[i * 3],
          y = b[i * 3 + 1];
        // billowing in the wind, with gusts and ripples running across the canvas
        const gust = 1.7 + Math.sin(t * 0.7) * 0.5 + Math.sin(t * 2.3) * 0.25;
        a.array[i * 3 + 2] = (1 - (x * x) / 80) * (1 - (y * y) / 30) * gust + Math.sin(x * 0.7 - t * 4) * 0.12 * (1 - (y * y) / 30);
      }
      a.needsUpdate = true;
    });
    {
      const b = flag.userData.base,
        a = flag.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) a.array[i * 3 + 2] = Math.sin(b[i * 3] * 1.1 - t * 6) * 0.35 * (b[i * 3] / 7);
      a.needsUpdate = true;
    }
    // the island slides past as we sail
    island.position.z = -160 + ((t * 2.5) % 320);
    // the ship rocks on the swell (the globe and crowd rock with it: env.rock in arenaTick)
    ship.rotation.z = Math.sin(t * 0.6) * 0.035;
    ship.rotation.x = Math.sin(t * 0.43) * 0.02;
    ship.position.y = Math.sin(t * 0.9) * 0.15;
    gulls.forEach(m => {
      const u = m.userData,
        a = t * u.s + u.ph;
      m.position.set(Math.cos(a) * u.r, u.h, Math.sin(a) * u.r);
      m.rotation.y = -a;
      m.scale.y = 1 + Math.sin(t * 8 + u.ph) * 0.6;
    });
  };
  return g;
}

/* ======================= 5. MEDIEVAL COURT ======================= */
function buildCastle() {
  const g = new THREE.Group(),
    rnd = seeded(51);
  const stoneTex = canvasTex(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = '#8c8578';
      x.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32)
        for (let xx = (y / 32) % 2 ? -32 : 0; xx < w; xx += 64) {
          x.fillStyle = `rgb(${120 + rnd() * 40},${114 + rnd() * 36},${100 + rnd() * 30})`;
          x.fillRect(xx + 2, y + 2, 60, 28);
        }
    },
    [12, 12],
  );
  const stone = std(0xffffff, { map: stoneTex });
  g.add(ground(120, stone));
  // red carpet to the thrones
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(5, 26), std(0x9c1420, { roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.02, -22);
  g.add(carpet);
  // curtain wall with crenellations and towers
  const wallTex = stoneTex.clone();
  wallTex.needsUpdate = true;
  wallTex.repeat.set(16, 2);
  const wallM = std(0xffffff, { map: wallTex });
  const W = 44,
    wall = new THREE.Mesh(new THREE.CylinderGeometry(W, W, 14, 64, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.9 }));
  wall.position.y = 7;
  g.add(wall);
  g.add(
    instances(new THREE.BoxGeometry(2.4, 2.4, 2.2), wallM, Array.from({ length: 56 }, (_, i) => (o) => {
      const a = (i / 56) * 6.28;
      o.position.set(Math.cos(a) * W, 15.2, Math.sin(a) * W);
      o.rotation.y = -a;
    })),
  );
  const roofM = std(0x2b3a7a);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + 0.26,
      x = Math.cos(a) * W,
      z = Math.sin(a) * W,
      tw = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 26, 20), stone),
      roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 10, 20), roofM),
      ban = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc7202c : 0x2a4fb8, side: THREE.DoubleSide }));
    tw.position.set(x, 13, z);
    roof.position.set(x, 31, z);
    ban.position.set(x * 0.885, 16, z * 0.885);
    ban.lookAt(0, 16, 0);
    g.add(tw, roof, ban);
  }
  // royal dais with two thrones and the king and queen watching
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.6, 32, 1, false, Math.PI * 0.75, Math.PI * 0.5), std(0x6e6a62, { map: stoneTex }));
  dais.position.set(0, 0.8, -30);
  g.add(dais);
  const goldM = std(0xd7a72e, { metalness: 0.8, roughness: 0.3 }),
    velvet = std(0x7a0f1b, { roughness: 1 });
  [-3.2, 3.2].forEach((x, i) => {
    const th = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2.6), velvet);
    seat.position.y = 1.8;
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6, 0.6), goldM);
    back.position.set(0, 4.5, -1.2);
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.4, 0.3), velvet);
    cushion.position.set(0, 4.3, -0.85);
    th.add(seat, back, cushion);
    for (const sx of [-1.5, 1.5]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 2.6), goldM);
      arm.position.set(sx, 2.6, 0);
      th.add(arm);
    }
    th.position.set(x, 1.6, -31);
    g.add(th);
    // a royal figure (the game's King outfit) standing in front of the throne
    try {
      const fig = makeFigure('king', i ? 0x6a2bbf : 0xc7202c, null, null, null, null);
      fig.position.set(x, 1.6, -29.5);
      fig.scale.setScalar(1.6);
      g.add(fig);
    } catch (e) {}
  });
  // torches with flickering flames on the wall
  const torches = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.28,
      x = Math.cos(a) * (W - 1),
      z = Math.sin(a) * (W - 1);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 1.6, 6), std(0x3a2414));
    st.position.set(x, 8, z);
    const fl = glow('#ff9a2a', 3.5, 1);
    fl.position.set(x, 9.1, z);
    g.add(st, fl);
    torches.push(fl);
  }
  // pennant strings along the wall top, tower to tower
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * 6.28 + 0.26,
      a1 = ((k + 1) / 6) * 6.28 + 0.26;
    for (let i = 1; i < 12; i++) {
      const f = i / 12,
        a = a0 + (a1 - a0) * f,
        r = W - 2,
        pen = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 3), std([0xc7202c, 0xffc23d, 0x2a4fb8][i % 3]));
      pen.position.set(Math.cos(a) * r, 19 - Math.sin(f * Math.PI) * 2.5, Math.sin(a) * r);
      pen.rotation.x = Math.PI;
      g.add(pen);
    }
  }
  g.userData.tick = t => torches.forEach((f, i) => f.scale.setScalar(3 + Math.sin(t * 13 + i * 2) * 0.35 + Math.sin(t * 7.3 + i) * 0.25));
  return g;
}

/* ======================= 6. DINO VALLEY ======================= */
function longNeck(col) {
  const d = new THREE.Group(),
    m = std(col, { roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m);
  body.scale.set(5, 3.2, 3);
  body.position.y = 7;
  const neckC = new THREE.CatmullRomCurve3([new V3(4, 8, 0), new V3(7, 12, 0), new V3(8.5, 17, 0), new V3(9.6, 19.5, 0)]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckC, 20, 0.9, 10), m);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), m);
  head.scale.set(1.8, 1, 1.1);
  head.position.set(10.6, 19.8, 0);
  const tailC = new THREE.CatmullRomCurve3([new V3(-4, 7.5, 0), new V3(-9, 6, 0), new V3(-14, 4, 1), new V3(-18, 2.5, 2)]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailC, 20, 0.8, 8), m);
  d.add(body, neck, head, tail);
  const legs = [];
  for (const [x, z] of [
    [3, 1.6],
    [3, -1.6],
    [-3, 1.6],
    [-3, -1.6],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 6, 10), m);
    leg.geometry.translate(0, -3, 0);
    leg.position.set(x, 6, z);
    d.add(leg);
    legs.push(leg);
  }
  d.userData.legs = legs;
  return d;
}
function pterosaur() {
  const p = new THREE.Group(),
    m = new THREE.MeshStandardMaterial({ color: 0x7a4a3a, side: THREE.DoubleSide, roughness: 0.8 });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(5, 0.6);
  wingShape.lineTo(3.4, -1.2);
  wingShape.lineTo(0, -0.8);
  const wg = new THREE.ShapeGeometry(wingShape);
  wg.rotateX(-Math.PI / 2);
  const l = new THREE.Mesh(wg, m),
    r = new THREE.Mesh(wg, m);
  r.scale.x = -1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3, 8), m);
  body.rotation.x = Math.PI / 2;
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 6), m);
  crest.rotation.x = -2.2;
  crest.position.set(0, 0.4, -1.6);
  p.add(l, r, body, crest);
  p.userData.wings = [l, r];
  return p;
}
function buildDino() {
  const g = new THREE.Group(),
    rnd = seeded(61);
  const groundTex = canvasTex(
    256,
    256,
    (x, w, h) => {
      x.fillStyle = '#6a7a35';
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        x.fillStyle = ['#7a5a33', '#5d7030', '#8a9a45', '#4f6028'][i % 4];
        x.globalAlpha = 0.4;
        x.fillRect(rnd() * w, rnd() * h, 3 + rnd() * 6, 3 + rnd() * 6);
      }
      x.globalAlpha = 1;
    },
    [8, 8],
  );
  g.add(ground(150, std(0xffffff, { map: groundTex })));
  // a smoking volcano with glowing lava
  const volc = new THREE.Mesh(new THREE.CylinderGeometry(6, 34, 40, 28, 4), std(0x4a3a30, { flatShading: true }));
  volc.position.set(-30, 20, -85);
  const lavaGlow = glow('#ff5a1a', 30, 0.9);
  lavaGlow.position.set(-30, 41, -85);
  const lava = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.6, 20), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  lava.position.set(-30, 40.1, -85);
  g.add(volc, lavaGlow, lava);
  const smoke = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#555555'), transparent: true, depthWrite: false, opacity: 0.6 }));
    s.userData.ph = i / 10;
    g.add(s);
    return s;
  });
  // ferns and palms
  const frond = new THREE.ConeGeometry(0.6, 6, 4);
  frond.translate(0, 3, 0);
  g.add(
    instances(frond, std(0x2f7a2a, { flatShading: true }), Array.from({ length: 240 }, () => (o) => {
      const [a, r] = [rnd() * 6.28, 30 + rnd() * 55];
      o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      o.rotation.set((rnd() - 0.5) * 1.4, rnd() * 6.28, (rnd() - 0.5) * 1.4);
      o.scale.setScalar(0.5 + rnd() * 1.1);
    })),
  );
  for (let i = 0; i < 16; i++) {
    const palm = makePalm(10 + rnd() * 8, rnd),
      a = rnd() * 6.28,
      r = 24 + rnd() * 50;
    palm.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(palm);
  }
  // long-necks walking slowly round, pterosaurs circling
  const herd = [0x6f8a5a, 0x8a7a5a, 0x5a7a6a].map((c, i) => {
    const d = longNeck(c);
    d.userData.r = 74 + i * 10;
    d.userData.ph = i * 2.1;
    d.userData.s = 0.025 + i * 0.006;
    g.add(d);
    return d;
  });
  const fliers = Array.from({ length: 4 }, () => {
    const p = pterosaur();
    p.userData.r = 24 + rnd() * 20;
    p.userData.h = 26 + rnd() * 12;
    p.userData.s = 0.15 + rnd() * 0.12;
    p.userData.ph = rnd() * 6;
    g.add(p);
    return p;
  });
  g.userData.tick = t => {
    herd.forEach(d => {
      const u = d.userData,
        a = t * u.s + u.ph;
      d.position.set(Math.cos(a) * u.r, 0, Math.sin(a) * u.r);
      d.rotation.y = -a - Math.PI / 2;
      u.legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.4 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.25));
    });
    fliers.forEach(p => {
      const u = p.userData,
        a = t * u.s + u.ph,
        f = Math.sin(t * 3 + u.ph) * 0.5;
      p.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 3, Math.sin(a) * u.r);
      p.rotation.y = -a + Math.PI;
      p.userData.wings[0].rotation.z = f;
      p.userData.wings[1].rotation.z = -f;
    });
    smoke.forEach(s => {
      const k = (t * 0.08 + s.userData.ph) % 1;
      s.position.set(-30 + k * 10, 42 + k * 30, -85);
      s.scale.setScalar(8 + k * 22);
      s.material.opacity = 0.55 * (1 - k);
    });
    lavaGlow.material.opacity = 0.75 + Math.sin(t * 2) * 0.15;
  };
  return g;
}

/* ======================= 7. DIGITAL GRID (matrix) ======================= */
function codeTex(rnd) {
  const glyphs = 'アイウエオカキクケコサシスセソ0123456789ABCDEF<>/*=+';
  return canvasTex(64, 512, (x, w, h) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    x.font = 'bold 16px monospace';
    for (let col = 0; col < 3; col++)
      for (let y = 0; y < h; y += 18) {
        const k = rnd();
        x.fillStyle = k < 0.08 ? '#d8ffe0' : `rgba(40,255,110,${0.25 + rnd() * 0.75})`;
        x.fillText(glyphs[(rnd() * glyphs.length) | 0], 4 + col * 20, y + 16);
      }
  });
}
function buildMatrix() {
  const g = new THREE.Group(),
    rnd = seeded(71);
  const gridTex = canvasTex(
    128,
    128,
    (x, w, h) => {
      x.fillStyle = '#020604';
      x.fillRect(0, 0, w, h);
      x.strokeStyle = '#1aff6a';
      x.lineWidth = 3;
      x.strokeRect(0, 0, w, h);
      x.globalAlpha = 0.25;
      x.lineWidth = 1;
      x.strokeRect(w / 2, 0, 0.1, h);
      x.strokeRect(0, h / 2, w, 0.1);
    },
    [40, 40],
  );
  g.add(ground(160, new THREE.MeshBasicMaterial({ map: gridTex })));
  // falling code: tall planes with scrolling glyph columns
  const cols = [];
  for (let i = 0; i < 46; i++) {
    const t = codeTex(rnd);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 40),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    const a = rnd() * 6.28,
      r = 22 + rnd() * 50;
    m.position.set(Math.cos(a) * r, 18 + rnd() * 8, Math.sin(a) * r);
    m.lookAt(0, m.position.y, 0);
    m.userData.s = 0.1 + rnd() * 0.25;
    g.add(m);
    cols.push(m);
  }
  // floating wireframe shapes and data cubes
  const wire = new THREE.MeshBasicMaterial({ color: 0x29ff7a, wireframe: true }),
    shapes = [new THREE.IcosahedronGeometry(3, 1), new THREE.OctahedronGeometry(3, 0), new THREE.TorusKnotGeometry(2.2, 0.6, 60, 8), new THREE.DodecahedronGeometry(3, 0)].map((geo, i) => {
      const m = new THREE.Mesh(geo, wire),
        a = (i / 4) * 6.28 + 0.5;
      m.position.set(Math.cos(a) * 30, 14 + i * 3, Math.sin(a) * 30);
      g.add(m);
      return m;
    });
  const cubeM = new THREE.MeshBasicMaterial({ color: 0x0f5a2a, transparent: true, opacity: 0.55 });
  const cubes = instances(new THREE.BoxGeometry(1, 1, 1), cubeM, Array.from({ length: 80 }, () => (o) => {
    const [a, r] = [rnd() * 6.28, 19 + rnd() * 40];
    o.position.set(Math.cos(a) * r, rnd() * 3, Math.sin(a) * r);
    o.scale.set(1 + rnd() * 2, 1 + rnd() * 8, 1 + rnd() * 2);
    o.position.y = o.scale.y / 2;
  }));
  g.add(cubes);
  // a scanning ring that sweeps up and down
  const scan = new THREE.Mesh(new THREE.TorusGeometry(18, 0.15, 6, 80), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.8 }));
  scan.rotation.x = Math.PI / 2;
  g.add(scan);
  g.userData.tick = t => {
    cols.forEach(c => (c.material.map.offset.y = (t * c.userData.s) % 1));
    shapes.forEach((m, i) => {
      m.rotation.set(t * 0.3 + i, t * 0.4, 0);
      m.position.y = 14 + i * 3 + Math.sin(t + i) * 1.5;
    });
    scan.position.y = 2 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 22;
    scan.material.opacity = 0.5 + 0.3 * Math.sin(t * 3);
  };
  return g;
}

/* ---------- arena table entries (merged into ARENAS) ---------- */
const crowdRing = (o = {}) => Object.assign({ tiers: 6, r0: 14, dr: 1.4, y0: 0.5, dy: 0.8, gap: 0.66, stepCol: 0x55575e }, o);
const PREMIUM = {
  cavern: {
    name: 'Crystal cavern',
    premium: true,
    songs: [11, 8],
    env: {
      bg: 0x05040a,
      fog: [0x0a0712, 30, 120],
      hemi: [0x8f7fff, 0x150f20, 0.45],
      sun: 0.25,
      sunPos: [0, 40, 0],
      sunCol: 0xb0a0ff,
      spots: 0.9,
      spotCol: 0xc8b8ff,
      beams: 1,
      exp: 1.0,
    },
    crowdGlow: 0.9,
    crowd: crowdRing({ stepCol: 0x3a3440 }),
    build: () => moreCavern(buildCavern()),
  },
  garden: {
    name: 'Back garden',
    premium: true,
    songs: [12, 7],
    env: {
      bg: 0x9fd4ff,
      fog: [0xbfe4ff, 60, 200],
      sky: [
        [0, '#5aa8f0'],
        [0.6, '#a8d8ff'],
        [1, '#e8f6ff'],
      ],
      hemi: [0xeaf6ff, 0x4f7a30, 0.55],
      sun: 1.2,
      sunPos: [-40, 60, 30],
      sunCol: 0xfff2d8,
      spots: 0.3,
      beams: 0,
      exp: 1.05,
    },
    crowdGlow: 0.3,
    crowd: crowdRing({ stepCol: 0x6a4a2a }),
    build: () => moreGarden(buildGarden()),
  },
  solar: {
    name: 'Solar system',
    premium: true,
    songs: [13, 10],
    env: {
      bg: 0x000006,
      fog: [0x000006, 120, 300],
      sky: [
        [0, '#000000'],
        [1, '#0a0420'],
      ],
      hemi: [0xb0c0ff, 0x101020, 0.4],
      sun: 1.3,
      sunPos: [-60, 22, -45],
      sunCol: 0xffe0a0,
      spots: 0.5,
      spotCol: 0xd0d8ff,
      beams: 0,
      exp: 1.0,
      noStand: true,
    },
    crowdGlow: 0.6,
    crowd: crowdRing({ stepCol: 0x4a4550 }),
    build: () => moreSolar(buildSolar()),
  },
  pirate: {
    name: 'Pirate ship',
    premium: true,
    songs: [14, 5],
    env: {
      bg: 0xf0a060,
      fog: [0xf2b07a, 90, 260],
      sky: [
        [0, '#2d4f8f'],
        [0.55, '#f08a4a'],
        [1, '#ffd08a'],
      ],
      hemi: [0xffe0c0, 0x305070, 0.7],
      sun: 1.4,
      sunPos: [60, 25, -80],
      sunCol: 0xffc080,
      spots: 0.3,
      beams: 0,
      exp: 1.0,
      rock: 1,
    },
    crowdGlow: 0.35,
    crowd: crowdRing({ r0: 7.6, tiers: 3, dr: 1.1, stepCol: 0x6b4223 }),
    build: () => morePirate(buildPirate()),
  },
  castle: {
    name: 'Royal court',
    premium: true,
    songs: [15, 0],
    env: {
      bg: 0x7fa8d8,
      fog: [0x9fbce0, 70, 200],
      sky: [
        [0, '#3f6fb8'],
        [1, '#cfe2f8'],
      ],
      hemi: [0xf0f4ff, 0x5a5040, 0.5],
      sun: 1.05,
      sunPos: [30, 50, 20],
      sunCol: 0xfff0d8,
      spots: 0.4,
      beams: 0,
      exp: 1.0,
    },
    crowdGlow: 0.35,
    crowd: crowdRing({ stepCol: 0x6e6a62 }),
    build: () => moreCastle(buildCastle()),
  },
  dino: {
    name: 'Dino valley',
    premium: true,
    songs: [16, 6],
    env: {
      bg: 0xd8c08a,
      fog: [0xd8c79a, 70, 220],
      sky: [
        [0, '#7aa0c8'],
        [0.6, '#e8c890'],
        [1, '#f4dca8'],
      ],
      hemi: [0xfff0d0, 0x40502a, 0.5],
      sun: 1.1,
      sunPos: [-30, 45, 40],
      sunCol: 0xffe2b0,
      spots: 0.3,
      beams: 0,
      exp: 1.0,
    },
    crowdGlow: 0.3,
    crowd: crowdRing({ stepCol: 0x5a4a30 }),
    build: () => moreDino(buildDino()),
  },
  matrix: {
    name: 'Digital grid',
    premium: true,
    songs: [17, 3],
    env: {
      bg: 0x000000,
      fog: [0x000502, 40, 140],
      hemi: [0x7dffb0, 0x001a08, 0.4],
      sun: 0.3,
      sunPos: [0, 40, 0],
      sunCol: 0x9dffc0,
      spots: 0.8,
      spotCol: 0x5dff9a,
      beams: 1,
      exp: 1.0,
    },
    crowdGlow: 1.0,
    crowd: crowdRing({ stepCol: 0x0a2a14 }),
    build: () => moreMatrix(buildMatrix()),
  },
};

export { PREMIUM };
