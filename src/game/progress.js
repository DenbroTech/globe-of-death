import { game } from '../core/state.js';
import { initUnlocks, isUnlocked, reqText as unlockReq } from './unlocks.js';

let prog = { maxAct: 1, won: false };
const saveProg = () => {
  try {
    localStorage.setItem('god-prog', JSON.stringify(prog));
  } catch (e) {}
};
const arenaOpen = id => isUnlocked('arena', id);
const reqText = id => unlockReq('arena', id);

export function initProgress() {
  game.unlockAll = false; // real progression by default; Settings → Unlock all opens everything for testing
  try {
    const p = JSON.parse(localStorage.getItem('god-prog'));
    if (p) prog = Object.assign(prog, p);
    game.unlockAll = localStorage.getItem('god-unlockall') === '1';
  } catch (e) {}
  initUnlocks(prog);
}

export { arenaOpen, prog, reqText, saveProg };
