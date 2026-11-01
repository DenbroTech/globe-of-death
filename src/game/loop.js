import { game } from '../core/state.js';
import { camera, renderer, scene } from '../render/renderer.js';
import { inner } from '../render/lights.js';
import { crowd } from '../arenas/crowd.js';
import { ARENAS, turntable } from '../arenas/arenas.js';
import { prog, saveProg } from './progress.js';
import { reachAct } from './unlocks.js';
import { arenaId, arenaTick } from '../arenas/current.js';
import { TRAIL_STEP, _a, _b, _c, arcTrail, fillTrail, pushRibbon, resetRibbon } from '../render/trails.js';
import { PN, burst, flash, pGeo, pMat, pPos, pVel } from '../render/particles.js';
import { ac, ambienceTick } from '../audio/synth.js';
import { ACT_START, FINAL, INTRO, LOOK, actOfBar, beatAt, bpmOfAct, lat, now, timeAt } from '../audio/clock.js';
import { orientOnWall, posAt, tanAt } from './path.js';
import { FR_CRUISE, FR_MIN, fmtT, frNear, frTime, freeFall, freeStep, freeTick, fx, fy } from './freeride.js';
import { myRing, player, pool } from './objects.js';
import { genBarNotes } from './chart.js';
import { addBal, ov, showJudge, toast } from '../ui/hud.js';
import { setPause } from './run.js';
import { autoHit, nosEnd, boostActive, boostB0, boostBtn, chargeBoost } from './boost.js';
import { finale, finishHold, miss, ridersFor, tumble } from './judging.js';
import { stuntTick } from '../input/controls.js';
import { updateCamera } from '../render/camera.js';
import { addScore, gw, offerPerks, pk } from './perks.js';
import { gBike, gFig, showroom } from '../ui/garage.js';
import { showOver } from '../ui/leaderboard.js';
import { tutGen, tutTick } from '../ui/tutorial.js';
import { $, G, R, V3, clamp } from '../core/constants.js';
import { hitSound, menuMusic, scheduleStep } from '../audio/songs.js';

let barsEl, hitEl, trackEl, el;

