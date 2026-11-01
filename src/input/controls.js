import { game } from '../core/state.js';
import { crowd } from '../arenas/crowd.js';
import { initAudio } from '../audio/synth.js';
import { lat, now, timeAt } from '../audio/clock.js';
import { gw } from '../game/perks.js';
import { turnRate } from '../game/path.js';
import { fStick, fx, fy } from '../game/freeride.js';
import { player } from '../game/objects.js';
import { showJudge } from '../ui/hud.js';
import { press, release } from '../game/judging.js';
import { $, clamp } from '../core/constants.js';
import { statMul } from '../bikes/stats.js';
import { hitSound } from '../audio/songs.js';

let touch, ghost, jk, swipeHint, bars, grip, blever, cons, tArc, tNeedle, gestures;

const SECT = ['right', 'ur', 'up', 'ul', 'left', 'dl', 'down', 'dr'];
let outT = 0,
  bandC = 0,
  bandW = 0;
let steer = 0,
  barRot = 0,
  barY = 0,
  barX = 0;
function lightLed(sec) {
  const led = document.getElementById('led' + sec);
  if (!led) return;
  led.classList.add('lit');
  setTimeout(() => led.classList.remove('lit'), 320);
}
function endStunt() {
  if (game.stuntState === 'pend' && game.stPend) {
    press('jump', game.stPend.t);
    game.stPend = null;
  }
  if (game.stuntState === 'wheelie') release('wheelie');
  if (game.stuntState === 'nose') release('nose');
  game.stuntState = 'rest';
  game.stuntHold = false;
  game.stuntD = 0;
  game.stuntPtr = null;
}
const tEnd = e => {
  if (game.FREE) {
    const g = gestures.get(e.pointerId);
    if (g && e.timeStamp - g.t0 < 260 && g.y0 - e.clientY > 30) press('jump');
    if (e.pointerId === game.fTouchPtr) {
      game.fTouchPtr = null;
      fStick.x = fStick.y = 0;
    }
  }
  if (e.pointerId === game.steerPtr) {
    game.steerPtr = null;
    game.steerDX = 0;
  }
  const g = gestures.get(e.pointerId);
  if (!g) return;
  if (g.kind === 'stunt' && game.stuntPtr === e.pointerId) endStunt();
  gestures.delete(e.pointerId);
  if (e.pointerId === game.stickPtr) {
    game.stickPtr = null;
    ghost.style.left = '';
    ghost.style.top = '';
    jk.style.transform = 'translate(0px,0px)';
    ghost.classList.remove('on');
  }
};
let trickSide = 0,
  trickOn = false,
  trickHeldT = 0,
  standOut = 0;
