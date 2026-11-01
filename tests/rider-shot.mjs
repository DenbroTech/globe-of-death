// Close-up renders of bike + rider (and the standing garage figure) for visual checks.
// Uses the running dev server's live modules, renders with its own camera into one contact sheet.
// Usage: node tests/rider-shot.mjs out.png [style=sport] [url=http://localhost:5173/]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const [out = 'rider.png', style = 'sport', url = process.env.URL || 'http://localhost:5173/'] = process.argv.slice(2);
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__god);
const data = await page.evaluate(async ([style, PAINT, SUIT, NORIDER, STAND, COSTUME, TRIM]) => {
  // import the exact module instances the game loaded (dev server may tag them with ?t=…)
  const loaded = performance.getEntriesByType('resource').map(e => e.name);
  const imp = p => import(loaded.filter(u => new URL(u).pathname === p).pop() || p);
  const THREE = await imp(loaded.map(u => new URL(u).pathname).find(p => /\/three\.js$/.test(p)));
  const { makeBike } = await imp('/src/bikes/bike.js');
  const { makeFigure } = await imp('/src/rider/rider.js');
  const { renderer } = await imp('/src/render/renderer.js');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a30);
  scene.environment = (await imp('/src/render/renderer.js')).scene.environment;
  scene.add(new THREE.HemisphereLight(0xfff4e8, 0x302020, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x99bbff, 0.8); rim.position.set(-4, 3, -3); scene.add(rim);
  const bike = makeBike({ style, paint: PAINT, costume: COSTUME, suit: SUIT, trim: TRIM });
  scene.add(bike.g || bike);
  if (NORIDER && bike.rider) bike.rider.visible = false;
  if (STAND) {
    // seat-stand pose, as input/controls.js sets it at full extension
    bike.rider.position.y += 0.32; bike.rider.position.x += 0.08; bike.rider.rotation.z = -0.42;
    bike.trick.visible = true; bike.trick.children.forEach(c => (c.visible = true));
    if (bike.limbs) bike.limbs[1].visible = false;
  }
  const fig = makeFigure(COSTUME, 0xe63946, null, SUIT, null, TRIM);
  fig.position.set(-2.4, 0, 0); scene.add(fig);
  const W = 400, H = 400, views = [
    [[2.8, 1.2, 0.3], [0, 0.7, 0]],    // side
    [[1.6, 1.4, 2.2], [0, 0.75, 0]],   // front 3/4
    [[-1.4, 1.6, -2.2], [0, 0.8, 0]],  // rear 3/4
    [[1.1, 1.3, 0.9], [0, 1.0, 0.1]],  // close upper body
    [[-1.4, 1.2, 3.0], [-2.4, 0.95, 0]], // standing figure front
    [[-3.4, 1.2, -2.8], [-2.4, 0.95, 0]],// standing figure back
  ];
  const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  const sheet = document.createElement('canvas'); sheet.width = W * 3; sheet.height = H * 2;
  const sx = sheet.getContext('2d');
  const prev = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  views.forEach(([p, t], i) => {
    cam.position.set(...p); cam.lookAt(...t);
    renderer.render(scene, cam);
    sx.drawImage(renderer.domElement, 0, 0, W, H, (i % 3) * W, ((i / 3) | 0) * H, W, H);
  });
  renderer.setPixelRatio(pr); renderer.setSize(prev.x, prev.y, false);
  return sheet.toDataURL('image/png');
}, [style, process.env.PAINT || 'red', process.env.SUIT || null, !!process.env.NORIDER, !!process.env.STAND, process.env.COSTUME || 'leathers', process.env.TRIM || null]);
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out);
