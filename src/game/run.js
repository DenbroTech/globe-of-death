import { game } from '../core/state.js';
import { app } from '../render/renderer.js';
import { crowd } from '../arenas/crowd.js';
import { _c, fillTrail } from '../render/trails.js';
import { ac, initAudio, master } from '../audio/synth.js';
import { bpmOfAct, now } from '../audio/clock.js';
import { orientOnWall, posAt, tanAt } from './path.js';
import { fStick, freeReset } from './freeride.js';
import { myRing, nextRing, player, pool } from './objects.js';
import { drawHearts, ov, toast } from '../ui/hud.js';
import { freeClock, holdClock } from './judging.js';
import { endStunt, gestures, heldKeys, jk } from '../input/controls.js';
import { cam } from '../render/camera.js';
import { leaveGarage, rebuildPlayerBike } from '../ui/garage.js';
import { tutDraw, tutEl } from '../ui/tutorial.js';
import { $, R } from '../core/constants.js';
import { showStart } from '../ui/menus.js';

function start() {
  crowd.sync();
  game.TUT = game.tutPending;
  game.tutPending = false;
  game.tutI = 0;
  game.tutN = 0;
  if (typeof tutEl !== 'undefined') tutEl.hidden = true;
  if (game.TUT) game.gameMode = 'show';
  initAudio();
  if (ac && ac.state !== 'running') ac.resume().catch(() => {});
  game.FREE = game.gameMode === 'free';
  game.userOff = [];
  freeReset();
  player.fInit = false;
  fStick.x = fStick.y = 0;
  game.fTouchPtr = null;
  game.fKeys = { l: 0, r: 0, u: 0, d: 0, w: 0, n: 0 };
  game.fSlip = 0;
  app.classList.toggle('free', game.FREE);
  $('#combo').previousElementSibling.textContent = game.FREE ? 'Near' : 'Combo';
  $('#act').previousElementSibling.textContent = game.FREE ? 'Time' : 'Act';
  game.notes.forEach(n => n.el.remove());
  game.notes = [];
  game.posePlan = [];
  game.turns = [];
  game.genBar = 0;
  game.lastNoteBeat = game.lastTiltBeat = game.lastJumpBeat = -9;
  game.planned = { tilt: 0, yaw: 0 };
  game.holdNote = null;
  game.wheelieDown = false;
  game.noseDown = false;
  game.lastWheelieBar = -9;
  game.holdEnd = -9;
  game.encore = false;
  game.boostCharge = 0;
  game.boostEnd = 0;
  game.perks = {};
  game.netLeft = 0;
  game.boostWasReady = false;
  leaveGarage();
  rebuildPlayerBike();
  pool.forEach(s => {
    s.busy = false;
    s.bike.g.visible = false;
    s.dots.forEach(d => (d.visible = false));
    s.mark.visible = false;
    s.trail.visible = false;
    s.state = null;
  });
  game.over = null;
  game.paused = false;
  game.score = 0;
  game.combo = 0;
  game.balance = 100;
  game.act = 1;
  game.slow = 0;
  game.lastBarShown = -1;
  game.stats = { perfect: 0, good: 0, miss: 0, maxCombo: 0 };
  game.tempos = [{ beat: 0, time: now() + 0.35, bpm: bpmOfAct(1) }];
  game.schedStep = 0;
  player.hopT0 = -9;
  player.shake = 0;
  player.bike.g.visible = true;
  player.trail.visible = true;
  posAt(0, player.p);
  fillTrail(player.trail, _c.copy(player.p).multiplyScalar(R - 0.04));
  if (ac) {
    if (game.engineOsc)
      try {
        game.engineOsc.o.stop();
      } catch (e) {}
    const o = ac.createOscillator(),
      g = ac.createGain(),
      lp = ac.createBiquadFilter();
    o.type = 'sawtooth';
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    g.gain.value = 0.035;
    o.frequency.value = 55;
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start();
    game.engineOsc = { o, g };
  }
  app.classList.remove('menu');
  game.running = true;
  cam.snap = true;
  ov.hidden = true;
  drawHearts();
  toast('Ready…', 1500);
  if (game.TUT) tutDraw(true);
}
function quitToMenu() {
  resetInput();
  game.TUT = false;
  tutEl.hidden = true;
  game.running = false;
  game.paused = false;
  game.over = null;
  game.heldAt = null;
  game.slow = 0;
  game.holdNote = null;
  game.wheelieDown = game.noseDown = false;
  if (game.engineOsc) {
    try {
      game.engineOsc.o.stop();
    } catch (e) {}
    game.engineOsc = null;
  }
  game.notes.forEach(n => n.el.remove());
  game.notes = [];
  freeReset();
  pool.forEach(s => {
    s.busy = false;
    s.state = null;
    s.bike.g.visible = false;
    s.trail.visible = false;
    s.dots.forEach(d => (d.visible = false));
    s.mark.visible = false;
  });
  player.trail.visible = false;
  myRing.visible = nextRing.visible = false;
  $('#vig').style.opacity = 0;
  warnHide();
  posAt(0, player.p);
  tanAt(0, player.t);
  orientOnWall(player.bike.g, player.p, player.t, 0);
  player.bike.g.visible = true;
  showStart();
}
function warnHide() {
  const w = document.getElementById('warn');
  if (w) w.hidden = true;
}
function resetInput() {
  try {
    if (game.stuntPtr != null) endStunt();
  } catch (e) {}
  gestures.clear();
  game.stuntPtr = null;
  game.stPend = null;
  game.stuntState = 'rest';
  game.stuntD = 0;
  game.stuntHold = false;
  game.steerPtr = null;
  game.steerDX = 0;
  game.steerKick = 0;
  game.fTouchPtr = null;
  fStick.x = fStick.y = 0;
  game.stickPtr = null;
  game.fKeys = { l: 0, r: 0, u: 0, d: 0, w: 0, n: 0 };
  try {
    jk.style.transform = '';
  } catch (e) {}
  if (typeof heldKeys !== 'undefined' && heldKeys.clear) heldKeys.clear();
}
function setPause(p) {
  if (!game.running || game.over || p === game.paused) return;
  resetInput();
  game.paused = p;
  if (p) holdClock();
  else freeClock();
  if (p) {
    ov.innerHTML =
      '<div class="card"><h1>Paused</h1><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="go" id="resume">Resume</button><button class="go ghost" id="quit">Quit to menu</button></div></div>';
    ov.hidden = false;
    $('#resume').onclick = () => setPause(false);
    $('#quit').onclick = quitToMenu;
  } else ov.hidden = true;
}

export function initRun() {
  $('#pauseBtn').onclick = () => setPause(!game.paused);
  $('#sndBtn').setAttribute('aria-pressed', game.sndOn);
  $('#sndBtn').onclick = () => {
    game.sndOn = !game.sndOn;
    $('#sndBtn').setAttribute('aria-pressed', game.sndOn);
    if (master) master.gain.value = game.sndOn ? 0.6 : 0;
    try {
      localStorage.setItem('god-snd', game.sndOn ? '1' : '0');
    } catch (e) {}
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPause(true);
  });
}

export { quitToMenu, resetInput, setPause, start };