const barLines = [];
let clock = 0,
  hudT = 0,
  lastBeatInt = -1;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - game.lastT) / 1000);
  game.lastT = nowMs;
  // safety net: a ride must never sit paused with no card on screen; show the pause menu instead
  if (game.running && !game.over && game.paused && ov.hidden && game.slow <= 0) {
    game.paused = false;
    game.pauseMenu = false;
    setPause(true);
  }
  clock += dt;
  let ts = 1;
  if (game.slow > 0) {
    game.slow -= dt;
    ts = 0.2;
    if (game.slow <= 0 && game.over) showOver();
  }
  const P = player;
  if (game.running && !game.over && !game.paused) {
    const T = now(),
      B = beatAt(T - lat());
    // keep the chart 3 bars ahead and the music scheduled
    if (!game.FREE) {
      if (game.TUT) {
        while (game.genBar <= Math.floor(B / 4) + 2) tutGen(game.genBar++);
        tutTick(B);
        if (game.paused) return;
      }
      else while (game.genBar <= Math.floor(B / 4) + 3) genBarNotes(game.genBar++);
    }
    while (timeAt(game.schedStep / 2) < T + 0.15) scheduleStep(game.schedStep++);
    if (!game.FREE) {
      if (boostActive()) for (const n of game.notes) if (!n.judged && timeAt(n.beat) <= T - lat()) autoHit(n);
      for (const n of game.notes)
        if (
          !n.judged &&
          timeAt(n.beat) + gw(n.type) < T - lat() &&
          !(game.stPend && (n.type === 'jump' || n.type === 'nose'))
        )
          miss(n);
      if (game.holdNote) {
        const n = game.holdNote;
        while (n.lastTick + 1 <= Math.min(B, n.beat + n.len)) {
          n.lastTick++;
          hitSound(n.type, n.lastTick - n.beat);
          addScore(100 * (1 + Math.min(3, Math.floor(game.combo / 8))));
          game.cheer = 1;
          addBal(3);
          chargeBoost(4);
        }
        if (B >= n.beat + n.len) finishHold(n);
      }
    }
    stuntTick(dt, B);
    if (game.over) return;
    const bar = Math.floor(B / 4);
    if (bar !== game.lastBarShown) {
      game.lastBarShown = bar;
      const a = actOfBar(bar);
      if (bar === 2) toast('GO!', 900);
      if (!game.FREE && !game.TUT && bar >= 3 && a > game.act) {
        game.act = a;
        if (!game.TUT) {
          if (a > prog.maxAct) {
            prog.maxAct = a;
            saveProg();
          }
          const got = reachAct(a, id => ARENAS[id].name);
          if (got.length) setTimeout(() => toast('Unlocked: ' + got.slice(0, 3).join(' · '), 2400), 900);
        }
        game.netLeft = pk('net');
        if (a === FINAL + 1 && !game.encore) {
          finale();
          return;
        }
        offerPerks(a);
        return;
      }
    }
    if (bar === 1) {
      const c = 4 - Math.floor(B - 4);
      if (c >= 1 && c <= 3 && lastBeatInt !== Math.floor(B)) toast(String(c), 500);
    }
    if (Math.floor(B) !== lastBeatInt) {
      lastBeatInt = Math.floor(B);
      hitEl.classList.add('pulse');
      setTimeout(() => hitEl.classList.remove('pulse'), 90);
      inner.intensity = 1.6;
    }
    // your bike
    if (game.FREE && B >= INTRO) {
      if (!P.fInit) {
        P.fInit = true;
        P.fp = posAt(B, new V3());
        P.ft = tanAt(B, new V3());
        P.fs = FR_CRUISE;
      }
      const x = fx(),
        y = fy();
      freeStep(P, dt, x, y);
      P.p.copy(P.fp);
      P.t.copy(P.ft);
      {
        const v = P.fs * R,
          Ngrip = (v * v) / R - (arenaId === 'moon' ? G * 0.4 : G) * P.p.y;
        if (Ngrip < 0) {
          game.fSlip += dt;
          if (game.fSlip > 0.15) showJudge('m', 'TOO SLOW!');
          $('#vig').style.opacity = 0.9;
          if (game.fSlip > 0.55 && !game.over) {
            freeFall();
            return;
          }
        } else game.fSlip = Math.max(0, game.fSlip - dt * 2);
      }
      game.wheelieDown = y > 0.72;
      game.noseDown = y < -0.72 && P.fs > FR_MIN + 0.2;
      game.stuntD = y;
      game.steerDX = x * 80;
    } else {
      posAt(B, P.p);
      tanAt(B, P.t);
    }
    const MOON = arenaId === 'moon',
      hs = (T - lat() - P.hopT0) / (MOON ? 0.7 : 0.42);
    P.h = hs > 0 && hs < 1 ? (MOON ? 1.9 : 1.2) * Math.sin(Math.PI * hs) : 0;
    orientOnWall(P.bike.g, P.p, P.t, 0);
    P.bike.g.position.copy(P.p).multiplyScalar(R - P.h);
    if (P.h > 0) P.bike.g.rotateX(-0.35 * Math.sin(Math.PI * hs));
    P.wh += ((game.wheelieDown ? 1 : 0) - P.wh) * Math.min(1, dt * 10);
    {
      const wob = 1 - game.balance / 100;
      if (wob > 0.05) P.bike.g.rotateZ(Math.sin(clock * 9) * 0.35 * wob * wob);
    }
    P.nw = (P.nw || 0) + ((game.noseDown ? 1 : 0) - (P.nw || 0)) * Math.min(1, dt * 10);
    P.bike.m.rotation.x = -0.55 * P.wh + 0.42 * P.nw;
    P.bike.m.position.y = 0.18 * P.wh + 0.2 * P.nw;
    P.bike.m.position.z = -0.1 * P.wh + 0.16 * P.nw;
    P.bike.wheels.forEach(w => (w.rotation.x += dt * 25));
    // ribbon of where you've been (starts once you're up on the wall)
    if (B >= INTRO) {
      if (!myRing.visible) resetRibbon(myRing, P.p);
      myRing.visible = true;
      pushRibbon(myRing, P.p);
    } else myRing.visible = false;
    if (game.FREE && P.fInit) {
      const pts = myRing.userData.pts;
      arcTrail(P.trail, (i, o) => o.copy(pts[Math.min(i, pts.length - 1)]));
    } else arcTrail(P.trail, (i, o) => posAt(B - (i * TRAIL_STEP) / (Math.PI / 2), o));
    if (game.FREE) freeTick(dt, T, B);
    else {
      // riders cutting across
      for (const n of game.notes) {
        if (n.type !== 'jump') continue;
        if (!n.slot && n.beat - B < LOOK && n.beat - B > -1) {
          const s = pool.slice(0, ridersFor(game.act)).find(x => !x.busy);
          if (s) {
            s.busy = true;
            s.state = 'ride';
            n.slot = s;
            s.note = n;
            s.bike.g.visible = true;
            s.trail.visible = true;
            _c.copy(n.M).applyAxisAngle(n.A, n.w * (B - n.beat));
            fillTrail(s.trail, _c.multiplyScalar(R - 0.04));
          }
        }
      }
      for (const s of pool) {
        if (!s.busy) continue;
        const n = s.note,
          dB = B - n.beat;
        if (s.state === 'ride') {
          const ang = n.w * dB;
          _a.copy(n.M).applyAxisAngle(n.A, ang);
          _b.copy(n.c).applyAxisAngle(n.A, ang);
          orientOnWall(s.bike.g, _a, _b, 0);
          arcTrail(s.trail, (i, o) => o.copy(n.M).applyAxisAngle(n.A, ang - Math.sign(n.w) * i * TRAIL_STEP));
          s.bike.wheels.forEach(w => (w.rotation.x += dt * 25));
          for (let i = 0; i < s.dots.length; i++) {
            const d = s.dots[i];
            d.visible = dB < 0;
            if (d.visible) {
              const f = (i + 1) / (s.dots.length + 1);
              d.position
                .copy(n.M)
                .applyAxisAngle(n.A, ang * (1 - f))
                .multiplyScalar(R - 0.06);
              d.material.opacity = 0.35 + 0.5 * f;
            }
          }
          s.mark.visible = dB < 0.3;
          if (s.mark.visible) {
            s.mark.position.copy(n.M).multiplyScalar(R - 0.12);
            const u = clamp(1 + dB / LOOK, 0, 1);
            s.mark.scale.setScalar(0.7 + 1.1 * u + 0.25 * Math.sin(clock * 16));
            s.mark.material.opacity = 0.4 + 0.6 * u;
          }
        } else if (s.state === 'tumble') {
          tumble(s, dt);
          s.bike.g.position.copy(s.cp);
          s.bike.g.rotateOnAxis(s.sa, s.sw * dt);
          s.mark.visible = false;
          s.trail.visible = false;
          s.dots.forEach(d => (d.visible = false));
        }
        if (dB > 2 && dB <= 4 && s.state === 'ride') {
          const f = 1 - (dB - 2) / 2;
          s.bike.g.scale.setScalar(Math.max(0.01, f));
          s.trail.material.opacity = f;
        }
        if (dB > 4 || (dB > 2 && s.state !== 'ride')) {
          s.bike.g.scale.setScalar(1);
          s.trail.material.opacity = 1;
          s.busy = false;
          s.bike.g.visible = false;
          s.dots.forEach(d => (d.visible = false));
          s.mark.visible = false;
          s.trail.visible = false;
          s.state = null;
          n.slot = null;
          n.done = true;
        }
      }
      // the track
      const w = trackEl.clientWidth,
        hx = 24,
        ppb = (w - hx - 24) / LOOK;
      for (const n of game.notes) {
        const x = hx + (n.beat - B) * ppb;
        n.el.style.transform = `translateX(${x}px)`;
        n.el.hidden = x > w + 30;
        if (n.len && n.el.dataset.w != String(ppb | 0)) {
          n.el.dataset.w = ppb | 0;
          n.el.style.width = n.len * ppb + 40 + 'px';
        }
      }
      while (
        game.notes.length &&
        game.notes[0].beat + game.notes[0].len < B - 2 &&
        game.notes[0].judged &&
        !game.notes[0].slot &&
        game.notes[0] !== game.holdNote
      ) {
        game.notes[0].el.remove();
        game.notes.shift();
      }
      if (boostActive()) {
        game.boostB1 = nosEnd(game.boostB1);
        game.boostEnd = Math.max(game.boostEnd, timeAt(game.boostB1) + lat() + 0.05);
      }
      {
        const bb = $('#boostband'),
          on = boostActive();
        bb.hidden = !on;
        if (on) {
          const x0 = Math.max(hx, hx + (boostB0 - B) * ppb),
            x1 =
              hx +
              (game.boostB1 - B) * ppb +
              (game.notes.some(n => n.len && Math.abs(n.beat + n.len - game.boostB1) < 0.15) ? 22 : 0);
          bb.style.transform = `translateX(${x0}px)`;
          bb.style.width = Math.max(0, x1 - x0) + 'px';
        }
      }
      {
        const al = $('#actline'),
          nb = game.TUT ? (game.tutLine ?? -1e4) : (ACT_START[game.act] || 0) * 4,
          x = hx + (nb - B) * ppb,
          show = !game.FREE && B >= INTRO && x < w + 10 && x > -10;
        al.hidden = !show;
        if (show) {
          al.style.transform = `translateX(${x}px)`;
          $('#actlineTxt').textContent = game.act >= FINAL && !game.encore ? 'FINALE' : 'PERK';
        }
      }
      for (let i = 0; i < barLines.length; i++) {
        const b = Math.ceil(B) + i,
          x = hx + (b - B) * ppb;
        barLines[i].style.transform = `translateX(${x}px)`;
        barLines[i].className = 'bl' + (b % 4 === 0 ? ' bar' : '');
        barLines[i].hidden = x > w;
      }
    }
    if (game.engineOsc)
      game.engineOsc.o.frequency.setTargetAtTime(
        48 + bpmOfAct(game.act) * 0.35 + (P.h > 0 ? 25 : 0) + (boostActive() ? 40 : 0),
        ac.currentTime,
        0.05,
      );
    if (boostActive() && Math.random() < 0.5) {
      burst(
        _c
          .copy(P.p)
          .multiplyScalar(R - 0.3)
          .addScaledVector(P.t, -0.6),
        30,
        2,
      );
      flash.intensity = 1.5;
    }
  }
  turntable.visible = false;
  if (showroom && gFig) {
    game.gCheer = Math.max(0, game.gCheer - dt);
    gFig.userData.tick(clock, game.gCheer > 0 ? 1 : 0);
    if (gBike.flutter) gBike.flutter(clock, 0.3);
    gBike.wheels.forEach(w => (w.rotation.x = 0));
  }
  if (P.bike.flutter) P.bike.flutter(clock, 1);
  for (const s of pool) if (s.busy && s.bike.flutter) s.bike.flutter(clock, 1);
  if (game.over && !game.over.win) {
    tumble(player, dt * ts);
    P.bike.g.position.copy(player.cp);
    P.bike.g.rotateOnAxis(player.sa, player.sw * dt * ts);
    myRing.visible = false;
    for (const s of pool) {
      s.mark.visible = false;
      if (s.state === 'tumble') {
        tumble(s, dt * ts);
        s.bike.g.position.copy(s.cp);
      }
    }
  }
  P.shake = Math.max(0, P.shake - dt);
  inner.intensity += (0.9 - inner.intensity) * Math.min(1, dt * 8);
  if (game.sparkT > 0) {
    game.sparkT -= dt * ts;
    for (let i = 0; i < PN; i++) {
      pVel[i * 3 + 1] -= G * dt * ts * 0.6;
      for (let k = 0; k < 3; k++) pPos[i * 3 + k] += pVel[i * 3 + k] * dt * ts;
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity = clamp(game.sparkT / 1.2, 0, 1);
  } else pMat.opacity = 0;
  flash.intensity *= Math.pow(0.02, dt);
  game.cheer = Math.max(0, game.cheer - dt * 0.7);
  crowd.update(game.cheer, clock, dt);
  arenaTick(clock);
  menuMusic();
  ambienceTick(dt);
  game.crowdLight +=
    ((game.running && !game.over && !game.paused ? 0.08 : 0.6) - game.crowdLight) * Math.min(1, dt * 2);
  if (game.curCrowd) {
    game.curCrowd.mat.emissiveIntensity = game.crowdLight * (ARENAS[arenaId].crowdGlow ?? 1);
    game.curCrowd.mat.color.setScalar(game.running && !game.over && !game.paused ? 0.7 : 1);
  }
  if (P.h === undefined) P.h = 0;
  updateCamera(dt);
  renderer.render(scene, camera);
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.08;
    el.score.textContent = Math.floor(game.score).toLocaleString();
    el.combo.textContent = game.FREE ? frNear : game.combo;
    el.act.textContent = game.FREE ? fmtT(frTime) : game.act;
    $('#riders').textContent = ridersFor(game.act);
    const ba = boostActive();
    boostBtn.style.setProperty('--fill', game.boostCharge + '%');
    boostBtn.classList.toggle('ready', game.boostCharge >= 100 && !ba);
    boostBtn.classList.toggle('active', ba);
    $('#boostTxt').textContent = ba
      ? 'GO!'
      : game.boostCharge >= 100
        ? 'TAP'
        : game.balance < 100 && !pk('hot')
          ? '—'
          : Math.round(game.boostCharge) + '%';
    if (game.boostCharge >= 100 && !game.boostWasReady) toast('NOS READY · TAP IT', 1300);
    game.boostWasReady = game.boostCharge >= 100;
  }
}

export function initLoop() {
  /* ---------- frame ---------- */
  barsEl = $('#bars');
  hitEl = $('#hit');
  trackEl = $('#track');
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'bl';
    barsEl.appendChild(d);
    barLines.push(d);
  }
  el = { score: $('#score'), combo: $('#combo'), act: $('#act') };
  game.lastT = performance.now();
}

export { clock, frame };
