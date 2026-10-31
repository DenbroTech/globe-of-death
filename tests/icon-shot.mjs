// Renders app-icon / splash source images straight from the game. Usage: node tests/icon-shot.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const url = process.env.URL || 'http://localhost:5173/';
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
for (const [name, w, h, cam] of [['icon-raw', 1024, 1024, '0.75,0.1,0.8']]) {
  const p = await browser.newPage({ viewport: { width: Math.round(w / 2), height: Math.round(h / 2) }, deviceScaleFactor: 2 });
  await p.addInitScript(() => { try { localStorage.setItem('god-arena', 'bigtop'); localStorage.setItem('god-tut', '1'); } catch (e) {} });
  await p.goto(url, { timeout: 120000 });
  await p.waitForFunction(() => window.__god, null, { timeout: 120000 });
  await p.addStyleTag({ content: '#app > :not(canvas){display:none!important}' });
  await p.evaluate(async c => {
    const L = performance.getEntriesByType('resource').map(e => e.name);
    const { cam } = await import(L.filter(u => new URL(u).pathname === '/src/render/camera.js').pop());
    const [az, el, zoom] = c.split(',').map(Number);
    Object.assign(cam, { az, el, zoom, last: performance.now() + 1e9 });
    // just the cage, bike and rider on black: no tent, crowd or floor
    const { built } = await import(L.filter(u => new URL(u).pathname === '/src/arenas/current.js').pop());
    const { bigtop } = await import(L.filter(u => new URL(u).pathname === '/src/arenas/stage.js').pop());
    const R = await import(L.filter(u => new URL(u).pathname === '/src/render/renderer.js').pop());
    const hide = () => { bigtop.visible = false; for (const k in built) { built[k].g.visible = false; built[k].c.grp.visible = false; } R.scene.background.setHex(0x000000); R.scene.fog.near = 500; R.scene.fog.far = 900; };
    hide(); setInterval(hide, 200);
  }, cam);
  await p.waitForTimeout(9000);
  await p.screenshot({ path: `assets/${name}.png` });
  await p.close();
}
await browser.close();
console.log('done');
