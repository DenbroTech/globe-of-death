import * as THREE from 'three';
import { game } from '../core/state.js';
import { glowTex } from './textures.js';
import { globe } from '../arenas/globe.js';
import { V3 } from '../core/constants.js';

let pPos, pVel, pGeo, pMat, sparks, flash;

const PN = 240;
function burst(at, n = PN, spd = 7) {
  for (let i = 0; i < n; i++) {
    pPos.set([at.x, at.y, at.z], i * 3);
    const v = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(2 + Math.random() * spd);
    pVel.set([v.x, v.y, v.z], i * 3);
  }
  for (let i = n; i < PN; i++) pPos.set([0, 99, 0], i * 3);
  game.sparkT = 1.6;
  flash.position.copy(at);
  flash.intensity = n === PN ? 8 : 3;
}

export function initParticles() {
  /* ---------- particles ---------- */
  pPos = new Float32Array(PN * 3);
  pVel = new Float32Array(PN * 3);
  pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pMat = new THREE.PointsMaterial({
    color: 0xffb347,
    size: 0.13,
    map: glowTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  sparks = new THREE.Points(pGeo, pMat);
  sparks.frustumCulled = false;
  globe.add(sparks);
  flash = new THREE.PointLight(0xff8a30, 0, 10, 1.5);
  globe.add(flash);
  game.sparkT = 0;
}

export { PN, burst, flash, pGeo, pMat, pPos, pVel };
