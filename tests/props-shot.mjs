// Close-up renders of arena props. Usage: URL=… node tests/props-shot.mjs out.png
// Each entry: [module path, expression building an Object3D from the module `M` and `THREE`, camera distance]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const out = process.argv[2] || 'props.png', url = process.env.URL || 'http://localhost:5173/';
const ITEMS = JSON.parse(process.env.ITEMS || 'null') || [
  ['/src/arenas/props.js', "new THREE.Mesh(M.dolphinGeo(), new THREE.MeshStandardMaterial({color:0x9fb2c4,roughness:.28,metalness:.1,vertexColors:true}))", 2.6, [1, 0.35, 0.6]],
  ['/src/arenas/props.js', "new THREE.Mesh(M.dolphinGeo(), new THREE.MeshStandardMaterial({color:0x9fb2c4,roughness:.28,metalness:.1,vertexColors:true}))", 2.6, [0.2, 0.9, -0.6]],
  ['/src/arenas/props.js', 'M.makeSailboat()', 13, [1, 0.35, 0.5]],
  ['/src/arenas/props.js', 'M.makePalm(7, ()=>.5)', 14, [1, 0.25, 0.4]],
];
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__god);
const data = await page.evaluate(async ITEMS => {
  const loaded = performance.getEntriesByType('resource').map(e => e.name);
  const imp = p => import(loaded.filter(u => new URL(u).pathname === p).pop() || p);
  const THREE = await imp(loaded.map(u => new URL(u).pathname).find(p => /\/three\.js$/.test(p)));
  const R = await imp('/src/render/renderer.js');
  const W = 400, H = 400, cols = Math.min(ITEMS.length, 4), rows = Math.ceil(ITEMS.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = W * cols; sheet.height = H * rows;
  const sx = sheet.getContext('2d');
  const r = R.renderer, prev = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
  r.setPixelRatio(1); r.setSize(W, H, false);
  for (let i = 0; i < ITEMS.length; i++) {
    const [path, expr, dist, dir] = ITEMS[i];
    const M = await imp(path);
    const obj = new Function('M', 'THREE', 'return ' + expr)(M, THREE);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b5d6);
    scene.environment = R.scene.environment;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x806040, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 8, 5); scene.add(key);
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
    cam.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist)); cam.lookAt(c);
    r.render(scene, cam);
    sx.drawImage(r.domElement, 0, 0, W, H, (i % cols) * W, ((i / cols) | 0) * H, W, H);
  }
  r.setPixelRatio(pr); r.setSize(prev.x, prev.y, false);
  return sheet.toDataURL('image/png');
}, ITEMS);
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out);
