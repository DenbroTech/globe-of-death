import * as THREE from 'three';
import { model } from './models.js';
import { glowSpr } from './arenas.js';

/* ---------- imported vehicles & creatures flying/sailing round the classic and premium arenas ----------
   Each one is a wrapper group whose +z is "forward"; the model inside is turned to match (`face`).
   `VEHICLES[arena](g)` adds them to the arena group and returns a tick(t). */

function rig(g, name, { size = 1, face = 0, y = 0, then } = {}) {
  const w = new THREE.Group();
  w.userData.veh = name;
  model(name).then(m => {
    m.rotation.y = face;
    m.scale.multiplyScalar(size);
    m.position.y += y;
    w.add(m);
    if (then) then(m, w);
  });
  g.add(w);
  return w;
}
const head = new THREE.Vector3();
/* fly a wrapper round a circle (centre cx/cz), facing along the path and banking into the turn */
function circle(w, t, { r, h, s, ph = 0, cx = 0, cz = 0, bank = 0.25, bob = 0 }) {
  const a = t * s + ph,
    d = Math.sign(s) || 1;
  w.position.set(cx + Math.cos(a) * r, h + Math.sin(t * 0.6 + ph) * bob, cz + Math.sin(a) * r);
  head.set(cx + Math.cos(a + 0.05 * d) * r, w.position.y, cz + Math.sin(a + 0.05 * d) * r);
  w.lookAt(head);
  w.rotateZ(-bank * d);
}

const VEHICLES = {
  // a red biplane looping wide over the bay, and a tug chugging across the water
  beach(g) {
    const plane = rig(g, 'plane', { size: 2.2, face: Math.PI });
    const tug = rig(g, 'tug', { size: 6, face: Math.PI / 2, y: -1.4 });
    return t => {
      circle(plane, t, { r: 62, h: 24, s: 0.11, ph: 2, bank: 0.35, bob: 2 });
      circle(tug, t, { r: 66, h: Math.sin(t * 1.3) * 0.2, s: -0.018, ph: 4, bank: 0 });
      tug.rotateZ(Math.sin(t * 1.1) * 0.04);
    };
  },
  // a giant's-eye view: a plane high over the garden
  garden(g) {
    const plane = rig(g, 'plane', { size: 3, face: Math.PI });
    return t => circle(plane, t, { r: 75, h: 46, s: 0.07, ph: 1, bank: 0.3, bob: 3 });
  },
  // a lit airship drifting round the skyline
  crane(g) {
    const ship = rig(g, 'airship', {
      size: 5,
      then: m =>
        m.traverse(o => {
          if (o.isMesh) {
            o.material = o.material.clone();
            o.material.emissive = new THREE.Color(0x2a2f3a); // catch the city glow at night
          }
        }),
    });
    const blink = glowSpr(0xff2030, 2.2),
      nose = glowSpr(0xffffff, 1.8);
    blink.position.set(0, -0.2, -7.5);
    nose.position.set(0, 2.5, 7.8);
    ship.add(blink, nose);
    return t => {
      circle(ship, t, { r: 70, h: 26, s: -0.035, ph: 3, bank: 0, bob: 1.2 });
      blink.material.opacity = Math.sin(t * 3) > 0.4 ? 1 : 0.1;
    };
  },
  // a submarine patrolling the reef and an octopus pulsing along the sand
  under(g) {
    const sub = rig(g, 'sub', { size: 3.2 });
    const octo = rig(g, 'octopus', { size: 3.2 });
    return t => {
      circle(sub, t, { r: 40, h: 11, s: 0.05, ph: 0.5, bank: 0.08, bob: 1.5 });
      // jet-propelled: squeeze and shoot forward, then drift and spread
      const k = (t * 0.6) % 1,
        squeeze = Math.max(0, Math.sin(k * Math.PI * 2));
      circle(octo, t + Math.sin(t * 3.77) * 0.25, { r: 24, h: 2.5 + Math.sin(t * 0.4) * 2, s: -0.04, ph: 2, bank: 0 });
      octo.rotateX(-0.5);
      octo.scale.set(1 - squeeze * 0.12, 1 + squeeze * 0.18, 1 - squeeze * 0.12);
    };
  },
  // spaceships cruising round the moon base
  moon(g) {
    const ships = [0, 1].map(i => rig(g, 'spaceship', { size: 1.1 + i * 0.4 }));
    return t =>
      ships.forEach((w, i) => circle(w, t, { r: 48 + i * 22, h: 22 + i * 10, s: i ? -0.06 : 0.09, ph: i * 3, bank: 0.35, bob: 3 }));
  },
};
/* premium arenas pick these up through their tick (no LIFE entry) */
VEHICLES.solar = g => {
  const ships = [0, 1, 2].map(i => rig(g, 'spaceship', { size: 1 + i * 0.35 }));
  return t =>
    ships.forEach((w, i) =>
      circle(w, t, { r: 36 + i * 16, h: [10, 19, -14][i], s: [0.12, -0.08, 0.06][i], ph: i * 2, bank: 0.4, bob: 4 }),
    );
};

export { VEHICLES };
