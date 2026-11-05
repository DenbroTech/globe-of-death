import * as THREE from 'three';
import { dino, model } from '../arenas/models.js';

/* ---------- Levels screen: a little world globe ----------
   A spinning planet with a hand-drawn map. Each unlocked level has a small model on its spot (tent, beach,
   stadium, city, sea); the Moon base is a moon in orbit. Picking a level turns the globe so that spot faces
   you, with a pin (dot + line). Locked levels aren't shown at all. It has its own small renderer, made when
   the Levels screen opens and thrown away when it closes. */

// where each level sits: latitude / longitude in degrees ('moon' orbits instead)
const SPOTS = {
  bigtop: { lat: 46, lon: 4 }, // Europe
  beach: { lat: 16, lon: -70 }, // Caribbean
  stadium: { lat: -20, lon: -56 }, // South America
  crane: { lat: 36, lon: 118 }, // East Asia
  under: { lat: -12, lon: -140 }, // Pacific
  moon: { moon: true },
  cavern: { lat: 32, lon: 78 }, // Himalaya
  garden: { lat: 50, lon: -96 }, // North America
  solar: { orbit: true },
  pirate: { lat: -12, lon: -28 }, // Atlantic
  castle: { lat: 58, lon: 42 }, // far east of Europe
  dino: { lat: -4, lon: 24 }, // Africa
  matrix: { lat: 64, lon: 100 }, // Siberia
  arctic: { lat: -78, lon: 10 }, // South pole
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const onSphere = (lat, lon, r = 1) => {
  const la = (lat * Math.PI) / 180,
    lo = (lon * Math.PI) / 180;
  // matches three.js SphereGeometry's UVs, so a spot lines up with the same place on the map texture
  return V(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

/* equirectangular map, drawn crisp: deep-to-shallow sea, continents with wavy coastlines, a sand rim and a dark
   coast line, greens / dry land / mountains by latitude, ice caps, the Sky crane city. Also returns a height map
   (bump) and a roughness map (shiny sea, matte land) so the planet has relief and definition. */
function mapTexture() {
  const W = 2048,
    H = 1024;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')];
  };
  const [c, g] = mk(),
    [hc, hg] = mk(),
    [rc, rg] = mk();
  const px = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // sea: deep blue with a gentle latitude gradient and fine ripple noise
  const sea = g.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#123a6e');
  sea.addColorStop(0.5, '#1a5aa6');
  sea.addColorStop(1, '#123a6e');
  g.fillStyle = sea;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`;
    g.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 14, 1);
  }
  hg.fillStyle = '#000';
  hg.fillRect(0, 0, W, H);
  rg.fillStyle = '#2a2a2a'; // sea: fairly shiny
  rg.fillRect(0, 0, W, H);
  // continents: wavy closed outlines (lat, lon, radius x/y in px, seed)
  const LAND = [
    [48, 12, 150, 80, 1], // Europe
    [6, 20, 120, 170, 2], // Africa
    [45, 100, 300, 120, 3], // Asia
    [42, -100, 200, 115, 4], // North America
    [-16, -60, 95, 160, 5], // South America
    [-25, 135, 110, 65, 6], // Australia
  ];
  const shape = (ctx, [la, lo, rx, ry, sd], grow = 1) => {
    const [x, y] = px(la, lo);
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2,
        k = 1 + 0.22 * Math.sin(3 * a + sd) + 0.12 * Math.sin(5 * a + sd * 2.1) + 0.06 * Math.sin(11 * a + sd * 3.3) + 0.03 * Math.sin(23 * a + sd);
      const X = x + Math.cos(a) * rx * k * grow,
        Y = y + Math.sin(a) * ry * k * grow;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath();
  };
  // shallow water halo
  g.save();
  g.filter = 'blur(14px)';
  g.fillStyle = 'rgba(70,170,220,.75)';
  LAND.forEach(L => (shape(g, L, 1.1), g.fill()));
  g.restore();
  // sand rim, then land
  g.fillStyle = '#e8d28e';
  LAND.forEach(L => (shape(g, L, 1.025), g.fill()));
  LAND.forEach(L => {
    const [la, lo] = L,
      [x, y] = px(la, lo),
      gr = g.createRadialGradient(x, y, 0, x, y, Math.max(L[2], L[3]) * 1.1);
    const dry = Math.abs(la) < 25; // tropics: greener in the middle, dry at the edges
    gr.addColorStop(0, dry ? '#3f8f34' : '#4f9a3c');
    gr.addColorStop(0.6, dry ? '#6aa83f' : '#5ea844');
    gr.addColorStop(1, dry ? '#c2a85a' : '#7fae4f');
    g.fillStyle = gr;
    shape(g, L);
    g.fill();
  });
  // forests, deserts and mountain ranges inside the land (clipped to it)
  g.save();
  g.beginPath();
  LAND.forEach(L => shape(g, L));
  g.clip();
  hg.save();
  hg.beginPath();
  LAND.forEach(L => shape(hg, L));
  hg.clip();
  hg.fillStyle = '#3a3a3a';
  hg.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const L = LAND[i % LAND.length],
      [x, y] = px(L[0], L[1]),
      X = x + (rnd() - 0.5) * L[2] * 1.6,
      Y = y + (rnd() - 0.5) * L[3] * 1.6,
      r = 8 + rnd() * 26,
      k = rnd();
    g.fillStyle = k < 0.55 ? 'rgba(40,110,40,.45)' : k < 0.75 ? 'rgba(210,180,100,.4)' : 'rgba(120,100,80,.55)';
    g.beginPath();
    g.ellipse(X, Y, r * (1 + rnd()), r, rnd() * 3, 0, 7);
    g.fill();
    if (k >= 0.75) {
      // mountain: grey-brown with a snowy cap, and high on the height map
      g.fillStyle = 'rgba(240,244,248,.75)';
      g.beginPath();
      g.ellipse(X, Y, r * 0.35, r * 0.25, 0, 0, 7);
      g.fill();
      const hgr = hg.createRadialGradient(X, Y, 0, X, Y, r * 1.4);
      hgr.addColorStop(0, '#ffffff');
      hgr.addColorStop(1, 'rgba(255,255,255,0)');
      hg.fillStyle = hgr;
      hg.fillRect(X - r * 1.5, Y - r * 1.5, r * 3, r * 3);
    }
  }
  hg.restore();
  g.restore();
  // crisp coastline
  g.strokeStyle = 'rgba(30,60,30,.65)';
  g.lineWidth = 2.5;
  LAND.forEach(L => (shape(g, L), g.stroke()));
  // matte land on the roughness map
  rg.fillStyle = '#e0e0e0';
  LAND.forEach(L => (shape(rg, L, 1.02), rg.fill()));
  // north: a thin ice cap with a soft edge
  {
    const ig = g.createLinearGradient(0, 72, 0, 42);
    ig.addColorStop(0, 'rgba(240,246,250,0)');
    ig.addColorStop(1, '#f0f6fa');
    g.fillStyle = '#f0f6fa';
    g.fillRect(0, 0, W, 52);
    g.fillStyle = ig;
    g.fillRect(0, 52, W, 20);
  }
  // south: an Antarctica-style ice continent with a ragged coast, bays and a long peninsula
  {
    const edge = lon => {
      const r = lon * (Math.PI / 180);
      let lat = -66 + 3.2 * Math.sin(r * 2 + 0.7) + 2.1 * Math.sin(r * 5 + 1.9) + 1.2 * Math.sin(r * 11 + 0.3);
      lat += 13 * Math.exp(-(((lon + 62) / 9) ** 2)); // the peninsula, reaching north
      lat -= 7 * Math.exp(-(((lon + 150) / 18) ** 2)) + 6 * Math.exp(-(((lon + 20) / 14) ** 2)); // two deep ice-shelf bays
      return lat;
    };
    const coast = (ctx, open) => {
      ctx.beginPath();
      if (!open) ctx.moveTo(0, H);
      for (let lon = -180; lon <= 180; lon += 1) ctx.lineTo(...px(edge(lon) + Math.sin(lon * 1.7) * 0.35, lon));
      if (!open) {
        ctx.lineTo(W, H);
        ctx.closePath();
      }
    };
    const ice = g.createLinearGradient(0, H * 0.7, 0, H);
    ice.addColorStop(0, '#e3eef6');
    ice.addColorStop(1, '#fbfdff');
    g.fillStyle = ice;
    coast(g);
    g.fill();
    // blue-grey crevasses and wind-scoured ridges
    g.save();
    coast(g);
    g.clip();
    for (let i = 0; i < 900; i++) {
      const x = rnd() * W,
        y = H * 0.76 + rnd() * H * 0.24;
      g.strokeStyle = `rgba(${120 + rnd() * 40},${150 + rnd() * 40},${185 + rnd() * 30},${0.12 + rnd() * 0.2})`;
      g.lineWidth = 0.8 + rnd() * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 8);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = 'rgba(90,130,170,.75)';
    g.lineWidth = 2.5;
    coast(g, true); // just the shoreline (no seam down to the pole)
    g.stroke();
    // relief: a high ice dome rising toward the pole
    const hgr = hg.createLinearGradient(0, H * 0.8, 0, H);
    hgr.addColorStop(0, '#9a9a9a');
    hgr.addColorStop(1, '#ffffff');
    hg.fillStyle = hgr;
    coast(hg);
    hg.fill();
    rg.fillStyle = '#bdbdbd';
    coast(rg);
    rg.fill();
  }
  // ground decals so each level's model sits into the land / sea rather than on top of it
  const decal = (id, col, rx, ry) => {
    const sp = SPOTS[id];
    if (!sp || sp.lat == null) return;
    const [x, y] = px(sp.lat, sp.lon),
      gr = g.createRadialGradient(x, y, 0, x, y, rx);
    gr.addColorStop(0, col);
    gr.addColorStop(0.7, col);
    gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, 7);
    g.fill();
  };
  decal('beach', 'rgba(240,215,140,1)', 34, 22);
  decal('garden', 'rgba(110,190,70,1)', 30, 20);
  decal('stadium', 'rgba(70,160,80,1)', 26, 18);
  decal('bigtop', 'rgba(200,170,110,1)', 24, 16);
  decal('castle', 'rgba(150,140,125,1)', 26, 18);
  decal('dino', 'rgba(40,95,35,1)', 40, 28);
  decal('cavern', 'rgba(105,95,110,1)', 30, 20);
  decal('matrix', 'rgba(20,60,35,1)', 28, 18);
  decal('pirate', 'rgba(40,130,190,1)', 40, 26);
  decal('under', 'rgba(20,70,140,1)', 50, 32);
  // sky crane city: a grey patch with a street grid
  {
    const [x, y] = px(SPOTS.crane.lat, SPOTS.crane.lon);
    g.fillStyle = '#8a8f99';
    g.beginPath();
    g.ellipse(x, y, 60, 40, 0, 0, 7);
    g.fill();
    g.strokeStyle = '#5d626b';
    g.lineWidth = 2;
    for (let i = -56; i <= 56; i += 12) {
      g.beginPath();
      g.moveTo(x + i, y - 40);
      g.lineTo(x + i, y + 40);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 60, y + i * 0.7);
      g.lineTo(x + 60, y + i * 0.7);
      g.stroke();
    }
  }
  const T = c => {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  };
  const map = T(c);
  map.encoding = THREE.sRGBEncoding;
  return { map, bump: T(hc), rough: T(rc) };
}

/* small models for each spot, built in the spot's local frame (+Y = up out of the ground) */
const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o));
function marker(id) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (id === 'bigtop') {
    // striped circus tent with a flag
    const stripes = document.createElement('canvas');
    stripes.width = 64;
    stripes.height = 8;
    const sg = stripes.getContext('2d');
    for (let i = 0; i < 8; i++) {
      sg.fillStyle = i % 2 ? '#f4f1ea' : '#d8262f';
      sg.fillRect(i * 8, 0, 8, 8);
    }
    const tx = new THREE.CanvasTexture(stripes);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), new THREE.MeshStandardMaterial({ map: tx }), 0, 0.02);
    add(new THREE.ConeGeometry(0.075, 0.08, 16), new THREE.MeshStandardMaterial({ map: tx }), 0, 0.08);
    add(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 6), M(0x333333), 0, 0.13);
    add(new THREE.BoxGeometry(0.02, 0.012, 0.002), M(0xffc23d), 0.01, 0.145);
  } else if (id === 'beach') {
    // sand bar with palms and a parasol
    add(new THREE.CylinderGeometry(0.07, 0.08, 0.008, 20), M(0xf0d995), 0, 0.004);
    for (const [x, z, h] of [
      [-0.03, 0.01, 0.07],
      [0.025, -0.02, 0.06],
    ]) {
      const tr = add(new THREE.CylinderGeometry(0.0035, 0.005, h, 6), M(0x8a5a2b), x, h / 2, z);
      tr.rotation.z = 0.15;
      for (let k = 0; k < 5; k++) {
        const leaf = add(new THREE.ConeGeometry(0.01, 0.045, 4), M(0x2f9a3a), x + 0.006, h, z);
        leaf.rotation.set(Math.PI / 2.4, (k / 5) * Math.PI * 2, 0, 'YXZ');
      }
    }
    add(new THREE.ConeGeometry(0.03, 0.012, 12), M(0xff6b3d), 0.035, 0.035, 0.03);
    add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.03, 4), M(0xffffff), 0.035, 0.015, 0.03);
  } else if (id === 'stadium') {
    // oval bowl with a green pitch and floodlights
    const bowl = add(new THREE.TorusGeometry(0.055, 0.016, 8, 28), M(0xc9ccd4), 0, 0.012);
    bowl.rotation.x = Math.PI / 2;
    bowl.scale.set(1.25, 1, 1);
    const pitch = add(new THREE.CircleGeometry(0.05, 24), M(0x3aa64a), 0, 0.004);
    pitch.rotation.x = -Math.PI / 2;
    pitch.scale.set(1.25, 1, 1);
    for (const [x, z] of [
      [0.08, 0.05],
      [-0.08, 0.05],
      [0.08, -0.05],
      [-0.08, -0.05],
    ]) {
      add(new THREE.CylinderGeometry(0.002, 0.002, 0.06, 4), M(0x777777), x, 0.03, z);
      add(new THREE.BoxGeometry(0.012, 0.008, 0.004), M(0xffffff, { emissive: 0xffffee, emissiveIntensity: 1 }), x, 0.062, z);
    }
  } else if (id === 'crane') {
    // a clump of towers with lit windows, and a crane
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const h = 0.02 + rnd() * rnd() * 0.12,
        a = rnd() * 6.28,
        r = Math.sqrt(rnd()) * 0.07;
      add(
        new THREE.BoxGeometry(0.012, h, 0.012),
        M(0x5b6170, { emissive: 0xffd27a, emissiveIntensity: 0.25 + rnd() * 0.4 }),
        Math.cos(a) * r,
        h / 2,
        Math.sin(a) * r,
      );
    }
    add(new THREE.BoxGeometry(0.004, 0.16, 0.004), M(0xffb000), 0.05, 0.08, 0.03);
    add(new THREE.BoxGeometry(0.08, 0.004, 0.004), M(0xffb000), 0.03, 0.16, 0.03);
  } else if (id === 'under') {
    // a ring of bubbles rising out of the sea
    const bm = M(0xcfefff, { transparent: true, opacity: 0.75, emissive: 0x5fb8ff, emissiveIntensity: 0.4 });
    for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.006 + (i % 3) * 0.004, 10, 8), bm, Math.sin(i * 2.4) * 0.03, 0.01 + i * 0.012, Math.cos(i * 2.4) * 0.03);
    const ring = add(new THREE.TorusGeometry(0.05, 0.004, 6, 30), M(0xffffff, { transparent: true, opacity: 0.6 }), 0, 0.002);
    ring.rotation.x = Math.PI / 2;
    g.userData.bubbles = true;
  }
  else if (id === 'cavern') {
    // a dark hole in the ground with a rocky rim and crystals glowing down inside
    const hole = add(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: 0x07060a }), 0, 0.003);
    hole.rotation.x = -Math.PI / 2;
    const rim = add(new THREE.TorusGeometry(0.052, 0.012, 6, 20), M(0x6a6170, { flatShading: true }), 0, 0.004);
    rim.rotation.x = Math.PI / 2;
    for (const [x, z, c] of [
      [0.015, 0.01, 0x7ef2ff],
      [-0.018, 0.005, 0xc58cff],
      [0.002, -0.02, 0xff7ad9],
    ])
      add(new THREE.OctahedronGeometry(0.009, 0), M(c, { emissive: c, emissiveIntensity: 1.4 }), x, 0.006, z).scale.set(1, 1.8, 1);
  } else if (id === 'garden') {
    // a tiny shed, a fence and a giant flower
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.004, 20), M(0x4c9a35), 0, 0.002);
    add(new THREE.BoxGeometry(0.05, 0.035, 0.035), M(0x9a6a3e), 0.02, 0.018, -0.02);
    add(new THREE.ConeGeometry(0.04, 0.025, 4), M(0x3b4048), 0.02, 0.048, -0.02).rotation.y = Math.PI / 4;
    add(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 4), M(0x3f8a2a), -0.03, 0.035, 0.03);
    add(new THREE.SphereGeometry(0.016, 10, 6), M(0xff4f6d), -0.03, 0.072, 0.03).scale.set(1, 0.4, 1);
    add(new THREE.SphereGeometry(0.006, 8, 6), M(0xffc928), -0.03, 0.076, 0.03);
  } else if (id === 'pirate') {
    // a little galleon at sea
    add(new THREE.BoxGeometry(0.09, 0.022, 0.034), M(0x5a3418), 0, 0.011);
    add(new THREE.CylinderGeometry(0.002, 0.002, 0.08, 4), M(0x3a2414), 0.012, 0.06);
    add(new THREE.CylinderGeometry(0.002, 0.002, 0.065, 4), M(0x3a2414), -0.022, 0.052);
    add(new THREE.PlaneGeometry(0.035, 0.035), new THREE.MeshStandardMaterial({ color: 0xefe6cf, side: THREE.DoubleSide }), 0.012, 0.065, 0.003).rotation.y = Math.PI / 2;
    add(new THREE.PlaneGeometry(0.028, 0.028), new THREE.MeshStandardMaterial({ color: 0xefe6cf, side: THREE.DoubleSide }), -0.022, 0.055, 0.003).rotation.y = Math.PI / 2;
    add(new THREE.PlaneGeometry(0.014, 0.009), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }), 0.012, 0.105, 0).rotation.y = Math.PI / 2;
  } else if (id === 'castle') {
    // keep and four towers with blue roofs
    add(new THREE.BoxGeometry(0.06, 0.04, 0.06), M(0x9a9286), 0, 0.02);
    for (const [x, z] of [
      [0.035, 0.035],
      [-0.035, 0.035],
      [0.035, -0.035],
      [-0.035, -0.035],
    ]) {
      add(new THREE.CylinderGeometry(0.012, 0.013, 0.06, 10), M(0x9a9286), x, 0.03, z);
      add(new THREE.ConeGeometry(0.016, 0.03, 10), M(0x2b3a7a), x, 0.075, z);
    }
    add(new THREE.BoxGeometry(0.012, 0.008, 0.001), M(0xc7202c), 0, 0.06, 0);
  } else if (id === 'dino') {
    // a smoking volcano in the jungle
    add(new THREE.CylinderGeometry(0.015, 0.06, 0.07, 14), M(0x4a3a30, { flatShading: true }), 0, 0.035);
    add(new THREE.CircleGeometry(0.013, 12), M(0xff6a1a, { emissive: 0xff5a1a, emissiveIntensity: 1.5 }), 0, 0.0705).rotation.x = -Math.PI / 2;
    for (let k = 0; k < 5; k++) add(new THREE.ConeGeometry(0.01, 0.04, 5), M(0x2f7a2a), Math.cos(k * 1.3) * 0.07, 0.02, Math.sin(k * 1.3) * 0.07);
    g.userData.smoke = add(new THREE.SphereGeometry(0.014, 8, 6), M(0x777777, { transparent: true, opacity: 0.6 }), 0, 0.09);
  } else if (id === 'matrix') {
    // a glowing green data block
    add(new THREE.BoxGeometry(0.07, 0.003, 0.07), new THREE.MeshBasicMaterial({ color: 0x1aff6a, wireframe: true }), 0, 0.002);
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.012, 0.02 + (k % 3) * 0.02, 0.012), M(0x0f5a2a, { emissive: 0x1aff6a, emissiveIntensity: 0.8 }), ((k % 3) - 1) * 0.025, 0.02, (k > 2 ? 1 : -1) * 0.015);
  }
  else if (id === 'arctic') {
    add(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xf4f8fc), 0, 0);
    add(new THREE.CircleGeometry(0.01, 10, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffb04a }), 0, 0.001, 0.03);
    add(new THREE.CylinderGeometry(0.008, 0.012, 0.035, 8), M(0x15161c), 0.05, 0.018, 0.01);
    add(new THREE.SphereGeometry(0.008, 8, 6), M(0xf4f4f0), 0.05, 0.016, 0.019);
  }
  return g;
}
/* the real game models on the globe (same Kenney / Quaternius / Poly models as the arenas), tiny.
   [model, x, y, z, rotY, scale]; `clear` drops the hand-built marker first */
const KIT_MARKERS = {
  beach: { clear: 1, parts: [['patch-sand-foliage', 0, -0.004, 0, 0, 0.05], ['palm-detailed-bend', 0.025, 0, 0.012, 0, 0.032], ['palm-detailed-straight', -0.03, 0, -0.018, 1.2, 0.03], ['boat-row-large', 0.05, 0, -0.04, 0.6, 0.02]] },
  castle: {
    clear: 1,
    parts: [
      ['tower-square-base', 0, 0, 0, 0, 0.045],
      ['tower-square-mid-windows', 0, 0.045, 0, 0, 0.045],
      ['tower-square-top-roof-high', 0, 0.09, 0, 0, 0.045],
      ['wall', 0.045, 0, 0, 0, 0.045],
      ['wall', -0.045, 0, 0, 0, 0.045],
      ['tower-hexagon-base', 0.09, 0, 0.005, 0, 0.04],
      ['tower-hexagon-roof', 0.09, 0.052, 0.005, 0, 0.04],
      ['tower-hexagon-base', -0.09, 0, 0.005, 0, 0.04],
      ['tower-hexagon-roof', -0.09, 0.052, 0.005, 0, 0.04],
    ],
  },
  pirate: { clear: 1, parts: [['ship-pirate-medium', 0, -0.012, 0, 0.7, 0.012]] },
  garden: { clear: 1, parts: [['ladybug', 0.02, 0, 0.01, 0.8, 0.045], ['ant', -0.03, 0, -0.01, 2, 0.08], ['tree-small', -0.04, 0, 0.04, 0, 0.04]] },
  under: { parts: [['shark', 0, 0.035, 0, 1, 0.06]] },
  arctic: { parts: [['penguin', 0.045, 0, 0.01, -0.4, 0.028], ['penguin', 0.06, 0, -0.012, 0.3, 0.024]] },
  dino: { parts: [['palm-detailed-bend', 0.05, 0, 0.03, 0, 0.03], ['palm-detailed-straight', -0.05, 0, -0.02, 1, 0.028]] },
};
function kitMarker(id, g) {
  const K = KIT_MARKERS[id];
  if (!K) return;
  if (K.clear) g.clear();
  K.parts.forEach(([n, x, y, z, ry, sc]) =>
    model(n)
      .then(m => {
        m.position.set(x, y, z);
        m.rotation.y = ry;
        m.scale.multiplyScalar(sc);
        g.add(m);
      })
      .catch(() => {}),
  );
  if (id === 'dino')
    dino('Trex', 0.13)
      .then(d => {
        d.obj.rotation.y = 0.8;
        g.add(d.obj);
      })
      .catch(() => {});
}
/* a little green flag planted by a level you've finished */
function flag() {
  const f = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  pole.position.y = 0.08;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshStandardMaterial({ color: 0x2fd35a, side: THREE.DoubleSide, emissive: 0x0f6a28, emissiveIntensity: 0.6 }));
  cloth.position.set(0.035, 0.135, 0);
  f.add(pole, cloth);
  return f;
}

let R = null; // the live globe (renderer, scene…) while the Levels screen is open

/* build the globe into `host`; `open(id)` says whether a level is unlocked; `sel` is the selected level */
function mountGlobe(host, open, sel, onPick, done = () => false) {
  unmountGlobe();
  const w = host.clientWidth || 320,
    h = host.clientHeight || 260,
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 50);
  // pull back on tall screens so the whole planet fits the width
  const dist = Math.max(5.2, 1.3 / (Math.tan((16 * Math.PI) / 180) * (w / h)));
  cam.position.set(0, 0.35, dist);
  cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x203040, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(3, 2, 4);
  scene.add(sun);
  const planet = new THREE.Group();
  scene.add(planet);
  const MAP = mapTexture();
  planet.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({ map: MAP.map, bumpMap: MAP.bump, bumpScale: 0.025, roughnessMap: MAP.rough, roughness: 1, metalness: 0.05 }),
    ),
  );
  // thin atmosphere glow
  planet.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: 0.12, side: THREE.BackSide }),
    ),
  );
  const pins = {};
  for (const [id, sp] of Object.entries(SPOTS)) {
    if (!open(id) || sp.moon || sp.orbit) continue;
    const m = marker(id),
      n = onSphere(sp.lat, sp.lon);
    kitMarker(id, m);
    m.position.copy(n);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
    m.scale.setScalar(1.9);
    planet.add(m);
    if (done(id)) {
      const f = flag();
      f.position.copy(onSphere(sp.lat + 2.5, sp.lon + 2.5));
      f.quaternion.setFromUnitVectors(V(0, 1, 0), f.position.clone().normalize());
      f.scale.setScalar(1.6);
      planet.add(f);
    }
    pins[id] = { obj: m, normal: n };
  }
  // the Moon base: a moon on its own orbit (only once that level is unlocked)
  let moon = null;
  if (open('moon')) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#b8b8bc';
    g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(80,80,90,${0.15 + Math.random() * 0.3})`;
      g.beginPath();
      g.arc(Math.random() * 128, Math.random() * 64, 1 + Math.random() * 5, 0, 7);
      g.fill();
    }
    moon = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 1 }));
    moon.add(ball);
    // tiny base dome + flag
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, 6.3, 0, 1.6), M(0xdfe6ef, { metalness: 0.5 }));
    dome.position.y = 0.21;
    moon.add(dome);
    scene.add(moon);
    pins.moon = { obj: moon, moon: true };
  }
  // the Solar system level: a ringed planet on a wider orbit
  let ringed = null;
  if (open('solar')) {
    ringed = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 18), M(0xd8b27a));
    const rg = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.38, 40), new THREE.MeshBasicMaterial({ color: 0xe8d0a0, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    rg.rotation.x = -1.2;
    ringed.add(ball, rg);
    scene.add(ringed);
    pins.solar = { obj: ringed, moon: true };
  }
  // the pin: a line out from the spot with a glowing dot at the end
  const pinMat = new THREE.LineBasicMaterial({ color: 0xffc23d }),
    pinLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), pinMat),
    pinDot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc23d }));
  scene.add(pinLine, pinDot);
  const label = document.createElement('div');
  label.className = 'lgLabel';
  host.appendChild(label);

  const target = new THREE.Quaternion();
  let cur = sel,
    t0 = performance.now(),
    raf = 0,
    spin = 0,
    drag = null;
  const aim = id => {
    cur = id;
    const p = pins[id];
    label.textContent = p ? (open(id) ? '' : '') : '';
    if (!p || p.moon) {
      target.identity();
      return;
    }
    // turn the planet so this spot faces the camera (and stays upright-ish)
    const toCam = cam.position.clone().normalize();
    target.setFromUnitVectors(p.normal, toCam);
  };
  aim(sel);
  // drag to spin by hand
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, q: planet.quaternion.clone(), moved: 0 };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    const dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dy));
    // spin freely: sideways turns it round, up/down tips it over (so the poles come into view)
    planet.quaternion
      .copy(drag.q)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), dx * 0.01))
      .premultiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), dy * 0.01));
    target.copy(planet.quaternion);
  });
  el.addEventListener('pointerup', e => {
    const d = drag;
    drag = null;
    if (!d || d.moved > 6) return;
    // a tap: pick the nearest visible spot (or the moon)
    const r = el.getBoundingClientRect(),
      mx = e.clientX - r.left,
      my = e.clientY - r.top;
    let best = null,
      bd = 46;
    for (const [id, p] of Object.entries(pins)) {
      const wp = p.obj.getWorldPosition(V(0, 0, 0));
      if (!p.moon && wp.clone().normalize().dot(cam.position.clone().normalize()) < 0.15) continue; // far side
      const sp = wp.project(cam),
        d2 = Math.hypot((sp.x * 0.5 + 0.5) * r.width - mx, (-sp.y * 0.5 + 0.5) * r.height - my);
      if (d2 < bd) {
        bd = d2;
        best = id;
      }
    }
    if (best) onPick(best);
  });

  let last = 0;
  const loop = ms => {
    raf = requestAnimationFrame(loop);
    if (ms - last < 31) return; // 30 fps is plenty for a spinning globe (saves battery / heat)
    last = ms;
    const t = (performance.now() - t0) / 1000;
    if (!drag) planet.quaternion.slerp(target, 0.12);
    if (ringed) {
      const a = t * 0.16 + 2.4;
      ringed.position.set(Math.sin(a) * 2.25, -0.55, Math.cos(a) * 2.25);
    }
    if (moon) {
      const a = t * 0.25;
      moon.position.set(Math.sin(a) * 1.75, 0.45, Math.cos(a) * 1.75);
      moon.rotation.y = a;
    }
    for (const p of Object.values(pins)) if (p.obj.userData.bubbles) p.obj.children.forEach((c, i) => c.geometry && c.geometry.type === 'SphereGeometry' && (c.position.y = 0.01 + ((i * 0.012 + t * 0.03) % 0.11)));
    // pin from the selected spot
    const p = pins[cur];
    if (p) {
      const base = p.obj.getWorldPosition(V(0, 0, 0)),
        out = p.moon ? base.clone().add(V(0, 0.42, 0)) : base.clone().multiplyScalar(1.5);
      pinLine.geometry.setFromPoints([p.moon ? base.clone().add(V(0, 0.22, 0)) : base.clone().multiplyScalar(1.02), out]);
      pinDot.position.copy(out);
      pinLine.visible = pinDot.visible = true;
      const sp = out.clone().project(cam);
      label.style.transform = `translate(${(sp.x * 0.5 + 0.5) * w}px,${(-sp.y * 0.5 + 0.5) * h}px)`;
      label.hidden = false;
    } else {
      pinLine.visible = pinDot.visible = false;
      label.hidden = true;
    }
    renderer.render(scene, cam);
  };
  loop();
  R = {
    renderer,
    scene,
    stop: () => cancelAnimationFrame(raf),
    aim,
    setLabel: s => (label.textContent = s),
  };
  return R;
}
function unmountGlobe() {
  if (!R) return;
  R.stop();
  R.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => (m.map && m.map.dispose(), m.dispose()));
  });
  R.renderer.dispose();
  R.renderer.forceContextLoss();
  R.renderer.domElement.remove();
  R = null;
}

export { SPOTS, mountGlobe, unmountGlobe };
