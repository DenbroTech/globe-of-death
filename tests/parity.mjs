// Parity check: drive two builds of the game through the same screens with a seeded
// Math.random and a frozen clock, screenshot each, and diff the pixels.
// Usage: node tests/parity.mjs <urlA> <urlB> <outDir>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const [urlA, urlB, outDir = 'tests/out/parity'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

// Runs before any page script: seeded random + audio clock that follows the (fake) page clock.
const SHIM = () => {
  let s = 123456789;
  Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  // zero the page clock at its first read so both builds share the same time origin
  const pn = performance.now.bind(performance);
  let p0 = null;
  performance.now = () => { const t = pn(); if (p0 === null) p0 = t; return t - p0; };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    class FakeClockAC extends AC {
      get currentTime() { return performance.now() / 1000; }
      get outputLatency() { return 0; }
      get baseLatency() { return 0; }
    }
    window.AudioContext = window.webkitAudioContext = FakeClockAC;
  }
  try { localStorage.clear(); } catch (e) {}
};

const SCENES = [
  ['menu', async p => {}],
  ['levels', async p => { await p.click('#lvBtn'); }],
  ...['bigtop', 'beach', 'stadium', 'crane', 'under', 'moon'].map(k => [`arena-${k}`, async p => {
    await p.click('#lvBtn'); await p.click(`[data-lv="${k}"]`); await p.clock.runFor(400);
    if (await p.$('#lvBack')) await p.click('#lvBack');
  }]),
  ['garage-bike', async p => { await p.click('#gar'); await p.clock.runFor(400); }],
  ['garage-rider', async p => { await p.click('#gar'); await p.clock.runFor(500); await p.click('[data-tab="rider"]'); await p.clock.runFor(400); }],
  ['settings', async p => { await p.click('#setBtn'); }],
  ['ride', async p => { await p.click('#start'); await p.clock.runFor(1500); }],
  ['ride-free', async p => { await p.click('[data-mode="free"]'); await p.click('#start'); await p.clock.runFor(1500); }],
];

async function shoot(browser, url, name, fn, tag) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // Frozen clock: time only moves when we call runFor, so both builds see identical frame times.
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
  await page.addInitScript(SHIM);
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(300);
  await fn(page);
  await page.clock.runFor(100);
  const file = path.join(outDir, `${name}-${tag}.png`);
  await page.screenshot({ path: file });
  await page.close();
  return { file, errs };
}

const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const rows = [];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, fn] of SCENES) {
  if (only && !only.includes(name)) continue;
  const [a, b] = await Promise.all([shoot(browser, urlA, name, fn, 'a'), shoot(browser, urlB, name, fn, 'b')]);
  rows.push({ name, a: a.file, b: b.file, errs: [...a.errs, ...b.errs] });
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'pairs.json'), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.name, r.errs.length ? 'ERRORS: ' + r.errs.join(' | ') : '');
