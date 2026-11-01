import { game } from '../core/state.js';
import { app, camera, canvas, renderer } from './renderer.js';
import { _a, _b, _c } from './trails.js';
import { player } from '../game/objects.js';
import { boostActive } from '../game/boost.js';
import { G0, showroom } from '../ui/garage.js';
import { clock } from '../game/loop.js';
import { $, GY, R, V3, YAX, clamp } from '../core/constants.js';
import { tutEv } from '../ui/tutorial.js';

let cam, ptr, tp, tl, tu, gpos;

/* ---------- camera ---------- */
const MODES = ['centre', 'chase', 'chest', 'outside', 'arena'],
  NAMES = { outside: 'Outside', chest: 'Chest', chase: 'Chase', centre: 'Centre', arena: 'Arena' };
function cycleCam() {
  cam.mode = MODES[(MODES.indexOf(cam.mode) + 1) % MODES.length];
  $('#camName').textContent = NAMES[cam.mode];
  tutEv('cam');
  try {
    localStorage.setItem('god-cam5', cam.mode);
  } catch (e) {}
}
let pinch = 0;
const upP = e => {
  ptr.delete(e.pointerId);
  if (ptr.size < 2) pinch = 0;
};
function updateCamera(dt) {
  const P = player,
    mode = showroom
      ? 'garage'
      : (game.over && game.slow <= 0) || !game.running
        ? 'arena'
        : game.over
          ? 'chase'
          : cam.mode;
  let fov = 50,
    k,
    kl;
  P.bike.rider.visible = mode !== 'chest';
  if (mode === 'chest') {
    fov = camera.aspect < 0.8 ? 86 : 76;
    const inward = _a.copy(P.p).negate();
    tp.copy(P.p)
      .multiplyScalar(R - P.h)
      .addScaledVector(inward, 1.0)
      .addScaledVector(P.t, -0.12)
      .add(gpos);
    tl.copy(tp).addScaledVector(P.t, 3).addScaledVector(inward, -0.75);
    k = kl = 1;
    cam.up.copy(inward);
  } else if (mode === 'outside') {
    fov = camera.aspect < 0.8 ? 64 : 50; // outside the cage on your side of the globe, arena the right way up
    const az = Math.atan2(P.p.x, P.p.z);
    let d = az - cam.oaz;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.oaz += d * (cam.snap ? 1 : 1 - Math.exp(-2.2 * dt));
    const dist = (R + 4.6) * (camera.aspect < 0.8 ? 1.15 : 1);
    tp.set(Math.sin(cam.oaz) * dist, 1.3 + P.p.y * 2.2, Math.cos(cam.oaz) * dist).add(gpos);
    tl.copy(P.p)
      .multiplyScalar(R * 0.55)
      .add(gpos);
    k = 1 - Math.exp(-5 * dt);
    kl = 1 - Math.exp(-6 * dt);
    cam.up.lerp(YAX, 1 - Math.exp(-5 * dt)).normalize();
  } else if (mode === 'chase') {
    fov = camera.aspect < 0.8 ? 80 : 68;
    const axis = _a.crossVectors(P.p, P.t).normalize(),
      back = _b.copy(P.p).applyAxisAngle(axis, -0.62);
    tp.copy(back)
      .multiplyScalar(R - 1.6)
      .add(gpos);
    tl.copy(P.p)
      .multiplyScalar(R - 0.7 - P.h * 0.5)
      .addScaledVector(P.t, 1.9)
      .add(gpos);
    k = 1 - Math.exp(-9 * dt);
    kl = 1 - Math.exp(-12 * dt);
    cam.up.lerp(tu.copy(P.p).negate(), 1 - Math.exp(-7 * dt)).normalize();
  } else if (mode === 'centre') {
    fov = camera.aspect < 0.8 ? 82 : 68;
    const axis = _a.crossVectors(P.p, P.t).normalize(),
      back = _b.copy(P.p).applyAxisAngle(axis, -0.75);
    tp.copy(back)
      .multiplyScalar(R - 2.75)
      .add(gpos);
    tl.copy(P.p)
      .multiplyScalar(R - 0.5)
      .addScaledVector(P.t, 1.1)
      .add(gpos);
    const vd = _c.copy(tl).sub(tp).normalize();
    tu.copy(YAX).addScaledVector(vd, -vd.y);
    if (tu.lengthSq() < 0.06) tu.copy(P.p).negate();
    tu.normalize();
    k = 1 - Math.exp(-7 * dt);
    kl = 1 - Math.exp(-12 * dt);
    cam.up.lerp(tu, 1 - Math.exp(-5 * dt)).normalize();
  } else if (mode === 'garage') {
    const pr = camera.aspect < 0.8;
    fov = pr ? 62 : 45;
    tp.set(0.15 + Math.sin(clock * 0.25) * 0.25, 1.7, pr ? 7.4 : 5.2).add(G0);
    tl.set(0, pr ? -0.35 : 0.85, 0.2).add(G0);
    k = kl = 1 - Math.exp(-4 * dt);
    cam.up.lerp(YAX, k).normalize();
  } else {
    if (performance.now() - cam.last > 4000) cam.az += dt * 0.06;
    const d = 12.5 * cam.zoom * (camera.aspect < 0.8 ? 1.5 : 1);
    tp.set(Math.cos(cam.el) * Math.sin(cam.az), Math.sin(cam.el), Math.cos(cam.el) * Math.cos(cam.az))
      .multiplyScalar(d)
      .add(gpos);
    tl.copy(gpos);
    k = 1 - Math.exp(-3 * dt);
    kl = k;
    cam.up.lerp(YAX, k).normalize();
  }
  if (cam.snap && mode !== 'arena') {
    k = kl = 1;
    cam.snap = false;
    if (mode === 'garage') cam.up.copy(YAX);
    else if (mode !== 'outside' && mode !== 'centre') cam.up.copy(P.p).negate();
  }
  cam.pos.lerp(tp, k);
  cam.look.lerp(tl, kl);
  camera.position.copy(cam.pos);
  if (P.shake > 0 && !game.over) {
    camera.position.addScaledVector(
      _c.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
      P.shake * 0.12,
    );
  }
  camera.up.copy(cam.up);
  camera.lookAt(cam.look);
  if (game.running && !game.over && boostActive()) fov += 10;
  if (Math.abs(camera.fov - fov) > 0.1) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
  }
}
function resize() {
  const w = app.clientWidth,
    h = app.clientHeight,
    sh = Math.round(Math.min(90, h * 0.11));
  renderer.setSize(w, h, false);
  camera.aspect = w / (h + 2 * sh);
  camera.setViewOffset(w, h + 2 * sh, 0, 2 * sh, w, h);
  camera.updateProjectionMatrix();
}

