import { game } from '../core/state.js';
import { app } from '../render/renderer.js';
import { fansFor } from '../arenas/crowd.js';
import { FINAL } from '../audio/clock.js';
import { fmtT, fr, frNear, frTime, freeBest } from '../game/freeride.js';
import { ov } from './hud.js';
import { showGarage } from './garage.js';
import { quitToMenu, start } from '../game/run.js';
import { $ } from '../core/constants.js';
import { ICO } from './menus.js';

let board = { show: [], combo: [], free: [] },
  riderName = 'Rider';
const saveBoard = () => {
  try {
    localStorage.setItem('god-board', JSON.stringify(board));
  } catch (e) {}
};
const esc = t =>
  String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function recordRun() {
  const free = game.FREE,
    list = free ? board.free : board.show,
    e = free
      ? { n: riderName, v: frTime, score: Math.floor(game.score), near: frNear, riders: fr.length, d: Date.now() }
      : {
          n: riderName,
          v: Math.floor(game.score),
          act: game.act,
          win: !!(game.over && game.over.win),
          encore: game.encore,
          combo: game.stats.maxCombo,
          d: Date.now(),
        };
  const put = (L, x) => {
    L.push(x);
    L.sort((a, b) => b.v - a.v);
    L.length = Math.min(L.length, 10);
    return L.indexOf(x);
  };
  const rank = put(list, e);
  let ce = null,
    crank = -1;
  if (!free) {
    ce = { n: riderName, v: game.stats.maxCombo, act: game.act, win: e.win, encore: game.encore, score: e.v, d: e.d };
    crank = put(board.combo, ce);
  }
  saveBoard();
  game.lastEntry =
    rank >= 0
      ? { mode: free ? 'free' : 'show', e, rank: rank + 1, ce: crank >= 0 ? ce : null }
      : crank >= 0
        ? { mode: 'combo', e: ce, rank: crank + 1 }
        : null;
}
function boardRows(mode, hi) {
  const L = board[mode];
  if (!L.length)
    return `<p class="lbempty">No runs yet. ${mode === 'free' ? 'Go for a free ride' : 'Ride the show'} and your best ${mode === 'combo' ? 'combo' : 'run'} will land here.</p>`;
  // scores live on this phone, so rows show the run itself rather than a name
  const what = e =>
    mode === 'free' ? `${e.near} near misses` : e.win ? 'Full show' : e.encore ? 'Encore' : 'Act ' + e.act + ' of ' + FINAL;
  const day = e => new Date(e.d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `<ol class="lb">${L.map(
    (e, i) =>
      `<li class="${hi && hi === e ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${what(e)}</span><span class="sc">${mode === 'free' ? fmtT(e.v) : mode === 'combo' ? '×' + e.v : e.v.toLocaleString()}</span>
    <span class="sub">${mode === 'show' ? 'combo ' + e.combo + ' · ' : mode === 'combo' ? (e.score || 0).toLocaleString() + ' pts · ' : e.riders + ' riders · '}${day(e)}</span></li>`,
  ).join('')}</ol>`;
}
function nameBox() {
  if (!game.lastEntry) return '';
  return `<div class="nameit"><span>#${game.lastEntry.rank} on the board</span></div>`;
}
function wireNameBox() {}
function showBoard(back) {
  app.classList.add('menu');
  ov.hidden = false;
  ov.innerHTML = `<div class="card"><h1><small>On this phone</small>Leaderboard</h1>
  <div class="arenas"><button class="chip" data-lb="show" aria-pressed="${game.lbTab === 'show'}">Show points</button><button class="chip" data-lb="combo" aria-pressed="${game.lbTab === 'combo'}">Best combo</button><button class="chip" data-lb="free" aria-pressed="${game.lbTab === 'free'}">Free ride</button></div>
  ${boardRows(game.lbTab, game.lastEntry ? (game.lastEntry.mode === game.lbTab ? game.lastEntry.e : game.lbTab === 'combo' ? game.lastEntry.ce : null) : null)}
  <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="go" id="lbback">Back</button>${board[game.lbTab].length ? '<button class="go ghost" id="lbclear">Clear this board</button>' : ''}</div></div>`;
  ov.querySelectorAll('[data-lb]').forEach(
    b =>
      (b.onclick = () => {
        game.lbTab = b.dataset.lb;
        showBoard(back);
      }),
  );
  $('#lbback').onclick = back;
  const c = $('#lbclear');
  if (c) {
    let armed = false;
    c.onclick = () => {
      if (!armed) {
        armed = true;
        c.textContent = 'Tap again to clear';
        return;
      }
      board[game.lbTab] = [];
      saveBoard();
      showBoard(back);
    };
  }
}
function countPlay() {
  if (game.TUT) return;
  const tot = game.curCrowd ? game.curCrowd.total : 999;
  game.over.fans = Math.min(tot, fansFor(game.plays));
  game.plays++;
  try {
    localStorage.setItem('god-plays', game.plays);
  } catch (e) {}
  game.over.fansUp = Math.max(0, Math.min(tot, fansFor(game.plays)) - game.over.fans);
}
function showOver() {
  app.classList.add('menu');
  ov.hidden = false;
  const btns = lbt =>
    `${nameBox()}<button class="go big" id="start">Ride again</button><div class="hicons three"><button id="menu"><svg viewBox="0 0 24 24" class="hi"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></button><button id="gar">${ICO('gar')}<span>Garage</span></button><button id="lbbtn">${ICO('lb')}<span>Scores</span></button></div>`;
  const wire = lbt => {
    $('#start').onclick = () => start();
    $('#menu').onclick = quitToMenu;
    $('#gar').onclick = () => showGarage();
    wireNameBox();
    $('#lbbtn').onclick = () => {
      game.lbTab = lbt;
      showBoard(showOver);
    };
  };
  const crowdLine = '';
  if (game.FREE) {
    ov.innerHTML = `<div class="card home"><h1><small>Free ride</small>${game.over.fell ? 'Fell off!' : 'Crash!'}</h1>
    <div class="res"><div><span>Time</span><b>${fmtT(frTime)}</b></div><div><span>Near misses</span><b>${frNear}</b></div><div><span>Score</span><b>${Math.floor(game.score).toLocaleString()}</b></div></div>
    <div class="best">${frTime >= freeBest - 0.01 ? '<span class="newbest">New best time!</span>' : 'Best ' + fmtT(freeBest)} · +${game.over.tickets} tickets</div>${crowdLine}${btns()}</div>`;
    wire('free');
    return;
  }
  ov.innerHTML = `<div class="card home"><h1><small>${game.over.win ? 'Full show' : 'Act ' + game.act + ' of ' + FINAL}</small>${game.over.win ? 'Take a bow!' : 'Crash!'}</h1>
    <div class="res"><div><span>Score</span><b>${game.over.score.toLocaleString()}</b></div><div><span>Best combo</span><b>${game.stats.maxCombo}</b></div><div><span>Perfect</span><b>${game.stats.perfect}</b></div></div>
    <div class="best">${game.over.newBest ? '<span class="newbest">New best show!</span>' : 'Best ' + game.best.toLocaleString()} · +${game.over.tickets} tickets</div>${crowdLine}${btns()}</div>`;
  wire('show');
}

export function initLeaderboard() {
  /* ---------- leaderboard: top 10 per mode, kept on this phone ---------- */
  game.lastEntry = null;
  game.lbTab = 'show';
  try {
    const b = JSON.parse(localStorage.getItem('god-board'));
    if (b && b.show && b.free) {
      board = b;
      board.combo = b.combo || [];
    }
  } catch (e) {}
  try {
    riderName = localStorage.getItem('god-name') || 'Rider';
  } catch (e) {}
}

export { countPlay, recordRun, showBoard, showOver };