const heldKeys = { l: 0, r: 0 };
function trickTick(dt) {
  const P = player;
  let side = 0;
  const hn = game.holdNote && game.holdNote.type.startsWith('stand') ? game.holdNote : null;
  if (hn) {
    const want = hn.type === 'standl' ? -1 : 1;
    let held = want < 0 ? heldKeys.l : heldKeys.r;
    for (const g of gestures.values()) if (g.kind === 'steer' && g.side === want && Math.abs(g.dx || 0) > 24) held = 1;
    if (hn.auto) held = 1;
    if (held) {
      standOut = 0;
      side = want;
    } else {
      standOut += dt;
      if (standOut > 0.3) {
        release(hn.type);
        standOut = 0;
      }
    }
  }
  if (hn) {
  } else if (game.FREE) {
    if (Math.abs(fx()) > 0.9) {
      trickHeldT += dt;
      if (trickHeldT > 0.5) side = Math.sign(fx());
    } else trickHeldT = 0;
  } else
    for (const g of gestures.values())
      if (g.kind === 'steer' && g.steerAt && performance.now() - g.steerAt > 450 && Math.abs(g.dx || 0) > 40) {
        side = g.side;
        break;
      }
  if (side && !trickOn) {
    trickOn = true;
    if (!hn) showJudge('p', 'SEAT STAND!');
    crowd.wave();
    hitSound('wheelie', 2);
  }
  if (!side && trickOn) trickOn = false;
  if (side) trickSide = side;
  P.tr = (P.tr || 0) + ((side ? 1 : 0) - (P.tr || 0)) * Math.min(1, dt * 7);
  if (trickOn) {
    game.score += dt * 90 * (1 + Math.min(3, Math.floor(game.combo / 8)));
    game.cheer = Math.max(game.cheer, 0.7);
  }
  const b = P.bike,
    base = b.riderBase;
  b.rider.position.set(base.x + trickSide * 0.08 * P.tr, base.y + 0.32 * P.tr, base.z - 0.06 * P.tr);
  b.rider.rotation.z = -trickSide * 0.42 * P.tr;
  if (b.poseTrick) b.poseTrick(P.tr, trickSide || 1);
  b.trick.visible = P.tr > 0.15;
  b.trick.scale.set(trickSide || 1, 1, 1);
  // hide the riding arm + leg on the side that swings out, so there are never two
  if (b.limbs) {
    b.limbs[1].visible = !(b.trick.visible && (trickSide || 1) === 1);
    b.limbs[-1].visible = !(b.trick.visible && trickSide === -1);
  }
  const k = Math.max(0.01, P.tr);
  b.trick.children.forEach(c => {
    c.visible = k > 0.15;
  });
}
let freeStuntBeat = -1,
  freeStuntStep = 0;
function stuntTick(dt, B) {
  {
    const kind = game.wheelieDown ? 'wheelie' : game.noseDown ? 'nose' : trickOn ? 'stand' : null;
    if (kind && !game.holdNote) {
      const bi = Math.floor(B);
      if (bi !== freeStuntBeat) {
        freeStuntBeat = bi;
        hitSound(kind, freeStuntStep++);
      }
    } else if (!kind) {
      freeStuntStep = 0;
      freeStuntBeat = -1;
    }
  }
  trickTick(dt);
  if (
    game.holdNote &&
    !game.holdNote.auto &&
    game.stuntHold &&
    (game.stuntState === 'wheelie' || game.stuntState === 'nose')
  ) {
    const n = game.holdNote,
      sg = n.type === 'nose' ? -1 : 1,
      ph = B - n.beat;
    const need = 0.26 / statMul('wheelie', 0.18);
    bandW = 1 - need;
    bandC = sg * (need + bandW / 2);
    cons.classList.remove('slip');
  } else {
    bandW = 0;
    cons.classList.remove('slip');
  }
  if (bandW) {
    const a0 = ((bandC - bandW / 2) * 120 * Math.PI) / 180,
      a1 = ((bandC + bandW / 2) * 120 * Math.PI) / 180,
      pt = a => `${(60 + 42 * Math.sin(a)).toFixed(1)} ${(64 - 42 * Math.cos(a)).toFixed(1)}`;
    tArc.setAttribute('d', `M${pt(a0)} A42 42 0 0 1 ${pt(a1)}`);
    tArc.setAttribute('stroke', bandC < 0 ? '#ff6fb5' : '#ffc23d');
  } else tArc.setAttribute('d', '');
  const na =
    (game.FREE ? fy() : game.stuntD) * 120 +
    (game.stuntPtr == null && !game.FREE ? Math.sin(performance.now() / 90) * 1.5 : 0);
  tNeedle.setAttribute('transform', `rotate(${na.toFixed(1)} 60 64)`);
  grip.style.setProperty('--roll', (clamp(game.FREE ? fy() : game.stuntD, -1, 1) * 24).toFixed(1) + 'px');
  blever.style.setProperty('--pull', (Math.min(0, game.stuntD) * -16).toFixed(1) + 'deg');
  ghost.classList.toggle('hint', game.showRing && game.running && !game.over && B < 10 && game.stickPtr == null);
  swipeHint.classList.toggle('on', !game.showRing && game.running && !game.over && B < 10 && !game.TUT);
  // handlebars steer: follow the loop actually swinging, plus a kick on every swipe
  const yr = turnRate(B),
    tr = 0;
  game.steerKick *= Math.pow(0.15, dt);
  const P = player,
    tRot = clamp(clamp(-yr * 0.45, -10, 10) + game.steerKick + (game.steerDX / 80) * 16, -18, 18),
    tY = clamp(tr * 0.5, -12, 12) - (P.wh || 0) * 14 + (P.nw || 0) * 12 - (P.h || 0) * 10;
  barRot += (tRot - barRot) * Math.min(1, dt * 7);
  barY += (tY - barY) * Math.min(1, dt * 7);
  const buzz = Math.sin(performance.now() / 16) * 0.5;
  bars.style.transform = `translate(${(barRot * 1.8).toFixed(1)}px,${(barY + buzz).toFixed(2)}px) rotate(${barRot.toFixed(2)}deg)`;
}

