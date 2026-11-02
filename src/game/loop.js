import * as THREE from 'three';
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
import { ac, ambienceTick, rebuildAudio } from '../audio/synth.js';
import { ACT_START, FINAL, INTRO, LOOK, actOfBar, beatAt, bpmOfAct, lat, now, timeAt } from '../audio/clock.js';
import { orientOnWall, posAt, tanAt } from './path.js';
import { FR_CRUISE, FR_MIN, fmtT, frNear, frTime, freeFall, freeStep, freeTick, fx, fy, setGhost } from './freeride.js';
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
let audioStuck = 0,
  acFrozen = 0,
  lastAcT = -1;
let clock = 0,
  hudT = 0,
  lastBeatInt = -1;
/* NOS afterburner: two additive cones (orange outer, white-hot core) out of the back of your bike + a warm light */
let nosFlame = null;
function makeNosFlame() {
  const g = new THREE.Group();
  const cone = (r, len, hex) => {
    const geo = new THREE.ConeGeometry(r, len, 18, 6, true);
    geo.translate(0, len / 2, 0);
    geo.rotateX(-Math.PI / 2); // tip points backwards (-z)
    const P = geo.attributes.position,
      C = new Float32Array(P.count * 3),
      c = new THREE.Color(hex);
    for (let i = 0; i < P.count; i++) {
      const f = Math.pow(1 - Math.min(1, -P.getZ(i) / len), 1.4);
      C[i * 3] = c.r * f;
      C[i * 3 + 1] = c.g * f;
      C[i * 3 + 2] = c.b * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    return new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
  };
  g.add(cone(0.2, 1.5, 0xff5a10), cone(0.1, 0.95, 0xfff0b0));
  // the glow light is NOT inside the flame group: hiding a light changes the light count, which makes
  // three.js recompile every material (that was the stutter when NOS started/ended). It stays on, at 0.
  const L = new THREE.PointLight(0xff7a20, 0, 6, 2);
  L.position.set(0, 0.42, -1.45);
  g.userData.light = L;
  g.position.set(0, 0.42, -0.95);
  g.visible = false;
  return g;
}
/* other riders' loops: a path is a great circle (point M at beat b0, axis A, w radians per beat) */
const _rp = new V3();
function idlePath(B) {
  const M = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  if (M.dot(player.p) > 0.2) M.negate(); // start away from you
  const A = new V3().crossVectors(M, new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)).normalize();
  return { M, A, w: (Math.PI / 2) * (0.9 + Math.random() * 0.3), b0: B };
}
function riderPos(s, B, out) {
  const P = s.path;
  out.copy(P.M).applyAxisAngle(P.A, P.w * (B - P.b0));
  if (s.from && B < s.bl1) {
    const F = s.from,
      x = clamp((B - s.bl0) / (s.bl1 - s.bl0), 0, 1),
      k = x * x * (3 - 2 * x);
    _rp.copy(F.M).applyAxisAngle(F.A, F.w * (B - F.b0));
    _rp.lerp(out, k);
    if (_rp.lengthSq() > 1e-4) out.copy(_rp);
  }
  return out.normalize();
}
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
  // the game clock IS the audio clock: if Android left the audio suspended (back from another app, or it
  // never started) the ride freezes. Keep asking it to resume; if it won't within ~0.4 s, show the pause
  // menu so the player's tap on Resume (a real touch) can restart it — instead of a frozen ride
  if (game.running && !game.over && !game.paused && ac && ac.state !== 'running') {
    ac.resume().catch(() => {});
    audioStuck += dt;
    if (audioStuck > 0.4) {
      audioStuck = 0;
      setPause(true);
    }
  } else audioStuck = 0;
  // ...or it says "running" but its clock has stopped moving while we keep drawing frames: rebuild it
  if (game.running && !game.over && !game.paused && ac && ac.state === 'running') {
    if (ac.currentTime === lastAcT) {
      acFrozen += dt;
      if (acFrozen > 0.6) {
        acFrozen = 0;
        rebuildAudio();
        if (ac && ac.state !== 'running') ac.resume().catch(() => {});
      }
    } else acFrozen = 0;
    lastAcT = ac ? ac.currentTime : -1;
  } else acFrozen = 0;
  clock += dt;
  let ts = 1;
  if (game.slow > 0) {
    game.slow -= dt;
    ts = 0.2;
    if (game.slow <= 0 && game.over) showOver();
  }
  const P = player;
  if (game.running && !game.over && !game.paused) {
    const T = now();
    let B = beatAt(T - lat());
    // the show clock may never jump backwards (>2 beats) or leap ahead (>16) mid-ride. If the phone's clock or audio
    // delay jumps (app switch, Bluetooth, audio restart), re-anchor the tempo map so the ride carries
    // on from where it was, instead of dropping back to the warm-up circle with no moves
    if (game.lastB != null && (B < game.lastB - 2 || B > game.lastB + 16)) {
      const d = T - lat() - timeAt(game.lastB);
      game.tempos.forEach(x => (x.time += d));
      game.boostEnd += d; // NOS and jump timers live on the same clock
      P.hopT0 += d;
      B = beatAt(T - lat());
    }
    game.lastB = B;
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
    P.bike.wheels.forEach(w => (w.rotation.x += dt * (boostActive() ? 55 : 25)));
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
      // other riders: always on the wall riding their own loops. When a jump is due, one of them swings
      // onto a path that crosses yours on that beat, then just carries on round (they never vanish)
      const K = game.TUT ? 0 : ridersFor(game.act);
      pool.forEach((s, i) => {
        if (i < K && !s.active) {
          s.active = true;
          s.state = 'ride';
          s.busy = false;
          s.from = null;
          s.path = idlePath(B);
          s.fadeB = B;
          s.bike.g.visible = s.trail.visible = true;
          riderPos(s, B, _c);
          fillTrail(s.trail, _c.multiplyScalar(R - 0.04));
        }
      });
      for (const n of game.notes) {
        if (n.type !== 'jump' || n.slot || n.judged || n.beat - B > LOOK || n.beat - B < -1) continue;
        // pick the free rider who will already be nearest the crossing point on that beat, crossing at a
        // decent angle, and nudge their whole loop by the smallest rotation so they arrive there: a gentle
        // drift over a few beats, never a U-turn
        posAt(n.beat, _c);
        tanAt(n.beat, _b);
        let best = null;
        for (const s of pool.slice(0, K)) {
          if (!s.active || s.busy || s.state !== 'ride') continue;
          const at = riderPos(s, n.beat, new V3()),
            q = new THREE.Quaternion().setFromUnitVectors(at, _c),
            dir = new V3().crossVectors(s.path.A, at).applyQuaternion(q),
            score = at.angleTo(_c) + 0.8 * (1 - Math.abs(Math.sin(dir.angleTo(_b))));
          if (!best || score < best.score) best = { s, q, score };
        }
        if (!best) continue;
        const s = best.s,
          P0 = s.path;
        s.busy = true;
        s.note = n;
        n.slot = s;
        s.from = P0;
        s.bl0 = B;
        s.bl1 = Math.max(B + 0.5, n.beat - 0.6);
        s.path = { M: P0.M.clone().applyQuaternion(best.q), A: P0.A.clone().applyQuaternion(best.q), w: P0.w, b0: P0.b0 };
        // the crossing marker / ahead line follow the rider's real path
        n.M = _c.clone();
        n.A = s.path.A.clone();
        n.w = s.path.w;
        n.c = new V3().crossVectors(n.A, n.M).normalize();
      }
      for (const s of pool) {
        if (!s.active) continue;
        const n = s.busy ? s.note : null,
          dB = n ? B - n.beat : 99;
        if (s.state === 'ride') {
          riderPos(s, B, _a);
          riderPos(s, B + 0.02, _b).sub(_a).normalize();
          orientOnWall(s.bike.g, _a, _b, 0);
          // dodging you: a quick hop off the wall
          const dx = s.dodgeB != null ? (B - s.dodgeB) / 0.6 : 9;
          if (dx >= 0 && dx < 1) {
            s.bike.g.position.multiplyScalar((R - 0.7 * Math.sin(Math.PI * dx)) / R);
            s.bike.g.rotateX(-0.2 * Math.sin(Math.PI * dx));
          }
          arcTrail(s.trail, (i, o) => riderPos(s, B - (i * TRAIL_STEP) / s.path.w, o));
          s.bike.wheels.forEach(w => (w.rotation.x += dt * 25));
          setGhost(s, clamp((B - s.fadeB) / 0.8, 0, 1));
          s.ahead.visible = !!n && dB < 0;
          if (s.ahead.visible) {
            const len = n.w * -dB + 0.35;
            arcTrail(s.ahead, (i, o) => o.copy(n.M).applyAxisAngle(n.A, n.w * dB + (i / 21) * len));
          }
          s.mark.visible = !!n && dB < 0.3;
          if (s.mark.visible) {
            s.mark.position.copy(n.M).multiplyScalar(R - 0.12);
            const u = clamp(1 + dB / LOOK, 0, 1);
            s.mark.scale.setScalar(0.7 + 1.1 * u + 0.25 * Math.sin(clock * 16));
            s.mark.material.opacity = 0.4 + 0.6 * u;
          }
          if (n && dB > 2) {
            s.busy = false;
            s.from = null;
            n.slot = null;
            n.done = true;
          }
        } else if (s.state === 'tumble') {
          tumble(s, dt);
          s.bike.g.position.copy(s.cp);
          s.bike.g.rotateOnAxis(s.sa, s.sw * dt);
          s.mark.visible = s.trail.visible = s.ahead.visible = false;
          if (dB > 2) {
            // knocked off: back on the bike somewhere else in the globe, fading in
            if (n) {
              n.slot = null;
              n.done = true;
            }
            s.busy = false;
            s.state = 'ride';
            s.from = null;
            s.path = idlePath(B);
            s.fadeB = B;
            s.trail.visible = true;
            riderPos(s, B, _c);
            fillTrail(s.trail, _c.multiplyScalar(R - 0.04));
          }
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
    {
      if (!nosFlame) nosFlame = makeNosFlame();
      if (nosFlame.parent !== P.bike.g) P.bike.g.add(nosFlame, nosFlame.userData.light);
      const on = boostActive();
      nosFlame.visible = on;
      nosFlame.userData.light.intensity = 0;
      if (on) {
        const k = 0.85 + Math.random() * 0.4;
        nosFlame.scale.set(0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.2, k);
        nosFlame.userData.light.intensity = 2.2 * k;
      }
    }
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
  for (const s of pool) if ((s.busy || s.active) && s.bike.flutter) s.bike.flutter(clock, 1);
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