export function initCamera() {
  cam = {
    oaz: 0,
    mode: 'centre',
    az: 0.7,
    el: 0.3,
    zoom: 1,
    last: 0,
    pos: new V3(0, GY, 12),
    look: new V3(0, GY, 0),
    up: new V3(0, 1, 0),
    snap: false,
  };
  try {
    const m = localStorage.getItem('god-cam5');
    if (MODES.includes(m)) cam.mode = m;
  } catch (e) {}
  $('#camName').textContent = NAMES[cam.mode];
  $('#camBtn').onclick = cycleCam;
  ptr = new Map();
  canvas.addEventListener('pointerdown', e => {
    if (cam.mode !== 'arena' && game.running && !game.over) return;
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cam.last = performance.now();
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    if (ptr.size === 1) {
      cam.az -= (e.clientX - p.x) * 0.006;
      cam.el = clamp(cam.el + (e.clientY - p.y) * 0.004, -0.15, 1.25);
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptr.size === 2) {
      const [a, b] = [...ptr.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.zoom = clamp((cam.zoom * pinch) / d, 0.45, 1.8);
      pinch = d;
    }
    cam.last = performance.now();
  });
  canvas.addEventListener('pointerup', upP);
  canvas.addEventListener('pointercancel', upP);
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      cam.zoom = clamp(cam.zoom * (1 + e.deltaY * 0.001), 0.45, 1.8);
      cam.last = performance.now();
    },
    { passive: false },
  );
  tp = new V3();
  tl = new V3();
  tu = new V3();
  gpos = new V3(0, GY, 0);
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(app);
}

export { cam, cycleCam, resize, updateCamera };
