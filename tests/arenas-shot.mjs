// Screenshot each arena from the menu camera (phone portrait). Usage: node tests/arenas-shot.mjs outPrefix [arena,...]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const [pre = 'tests/out/arena', list = 'bigtop,beach,stadium,crane,under,moon'] = process.argv.slice(2);
const url = process.env.URL || 'http://localhost:5173/';
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
for (const k of list.split(',')) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => console.log(k, 'PAGEERROR', e.message));
  await p.addInitScript(k => { try { localStorage.setItem('god-arena', k); localStorage.setItem('god-tut', '1'); } catch (e) {} }, k);
  await p.goto(url, { timeout: 120000 }); await p.waitForFunction(() => window.__god, null, { timeout: 120000 });
  // hide the menu card so the arena is visible
  await p.addStyleTag({ content: '#ov{display:none!important}' });
  // CAM="az,el,zoom" sets the orbit camera (e.g. low and far out to see the scenery)
  if (process.env.CAM)
    await p.evaluate(async c => {
      const loaded = performance.getEntriesByType('resource').map(e => e.name);
      const u = loaded.filter(u => new URL(u).pathname === '/src/render/camera.js').pop();
      const { cam } = await import(u);
      const [az, el, zoom] = c.split(',').map(Number);
      Object.assign(cam, { az, el, zoom, last: performance.now() + 1e9 });
    }, process.env.CAM);
  await p.waitForTimeout(+(process.env.WAIT || 6000));
  await p.screenshot({ path: `${pre}-${k}.png` });
  await p.close();
}
await browser.close();
console.log('done');
