import { game } from '../core/state.js';
import { app } from '../render/renderer.js';
import { crowd } from '../arenas/crowd.js';
import { ARENAS } from '../arenas/arenas.js';
import { arenaOpen, reqText } from '../game/progress.js';
import { arenaId, setArena } from '../arenas/current.js';
import { ov, toast } from './hud.js';
import { parkBike, showGarage } from './garage.js';
import { showBoard } from './leaderboard.js';
import { startTutorial, tutDone } from './tutorial.js';
import { start } from '../game/run.js';
import { $ } from '../core/constants.js';

const ARENA_ART = {
  bigtop: 'repeating-linear-gradient(90deg,#b3151f 0 10px,#efe3cc 10px 20px)',
  beach: 'linear-gradient(#7fb2e5,#ffc9a0 55%,#e8cf9e 56%)',
  stadium: 'linear-gradient(#0b1430 45%,#2f7d32 46%)',
  crane: 'linear-gradient(#0d0b2a,#40205c 50%,#ff7a59)',
  under: 'radial-gradient(circle at 50% 30%,#4fc0e8,#0f5f8a 55%,#021d2e)',
  moon: 'radial-gradient(circle at 70% 30%,#7fd0ff 0 14%,transparent 15%),linear-gradient(#000 60%,#8d8f94 61%)',
};
const ICO = n =>
  `<svg viewBox="0 0 24 24" class="hi">${{ gar: `<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-7h10v7"/>`, lb: `<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/>`, learn: `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14"/><path d="M12 17.5v.5"/>`, set: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>` }[n]}</svg>`;
function showStart() {
  app.classList.add('menu');
  parkBike();
  ov.hidden = false;
  ov.innerHTML = `<div class="card">
  <h1>Globe Riders</h1>
  <div class="arenas"><button class="chip" data-mode="show" aria-pressed="${game.gameMode === 'show'}">The show</button><button class="chip" data-mode="free" aria-pressed="${game.gameMode === 'free'}">Free ride</button></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="go" id="start">Ride</button></div>
  <div class="hicons five"><button id="lvBtn"><svg viewBox="0 0 24 24" class="hi"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/></svg><span>${ARENAS[arenaId].name}</span></button><button id="gar">${ICO('gar')}<span>Garage</span></button><button id="lbbtn">${ICO('lb')}<span>Scores</span></button><button id="tutBtn" class="${tutDone() ? '' : 'glow'}">${ICO('learn')}<span>Learn</span></button><button id="setBtn">${ICO('set')}<span>Settings</span></button></div>
  ${game.best ? `<div class="best">Best show ${game.best.toLocaleString()}</div>` : ''}</div>`;
  ov.querySelectorAll('[data-mode]').forEach(
    b =>
      (b.onclick = () => {
        game.gameMode = b.dataset.mode;
        try {
          localStorage.setItem('god-mode', game.gameMode);
        } catch (e) {}
        showStart();
      }),
  );
  $('#start').onclick = () => start();
  $('#tutBtn').onclick = startTutorial;
  $('#gar').onclick = () => showGarage();
  $('#lbbtn').onclick = () => {
    game.lastEntry = null;
    game.lbTab = game.gameMode;
    showBoard(showStart);
  };
  $('#setBtn').onclick = showSettings;
  $('#lvBtn').onclick = showLevels;
}
function showLevels() {
  ov.hidden = false;
  const ok = '<svg viewBox="0 0 24 24" class="st-i"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    lk =
      '<svg viewBox="0 0 24 24" class="st-i"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  ov.innerHTML = `<div class="card"><h1>Levels</h1><div class="lvlist">${Object.entries(ARENAS)
    .map(([k, A]) => {
      const open = arenaOpen(k);
      return `<button class="lvrow${k === arenaId ? ' sel' : ''}${open ? '' : ' lock'}" data-lv="${k}"><span class="lvname">${A.name}</span><span class="lvst">${k === arenaId ? ok + 'Selected' : open ? 'Unlocked' : lk + reqText(k).replace(' to unlock', '')}</span></button>`;
    })
    .join('')}</div>
  <button class="go" id="lvBack">Back</button></div>`;
  ov.querySelectorAll('[data-lv]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.lv;
        if (!arenaOpen(k)) {
          toast(reqText(k), 1600);
          return;
        }
        setArena(k);
        parkBike();
        showLevels();
      }),
  );
  $('#lvBack').onclick = showStart;
}
function showSettings() {
  ov.hidden = false;
  const row = (id, label, on) =>
    `<button class="srow" id="${id}"><span>${label}</span><i class="swt${on ? ' on' : ''}"></i></button>`;
  ov.innerHTML = `<div class="card"><h1>Settings</h1><div class="slist">${row('sSnd', 'Sound', game.sndOn)}${row('sRing', 'Show touch ring', game.showRing)}${row('sUnl', 'Unlock all arenas', game.unlockAll)}
    <button class="srow" id="sTut"><span>Replay tutorial</span><i class="chev">›</i></button></div><button class="go" id="sBack">Done</button></div>`;
  $('#sSnd').onclick = () => {
    $('#sndBtn').click();
    showSettings();
  };
  $('#sRing').onclick = () => {
    game.showRing = !game.showRing;
    try {
      localStorage.setItem('god-ring', game.showRing ? '1' : '0');
    } catch (e) {}
    showSettings();
  };
  $('#sUnl').onclick = () => {
    game.unlockAll = !game.unlockAll;
    try {
      localStorage.setItem('god-unlockall', game.unlockAll ? '1' : '0');
    } catch (e) {}
    if (!arenaOpen(arenaId)) setArena('bigtop');
    crowd.sync();
    showSettings();
  };
  $('#sTut').onclick = startTutorial;
  $('#sBack').onclick = showStart;
}

export { ICO, showStart };
