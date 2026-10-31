import * as THREE from 'three';
import { MOBILE, scene } from './renderer.js';
import { GY, V3, YAX } from '../core/constants.js';

let hemi, inner;

const spots = [],
  beams = [];
function spot(color, int, pos, shadow) {
  const s = new THREE.SpotLight(color, int, 60, 0.42, 0.55, 1);
  s.userData = { base: int, col: color };
  spots.push(s);
  s.position.set(...pos);
  s.target.position.set(0, GY, 0);
  if (false && shadow) {
    s.castShadow = true;
    s.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024);
    s.shadow.bias = -0.0006;
    s.shadow.camera.near = 4;
    s.shadow.camera.far = 40;
  }
  scene.add(s, s.target);
  const dir = new V3(...pos).sub(new V3(0, GY, 0)),
    len = dir.length();
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(4.2, len, 40, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.copy(new V3(0, GY, 0).addScaledVector(dir, 0.5));
  beam.quaternion.setFromUnitVectors(YAX, dir.normalize());
  scene.add(beam);
  beams.push(beam);
}

export function initLights() {
  /* ---------- lights ---------- */
  hemi = new THREE.HemisphereLight(0x6e5c80, 0x140c08, 0.45);
  scene.add(hemi);
  spot(0xfff0d4, 2.4, [5, 17, 8], true);
  spot(0xff3b55, 1.5, [-11, 12, -3]);
  spot(0xffaa44, 1.4, [3, 13, -11]);
  inner = new THREE.PointLight(0xffc27a, 0.9, 9, 1.5);
  inner.position.set(0, GY, 0);
  scene.add(inner);
}

export { beams, hemi, inner, spots };
