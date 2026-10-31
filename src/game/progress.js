import { game } from '../core/state.js';

let prog = { maxAct: 1, won: false };
const saveProg = () => {
  try {
    localStorage.setItem('god-prog', JSON.stringify(prog));
  } catch (e) {}
};
const ARENA_REQ = {
  bigtop: { act: 1 },
  beach: { act: 2 },
  stadium: { act: 3 },
  crane: { act: 5 },
  under: { act: 7 },
  moon: { win: true },
};
const arenaOpen = id => {
  if (game.unlockAll) return true;
  const q = ARENA_REQ[id] || {};
  return q.win ? prog.won : prog.maxAct >= (q.act || 1);
};
const reqText = id => {
  const q = ARENA_REQ[id] || {};
  return q.win ? 'Finish all ten acts of the show to unlock' : 'Reach act ' + q.act + ' in the show to unlock';
};

export function initProgress() {
  game.unlockAll = true;
  try {
    const p = JSON.parse(localStorage.getItem('god-prog'));
    if (p) prog = Object.assign(prog, p);
    game.unlockAll = localStorage.getItem('god-unlockall') !== '0';
  } catch (e) {}
}

export { arenaOpen, prog, reqText, saveProg };
