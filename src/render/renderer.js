import * as THREE from 'three';
import { $ } from '../core/constants.js';

let app, canvas, MOBILE, scene, camera;

let renderer;

export function initRenderer() {
  /* ---------- renderer ---------- */
  app = $('#app');
  canvas = $('#c');
  try {
    // phones: no logarithmic depth buffer (it writes depth per pixel and kills early-z: a big GPU/heat cost)
    const phone = Math.min(innerWidth, innerHeight) < 700;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: !phone, powerPreference: phone ? 'low-power' : 'high-performance' });
  } catch (e) {
    bootFail('This device or app view could not start 3D graphics (WebGL). Try opening the link in Safari or Chrome.');
    return;
  }
  MOBILE = Math.min(innerWidth, innerHeight) < 700;
  // phones start at 1.25× resolution; the frame loop lowers it further if the phone struggles (see perf in loop.js)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.25 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !MOBILE; // the real-time shadow pass re-draws every caster each frame: off on phones
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  scene.fog = new THREE.Fog(0x07060a, 22, 50);
  camera = new THREE.PerspectiveCamera(72, 1, MOBILE ? 0.1 : 0.05, 420);
  (function () {
    const pm = new THREE.PMREMGenerator(renderer),
      es = new THREE.Scene();
    const g = new THREE.SphereGeometry(10, 32, 16),
      p = g.attributes.position,
      col = [],
      lo = new THREE.Color(0x0a0608),
      hi = new THREE.Color(0x5a3a28);
    for (let i = 0; i < p.count; i++) {
      const y = (p.getY(i) / 10 + 1) / 2;
      const c = lo.clone().lerp(hi, Math.pow(y, 1.6));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
    [
      [0, 9, 0, new THREE.Color(5, 4.4, 3.6)],
      [7, 5, -4, new THREE.Color(4, 1.1, 1.3)],
      [-6, 6, 5, new THREE.Color(4, 2.6, 1.2)],
    ].forEach(([x, y, z, c]) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }),
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      es.add(m);
    });
    scene.environment = pm.fromScene(es, 0.03).texture;
  })();
}

export { MOBILE, app, camera, canvas, renderer, scene };