export function initControls() {
  /* ---------- one control: swipe anywhere. sides + diagonals steer; pull back = wheelie; push forward = stoppie (hold) or jump (flick and let go) ---------- */
  touch = $('#touch');
  ghost = $('#joyGhost');
  jk = $('#joyKnob');
  game.showRing = false;
  try {
    game.showRing = localStorage.getItem('god-ring') === '1';
  } catch (e) {}
  swipeHint = $('#swipeHint');
  bars = $('#hbars');
  grip = $('#grip');
  blever = $('#blever');
  cons = $('#console');
  tArc = $('#tArc');
  tNeedle = $('#tNeedle');
  gestures = new Map();
  game.stickPtr = null;
  game.stuntPtr = null;
  game.stPend = null;
  game.stuntState = 'rest';
  game.stuntD = 0;
  game.stuntHold = false;
  game.steerKick = 0;
  game.steerDX = 0;
  game.steerPtr = null;
  touch.addEventListener('pointerdown', e => {
    e.preventDefault();
    initAudio();
    try {
      touch.setPointerCapture(e.pointerId);
    } catch (_) {}
    gestures.set(e.pointerId, { x0: e.clientX, y0: e.clientY, armed: true, kind: null, t0: e.timeStamp });
    if (game.FREE && game.fTouchPtr == null) {
      game.fTouchPtr = e.pointerId;
      fStick.x = fStick.y = 0;
    }
    if (game.stickPtr == null && game.showRing) {
      game.stickPtr = e.pointerId;
      const r = touch.getBoundingClientRect();
      ghost.style.left = e.clientX - r.left + 'px';
      ghost.style.top = e.clientY - r.top + 'px';
      jk.style.transform = 'translate(0px,0px)';
      ghost.classList.add('on');
    }
  });
  touch.addEventListener('pointermove', e => {
    const g = gestures.get(e.pointerId);
    if (!g) return;
    const dx = e.clientX - g.x0,
      dy = e.clientY - g.y0,
      d = Math.hypot(dx, dy);
    g.dx = dx;
    if (game.FREE) {
      if (e.pointerId === game.fTouchPtr) {
        const dz = v => (Math.abs(v) < 10 ? 0 : clamp((v - Math.sign(v) * 10) / 60, -1, 1));
        fStick.x = dz(dx);
        fStick.y = dz(dy);
      }
      if (e.pointerId === game.stickPtr) {
        const k = Math.min(1, 48 / Math.max(d, 1));
        jk.style.transform = `translate(${dx * k}px,${dy * k}px)`;
      }
      return;
    }
    if (
      g.kind !== 'stunt' &&
      (game.steerPtr == null || game.steerPtr === e.pointerId) &&
      Math.abs(dx) > Math.abs(dy) * 0.5
    ) {
      game.steerPtr = e.pointerId;
      game.steerDX = clamp(dx, -80, 80);
    }
    if (e.pointerId === game.stickPtr) {
      const k = Math.min(1, 48 / Math.max(d, 1));
      jk.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    }
    if (g.kind === 'stunt') {
      game.stuntD = clamp(dy / 72, -1, 1);
      if (game.stuntState === 'wheelie' || game.stuntState === 'nose') {
        const x = e.clientX;
        if (g.lo == null) g.lo = g.hi = x;
        g.lo = Math.min(g.lo, x);
        g.hi = Math.max(g.hi, x);
        if (x - g.lo >= 16) {
          press('right', undefined, true);
          game.steerKick = 7;
          g.lo = g.hi = x;
          lightLed(0);
        } else if (g.hi - x >= 16) {
          press('left', undefined, true);
          game.steerKick = -7;
          g.lo = g.hi = x;
          lightLed(4);
        }
      }
      if (game.stuntState === 'pend' && game.stuntD > -0.14) {
        press('jump', game.stPend.t);
        game.stPend = null;
        game.stuntState = 'flick';
      } else if ((game.stuntState === 'flick' || game.stuntState === 'dead') && Math.abs(game.stuntD) < 0.14) {
        game.stuntState = 'rest';
        g.kind = null;
        g.armed = true;
        game.stuntPtr = null;
      }
      return;
    }
    if (d < 16) {
      g.armed = true;
      if (g.kind === 'steer') g.kind = null;
      return;
    }
    if (d > (game.holdNote ? 14 : 28) && g.armed) {
      const sec = ((Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) % 8) + 8) % 8,
        dir = SECT[sec];
      g.armed = false;
      lightLed(sec);
      if ((dir === 'up' || dir === 'down') && game.stuntPtr != null && game.stuntPtr !== e.pointerId) {
        const d2 = dir === 'up' ? (dx >= 0 ? 'ur' : 'ul') : dx >= 0 ? 'dr' : 'dl';
        g.kind = 'steer';
        press(d2, undefined, true);
        game.steerKick = (dx >= 0 ? 1 : -1) * 7;
        return;
      }
      if (dir === 'up' || dir === 'down') {
        if (game.stuntPtr != null) return;
        g.kind = 'stunt';
        game.stuntPtr = e.pointerId;
        game.stuntD = clamp(dy / 72, -1, 1);
        if (dir === 'down') {
          press('wheelie');
          game.stuntState = 'wheelie';
          game.stuntHold = true;
          outT = 0;
        } else {
          // push forward: normally wait 210 ms to tell a stoppie (hold) from a jump (flick). When the move
          // that's due is a stoppie and no jump is near, start it at once so it pops like a wheelie does
          const tn = now() - lat(),
            due = game.FREE ? [] : game.notes.filter(n => !n.judged && Math.abs(timeAt(n.beat) - tn) <= gw(n.type) * 1.2);
          if (due.some(n => n.type === 'nose') && !due.some(n => n.type === 'jump')) {
            press('nose', tn);
            game.stuntState = 'nose';
            game.stuntHold = true;
            outT = 0;
            return;
          }
          const pend = (game.stPend = { t: tn });
          game.stuntState = 'pend';
          setTimeout(() => {
            if (game.stPend === pend && game.stuntState === 'pend') {
              press('nose', pend.t);
              game.stPend = null;
              game.stuntState = 'nose';
              game.stuntHold = true;
              outT = 0;
            }
          }, 210);
        }
      } else {
        g.kind = 'steer';
        press(dir, undefined, !!game.holdNote);
        game.steerKick = (dx > 0 ? 1 : -1) * 7;
        g.steerAt = performance.now();
        g.side = dx > 0 ? 1 : -1;
      }
    }
  });
  touch.addEventListener('pointerup', tEnd);
  touch.addEventListener('pointercancel', tEnd);
  touch.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') heldKeys.l = 1;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') heldKeys.r = 1;
  });
  addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') heldKeys.l = 0;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') heldKeys.r = 0;
  });
}

export { endStunt, gestures, heldKeys, jk, stuntTick };
