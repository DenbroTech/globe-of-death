// Measures real audio output (RMS / peak) per arena in the menu and during a ride, and reports page errors.
// Usage: node tests/audio-levels.mjs [arena,...]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const list = (process.argv[2] || 'bigtop,beach,stadium,crane,under,moon').split(',');
const url = process.env.URL || 'http://localhost:5173/';
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const k of list) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(k => { try { localStorage.setItem('god-arena', k); localStorage.setItem('god-tut', '1'); } catch (e) {} }, k);
  await p.goto(url, { timeout: 120000 });
  await p.waitForFunction(() => window.__god, null, { timeout: 120000 });
  await p.mouse.click(200, 120); // first touch starts audio
  const meter = async ms => p.evaluate(async ms => {
    const loaded = performance.getEntriesByType('resource').map(e => e.name);
    const S = await import(loaded.filter(u => new URL(u).pathname === '/src/audio/synth.js').pop());
    if (!S.ac) return 'no audio';
    if (!window.__an) { window.__an = S.ac.createAnalyser(); window.__an.fftSize = 2048; S.moodLP.connect(window.__an); }
    const a = window.__an, buf = new Float32Array(a.fftSize);
    let sum = 0, n = 0, peak = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      a.getFloatTimeDomainData(buf);
      for (const v of buf) { sum += v * v; n++; peak = Math.max(peak, Math.abs(v)); }
      await new Promise(r => setTimeout(r, 40));
    }
    return `rms ${(Math.sqrt(sum / n)).toFixed(3)} peak ${peak.toFixed(2)} (${S.ac.state})`;
  }, ms);
  const menu = await meter(4000);
  await p.click('#start');
  await p.waitForTimeout(3500);
  const ride = await meter(5000);
  console.log(`${k.padEnd(8)} menu: ${menu}   ride: ${ride}   ${errs.length ? 'ERRORS: ' + errs.join(' | ') : ''}`);
  await p.close();
}
await browser.close();
