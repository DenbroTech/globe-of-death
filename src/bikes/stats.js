import { garage } from '../game/save.js';

/* ---------- bike stats ---------- */
const BIKE_STATS = {
  classic: { wheelie: 3, jump: 3, turns: 3, grip: 3, boost: 3, tag: 'All-rounder. Nothing fancy, nothing missing.' },
  dirt: { wheelie: 4, jump: 5, turns: 3, grip: 2, boost: 2, tag: 'Floaty jumps and easy wheelies, but misses hurt.' },
  chopper: { wheelie: 2, jump: 2, turns: 2, grip: 5, boost: 3, tag: 'Heavy and forgiving. Shrugs off mistakes.' },
  vintage: { wheelie: 4, jump: 3, turns: 4, grip: 3, boost: 1, tag: 'Smooth handler, slow to charge boost.' },
  sport: { wheelie: 2, jump: 3, turns: 5, grip: 2, boost: 4, tag: 'Razor turns and quick boost. Twitchy wheelies.' },
  rocket: {
    wheelie: 3,
    jump: 4,
    turns: 3,
    grip: 1,
    boost: 5,
    tag: 'Boost monster. One mistake and you are in trouble.',
  },
};
const STAT_NAMES = { wheelie: 'Wheelie', jump: 'Jump', turns: 'Turns', grip: 'Grip', boost: 'Boost' };
const bst = k => (BIKE_STATS[garage.sel.style] || BIKE_STATS.classic)[k];
const statMul = (k, step = 0.12) => 1 + (bst(k) - 3) * step;
const kindOf = t => (t === 'jump' ? 'jump' : t === 'wheelie' || t === 'nose' ? 'wheelie' : 'turns');

export { BIKE_STATS, STAT_NAMES, bst, kindOf, statMul };
