import { MOBILE } from '../render/renderer.js';
import * as THREE from 'three';
import { game } from '../core/state.js';
import { renderer, scene } from '../render/renderer.js';
import { beams, hemi, spots } from '../render/lights.js';
import { bigtop } from './stage.js';
import { crowd, makeCrowd } from './crowd.js';
import { cageParts, globe, stand } from './globe.js';
import { ARENAS, grad, sky, sun } from './arenas.js';
import { bubbleMat } from './sealife.js';
import { arenaOpen } from '../game/progress.js';
import { NEON_T } from '../render/neon.js';
import { ac, applyArenaAudio, moodLP } from '../audio/synth.js';
import { R, V3, YAX } from '../core/constants.js';
import { LIFE } from './people.js';

let arenaId = 'bigtop';
const built = {};
function setArena(id) {
  arenaId = id;
  // the Big Top tent is in the scene from boot; hide it even if it was never "built" (game opened in another arena)
  bigtop.visible = id === 'bigtop';
  try {
    localStorage.setItem('god-arena', id);
  } catch (e) {}
  for (const k in ARENAS) {
    const A = ARENAS[k];
    if (k === id) {
      if (!built[k]) {
        built[k] = { g: A.build(), c: makeCrowd(A.crowd) };
        built[k].life = LIFE[k] ? LIFE[k](built[k].g) : null;
        if (built[k].g !== bigtop) scene.add(built[k].g);
        scene.add(built[k].c.grp);
      }
    }
    if (built[k]) {
      built[k].g.visible = k === id;
      built[k].c.grp.visible = k === id;
    }
  }
  game.curCrowd = built[id].c;
  crowd.sync();
  const E = ARENAS[id].env;
  scene.background = new THREE.Color(E.bg);
  scene.fog.color.setHex(E.fog[0]);
  scene.fog.near = E.fog[1];
  scene.fog.far = E.fog[2];
  sky.visible = !!E.sky;
  if (E.sky) {
    sky.material.map = grad(E.sky);
    sky.material.needsUpdate = true;
  }
  hemi.color.setHex(E.hemi[0]);
  hemi.groundColor.setHex(E.hemi[1]);
  hemi.intensity = E.hemi[2];
  sun.intensity = E.sun;
  if (E.sunPos) sun.position.set(...E.sunPos);
  sun.color.setHex(E.sunCol || 0xffffff);
  spots.forEach((s, i) => {
    s.intensity = s.userData.base * E.spots;
    s.color.setHex(E.spotCol ?? s.userData.col);
  });
  beams.forEach(b => (b.visible = !!E.beams));
  renderer.toneMappingExposure = E.exp;
  stand.visible = !E.noStand;
  if (E.bubble && !game.bubbleMesh) {
    game.bubbleMesh = new THREE.Mesh(new THREE.SphereGeometry(R + 0.06, 64, 32), bubbleMat);
    game.bubbleMesh.renderOrder = 3;
    globe.add(game.bubbleMesh);
  }
  cageParts.forEach(m => (m.visible = !E.bubble));
  if (game.bubbleMesh) game.bubbleMesh.visible = !!E.bubble;
  globe.rotation.set(0, 0, 0);
  if (moodLP) applyArenaAudio(id);
}
let lifeF = 0;
function arenaTick(t) {
  NEON_T.value = t;
  const A = ARENAS[arenaId],
    b = built[arenaId];
  if (!b) return;
  // background life: every frame on desktop, every other frame on phones (cuts CPU, the eye can't tell)
  if (b.g.userData.tick && (!MOBILE || (lifeF++ & 1) === 0)) b.g.userData.tick(t);
  if (b.life) b.life(t);
  if (game.bubbleMesh && game.bubbleMesh.visible) bubbleMat.uniforms.uTime.value = t;
  // the pirate ship rocks on the swell: the globe and crowd move with the deck
  if (A.env.rock) {
    globe.rotation.z = Math.sin(t * 0.6) * 0.035;
    globe.rotation.x = Math.sin(t * 0.43) * 0.02;
    b.c.grp.rotation.copy(globe.rotation);
  }
  if (A.env.sway) {
    globe.rotation.z = Math.sin(t * 0.5) * 0.035;
    globe.rotation.x = Math.sin(t * 0.37) * 0.025;
    const top = new V3(0, R + 0.15, 0).applyEuler(globe.rotation).add(globe.position),
      anchor = new V3(0, 19.4, 0),
      cab = b.g.userData.cable;
    cab.position.copy(top).add(anchor).multiplyScalar(0.5);
    cab.scale.y = top.distanceTo(anchor);
    cab.quaternion.setFromUnitVectors(YAX, anchor.clone().sub(top).normalize());
    b.g.userData.hook.position.copy(top).add(new V3(0, 0.3, 0));
    b.g.userData.blink.visible = Math.sin(t * 3) > 0;
  }
  if (b.g.userData.sea) b.g.userData.sea.position.y = -0.08 + Math.sin(t * 0.8) * 0.03;
}

export function initCurrent() {
  try {
    const a = localStorage.getItem('god-arena');
    if (ARENAS[a] && arenaOpen(a)) arenaId = a;
  } catch (e) {}
}

export { arenaId, arenaTick, built, setArena };
