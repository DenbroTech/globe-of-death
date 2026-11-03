import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { gameOver } from '../game/judging.js';
import { pk } from '../game/perks.js';
import { $, clamp } from '../core/constants.js';

let judgeEl, toastEl, ov;

let judgeTO, toastTO;
function showJudge(cls, txt) {
  judgeEl.className = 'on ' + cls;
  judgeEl.textContent = txt;
  clearTimeout(judgeTO);
  judgeTO = setTimeout(() => (judgeEl.className = cls), 350);
}
function toast(s, ms = 1300) {
  toastEl.textContent = s;
  toastEl.classList.add('on');
  clearTimeout(toastTO);
  toastTO = setTimeout(() => toastEl.classList.remove('on'), ms);
}
const HEART =
  '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';
function drawHearts() {
  const b = $('#balBar'),
    x = $('#balX');
  // balance above 100 (Double balance / Big tank perks) shows as a second, deeper green layer
  b.style.width = Math.min(100, game.balance) + '%';
  if (x) x.style.width = Math.max(0, game.balance - 100) + '%';
  b.parentNode.classList.toggle('big', (game.balMax || 100) > 100);
  b.style.background = game.balance > 60 ? 'var(--ok)' : game.balance > 30 ? 'var(--amber)' : 'var(--red)';
}
function addBal(d) {
  if (game.TUT && d < 0) d = 0;
  // max is 100, or 200 with Big tank; a Double balance top-up above the max just drains, hits don't refill it
  const max = game.balMax || 100;
  game.balance = d > 0 ? Math.min(game.balance + d, Math.max(max, game.balance)) : Math.max(0, game.balance + d);
  drawHearts();
  if (game.balance <= 0 && !game.over) {
    if (pk('revive') > 0) {
      game.perks.revive--;
      game.balance = 50;
      drawHearts();
      toast('SECOND WIND!', 1300);
      game.cheer = 1;
      crowd.wave();
    } else gameOver();
  }
}

export function initHud() {
  /* ---------- judging ---------- */
  judgeEl = $('#judge');
  toastEl = $('#toast');
  /* ---------- screens ---------- */
  ov = $('#ov');
}

export { addBal, drawHearts, ov, showJudge, toast };
