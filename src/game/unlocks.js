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
    beach: [{ act: 3 }, { free: 45 }],
    stadium: [{ act: 4 }, { free: 90 }],
    crane: [{ act: 6 }, { free: 135 }],
    under: [{ act: 8 }, { free: 180 }],
    moon: [{ win: 1 }, { free: 240 }],
  },
  style: {
    dirt: { perf: 100 },
    chopper: { act: 5 },
    vintage: { free: 120 },
    sport: { combo: 50 },
    rocket: { win: 2 },
  },
  costume: {
    daredevil: { shows: 10 },
    clown: { pts: 25000 },
    skeleton: { near: 75 },
    punk: { combo: 35 },
    hero: { act: 7 },
    devil: { free: 210 },
    ghost: { perf: 1000 },
    king: { pts: 400000 },
    goldsuit: { win: 3 },
  },
  paint: {
    // solids: early
    matte: { shows: 2 },
    green: { act: 2 },
    orange: { pts: 5000 },
    pink: { free: 40 },
    purple: { combo: 15 },
    lime: { perf: 150 },
    mint: { near: 25 },
    ice: { act: 3 },
    // metallics: mid
    gunmetal: { pts: 15000 },
    copper: { free: 75 },
    candyred: { combo: 25 },
    candy: { act: 5 },
    candyvio: { perf: 300 },
    rosegold: { pts: 50000 },
    gold: { act: 7 },
    chrome: { combo: 60 },
    // patterns + animal: mid to late
    stripes: { act: 4 },
    checker: { free: 60 },
    zebra: { pts: 30000 },
    dalmatian: { near: 50 },
    carbon: { perf: 250 },
    tiger: { combo: 30 },
    camo: { near: 100 },
    flames: { combo: 40 },
    leopard: { act: 6 },
    lightning: { act: 6 },
    lava: { pts: 80000 },
    snake: { perf: 500 },
    galaxy: { free: 180 },
    holo: { act: 9 },
    // neon: last (finishing the show and beyond)
    synth: { win: 1 },
    npink: { win: 2 },
    nblue: { combo: 80 },
    ngreen: { free: 300 },
    norange: { pts: 500000 },
    npurple: { perf: 2000 },
    nyellow: { near: 300 },
    tubes: { win: 5 },
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
  for (const k of ['suit', 'helmet', 'trim'])
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
