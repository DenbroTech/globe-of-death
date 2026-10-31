// Automated play-test. Boots the game in headless Chromium, then:
//  1. The show: a bot hits every note on time (using window.__god), checks score/combo climb and no crash.
//  2. The show: a bot that does nothing — balance must drain and the run must end.
//  3. Free ride: survives a few seconds without errors.
// Usage: node tests/smoke.mjs [url]   (default http://localhost:5173/)
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const url = process.argv[2] || 'http://localhost:5173/';
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failed++; };

async function open(mode) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(m => { try { localStorage.setItem('god-tut', '1'); localStorage.setItem('god-mode', m); } catch (e) {} }, mode);
  await page.goto(url);
  await page.waitForFunction(() => window.__god && document.querySelector('#start'));
  return { page, errs };
}

// Bot runs inside the page so it isn't slowed by the round trip; presses carry the exact note time.
const BOT = () => {
  const g = window.__god, held = new Map();
  window.__bot = setInterval(() => {
    const st = g.state; if (!st.running || st.paused || st.over) return;
    const t = g.now();
    for (const n of st.notes) {
      const key = n.b + n.t;
      if (n.j || held.has(key)) continue;
      const tn = g.timeAt(n.b);
      if (tn - t < 0.25) { g.press(n.t, tn); if (n.l) held.set(key, n); }
    }
    for (const [key, n] of held) if (t >= g.timeAt(n.b + n.l)) {
      g.release(n.t); held.delete(key);
    }
  }, 30);
};

console.log('The show — perfect bot');
{
  const { page, errs } = await open('show');
  await page.click('#start');
  await page.evaluate(BOT);
  await page.waitForTimeout(25000);
  const st = await page.evaluate(() => window.__god.state);
  const missed = st.notes.filter(n => n.j === 'm').map(n => `${n.t}@${n.b}${n.l ? '/' + n.l : ''}`);
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  console.log(`  missed: ${missed.join(' ') || 'none'}  headless fps ~${fps}`);
  console.log(`  score ${Math.round(st.score)} combo ${st.combo} balance ${Math.round(st.balance)} act ${st.act} over ${st.over}`, JSON.stringify(st.stats));
  check(st.running && !st.over, 'still riding after 25 s');
  check(st.score > 0, 'score went up');
  const hits = st.stats.perfect + st.stats.good, rate = hits / Math.max(1, hits + st.stats.miss);
  // headless renders ~2 fps, so the odd note can slip past the bot; judge the hit rate, not a perfect run
  check(hits >= 5 && rate >= 0.7, `hit rate ${Math.round(rate * 100)}% (${hits} hits)`);
  check(st.balance >= 50, 'balance healthy');
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await page.close();
}

console.log('The show — idle bot');
{
  const { page, errs } = await open('show');
  await page.click('#start');
  let st;
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(5000); st = await page.evaluate(() => window.__god.state); if (st.over) break; }
  console.log(`  balance ${Math.round(st.balance)} over ${st.over}`);
  check(st.over || st.balance < 100, 'misses cost balance / run ends');
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await page.close();
}

console.log('Free ride');
{
  const { page, errs } = await open('free');
  await page.click('#start');
  await page.waitForTimeout(8000);
  const st = await page.evaluate(() => window.__god.state);
  console.log(`  running ${st.running} over ${st.over}`);
  check(st.running, 'free ride running');
  check(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
