// Contact sheet of standing garage figures: every outfit, plus suit finishes (metallic, pattern, neon).
// Usage: URL=http://localhost:5173/ node tests/outfits-shot.mjs out.png
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const out = process.argv[2] || 'outfits.png', url = process.env.URL || 'http://localhost:5173/';
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__god);
const data = await page.evaluate(async () => {
  const loaded = performance.getEntriesByType('resource').map(e => e.name);
  const imp = p => import(loaded.filter(u => new URL(u).pathname === p).pop() || p);
  const THREE = await imp(loaded.map(u => new URL(u).pathname).find(p => /\/three\.js$/.test(p)));
  const { makeFigure } = await imp('/src/rider/rider.js');
  const { CATALOG } = await imp('/src/bikes/catalog.js');
  const R = await imp('/src/render/renderer.js');
  const paints = CATALOG.paint;
  const pick = f => (paints.find(f) || {}).id;
  const looks = CATALOG.costume.map(c => [c.id, null]).concat([
    ['leathers', pick(p => p.metal >= 0.8)], ['leathers', pick(p => p.tex)], ['leathers', pick(p => p.neon)], ['leathers', pick(p => p.c === 0xffd23f || /yellow|lime/i.test(p.name))],
  ]);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a30);
  scene.environment = R.scene.environment;
  scene.add(new THREE.HemisphereLight(0xfff4e8, 0x302020, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3, 5, 6); scene.add(key);
  const cols = 7, W = 1400, H = 640, cw = 200;
  looks.forEach(([cid, suit], i) => {
    const f = makeFigure(cid, 0xd62828, null, suit, null);
    f.position.set((i % cols) * 1.0 - 3, ((i / cols) | 0) * -2.2, 0);
    scene.add(f);
  });
  const cam = new THREE.OrthographicCamera(-3.5, 3.5, 2.05, -2.05, 0.1, 50);
  cam.position.set(0, -0.15, 10); cam.lookAt(0, -0.15, 0);
  cam.top = 2.0; cam.bottom = -2.4; cam.updateProjectionMatrix();
  const r = R.renderer, prev = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
  r.setPixelRatio(1); r.setSize(W, H, false);
  cam.left = -3.5; cam.right = 3.5; cam.top = 2.0; cam.bottom = -2.4 + 0.0; cam.position.y = 0; cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  r.render(scene, cam);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(r.domElement, 0, 0, W, H, 0, 0, W, H);
  r.setPixelRatio(pr); r.setSize(prev.x, prev.y, false);
  return c.toDataURL('image/png');
});
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out);
