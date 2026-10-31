import { game } from '../core/state.js';
import { CATALOG } from '../bikes/catalog.js';

/* ---------- unlocks: milestones earned across both modes ----------
   career: lifetime stats kept on this phone. Each item needs one milestone (items not listed are starters).
   Kinds of milestone:
     act n     reach act n in the show        win n    finish all ten acts n times
     pts n     lifetime show points           combo n  best combo in one run
     perf n    lifetime perfect hits          shows n  shows played
     free s    survive s seconds in free ride near n   lifetime near misses in free ride
   Arenas take either a show OR a free-ride milestone, so both modes open them. */
const UNLOCKS = {
  arena: {
    beach: [{ act: 2 }, { free: 30 }],
    stadium: [{ act: 3 }, { free: 60 }],
    crane: [{ act: 5 }, { free: 90 }],
    under: [{ act: 7 }, { free: 120 }],
    moon: [{ win: 1 }, { free: 180 }],
  },
  style: {
    dirt: { perf: 25 },
    chopper: { act: 4 },
    vintage: { free: 75 },
    sport: { combo: 30 },
    rocket: { win: 1 },
  },
  costume: {
    daredevil: { shows: 3 },
    clown: { pts: 5000 },
    skeleton: { near: 25 },
    punk: { combo: 20 },
    hero: { act: 6 },
    devil: { free: 150 },
    ghost: { perf: 300 },
    king: { pts: 100000 },
    goldsuit: { win: 1 },
  },
  paint: {
    // solids: early
    matte: { shows: 1 },
    green: { act: 2 },
    orange: { pts: 2000 },
    pink: { free: 20 },
    purple: { combo: 10 },
    lime: { perf: 50 },
    mint: { near: 10 },
    ice: { act: 3 },
    // metallics: mid
    gunmetal: { pts: 5000 },
    copper: { free: 45 },
    candyred: { combo: 15 },
    candy: { act: 4 },
    candyvio: { perf: 100 },
    rosegold: { pts: 15000 },
    gold: { act: 6 },
    chrome: { combo: 40 },
    // patterns + animal: mid to late
    stripes: { act: 3 },
    checker: { free: 40 },
    zebra: { pts: 8000 },
    dalmatian: { near: 20 },
    carbon: { perf: 75 },
    tiger: { combo: 18 },
    camo: { near: 30 },
    flames: { combo: 25 },
    leopard: { act: 5 },
    lightning: { act: 5 },
    lava: { pts: 25000 },
    snake: { perf: 150 },
    galaxy: { free: 120 },
    holo: { act: 8 },
    // neon: last
    synth: { act: 9 },
    npink: { win: 1 },
    nblue: { combo: 50 },
    ngreen: { free: 210 },
    norange: { pts: 150000 },
    npurple: { perf: 500 },
    nyellow: { near: 150 },
    tubes: { win: 3 },
  },
};
let career = { shows: 0, freeRuns: 0, act: 1, win: 0, pts: 0, combo: 0, perf: 0, free: 0, near: 0 };
const KEY = { act: 'act', win: 'win', pts: 'pts', combo: 'combo', perf: 'perf', shows: 'shows', free: 'free', near: 'near' };
const met = r => Object.keys(r).every(k => career[KEY[k]] >= r[k]);
const reqsOf = (kind, id) => {
  const r = (UNLOCKS[kind] || {})[id];
  return r ? (Array.isArray(r) ? r : [r]) : null;
};
/* earned for real (ignores the "Unlock all" test switch) */
const earned = (kind, id) => {
  const R = reqsOf(kind, id);
  return !R || R.some(met);
};
const isUnlocked = (kind, id) => !!game.unlockAll || earned(kind, id);
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function reqLine(r) {
  const [k, v] = Object.entries(r)[0],
    n = x => Math.floor(x).toLocaleString(),
    have = career[KEY[k]];
  if (k === 'act') return `Reach act ${v}`;
  const pr = (x, y) => (have > 0 ? ` (${x}${y ? '/' + y : ''})` : ''); // progress once you've started
  if (k === 'win') return v > 1 ? `Finish the show ${v}×${pr(have, v)}` : 'Finish the show';
  if (k === 'pts') return `${n(v)} show points${pr(n(have))}`;
  if (k === 'combo') return `Combo ×${v}`;
  if (k === 'perf') return `${n(v)} perfects${pr(n(have))}`;
  if (k === 'shows') return v > 1 ? `Play ${v} shows${pr(have, v)}` : 'Play a show';
  if (k === 'free') return `Free ride ${mmss(v)}`;
  if (k === 'near') return `${n(v)} near misses${pr(n(have))}`;
  return '';
}
const reqText = (kind, id) => (reqsOf(kind, id) || []).map(reqLine).join(' or ');
const NAMES = { arena: null, style: 'style', paint: 'paint', costume: 'costume' };
/* fold a finished run into the career; returns names of anything newly unlocked */
function recordCareer(run, arenaName) {
  const before = allItems().filter(([k, id]) => !earned(k, id));
  if (run.free) {
    career.freeRuns++;
    career.free = Math.max(career.free, run.time || 0);
    career.near += run.near || 0;
  } else {
    career.shows++;
    career.act = Math.max(career.act, run.act || 1);
    if (run.win) career.win++;
    career.pts += Math.floor(run.score || 0);
    career.combo = Math.max(career.combo, run.combo || 0);
    career.perf += run.perfect || 0;
  }
  save();
  return before.filter(([k, id]) => earned(k, id)).map(([k, id]) => (k === 'arena' ? arenaName(id) : CATALOG[NAMES[k]].find(i => i.id === id).name));
}
const allItems = () => Object.entries(UNLOCKS).flatMap(([k, m]) => Object.keys(m).map(id => [k, id]));
function save() {
  try {
    localStorage.setItem('god-career', JSON.stringify(career));
  } catch (e) {}
}
/* starter picks if the current choice is locked (e.g. after switching "Unlock all" off) */
const STARTER = { style: 'classic', paint: 'red', costume: 'leathers' };
function sanitizeSel(sel) {
  let changed = false;
  for (const k of ['style', 'paint', 'costume'])
    if (!isUnlocked(k, sel[k])) {
      sel[k] = STARTER[k];
      changed = true;
    }
  for (const k of ['suit', 'helmet'])
    if (sel[k] && !isUnlocked('paint', sel[k])) {
      sel[k] = null;
      changed = true;
    }
  return changed;
}

/* reaching a new act mid-show: count it straight away so act unlocks pop during the run */
function reachAct(a, arenaName) {
  if (a <= career.act) return [];
  const before = allItems().filter(([k, id]) => !earned(k, id));
  career.act = a;
  save();
  return before.filter(([k, id]) => earned(k, id)).map(([k, id]) => (k === 'arena' ? arenaName(id) : CATALOG[NAMES[k]].find(i => i.id === id).name));
}
/* called from initProgress: loads the career, carrying over older saves (best act, show won, best free ride) */
function initUnlocks(prog) {
  try {
    const c = JSON.parse(localStorage.getItem('god-career'));
    if (c) career = Object.assign(career, c);
    career.act = Math.max(career.act, prog.maxAct || 1);
    if (prog.won) career.win = Math.max(career.win, 1);
    career.free = Math.max(career.free, +localStorage.getItem('god-free-best') || 0);
  } catch (e) {}
}

export { UNLOCKS, career, earned, initUnlocks, isUnlocked, reachAct, reqText, recordCareer, sanitizeSel };
