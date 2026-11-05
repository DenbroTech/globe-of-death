import * as THREE from 'three';

/* ---------- Levels screen: a little world globe ----------
   A spinning planet with a hand-drawn map. Each unlocked level has a small model on its spot (tent, beach,
   stadium, city, sea); the Moon base is a moon in orbit. Picking a level turns the globe so that spot faces
   you, with a pin (dot + line). Locked levels aren't shown at all. It has its own small renderer, made when
   the Levels screen opens and thrown away when it closes. */

// where each level sits: latitude / longitude in degrees ('moon' orbits instead)
const SPOTS = {
  bigtop: { lat: 48, lon: 8 },
  beach: { lat: 18, lon: -72 },
  stadium: { lat: 40, lon: -4 },
  crane: { lat: 38, lon: 120 },
  under: { lat: -12, lon: -140 },
  moon: { moon: true },
  cavern: { lat: 30, lon: 62 },
  garden: { lat: 53, lon: -2 },
  solar: { orbit: true },
  pirate: { lat: -8, lon: -32 },
  castle: { lat: 52, lon: 22 },
  dino: { lat: -4, lon: 24 },
  matrix: { lat: 62, lon: 95 },
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const onSphere = (lat, lon, r = 1) => {
  const la = (lat * Math.PI) / 180,
    lo = (lon * Math.PI) / 180;
  // matches three.js SphereGeometry's UVs, so a spot lines up with the same place on the map texture
  return V(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

/* equirectangular map: sea with depth shading, a few continents with beaches, forest and snow caps */
function mapTexture() {
  const W = 1024,
    H = 512,
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const sea = g.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#1d4f8f');
  sea.addColorStop(0.5, '#2a6db8');
  sea.addColorStop(1, '#1d4f8f');
  g.fillStyle = sea;
  g.fillRect(0, 0, W, H);
  const px = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  // seeded blobs so the map is the same every time
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blob = (lat, lon, rx, ry, col, n = 14) => {
    const [x, y] = px(lat, lon);
    for (let i = 0; i < n; i++) {
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(x + (rnd() - 0.5) * rx * 1.4, y + (rnd() - 0.5) * ry * 1.4, rx * (0.35 + rnd() * 0.5), ry * (0.35 + rnd() * 0.5), rnd() * 3, 0, 7);
      g.fill();
    }
  };
  const LAND = [
    [45, 10, 90, 55], // Europe-ish
    [10, 20, 70, 90], // Africa-ish
    [45, 100, 170, 70], // Asia-ish
    [40, -100, 110, 60], // North America-ish
    [-15, -60, 55, 80], // South America-ish
    [-25, 135, 60, 35], // Australia-ish
  ];
  // shallow-water halo, sand rim, then land
  for (const [la, lo, rx, ry] of LAND) blob(la, lo, rx * 1.15, ry * 1.15, 'rgba(90,170,220,.55)');
  s = 7;
  for (const [la, lo, rx, ry] of LAND) blob(la, lo, rx * 1.03, ry * 1.03, '#e6cf8a');
  s = 7;
  for (const [la, lo, rx, ry] of LAND) blob(la, lo, rx, ry, '#4f9a3c');
  // forests and hills
  for (const [la, lo, rx, ry] of LAND) blob(la, lo, rx * 0.6, ry * 0.6, '#3c7e2e', 8);
  // ice caps
  g.fillStyle = '#eef4f8';
  g.fillRect(0, 0, W, 22);
  g.fillRect(0, H - 26, W, 26);
  // sky crane city: a grey patch with a street grid
  {
    const [x, y] = px(SPOTS.crane.lat, SPOTS.crane.lon);
    g.fillStyle = '#8a8f99';
    g.beginPath();
    g.ellipse(x, y, 34, 22, 0, 0, 7);
    g.fill();
    g.strokeStyle = '#5d626b';
    g.lineWidth = 1.5;
    for (let i = -30; i <= 30; i += 8) {
      g.beginPath();
      g.moveTo(x + i, y - 22);
      g.lineTo(x + i, y + 22);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 34, y + i * 0.7);
      g.lineTo(x + 34, y + i * 0.7);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
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
    // a rocky peak with a cave mouth and glowing crystals
    add(new THREE.ConeGeometry(0.075, 0.1, 7), M(0x6a6170, { flatShading: true }), 0, 0.05);
    add(new THREE.SphereGeometry(0.022, 10, 8), M(0x111015), 0, 0.02, 0.06);
    for (const [x, z, c] of [
      [0.04, 0.05, 0x7ef2ff],
      [-0.05, 0.04, 0xc58cff],
      [0.06, -0.02, 0xff7ad9],
    ])
      add(new THREE.OctahedronGeometry(0.014, 0), M(c, { emissive: c, emissiveIntensity: 1 }), x, 0.015, z).scale.set(1, 2, 1);
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
  return g;
}

let R = null; // the live globe (renderer, scene…) while the Levels screen is open

/* build the globe into `host`; `open(id)` says whether a level is unlocked; `sel` is the selected level */
function mountGlobe(host, open, sel, onPick) {
  unmountGlobe();
  const w = host.clientWidth || 320,
    h = host.clientHeight || 260,
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 50);
  cam.position.set(0, 0.35, 5.2);
  cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x203040, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(3, 2, 4);
  scene.add(sun);
  const planet = new THREE.Group();
  scene.add(planet);
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 0.75 })));
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
    m.position.copy(n);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
    m.scale.setScalar(2.6);
    planet.add(m);
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
    drag = { x: e.clientX, q: planet.quaternion.clone(), moved: 0 };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    planet.quaternion.copy(drag.q).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), dx * 0.01));
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

  const loop = () => {
    raf = requestAnimationFrame(loop);
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
    for (const p of Object.values(pins)) if (p.obj.userData.bubbles) p.obj.children.forEach((c, i) => c.geometry.type === 'SphereGeometry' && (c.position.y = 0.01 + ((i * 0.012 + t * 0.03) % 0.11)));
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
