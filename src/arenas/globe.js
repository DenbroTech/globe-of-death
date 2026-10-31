import * as THREE from 'three';
import { game } from '../core/state.js';
import { scene } from '../render/renderer.js';
import { netTex } from '../render/textures.js';
import { D, GY, R, V3, YAX } from '../core/constants.js';

let stand, globe, steel, RG, cageParts, base;

export function initGlobe() {
  /* ---------- globe ---------- */
  stand = new THREE.Group();
  scene.add(stand);
  globe = new THREE.Group();
  globe.position.y = GY;
  scene.add(globe);
  steel = new THREE.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 0.95, roughness: 0.26, envMapIntensity: 1.3 });
  RG = R + 0.07;
  for (let lat = -75; lat <= 75; lat += 15) {
    const r = RG * Math.cos(lat * D);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, lat === 0 ? 0.06 : 0.03, 8, 120), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = RG * Math.sin(lat * D);
    ring.castShadow = true;
    globe.add(ring);
  }
  for (let k = 0; k < 12; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RG, 0.03, 8, 140), steel);
    ring.rotation.y = (k * Math.PI) / 12;
    ring.castShadow = true;
    globe.add(ring);
  }
  [1, -1].forEach(s => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), steel);
    cap.position.y = s * (RG + 0.02);
    globe.add(cap);
  });
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R + 0.05, 72, 36),
      new THREE.MeshStandardMaterial({
        color: 0x9aa1ab,
        metalness: 0.85,
        roughness: 0.35,
        alphaMap: netTex,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  cageParts = globe.children.slice();
  game.bubbleMesh = null;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4,
      top = new V3(
        Math.cos(a) * RG * Math.cos(50 * D),
        GY - RG * Math.sin(50 * D),
        Math.sin(a) * RG * Math.cos(50 * D),
      ),
      foot = new V3(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4),
      len = top.distanceTo(foot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, len, 10), steel);
    leg.position.copy(top).add(foot).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(YAX, top.clone().sub(foot).normalize());
    leg.castShadow = true;
    stand.add(leg);
  }
  base = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.07, 8, 64), steel);
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.08;
  stand.add(base);
}

export { cageParts, globe, stand };
