// App icon "hero shot" rendered from the game's own models: bike + rider on the inside wall of the
// steel globe, light trail, spotlight. Usage: node tests/icon-hero.mjs out.png [size=1024]
// Env: AZ/EL camera tweaks, PAINT, COSTUME.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const out = process.argv[2] || 'icon.png', S = +(process.argv[3] || 1024), url = process.env.URL || 'http://localhost:5173/';
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(url, { timeout: 120000 });
await page.waitForFunction(() => window.__god, null, { timeout: 120000 });
const data = await page.evaluate(async ([S, P]) => {
  const L = performance.getEntriesByType('resource').map(e => e.name);
  const imp = p => import(L.filter(u => new URL(u).pathname === p).pop() || p);
  const THREE = await imp(L.map(u => new URL(u).pathname).find(p => /\/three\.js$/.test(p)));
  const { makeBike } = await imp('/src/bikes/bike.js');
  const R = await imp('/src/render/renderer.js');
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050407);
  scene.environment = R.scene.environment;
  const RG = 3.1;
  // steel cage: parallels and meridians, like the game's globe
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4d7dd, metalness: 0.95, roughness: 0.28 });
  for (let lat = -75; lat <= 75; lat += 15) {
    const r = RG * Math.cos((lat * Math.PI) / 180),
      ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 120), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = RG * Math.sin((lat * Math.PI) / 180);
    scene.add(ring);
  }
  for (let k = 0; k < 12; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RG, 0.035, 8, 160), steel);
    ring.rotation.y = (k / 12) * Math.PI;
    scene.add(ring);
  }
  // bike + rider on the inside wall: 'a' radians up from the bottom, riding round the globe
  const a = P.wall,
    pos = V(Math.sin(a) * RG * 0.985, -Math.cos(a) * RG * 0.985, 0),
    up = pos.clone().negate().normalize(),
    fwd = V(0, 0, 1),
    right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const bike = makeBike({ style: P.style, paint: P.paint, costume: P.costume });
  const g = bike.g || bike;
  g.matrixAutoUpdate = false;
  g.matrix.makeBasis(right, up, fwd).setPosition(pos);
  g.matrix.multiply(new THREE.Matrix4().makeScale(1.25, 1.25, 1.25));
  scene.add(g);
  // light trail streaming back along the wall
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const s = i / 40,
      th = -s * 1.5;
    pts.push(V(Math.sin(a) * RG * 0.97, -Math.cos(a) * RG * 0.97, 0).applyAxisAngle(V(1, 0, 0).applyAxisAngle(V(0, 0, 1), a), th).add(up.clone().multiplyScalar(0.25 * (1 - s))));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  [[0.09, 0xff5a1f, 0.55], [0.035, 0xffd27a, 1]].forEach(([r, c, o]) => {
    const tg = new THREE.TubeGeometry(curve, 80, r, 10, false),
      P2 = tg.attributes.position,
      col = new Float32Array(P2.count * 3);
    for (let i = 0; i < P2.count; i++) {
      const s = Math.floor(i / 11) / 80,
        k = Math.pow(1 - s, 1.6);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: c, vertexColors: true, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })));
  });
  // lighting: warm key spot, orange rim from behind, cool fill
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x200a05, 0.35));
  const key = new THREE.SpotLight(0xfff0d8, 9, 30, 0.6, 0.5, 1.2);
  key.position.set(-2, 6, 7);
  key.target.position.copy(pos);
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0xff6a20, 14, 9, 1.5);
  rim.position.copy(pos).add(V(0.4, 0.8, -1.6));
  scene.add(rim);
  const glow = new THREE.PointLight(0xff8a3a, 6, 7, 1.5);
  glow.position.set(0, -1, -1);
  scene.add(glow);
  // camera inside the globe, low, looking across at the rider
  const cam = new THREE.PerspectiveCamera(P.fov, 1, 0.05, 100);
  cam.position.copy(pos).add(V(-P.dist * Math.cos(P.el) * Math.sin(P.az), P.dist * Math.sin(P.el), P.dist * Math.cos(P.el) * Math.cos(P.az)));
  cam.lookAt(pos.clone().add(up.clone().multiplyScalar(0.55)));
  const r = R.renderer, prev = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio(), ex = r.toneMappingExposure;
  r.setPixelRatio(1); r.setSize(S, S, false); r.toneMappingExposure = 1.2;
  r.render(scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = S;
  c.getContext('2d').drawImage(r.domElement, 0, 0, S, S, 0, 0, S, S);
  r.setPixelRatio(pr); r.setSize(prev.x, prev.y, false); r.toneMappingExposure = ex;
  return c.toDataURL('image/png');
}, [S, {
  wall: +(process.env.WALL || 1.05), style: process.env.STYLE || 'sport', paint: process.env.PAINT || 'red', costume: process.env.COSTUME || 'leathers',
  az: +(process.env.AZ || 0.55), el: +(process.env.EL || 0.15), dist: +(process.env.DIST || 3.4), fov: +(process.env.FOV || 42),
}]);
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out);
