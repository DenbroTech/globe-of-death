import * as THREE from 'three';
import { renderer } from './renderer.js';
import { cv, tex } from './textures.js';

/* ---------- bike + rider builder ---------- */

/* ---------- studio reflections for bikes, riders and the cage ---------- */
let ENV = null;
function getEnv() {
  if (ENV) return ENV;
  try {
    const es = new THREE.Scene(),
      [c, x] = cv(16, 256),
      gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#dfeaff');
    gr.addColorStop(0.46, '#9aa3b5');
    gr.addColorStop(0.5, '#5a5249');
    gr.addColorStop(1, '#16130f');
    x.fillStyle = gr;
    x.fillRect(0, 0, 16, 256);
    es.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(50, 32, 16),
        new THREE.MeshBasicMaterial({ map: tex(c, false), side: THREE.BackSide }),
      ),
    );
    [
      [0, 42, 0, 36, 1, 36, 1.6],
      [38, 14, 0, 1, 16, 44, 1.2],
      [-38, 12, 8, 1, 12, 30, 0.9],
      [0, 9, -38, 30, 9, 1, 0.7],
      [10, 6, 38, 14, 6, 1, 0.5],
    ].forEach(([x0, y0, z0, w, h, d, k]) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) }),
      );
      m.position.set(x0, y0, z0);
      es.add(m);
    });
    const pm = new THREE.PMREMGenerator(renderer);
    ENV = pm.fromScene(es, 0.02).texture;
    pm.dispose();
  } catch (e) {
    ENV = null;
  }
  return ENV;
}
function envify(obj) {
  const E = getEnv();
  if (!E) return;
  obj.traverse(m => {
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => {
      if (mt && mt.isMeshStandardMaterial && !mt.envMap) {
        mt.envMap = E;
        mt.envMapIntensity = mt.metalness > 0.75 ? 1.15 : mt.map ? 0.45 : 0.3;
        mt.needsUpdate = true;
      }
    });
  });
}

export { envify };
